/**
 * Suite Robustez — regresión de los 5 FAIL + 1 WARNING de la auditoría QA.
 * Entradas malformadas → 400/404 JSON, nunca 500/HTML.
 * Auth y PG mockeados: no toca datos reales.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'admin_qa', id_rol: 1,
      rol_nombre: 'Administrador', id_area: 1,
      permisos: ['RECIBIDA_VER', 'RECIBIDA_CREAR', 'ENTREGADA_EDITAR', 'ARCHIVO_SUBIR']
    };
    return next();
  });
  return mock;
});

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn(), query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true)
}));
jest.mock('../src/services/notificacionService', () => ({
  crearNotificacion: jest.fn().mockResolvedValue(true),
  crearAvisosPendientes: jest.fn().mockResolvedValue(true)
}));

const { query, getClient } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const hoy = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = {
    id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador',
    id_area: 1, permisos: ['RECIBIDA_VER', 'RECIBIDA_CREAR', 'ENTREGADA_EDITAR', 'ARCHIVO_SUBIR']
  };
  // Cliente transaccional dummy (crearCorrespondencia adquiere cliente antes de validar)
  getClient.mockResolvedValue({ query: jest.fn(async () => ({ rows: [] })), release: jest.fn() });
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total')) return { rows: [{ total: '0' }] };
    if (text.includes('FROM correspondencia_recibida cr')) return { rows: [] };
    return { rows: [] };
  });
});

describe('Robustez auditoría QA', () => {
  test('F1: pagina=abc → 400 (no 500)', async () => {
    const res = await request(app).get('/api/correspondencia-recibida?pagina=abc');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('F1: limite=xyz → 400 y limite=1000 válido → 200 recortado', async () => {
    expect((await request(app).get('/api/correspondencia-recibida?limite=xyz')).status).toBe(400);
    const res = await request(app).get('/api/correspondencia-recibida?limite=1000');
    expect(res.status).toBe(200);
    expect(res.body.data.paginacion.limite).toBe(100);
  });

  test('F2: PUT entregada vacía → 400 (no 500)', async () => {
    const res = await request(app).put('/api/correspondencia-entregada/1').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('F3: .exe directo → 400 Tipo de archivo no permitido (no 500)', async () => {
    const res = await request(app)
      .post('/api/correspondencia-recibida/1/adjuntos')
      .attach('archivo', Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'virus.exe');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tipo de archivo no permitido/);
  });

  test('F4: GET usuarios/abc → 404 (no 500)', async () => {
    const res = await request(app).get('/api/usuarios/abc');
    expect(res.status).toBe(404);
  });

  test('F5: hora_recepcion 25:00 → 400 (no 500)', async () => {
    const res = await request(app).post('/api/correspondencia-recibida').send({
      remitente: 'R', id_tipo_doc: 1, asunto: 'A', destinatario: 'D',
      id_area_responsable: 1, cargo_responsable: 'C', fecha_recepcion: hoy(), hora_recepcion: '25:00'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('W1: ruta inexistente → 404 JSON Ruta no encontrada (no HTML)', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Ruta no encontrada' });
  });
});
