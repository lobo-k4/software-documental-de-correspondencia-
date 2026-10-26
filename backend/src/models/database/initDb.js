/**
 * Script automatizado para inicialización de la Base de Datos PostgreSQL.
 * Crea la base de datos si no existe, ejecuta el DDL (schema.sql) y carga los datos semilla (seeds.sql).
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../../config/env');

async function initializeDatabase() {
  console.log('===========================================================');
  console.log('🔄 INICIALIZANDO BASE DE DATOS POSTGRESQL');
  console.log('===========================================================');
  console.log(`Host: ${config.db.host}:${config.db.port}`);
  console.log(`Usuario: ${config.db.user}`);
  console.log(`Base de datos objetivo: ${config.db.database}`);

  // 1. Conexión de mantenimiento para verificar/crear la base de datos
  const adminClient = new Client({
    user: config.db.user,
    password: config.db.password,
    host: config.db.host,
    port: config.db.port,
    database: 'postgres' // Conexión a BD administrativa por defecto
  });

  try {
    await adminClient.connect();
    console.log('✓ Conectado a base de datos administrativa "postgres"');

    const checkDbRes = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [config.db.database]
    );

    if (checkDbRes.rowCount === 0) {
      console.log(`Creando base de datos "${config.db.database}"...`);
      await adminClient.query(`CREATE DATABASE "${config.db.database}"`);
      console.log(`✓ Base de datos "${config.db.database}" creada exitosamente.`);
    } else {
      console.log(`ℹ Base de datos "${config.db.database}" ya existe.`);
    }
  } catch (error) {
    console.error('✗ Error al verificar/crear la base de datos en PostgreSQL:', error.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Conexión a la base de datos objetivo para aplicar schema y seeds
  const appClient = new Client({
    user: config.db.user,
    password: config.db.password,
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    options: '-c timezone=America/La_Paz'
  });

  try {
    await appClient.connect();
    console.log(`✓ Conectado a "${config.db.database}".`);

    // Leer y ejecutar schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Ejecutando schema.sql (creación de tablas, índices y restricciones)...');
    await appClient.query(schemaSql);
    console.log('✓ Tablas, restricciones e índices creados correctamente.');

    // Migración idempotente para instalaciones existentes.
    await appClient.query(`
      ALTER TABLE correspondencia_recibida
        ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
        ADD COLUMN IF NOT EXISTS id_usuario_anulacion INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP WITH TIME ZONE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
      ALTER TABLE correspondencia_entregada
        ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
        ADD COLUMN IF NOT EXISTS id_usuario_anulacion INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP WITH TIME ZONE;
      ALTER TABLE documentos_adjuntos
        ADD COLUMN IF NOT EXISTS id_nota INT;
      ALTER TABLE notas_generadas
        ADD COLUMN IF NOT EXISTS verificaciones_qr INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS limite_verificaciones_qr INTEGER,
        ADD COLUMN IF NOT EXISTS url_verificacion TEXT;
      UPDATE notas_generadas
        SET limite_verificaciones_qr = COALESCE(
          (SELECT limite_verificaciones FROM configuracion_qr WHERE id_configuracion = 1),
          3
        )
        WHERE limite_verificaciones_qr IS NULL;
      ALTER TABLE notas_generadas
        ALTER COLUMN limite_verificaciones_qr SET DEFAULT 3,
        ALTER COLUMN limite_verificaciones_qr SET NOT NULL;
      ALTER TABLE notas_generadas
        DROP CONSTRAINT IF EXISTS notas_generadas_limite_verificaciones_qr_check;
      ALTER TABLE notas_generadas
        ADD CONSTRAINT notas_generadas_limite_verificaciones_qr_check CHECK (limite_verificaciones_qr > 0);
      ALTER TABLE configuracion_qr
        ALTER COLUMN limite_verificaciones TYPE INTEGER;
      ALTER TABLE configuracion_qr
        DROP CONSTRAINT IF EXISTS configuracion_qr_limite_verificaciones_check;
      ALTER TABLE configuracion_qr
        ADD CONSTRAINT configuracion_qr_limite_verificaciones_check CHECK (limite_verificaciones > 0);
      DO $migration$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_documentos_nota') THEN
          ALTER TABLE documentos_adjuntos ADD CONSTRAINT fk_documentos_nota
            FOREIGN KEY (id_nota) REFERENCES notas_generadas(id_nota) ON DELETE CASCADE;
        END IF;
      END $migration$;
      ALTER TABLE documentos_adjuntos DROP CONSTRAINT IF EXISTS chk_documento_ref;
      ALTER TABLE documentos_adjuntos ADD CONSTRAINT chk_documento_ref
        CHECK (
          (id_recibida IS NOT NULL AND id_entregada IS NULL AND id_nota IS NULL) OR
          (id_recibida IS NULL AND id_entregada IS NOT NULL) OR
          (id_recibida IS NULL AND id_entregada IS NULL AND id_nota IS NOT NULL)
        );
      ALTER TABLE correspondencia_recibida DROP CONSTRAINT IF EXISTS correspondencia_recibida_estado_check;
      ALTER TABLE correspondencia_recibida ADD CONSTRAINT correspondencia_recibida_estado_check
        CHECK (estado IN ('Recibido', 'En revisión', 'Derivado', 'En proceso', 'Atendido', 'Archivado', 'ANULADO'));
      ALTER TABLE correspondencia_entregada DROP CONSTRAINT IF EXISTS correspondencia_entregada_estado_check;
      ALTER TABLE correspondencia_entregada ADD CONSTRAINT correspondencia_entregada_estado_check
        CHECK (estado IN ('Borrador', 'Emitido', 'Entregado', 'Archivado', 'ANULADO'));
      UPDATE correspondencia_recibida
        SET estado = 'ANULADO', fecha_anulacion = COALESCE(fecha_anulacion, actualizado_en)
        WHERE activo = FALSE AND estado <> 'ANULADO';
      UPDATE correspondencia_entregada
        SET estado = 'ANULADO', fecha_anulacion = COALESCE(fecha_anulacion, actualizado_en)
        WHERE activo = FALSE AND estado <> 'ANULADO';

      CREATE TABLE IF NOT EXISTS cargos (
        id_cargo SERIAL PRIMARY KEY,
        id_area INT NOT NULL REFERENCES areas(id_area) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_area_cargo UNIQUE (id_area, nombre)
      );
      ALTER TABLE correspondencia_recibida ADD COLUMN IF NOT EXISTS cargo_responsable VARCHAR(100);
      ALTER TABLE derivaciones ADD COLUMN IF NOT EXISTS cargo_destino VARCHAR(100);
      DROP INDEX IF EXISTS idx_usuario_unico_cargo_activo;
      CREATE INDEX IF NOT EXISTS idx_usuario_area_cargo_activo
        ON usuarios (id_area, LOWER(TRIM(cargo)))
        WHERE activo = TRUE AND id_area IS NOT NULL AND cargo IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cargos_area ON cargos(id_area);
    `);
    console.log('✓ Migración de anulación, cargos y notificaciones aplicada correctamente.');

    // Leer y ejecutar seeds.sql
    const seedsPath = path.join(__dirname, 'seeds.sql');
    const seedsSql = fs.readFileSync(seedsPath, 'utf8');
    console.log('Ejecutando seeds.sql (inserción de roles, permisos, áreas, usuario admin, plantillas)...');
    await appClient.query(seedsSql);
    console.log('✓ Datos iniciales (seeds) cargados correctamente.');

    await appClient.query(`
      INSERT INTO configuracion_qr (id_configuracion, limite_verificaciones)
      VALUES (1, 3)
      ON CONFLICT (id_configuracion) DO NOTHING;
    `);

    console.log('===========================================================');
    console.log('✅ BASE DE DATOS INICIALIZADA EXITOSAMENTE');
    console.log('===========================================================');
  } catch (error) {
    console.error('✗ Error al ejecutar los scripts de base de datos:', error.message);
    process.exit(1);
  } finally {
    await appClient.end();
  }
}

initializeDatabase();
