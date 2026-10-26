const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificacionController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/', controller.getNotificaciones);
router.patch('/leidas', controller.marcarTodasLeidas);
router.patch('/:id/leida', controller.marcarNotificacionLeida);

module.exports = router;