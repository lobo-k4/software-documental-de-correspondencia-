/**
 * Controlador para la Gestión de Correspondencia Entregada (Mesa de Salida).
 * Incluye generación de código COR-ENT-YYYY-XXXXX, control de medios de entrega, seguimientos y adjuntos.
 */
const { query, getClient } = require('../config/database');
const { generarCodigoCorrelativo } = require('../services/codigoCorrelativoService');
const { registrarAuditoria } = require('../services/auditoriaService');
const { crearNotificacion } = require('../services/notificacionService');
const { success, created, badRequest, notFound, serverError } = require('../utils/responseHelper');

/**
 * Listar correspondencia entregada con filtros y paginación
 * GET /api/correspondencia-entregada
 */
const getCorrespondenciaEntregada = async (req, res) => {
  try {
    const {
      busqueda = '',
      estado,
      id_area_remitente,
      id_tipo_doc,
      medio_entrega,
      fecha_inicio,
      fecha_fin,
      pagina = 1,
      limite = 10
    } = req.query;

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = ["(ce.activo = TRUE OR ce.estado = 'ANULADO')"];
    const params = [];
    let paramIdx = 1;

    if (busqueda && busqueda.trim()) {
      conditions.push(`(
        LOWER(ce.codigo) LIKE LOWER($${paramIdx}) OR
        LOWER(ce.numero_nota) LIKE LOWER($${paramIdx}) OR
        LOWER(ce.destinatario) LIKE LOWER($${paramIdx}) OR
        LOWER(ce.institucion_destinatario) LIKE LOWER($${paramIdx}) OR
        LOWER(ce.asunto) LIKE LOWER($${paramIdx}) OR
        LOWER(ce.responsable_remitente) LIKE LOWER($${paramIdx})
      )`);
      params.push(`%${busqueda.trim()}%`);
      paramIdx++;
    }

    if (estado) {
      conditions.push(`ce.estado = $${paramIdx}`);
      params.push(estado);
      paramIdx++;
    }

    if (id_area_remitente) {
      conditions.push(`ce.id_area_remitente = $${paramIdx}`);
      params.push(parseInt(id_area_remitente, 10));
      paramIdx++;
    }

    if (id_tipo_doc) {
      conditions.push(`ce.id_tipo_doc = $${paramIdx}`);
      params.push(parseInt(id_tipo_doc, 10));
      paramIdx++;
    }

    if (medio_entrega) {
      conditions.push(`ce.medio_entrega = $${paramIdx}`);
      params.push(medio_entrega);
      paramIdx++;
    }

    if (fecha_inicio) {
      conditions.push(`ce.fecha_emision >= $${paramIdx}`);
      params.push(fecha_inicio);
      paramIdx++;
    }

    if (fecha_fin) {
      conditions.push(`ce.fecha_emision <= $${paramIdx}`);
      params.push(fecha_fin);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) AS total FROM correspondencia_entregada ce ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        ce.id_entregada,
        ce.codigo,
        ce.numero_nota,
        ce.fecha_emision,
        ce.hora_emision,
        ce.destinatario,
        ce.institucion_destinatario,
        ce.cargo_destinatario,
        ce.asunto,
        ce.responsable_remitente,
        ce.medio_entrega,
        ce.estado,
        ce.observaciones,
        ce.motivo_anulacion,
        ce.id_usuario_anulacion,
        ce.fecha_anulacion,
        ce.creado_en,
        td.id_tipo_doc,
        td.nombre AS tipo_documento_nombre,
        a.id_area AS id_area_remitente,
        a.nombre AS area_remitente_nombre,
        a.sigla AS area_remitente_sigla,
        u.nombre_completo AS usuario_registro_nombre,
        (SELECT COUNT(*) FROM documentos_adjuntos da WHERE da.id_entregada = ce.id_entregada) AS total_adjuntos
      FROM correspondencia_entregada ce
      INNER JOIN tipos_documento td ON ce.id_tipo_doc = td.id_tipo_doc
      INNER JOIN areas a ON ce.id_area_remitente = a.id_area
      INNER JOIN usuarios u ON ce.id_usuario_registro = u.id_usuario
      ${whereClause}
      ORDER BY ce.id_entregada DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await query(dataSql, dataParams);

    return success(res, {
      correspondencias: dataRes.rows,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    }, 'Correspondencia entregada listada correctamente.');
  } catch (error) {
    console.error('[GET CORRESPONDENCIA ENTREGADA ERROR]:', error);
    return serverError(res, 'Error al consultar la correspondencia entregada.', error);
  }
};

/**
 * Obtener detalle completo de un despacho de salida
 * GET /api/correspondencia-entregada/:id
 */
const getCorrespondenciaEntregadaById = async (req, res) => {
  try {
    const { id } = req.params;

    const mainSql = `
      SELECT 
        ce.*,
        td.nombre AS tipo_documento_nombre,
        a.nombre AS area_remitente_nombre,
        a.sigla AS area_remitente_sigla,
        u.nombre_completo AS usuario_registro_nombre,
        ua.nombre_completo AS usuario_anulacion_nombre,
        ra.nombre AS usuario_anulacion_rol
      FROM correspondencia_entregada ce
      INNER JOIN tipos_documento td ON ce.id_tipo_doc = td.id_tipo_doc
      INNER JOIN areas a ON ce.id_area_remitente = a.id_area
      INNER JOIN usuarios u ON ce.id_usuario_registro = u.id_usuario
      LEFT JOIN usuarios ua ON ce.id_usuario_anulacion = ua.id_usuario
      LEFT JOIN roles ra ON ua.id_rol = ra.id_rol
      WHERE ce.id_entregada = $1
    `;
    const mainRes = await query(mainSql, [id]);

    if (mainRes.rows.length === 0) {
      return notFound(res, 'Correspondencia entregada no encontrada.');
    }

    const correspondencia = mainRes.rows[0];

    // Adjuntos asociados
    const adjuntosSql = `
      SELECT 
        da.id_documento,
        da.nombre_original,
        da.nombre_archivo,
        da.mime_type,
        da.extension,
        da.tamano_bytes,
        da.creado_en,
        u.nombre_completo AS usuario_subio_nombre
      FROM documentos_adjuntos da
      INNER JOIN usuarios u ON da.id_usuario_subio = u.id_usuario
      WHERE da.id_entregada = $1
      ORDER BY da.id_documento ASC
    `;
    const adjuntosRes = await query(adjuntosSql, [id]);

    // Historial en línea de tiempo
    const seguimientosSql = `
      SELECT 
        s.id_seguimiento,
        s.estado_anterior,
        s.estado_nuevo,
        s.accion,
        s.descripcion,
        s.fecha_hora,
        u.nombre_completo AS usuario_nombre,
        u.cargo AS usuario_cargo
      FROM seguimientos s
      INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
      WHERE s.id_entregada = $1
      ORDER BY s.id_seguimiento ASC
    `;
    const seguimientosRes = await query(seguimientosSql, [id]);

    return success(res, {
      ...correspondencia,
      adjuntos: adjuntosRes.rows,
      seguimientos: seguimientosRes.rows
    }, 'Detalle de correspondencia entregada obtenido.');
  } catch (error) {
    console.error('[GET CORRESPONDENCIA ENTREGADA BY ID ERROR]:', error);
    return serverError(res, 'Error al obtener detalle.', error);
  }
};

/**
 * Registrar correspondencia entregada (con código COR-ENT-YYYY-XXXXX)
 * POST /api/correspondencia-entregada
 */
const crearCorrespondenciaEntregada = async (req, res) => {
  const client = await getClient();
  try {
    const {
      numero_nota,
      fecha_emision,
      hora_emision,
      destinatario,
      institucion_destinatario,
      cargo_destinatario,
      asunto,
      id_tipo_doc,
      id_area_remitente,
      responsable_remitente,
      medio_entrega = 'Entrega física',
      observaciones
    } = req.body;

    if (!numero_nota || !destinatario || !asunto || !id_tipo_doc || !id_area_remitente || !responsable_remitente) {
      return badRequest(res, 'Campos obligatorios requeridos: numero_nota, destinatario, asunto, id_tipo_doc, id_area_remitente, responsable_remitente.');
    }

    const MAPA_MEDIOS = {
      'entrega fisica': 'Entrega física',
      'entrega física': 'Entrega física',
      'correo electronico': 'Correo electrónico',
      'correo electrónico': 'Correo electrónico',
      'mensajeria': 'Mensajería',
      'mensajería': 'Mensajería',
      'otro': 'Otro'
    };

    const medioKey = medio_entrega ? medio_entrega.trim().toLowerCase() : 'entrega fisica';
    const medioNormalizado = MAPA_MEDIOS[medioKey];

    if (!medioNormalizado) {
      return badRequest(res, 'Medio de entrega inválido. Opciones permitidas: Entrega física, Correo electrónico, Mensajería, Otro.');
    }

    await client.query('BEGIN');

    // 1. Generar código correlativo atómico
    const anio = fecha_emision ? new Date(fecha_emision + 'T00:00:00Z').getUTCFullYear() : new Date().getFullYear();
    const codigoGenerado = await generarCodigoCorrelativo(client, 'ENTREGADA', anio);

    // 2. Insertar registro maestro
    const insertSql = `
      INSERT INTO correspondencia_entregada (
        codigo,
        numero_nota,
        fecha_emision,
        hora_emision,
        destinatario,
        institucion_destinatario,
        cargo_destinatario,
        asunto,
        id_tipo_doc,
        id_area_remitente,
        responsable_remitente,
        medio_entrega,
        estado,
        observaciones,
        id_usuario_registro
      ) VALUES ($1, $2, COALESCE($3, CURRENT_DATE), COALESCE($4, CURRENT_TIME), $5, $6, $7, $8, $9, $10, $11, $12, 'Emitido', $13, $14)
      RETURNING *
    `;

    const insertParams = [
      codigoGenerado,
      numero_nota.trim(),
      fecha_emision || null,
      hora_emision || null,
      destinatario.trim(),
      institucion_destinatario ? institucion_destinatario.trim() : null,
      cargo_destinatario ? cargo_destinatario.trim() : null,
      asunto.trim(),
      parseInt(id_tipo_doc, 10),
      parseInt(id_area_remitente, 10),
      responsable_remitente.trim(),
      medioNormalizado,
      observaciones ? observaciones.trim() : null,
      req.user.id_usuario
    ];

    const insertRes = await client.query(insertSql, insertParams);
    const nuevaSalida = insertRes.rows[0];

    // 3. Asociar archivos manuales y escaneados en la misma alta
    const adjuntos = [
      ...(req.files?.archivo || []).map(archivo => ({ archivo, nombreOriginal: archivo.originalname })),
      ...(req.files?.archivo_escaneado || []).map(archivo => ({
        archivo,
        nombreOriginal: `${nuevaSalida.codigo}.pdf`
      }))
    ];
    for (const { archivo, nombreOriginal } of adjuntos) {
      const pathModule = require('path');
      const adjuntoSql = `
        INSERT INTO documentos_adjuntos (
          id_entregada,
          nombre_original,
          nombre_archivo,
          ruta_almacenamiento,
          mime_type,
          extension,
          tamano_bytes,
          id_usuario_subio
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await client.query(adjuntoSql, [
        nuevaSalida.id_entregada,
        nombreOriginal,
        archivo.filename,
        archivo.path,
        archivo.mimetype,
        pathModule.extname(nombreOriginal).toLowerCase(),
        archivo.size,
        req.user.id_usuario
      ]);
    }

    // 4. Hito inicial en seguimientos
    const hitoSql = `
      INSERT INTO seguimientos (
        id_entregada,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, NULL, 'Emitido', 'EMISION_DESPACHO', $2, $3)
    `;
    await client.query(hitoSql, [
      nuevaSalida.id_entregada,
      `Documento emitido para despacho vía ${medioNormalizado}`,
      req.user.id_usuario
    ]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'REGISTRAR',
      modulo: 'Correspondencia Entregada',
      registro_afectado: nuevaSalida.codigo,
      detalles: `Registro de salida a: ${nuevaSalida.destinatario} (${nuevaSalida.asunto})`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_usuario_destino: req.user.id_usuario,
      tipo: 'CORRESPONDENCIA_NUEVA',
      titulo: 'Nueva correspondencia registrada',
      mensaje: `La correspondencia ${nuevaSalida.codigo} fue registrada como correspondencia de salida.`,
      referencia_codigo: nuevaSalida.codigo,
      id_entregada: nuevaSalida.id_entregada
    });

    return created(res, nuevaSalida, 'Correspondencia entregada registrada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CREAR CORRESPONDENCIA ENTREGADA ERROR]:', error);
    return serverError(res, 'Error al registrar correspondencia de salida.', error);
  } finally {
    client.release();
  }
};

/**
 * Modificar correspondencia entregada
 * PUT /api/correspondencia-entregada/:id
 */
const actualizarCorrespondenciaEntregada = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numero_nota,
      destinatario,
      institucion_destinatario,
      cargo_destinatario,
      asunto,
      id_tipo_doc,
      id_area_remitente,
      responsable_remitente,
      medio_entrega,
      observaciones
    } = req.body;

    // Validar campos obligatorios antes de operar (evita TypeError con .trim() → 500)
    if (!numero_nota || !destinatario || !asunto || !id_tipo_doc
      || !id_area_remitente || !responsable_remitente || !medio_entrega) {
      return badRequest(res, 'Campos obligatorios requeridos: numero_nota, destinatario, asunto, id_tipo_doc, id_area_remitente, responsable_remitente y medio_entrega.');
    }

    const checkRes = await query("SELECT codigo FROM correspondencia_entregada WHERE id_entregada = $1 AND activo = TRUE AND estado <> 'ANULADO'", [id]);
    if (checkRes.rows.length === 0) {
      return notFound(res, 'Correspondencia entregada no encontrada.');
    }
    const { codigo } = checkRes.rows[0];

    const updateSql = `
      UPDATE correspondencia_entregada SET
        numero_nota = $1,
        destinatario = $2,
        institucion_destinatario = $3,
        cargo_destinatario = $4,
        asunto = $5,
        id_tipo_doc = $6,
        id_area_remitente = $7,
        responsable_remitente = $8,
        medio_entrega = $9,
        observaciones = $10,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_entregada = $11
      RETURNING *
    `;

    const updateParams = [
      numero_nota.trim(),
      destinatario.trim(),
      institucion_destinatario ? institucion_destinatario.trim() : null,
      cargo_destinatario ? cargo_destinatario.trim() : null,
      asunto.trim(),
      parseInt(id_tipo_doc, 10),
      parseInt(id_area_remitente, 10),
      responsable_remitente.trim(),
      medio_entrega,
      observaciones ? observaciones.trim() : null,
      id
    ];

    const updateRes = await query(updateSql, updateParams);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Correspondencia Entregada',
      registro_afectado: codigo,
      detalles: 'Actualización de datos generales del despacho',
      req
    });

    return success(res, updateRes.rows[0], 'Correspondencia entregada actualizada correctamente.');
  } catch (error) {
    console.error('[ACTUALIZAR ENTREGADA ERROR]:', error);
    return serverError(res, 'Error al actualizar correspondencia de salida.', error);
  }
};

/**
 * Anular correspondencia entregada mediante baja lógica
 * PATCH /api/correspondencia-entregada/:id/anular
 */
const anularCorrespondenciaEntregada = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const motivo = typeof req.body.motivo_anulacion === 'string' ? req.body.motivo_anulacion.trim() : '';

    if (!motivo) {
      return badRequest(res, 'El motivo de la anulación es obligatorio.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      "SELECT codigo, estado, id_area_remitente FROM correspondencia_entregada WHERE id_entregada = $1 AND activo = TRUE AND estado <> 'ANULADO'",
      [id]
    );
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia entregada no encontrada o ya anulada.');
    }

    const { codigo, estado, id_area_remitente } = checkRes.rows[0];
    await client.query(`
      UPDATE correspondencia_entregada
      SET estado = 'ANULADO', motivo_anulacion = $1, id_usuario_anulacion = $2,
          fecha_anulacion = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
      WHERE id_entregada = $3
    `, [motivo, req.user.id_usuario, id]);

    await client.query(`
      INSERT INTO seguimientos (
        id_entregada, estado_anterior, estado_nuevo, accion, descripcion, id_usuario
      ) VALUES ($1, $2, 'ANULADO', 'ANULAR', $3, $4)
    `, [id, estado, `Motivo de anulación: ${motivo}`, req.user.id_usuario]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'ANULAR',
      modulo: 'Correspondencia Entregada',
      registro_afectado: codigo,
      detalles: `Correspondencia anulada. Motivo: ${motivo}`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_usuario_destino: req.user.id_usuario,
      tipo: 'CORRESPONDENCIA_ANULADA',
      titulo: 'Correspondencia anulada',
      mensaje: `La correspondencia de salida ${codigo} fue anulada. Motivo: ${motivo}`,
      referencia_codigo: codigo,
      id_entregada: id
    });

    return success(res, { id_entregada: id, estado: 'ANULADO', motivo_anulacion: motivo }, 'Correspondencia entregada anulada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ANULAR CORRESPONDENCIA ENTREGADA ERROR]:', error);
    return serverError(res, 'Error al anular la correspondencia entregada.', error);
  } finally {
    client.release();
  }
};

/**
 * Cambiar estado de correspondencia entregada (Borrador, Emitido, Entregado, Archivado)
 * PATCH /api/correspondencia-entregada/:id/estado
 */
const cambiarEstadoCorrespondenciaEntregada = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { nuevo_estado, observaciones } = req.body;

    const MAPA_ESTADOS = {
      'borrador': 'Borrador',
      'emitido': 'Emitido',
      'entregado': 'Entregado',
      'archivado': 'Archivado'
    };

    const estadoKey = nuevo_estado ? nuevo_estado.trim().toLowerCase() : '';
    const estadoNormalizado = MAPA_ESTADOS[estadoKey];

    if (!estadoNormalizado) {
      return badRequest(res, 'Estado no válido. Opciones permitidas: Borrador, Emitido, Entregado, Archivado.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      "SELECT codigo, estado, id_area_remitente FROM correspondencia_entregada WHERE id_entregada = $1 AND activo = TRUE AND estado <> 'ANULADO'",
      [id]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia entregada no encontrada.');
    }

    const { codigo, estado: estadoAnterior, id_area_remitente } = checkRes.rows[0];

    await client.query(
      'UPDATE correspondencia_entregada SET estado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_entregada = $2',
      [estadoNormalizado, id]
    );

    const hitoSql = `
      INSERT INTO seguimientos (
        id_entregada,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, $2, $3, 'CAMBIO_ESTADO', $4, $5)
    `;
    await client.query(hitoSql, [
      id,
      estadoAnterior,
      estadoNormalizado,
      observaciones || `Cambio de estado a: ${estadoNormalizado}`,
      req.user.id_usuario
    ]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'CAMBIO_ESTADO',
      modulo: 'Correspondencia Entregada',
      registro_afectado: codigo,
      detalles: `Transición: "${estadoAnterior}" -> "${estadoNormalizado}"`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_usuario_destino: req.user.id_usuario,
      tipo: 'ESTADO_ACTUALIZADO',
      titulo: 'Estado actualizado',
      mensaje: `La correspondencia de salida ${codigo} pasó a "${estadoNormalizado}".`,
      referencia_codigo: codigo,
      id_entregada: id
    });

    return success(res, { id_entregada: id, nuevo_estado: estadoNormalizado }, `Estado actualizado a ${estadoNormalizado}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    return serverError(res, 'Error al cambiar estado.', error);
  } finally {
    client.release();
  }
};

/**
 * Adjuntar documento digital a correspondencia entregada
 * POST /api/correspondencia-entregada/:id/adjuntos
 */
const adjuntarDocumentoEntregada = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    if (!req.file) {
      return badRequest(res, 'Debe adjuntar un archivo válido.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      'SELECT codigo, estado FROM correspondencia_entregada WHERE id_entregada = $1 AND activo = TRUE',
      [id]
    );
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia entregada no encontrada.');
    }
    const { codigo, estado } = checkRes.rows[0];

    const pathModule = require('path');
    const insertAdjuntoSql = `
      INSERT INTO documentos_adjuntos (
        id_entregada,
        nombre_original,
        nombre_archivo,
        ruta_almacenamiento,
        mime_type,
        extension,
        tamano_bytes,
        id_usuario_subio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const adjuntoRes = await client.query(insertAdjuntoSql, [
      id,
      req.file.originalname,
      req.file.filename,
      req.file.path,
      req.file.mimetype,
      pathModule.extname(req.file.originalname).toLowerCase(),
      req.file.size,
      req.user.id_usuario
    ]);

    const hitoSql = `
      INSERT INTO seguimientos (
        id_entregada,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, $2, $2, 'ADJUNTAR_DOCUMENTO', $3, $4)
    `;
    await client.query(hitoSql, [
      id,
      estado,
      `Se adjuntó respaldo digital: ${req.file.originalname}`,
      req.user.id_usuario
    ]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'CARGA_DOCUMENTO',
      modulo: 'Correspondencia Entregada',
      registro_afectado: codigo,
      detalles: `Archivo adjuntado: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`,
      req
    });

    return created(res, adjuntoRes.rows[0], 'Documento adjuntado exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    return serverError(res, 'Error al adjuntar documento.', error);
  } finally {
    client.release();
  }
};

module.exports = {
  getCorrespondenciaEntregada,
  getCorrespondenciaEntregadaById,
  crearCorrespondenciaEntregada,
  actualizarCorrespondenciaEntregada,
  anularCorrespondenciaEntregada,
  cambiarEstadoCorrespondenciaEntregada,
  adjuntarDocumentoEntregada
};
