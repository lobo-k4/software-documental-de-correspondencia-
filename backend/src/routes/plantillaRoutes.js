/**
 * Rutas para Administración de Plantillas de Notas.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/plantillaController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', controller.getPlantillas);
router.get('/:id', controller.getPlantillaById);
router.post('/', requireRole('Administrador'), controller.crearPlantilla);
router.put('/:id', requireRole('Administrador'), controller.actualizarPlantilla);

module.exports = router;
