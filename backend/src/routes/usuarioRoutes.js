/**
 * Rutas de Gestión de Usuarios y Control de Acceso.
 * Protegidas mediante autenticación JWT y control estricto de roles.
 */
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/roleMiddleware');

// Todas las rutas requieren sesión activa
router.use(authenticateToken);

// El directorio de usuarios y todas sus operaciones son exclusivos del Administrador.
router.get('/', requireRole('Administrador'), usuarioController.getUsuarios);
router.get('/:id', requireRole('Administrador'), usuarioController.getUsuarioById);
router.post('/', requireRole('Administrador'), usuarioController.crearUsuario);
router.put('/:id', requireRole('Administrador'), usuarioController.actualizarUsuario);
router.delete('/:id', requireRole('Administrador'), usuarioController.eliminarUsuario);
router.patch('/:id/estado', requireRole('Administrador'), usuarioController.cambiarEstadoUsuario);
router.put('/:id/restablecer-password', requireRole('Administrador'), usuarioController.restablecerPassword);

module.exports = router;
