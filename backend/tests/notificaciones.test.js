/**
 * Suite Notificaciones — GET /api/notificaciones, PATCH leidas y :id/leida.
 * 200 éxito, 404 ajena/inexistente, 500 fallo BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1, permisos: []
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
  global.__TEST_USER__ = { id_usuario: 1, username: 'op_qa', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
  query.mockImplementation(async (text) => {
    const t = text.replace(/\s+/g, ' ');
    if (t.includes('INSERT INTO notificaciones')) return { rows: [] }; // crearAvisosPendientes
    if (t.includes('COUNT(*)::INT AS total')) return { rows: [{ total: 2 }] };
    if (t.includes('UPDATE notificaciones')) return { rows: [{ id_notificacion: 5, leida_en: '2026-01-01' }] };
    if (t.includes('FROM notificaciones WHERE id_usuario_destino')) {
      return { rows: [{ id_notificacion: 1, titulo: 'Aviso' }] };
    }
    return { rows: [] };
  });
});

describe('Notificaciones', () => {
  test('GET → 200 con lista y no_leidas', async () => {
    const res = await request(app).get('/api/notificaciones');
    expect(res.status).toBe(200);
    expect(res.body.data.no_leidas).toBe(2);
    expect(res.body.data.notificaciones).toHaveLength(1);
  });

  test('PATCH leidas → 200', async () => {
    const res = await request(app).patch('/api/notificaciones/leidas');
    expect(res.status).toBe(200);
  });

  test('PATCH :id/leida existente → 200', async () => {
    const res = await request(app).patch('/api/notificaciones/5/leida');
    expect(res.status).toBe(200);
    expect(res.body.data.id_notificacion).toBe(5);
  });

  test('PATCH :id/leida ajena → 404', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('INSERT INTO notificaciones')) return { rows: [] };
      if (text.includes('UPDATE notificaciones')) return { rows: [] };
      return { rows: [] };
    });
    expect((await request(app).patch('/api/notificaciones/99/leida')).status).toBe(404);
  });

  test('Fallo BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/notificaciones')).status).toBe(500);
  });
});
