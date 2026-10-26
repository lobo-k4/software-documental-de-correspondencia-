/**
 * Rutas para el Módulo de Derivaciones.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/derivacionController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', requirePermission('DERIVACIONES_VER'), controller.getDerivaciones);
router.post('/', requirePermission('RECIBIDA_DERIVAR'), controller.crearDerivacion);
router.patch('/:id/estado', requirePermission('RECIBIDA_DERIVAR'), controller.cambiarEstadoDerivacion);

module.exports = router;
