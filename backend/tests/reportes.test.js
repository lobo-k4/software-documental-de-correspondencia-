/**
 * Suite Reportes — GET /api/reportes/{recibida,entregada,usuarios}.
 * 200 éxito, 403 permiso/rol, 500 fallo BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'admin_qa', id_rol: 1,
      rol_nombre: 'Administrador', id_area: 1, permisos: ['REPORTES_VER']
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

const { query } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador', id_area: 1, permisos: ['REPORTES_VER'] };
  query.mockImplementation(async (text) => {
    if (text.includes('FROM correspondencia_recibida cr')) return { rows: [{ id_recibida: 1, codigo: 'COR-REC-1' }] };
    if (text.includes('FROM correspondencia_entregada ce')) return { rows: [{ id_entregada: 1, codigo: 'COR-ENT-1' }] };
    if (text.includes('FROM usuarios u')) return { rows: [{ id_usuario: 1, username: 'admin_qa' }] };
    return { rows: [] };
  });
});

describe('Reportes', () => {
  test('GET recibida con filtros → 200', async () => {
    const res = await request(app).get('/api/reportes/recibida?estado=Recibido&id_area=1&fecha_inicio=2026-01-01&fecha_fin=2026-12-31');
    expect(res.status).toBe(200);
    expect(res.body.data.total_registros).toBe(1);
  });

  test('GET entregada → 200', async () => {
    const res = await request(app).get('/api/reportes/entregada?medio_entrega=Mensajería');
    expect(res.status).toBe(200);
    expect(res.body.data.datos).toHaveLength(1);
  });

  test('GET usuarios como Admin → 200', async () => {
    const res = await request(app).get('/api/reportes/usuarios');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET recibida sin permiso → 403', async () => {
    global.__TEST_USER__ = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
    expect((await request(app).get('/api/reportes/recibida')).status).toBe(403);
  });

  test('GET usuarios como Operador → 403', async () => {
    global.__TEST_USER__ = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: ['REPORTES_VER'] };
    expect((await request(app).get('/api/reportes/usuarios')).status).toBe(403);
  });

  test('Fallo BD → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/reportes/recibida')).status).toBe(500);
  });
});
