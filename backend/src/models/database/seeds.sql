-- ============================================================================
-- SISTEMA DE GESTIÓN DE CORRESPONDENCIA RECIBIDA Y ENTREGADA
-- Script DML: Datos Semilla Iniciales (Seeds)
-- ============================================================================

-- 1. INSERTAR ROLES DEL SISTEMA
INSERT INTO roles (id_rol, nombre, descripcion) VALUES
(1, 'Administrador', 'Control total de usuarios, roles, seguridad, auditoría y configuración'),
(2, 'Secretaria', 'Gestión operativa de correspondencia, derivaciones, seguimiento, notas, archivo y reportes'),
(3, 'Operador', 'Gestión operativa de correspondencia, derivaciones, seguimiento, notas, archivo y reportes')
ON CONFLICT (id_rol) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;

-- Ajustar secuencia de roles
SELECT setval('roles_id_rol_seq', (SELECT MAX(id_rol) FROM roles));

-- 2. INSERTAR PERMISOS GRANULARES
INSERT INTO permisos (codigo, nombre, modulo, descripcion) VALUES
-- Seguridad y Usuarios
('USUARIOS_VER', 'Ver lista de usuarios', 'Usuarios', 'Permite consultar el listado de usuarios'),
('USUARIOS_CREAR', 'Crear nuevo usuario', 'Usuarios', 'Permite registrar nuevos usuarios'),
('USUARIOS_EDITAR', 'Modificar usuarios', 'Usuarios', 'Permite editar datos de usuarios existentes'),
('USUARIOS_ESTADO', 'Activar/Desactivar usuarios', 'Usuarios', 'Permite baja lógica y activación de cuentas'),
('ROLES_VER', 'Ver roles y permisos', 'Roles', 'Permite consultar la matriz RBAC'),
('ROLES_EDITAR', 'Gestionar roles', 'Roles', 'Permite modificar asignación de permisos'),

-- Correspondencia Recibida
('RECIBIDA_VER', 'Consultar correspondencia recibida', 'Correspondencia Recibida', 'Permite listar y ver detalles de documentos de entrada'),
('RECIBIDA_CREAR', 'Registrar correspondencia recibida', 'Correspondencia Recibida', 'Permite dar de alta nuevos ingresos documentales'),
('RECIBIDA_EDITAR', 'Editar correspondencia recibida', 'Correspondencia Recibida', 'Permite modificar datos de registros existentes'),
('RECIBIDA_DERIVAR', 'Derivar correspondencia', 'Correspondencia Recibida', 'Permite enviar expedientes hacia áreas de destino'),
('RECIBIDA_ESTADO', 'Cambiar estado de correspondencia', 'Correspondencia Recibida', 'Permite actualizar el estado de trámite'),

-- Correspondencia Entregada
('ENTREGADA_VER', 'Consultar correspondencia entregada', 'Correspondencia Entregada', 'Permite listar y ver detalles de documentos de salida'),
('ENTREGADA_CREAR', 'Registrar correspondencia entregada', 'Correspondencia Entregada', 'Permite registrar envíos y salidas institucionales'),
('ENTREGADA_EDITAR', 'Editar correspondencia entregada', 'Correspondencia Entregada', 'Permite modificar información de despachos'),

-- Derivaciones y Seguimiento
('DERIVACIONES_VER', 'Consultar derivaciones', 'Derivaciones', 'Permite consultar el historial de pases entre dependencias'),
('SEGUIMIENTO_VER', 'Visualizar línea de tiempo', 'Seguimiento', 'Permite inspeccionar la trazabilidad completa del expediente'),

-- Generador de Notas y Plantillas
('PLANTILLAS_ADMIN', 'Administrar plantillas', 'Plantillas', 'Permite crear y editar plantillas oficiales de notas'),
('NOTAS_CREAR', 'Generar notas y comunicaciones', 'Generador Notas', 'Permite emitir documentos a partir de plantillas'),
('NOTAS_VER', 'Consultar notas generadas', 'Generador Notas', 'Permite ver el histórico de notas emitidas'),

-- Archivo Digital
('ARCHIVO_SUBIR', 'Adjuntar documentos digitales', 'Archivo Digital', 'Permite subir archivos PDF, DOCX, XLSX, JPG, PNG'),
('ARCHIVO_DESCARGAR', 'Descargar documentos digitales', 'Archivo Digital', 'Permite descargar y previsualizar archivos adjuntos'),
('ARCHIVO_ELIMINAR', 'Eliminar documentos digitales', 'Archivo Digital', 'Permite eliminar documentos digitales que ya no deben conservarse'),

-- Reportes
('REPORTES_VER', 'Consultar reportes estadísticos', 'Reportes', 'Permite visualizar gráficos e indicadores'),
('REPORTES_EXPORTAR', 'Exportar reportes a PDF/Excel', 'Reportes', 'Permite descargar informes generados'),

-- Auditoría
('AUDITORIA_VER', 'Consultar bitácora de auditoría', 'Auditoría', 'Permite inspeccionar el registro de operaciones de usuarios')
ON CONFLICT (codigo) DO NOTHING;

-- 3. ASIGNAR PERMISOS A ROLES (ROL_PERMISOS)
-- Administrador: Todos los permisos
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 1, id_permiso FROM permisos
ON CONFLICT DO NOTHING;

DELETE FROM rol_permisos WHERE id_rol IN (2, 3);

-- Operador y Secretaria comparten todos los permisos operativos
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT roles.id_rol, permisos.id_permiso
FROM (VALUES (2), (3)) AS roles(id_rol)
CROSS JOIN permisos
WHERE permisos.codigo IN (
  'RECIBIDA_VER', 'RECIBIDA_CREAR', 'RECIBIDA_EDITAR', 'RECIBIDA_DERIVAR', 'RECIBIDA_ESTADO',
  'ENTREGADA_VER', 'ENTREGADA_CREAR', 'ENTREGADA_EDITAR',
  'DERIVACIONES_VER', 'SEGUIMIENTO_VER',
  'NOTAS_CREAR', 'NOTAS_VER',
  'ARCHIVO_SUBIR', 'ARCHIVO_DESCARGAR', 'ARCHIVO_ELIMINAR',
  'REPORTES_VER', 'REPORTES_EXPORTAR'
)
ON CONFLICT DO NOTHING;

-- 4. INSERTAR ÁREAS INSTITUCIONALES INICIALES
INSERT INTO areas (id_area, nombre, sigla, descripcion) VALUES
(1, 'Dirección General', 'DG', 'Despacho de la máxima autoridad institucional'),
(2, 'Secretaría General', 'SG', 'Mesa de partes, despacho de correspondencia y archivo central'),
(3, 'Administración y Finanzas', 'DAF', 'Gestión presupuestaria, contabilidad y suministros'),
(4, 'Recursos Humanos', 'RRHH', 'Gestión de personal y talento humano'),
(5, 'Asesoría Jurídica', 'AJ', 'Control de legalidad de actos y convenios'),
(6, 'Tecnologías de la Información', 'TIC', 'Soporte informático, infraestructura y sistemas')
ON CONFLICT (id_area) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  sigla = EXCLUDED.sigla;

SELECT setval('areas_id_area_seq', (SELECT MAX(id_area) FROM areas));

-- 4.1 INSERTAR CARGOS INSTITUCIONALES POR ÁREA (CATÁLOGO OFICIAL)
INSERT INTO cargos (id_area, nombre, activo) VALUES
-- Dirección General
(1, 'Director General', TRUE),
(1, 'Gerente General', TRUE),
(1, 'Subdirector', TRUE),
(1, 'Asistente de Dirección', TRUE),
(1, 'Secretaria de Dirección', TRUE),

-- Administración y Finanzas
(3, 'Gerente Administrativo', TRUE),
(3, 'Jefe de Administración', TRUE),
(3, 'Jefe de Finanzas', TRUE),
(3, 'Analista Financiero', TRUE),
(3, 'Auxiliar Administrativo', TRUE),
(3, 'Auxiliar Contable', TRUE),

-- Asesoría Jurídica
(5, 'Asesor Legal General', TRUE),
(5, 'Abogado Senior', TRUE),
(5, 'Abogado Junior', TRUE),
(5, 'Asistente Legal', TRUE),

-- Recursos Humanos
(4, 'Jefe de Recursos Humanos', TRUE),
(4, 'Coordinador de RRHH', TRUE),
(4, 'Analista de RRHH', TRUE),
(4, 'Asistente de RRHH', TRUE),

-- Secretaría General
(2, 'Secretario General', TRUE),
(2, 'Secretaria de Mesa de Partes', TRUE),
(2, 'Secretaria Ejecutiva', TRUE),
(2, 'Asistente de Secretaría', TRUE),
(2, 'Recepcionista', TRUE),

-- Tecnologías de la Información
(6, 'Jefe de TI', TRUE),
(6, 'Administrador de Sistemas', TRUE),
(6, 'Desarrollador', TRUE),
(6, 'Soporte Técnico', TRUE),
(6, 'Analista de Sistemas', TRUE)
ON CONFLICT (id_area, nombre) DO NOTHING;

-- 5. INSERTAR TIPOS DE DOCUMENTO INICIALES
INSERT INTO tipos_documento (id_tipo_doc, nombre, descripcion) VALUES
(1, 'Oficio', 'Comunicación formal externa e interinstitucional'),
(2, 'Carta', 'Comunicación externa formal dirigida a personas o instituciones'),
(3, 'Memorándum', 'Comunicación interna oficial entre dependencias'),
(4, 'Circular', 'Comunicación interna de carácter general y normativo'),
(5, 'Solicitud', 'Petición o trámite iniciado por un ciudadano o institución'),
(6, 'Informe Técnico', 'Documento técnico emitido por un área especializada'),
(7, 'Invitación', 'Convocatoria a actos protocolares o reuniones')
ON CONFLICT (id_tipo_doc) DO UPDATE SET
  nombre = EXCLUDED.nombre;

SELECT setval('tipos_documento_id_tipo_doc_seq', (SELECT MAX(id_tipo_doc) FROM tipos_documento));

INSERT INTO usuarios (id_usuario, id_rol, id_area, nombre_completo, username, email, password_hash, cargo, activo) VALUES
(1, 1, 1, 'Administrador del Sistema', 'admin', 'admin@correspondencia.local', '$2a$10$qkTY.9hH.sX1IGdBSarBbOJ9G.t86OtX.R.4vC81mPyPA9G4DbOOG', 'Director General', TRUE),
  (2, 2, 2, 'Secretaria de Mesa de Partes', 'secretaria01', 'secretaria@correspondencia.local', '$2a$10$qkTY.9hH.sX1IGdBSarBbOJ9G.t86OtX.R.4vC81mPyPA9G4DbOOG', 'Secretaria de Mesa de Partes', TRUE)
ON CONFLICT (id_usuario) DO NOTHING;

INSERT INTO usuarios (id_rol, id_area, nombre_completo, username, email, password_hash, cargo, activo) VALUES
(3, 2, 'Operador de Demostración', 'operador01', 'operador@correspondencia.local', '$2a$10$qkTY.9hH.sX1IGdBSarBbOJ9G.t86OtX.R.4vC81mPyPA9G4DbOOG', 'Secretario General', TRUE)
ON CONFLICT (username) DO NOTHING;

SELECT setval('usuarios_id_usuario_seq', (SELECT MAX(id_usuario) FROM usuarios));

-- 7. INSERTAR PLANTILLAS DE NOTAS INICIALES
INSERT INTO plantillas_notas (id_plantilla, codigo, titulo, tipo, cuerpo_plantilla, variables_requeridas, creado_por) VALUES
(1, 'PLANT-NOTA-OFICIAL', 'Nota Oficial Institucional', 'Nota oficial', 
'<p style="text-align: right;"><strong>NOTA OFICIAL N° {{numero_nota}}</strong><br>{{lugar}}, {{fecha}}</p>
<p><strong>Señor(a):</strong><br>{{destinatario}}<br><em>{{cargo_destinatario}}</em><br><strong>{{institucion_destinatario}}</strong><br>Presente.-</p>
<p><strong>Ref.: {{asunto}}</strong></p>
<p>De mi mayor consideración:</p>
<p>{{contenido}}</p>
<p>Sin otro particular, me despido con las consideraciones más distinguidas.</p>
<p style="text-align: center; margin-top: 50px;">___________________________________<br><strong>{{remitente_nombre}}</strong><br>{{remitente_cargo}}</p>',
'["numero_nota", "lugar", "fecha", "destinatario", "cargo_destinatario", "institucion_destinatario", "asunto", "contenido", "remitente_nombre", "remitente_cargo"]'::jsonb, 1),

(2, 'PLANT-MEMO-INTERNO', 'Memorándum Interno', 'Memorándum',
'<h2 style="text-align: center; text-decoration: underline;">MEMORÁNDUM N° {{numero_nota}}</h2>
<table style="width: 100%; margin-bottom: 20px;">
  <tr><td style="width: 15%;"><strong>A:</strong></td><td>{{destinatario}} - {{cargo_destinatario}}</td></tr>
  <tr><td><strong>DE:</strong></td><td>{{remitente_nombre}} - {{remitente_cargo}}</td></tr>
  <tr><td><strong>FECHA:</strong></td><td>{{fecha}}</td></tr>
  <tr><td><strong>ASUNTO:</strong></td><td><strong>{{asunto}}</strong></td></tr>
</table>
<hr style="margin-bottom: 20px;">
<p>{{contenido}}</p>
<p style="text-align: center; margin-top: 60px;">___________________________________<br><strong>{{remitente_nombre}}</strong><br>{{remitente_cargo}}</p>',
'["numero_nota", "destinatario", "cargo_destinatario", "remitente_nombre", "remitente_cargo", "fecha", "asunto", "contenido"]'::jsonb, 1),

(3, 'PLANT-CIRCULAR-INT', 'Circular Interna', 'Circular',
'<h2 style="text-align: center;">CIRCULAR N° {{numero_nota}}</h2>
<p style="text-align: right;"><strong>Fecha:</strong> {{fecha}}</p>
<p><strong>DE:</strong> {{remitente_nombre}} - {{remitente_cargo}}</p>
<p><strong>PARA:</strong> TODO EL PERSONAL INSTITUCIONAL</p>
<p><strong>ASUNTO:</strong> {{asunto}}</p>
<hr>
<p>{{contenido}}</p>
<p>Agradeciendo su atención y cumplimiento estricto.</p>
<p style="text-align: center; margin-top: 50px;">Atentamente,<br><br>___________________________________<br><strong>{{remitente_nombre}}</strong><br>{{remitente_cargo}}</p>',
 '["numero_nota", "fecha", "remitente_nombre", "remitente_cargo", "asunto", "contenido"]'::jsonb, 1)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plantillas_notas (codigo, titulo, tipo, cuerpo_plantilla, variables_requeridas, creado_por) VALUES
('GANESHA-NOTA-OFICIAL', 'Nota GANESHA - Auditoría Externa', 'Nota oficial',
'<header style="display:flex;justify-content:space-between;border-bottom:4px solid #2677a8;padding-bottom:12px;margin-bottom:28px;"><div><strong style="font-size:28px;color:#1c5d86;">Ganesha</strong><br><span style="font-size:10px;color:#2876a3;">CONSULTORES MULTIDISCIPLINARIOS</span></div><div style="text-align:right;">{{lugar}}, {{fecha}}<br><strong>CITE: {{cite}}</strong></div></header>
<p>Señores:</p><p><strong>{{destinatario}}</strong><br>Presente.-</p><p><strong>REF.: <u>{{referencia}}</u></strong></p><p>De mi consideración</p><p>{{cuerpo}}</p>
<table style="width:100%;border-collapse:collapse;margin:14px 0;"><thead><tr style="background:#e4e8eb;"><th style="border:1px solid #555;padding:6px;width:36%;">CONCEPTO</th><th style="border:1px solid #555;padding:6px;">DETALLE</th></tr></thead><tbody>
<tr><td style="border:1px solid #555;padding:6px;">Auditoría Externa Financiera a Proyecto de Inversión Pública FDI</td><td style="border:1px solid #555;padding:6px;">1. {{detalle_1}}</td></tr>
<tr><td style="border:1px solid #555;padding:6px;">N° de comprobantes:</td><td style="border:1px solid #555;padding:6px;">{{comprobantes_1}}</td></tr>
<tr><td style="border:1px solid #555;padding:6px;">Costo del servicio:</td><td style="border:1px solid #555;padding:6px;">{{costo_1}}</td></tr>
<tr><td style="border:1px solid #555;padding:6px;">Auditoría Externa Financiera a Proyecto de Inversión Pública MMAyA-VMRHR</td><td style="border:1px solid #555;padding:6px;">2. {{detalle_2}}</td></tr>
<tr><td style="border:1px solid #555;padding:6px;">N° de comprobantes:</td><td style="border:1px solid #555;padding:6px;">{{comprobantes_2}}</td></tr>
<tr><td style="border:1px solid #555;padding:6px;">Costo del servicio:</td><td style="border:1px solid #555;padding:6px;">{{costo_2}}</td></tr>
<tr><td style="border:1px solid #555;padding:6px;">Plazo de ejecución:</td><td style="border:1px solid #555;padding:6px;">{{plazo}}</td></tr>
<tr><th style="border:1px solid #555;padding:6px;text-align:left;">COSTO TOTAL DEL SERVICIO:</th><td style="border:1px solid #555;padding:6px;">{{costo_total}}</td></tr></tbody></table>
<p>{{despedida}}</p><p>Atentamente,</p><p style="margin-top:45px;">___________________________________<br><strong>{{firmante_nombre}}</strong><br>{{firmante_cargo}}<br>GANESHA LTDA.<br>CONSULTORES MULTIDISCIPLINARIOS</p>',
jsonb_build_array(
  jsonb_build_object('nombre','lugar','etiqueta','Lugar','tipo','text','valor_inicial','Cochabamba','requerida',TRUE),
  jsonb_build_object('nombre','fecha','etiqueta','Fecha','tipo','text','valor_inicial','25 de abril de 2024','requerida',TRUE),
  jsonb_build_object('nombre','cite','etiqueta','CITE','tipo','text','valor_inicial','GNSHA04/24/NC/1333-00/1','requerida',TRUE),
  jsonb_build_object('nombre','destinatario','etiqueta','Destinatario','tipo','text','valor_inicial','GOBIERNO AUTÓNOMO MUNICIPAL DE POCONA','requerida',TRUE),
  jsonb_build_object('nombre','referencia','etiqueta','Referencia','tipo','text','valor_inicial','COTIZACIÓN DE SERVICIOS DE AUDITORÍA EXTERNA','requerida',TRUE),
  jsonb_build_object('nombre','cuerpo','etiqueta','Cuerpo de la nota','tipo','textarea','valor_inicial','En respuesta a su solicitud expresada en la nota con CITE: DAF N° 016/2024, fechada el 24 de abril del presente año, adjuntamos la cotización correspondiente para los Servicios de Auditoría Externa Financiera a Proyectos de Inversión Pública FDI y MMAyA-VMRHR:','requerida',TRUE),
  jsonb_build_object('nombre','detalle_1','etiqueta','Detalle del servicio FDI','tipo','textarea','valor_inicial','Mejoramientos de ganado lechero y acopio Municipio Pocona, Departamento Cochabamba','requerida',TRUE),
  jsonb_build_object('nombre','comprobantes_1','etiqueta','N° de comprobantes FDI','tipo','number','valor_inicial','3','requerida',TRUE),
  jsonb_build_object('nombre','costo_1','etiqueta','Costo del servicio FDI','tipo','text','valor_inicial','Bs15.000.- (Quince mil 00/100)','requerida',TRUE),
  jsonb_build_object('nombre','detalle_2','etiqueta','Detalle del servicio MMAyA-VMRHR','tipo','textarea','valor_inicial','Restauración forestal en zonas de fuentes de agua, recarga hídrica y mitigación de riesgos afectados por el cambio climático en las microcuencas del Municipio de Pocona.','requerida',TRUE),
  jsonb_build_object('nombre','comprobantes_2','etiqueta','N° de comprobantes MMAyA-VMRHR','tipo','number','valor_inicial','43','requerida',TRUE),
  jsonb_build_object('nombre','costo_2','etiqueta','Costo del servicio MMAyA-VMRHR','tipo','text','valor_inicial','Bs18.000.- (Dieciocho mil 00/100)','requerida',TRUE),
  jsonb_build_object('nombre','plazo','etiqueta','Plazo de ejecución','tipo','text','valor_inicial','70 días calendario','requerida',TRUE),
  jsonb_build_object('nombre','costo_total','etiqueta','Costo total','tipo','text','valor_inicial','Bs 33.000.- (Treinta y tres mil 00/100 bolivianos)','requerida',TRUE),
  jsonb_build_object('nombre','despedida','etiqueta','Despedida','tipo','text','valor_inicial','Sin otro particular, saludo a Uds.','requerida',TRUE),
  jsonb_build_object('nombre','firmante_nombre','etiqueta','Nombre del firmante','tipo','text','valor_inicial','Lic. Aud. Vladimir Revollo Encinas','requerida',FALSE),
  jsonb_build_object('nombre','firmante_cargo','etiqueta','Cargo del firmante','tipo','text','valor_inicial','REPRESENTANTE LEGAL','requerida',FALSE)
), 1)
ON CONFLICT (codigo) DO UPDATE SET
  cuerpo_plantilla = EXCLUDED.cuerpo_plantilla,
  variables_requeridas = EXCLUDED.variables_requeridas,
  actualizado_en = CURRENT_TIMESTAMP;

SELECT setval('plantillas_notas_id_plantilla_seq', (SELECT MAX(id_plantilla) FROM plantillas_notas));

-- 8. INICIALIZAR TABLA DE CORRELATIVOS PARA EL AÑO VIGENTE (2026)
INSERT INTO correlativos (tipo, anio, ultimo_numero) VALUES
('RECIBIDA', 2026, 0),
('ENTREGADA', 2026, 0),
('NOTA', 2026, 0)
ON CONFLICT (tipo, anio) DO NOTHING;
