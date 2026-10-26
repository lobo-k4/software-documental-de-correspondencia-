/**
 * Middleware centralizado para captura y manejo seguro de excepciones no controladas.
 * Previene la fuga de información técnica o credenciales hacia el cliente.
 */
const { serverError } = require('../utils/responseHelper');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR NO CONTROLADO] ${req.method} ${req.originalUrl}:`, err);

  // Manejo de errores de carga de archivos (Multer)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: req.originalUrl === '/api/auth/foto-perfil'
        ? 'La imagen excede el tamaño máximo permitido (5 MB).'
        : 'El archivo excede el tamaño máximo permitido (10 MB).'
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `Error en la subida de archivos: ${err.message}`
    });
  }

  // Error de sintaxis JSON en el cuerpo de la petición
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'El formato del cuerpo de la solicitud (JSON) es inválido.'
    });
  }

  // Archivo cuyo contenido real no coincide con su extensión (magic numbers)
  if (err.code === 'ARCHIVO_FIRMA_INVALIDA') {
    return res.status(400).json({
      success: false,
      message: 'El archivo no es válido o no coincide con su extensión.'
    });
  }

  // Extensión/tipo MIME no permitido por el fileFilter de Multer
  if (err.code === 'ARCHIVO_TIPO_INVALIDO') {
    return res.status(400).json({
      success: false,
      message: err.message || 'Tipo de archivo no permitido.'
    });
  }

  return serverError(res, 'Ocurrió un error inesperado al procesar su solicitud.', err);
};

module.exports = errorHandler;
