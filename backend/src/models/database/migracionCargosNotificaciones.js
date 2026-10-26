const { pool, query } = require('../../config/database');

const CATALOGO = [
  {
    area: 'Dirección General',
    cargos: [
      'Director General',
      'Gerente General',
      'Subdirector',
      'Asistente de Dirección',
      'Secretaria de Dirección'
    ]
  },
  {
    area: 'Administración y Finanzas',
    cargos: [
      'Gerente Administrativo',
      'Jefe de Administración',
      'Jefe de Finanzas',
      'Analista Financiero',
      'Auxiliar Administrativo',
      'Auxiliar Contable'
    ]
  },
  {
    area: 'Asesoría Jurídica',
    cargos: [
      'Asesor Legal General',
      'Abogado Senior',
      'Abogado Junior',
      'Asistente Legal'
    ]
  },
  {
    area: 'Recursos Humanos',
    cargos: [
      'Jefe de Recursos Humanos',
      'Coordinador de RRHH',
      'Analista de RRHH',
      'Asistente de RRHH'
    ]
  },
  {
    area: 'Secretaría General',
    cargos: [
      'Secretario General',
      'Secretaria de Mesa de Partes',
      'Secretaria Ejecutiva',
      'Asistente de Secretaría',
      'Recepcionista'
    ]
  },
  {
    area: 'Tecnologías de la Información',
    cargos: [
      'Jefe de TI',
      'Administrador de Sistemas',
      'Desarrollador',
      'Soporte Técnico',
      'Analista de Sistemas'
    ]
  }
];

async function runMigration() {
  console.log('Iniciando migración de Cargos y Notificaciones...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Tabla cargos
    await client.query(`
      CREATE TABLE IF NOT EXISTS cargos (
        id_cargo SERIAL PRIMARY KEY,
        id_area INT NOT NULL REFERENCES areas(id_area) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_area_cargo UNIQUE (id_area, nombre)
      );
    `);
    console.log('✓ Tabla cargos creada/verificada.');

    // 2. Insertar catálogo de cargos
    for (const item of CATALOGO) {
      const areaRes = await client.query('SELECT id_area FROM areas WHERE nombre = $1', [item.area]);
      if (areaRes.rows.length === 0) {
        console.warn(`Área "${item.area}" no encontrada.`);
        continue;
      }
      const idArea = areaRes.rows[0].id_area;
      for (const cargoNombre of item.cargos) {
        await client.query(`
          INSERT INTO cargos (id_area, nombre, activo)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (id_area, nombre) DO NOTHING;
        `, [idArea, cargoNombre]);
      }
    }
    console.log('✓ Catálogo de cargos insertado correctamente.');

    // 3. Modificaciones de columnas en correspondencia_recibida y derivaciones
    await client.query(`
      ALTER TABLE correspondencia_recibida
        ADD COLUMN IF NOT EXISTS cargo_responsable VARCHAR(100);
      ALTER TABLE derivaciones
        ADD COLUMN IF NOT EXISTS cargo_destino VARCHAR(100);
    `);
    console.log('✓ Columnas agregadas a correspondencia_recibida y derivaciones.');

    // Permitir hasta cinco usuarios activos por combinación Área + Cargo.
    const excedidos = await client.query(`
      SELECT id_area, LOWER(TRIM(cargo)) AS cargo_normalizado,
             COUNT(*)::INT AS total,
             ARRAY_AGG(username ORDER BY id_usuario) AS usuarios
      FROM usuarios
      WHERE activo = TRUE AND id_area IS NOT NULL AND cargo IS NOT NULL
      GROUP BY id_area, LOWER(TRIM(cargo))
      HAVING COUNT(*) > 5
    `);
    if (excedidos.rows.length > 0) {
      const detalle = excedidos.rows
        .map(({ id_area, cargo_normalizado, total, usuarios }) =>
          `área ${id_area}, cargo "${cargo_normalizado}" (${total}): ${usuarios.join(', ')}`)
        .join('; ');
      throw new Error(`Hay combinaciones Área + Cargo con más de 5 usuarios activos. Revise antes de migrar: ${detalle}`);
    }
    console.log('✓ Todas las combinaciones Área + Cargo tienen como máximo cinco usuarios activos.');

    // Sustituir la restricción anterior de un único usuario por un índice de búsqueda.
    await client.query(`
      DROP INDEX IF EXISTS idx_usuario_unico_cargo_activo;
      CREATE INDEX IF NOT EXISTS idx_usuario_area_cargo_activo
      ON usuarios (id_area, LOWER(TRIM(cargo)))
      WHERE activo = TRUE AND id_area IS NOT NULL AND cargo IS NOT NULL;
    `);
    console.log('✓ Índice actualizado para búsquedas por área y cargo.');

    await client.query('COMMIT');
    console.log('✅ Migración completada exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en migración:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration, CATALOGO };
