/**
 * Controlador para la Generación de Reportes Administrativos (Módulo 13).
 */
const { query } = require('../config/database');
const { success, serverError } = require('../utils/responseHelper');

/**
 * Reporte de Correspondencia Recibida con filtros multicriterio
 * GET /api/reportes/recibida
 */
const getReporteRecibida = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado, id_area, id_tipo_doc, prioridad } = req.query;

    const conditions = ['cr.activo = TRUE'];
    const params = [];
    let paramIdx = 1;

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

    if (estado) {
      conditions.push(`cr.estado = $${paramIdx}`);
      params.push(estado);
      paramIdx++;
    }

    if (id_area) {
      conditions.push(`cr.id_area_responsable = $${paramIdx}`);
      params.push(parseInt(id_area, 10));
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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
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
        cr.prioridad,
        cr.estado,
        td.nombre AS tipo_documento,
        a.nombre AS area_responsable,
        u.nombre_completo AS registrado_por
      FROM correspondencia_recibida cr
      INNER JOIN tipos_documento td ON cr.id_tipo_doc = td.id_tipo_doc
      INNER JOIN areas a ON cr.id_area_responsable = a.id_area
      INNER JOIN usuarios u ON cr.id_usuario_registro = u.id_usuario
      ${whereClause}
      ORDER BY cr.fecha_recepcion DESC, cr.id_recibida DESC
    `;

    const result = await query(sql, params);
    return success(res, {
      total_registros: result.rows.length,
      datos: result.rows
    }, 'Reporte de correspondencia recibida generado.');
  } catch (error) {
    console.error('[REPORTE RECIBIDA ERROR]:', error);
    return serverError(res, 'Error al generar reporte de correspondencia recibida.', error);
  }
};

/**
 * Reporte de Correspondencia Entregada con filtros
 * GET /api/reportes/entregada
 */
const getReporteEntregada = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, estado, id_area, medio_entrega } = req.query;

    const conditions = ['ce.activo = TRUE'];
    const params = [];
    let paramIdx = 1;

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

    if (estado) {
      conditions.push(`ce.estado = $${paramIdx}`);
      params.push(estado);
      paramIdx++;
    }

    if (id_area) {
      conditions.push(`ce.id_area_remitente = $${paramIdx}`);
      params.push(parseInt(id_area, 10));
      paramIdx++;
    }

    if (medio_entrega) {
      conditions.push(`ce.medio_entrega = $${paramIdx}`);
      params.push(medio_entrega);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
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
        td.nombre AS tipo_documento,
        a.nombre AS area_remitente,
        u.nombre_completo AS registrado_por
      FROM correspondencia_entregada ce
      INNER JOIN tipos_documento td ON ce.id_tipo_doc = td.id_tipo_doc
      INNER JOIN areas a ON ce.id_area_remitente = a.id_area
      INNER JOIN usuarios u ON ce.id_usuario_registro = u.id_usuario
      ${whereClause}
      ORDER BY ce.fecha_emision DESC, ce.id_entregada DESC
    `;

    const result = await query(sql, params);
    return success(res, {
      total_registros: result.rows.length,
      datos: result.rows
    }, 'Reporte de correspondencia entregada generado.');
  } catch (error) {
    console.error('[REPORTE ENTREGADA ERROR]:', error);
    return serverError(res, 'Error al generar reporte de correspondencia entregada.', error);
  }
};

/**
 * Reporte de Rendimiento y Actividad de Usuarios
 * GET /api/reportes/usuarios
 */
const getReporteUsuarios = async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id_usuario,
        u.username,
        u.nombre_completo,
        r.nombre AS rol_nombre,
        a.nombre AS area_nombre,
        (SELECT COUNT(*) FROM correspondencia_recibida cr WHERE cr.id_usuario_registro = u.id_usuario) AS total_recibidas_registradas,
        (SELECT COUNT(*) FROM correspondencia_entregada ce WHERE ce.id_usuario_registro = u.id_usuario) AS total_entregadas_registradas,
        (SELECT COUNT(*) FROM derivaciones d WHERE d.id_usuario_derivo = u.id_usuario) AS total_derivaciones_realizadas,
        (SELECT COUNT(*) FROM notas_generadas ng WHERE ng.id_usuario_genero = u.id_usuario) AS total_notas_generadas,
        (SELECT COUNT(*) FROM auditoria aud WHERE aud.id_usuario = u.id_usuario) AS total_operaciones_auditadas,
        u.ultimo_acceso
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN areas a ON u.id_area = a.id_area
      WHERE u.activo = TRUE
      ORDER BY total_operaciones_auditadas DESC
    `;

    const result = await query(sql);
    return success(res, result.rows, 'Reporte de productividad de usuarios generado.');
  } catch (error) {
    console.error('[REPORTE USUARIOS ERROR]:', error);
    return serverError(res, 'Error al generar reporte de usuarios.', error);
  }
};

module.exports = {
  getReporteRecibida,
  getReporteEntregada,
  getReporteUsuarios
};
