/**
 * Rutas para el Módulo de Archivo Digital.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/documentoController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', controller.getDocumentos);
router.get('/:id/descargar', requirePermission('ARCHIVO_DESCARGAR'), controller.descargarDocumento);
router.delete('/:id', requirePermission('ARCHIVO_ELIMINAR'), controller.eliminarDocumento);

module.exports = router;
