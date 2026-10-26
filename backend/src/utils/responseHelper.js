/**
 * Utilidad para estandarizar las respuestas JSON de la API REST.
 * Asegura coherencia estructural en respuestas exitosas y de error.
 */

const success = (res, data = null, message = 'Operación realizada correctamente', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const created = (res, data = null, message = 'Registro creado exitosamente') => {
  return success(res, data, message, 201);
};

const badRequest = (res, message = 'Los datos ingresados no son válidos', errors = null) => {
  return res.status(400).json({
    success: false,
    message,
    errors
  });
};

const unauthorized = (res, message = 'Acceso no autorizado. Debe iniciar sesión.') => {
  return res.status(401).json({
    success: false,
    message
  });
};

const forbidden = (res, message = 'No cuenta con los permisos necesarios para realizar esta acción.') => {
  return res.status(403).json({
    success: false,
    message
  });
};

const notFound = (res, message = 'El recurso solicitado no fue encontrado.') => {
  return res.status(404).json({
    success: false,
    message
  });
};

const conflict = (res, message = 'El registro ya existe o entra en conflicto con datos existentes.') => {
  return res.status(409).json({
    success: false,
    message
  });
};

const serverError = (res, message = 'Ha ocurrido un error interno en el servidor.', error = null) => {
  if (process.env.NODE_ENV === 'development' && error) {
    console.error('[SERVER ERROR DETAIL]:', error);
  }
  return res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' && error ? error.message : undefined
  });
};

module.exports = {
  success,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
};
