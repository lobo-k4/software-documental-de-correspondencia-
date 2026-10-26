/**
 * Suite Plantillas — GET/POST/PUT /api/plantillas (lectura libre, escritura Admin).
 * 200/201 éxito, 400 validación/duplicado, 403 rol, 404 inexistente, 500 BD.
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

jest.mock('../src/services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true)
}));

const { query } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const ADMIN = { id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador', id_area: 1, permisos: [] };
const OPERADOR = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
const FILA = { id_plantilla: 1, codigo: 'TPL-QA', titulo: 'Plantilla QA', tipo: 'Nota' };

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...ADMIN };
  query.mockImplementation(async (text) => {
    if (text.includes('WHERE codigo = $1')) return { rows: [] };
    if (text.includes('INSERT INTO plantillas_notas')) return { rows: [{ ...FILA }] };
    if (text.includes('SELECT codigo FROM plantillas_notas')) return { rows: [{ codigo: 'TPL-QA' }] };
    if (text.includes('UPDATE plantillas_notas')) return { rows: [{ ...FILA, titulo: 'Nueva' }] };
    if (text.includes('FROM plantillas_notas p')) return { rows: [{ ...FILA }] };
    return { rows: [] };
  });
});

describe('Plantillas', () => {
  test('GET listado con filtros → 200', async () => {
    const res = await request(app).get('/api/plantillas?tipo=Nota&activo=true');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('GET :id → 200 y 404', async () => {
    expect((await request(app).get('/api/plantillas/1')).status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/plantillas/99')).status).toBe(404);
  });

  test('POST válida → 201', async () => {
    const res = await request(app).post('/api/plantillas').send({
      codigo: 'tpl-qa', titulo: 'Plantilla QA', tipo: 'Nota', cuerpo_plantilla: 'Hola {{nombre}}'
    });
    expect(res.status).toBe(201);
  });

  test('POST sin campos → 400', async () => {
    expect((await request(app).post('/api/plantillas').send({ codigo: 'x' })).status).toBe(400);
  });

  test('POST código duplicado → 400', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('WHERE codigo = $1')) return { rows: [{ id_plantilla: 1 }] };
      return { rows: [] };
    });
    const res = await request(app).post('/api/plantillas').send({
      codigo: 'TPL-QA', titulo: 'T', tipo: 'Nota', cuerpo_plantilla: 'C'
    });
    expect(res.status).toBe(400);
  });

  test('POST como Operador → 403', async () => {
    global.__TEST_USER__ = { ...OPERADOR };
    expect((await request(app).post('/api/plantillas').send({})).status).toBe(403);
  });

  test('PUT :id → 200 y 404', async () => {
    expect((await request(app).put('/api/plantillas/1').send({ titulo: 'Nueva' })).status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).put('/api/plantillas/99').send({ titulo: 'X' })).status).toBe(404);
  });

  test('PUT como Operador → 403', async () => {
    global.__TEST_USER__ = { ...OPERADOR };
    expect((await request(app).put('/api/plantillas/1').send({})).status).toBe(403);
  });

  test('Fallo BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/plantillas')).status).toBe(500);
  });
});
