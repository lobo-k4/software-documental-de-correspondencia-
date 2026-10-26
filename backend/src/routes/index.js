/**
 * Enrutador principal de la API REST.
 * Centraliza la agregación modular de rutas.
 */
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const catalogoRoutes = require('./catalogoRoutes');
const correspondenciaRecibidaRoutes = require('./correspondenciaRecibidaRoutes');
const correspondenciaEntregadaRoutes = require('./correspondenciaEntregadaRoutes');
const derivacionRoutes = require('./derivacionRoutes');
const seguimientoRoutes = require('./seguimientoRoutes');
const documentoRoutes = require('./documentoRoutes');
const plantillaRoutes = require('./plantillaRoutes');
const notaRoutes = require('./notaRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reporteRoutes = require('./reporteRoutes');
const auditoriaRoutes = require('./auditoriaRoutes');
const scannerRoutes = require('./scannerRoutes');
const notificacionRoutes = require('./notificacionRoutes');

// Registro de submódulos de la API
router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/catalogos', catalogoRoutes);
router.use('/correspondencia-recibida', correspondenciaRecibidaRoutes);
router.use('/correspondencia-entregada', correspondenciaEntregadaRoutes);
router.use('/derivaciones', derivacionRoutes);
router.use('/seguimientos', seguimientoRoutes);
router.use('/documentos', documentoRoutes);
router.use('/plantillas', plantillaRoutes);
router.use('/notas', notaRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reportes', reporteRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/scanner', scannerRoutes);
router.use('/notificaciones', notificacionRoutes);

// Ruta de información general de la API
router.get('/', (req, res) => {
  res.json({
    nombre: 'API REST - Sistema de Gestión de Correspondencia',
    version: '1.0.0',
    descripcion: 'Servicios para correspondencia recibida, entregada, derivaciones, seguimiento, notas y auditoría',
    documentacion: '/api/docs'
  });
});

module.exports = router;
