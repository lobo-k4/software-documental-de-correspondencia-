/**
 * Módulo de configuración centralizada de variables de entorno.
 * Asegura que los parámetros críticos estén definidos antes de iniciar la aplicación.
 */
const dotenv = require('dotenv');
const path = require('path');

process.env.TZ = 'America/La_Paz';

// Cargar variables desde el archivo .env en la raíz de backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  db: {
    user: (() => {
      if (!process.env.DB_USER) {
        throw new Error('DB_USER es obligatorio. Definelo en backend/.env');
      }
      return process.env.DB_USER;
    })(),
    password: (() => {
      if (!process.env.DB_PASSWORD) {
        throw new Error('DB_PASSWORD es obligatorio. Definelo en backend/.env');
      }
      return process.env.DB_PASSWORD;
    })(),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'sistema_correspondencia'
  },
  jwt: {
    secret: (() => {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET es obligatorio. Definelo en backend/.env');
      }
      return process.env.JWT_SECRET;
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  uploads: {
    directory: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
    maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024 // en bytes
  }
};

module.exports = config;
