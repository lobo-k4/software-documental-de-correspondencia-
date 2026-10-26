/**
 * Configuración central de la aplicación Express.js
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandlerMiddleware');
const authenticateToken = require('./middleware/authMiddleware');

const app = express();

// Headers de seguridad (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // API REST: el frontend Vite gestiona su propio CSP
  crossOriginEmbedderPolicy: false
}));

// Configuración de Seguridad y CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// Parsers para cuerpos de petición JSON y formularios
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Directorio estático para archivos adjuntos subidos (protegido con autenticación)
app.use('/uploads', authenticateToken, express.static(config.uploads.directory));

// Ruta base de estado y comprobación de salud (Health Check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Sistema de Gestión de Correspondencia API',
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// Enrutador principal de la API (se registrarán los módulos secuencialmente)
const routes = require('./routes');
app.use('/api', routes);

// Rutas no encontradas: respuesta JSON estándar en lugar de HTML de Express
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Middleware centralizado para manejo de errores
app.use(errorHandler);

module.exports = app;
