/**
 * Controlador para la Derivación de Correspondencia (Módulo 8).
 * Administra pases de expedientes entre áreas y responsables, garantizando historial acumulativo inmutable.
 */
const { query, getClient } = require('../config/database');
const { registrarAuditoria } = require('../services/auditoriaService');
const { crearNotificacion } = require('../services/notificacionService');
const { success, created, badRequest, notFound, forbidden, serverError } = require('../utils/responseHelper');

/**
 * Listar derivaciones con filtros
 * GET /api/derivaciones
 */
const getDerivaciones = async (req, res) => {
  try {
    const {
      id_recibida,
      id_area_destino,
      estado_derivacion,
      q,
      codigo,
      busqueda,
      pagina = 1,
      limite = 10
    } = req.query;

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = ['cr.activo = TRUE'];
    const params = [];
    let paramIdx = 1;

    if (id_recibida) {
      conditions.push(`cr.id_recibida = $${paramIdx}`);
      params.push(parseInt(id_recibida, 10));
      paramIdx++;
    }

    if (id_area_destino) {
      conditions.push(`d.id_area_destino = $${paramIdx}`);
      params.push(parseInt(id_area_destino, 10));
      paramIdx++;
    }

    if (estado_derivacion) {
      const estadosDocumento = ['Recibido', 'En revisión', 'Derivado', 'En proceso', 'Atendido', 'Archivado'];
      conditions.push(`${estadosDocumento.includes(estado_derivacion) ? 'cr.estado' : 'd.estado_derivacion'} = $${paramIdx}`);
      params.push(estado_derivacion);
      paramIdx++;
    }

    const textoBusqueda = codigo || q || busqueda;
    if (textoBusqueda) {
      conditions.push(`(
        cr.codigo ILIKE $${paramIdx}
        OR ao.nombre ILIKE $${paramIdx}
        OR ad.nombre ILIKE $${paramIdx}
      )`);
      params.push(`%${textoBusqueda.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM correspondencia_recibida cr
      LEFT JOIN LATERAL (
        SELECT d.*
        FROM derivaciones d
        WHERE d.id_recibida = cr.id_recibida
        ORDER BY d.id_derivacion DESC
        LIMIT 1
      ) d ON TRUE
      LEFT JOIN areas ao ON ao.id_area = COALESCE(d.id_area_origen, cr.id_area_responsable)
      LEFT JOIN areas ad ON d.id_area_destino = ad.id_area
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        d.id_derivacion,
        cr.id_recibida,
        cr.codigo AS correspondencia_codigo,
        cr.asunto AS correspondencia_asunto,
        cr.remitente AS correspondencia_remitente,
        cr.fecha_recepcion,
        d.fecha_derivacion,
        d.hora_derivacion,
        d.cargo_destino,
        d.responsable_destino,
        d.instruccion_observacion,
        d.estado_derivacion,
        cr.estado,
        d.creado_en,
        ao.id_area AS id_area_origen,
        ao.nombre AS area_origen_nombre,
        ao.sigla AS area_origen_sigla,
        ad.id_area AS id_area_destino,
        ad.nombre AS area_destino_nombre,
        ad.sigla AS area_destino_sigla,
        u.nombre_completo AS usuario_derivo_nombre,
        d.responsable_destino AS responsable_nombre,
        d.instruccion_observacion AS observaciones,
        cr.codigo AS codigo_correspondencia
      FROM correspondencia_recibida cr
      LEFT JOIN LATERAL (
        SELECT d.*
        FROM derivaciones d
        WHERE d.id_recibida = cr.id_recibida
        ORDER BY d.id_derivacion DESC
        LIMIT 1
      ) d ON TRUE
      LEFT JOIN areas ao ON ao.id_area = COALESCE(d.id_area_origen, cr.id_area_responsable)
      LEFT JOIN areas ad ON d.id_area_destino = ad.id_area
      LEFT JOIN usuarios u ON d.id_usuario_derivo = u.id_usuario
      ${whereClause}
      ORDER BY cr.id_recibida DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await query(dataSql, dataParams);

    return success(res, {
      derivaciones: dataRes.rows,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    }, 'Derivaciones obtenidas correctamente.');
  } catch (error) {
    console.error('[GET DERIVACIONES ERROR]:', error);
    return serverError(res, 'Error al consultar derivaciones.', error);
  }
};

/**
 * Registrar una nueva derivación (transaccional)
 * POST /api/derivaciones
 */
const crearDerivacion = async (req, res) => {
  const client = await getClient();
  try {
    const {
      id_recibida,
      id_area_destino,
      cargo_destino,
      responsable_destino,
      instruccion_observacion
    } = req.body;

    if (!id_recibida || !id_area_destino
      || typeof cargo_destino !== 'string' || !cargo_destino.trim()) {
      return badRequest(res, 'Debe especificar el ID de correspondencia, el área de destino y el cargo responsable.');
    }

    // Validar si cargo_destino pertenece al área destino indicada
    const cargoValido = await query(
      'SELECT id_cargo FROM cargos WHERE id_area = $1 AND LOWER(TRIM(nombre)) = LOWER(TRIM($2)) AND activo = TRUE',
      [parseInt(id_area_destino, 10), cargo_destino.trim()]
    );
    if (cargoValido.rows.length === 0) {
      return badRequest(res, `El cargo responsable "${cargo_destino}" no pertenece al área de destino seleccionada.`);
    }

    await client.query('BEGIN');

    // 1. Obtener la correspondencia actual y su área responsable vigente
    const corresRes = await client.query(
      `SELECT cr.id_recibida, cr.codigo, cr.estado, cr.id_area_responsable, a.nombre AS area_origen_nombre
       FROM correspondencia_recibida cr
       INNER JOIN areas a ON cr.id_area_responsable = a.id_area
      WHERE cr.id_recibida = $1 AND cr.activo = TRUE AND cr.estado <> 'ANULADO'`,
      [id_recibida]
    );

    if (corresRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Correspondencia no encontrada o inactiva.');
    }

    const { codigo, estado: estadoAnterior, id_area_responsable: idAreaOrigen, area_origen_nombre: areaOrigenNombre } = corresRes.rows[0];

    // Verificar que la correspondencia pertenece al área del usuario
    if (req.user.rol_nombre !== 'Administrador' && Number(req.user.id_area) !== Number(idAreaOrigen)) {
      await client.query('ROLLBACK');
      return forbidden(res, 'No puede derivar correspondencia que no pertenece a su área.');
    }

    // 2. Obtener nombre del área destino
    const destRes = await client.query('SELECT nombre FROM areas WHERE id_area = $1', [id_area_destino]);
    if (destRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return badRequest(res, 'El área de destino especificada no existe.');
    }
    const areaDestinoNombre = destRes.rows[0].nombre;

    // Validar que origen y destino sean diferentes (refuerzo del CHECK en BD)
    if (Number(idAreaOrigen) === Number(id_area_destino)) {
      await client.query('ROLLBACK');
      return badRequest(res, 'El área de destino debe ser diferente al área de origen.');
    }

    // 3. Insertar registro en tabla derivaciones
    const insertDerivacionSql = `
      INSERT INTO derivaciones (
        id_recibida,
        id_area_origen,
        id_area_destino,
        cargo_destino,
        responsable_destino,
        id_usuario_derivo,
        instruccion_observacion,
        estado_derivacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pendiente')
      RETURNING *
    `;

    const derivacionParams = [
      id_recibida,
      idAreaOrigen,
      parseInt(id_area_destino, 10),
      cargo_destino ? cargo_destino.trim() : null,
      responsable_destino ? responsable_destino.trim() : (cargo_destino ? cargo_destino.trim() : null),
      req.user.id_usuario,
      instruccion_observacion ? instruccion_observacion.trim() : null
    ];

    const derivacionRes = await client.query(insertDerivacionSql, derivacionParams);
    const nuevaDerivacion = derivacionRes.rows[0];

    // 4. Actualizar correspondencia con nuevo estado 'Derivado' y reasignar área y cargo responsable
    await client.query(
      `UPDATE correspondencia_recibida 
       SET estado = 'Derivado', id_area_responsable = $1, cargo_responsable = $2, actualizado_en = CURRENT_TIMESTAMP 
       WHERE id_recibida = $3`,
      [id_area_destino, cargo_destino ? cargo_destino.trim() : null, id_recibida]
    );

    // 5. Agregar hito cronológico inmutable a seguimientos
    const hitoDescripcion = `Derivado de [${areaOrigenNombre}] a [${areaDestinoNombre}]${cargo_destino ? ' - Cargo Responsable: ' + cargo_destino : (responsable_destino ? ' - Responsable: ' + responsable_destino : '')}. Instrucción: ${instruccion_observacion || 'Atención según corresponda'}`;
    const hitoSql = `
      INSERT INTO seguimientos (
        id_recibida,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, $2, 'Derivado', 'DERIVACION', $3, $4)
    `;
    await client.query(hitoSql, [id_recibida, estadoAnterior, hitoDescripcion, req.user.id_usuario]);

    await client.query('COMMIT');

    // 6. Registrar en auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'DERIVAR',
      modulo: 'Derivaciones',
      registro_afectado: codigo,
      detalles: `Derivación formal hacia el área "${areaDestinoNombre}"`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_area_destino: parseInt(id_area_destino, 10),
      cargo_destino: cargo_destino ? cargo_destino.trim() : null,
      tipo: 'NUEVA_DERIVACION',
      titulo: 'Nueva derivación asignada',
      mensaje: `La correspondencia ${codigo} fue derivada a ${areaDestinoNombre}${cargo_destino ? ' para el cargo ' + cargo_destino : ''}.`,
      referencia_codigo: codigo,
      id_recibida: parseInt(id_recibida, 10)
    });

    return created(res, nuevaDerivacion, `Correspondencia derivada correctamente a ${areaDestinoNombre}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CREAR DERIVACION ERROR]:', error);
    return serverError(res, 'Error al derivar correspondencia.', error);
  } finally {
    client.release();
  }
};

/**
 * Aceptar o rechazar una derivación recibida
 * PATCH /api/derivaciones/:id/estado
 */
const cambiarEstadoDerivacion = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { estado_derivacion, observaciones } = req.body;

    const MAPA_ESTADOS = {
      'pendiente': 'Pendiente',
      'aceptado': 'Aceptado',
      'rechazado': 'Rechazado',
      'completado': 'Completado'
    };

    const estadoSolicitado = estado_derivacion ? estado_derivacion.trim().toLowerCase() : '';
    const estadosDocumento = ['recibido', 'en revisión', 'derivado', 'en proceso', 'atendido', 'archivado'];
    const estadoDocumento = estadosDocumento.includes(estadoSolicitado)
      ? estadoSolicitado.replace(/^./, letra => letra.toUpperCase())
      : null;
    const estadoNormalizado = MAPA_ESTADOS[estadoSolicitado] || (estadoDocumento ? 'Aceptado' : null);
    if (!estadoNormalizado) {
      return badRequest(res, 'Estado no válido. Opciones: Recibido, En revisión, Derivado, En proceso, Atendido, Archivado.');
    }

    await client.query('BEGIN');

    const checkRes = await client.query(
      `SELECT d.id_derivacion, d.id_recibida, d.id_area_origen, d.id_area_destino, d.id_usuario_derivo, d.estado_derivacion, cr.codigo, cr.estado AS estado_actual, ad.nombre AS area_destino_nombre
       FROM derivaciones d
       INNER JOIN correspondencia_recibida cr ON d.id_recibida = cr.id_recibida
       INNER JOIN areas ad ON d.id_area_destino = ad.id_area
       WHERE d.id_derivacion = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Derivación no encontrada.');
    }

    const { id_recibida, id_area_origen, id_area_destino, id_usuario_derivo, estado_derivacion: estadoActualDerivacion, codigo, estado_actual: estadoAnterior, area_destino_nombre: areaDestino } = checkRes.rows[0];

    // Verificar que el usuario pertenece al área destino de la derivación
    if (req.user.rol_nombre !== 'Administrador' && Number(req.user.id_area) !== Number(id_area_destino)) {
      await client.query('ROLLBACK');
      return forbidden(res, 'Solo el área destino puede cambiar el estado de esta derivación.');
    }

    // Máquina de estados: validar transición permitida
    const TRANSICIONES_VALIDAS = {
      'Pendiente': ['Aceptado', 'Rechazado'],
      'Aceptado': ['Completado'],
      'Rechazado': [],
      'Completado': []
    };
    const permitidos = TRANSICIONES_VALIDAS[estadoActualDerivacion] || [];
    if (!permitidos.includes(estadoNormalizado)) {
      await client.query('ROLLBACK');
      return badRequest(res, `Transición no válida de ${estadoActualDerivacion} a ${estadoNormalizado}. Permitidos: ${permitidos.length ? permitidos.join(', ') : 'ninguno (estado final)'}.`);
    }

    // Actualizar estado de la derivación
    await client.query(
      'UPDATE derivaciones SET estado_derivacion = $1 WHERE id_derivacion = $2',
      [estadoNormalizado, id]
    );

    // Si se acepta la derivación, la correspondencia pasa a 'En proceso'
    const nuevoEstadoCorres = estadoDocumento || (estadoNormalizado === 'Aceptado' ? 'En proceso' : 'Derivado');
    let accionSeguimiento = 'DERIVACION_' + estadoNormalizado.toUpperCase();

    if (estadoDocumento || estadoNormalizado === 'Aceptado') {
      await client.query(
        'UPDATE correspondencia_recibida SET estado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_recibida = $2',
        [nuevoEstadoCorres, id_recibida]
      );
    }

    // Registrar hito en seguimientos
    const hitoSql = `
      INSERT INTO seguimientos (
        id_recibida,
        estado_anterior,
        estado_nuevo,
        accion,
        descripcion,
        id_usuario
      ) VALUES ($1, 'Derivado', $2, $3, $4, $5)
    `;
    await client.query(hitoSql, [
      id_recibida,
      nuevoEstadoCorres,
      accionSeguimiento,
      observaciones || `Derivación ${estadoNormalizado.toLowerCase()} por el área ${areaDestino}`,
      req.user.id_usuario
    ]);

    await client.query('COMMIT');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Derivaciones',
      registro_afectado: codigo,
      detalles: `Estado de derivación actualizado a: ${estadoNormalizado}`,
      req
    });

    if (['Aceptado', 'Rechazado', 'Completado'].includes(estadoNormalizado)) {
      await crearNotificacion({
        id_usuario_origen: req.user.id_usuario,
        id_usuario_destino: id_usuario_derivo,
        tipo: 'RESPUESTA_DERIVACION',
        titulo: 'Respuesta de derivación',
        mensaje: `La derivación de ${codigo} fue marcada como ${estadoNormalizado.toLowerCase()} por el área ${areaDestino}.${observaciones ? ` ${observaciones}` : ''}`,
        referencia_codigo: codigo,
        id_recibida
      });
    }

    return success(res, { id_derivacion: id, estado_derivacion: estadoNormalizado }, `Derivación marcada como ${estadoNormalizado}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[CAMBIAR ESTADO DERIVACION ERROR]:', error);
    return serverError(res, 'Error al cambiar estado de derivación.', error);
  } finally {
    client.release();
  }
};

module.exports = {
  getDerivaciones,
  crearDerivacion,
  cambiarEstadoDerivacion
};
