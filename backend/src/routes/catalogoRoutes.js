/**
 * Rutas para Catálogos del Sistema (Roles, Áreas, Tipos de Documento, Permisos).
 */
const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogoController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Todas las consultas de catálogos requieren token válido
router.use(authenticateToken);

router.get('/roles', catalogoController.getRoles);
router.get('/areas', catalogoController.getAreas);
router.get('/cargos', catalogoController.getCargos);
router.get('/tipos-documento', catalogoController.getTiposDocumento);
router.get('/permisos', requireRole('Administrador'), catalogoController.getPermisos);

module.exports = router;
