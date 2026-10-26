/**
 * Controlador de Catálogos Institucionales (Roles, Áreas, Tipos de Documento, Permisos).
 * Provee datos maestros para formularios, filtros y control de acceso.
 */
const { query } = require('../config/database');
const { success, serverError } = require('../utils/responseHelper');

/**
 * Obtener listado de roles
 * GET /api/catalogos/roles
 */
const getRoles = async (req, res) => {
  try {
    const result = await query(
      'SELECT id_rol, nombre, descripcion, activo FROM roles ORDER BY id_rol ASC'
    );
    return success(res, result.rows, 'Roles obtenidos correctamente.');
  } catch (error) {
    return serverError(res, 'Error al obtener roles.', error);
  }
};

/**
 * Obtener listado de áreas institucionales
 * GET /api/catalogos/areas
 */
const getAreas = async (req, res) => {
  try {
    const result = await query(
      'SELECT id_area, nombre, sigla, descripcion, activo FROM areas WHERE activo = TRUE ORDER BY nombre ASC'
    );
    return success(res, result.rows, 'Áreas obtenidas correctamente.');
  } catch (error) {
    return serverError(res, 'Error al obtener áreas.', error);
  }
};

/**
 * Obtener listado de tipos de documento
 * GET /api/catalogos/tipos-documento
 */
const getTiposDocumento = async (req, res) => {
  try {
    const result = await query(
      'SELECT id_tipo_doc, nombre, descripcion, activo FROM tipos_documento WHERE activo = TRUE ORDER BY nombre ASC'
    );
    return success(res, result.rows, 'Tipos de documento obtenidos correctamente.');
  } catch (error) {
    return serverError(res, 'Error al obtener tipos de documento.', error);
  }
};

/**
 * Obtener listado de permisos del sistema
 * GET /api/catalogos/permisos
 */
const getPermisos = async (req, res) => {
  try {
    const result = await query(
      'SELECT id_permiso, codigo, nombre, modulo, descripcion FROM permisos ORDER BY modulo ASC, id_permiso ASC'
    );
    return success(res, result.rows, 'Permisos obtenidos correctamente.');
  } catch (error) {
    return serverError(res, 'Error al obtener permisos.', error);
  }
};

/**
 * Obtener listado de cargos institucionales (opcionalmente filtrados por id_area)
 * GET /api/catalogos/cargos
 */
const getCargos = async (req, res) => {
  try {
    const { id_area } = req.query;
    let sql = `
      SELECT c.id_cargo, c.id_area, a.nombre AS area_nombre, c.nombre, c.activo
      FROM cargos c
      INNER JOIN areas a ON c.id_area = a.id_area
      WHERE c.activo = TRUE
    `;
    const params = [];
    if (id_area) {
      sql += ' AND c.id_area = $1';
      params.push(parseInt(id_area, 10));
    }
    sql += ' ORDER BY a.nombre ASC, c.nombre ASC';
    const result = await query(sql, params);
    return success(res, result.rows, 'Cargos obtenidos correctamente.');
  } catch (error) {
    return serverError(res, 'Error al obtener cargos.', error);
  }
};

module.exports = {
  getRoles,
  getAreas,
  getCargos,
  getTiposDocumento,
  getPermisos
};
