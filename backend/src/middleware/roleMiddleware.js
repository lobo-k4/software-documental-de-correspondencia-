/**
 * Middleware para autorización y control de acceso basado en roles y permisos (RBAC).
 */
const { forbidden } = require('../utils/responseHelper');

/**
 * Middleware que verifica si el usuario autenticado tiene uno de los roles permitidos.
 * @param  {...string} rolesPermitidos - Lista de nombres de roles (ej. 'Administrador', 'Operador', 'Secretaria')
 */
const requireRole = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'No se encontró información de autenticación.');
    }

    if (!rolesPermitidos.includes(req.user.rol_nombre)) {
      return forbidden(
        res,
        `Acceso restringido. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}.`
      );
    }

    next();
  };
};

/**
 * Middleware que verifica si el usuario autenticado cuenta con un permiso específico.
 * @param {string} permisoRequerido - Código del permiso (ej. 'RECIBIDA_CREAR')
 */
const requirePermission = (permisoRequerido) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'No se encontró información de autenticación.');
    }

    if (!req.user.permisos || !req.user.permisos.includes(permisoRequerido)) {
      return forbidden(
        res,
        `No tiene autorización para ejecutar esta acción. Permiso requerido: ${permisoRequerido}.`
      );
    }

    next();
  };
};

module.exports = {
  requireRole,
  requirePermission
};
