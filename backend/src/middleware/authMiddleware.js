/**
 * Middleware de autenticación mediante JSON Web Tokens (JWT).
 * Valida la firma del token, expiración y la vigencia activa del usuario en PostgreSQL.
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query } = require('../config/database');
const { unauthorized } = require('../utils/responseHelper');
const { registrarAuditoria } = require('../services/auditoriaService');

// Registra intentos fallidos sin bloquear ni romper la respuesta 401
const auditarAccesoDenegado = (req, motivo, id_usuario = null, username = 'ANONIMO') => {
  registrarAuditoria({
    id_usuario,
    username,
    accion: 'ACCESO_DENEGADO',
    modulo: 'Seguridad',
    registro_afectado: req.originalUrl || req.url,
    detalles: motivo,
    req
  });
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      auditarAccesoDenegado(req, 'Token de autenticación no proporcionado.');
      return unauthorized(res, 'Token de autenticación no proporcionado. Debe iniciar sesión.');
    }

    // Verificar token criptográficamente
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtErr) {
      const parcial = jwt.decode(token) || {};
      if (jwtErr.name === 'TokenExpiredError') {
        auditarAccesoDenegado(req, 'Token expirado.', parcial.id_usuario || null, parcial.username || 'ANONIMO');
        return unauthorized(res, 'Su sesión ha expirado. Por favor inicie sesión nuevamente.');
      }
      auditarAccesoDenegado(req, 'Token inválido.', parcial.id_usuario || null, parcial.username || 'ANONIMO');
      return unauthorized(res, 'Token de autenticación inválido.');
    }

    // Comprobar estado vigente en base de datos PostgreSQL
    const userQuery = `
      SELECT 
        u.id_usuario, 
        u.username, 
        u.email, 
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
      WHERE u.id_usuario = $1
    `;
    const userResult = await query(userQuery, [decoded.id_usuario]);

    if (userResult.rows.length === 0) {
      auditarAccesoDenegado(req, `Usuario inexistente (id_usuario=${decoded.id_usuario}).`, decoded.id_usuario || null, decoded.username || 'ANONIMO');
      return unauthorized(res, 'El usuario asociado a este token no existe.');
    }

    const usuario = userResult.rows[0];

    if (!usuario.activo) {
      auditarAccesoDenegado(req, 'Cuenta desactivada.', usuario.id_usuario, usuario.username);
      return unauthorized(res, 'Su cuenta de usuario se encuentra desactivada. Contacte al administrador.');
    }

    // Obtener los códigos de permisos asociados al rol
    const permQuery = `
      SELECT p.codigo 
      FROM rol_permisos rp
      INNER JOIN permisos p ON rp.id_permiso = p.id_permiso
      WHERE rp.id_rol = $1
    `;
    const permResult = await query(permQuery, [usuario.id_rol]);
    const permisos = permResult.rows.map(row => row.codigo);

    // Inyectar usuario y permisos en req para los controladores subsecuentes
    req.user = {
      ...usuario,
      permisos
    };

    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE ERROR]:', error.message);
    return unauthorized(res, 'Error al autenticar el usuario.');
  }
};

module.exports = authenticateToken;
