/**
 * Middleware para la subida segura de archivos adjuntos utilizando Multer.
 * Valida tipos MIME permitidos, extensiones y límites de tamaño.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

// Asegurar existencia del directorio uploads
if (!fs.existsSync(config.uploads.directory)) {
  fs.mkdirSync(config.uploads.directory, { recursive: true });
}

// Configuración de almacenamiento en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploads.directory);
  },
  filename: (req, file, cb) => {
    // Generar nombre seguro con timestamp y hash aleatorio
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

// Lista blanca estricta de formatos permitidos
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'image/jpeg',
  'image/png'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIME_TYPES.includes(mime)) {
    cb(null, true);
  } else {
    const errorTipo = new Error(`Tipo de archivo no permitido (${ext}). Solo se aceptan PDF, Word, Excel e Imágenes (JPG/PNG).`);
    errorTipo.code = 'ARCHIVO_TIPO_INVALIDO';
    errorTipo.statusCode = 400;
    cb(errorTipo);
  }
};

// Firmas mágicas (magic numbers) por extensión para verificar contenido real
const FIRMAS_POR_EXTENSION = {
  '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  '.png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.docx': [[0x50, 0x4b, 0x03, 0x04]], // ZIP (Office Open XML)
  '.xlsx': [[0x50, 0x4b, 0x03, 0x04]],
  '.doc': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE
  '.xls': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]]
};

const coincideFirma = (buffer, firma) => firma.every((byte, i) => buffer[i] === byte);

const esFirmaValida = (rutaArchivo, ext) => {
  const firmas = FIRMAS_POR_EXTENSION[ext];
  if (!firmas) return false;
  const fd = fs.openSync(rutaArchivo, 'r');
  try {
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    return firmas.some((firma) => coincideFirma(buffer, firma));
  } finally {
    fs.closeSync(fd);
  }
};

const recolectarArchivos = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat();
  }
  return [];
};

const eliminarArchivos = (archivos) => {
  for (const archivo of archivos) {
    try {
      if (archivo?.path && fs.existsSync(archivo.path)) fs.unlinkSync(archivo.path);
    } catch {
      // No bloquear la respuesta si la limpieza falla
    }
  }
};

// Verifica el contenido real tras la subida y elimina archivos con firma inválida
const verificarFirmas = (req) => {
  const archivos = recolectarArchivos(req);
  for (const archivo of archivos) {
    const ext = path.extname(archivo.originalname).toLowerCase();
    let valido = false;
    try {
      valido = esFirmaValida(archivo.path, ext);
    } catch {
      valido = false;
    }
    if (!valido) {
      eliminarArchivos(archivos);
      const errorFirma = new Error(`El archivo "${archivo.originalname}" no coincide con su tipo declarado (${ext}). Contenido rechazado.`);
      errorFirma.code = 'ARCHIVO_FIRMA_INVALIDA';
      errorFirma.statusCode = 400;
      throw errorFirma;
    }
  }
};

// Envuelve un middleware multer para verificar firmas sin cambiar la API usada en rutas
const envolverConVerificacion = (middlewareMulter) => (req, res, next) => {
  middlewareMulter(req, res, (err) => {
    if (err) return next(err);
    try {
      verificarFirmas(req);
      return next();
    } catch (errorVerificacion) {
      return next(errorVerificacion);
    }
  });
};

const multerUpload = multer({
  storage,
  limits: {
    fileSize: config.uploads.maxFileSize // 10MB
  },
  fileFilter
});

// Misma API que multer (single/array/fields/any/none) para no romper las rutas existentes
const upload = {
  single: (...args) => envolverConVerificacion(multerUpload.single(...args)),
  array: (...args) => envolverConVerificacion(multerUpload.array(...args)),
  fields: (...args) => envolverConVerificacion(multerUpload.fields(...args)),
  any: (...args) => envolverConVerificacion(multerUpload.any(...args)),
  none: (...args) => multerUpload.none(...args)
};

module.exports = upload;
