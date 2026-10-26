/**
 * Rutas para el Módulo de Seguimiento y Trazabilidad (Timeline).
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/seguimientoController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', requirePermission('SEGUIMIENTO_VER'), controller.getSeguimiento);
router.post('/', requirePermission('SEGUIMIENTO_VER'), controller.agregarHitoManual);

module.exports = router;
