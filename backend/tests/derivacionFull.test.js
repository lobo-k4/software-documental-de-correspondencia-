/**
 * Suite Derivación (cobertura total) — GET listado y PATCH aceptar.
 * 200 éxito, 400 validación/transición, 403 área/permiso, 404 inexistente.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1, permisos: ['RECIBIDA_DERIVAR', 'DERIVACIONES_VER']
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

const USER = { id_usuario: 1, username: 'op_qa', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: ['RECIBIDA_DERIVAR', 'DERIVACIONES_VER'] };

const mockTx = (derivRow) => {
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    if (text.includes('FROM derivaciones d')) return { rows: derivRow ? [derivRow] : [] };
    if (text.includes('UPDATE derivaciones SET')) return { rows: [] };
    if (text.includes('UPDATE correspondencia_recibida SET')) return { rows: [] };
    if (text.includes('INSERT INTO seguimientos')) return { rows: [] };
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...USER };
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total')) return { rows: [{ total: '2' }] };
    if (text.includes('FROM correspondencia_recibida cr')) {
      return { rows: [{ id_derivacion: 1, correspondencia_codigo: 'COR-REC-1' }] };
    }
    return { rows: [] };
  });
  mockTx({
    id_derivacion: 10, id_recibida: 99, id_area_origen: 2, id_area_destino: 1,
    id_usuario_derivo: 5, estado_derivacion: 'Pendiente', codigo: 'COR-REC-1',
    estado_actual: 'Derivado', area_destino_nombre: 'Sistemas'
  });
});

describe('Derivación cobertura total', () => {
  test('GET listado con filtros → 200', async () => {
    const res = await request(app).get('/api/derivaciones?id_recibida=99&estado_derivacion=Pendiente&busqueda=COR');
    expect(res.status).toBe(200);
    expect(res.body.data.paginacion.total).toBe(2);
  });

  test('PATCH aceptar Pendiente → 200', async () => {
    const res = await request(app).patch('/api/derivaciones/10/estado').send({ estado_derivacion: 'Aceptado' });
    expect(res.status).toBe(200);
    expect(res.body.data.estado_derivacion).toBe('Aceptado');
  });

  test('PATCH estado inválido → 400 y derivación inexistente → 404', async () => {
    expect((await request(app).patch('/api/derivaciones/10/estado').send({ estado_derivacion: '???' })).status).toBe(400);
    mockTx(null);
    expect((await request(app).patch('/api/derivaciones/10/estado').send({ estado_derivacion: 'Aceptado' })).status).toBe(404);
  });

  test('PATCH desde área no destino → 403', async () => {
    mockTx({
      id_derivacion: 10, id_recibida: 99, id_area_origen: 1, id_area_destino: 2,
      id_usuario_derivo: 5, estado_derivacion: 'Pendiente', codigo: 'C',
      estado_actual: 'Derivado', area_destino_nombre: 'Archivo'
    });
    expect((await request(app).patch('/api/derivaciones/10/estado').send({ estado_derivacion: 'Aceptado' })).status).toBe(403);
  });

  test('GET sin permiso → 403 y fallo BD → 500', async () => {
    global.__TEST_USER__ = { ...USER, permisos: [] };
    expect((await request(app).get('/api/derivaciones')).status).toBe(403);
    global.__TEST_USER__ = { ...USER };
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/derivaciones')).status).toBe(500);
  });
});
