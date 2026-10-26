/**
 * Rutas para el Módulo de Correspondencia Entregada.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/correspondenciaEntregadaController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission, requireRole } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authenticateToken);

router.get('/', requirePermission('ENTREGADA_VER'), controller.getCorrespondenciaEntregada);
router.get('/:id', requirePermission('ENTREGADA_VER'), controller.getCorrespondenciaEntregadaById);
router.post('/', requirePermission('ENTREGADA_CREAR'), upload.fields([
	{ name: 'archivo', maxCount: 1 },
	{ name: 'archivo_escaneado', maxCount: 1 }
]), controller.crearCorrespondenciaEntregada);
router.put('/:id', requirePermission('ENTREGADA_EDITAR'), controller.actualizarCorrespondenciaEntregada);
router.patch('/:id/anular', requireRole('Administrador'), controller.anularCorrespondenciaEntregada);
router.patch('/:id/estado', requirePermission('ENTREGADA_EDITAR'), controller.cambiarEstadoCorrespondenciaEntregada);
router.post('/:id/adjuntos', requirePermission('ARCHIVO_SUBIR'), upload.single('archivo'), controller.adjuntarDocumentoEntregada);

module.exports = router;
