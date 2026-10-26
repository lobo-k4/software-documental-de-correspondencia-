-- ============================================================================
-- SISTEMA DE GESTIÓN DE CORRESPONDENCIA RECIBIDA Y ENTREGADA
-- Script DDL: Creación del Esquema Relacional en PostgreSQL
-- ============================================================================

-- Habilitar extensión para UUID en caso de requerirse
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: ROLES
-- Define los perfiles de acceso: Administrador, Operador y Secretaria
CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA: PERMISOS
-- Control granular de privilegios para RBAC
CREATE TABLE IF NOT EXISTS permisos (
    id_permiso SERIAL PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255)
);

-- 3. TABLA INTERMEDIA: ROL_PERMISOS
CREATE TABLE IF NOT EXISTS rol_permisos (
    id_rol INT NOT NULL REFERENCES roles(id_rol) ON DELETE CASCADE,
    id_permiso INT NOT NULL REFERENCES permisos(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);

-- 4. TABLA: AREAS
-- Estructura orgánica institucional (Dirección, Secretaría, RRHH, etc.)
CREATE TABLE IF NOT EXISTS areas (
    id_area SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    sigla VARCHAR(20),
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4.1 TABLA: CARGOS
-- Catálogo de cargos y funciones oficiales dependientes de cada área
CREATE TABLE IF NOT EXISTS cargos (
    id_cargo SERIAL PRIMARY KEY,
    id_area INT NOT NULL REFERENCES areas(id_area) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_area_cargo UNIQUE (id_area, nombre)
);

-- 5. TABLA: USUARIOS
-- Cuentas de usuario institucionales con contraseñas cifradas en Bcrypt
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_rol INT NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
    id_area INT REFERENCES areas(id_area) ON DELETE RESTRICT,
    nombre_completo VARCHAR(150) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    cargo VARCHAR(100),
    foto_perfil TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA: TIPOS_DOCUMENTO
-- Clasificación documental (Oficio, Carta, Memorándum, Circular, Solicitud, etc.)
CREATE TABLE IF NOT EXISTS tipos_documento (
    id_tipo_doc SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA: CORRESPONDENCIA_RECIBIDA
-- Registro maestro de la documentación que ingresa a la institución
CREATE TABLE IF NOT EXISTS correspondencia_recibida (
    id_recibida SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE, -- Ej: COR-REC-2026-00001
    numero_documento_externo VARCHAR(100), -- Nro oficial del emisor externo
    fecha_recepcion DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_recepcion TIME NOT NULL DEFAULT CURRENT_TIME,
    remitente VARCHAR(150) NOT NULL,
    institucion_remitente VARCHAR(150),
    id_tipo_doc INT NOT NULL REFERENCES tipos_documento(id_tipo_doc) ON DELETE RESTRICT,
    asunto VARCHAR(300) NOT NULL,
    destinatario VARCHAR(150) NOT NULL,
    id_area_responsable INT NOT NULL REFERENCES areas(id_area) ON DELETE RESTRICT,
    cargo_responsable VARCHAR(100),
    prioridad VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (prioridad IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    estado VARCHAR(30) NOT NULL DEFAULT 'Recibido' CHECK (estado IN ('Recibido', 'En revisión', 'Derivado', 'En proceso', 'Atendido', 'Archivado', 'ANULADO')),
    observaciones TEXT,
    id_usuario_registro INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo_anulacion TEXT,
    id_usuario_anulacion INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP WITH TIME ZONE
);

-- 8. TABLA: CORRESPONDENCIA_ENTREGADA
-- Registro maestro de la documentación que sale de la institución
CREATE TABLE IF NOT EXISTS correspondencia_entregada (
    id_entregada SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE, -- Ej: COR-ENT-2026-00001
    numero_nota VARCHAR(100) NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_emision TIME NOT NULL DEFAULT CURRENT_TIME,
    destinatario VARCHAR(150) NOT NULL,
    institucion_destinatario VARCHAR(150),
    cargo_destinatario VARCHAR(100),
    asunto VARCHAR(300) NOT NULL,
    id_tipo_doc INT NOT NULL REFERENCES tipos_documento(id_tipo_doc) ON DELETE RESTRICT,
    id_area_remitente INT NOT NULL REFERENCES areas(id_area) ON DELETE RESTRICT,
    responsable_remitente VARCHAR(150) NOT NULL,
    medio_entrega VARCHAR(50) NOT NULL DEFAULT 'Entrega física' CHECK (medio_entrega IN ('Entrega física', 'Correo electrónico', 'Mensajería', 'Otro')),
    estado VARCHAR(30) NOT NULL DEFAULT 'Emitido' CHECK (estado IN ('Borrador', 'Emitido', 'Entregado', 'Archivado', 'ANULADO')),
    observaciones TEXT,
    id_usuario_registro INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo_anulacion TEXT,
    id_usuario_anulacion INT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP WITH TIME ZONE
);

-- 9. TABLA: DERIVACIONES
-- Histórico inmutable de transferencias de expedientes entre áreas
CREATE TABLE IF NOT EXISTS derivaciones (
    id_derivacion SERIAL PRIMARY KEY,
    id_recibida INT NOT NULL REFERENCES correspondencia_recibida(id_recibida) ON DELETE CASCADE,
    id_area_origen INT REFERENCES areas(id_area) ON DELETE RESTRICT,
    id_area_destino INT NOT NULL REFERENCES areas(id_area) ON DELETE RESTRICT,
    cargo_destino VARCHAR(100),
    responsable_destino VARCHAR(150),
    id_usuario_derivo INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_derivacion DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_derivacion TIME NOT NULL DEFAULT CURRENT_TIME,
    instruccion_observacion TEXT,
    estado_derivacion VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK (estado_derivacion IN ('Pendiente', 'Aceptado', 'Rechazado', 'Completado')),
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (id_area_origen IS NULL OR id_area_origen <> id_area_destino)
);

-- 10. TABLA: SEGUIMIENTOS (TRAZABILIDAD / TIMELINE)
-- Bitácora de cambios de estado y evolución documental
CREATE TABLE IF NOT EXISTS seguimientos (
    id_seguimiento SERIAL PRIMARY KEY,
    id_recibida INT REFERENCES correspondencia_recibida(id_recibida) ON DELETE CASCADE,
    id_entregada INT REFERENCES correspondencia_entregada(id_entregada) ON DELETE CASCADE,
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seguimiento_ref CHECK (
        (id_recibida IS NOT NULL AND id_entregada IS NULL) OR
        (id_recibida IS NULL AND id_entregada IS NOT NULL)
    )
);

-- 11. TABLA: DOCUMENTOS_ADJUNTOS
-- Metadatos de archivos digitales asociados a correspondencia
CREATE TABLE IF NOT EXISTS documentos_adjuntos (
    id_documento SERIAL PRIMARY KEY,
    id_recibida INT REFERENCES correspondencia_recibida(id_recibida) ON DELETE CASCADE,
    id_entregada INT REFERENCES correspondencia_entregada(id_entregada) ON DELETE CASCADE,
    id_nota INT,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL UNIQUE, -- Nombre seguro en disco (UUID)
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    extension VARCHAR(10) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    id_usuario_subio INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_documento_ref CHECK (
        (id_recibida IS NOT NULL AND id_entregada IS NULL AND id_nota IS NULL) OR
        (id_recibida IS NULL AND id_entregada IS NOT NULL) OR
        (id_recibida IS NULL AND id_entregada IS NULL AND id_nota IS NOT NULL)
    )
);

-- 12. TABLA: PLANTILLAS_NOTAS
-- Modelos estructurados para generar documentos institucionales
CREATE TABLE IF NOT EXISTS plantillas_notas (
    id_plantilla SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    titulo VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    cuerpo_plantilla TEXT NOT NULL,
    variables_requeridas JSONB NOT NULL DEFAULT '[]',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. TABLA: NOTAS_GENERADAS
-- Registro histórico de notas creadas mediante el generador
CREATE TABLE IF NOT EXISTS notas_generadas (
    id_nota SERIAL PRIMARY KEY,
    id_plantilla INT NOT NULL REFERENCES plantillas_notas(id_plantilla) ON DELETE RESTRICT,
    numero_nota VARCHAR(100) NOT NULL UNIQUE,
    datos_variables JSONB NOT NULL,
    contenido_renderizado TEXT NOT NULL,
    id_entregada INT REFERENCES correspondencia_entregada(id_entregada) ON DELETE SET NULL,
    id_usuario_genero INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_generacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verificaciones_qr INTEGER NOT NULL DEFAULT 0 CHECK (verificaciones_qr >= 0),
    limite_verificaciones_qr INTEGER NOT NULL DEFAULT 3 CHECK (limite_verificaciones_qr > 0),
    url_verificacion TEXT
);

CREATE TABLE IF NOT EXISTS configuracion_qr (
    id_configuracion SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id_configuracion = 1),
    limite_verificaciones INTEGER NOT NULL DEFAULT 3 CHECK (limite_verificaciones > 0),
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

ALTER TABLE documentos_adjuntos ADD COLUMN IF NOT EXISTS id_nota INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_documentos_nota'
    ) THEN
        ALTER TABLE documentos_adjuntos
            ADD CONSTRAINT fk_documentos_nota
            FOREIGN KEY (id_nota) REFERENCES notas_generadas(id_nota) ON DELETE CASCADE;
    END IF;
END $$;

-- 14. TABLA: AUDITORIA
-- Bitácora inmutable de operaciones sensibles del sistema
CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria BIGSERIAL PRIMARY KEY,
    id_usuario INT,
    username VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    modulo VARCHAR(60) NOT NULL,
    registro_afectado VARCHAR(100),
    detalles TEXT,
    ip_origen VARCHAR(45),
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. TABLA: NOTIFICACIONES
-- Avisos persistentes por usuario, independientes del historial de seguimiento
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion BIGSERIAL PRIMARY KEY,
    id_usuario_destino INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_usuario_origen INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    referencia_codigo VARCHAR(60),
    id_recibida INT REFERENCES correspondencia_recibida(id_recibida) ON DELETE SET NULL,
    id_entregada INT REFERENCES correspondencia_entregada(id_entregada) ON DELETE SET NULL,
    leida_en TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. TABLA: CORRELATIVOS (CONTROL CONCURRENTE DE NUMERACIÓN)
-- Garantiza unicidad atómica de códigos anuales por tipo de correspondencia
CREATE TABLE IF NOT EXISTS correlativos (
    tipo VARCHAR(20) NOT NULL, -- 'RECIBIDA', 'ENTREGADA', 'NOTA'
    anio INT NOT NULL,
    ultimo_numero INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, anio)
);

-- ============================================================================
-- ÍNDICES PARA BÚSQUEDAS EFICIENTES Y ALTO RENDIMIENTO
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_recibida_codigo ON correspondencia_recibida(codigo);
CREATE INDEX IF NOT EXISTS idx_recibida_estado ON correspondencia_recibida(estado);
CREATE INDEX IF NOT EXISTS idx_recibida_fecha ON correspondencia_recibida(fecha_recepcion);
CREATE INDEX IF NOT EXISTS idx_recibida_area ON correspondencia_recibida(id_area_responsable);
CREATE INDEX IF NOT EXISTS idx_recibida_activo ON correspondencia_recibida(activo);

CREATE INDEX IF NOT EXISTS idx_entregada_codigo ON correspondencia_entregada(codigo);
CREATE INDEX IF NOT EXISTS idx_entregada_fecha ON correspondencia_entregada(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_entregada_area ON correspondencia_entregada(id_area_remitente);
CREATE INDEX IF NOT EXISTS idx_entregada_activo ON correspondencia_entregada(activo);

CREATE INDEX IF NOT EXISTS idx_derivaciones_recibida ON derivaciones(id_recibida);
CREATE INDEX IF NOT EXISTS idx_derivaciones_destino ON derivaciones(id_area_destino);

CREATE INDEX IF NOT EXISTS idx_seguimientos_recibida ON seguimientos(id_recibida);
CREATE INDEX IF NOT EXISTS idx_seguimientos_entregada ON seguimientos(id_entregada);

CREATE INDEX IF NOT EXISTS idx_documentos_recibida ON documentos_adjuntos(id_recibida);
CREATE INDEX IF NOT EXISTS idx_documentos_entregada ON documentos_adjuntos(id_entregada);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(username);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha ON notificaciones(id_usuario_destino, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas ON notificaciones(id_usuario_destino) WHERE leida_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notificaciones_pendiente_unica
    ON notificaciones(id_usuario_destino, id_recibida)
    WHERE tipo = 'PENDIENTE_ATENCION' AND id_recibida IS NOT NULL;

DROP INDEX IF EXISTS idx_usuario_unico_cargo_activo;
CREATE INDEX IF NOT EXISTS idx_usuario_area_cargo_activo
    ON usuarios (id_area, LOWER(TRIM(cargo)))
    WHERE activo = TRUE AND id_area IS NOT NULL AND cargo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cargos_area ON cargos(id_area);
