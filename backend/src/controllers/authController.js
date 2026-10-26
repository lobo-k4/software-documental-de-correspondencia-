/**
 * Controlador para la Autenticación y Gestión de Sesión.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query } = require('../config/database');
const { registrarAuditoria } = require('../services/auditoriaService');
const { success, badRequest, unauthorized, serverError } = require('../utils/responseHelper');

/**
 * Iniciar sesión (Login)
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return badRequest(res, 'Por favor ingrese su usuario/correo y contraseña.');
    }

    // Buscar usuario por username o email
    const userQuery = `
      SELECT 
        u.id_usuario, 
        u.username, 
        u.email, 
        u.password_hash, 
        u.nombre_completo, 
        u.cargo, 
        u.foto_perfil,
        u.id_rol, 
        r.nombre AS rol_nombre, 
        u.id_area, 
        a.nombre AS area_nombre, 
        u.activo
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN areas a ON u.id_area = a.id_area
      WHERE (LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1))
    `;
    const userResult = await query(userQuery, [username.trim()]);

    if (userResult.rows.length === 0) {
      return unauthorized(res, 'Credenciales de acceso incorrectas.');
    }

    const usuario = userResult.rows[0];

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      await registrarAuditoria({
        id_usuario: usuario.id_usuario,
        username: usuario.username,
        accion: 'LOGIN_FALLIDO',
        modulo: 'Autenticación',
        detalles: 'Intento de acceso a cuenta desactivada',
        req
      });
      return unauthorized(res, 'Su cuenta de usuario se encuentra desactivada. Contacte al Administrador.');
    }

    // Validar contraseña con Bcrypt
    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido) {
      await registrarAuditoria({
        id_usuario: usuario.id_usuario,
        username: usuario.username,
        accion: 'LOGIN_FALLIDO',
        modulo: 'Autenticación',
        detalles: 'Contraseña incorrecta',
        req
      });
      return unauthorized(res, 'Credenciales de acceso incorrectas.');
    }

    // Obtener los permisos asociados al rol
    const permQuery = `
      SELECT p.codigo 
      FROM rol_permisos rp
      INNER JOIN permisos p ON rp.id_permiso = p.id_permiso
      WHERE rp.id_rol = $1
    `;
    const permResult = await query(permQuery, [usuario.id_rol]);
    const permisos = permResult.rows.map(row => row.codigo);

    // Generar token JWT con payload seguro
    const tokenPayload = {
      id_usuario: usuario.id_usuario,
      username: usuario.username,
      id_rol: usuario.id_rol,
      rol_nombre: usuario.rol_nombre
    };

    const token = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    // Actualizar fecha y hora del último acceso
    await query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1', [usuario.id_usuario]);

    // Registrar evento exitoso en auditoría
    await registrarAuditoria({
      id_usuario: usuario.id_usuario,
      username: usuario.username,
      accion: 'LOGIN',
      modulo: 'Autenticación',
      detalles: 'Inicio de sesión exitoso',
      req
    });

    // Retornar datos del usuario autenticado (sin el hash) y el token
    return success(res, {
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        username: usuario.username,
        email: usuario.email,
        nombre_completo: usuario.nombre_completo,
        activo: usuario.activo,
        cargo: usuario.cargo,
        foto_perfil: usuario.foto_perfil,
        id_rol: usuario.id_rol,
        rol_nombre: usuario.rol_nombre,
        id_area: usuario.id_area,
        area_nombre: usuario.area_nombre,
        permisos
      }
    }, 'Inicio de sesión exitoso.');
  } catch (error) {
    console.error('[LOGIN ERROR]:', error);
    return serverError(res, 'Error interno durante el inicio de sesión.', error);
  }
};

/**
 * Obtener perfil del usuario en sesión
 * GET /api/auth/me
 */
const getPerfil = async (req, res) => {
  try {
    return success(res, req.user, 'Perfil obtenido correctamente.');
  } catch (error) {
    return serverError(res, 'Error al obtener datos del perfil.', error);
  }
};

/**
 * Cambiar contraseña de la cuenta activa
 * PUT /api/auth/cambiar-password
 */
const cambiarPassword = async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;

    if (!password_actual || !password_nuevo) {
      return badRequest(res, 'Debe indicar tanto la contraseña actual como la nueva contraseña.');
    }

    if (password_nuevo.length < 12 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password_nuevo)) {
      return badRequest(res, 'La nueva contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y carácter especial.');
    }

    // Obtener hash actual de la base de datos
    const userRes = await query('SELECT password_hash FROM usuarios WHERE id_usuario = $1', [req.user.id_usuario]);
    if (userRes.rows.length === 0) {
      return unauthorized(res, 'Usuario no encontrado.');
    }

    const currentHash = userRes.rows[0].password_hash;
    const match = await bcrypt.compare(password_actual, currentHash);
    if (!match) {
      return badRequest(res, 'La contraseña actual ingresada es incorrecta.');
    }

    // Cifrar la nueva contraseña con salt de 10 rondas
    const newHash = await bcrypt.hash(password_nuevo, 10);
    await query(
      'UPDATE usuarios SET password_hash = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id_usuario = $2',
      [newHash, req.user.id_usuario]
    );

    // Registrar en auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Seguridad',
      registro_afectado: req.user.username,
      detalles: 'Cambio de contraseña realizado por el propio usuario',
      req
    });

    return success(res, null, 'Contraseña actualizada correctamente.');
  } catch (error) {
    console.error('[CAMBIAR PASSWORD ERROR]:', error);
    return serverError(res, 'Error al cambiar la contraseña.', error);
  }
};

/**
 * Guardar/reemplazar exclusivamente la foto del usuario autenticado.
 * POST /api/auth/foto-perfil
 */
const actualizarFotoPerfil = async (req, res) => {
  let archivoGuardado;
  try {
    const archivo = req.file;
    const firmaJpeg = archivo?.buffer?.subarray(0, 3);
    const firmaPng = archivo?.buffer?.subarray(0, 8);
    const esJpeg = archivo?.mimetype === 'image/jpeg'
      && firmaJpeg?.[0] === 0xff && firmaJpeg?.[1] === 0xd8 && firmaJpeg?.[2] === 0xff;
    const esPng = archivo?.mimetype === 'image/png'
      && firmaPng?.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    if (!archivo || (!esJpeg && !esPng)) {
      return badRequest(res, 'Seleccione una imagen JPEG o PNG válida.');
    }

    const fs = require('fs');
    const path = require('path');
    const { randomUUID } = require('crypto');
    const directory = path.join(config.uploads.directory, 'perfiles');
    const extension = esJpeg ? '.jpg' : '.png';
    const filename = `usuario-${req.user.id_usuario}-${randomUUID()}${extension}`;
    archivoGuardado = path.join(directory, filename);
    const fotoPerfil = `/uploads/perfiles/${filename}`;

    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(archivoGuardado, archivo.buffer, { flag: 'wx' });

    const result = await query(
      `UPDATE usuarios
       SET foto_perfil = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_usuario = $2
       RETURNING foto_perfil`,
      [fotoPerfil, req.user.id_usuario]
    );

    if (result.rows.length === 0) {
      await fs.promises.unlink(archivoGuardado);
      archivoGuardado = undefined;
      return notFound(res, 'No se encontró el usuario de la sesión.');
    }

    const fotoAnterior = req.user.foto_perfil;
    const prefijoFotosPerfil = '/uploads/perfiles/';
    if (fotoAnterior?.startsWith(prefijoFotosPerfil)) {
      const nombreAnterior = path.basename(fotoAnterior.replace(/\\/g, '/'));
      if (nombreAnterior && nombreAnterior !== filename) {
        try {
          await fs.promises.unlink(path.join(directory, nombreAnterior));
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error('[FOTO PERFIL CLEANUP ERROR]:', error);
          }
        }
      }
    }

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Mi Perfil',
      registro_afectado: req.user.username,
      detalles: 'Foto de perfil actualizada por el propio usuario',
      req
    });

    return success(res, { foto_perfil: result.rows[0].foto_perfil }, 'Foto de perfil actualizada correctamente.');
  } catch (error) {
    if (archivoGuardado) {
      const fs = require('fs');
      try {
        await fs.promises.unlink(archivoGuardado);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          console.error('[FOTO PERFIL ROLLBACK ERROR]:', cleanupError);
        }
      }
    }
    console.error('[ACTUALIZAR FOTO PERFIL ERROR]:', error);
    return serverError(res, 'Error al actualizar la foto de perfil.', error);
  }
};

/**
 * Cierre de sesión (Logout)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    if (req.user) {
      await registrarAuditoria({
        id_usuario: req.user.id_usuario,
        username: req.user.username,
        accion: 'LOGOUT',
        modulo: 'Autenticación',
        detalles: 'Cierre de sesión finalizado',
        req
      });
    }
    return success(res, null, 'Sesión finalizada correctamente.');
  } catch (error) {
    return serverError(res, 'Error al cerrar sesión.', error);
  }
};

module.exports = {
  login,
  getPerfil,
  actualizarFotoPerfil,
  cambiarPassword,
  logout
};
