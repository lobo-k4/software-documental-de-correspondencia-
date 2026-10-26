/**
 * Suite D) Permisos por rol — GET /api/usuarios (exclusivo Administrador)
 * - Operador → 403 | Administrador → 200
 * Auth y PG mockeados: no toca datos reales.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1,
      username: 'admin_qa',
      id_rol: 1,
      rol_nombre: 'Administrador',
      id_area: 1,
      permisos: []
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

const { query } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

beforeEach(() => {
  jest.clearAllMocks();
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*)')) return { rows: [{ total: '0' }] };
    return { rows: [] };
  });
});

describe('D) Permisos por rol — GET /api/usuarios', () => {
  test("Operador NO puede acceder a ruta de Administrador → 403", async () => {
    global.__TEST_USER__ = {
      id_usuario: 2,
      username: 'operador_qa',
      id_rol: 2,
      rol_nombre: 'Operador',
      id_area: 1,
      permisos: ['RECIBIDA_VER']
    };
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Administrador SÍ puede acceder a ruta de Administrador → 200', async () => {
    global.__TEST_USER__ = {
      id_usuario: 1,
      username: 'admin_qa',
      id_rol: 1,
      rol_nombre: 'Administrador',
      id_area: 1,
      permisos: ['USUARIOS_VER']
    };
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
