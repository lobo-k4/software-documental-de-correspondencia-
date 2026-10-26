const { query } = require('../config/database');

/**
 * Crear notificación dirigida.
 * Regla:
 * - Notificación Operativa:
 *   ÁREA ASIGNADA + CARGO/FUNCIÓN = RESPONSABLE DE LA NOTIFICACIÓN
 *   Se entrega ÚNICAMENTE al usuario activo con esa combinación (o id_usuario_destino si es directo).
 *   NO se entrega a los demás miembros del área ni a administradores no asignados.
 * - Notificación Administrativa (es_administrativa: true):
 *   Se entrega a los usuarios con rol 'Administrador'.
 */
const crearNotificacion = async ({
  id_usuario_origen = null,
  id_usuario_destino = null,
  id_area_destino = null,
  cargo_destino = null,
  es_administrativa = false,
  tipo,
  titulo,
  mensaje,
  referencia_codigo = null,
  id_recibida = null,
  id_entregada = null
}) => {
  try {
    if (es_administrativa) {
      // Notificación administrativa: dirigida exclusivamente a Administradores
      await query(
        `INSERT INTO notificaciones (
           id_usuario_destino, id_usuario_origen, tipo, titulo, mensaje,
           referencia_codigo, id_recibida, id_entregada
         )
         SELECT DISTINCT u.id_usuario,
                         $1::INT,
                         $2::VARCHAR,
                         $3::VARCHAR,
                         $4::TEXT,
                         $5::VARCHAR,
                         $6::INT,
                         $7::INT
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.activo = TRUE AND r.nombre = 'Administrador'`,
        [
          id_usuario_origen,
          tipo,
          titulo,
          mensaje,
          referencia_codigo,
          id_recibida,
          id_entregada
        ]
      );
      return;
    }

    // Notificación operativa: debe llegar únicamente al usuario responsable
    if (id_usuario_destino) {
      // Destinatario específico directo por ID
      await query(
        `INSERT INTO notificaciones (
           id_usuario_destino, id_usuario_origen, tipo, titulo, mensaje,
           referencia_codigo, id_recibida, id_entregada
         )
         SELECT u.id_usuario,
                $1::INT,
                $2::VARCHAR,
                $3::VARCHAR,
                $4::TEXT,
                $5::VARCHAR,
                $6::INT,
                $7::INT
         FROM usuarios u
         WHERE u.id_usuario = $8::INT AND u.activo = TRUE`,
        [
          id_usuario_origen,
          tipo,
          titulo,
          mensaje,
          referencia_codigo,
          id_recibida,
          id_entregada,
          id_usuario_destino
        ]
      );
      return;
    }

    if (id_area_destino && cargo_destino) {
      // Notificar a todas las personas asignadas al cargo, hasta el límite configurado.
      const responsables = await query(
        `SELECT id_usuario
         FROM usuarios
         WHERE activo = TRUE
           AND id_area = $1::INT
           AND LOWER(TRIM(cargo)) = LOWER(TRIM($2::VARCHAR))
         ORDER BY id_usuario
         LIMIT 6`,
        [id_area_destino, cargo_destino]
      );

      if (responsables.rows.length === 0) {
        console.error('[NOTIFICACION ERROR]: No existe un usuario activo con esa área y cargo.', {
          id_area_destino,
          cargo_destino
        });
        return;
      }
      if (responsables.rows.length > 5) {
        console.error('[NOTIFICACION ERROR]: Hay más de cinco usuarios activos con esa área y cargo; no se notificó a ninguno.', {
          id_area_destino,
          cargo_destino
        });
        return;
      }

      await query(
        `INSERT INTO notificaciones (
           id_usuario_destino, id_usuario_origen, tipo, titulo, mensaje,
           referencia_codigo, id_recibida, id_entregada
         )
         SELECT u.id_usuario,
                $1::INT,
                $2::VARCHAR,
                $3::VARCHAR,
                $4::TEXT,
                $5::VARCHAR,
                $6::INT,
                $7::INT
         FROM usuarios u
         WHERE u.activo = TRUE
           AND u.id_usuario = ANY($8::INT[])`,
        [
          id_usuario_origen,
          tipo,
          titulo,
          mensaje,
          referencia_codigo,
          id_recibida,
          id_entregada,
          responsables.rows.map(({ id_usuario }) => id_usuario)
        ]
      );
      return;
    }

    // Nunca asignar notificaciones operativas por área sin un cargo responsable.
    if (id_area_destino) {
      console.error('[NOTIFICACION ERROR]: No se creó el aviso operativo porque falta el cargo responsable.', {
        id_area_destino
      });
    }
  } catch (error) {
    console.error('[NOTIFICACION ERROR]: No se pudo crear el aviso:', error.message);
  }
};

/**
 * Notificaciones de correspondencia pendiente de atención (> 24 horas).
 * Llega ÚNICAMENTE al usuario activo cuya Área + Cargo coincida con el responsable del expediente.
 */
const crearAvisosPendientes = async (idUsuario) => {
  try {
    await query(
      `INSERT INTO notificaciones (
         id_usuario_destino, tipo, titulo, mensaje, referencia_codigo, id_recibida
       )
       SELECT u.id_usuario,
              'PENDIENTE_ATENCION'::VARCHAR,
              'Correspondencia pendiente de atención'::VARCHAR,
              ('La correspondencia ' || cr.codigo || ' continúa en estado "' || cr.estado || '" y requiere atención.')::TEXT,
              cr.codigo::VARCHAR,
              cr.id_recibida::INT
       FROM correspondencia_recibida cr
       CROSS JOIN usuarios u
       WHERE u.id_usuario = $1::INT
         AND u.activo = TRUE
         AND cr.activo = TRUE
         AND cr.estado IN ('Recibido', 'Derivado', 'En revisión', 'En proceso')
         AND COALESCE(cr.actualizado_en, cr.creado_en) <= CURRENT_TIMESTAMP - INTERVAL '24 hours'
         AND u.id_area = cr.id_area_responsable
         AND cr.cargo_responsable IS NOT NULL
         AND TRIM(cr.cargo_responsable) <> ''
         AND LOWER(TRIM(u.cargo)) = LOWER(TRIM(cr.cargo_responsable))
       ON CONFLICT DO NOTHING`,
      [idUsuario]
    );
  } catch (error) {
    console.error('[NOTIFICACION ERROR]: No se pudieron generar avisos pendientes:', error.message);
  }
};

module.exports = { crearNotificacion, crearAvisosPendientes };