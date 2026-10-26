/**
 * Suite Scanner (rutas) — servicio mockeado.
 * 200 éxito, 400 validación, 403 permiso, 500 fallo servicio.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1, permisos: ['RECIBIDA_CREAR']
    };
    return next();
  });
  return mock;
});

jest.mock('../src/services/scannerService', () => ({
  getScannerDevices: jest.fn(),
  getScannerCapabilities: jest.fn(),
  scanWithWia: jest.fn()
}));

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn(), query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true)
}));

const scanner = require('../src/services/scannerService');
const request = require('supertest');
const app = require('../src/app');

const DEV = [{ id: 'dev1', nombre: 'Epson X', fabricante: 'Epson' }];
const CAPS = { tamanoPapel: [], resoluciones: [300], modosColor: [], alimentador: true, dobleCara: false };

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { id_usuario: 1, username: 'op_qa', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: ['RECIBIDA_CREAR'] };
});

describe('Scanner rutas', () => {
  test('GET devices → 200 con disponibilidad', async () => {
    scanner.getScannerDevices.mockResolvedValue(DEV);
    const res = await request(app).get('/api/scanner/devices');
    expect(res.status).toBe(200);
    expect(res.body.data.disponible).toBe(true);
  });

  test('GET devices con fallo → 500', async () => {
    scanner.getScannerDevices.mockRejectedValue(new Error('WIA roto'));
    expect((await request(app).get('/api/scanner/devices')).status).toBe(500);
  });

  test('GET capabilities conocido → 200 y desconocido → 400', async () => {
    scanner.getScannerDevices.mockResolvedValue(DEV);
    scanner.getScannerCapabilities.mockResolvedValue(CAPS);
    expect((await request(app).get('/api/scanner/devices/dev1/capabilities')).status).toBe(200);
    expect((await request(app).get('/api/scanner/devices/otro/capabilities')).status).toBe(400);
  });

  test('GET capabilities con fallo servicio → 500', async () => {
    scanner.getScannerDevices.mockResolvedValue(DEV);
    scanner.getScannerCapabilities.mockRejectedValue(new Error('x'));
    expect((await request(app).get('/api/scanner/devices/dev1/capabilities')).status).toBe(500);
  });

  test('POST scan válido → 200', async () => {
    scanner.getScannerDevices.mockResolvedValue(DEV);
    scanner.scanWithWia.mockResolvedValue([{ id: 'p1', ancho: 100, alto: 200, imagen: 'abc' }]);
    const res = await request(app).post('/api/scanner/scan').send({ deviceId: 'dev1', options: { dpi: 300 } });
    expect(res.status).toBe(200);
    expect(res.body.data.paginas).toHaveLength(1);
  });

  test('POST scan sin deviceId y con options inválidas → 400', async () => {
    expect((await request(app).post('/api/scanner/scan').send({})).status).toBe(400);
    expect((await request(app).post('/api/scanner/scan').send({ deviceId: 'dev1', options: [] })).status).toBe(400);
  });

  test('POST scan sin dispositivos y con ID desconocido → 400', async () => {
    scanner.getScannerDevices.mockResolvedValue([]);
    expect((await request(app).post('/api/scanner/scan').send({ deviceId: 'dev1' })).status).toBe(400);
    scanner.getScannerDevices.mockResolvedValue(DEV);
    expect((await request(app).post('/api/scanner/scan').send({ deviceId: 'xxx' })).status).toBe(400);
  });

  test('POST scan error WIA validación → 400 y genérico → 500', async () => {
    scanner.getScannerDevices.mockResolvedValue(DEV);
    scanner.scanWithWia.mockRejectedValue(new Error('El escáner seleccionado no admite el tamaño'));
    const r1 = await request(app).post('/api/scanner/scan').send({ deviceId: 'dev1' });
    expect(r1.status).toBe(400);
    scanner.scanWithWia.mockRejectedValue(new Error('fallo raro'));
    expect((await request(app).post('/api/scanner/scan').send({ deviceId: 'dev1' })).status).toBe(500);
  });

  test('POST scan fallo al listar dispositivos → 500', async () => {
    scanner.getScannerDevices.mockRejectedValue(new Error('WIA roto'));
    expect((await request(app).post('/api/scanner/scan').send({ deviceId: 'dev1' })).status).toBe(500);
  });

  test('Sin permiso de creación → 403', async () => {
    global.__TEST_USER__ = { id_usuario: 3, username: 's', id_rol: 3, rol_nombre: 'Secretaria', id_area: 1, permisos: [] };
    expect((await request(app).get('/api/scanner/devices')).status).toBe(403);
  });
});
