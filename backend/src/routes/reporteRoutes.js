/**
 * Rutas para Reportes Administrativos.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/reporteController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission, requireRole } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/recibida', requirePermission('REPORTES_VER'), controller.getReporteRecibida);
router.get('/entregada', requirePermission('REPORTES_VER'), controller.getReporteEntregada);
router.get('/usuarios', requireRole('Administrador'), controller.getReporteUsuarios);

module.exports = router;
