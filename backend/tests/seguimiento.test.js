/**
 * Suite Seguimiento — GET timeline y POST hito manual.
 * 200/201 éxito, 400 validación, 403 permiso, 404 inexistente, 500 BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1, permisos: ['SEGUIMIENTO_VER']
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

const CON_PERMISO = { id_usuario: 1, username: 'op_qa', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: ['SEGUIMIENTO_VER'] };
const SIN_PERMISO = { id_usuario: 2, username: 's', id_rol: 3, rol_nombre: 'Secretaria', id_area: 1, permisos: [] };

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...CON_PERMISO };
  query.mockImplementation(async (text) => {
    const t = text.replace(/\s+/g, ' ');
    if (t.includes('WHERE cr.codigo =')) {
      return { rows: [{ id_recibida: 5, codigo: 'COR-REC-2026-00001', asunto: 'A' }] };
    }
    if (t.includes('WHERE ce.codigo =')) {
      return { rows: [{ id_entregada: 6, codigo: 'COR-ENT-2026-00001', asunto: 'B' }] };
    }
    if (t.includes('WHERE cr.id_recibida =')) {
      return { rows: [{ id_recibida: 5, codigo: 'COR-REC-2026-00001', asunto: 'A' }] };
    }
    if (t.includes('WHERE ce.id_entregada =')) {
      return { rows: [{ id_entregada: 6, codigo: 'COR-ENT-2026-00001', asunto: 'B' }] };
    }
    if (t.includes('WHERE s.id_recibida =') || t.includes('WHERE s.id_entregada =')) {
      return { rows: [{ id_seguimiento: 1, accion: 'REGISTRO_INICIAL' }] };
    }
    if (t.includes('SELECT codigo, estado FROM correspondencia_recibida')) {
      return { rows: [{ codigo: 'COR-REC-1', estado: 'Recibido' }] };
    }
    if (t.includes('SELECT codigo, estado FROM correspondencia_entregada')) {
      return { rows: [{ codigo: 'COR-ENT-1', estado: 'Emitido' }] };
    }
    if (t.includes('INSERT INTO seguimientos')) {
      return { rows: [{ id_seguimiento: 9, accion: 'OBSERVACION_MANUAL' }] };
    }
    return { rows: [] };
  });
});

describe('Seguimiento', () => {
  test('GET sin parámetros → 400', async () => {
    expect((await request(app).get('/api/seguimientos')).status).toBe(400);
  });

  test('GET por código REC → 200 con timeline', async () => {
    const res = await request(app).get('/api/seguimientos?codigo=COR-REC-2026-00001');
    expect(res.status).toBe(200);
    expect(res.body.data.total_hitos).toBe(1);
  });

  test('GET por código ENT → 200', async () => {
    expect((await request(app).get('/api/seguimientos?codigo=COR-ENT-2026-00001')).status).toBe(200);
  });

  test('GET por id_recibida e id_entregada → 200', async () => {
    expect((await request(app).get('/api/seguimientos?id_recibida=5')).status).toBe(200);
    expect((await request(app).get('/api/seguimientos?id_entregada=6')).status).toBe(200);
  });

  test('GET código desconocido → 404', async () => {
    query.mockImplementation(async (text) => {
      const t = text.replace(/\s+/g, ' ');
      if (t.includes('WHERE cr.codigo =') || t.includes('WHERE ce.codigo =')) return { rows: [] };
      return { rows: [] };
    });
    expect((await request(app).get('/api/seguimientos?codigo=COR-REC-999')).status).toBe(404);
  });

  test('GET código sin REC/ENT → 404', async () => {
    expect((await request(app).get('/api/seguimientos?codigo=XXX-1')).status).toBe(404);
  });

  test('GET sin permiso → 403', async () => {
    global.__TEST_USER__ = { ...SIN_PERMISO };
    expect((await request(app).get('/api/seguimientos?codigo=COR-REC-1')).status).toBe(403);
  });

  test('POST sin observación → 400', async () => {
    expect((await request(app).post('/api/seguimientos').send({ id_recibida: 5 })).status).toBe(400);
  });

  test('POST documento inexistente → 404', async () => {
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).post('/api/seguimientos').send({ id_recibida: 999, observacion: 'nota' })).status).toBe(404);
  });

  test('POST válido retorna 201 con el hito creado', async () => {
    const res = await request(app).post('/api/seguimientos').send({ id_recibida: 5, observacion: 'Observación manual QA' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accion).toBe('OBSERVACION_MANUAL');
  });

  test('Fallo BD en GET → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/seguimientos?codigo=COR-REC-1')).status).toBe(500);
  });
});
