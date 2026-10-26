/**
 * Rutas para el Generador y Emisión de Notas Oficiales.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/notaController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission, requireRole } = require('../middleware/roleMiddleware');

router.get('/verificar/:id', controller.verificarNota);

router.use(authenticateToken);

router.post('/previsualizar', requirePermission('NOTAS_CREAR'), controller.previsualizarNota);
router.post('/generar', requirePermission('NOTAS_CREAR'), controller.generarNota);
router.get('/:id/pdf', requirePermission('NOTAS_VER'), controller.descargarPdfNota);
router.get('/:id/docx', requirePermission('NOTAS_VER'), controller.descargarWordNota);
router.post('/:id/registrar-entregada', requirePermission('ENTREGADA_CREAR'), controller.registrarNotaComoEntregada);
router.get('/:id/configuracion-qr', requirePermission('NOTAS_VER'), controller.getLimiteVerificacionesNota);
router.put('/:id/configuracion-qr', requireRole('Administrador'), controller.actualizarLimiteVerificacionesNota);
router.get('/', requirePermission('NOTAS_VER'), controller.getNotas);
router.get('/:id', requirePermission('NOTAS_VER'), controller.getNotaById);

module.exports = router;
