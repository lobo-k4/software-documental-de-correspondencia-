/**
 * Suite Catálogos + info API — GET /api/catalogos/* y GET /api/.
 * 200 éxito, 403 en ruta de Administrador, 500 ante fallo BD.
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
  query.mockImplementation(async (text, params = []) => {
    if (text.includes('FROM roles')) return { rows: [{ id_rol: 1, nombre: 'Administrador' }] };
    if (text.includes('FROM areas')) return { rows: [{ id_area: 1, nombre: 'Sistemas' }] };
    if (text.includes('FROM cargos')) return { rows: params.length ? [{ id_cargo: 1, id_area: 1 }] : [{ id_cargo: 1 }, { id_cargo: 2 }] };
    if (text.includes('FROM tipos_documento')) return { rows: [{ id_tipo_doc: 1, nombre: 'Nota' }] };
    if (text.includes('FROM permisos')) return { rows: [{ id_permiso: 1, codigo: 'X' }] };
    return { rows: [] };
  });
});

describe('Catálogos', () => {
  test('GET /api/ info general → 200', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.0.0');
  });

  test('GET roles → 200', async () => {
    const res = await request(app).get('/api/catalogos/roles');
    expect(res.status).toBe(200);
    expect(res.body.data[0].nombre).toBe('Administrador');
  });

  test('GET areas → 200', async () => {
    const res = await request(app).get('/api/catalogos/areas');
    expect(res.status).toBe(200);
  });

  test('GET cargos sin filtro y con id_area → 200', async () => {
    expect((await request(app).get('/api/catalogos/cargos')).status).toBe(200);
    const res = await request(app).get('/api/catalogos/cargos?id_area=1');
    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.any(String), [1]);
  });

  test('GET tipos-documento → 200', async () => {
    const res = await request(app).get('/api/catalogos/tipos-documento');
    expect(res.status).toBe(200);
  });

  test('GET permisos como Admin → 200 y como Operador → 403', async () => {
    expect((await request(app).get('/api/catalogos/permisos')).status).toBe(200);
    global.__TEST_USER__ = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
    expect((await request(app).get('/api/catalogos/permisos')).status).toBe(403);
  });

  test('Fallo BD en roles → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/catalogos/roles')).status).toBe(500);
  });
});
