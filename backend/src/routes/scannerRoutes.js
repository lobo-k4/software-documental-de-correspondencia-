const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');
const { forbidden, badRequest, success, serverError } = require('../utils/responseHelper');
const { getScannerDevices, getScannerCapabilities, scanWithWia } = require('../services/scannerService');

const router = express.Router();
const canCreateCorrespondence = (req, res, next) => {
  const permissions = req.user?.permisos || [];
  if (req.user?.rol_nombre === 'Administrador'
    || permissions.includes('RECIBIDA_CREAR')
    || permissions.includes('ENTREGADA_CREAR')) {
    return next();
  }
  return forbidden(res, 'Se requiere permiso para registrar correspondencia recibida o entregada.');
};

const requireLocalBridge = (req, res, next) => {
  const address = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (address !== '127.0.0.1' && address !== '::1') {
    return forbidden(res, 'El escáner solo puede controlarse desde el equipo donde está instalado el puente local.');
  }
  next();
};

router.use(authenticateToken, canCreateCorrespondence, requireLocalBridge);

router.get('/devices', async (req, res) => {
  try {
    const dispositivos = await getScannerDevices();
    return success(res, { dispositivos, disponible: dispositivos.length > 0 }, 'Dispositivos WIA consultados.');
  } catch (error) {
    return serverError(res, 'No se pudo consultar los escáneres disponibles en Windows.', error);
  }
});

router.get('/devices/:id/capabilities', async (req, res) => {
  try {
    const dispositivos = await getScannerDevices();
    if (!dispositivos.some(device => device.id === req.params.id)) {
      return badRequest(res, 'El escáner seleccionado no está disponible. Vuelva a detectarlo.');
    }
    const capabilities = await getScannerCapabilities(req.params.id);
    return success(res, capabilities, 'Capacidades del escáner consultadas.');
  } catch (error) {
    return serverError(res, 'No se pudieron consultar las capacidades del escáner.', error);
  }
});

router.post('/scan', async (req, res) => {
  const { deviceId, options = {} } = req.body || {};
  if (typeof deviceId !== 'string' || !deviceId.trim()) {
    return badRequest(res, 'Seleccione un escáner disponible.');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return badRequest(res, 'La configuración del escaneo no es válida.');
  }

  let dispositivos;
  try {
    dispositivos = await getScannerDevices();
  } catch (error) {
    return serverError(res, 'No se pudo consultar los escáneres disponibles en Windows.', error);
  }
  if (dispositivos.length === 0) {
    return badRequest(res, 'No se detectaron escáneres disponibles. Verifique la conexión y los controladores WIA.');
  }
  if (!dispositivos.some(device => device.id === deviceId)) {
    return badRequest(res, 'El escáner seleccionado no está disponible. Vuelva a detectarlo.');
  }

  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  try {
    const paginas = await scanWithWia(deviceId, options, controller.signal);
    if (!res.writableEnded) return success(res, { paginas }, 'Escaneo completado.');
  } catch (error) {
    if (controller.signal.aborted) return;
    if (/no está disponible|no informa|no permite|no devolvió|no admite/i.test(error.message)) {
      return badRequest(res, error.message);
    }
    return serverError(res, 'Se produjo un error durante el escaneo.', error);
  }
});

module.exports = router;