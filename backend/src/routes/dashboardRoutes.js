/**
 * Rutas para el Dashboard y Métricas.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/metricas', controller.getMetricasDashboard);

module.exports = router;
