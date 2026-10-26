const { query } = require('../config/database');
const { crearAvisosPendientes } = require('../services/notificacionService');
const { success, notFound, serverError } = require('../utils/responseHelper');

const getNotificaciones = async (req, res) => {
  try {
    await crearAvisosPendientes(req.user.id_usuario);
    const [notificacionesRes, noLeidasRes] = await Promise.all([
      query(
        `SELECT id_notificacion, tipo, titulo, mensaje, referencia_codigo,
                id_recibida, id_entregada, leida_en, creado_en
         FROM notificaciones
         WHERE id_usuario_destino = $1
         ORDER BY creado_en DESC, id_notificacion DESC
         LIMIT 50`,
        [req.user.id_usuario]
      ),
      query(
        'SELECT COUNT(*)::INT AS total FROM notificaciones WHERE id_usuario_destino = $1 AND leida_en IS NULL',
        [req.user.id_usuario]
      )
    ]);

    return success(res, {
      notificaciones: notificacionesRes.rows,
      no_leidas: noLeidasRes.rows[0].total
    });
  } catch (error) {
    return serverError(res, 'No se pudieron cargar las notificaciones.', error);
  }
};

const marcarNotificacionLeida = async (req, res) => {
  try {
    const result = await query(
      `UPDATE notificaciones
       SET leida_en = COALESCE(leida_en, CURRENT_TIMESTAMP)
       WHERE id_notificacion = $1 AND id_usuario_destino = $2
       RETURNING id_notificacion, leida_en`,
      [req.params.id, req.user.id_usuario]
    );
    if (result.rows.length === 0) return notFound(res, 'Notificación no encontrada.');
    return success(res, result.rows[0], 'Notificación marcada como leída.');
  } catch (error) {
    return serverError(res, 'No se pudo actualizar la notificación.', error);
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    await query(
      'UPDATE notificaciones SET leida_en = CURRENT_TIMESTAMP WHERE id_usuario_destino = $1 AND leida_en IS NULL',
      [req.user.id_usuario]
    );
    return success(res, null, 'Todas las notificaciones fueron marcadas como leídas.');
  } catch (error) {
    return serverError(res, 'No se pudieron marcar las notificaciones como leídas.', error);
  }
};

module.exports = { getNotificaciones, marcarNotificacionLeida, marcarTodasLeidas };