/**
 * Rutas para el Módulo de Correspondencia Recibida.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/correspondenciaRecibidaController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission, requireRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

router.get('/', requirePermission('RECIBIDA_VER'), controller.getCorrespondenciaRecibida);
router.get('/:id', requirePermission('RECIBIDA_VER'), controller.getCorrespondenciaRecibidaById);
router.post('/', requirePermission('RECIBIDA_CREAR'), upload.fields([
	{ name: 'archivo', maxCount: 1 },
	{ name: 'archivo_escaneado', maxCount: 1 }
]), controller.crearCorrespondenciaRecibida);
router.put('/:id', requirePermission('RECIBIDA_EDITAR'), controller.actualizarCorrespondenciaRecibida);
router.patch('/:id/anular', requireRole('Administrador'), controller.anularCorrespondenciaRecibida);
router.patch('/:id/estado', requirePermission('RECIBIDA_ESTADO'), controller.cambiarEstadoCorrespondenciaRecibida);
router.post('/:id/adjuntos', requirePermission('ARCHIVO_SUBIR'), upload.single('archivo'), controller.adjuntarDocumento);

module.exports = router;
