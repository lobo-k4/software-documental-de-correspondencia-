/**
 * Controlador para la Gestión de Correspondencia Recibida (Módulo 6).
 * Incluye registro atómico con generación de código, seguimiento y adjuntos.
 */
const { query, getClient } = require('../config/database');
const { generarCodigoCorrelativo } = require('../services/codigoCorrelativoService');
const { registrarAuditoria } = require('../services/auditoriaService');
const { crearNotificacion } = require('../services/notificacionService');
const { success, created, badRequest, notFound, forbidden, serverError } = require('../utils/responseHelper');

/**
 * Listar correspondencia recibida con filtros combinados y paginación
 * GET /api/correspondencia-recibida
 */
const getCorrespondenciaRecibida = async (req, res) => {
  try {
    const {
      busqueda = '',
      estado,
      id_area_responsable,
      id_tipo_doc,
      prioridad,
      fecha_inicio,
      fecha_fin,
      pagina = 1,
      limite = 10
    } = req.query;

    // Validar paginación: enteros positivos (evita NaN en LIMIT/OFFSET → 500)
    if (req.query.pagina !== undefined && !/^\d+$/.test(String(req.query.pagina).trim())) {
      return badRequest(res, 'El parámetro pagina debe ser un número entero positivo.');
    }
    if (req.query.limite !== undefined && !/^\d+$/.test(String(req.query.limite).trim())) {
      return badRequest(res, 'El parámetro limite debe ser un número entero positivo.');
    }

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = ["(cr.activo = TRUE OR cr.estado = 'ANULADO')"];
    const params = [];
    let paramIdx = 1;

    // Búsqueda textual amplia
    if (busqueda && busqueda.trim()) {
      conditions.push(`(
        LOWER(cr.codigo) LIKE LOWER($${paramIdx}) OR
        LOWER(cr.numero_documento_externo) LIKE LOWER($${paramIdx}) OR
        LOWER(cr.remitente) LIKE LOWER($${paramIdx}) OR
        LOWER(cr.institucion_remitente) LIKE LOWER($${paramIdx}) OR
        LOWER(cr.asunto) LIKE LOWER($${paramIdx}) OR
        LOWER(cr.destinatario) LIKE LOWER($${paramIdx})
      )`);
      params.push(`%${busqueda.trim()}%`);
      paramIdx++;
    }

    if (estado) {
      conditions.push(`cr.estado = $${paramIdx}`);
      params.push(estado);
      paramIdx++;
    }

    if (id_area_responsable) {
      conditions.push(`cr.id_area_responsable = $${paramIdx}`);
      params.push(parseInt(id_area_responsable, 10));
      paramIdx++;
    }

    if (id_tipo_doc) {
      conditions.push(`cr.id_tipo_doc = $${paramIdx}`);
      params.push(parseInt(id_tipo_doc, 10));
      paramIdx++;
    }

    if (prioridad) {
      conditions.push(`cr.prioridad = $${paramIdx}`);
      params.push(prioridad);
      paramIdx++;
    }

    if (fecha_inicio) {
      conditions.push(`cr.fecha_recepcion >= $${paramIdx}`);
      params.push(fecha_inicio);
      paramIdx++;
    }

    if (fecha_fin) {
      conditions.push(`cr.fecha_recepcion <= $${paramIdx}`);
      params.push(fecha_fin);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total de registros para la paginación
    const countSql = `SELECT COUNT(*) AS total FROM correspondencia_recibida cr ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Consulta con joins enriquecidos
    const dataSql = `
      SELECT 
        cr.id_recibida,
        cr.codigo,
        cr.numero_documento_externo,
        cr.fecha_recepcion,
        cr.hora_recepcion,
        cr.remitente,
        cr.institucion_remitente,
        cr.asunto,
        cr.destinatario,
        cr.cargo_responsable,
        cr.prioridad,
        cr.estado,
        cr.observaciones,
        cr.motivo_anulacion,
        cr.id_usuario_anulacion,
        cr.fecha_anulacion,
        cr.creado_en,
        td.id_tipo_doc,
        td.nombre AS tipo_documento_nombre,
        a.id_area AS id_area_responsable,
        a.nombre AS area_responsable_nombre,
        a.sigla AS area_responsable_sigla,
        u.nombre_completo AS usuario_registro_nombre,
        (SELECT COUNT(*) FROM documentos_adjuntos da WHERE da.id_recibida = cr.id_recibida) AS total_adjuntos,
        (SELECT COUNT(*) FROM derivaciones d WHERE d.id_recibida = cr.id_recibida) AS total_derivaciones
      FROM correspondencia_recibida cr
      INNER JOIN tipos_documento td ON cr.id_tipo_doc = td.id_tipo_doc
      INNER JOIN areas a ON cr.id_area_responsable = a.id_area
      INNER JOIN usuarios u ON cr.id_usuario_registro = u.id_usuario
      ${whereClause}
      ORDER BY cr.id_recibida DESC
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
    }, 'Correspondencia recibida obtenida exitosamente.');
  } catch (error) {
    console.error('[GET CORRESPONDENCIA RECIBIDA ERROR]:', error);
    return serverError(res, 'Error al consultar la correspondencia recibida.', error);
  }
};

/**
 * Obtener detalle completo de un registro (datos, adjuntos, derivaciones y línea de tiempo)
 * GET /api/correspondencia-recibida/:id
 */
const getCorrespondenciaRecibidaById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Datos maestros
    const mainSql = `
      SELECT 
        cr.*,
        td.nombre AS tipo_documento_nombre,
        a.nombre AS area_responsable_nombre,
        a.sigla AS area_responsable_sigla,
        u.nombre_completo AS usuario_registro_nombre,
        u.username AS usuario_registro_username,
        ua.nombre_completo AS usuario_anulacion_nombre,
        ra.nombre AS usuario_anulacion_rol
      FROM correspondencia_recibida cr
      INNER JOIN tipos_documento td ON cr.id_tipo_doc = td.id_tipo_doc
      INNER JOIN areas a ON cr.id_area_responsable = a.id_area
      INNER JOIN usuarios u ON cr.id_usuario_registro = u.id_usuario
      LEFT JOIN usuarios ua ON cr.id_usuario_anulacion = ua.id_usuario
      LEFT JOIN roles ra ON ua.id_rol = ra.id_rol
      WHERE cr.id_recibida = $1
    `;
    const mainRes = await query(mainSql, [id]);

    if (mainRes.rows.length === 0) {
      return notFound(res, 'La correspondencia solicitada no fue encontrada.');
    }

    const correspondencia = mainRes.rows[0];

    // 2. Documentos digitales adjuntos
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
      WHERE da.id_recibida = $1
      ORDER BY da.id_documento ASC
    `;
    const adjuntosRes = await query(adjuntosSql, [id]);

    // 3. Historial de derivaciones
    const derivacionesSql = `
      SELECT 
        d.id_derivacion,
        d.fecha_derivacion,
        d.hora_derivacion,
        d.responsable_destino,
        d.instruccion_observacion,
        d.estado_derivacion,
        d.creado_en,
        ao.nombre AS area_origen_nombre,
        ad.nombre AS area_destino_nombre,
        u.nombre_completo AS usuario_derivo_nombre
      FROM derivaciones d
      LEFT JOIN areas ao ON d.id_area_origen = ao.id_area
      INNER JOIN areas ad ON d.id_area_destino = ad.id_area
      INNER JOIN usuarios u ON d.id_usuario_derivo = u.id_usuario
      WHERE d.id_recibida = $1
      ORDER BY d.id_derivacion ASC
    `;
    const derivacionesRes = await query(derivacionesSql, [id]);

    // 4. Línea de tiempo de seguimiento
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
      WHERE s.id_recibida = $1
      ORDER BY s.id_seguimiento ASC
    `;
    const seguimientosRes = await query(seguimientosSql, [id]);

    return success(res, {
      ...correspondencia,
      adjuntos: adjuntosRes.rows,
      derivaciones: derivacionesRes.rows,
      seguimientos: seguimientosRes.rows
    }, 'Detalle de correspondencia obtenido.');
  } catch (error) {
    console.error('[GET CORRESPONDENCIA RECIBIDA BY ID ERROR]:', error);
    return serverError(res, 'Error al obtener el detalle de la correspondencia.', error);
  }
};

/**
 * Registrar correspondencia recibida (transaccional con código correlativo y primer hito)
 * POST /api/correspondencia-recibida
 */
const crearCorrespondenciaRecibida = async (req, res) => {
  const client = await getClient();
  try {
    const {
      numero_documento_externo,
      fecha_recepcion,
      hora_recepcion,
      remitente,
      institucion_remitente,
      id_tipo_doc,
      asunto,
      destinatario,
      id_area_responsable,
      cargo_responsable,
      prioridad = 'Normal',
      observaciones
    } = req.body;

    // Validaciones de campos obligatorios
    if (!remitente || !id_tipo_doc || !asunto || !destinatario || !id_area_responsable
      || typeof cargo_responsable !== 'string' || !cargo_responsable.trim()) {
      return badRequest(res, 'Campos obligatorios requeridos: remitente, id_tipo_doc, asunto, destinatario, área responsable y cargo responsable.');
    }

    // Validar que los IDs sean enteros positivos válidos
    const idTipoDocInt = parseInt(id_tipo_doc, 10);
    const idAreaRespInt = parseInt(id_area_responsable, 10);
    if (!Number.isInteger(idTipoDocInt) || idTipoDocInt <= 0
      || !Number.isInteger(idAreaRespInt) || idAreaRespInt <= 0) {
      return badRequest(res, 'id_tipo_doc e id_area_responsable deben ser enteros positivos válidos.');
    }

    // Validar formato y rango de fecha_recepcion (YYYY-MM-DD, válida y no futura)
    if (fecha_recepcion) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_recepcion)) {
        return badRequest(res, 'fecha_recepcion debe tener formato YYYY-MM-DD.');
      }
      const [anioF, mesF, diaF] = fecha_recepcion.split('-').map(Number);
      const fechaObj = new Date(Date.UTC(anioF, mesF - 1, diaF));
      if (fechaObj.getUTCFullYear() !== anioF || fechaObj.getUTCMonth() !== mesF - 1 || fechaObj.getUTCDate() !== diaF) {
        return badRequest(res, 'fecha_recepcion no es una fecha calendario válida.');
      }
      const hoyStr = new Date().toISOString().slice(0, 10);
      if (fecha_recepcion > hoyStr || anioF < 2000) {
        return badRequest(res, 'fecha_recepcion debe estar entre 2000-01-01 y la fecha actual.');
      }
    }

    // Validar formato de hora_recepcion (HH:MM 24h, segundos opcionales)
    if (hora_recepcion) {
      if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(hora_recepcion).trim())) {
        return badRequest(res, 'hora_recepcion debe tener formato HH:MM válido (00:00 a 23:59).');
      }
    }

    // Validar si cargo_responsable pertenece al área indicada
    const cargoValido = await query(
      'SELECT id_cargo FROM cargos WHERE id_area = $1 AND LOWER(TRIM(nombre)) = LOWER(TRIM($2)) AND activo = TRUE',
      [idAreaRespInt, cargo_responsable.trim()]
    );
    if (cargoValido.rows.length === 0) {
      return badRequest(res, `El cargo responsable "${cargo_responsable}" no pertenece al área seleccionada.`);
    }

    await client.query('BEGIN');

    // 1. Generar código correlativo único atómico
    const anioActual = fecha_recepcion ? new Date(fecha_recepcion + 'T00:00:00Z').getUTCFullYear() : new Date().getFullYear();
    const codigoGenerado = await generarCodigoCorrelativo(client, 'RECIBIDA', anioActual);

    // 2. Insertar correspondencia recibida
    const insertSql = `
      INSERT INTO correspondencia_recibida (
        codigo,
        numero_documento_externo,
        fecha_recepcion,
        hora_recepcion,
        remitente,
        institucion_remitente,
        id_tipo_doc,
        asunto,
        destinatario,
        id_area_responsable,
        cargo_responsable,
        prioridad,
        estado,
        observaciones,
        id_usuario_registro
      ) VALUES ($1, $2, COALESCE($3, CURRENT_DATE), COALESCE($4, CURRENT_TIME), $5, $6, $7, $8, $9, $10, $11, $12, 'Recibido', $13, $14)
      RETURNING *
    `;

    const insertParams = [
      codigoGenerado,
      numero_documento_externo || null,
      fecha_recepcion || null,
      hora_recepcion || null,
      remitente.trim(),
      institucion_remitente ? institucion_remitente.trim() : null,
      idTipoDocInt,
      asunto.trim(),
      destinatario.trim(),
      idAreaRespInt,
      cargo_responsable ? cargo_responsable.trim() : null,
      prioridad,
      observaciones ? observaciones.trim() : null,
      req.user.id_usuario
    ];

    const insertRes = await client.query(insertSql, insertParams);
    const nuevaCorrespondencia = insertRes.rows[0];

    // 3. Asociar archivos manuales y escaneados en la misma alta
    const adjuntos = [
      ...(req.files?.archivo || []).map(archivo => ({ archivo, nombreOriginal: archivo.originalname })),
      ...(req.files?.archivo_escaneado || []).map(archivo => ({
        archivo,
        nombreOriginal: `${nuevaCorrespondencia.codigo}.pdf`
      }))
    ];
    for (const { archivo, nombreOriginal } of adjuntos) {
      const adjuntoSql = `
        INSERT INTO documentos_adjuntos (
          id_recibida,
          nombre_original,
          nombre_archivo,
          ruta_almacenamiento,
          mime_type,
          extension,
          tamano_bytes,
          id_usuario_subio
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      const pathModule = require('path');
      await client.query(adjuntoSql, [
        nuevaCorrespondencia.id_recibida,
        nombreOriginal,
        archivo.filename,
        archivo.path,
        archivo.mimetype,
        pathModule.extname(nombreOriginal).toLowerCase(),
        archivo.size,
        req.user.id_usuario
      ]);
    }

    // 4. Crear hito inicial en seguimientos
    const seguimientoSql = `
      INSERT INTO seguimientos (
        id_recibida,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, NULL, 'Recibido', 'REGISTRO_INICIAL', 'Documento recibido y registrado formalmente en el sistema', $2)
    `;
    await client.query(seguimientoSql, [nuevaCorrespondencia.id_recibida, req.user.id_usuario]);

    await client.query('COMMIT');

    // 5. Registrar en auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'REGISTRAR',
      modulo: 'Correspondencia Recibida',
      registro_afectado: nuevaCorrespondencia.codigo,
      detalles: `Registro de documento: ${nuevaCorrespondencia.asunto} de ${nuevaCorrespondencia.remitente}`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_area_destino: nuevaCorrespondencia.id_area_responsable,
      cargo_destino: nuevaCorrespondencia.cargo_responsable,
      tipo: 'CORRESPONDENCIA_NUEVA',
      titulo: 'Nueva correspondencia registrada',
      mensaje: `La correspondencia ${nuevaCorrespondencia.codigo} fue registrada y asignada.${nuevaCorrespondencia.cargo_responsable ? ' Responsable: ' + nuevaCorrespondencia.cargo_responsable : ''}`,
      referencia_codigo: nuevaCorrespondencia.codigo,
      id_recibida: nuevaCorrespondencia.id_recibida
    });

    return created(res, nuevaCorrespondencia, 'Correspondencia registrada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CREAR CORRESPONDENCIA RECIBIDA ERROR]:', error);
    return serverError(res, 'Error al registrar la correspondencia recibida.', error);
  } finally {
    client.release();
  }
};

/**
 * Modificar información de correspondencia recibida
 * PUT /api/correspondencia-recibida/:id
 */
const actualizarCorrespondenciaRecibida = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numero_documento_externo,
      remitente,
      institucion_remitente,
      id_tipo_doc,
      asunto,
      destinatario,
      id_area_responsable,
      cargo_responsable,
      prioridad,
      observaciones
    } = req.body;

    if (!id_area_responsable || typeof cargo_responsable !== 'string' || !cargo_responsable.trim()) {
      return badRequest(res, 'Debe especificar el área y el cargo responsable.');
    }

    const cargoValido = await query(
      'SELECT id_cargo FROM cargos WHERE id_area = $1 AND LOWER(TRIM(nombre)) = LOWER(TRIM($2)) AND activo = TRUE',
      [parseInt(id_area_responsable, 10), cargo_responsable.trim()]
    );
    if (cargoValido.rows.length === 0) {
      return badRequest(res, `El cargo responsable "${cargo_responsable}" no pertenece al área seleccionada.`);
    }

    const checkRes = await query("SELECT codigo, id_area_responsable FROM correspondencia_recibida WHERE id_recibida = $1 AND activo = TRUE AND estado <> 'ANULADO'", [id]);
    if (checkRes.rows.length === 0) {
      return notFound(res, 'La correspondencia a actualizar no existe.');
    }
    const { codigo, id_area_responsable: idAreaActual } = checkRes.rows[0];

    // Verificar que el documento pertenece al área del usuario
    if (req.user.rol_nombre !== 'Administrador' && Number(req.user.id_area) !== Number(idAreaActual)) {
      return forbidden(res, 'No puede editar correspondencia que no pertenece a su área.');
    }

    const updateSql = `
      UPDATE correspondencia_recibida SET
        numero_documento_externo = $1,
        remitente = $2,
        institucion_remitente = $3,
        id_tipo_doc = $4,
        asunto = $5,
        destinatario = $6,
        id_area_responsable = $7,
        cargo_responsable = $8,
        prioridad = $9,
        observaciones = $10,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_recibida = $11
      RETURNING *
    `;

    const updateParams = [
      numero_documento_externo || null,
      remitente.trim(),
      institucion_remitente ? institucion_remitente.trim() : null,
      parseInt(id_tipo_doc, 10),
      asunto.trim(),
      destinatario.trim(),
      parseInt(id_area_responsable, 10),
      cargo_responsable.trim(),
      prioridad,
      observaciones ? observaciones.trim() : null,
      id
    ];

    const updateRes = await query(updateSql, updateParams);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Correspondencia Recibida',
      registro_afectado: codigo,
      detalles: 'Actualización de datos generales del documento',
      req
    });

    return success(res, updateRes.rows[0], 'Documento actualizado correctamente.');
  } catch (error) {
    console.error('[ACTUALIZAR CORRESPONDENCIA ERROR]:', error);
    return serverError(res, 'Error al actualizar correspondencia.', error);
  }
};

/**
 * Anular correspondencia recibida mediante baja lógica
 * PATCH /api/correspondencia-recibida/:id/anular
 */
const anularCorrespondenciaRecibida = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const motivo = typeof req.body.motivo_anulacion === 'string' ? req.body.motivo_anulacion.trim() : '';

    if (!motivo) {
      return badRequest(res, 'El motivo de la anulación es obligatorio.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      "SELECT codigo, estado, id_area_responsable, cargo_responsable FROM correspondencia_recibida WHERE id_recibida = $1 AND activo = TRUE AND estado <> 'ANULADO'",
      [id]
    );
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia no encontrada o ya anulada.');
    }

    const { codigo, estado, id_area_responsable, cargo_responsable } = checkRes.rows[0];
    await client.query(`
      UPDATE correspondencia_recibida
      SET estado = 'ANULADO', motivo_anulacion = $1, id_usuario_anulacion = $2,
          fecha_anulacion = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
      WHERE id_recibida = $3
    `, [motivo, req.user.id_usuario, id]);

    await client.query(`
      INSERT INTO seguimientos (
        id_recibida, estado_anterior, estado_nuevo, accion, descripcion, id_usuario
      ) VALUES ($1, $2, 'ANULADO', 'ANULAR', $3, $4)
    `, [id, estado, `Motivo de anulación: ${motivo}`, req.user.id_usuario]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'ANULAR',
      modulo: 'Correspondencia Recibida',
      registro_afectado: codigo,
      detalles: `Correspondencia anulada. Motivo: ${motivo}`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_area_destino: id_area_responsable,
      cargo_destino: cargo_responsable,
      tipo: 'CORRESPONDENCIA_ANULADA',
      titulo: 'Correspondencia anulada',
      mensaje: `La correspondencia ${codigo} fue anulada. Motivo: ${motivo}`,
      referencia_codigo: codigo,
      id_recibida: id
    });

    return success(res, { id_recibida: id, estado: 'ANULADO', motivo_anulacion: motivo }, 'Correspondencia recibida anulada correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ANULAR CORRESPONDENCIA RECIBIDA ERROR]:', error);
    return serverError(res, 'Error al anular la correspondencia recibida.', error);
  } finally {
    client.release();
  }
};

/**
 * Cambiar estado de la correspondencia recibida
 * PATCH /api/correspondencia-recibida/:id/estado
 */
const cambiarEstadoCorrespondenciaRecibida = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { nuevo_estado, observaciones } = req.body;

    const MAPA_ESTADOS = {
      'recibido': 'Recibido',
      'en revision': 'En revisión',
      'en revisión': 'En revisión',
      'derivado': 'Derivado',
      'en proceso': 'En proceso',
      'atendido': 'Atendido',
      'archivado': 'Archivado'
    };

    const estadoKey = nuevo_estado ? nuevo_estado.trim().toLowerCase() : '';
    const estadoNormalizado = MAPA_ESTADOS[estadoKey];

    if (!estadoNormalizado) {
      return badRequest(res, 'Estado no válido. Opciones permitidas: Recibido, En revisión, Derivado, En proceso, Atendido, Archivado.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      "SELECT codigo, estado, id_area_responsable, cargo_responsable FROM correspondencia_recibida WHERE id_recibida = $1 AND activo = TRUE AND estado <> 'ANULADO'",
      [id]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia no encontrada.');
    }

    const { codigo, estado: estadoAnterior, id_area_responsable, cargo_responsable } = checkRes.rows[0];

    // Actualizar estado
    await client.query(
      'UPDATE correspondencia_recibida SET estado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_recibida = $2',
      [estadoNormalizado, id]
    );

    // Registrar hito en seguimientos
    const hitoSql = `
      INSERT INTO seguimientos (
        id_recibida,
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
      modulo: 'Correspondencia Recibida',
      registro_afectado: codigo,
      detalles: `Transición de estado: "${estadoAnterior}" -> "${estadoNormalizado}"`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_area_destino: id_area_responsable,
      cargo_destino: cargo_responsable,
      tipo: 'ESTADO_ACTUALIZADO',
      titulo: 'Estado actualizado',
      mensaje: `La correspondencia ${codigo} pasó a "${estadoNormalizado}".`,
      referencia_codigo: codigo,
      id_recibida: id
    });

    return success(res, { id_recibida: id, nuevo_estado: estadoNormalizado }, `Estado actualizado a ${estadoNormalizado}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CAMBIO ESTADO ERROR]:', error);
    return serverError(res, 'Error al cambiar estado.', error);
  } finally {
    client.release();
  }
};

/**
 * Adjuntar un documento digital adicional a una correspondencia existente
 * POST /api/correspondencia-recibida/:id/adjuntos
 */
const adjuntarDocumento = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    if (!req.file) {
      return badRequest(res, 'Debe adjuntar un archivo válido.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      'SELECT codigo, estado FROM correspondencia_recibida WHERE id_recibida = $1 AND activo = TRUE',
      [id]
    );
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia no encontrada.');
    }
    const { codigo, estado } = checkRes.rows[0];

    const pathModule = require('path');
    const insertAdjuntoSql = `
      INSERT INTO documentos_adjuntos (
        id_recibida,
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

    // Registrar hito en seguimientos
    const hitoSql = `
      INSERT INTO seguimientos (
        id_recibida,
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
      `Se adjuntó el documento digital: ${req.file.originalname}`,
      req.user.id_usuario
    ]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'CARGA_DOCUMENTO',
      modulo: 'Correspondencia Recibida',
      registro_afectado: codigo,
      detalles: `Archivo adjuntado: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`,
      req
    });

    return created(res, adjuntoRes.rows[0], 'Documento adjuntado exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ADJUNTAR DOCUMENTO ERROR]:', error);
    return serverError(res, 'Error al adjuntar documento.', error);
  } finally {
    client.release();
  }
};

module.exports = {
  getCorrespondenciaRecibida,
  getCorrespondenciaRecibidaById,
  crearCorrespondenciaRecibida,
  actualizarCorrespondenciaRecibida,
  anularCorrespondenciaRecibida,
  cambiarEstadoCorrespondenciaRecibida,
  adjuntarDocumento
};
