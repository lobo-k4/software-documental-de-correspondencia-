/**
 * Controlador para la Bitácora de Auditoría del Sistema (Módulo 14).
 * Exclusivo para el rol Administrador.
 */
const { query } = require('../config/database');
const { success, serverError } = require('../utils/responseHelper');

/**
 * Listar registros de auditoría con filtros avanzados y paginación
 * GET /api/auditoria
 */
const getAuditoria = async (req, res) => {
  try {
    const {
      username,
      accion,
      modulo,
      registro_afectado,
      fecha_inicio,
      fecha_fin,
      pagina = 1,
      limite = 20
    } = req.query;

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (username && username.trim()) {
      conditions.push(`LOWER(a.username) LIKE LOWER($${paramIdx})`);
      params.push(`%${username.trim()}%`);
      paramIdx++;
    }

    if (accion) {
      conditions.push(`a.accion = $${paramIdx}`);
      params.push(accion);
      paramIdx++;
    }

    if (modulo) {
      conditions.push(`a.modulo = $${paramIdx}`);
      params.push(modulo);
      paramIdx++;
    }

    if (registro_afectado && registro_afectado.trim()) {
      conditions.push(`LOWER(a.registro_afectado) LIKE LOWER($${paramIdx})`);
      params.push(`%${registro_afectado.trim()}%`);
      paramIdx++;
    }

    if (fecha_inicio) {
      conditions.push(`a.fecha_hora >= $${paramIdx}`);
      params.push(fecha_inicio);
      paramIdx++;
    }

    if (fecha_fin) {
      conditions.push(`a.fecha_hora <= $${paramIdx}`);
      params.push(fecha_fin);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM auditoria a ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        a.id_auditoria,
        a.id_usuario,
        a.username,
        a.accion,
        a.modulo,
        a.registro_afectado,
        a.detalles,
        a.ip_origen,
        a.fecha_hora
      FROM auditoria a
      ${whereClause}
      ORDER BY a.id_auditoria DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await query(dataSql, dataParams);

    return success(res, {
      registros: dataRes.rows,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    }, 'Bitácora de auditoría consultada.');
  } catch (error) {
    console.error('[GET AUDITORIA ERROR]:', error);
    return serverError(res, 'Error al consultar la bitácora de auditoría.', error);
  }
};

module.exports = {
  getAuditoria
};
