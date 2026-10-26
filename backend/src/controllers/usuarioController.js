/**
 * Controlador para la Gestión Integral de Usuarios (Módulo 1).
 * Implementa CRUD, baja lógica, filtros de búsqueda y auditoría.
 */
const bcrypt = require('bcryptjs');
const { getClient, query } = require('../config/database');
const { registrarAuditoria } = require('../services/auditoriaService');
const { success, created, badRequest, notFound, conflict, serverError } = require('../utils/responseHelper');

const ROLES_GESTIONABLES = [1, 2, 3];
const MAX_USUARIOS_POR_CARGO = 5;

const contarUsuariosActivosPorCargo = async (client, idArea, cargo, idUsuarioExcluir = null) => {
  const clave = `${idArea}:${cargo.trim().toLowerCase()}`;
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [clave]
  );

  const result = await client.query(
    `SELECT COUNT(*)::INT AS total
     FROM usuarios
     WHERE activo = TRUE
       AND id_area = $1
       AND LOWER(TRIM(cargo)) = LOWER(TRIM($2))
       AND ($3::INT IS NULL OR id_usuario <> $3::INT)`,
    [idArea, cargo.trim(), idUsuarioExcluir]
  );
  return result.rows[0].total;
};

/**
 * Listar usuarios con paginación y filtros
 * GET /api/usuarios
 */
const getUsuarios = async (req, res) => {
  try {
    const {
      busqueda = '',
      id_rol,
      id_area,
      activo,
      pagina = 1,
      limite = 10
    } = req.query;

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filtro por término de búsqueda (nombre, username o email)
    if (busqueda && busqueda.trim()) {
      conditions.push(`(
        LOWER(u.nombre_completo) LIKE LOWER($${paramIndex}) OR
        LOWER(u.username) LIKE LOWER($${paramIndex}) OR
        LOWER(u.email) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${busqueda.trim()}%`);
      paramIndex++;
    }

    // Filtro por rol
    if (id_rol) {
      conditions.push(`u.id_rol = $${paramIndex}`);
      params.push(parseInt(id_rol, 10));
      paramIndex++;
    }

    // Filtro por área institucional
    if (id_area) {
      conditions.push(`u.id_area = $${paramIndex}`);
      params.push(parseInt(id_area, 10));
      paramIndex++;
    }

    // Filtro por estado activo/inactivo
    if (activo !== undefined && activo !== '') {
      conditions.push(`u.activo = $${paramIndex}`);
      params.push(activo === 'true' || activo === true || activo === '1');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Consulta total de registros para paginación
    const countQuery = `SELECT COUNT(*) AS total FROM usuarios u ${whereClause}`;
    const countRes = await query(countQuery, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Consulta paginada de usuarios con joins descriptivos
    const listParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        u.id_usuario,
        u.username,
        u.email,
        u.nombre_completo,
        u.cargo,
        u.id_rol,
        r.nombre AS rol_nombre,
        u.id_area,
        a.nombre AS area_nombre,
        a.sigla AS area_sigla,
        u.activo,
        u.ultimo_acceso,
        u.creado_en,
        u.actualizado_en
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN areas a ON u.id_area = a.id_area
      ${whereClause}
      ORDER BY u.id_usuario ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataRes = await query(dataQuery, listParams);

    return success(res, {
      usuarios: dataRes.rows,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    }, 'Usuarios listados correctamente.');
  } catch (error) {
    console.error('[GET USUARIOS ERROR]:', error);
    return serverError(res, 'Error al obtener la lista de usuarios.', error);
  }
};

/**
 * Obtener detalle de un usuario por su ID
 * GET /api/usuarios/:id
 */
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar :id numérico antes de consultar (evita error PG 22P02 → 500)
    if (!/^\d+$/.test(String(id).trim())) {
      return notFound(res, 'El usuario solicitado no existe.');
    }

    const userQuery = `
      SELECT 
        u.id_usuario,
        u.username,
        u.email,
        u.nombre_completo,
        u.cargo,
        u.id_rol,
        r.nombre AS rol_nombre,
        u.id_area,
        a.nombre AS area_nombre,
        a.sigla AS area_sigla,
        u.activo,
        u.ultimo_acceso,
        u.creado_en,
        u.actualizado_en
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN areas a ON u.id_area = a.id_area
      WHERE u.id_usuario = $1
    `;
    const userRes = await query(userQuery, [id]);

    if (userRes.rows.length === 0) {
      return notFound(res, 'El usuario solicitado no existe.');
    }

    return success(res, userRes.rows[0], 'Detalle de usuario obtenido.');
  } catch (error) {
    return serverError(res, 'Error al obtener el usuario.', error);
  }
};

/**
 * Registrar nuevo usuario institucional
 * POST /api/usuarios
 */
const crearUsuario = async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const {
      username,
      email,
      password,
      nombre_completo,
      id_rol,
      id_area,
      cargo
    } = req.body;

    // Validaciones de obligatoriedad
    if (!username || !email || !password || !nombre_completo || !id_rol) {
      return badRequest(res, 'Campos requeridos: username, email, password, nombre_completo, id_rol.');
    }

    if (cargo != null && typeof cargo !== 'string') {
      return badRequest(res, 'El cargo debe seleccionarse del catálogo del área.');
    }

    if (!ROLES_GESTIONABLES.includes(parseInt(id_rol, 10))) {
      return badRequest(res, 'Solo se pueden asignar los roles Administrador, Operador o Secretaria.');
    }

    const tieneArea = Boolean(id_area);
    const tieneCargo = typeof cargo === 'string' && Boolean(cargo.trim());
    if (tieneArea !== tieneCargo) {
      return badRequest(res, 'Debe asignar conjuntamente el área y un cargo válido del catálogo.');
    }

    if (password.length < 12 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) {
      return badRequest(res, 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y carácter especial.');
    }

    // Validar formato básico de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequest(res, 'El formato del correo electrónico es inválido.');
    }

    // Comprobar unicidad de username
    const checkUsername = await query(
      'SELECT id_usuario FROM usuarios WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    if (checkUsername.rows.length > 0) {
      return conflict(res, 'El nombre de usuario (username) ya se encuentra registrado.');
    }

    // Comprobar unicidad de email
    const checkEmail = await query(
      'SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    if (checkEmail.rows.length > 0) {
      return conflict(res, 'La dirección de correo electrónico ya se encuentra registrada.');
    }

    // Validar que el cargo pertenece al catálogo del área seleccionada.
    if (id_area && cargo && cargo.trim()) {
      const cargoValidoRes = await query(
        'SELECT id_cargo FROM cargos WHERE id_area = $1 AND LOWER(TRIM(nombre)) = LOWER(TRIM($2)) AND activo = TRUE',
        [parseInt(id_area, 10), cargo.trim()]
      );
      if (cargoValidoRes.rows.length === 0) {
        return badRequest(res, `El cargo "${cargo}" no pertenece al catálogo oficial del área seleccionada.`);
      }
    }

    // Cifrar contraseña con Bcrypt (10 rondas de salt)
    const passwordHash = await bcrypt.hash(password, 10);

    const insertSql = `
      INSERT INTO usuarios (
        username,
        email,
        password_hash,
        nombre_completo,
        id_rol,
        id_area,
        cargo,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id_usuario, username, email, nombre_completo, cargo, id_rol, id_area, activo, creado_en
    `;

    const insertParams = [
      username.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      nombre_completo.trim(),
      parseInt(id_rol, 10),
      id_area ? parseInt(id_area, 10) : null,
      cargo ? cargo.trim() : null
    ];

    client = await getClient();
    await client.query('BEGIN');
    transactionStarted = true;

    if (id_area && cargo && cargo.trim()) {
      const usuariosActivos = await contarUsuariosActivosPorCargo(
        client,
        parseInt(id_area, 10),
        cargo
      );
      if (usuariosActivos >= MAX_USUARIOS_POR_CARGO) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return conflict(
          res,
          `Ya existen ${MAX_USUARIOS_POR_CARGO} usuarios activos con ese cargo en esta área. El máximo permitido es ${MAX_USUARIOS_POR_CARGO}.`
        );
      }
    }

    const insertRes = await client.query(insertSql, insertParams);
    const nuevoUsuario = insertRes.rows[0];
    await client.query('COMMIT');
    transactionStarted = false;

    // Registrar en auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'REGISTRAR',
      modulo: 'Usuarios',
      registro_afectado: nuevoUsuario.username,
      detalles: `Creación de usuario: ${nuevoUsuario.nombre_completo} con rol ID ${id_rol}`,
      req
    });

    return created(res, nuevoUsuario, 'Usuario creado exitosamente.');
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('[CREAR USUARIO ERROR]:', error);
    return serverError(res, 'Error al registrar el nuevo usuario.', error);
  } finally {
    if (client) client.release();
  }
};

/**
 * Modificar datos de usuario
 * PUT /api/usuarios/:id
 */
const actualizarUsuario = async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const { id } = req.params;
    const { email, nombre_completo, id_rol, id_area, cargo } = req.body;

    if (!email || !nombre_completo || !id_rol) {
      return badRequest(res, 'Campos requeridos: email, nombre_completo, id_rol.');
    }

    if (cargo != null && typeof cargo !== 'string') {
      return badRequest(res, 'El cargo debe seleccionarse del catálogo del área.');
    }

    if (!ROLES_GESTIONABLES.includes(parseInt(id_rol, 10))) {
      return badRequest(res, 'Solo se pueden asignar los roles Administrador, Operador o Secretaria.');
    }

    const tieneArea = Boolean(id_area);
    const tieneCargo = typeof cargo === 'string' && Boolean(cargo.trim());
    if (tieneArea !== tieneCargo) {
      return badRequest(res, 'Debe asignar conjuntamente el área y un cargo válido del catálogo.');
    }

    // Verificar existencia del usuario
    const userExistRes = await query('SELECT id_usuario, username, activo FROM usuarios WHERE id_usuario = $1', [id]);
    if (userExistRes.rows.length === 0) {
      return notFound(res, 'El usuario a modificar no existe.');
    }
    const usuarioExistente = userExistRes.rows[0];

    // Comprobar si el nuevo email ya está en uso por otro usuario
    const checkEmail = await query(
      'SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1) AND id_usuario != $2',
      [email.trim(), id]
    );
    if (checkEmail.rows.length > 0) {
      return conflict(res, 'El correo electrónico ya está registrado por otro usuario.');
    }

    // Validar que el cargo pertenece al catálogo del área seleccionada.
    if (id_area && cargo && cargo.trim()) {
      const cargoValidoRes = await query(
        'SELECT id_cargo FROM cargos WHERE id_area = $1 AND LOWER(TRIM(nombre)) = LOWER(TRIM($2)) AND activo = TRUE',
        [parseInt(id_area, 10), cargo.trim()]
      );
      if (cargoValidoRes.rows.length === 0) {
        return badRequest(res, `El cargo "${cargo}" no pertenece al catálogo oficial del área seleccionada.`);
      }
    }

    const updateSql = `
      UPDATE usuarios SET
        email = $1,
        nombre_completo = $2,
        id_rol = $3,
        id_area = $4,
        cargo = $5,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_usuario = $6
      RETURNING id_usuario, username, email, nombre_completo, cargo, id_rol, id_area, activo, actualizado_en
    `;

    const updateParams = [
      email.trim().toLowerCase(),
      nombre_completo.trim(),
      parseInt(id_rol, 10),
      id_area ? parseInt(id_area, 10) : null,
      cargo ? cargo.trim() : null,
      id
    ];

    client = await getClient();
    await client.query('BEGIN');
    transactionStarted = true;

    if (usuarioExistente.activo && id_area && cargo && cargo.trim()) {
      const usuariosActivos = await contarUsuariosActivosPorCargo(
        client,
        parseInt(id_area, 10),
        cargo,
        parseInt(id, 10)
      );
      if (usuariosActivos >= MAX_USUARIOS_POR_CARGO) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return conflict(
          res,
          `Ya existen ${MAX_USUARIOS_POR_CARGO} usuarios activos con ese cargo en esta área. El máximo permitido es ${MAX_USUARIOS_POR_CARGO}.`
        );
      }
    }

    const updateRes = await client.query(updateSql, updateParams);
    await client.query('COMMIT');
    transactionStarted = false;

    // Registrar en auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Usuarios',
      registro_afectado: usuarioExistente.username,
      detalles: `Modificación de datos del usuario ID: ${id}`,
      req
    });

    return success(res, updateRes.rows[0], 'Usuario actualizado correctamente.');
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('[ACTUALIZAR USUARIO ERROR]:', error);
    return serverError(res, 'Error al actualizar el usuario.', error);
  } finally {
    if (client) client.release();
  }
};

/**
 * Activación o baja lógica de usuario
 * PATCH /api/usuarios/:id/estado
 */
const cambiarEstadoUsuario = async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (activo === undefined) {
      return badRequest(res, 'Debe especificar el nuevo estado booleano (activo: true/false).');
    }

    // Evitar que el administrador se desactive a sí mismo
    if (parseInt(id, 10) === req.user.id_usuario && !activo) {
      return badRequest(res, 'No puede desactivar su propia cuenta activa de administrador.');
    }

    const checkRes = await query('SELECT username, id_area, cargo, activo FROM usuarios WHERE id_usuario = $1', [id]);
    if (checkRes.rows.length === 0) {
      return notFound(res, 'Usuario no encontrado.');
    }
    const targetUser = checkRes.rows[0];

    client = await getClient();
    await client.query('BEGIN');
    transactionStarted = true;

    if (activo && !targetUser.activo && targetUser.id_area && targetUser.cargo) {
      const usuariosActivos = await contarUsuariosActivosPorCargo(
        client,
        targetUser.id_area,
        targetUser.cargo,
        parseInt(id, 10)
      );
      if (usuariosActivos >= MAX_USUARIOS_POR_CARGO) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return conflict(
          res,
          `No se puede reactivar el usuario: ya existen ${MAX_USUARIOS_POR_CARGO} usuarios activos con ese cargo en esta área.`
        );
      }
    }

    await client.query(
      'UPDATE usuarios SET activo = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_usuario = $2',
      [activo, id]
    );
    await client.query('COMMIT');
    transactionStarted = false;

    const accionAudit = activo ? 'ACTIVAR' : 'DESACTIVAR_LOGICO';
    const detalleAudit = activo ? 'Cuenta reactivada' : 'Cuenta desactivada (baja lógica)';

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: accionAudit,
      modulo: 'Usuarios',
      registro_afectado: targetUser.username,
      detalles: detalleAudit,
      req
    });

    return success(
      res,
      { id_usuario: parseInt(id, 10), activo },
      `Usuario ${activo ? 'activado' : 'desactivado'} correctamente.`
    );
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    return serverError(res, 'Error al cambiar el estado del usuario.', error);
  } finally {
    if (client) client.release();
  }
};

/**
 * Eliminar un usuario sin registros asociados
 * DELETE /api/usuarios/:id
 */
const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id, 10) === req.user.id_usuario) {
      return badRequest(res, 'No puede eliminar su propia cuenta.');
    }

    const usuarioRes = await query('SELECT username FROM usuarios WHERE id_usuario = $1', [id]);
    if (usuarioRes.rows.length === 0) {
      return notFound(res, 'Usuario no encontrado.');
    }

    const { username } = usuarioRes.rows[0];
    await query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'ELIMINAR_USUARIO',
      modulo: 'Usuarios',
      registro_afectado: username,
      detalles: `Usuario eliminado: ${username}`,
      req
    });

    return success(res, { id_usuario: parseInt(id, 10) }, 'Usuario eliminado correctamente.');
  } catch (error) {
    if (error.code === '23503') {
      return conflict(res, 'No se puede eliminar porque el usuario tiene registros asociados. Puede desactivarlo en su lugar.');
    }
    return serverError(res, 'Error al eliminar el usuario.', error);
  }
};

/**
 * Restablecer contraseña de usuario (exclusivo para Administrador)
 * PUT /api/usuarios/:id/restablecer-password
 */
const restablecerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password_nuevo } = req.body;

    if (!password_nuevo || password_nuevo.length < 12 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password_nuevo)) {
      return badRequest(res, 'La nueva contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y carácter especial.');
    }

    const checkRes = await query('SELECT username FROM usuarios WHERE id_usuario = $1', [id]);
    if (checkRes.rows.length === 0) {
      return notFound(res, 'Usuario no encontrado.');
    }
    const targetUser = checkRes.rows[0];

    const newHash = await bcrypt.hash(password_nuevo, 10);
    await query(
      'UPDATE usuarios SET password_hash = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_usuario = $2',
      [newHash, id]
    );

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'RESTABLECER_PASSWORD',
      modulo: 'Seguridad',
      registro_afectado: targetUser.username,
      detalles: `Contraseña restablecida por el Administrador`,
      req
    });

    return success(res, null, 'Contraseña restablecida exitosamente.');
  } catch (error) {
    return serverError(res, 'Error al restablecer contraseña.', error);
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario,
  restablecerPassword
};
