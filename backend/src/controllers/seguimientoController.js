/**
 * Controlador para el Módulo de Seguimiento y Trazabilidad (Módulo 9).
 * Permite conocer el estado actual y la evolución cronológica (timeline) de cada expediente.
 */
const { query } = require('../config/database');
const { registrarAuditoria } = require('../services/auditoriaService');
const { success, created, badRequest, notFound, serverError } = require('../utils/responseHelper');

/**
 * Consultar la línea de tiempo y estado de un documento por código o ID
 * GET /api/seguimientos
 */
const getSeguimiento = async (req, res) => {
  try {
    const { codigo, id_recibida, id_entregada } = req.query;

    if (!codigo && !id_recibida && !id_entregada) {
      return badRequest(res, 'Debe especificar el código único o el ID de la correspondencia a consultar.');
    }

    let targetRecibidaId = id_recibida;
    let targetEntregadaId = id_entregada;
    let documentoInfo = null;

    // Si se buscó por código único (COR-REC-... o COR-ENT-...)
    if (codigo) {
      const codigoBuscado = codigo.trim().toUpperCase();

      if (codigoBuscado.includes('REC')) {
        const docRes = await query(
          `SELECT 
            cr.id_recibida, cr.codigo, cr.numero_documento_externo, cr.asunto, 
            cr.remitente, cr.institucion_remitente, cr.destinatario, cr.prioridad, 
            cr.estado, cr.fecha_recepcion, cr.hora_recepcion,
            a.nombre AS area_responsable_nombre,
            td.nombre AS tipo_documento_nombre
           FROM correspondencia_recibida cr
           INNER JOIN areas a ON cr.id_area_responsable = a.id_area
           INNER JOIN tipos_documento td ON cr.id_tipo_doc = td.id_tipo_doc
           WHERE cr.codigo = $1 AND cr.activo = TRUE`,
          [codigoBuscado]
        );
        if (docRes.rows.length > 0) {
          documentoInfo = { ...docRes.rows[0], tipo_flujo: 'RECIBIDA' };
          targetRecibidaId = docRes.rows[0].id_recibida;
        }
      } else if (codigoBuscado.includes('ENT')) {
        const docRes = await query(
          `SELECT 
            ce.id_entregada, ce.codigo, ce.numero_nota, ce.asunto,
            ce.destinatario, ce.institucion_destinatario, ce.responsable_remitente,
            ce.medio_entrega, ce.estado, ce.fecha_emision, ce.hora_emision,
            a.nombre AS area_remitente_nombre,
            td.nombre AS tipo_documento_nombre
           FROM correspondencia_entregada ce
           INNER JOIN areas a ON ce.id_area_remitente = a.id_area
           INNER JOIN tipos_documento td ON ce.id_tipo_doc = td.id_tipo_doc
           WHERE ce.codigo = $1 AND ce.activo = TRUE`,
          [codigoBuscado]
        );
        if (docRes.rows.length > 0) {
          documentoInfo = { ...docRes.rows[0], tipo_flujo: 'ENTREGADA' };
          targetEntregadaId = docRes.rows[0].id_entregada;
        }
      }
    }

    if (!targetRecibidaId && !targetEntregadaId) {
      return notFound(res, 'No se encontró ninguna correspondencia con el identificador proporcionado.');
    }

    // Obtener los hitos ordenados cronológicamente
    let timelineSql = '';
    let timelineParams = [];

    if (targetRecibidaId) {
      timelineSql = `
        SELECT 
          s.id_seguimiento,
          s.estado_anterior,
          s.estado_nuevo,
          s.accion,
          s.descripcion,
          s.fecha_hora,
          u.nombre_completo AS usuario_nombre,
          u.cargo AS usuario_cargo,
          r.nombre AS usuario_rol
        FROM seguimientos s
        INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
        INNER JOIN roles r ON u.id_rol = r.id_rol
        WHERE s.id_recibida = $1
        ORDER BY s.id_seguimiento ASC
      `;
      timelineParams = [targetRecibidaId];

      if (!documentoInfo) {
        const infoRes = await query(
          `SELECT cr.id_recibida, cr.codigo, cr.asunto, cr.remitente, cr.estado, cr.fecha_recepcion, a.nombre AS area_responsable_nombre
           FROM correspondencia_recibida cr
           INNER JOIN areas a ON cr.id_area_responsable = a.id_area
           WHERE cr.id_recibida = $1`,
          [targetRecibidaId]
        );
        documentoInfo = { ...infoRes.rows[0], tipo_flujo: 'RECIBIDA' };
      }
    } else {
      timelineSql = `
        SELECT 
          s.id_seguimiento,
          s.estado_anterior,
          s.estado_nuevo,
          s.accion,
          s.descripcion,
          s.fecha_hora,
          u.nombre_completo AS usuario_nombre,
          u.cargo AS usuario_cargo,
          r.nombre AS usuario_rol
        FROM seguimientos s
        INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
        INNER JOIN roles r ON u.id_rol = r.id_rol
        WHERE s.id_entregada = $1
        ORDER BY s.id_seguimiento ASC
      `;
      timelineParams = [targetEntregadaId];

      if (!documentoInfo) {
        const infoRes = await query(
          `SELECT ce.id_entregada, ce.codigo, ce.asunto, ce.destinatario, ce.estado, ce.fecha_emision, a.nombre AS area_remitente_nombre
           FROM correspondencia_entregada ce
           INNER JOIN areas a ON ce.id_area_remitente = a.id_area
           WHERE ce.id_entregada = $1`,
          [targetEntregadaId]
        );
        documentoInfo = { ...infoRes.rows[0], tipo_flujo: 'ENTREGADA' };
      }
    }

    const timelineRes = await query(timelineSql, timelineParams);

    return success(res, {
      documento: documentoInfo,
      total_hitos: timelineRes.rows.length,
      linea_tiempo: timelineRes.rows
    }, 'Historial de seguimiento obtenido correctamente.');
  } catch (error) {
    console.error('[GET SEGUIMIENTO ERROR]:', error);
    return serverError(res, 'Error al consultar seguimiento.', error);
  }
};

/**
 * Agregar una observación o hito manual a la línea de tiempo
 * POST /api/seguimientos
 */
const agregarHitoManual = async (req, res) => {
  try {
    const { id_recibida, id_entregada, observacion } = req.body;

    if (!observacion || (!id_recibida && !id_entregada)) {
      return badRequest(res, 'Debe especificar el ID de correspondencia y el texto de la observación.');
    }

    // Obtener estado actual del documento
    let estadoActual = 'En proceso';
    let codigo = '';

    if (id_recibida) {
      const docRes = await query('SELECT codigo, estado FROM correspondencia_recibida WHERE id_recibida = $1', [id_recibida]);
      if (docRes.rows.length === 0) return notFound(res, 'Correspondencia recibida no encontrada.');
      estadoActual = docRes.rows[0].estado;
      codigo = docRes.rows[0].codigo;
    } else {
      const docRes = await query('SELECT codigo, estado FROM correspondencia_entregada WHERE id_entregada = $1', [id_entregada]);
      if (docRes.rows.length === 0) return notFound(res, 'Correspondencia entregada no encontrada.');
      estadoActual = docRes.rows[0].estado;
      codigo = docRes.rows[0].codigo;
    }

    const insertSql = `
      INSERT INTO seguimientos (
        id_recibida,
        id_entregada,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, $2, $3, $3, 'OBSERVACION_MANUAL', $4, $5)
      RETURNING *
    `;

    const insertRes = await query(insertSql, [
      id_recibida || null,
      id_entregada || null,
      estadoActual,
      observacion.trim(),
      req.user.id_usuario
    ]);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'AGREGAR_HITO',
      modulo: 'Seguimiento',
      registro_afectado: codigo,
      detalles: `Observación manual agregada al seguimiento: ${observacion.substring(0, 80)}...`,
      req
    });

    return created(res, insertRes.rows[0], 'Hito de seguimiento registrado correctamente.');
  } catch (error) {
    console.error('[AGREGAR HITO ERROR]:', error);
    return serverError(res, 'Error al registrar hito de seguimiento.', error);
  }
};

module.exports = {
  getSeguimiento,
  agregarHitoManual
};
