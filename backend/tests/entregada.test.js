/**
 * Suite Correspondencia Entregada — CRUD + estado + anulación + adjuntos.
 * 200/201 éxito, 400 validación, 403 permiso/rol, 404 inexistente, 500 BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'admin_qa', id_rol: 1,
      rol_nombre: 'Administrador', id_area: 1,
      permisos: ['ENTREGADA_VER', 'ENTREGADA_CREAR', 'ENTREGADA_EDITAR', 'ARCHIVO_SUBIR']
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
jest.mock('../src/services/codigoCorrelativoService', () => ({
  generarCodigoCorrelativo: jest.fn().mockResolvedValue('COR-ENT-2026-00007')
}));

const { query, getClient } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const ADMIN = {
  id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador',
  id_area: 1, permisos: ['ENTREGADA_VER', 'ENTREGADA_CREAR', 'ENTREGADA_EDITAR', 'ARCHIVO_SUBIR']
};
const SIN_PERMISO = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };

const cuerpoValido = () => ({
  numero_nota: 'CITE-007',
  destinatario: 'Juan Pérez',
  asunto: 'Respuesta QA',
  id_tipo_doc: 1,
  id_area_remitente: 1,
  responsable_remitente: 'Jefe de Archivo',
  medio_entrega: 'Mensajería'
});

const mockTx = (insertRow) => {
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    if (text.includes('INSERT INTO correspondencia_entregada')) {
      return { rows: [insertRow || { id_entregada: 11, codigo: 'COR-ENT-2026-00007', estado: 'Emitido' }] };
    }
    if (text.includes('SELECT codigo')) return { rows: [{ codigo: 'COR-ENT-2026-00007', estado: 'Emitido', id_area_remitente: 1 }] };
    if (text.includes('SELECT codigo, estado FROM')) return { rows: [{ codigo: 'COR-ENT-2026-00007', estado: 'Emitido' }] };
    if (text.includes('INSERT INTO documentos_adjuntos')) return { rows: [{ id_documento: 3 }] };
    if (text.includes('INSERT INTO seguimientos')) return { rows: [] };
    if (text.includes('UPDATE correspondencia_entregada')) return { rows: [] };
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...ADMIN };
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total')) return { rows: [{ total: '4' }] };
    if (text.includes('FROM correspondencia_entregada ce')) {
      if (text.includes('WHERE ce.id_entregada')) return { rows: [{ id_entregada: 1, codigo: 'COR-ENT-1' }] };
      return { rows: [{ id_entregada: 1, codigo: 'COR-ENT-1' }] };
    }
    if (text.includes('FROM documentos_adjuntos da')) return { rows: [] };
    if (text.includes('FROM seguimientos s')) return { rows: [] };
    if (text.includes('SELECT codigo FROM correspondencia_entregada')) return { rows: [{ codigo: 'COR-ENT-1' }] };
    if (text.includes('UPDATE correspondencia_entregada SET')) return { rows: [{ id_entregada: 1, codigo: 'COR-ENT-1' }] };
    return { rows: [] };
  });
  mockTx();
});

describe('Correspondencia Entregada', () => {
  test('GET listado → 200', async () => {
    const res = await request(app).get('/api/correspondencia-entregada');
    expect(res.status).toBe(200);
    expect(res.body.data.paginacion.total).toBe(4);
  });

  test('GET :id → 200 y 404', async () => {
    expect((await request(app).get('/api/correspondencia-entregada/1')).status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/correspondencia-entregada/99')).status).toBe(404);
  });

  test('GET sin permiso → 403', async () => {
    global.__TEST_USER__ = { ...SIN_PERMISO };
    expect((await request(app).get('/api/correspondencia-entregada')).status).toBe(403);
  });

  test('POST válida → 201', async () => {
    const res = await request(app).post('/api/correspondencia-entregada').send(cuerpoValido());
    expect(res.status).toBe(201);
    expect(res.body.data.codigo).toBe('COR-ENT-2026-00007');
  });

  test('POST sin campos → 400 y medio inválido → 400', async () => {
    expect((await request(app).post('/api/correspondencia-entregada').send({})).status).toBe(400);
    expect((await request(app).post('/api/correspondencia-entregada').send({ ...cuerpoValido(), medio_entrega: 'Teleport' })).status).toBe(400);
  });

  test('PUT :id → 200 y 404', async () => {
    const res = await request(app).put('/api/correspondencia-entregada/1').send({
      numero_nota: 'CITE-1', destinatario: 'A', institucion_destinatario: null, cargo_destinatario: null,
      asunto: 'As', id_tipo_doc: 1, id_area_remitente: 1, responsable_remitente: 'Jefe',
      medio_entrega: 'Otro', observaciones: null
    });
    expect(res.status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).put('/api/correspondencia-entregada/99').send({
      numero_nota: 'C', destinatario: 'D', asunto: 'A', id_tipo_doc: 1,
      id_area_remitente: 1, responsable_remitente: 'R', medio_entrega: 'Otro'
    })).status).toBe(404);
  });

  test('PATCH anular como Admin → 200, sin motivo → 400', async () => {
    const res = await request(app).patch('/api/correspondencia-entregada/1/anular').send({ motivo_anulacion: 'Duplicado' });
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('ANULADO');
    expect((await request(app).patch('/api/correspondencia-entregada/1/anular').send({})).status).toBe(400);
  });

  test('PATCH anular como Operador → 403', async () => {
    global.__TEST_USER__ = { ...SIN_PERMISO, rol_nombre: 'Operador' };
    expect((await request(app).patch('/api/correspondencia-entregada/1/anular').send({ motivo_anulacion: 'x' })).status).toBe(403);
  });

  test('PATCH estado válido → 200 e inválido → 400', async () => {
    expect((await request(app).patch('/api/correspondencia-entregada/1/estado').send({ nuevo_estado: 'Entregado' })).status).toBe(200);
    expect((await request(app).patch('/api/correspondencia-entregada/1/estado').send({ nuevo_estado: 'Volando' })).status).toBe(400);
  });

  test('POST adjuntos con PDF real → 201 y sin archivo → 400', async () => {
    const pdf = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), Buffer.from('contenido qa')]);
    const res = await request(app).post('/api/correspondencia-entregada/1/adjuntos').attach('archivo', pdf, 'respaldo.pdf');
    expect(res.status).toBe(201);
    expect((await request(app).post('/api/correspondencia-entregada/1/adjuntos')).status).toBe(400);
  });

  test('Fallo BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/correspondencia-entregada')).status).toBe(500);
  });
});
