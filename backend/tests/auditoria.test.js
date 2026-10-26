/**
 * Suite Auditoría — GET /api/auditoria (solo Administrador).
 * 200 con/sin filtros, 403 rol, 500 fallo BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'admin_qa', id_rol: 1,
      rol_nombre: 'Administrador', id_area: 1, permisos: []
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
  global.__TEST_USER__ = { id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador', id_area: 1, permisos: [] };
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total FROM auditoria')) return { rows: [{ total: '3' }] };
    if (text.includes('FROM auditoria a')) {
      return { rows: [{ id_auditoria: 1, username: 'admin_qa', accion: 'LOGIN', modulo: 'Auth' }] };
    }
    return { rows: [] };
  });
});

describe('Auditoría', () => {
  test('GET sin filtros → 200 con paginación', async () => {
    const res = await request(app).get('/api/auditoria');
    expect(res.status).toBe(200);
    expect(res.body.data.paginacion.total).toBe(3);
    expect(res.body.data.registros).toHaveLength(1);
  });

  test('GET con filtros → 200', async () => {
    const res = await request(app).get('/api/auditoria?username=admin&accion=LOGIN&modulo=Auth&fecha_inicio=2026-01-01&fecha_fin=2026-12-31');
    expect(res.status).toBe(200);
  });

  test('GET como Operador → 403', async () => {
    global.__TEST_USER__ = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
    expect((await request(app).get('/api/auditoria')).status).toBe(403);
  });

  test('Fallo BD → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/auditoria')).status).toBe(500);
  });
});
