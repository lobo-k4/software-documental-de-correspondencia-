/**
 * Rutas para la Bitácora de Auditoría del Sistema.
 * Exclusivo para el rol Administrador.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditoriaController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', requireRole('Administrador'), controller.getAuditoria);

module.exports = router;
