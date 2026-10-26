/**
 * Rutas para el Módulo de Autenticación y Seguridad.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/authMiddleware');
const profilePhotoUpload = require('../middleware/profilePhotoUpload');

// Limitar intentos de login: 5 por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.'
    });
  }
});

// Rutas públicas
router.post('/login', loginLimiter, authController.login);

// Rutas protegidas por token JWT
router.get('/me', authenticateToken, authController.getPerfil);
router.post('/foto-perfil', authenticateToken, profilePhotoUpload.single('foto'), authController.actualizarFotoPerfil);
router.put('/cambiar-password', authenticateToken, authController.cambiarPassword);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
