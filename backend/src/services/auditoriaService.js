/**
 * Servicio centralizado para el registro de eventos en la tabla de Auditoría.
 * Permite trazabilidad inalterable de operaciones críticas en el sistema.
 */
const { query } = require('../config/database');

/**
 * Registra un evento en la bitácora de auditoría.
 * @param {Object} params
 * @param {number|null} params.id_usuario - ID del usuario que ejecuta la acción
 * @param {string} params.username - Nombre de usuario
 * @param {string} params.accion - Tipo de acción (LOGIN, LOGOUT, REGISTRAR, MODIFICAR, ELIMINAR_LOGICO, DERIVAR, CAMBIO_ESTADO)
 * @param {string} params.modulo - Nombre del módulo afectado
 * @param {string|null} params.registro_afectado - Identificador del registro afectado (código, ID, etc.)
 * @param {string|null} params.detalles - Descripción o datos adicionales de la operación
 * @param {Object|null} params.req - Objeto request de Express para extraer la IP de origen
 */
const registrarAuditoria = async ({
  id_usuario = null,
  username = 'SISTEMA',
  accion,
  modulo,
  registro_afectado = null,
  detalles = null,
  req = null
}) => {
  try {
    let ipOrigen = '127.0.0.1';
    if (req) {
      ipOrigen = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
      // Limpiar prefijo IPv6 si existe (ej. ::ffff:127.0.0.1)
      if (ipOrigen.includes('::ffff:')) {
        ipOrigen = ipOrigen.replace('::ffff:', '');
      }
    }

    const sql = `
      INSERT INTO auditoria (id_usuario, username, accion, modulo, registro_afectado, detalles, ip_origen)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_auditoria
    `;
    const params = [
      id_usuario,
      username,
      accion,
      modulo,
      registro_afectado ? String(registro_afectado) : null,
      detalles,
      ipOrigen
    ];

    await query(sql, params);
  } catch (error) {
    // La auditoría no debe interrumpir el flujo principal si ocurre un error, pero sí registrarse en consola
    console.error('[AUDITORIA ERROR]: Error al registrar bitácora:', error.message);
  }
};

module.exports = {
  registrarAuditoria
};
