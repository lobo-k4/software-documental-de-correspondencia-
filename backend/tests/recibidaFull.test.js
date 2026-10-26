/**
 * Suite Recibida (cobertura total) — GET listado/detalle, PUT, anular, estado,
 * adjuntos con PDF real. 200/201 éxito, 400 validación, 403 área/permiso,
 * 404 inexistente, 500 BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'admin_qa', id_rol: 1,
      rol_nombre: 'Administrador', id_area: 1,
      permisos: ['RECIBIDA_VER', 'RECIBIDA_CREAR', 'RECIBIDA_EDITAR', 'RECIBIDA_ESTADO', 'ARCHIVO_SUBIR']
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

const ADMIN = {
  id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador',
  id_area: 1, permisos: ['RECIBIDA_VER', 'RECIBIDA_CREAR', 'RECIBIDA_EDITAR', 'RECIBIDA_ESTADO', 'ARCHIVO_SUBIR']
};
const OPERADOR = { id_usuario: 2, username: 'op', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: ['RECIBIDA_VER'] };

const mockTx = (handlers) => {
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    for (const [clave, filas] of Object.entries(handlers)) {
      if (text.includes(clave)) return { rows: filas };
    }
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...ADMIN };
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total FROM correspondencia_recibida')) return { rows: [{ total: '8' }] };
    if (text.includes('FROM correspondencia_recibida cr') && text.includes('ORDER BY cr.id_recibida DESC')) {
      return { rows: [{ id_recibida: 1, codigo: 'COR-REC-1' }] };
    }
    if (text.includes('FROM correspondencia_recibida cr') && text.includes('WHERE cr.id_recibida = $1')) {
      return { rows: [{ id_recibida: 1, codigo: 'COR-REC-1' }] };
    }
    if (text.includes('FROM documentos_adjuntos da')) return { rows: [] };
    if (text.includes('FROM derivaciones d')) return { rows: [] };
    if (text.includes('FROM seguimientos s')) return { rows: [] };
    if (text.includes('FROM cargos WHERE')) return { rows: [{ id_cargo: 1 }] };
    if (text.includes('SELECT codigo, id_area_responsable FROM correspondencia_recibida')) {
      return { rows: [{ codigo: 'COR-REC-1', id_area_responsable: 1 }] };
    }
    if (text.includes('UPDATE correspondencia_recibida SET')) return { rows: [{ id_recibida: 1, codigo: 'COR-REC-1' }] };
    return { rows: [] };
  });
  mockTx({});
});

describe('Recibida cobertura total', () => {
  test('GET listado con filtros → 200', async () => {
    const res = await request(app).get('/api/correspondencia-recibida?busqueda=juan&estado=Recibido&prioridad=Alta&fecha_inicio=2026-01-01&fecha_fin=2026-12-31');
    expect(res.status).toBe(200);
    expect(res.body.data.paginacion.total).toBe(8);
  });

  test('GET :id → 200 y 404', async () => {
    expect((await request(app).get('/api/correspondencia-recibida/1')).status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/correspondencia-recibida/99')).status).toBe(404);
  });

  test('PUT :id → 200, cargo ajeno → 400, otra área → 403', async () => {
    const body = {
      numero_nota: 'N', remitente: 'R', institucion_remitente: 'I', id_tipo_doc: 1,
      asunto: 'A', destinatario: 'D', id_area_responsable: 1, cargo_responsable: 'Jefe',
      prioridad: 'Normal', observaciones: null
    };
    expect((await request(app).put('/api/correspondencia-recibida/1').send(body)).status).toBe(200);
    query.mockImplementation(async (text) => {
      if (text.includes('FROM cargos WHERE')) return { rows: [] };
      return { rows: [] };
    });
    expect((await request(app).put('/api/correspondencia-recibida/1').send(body)).status).toBe(400);
    // Admin SÍ puede editar documentos de otra área → 200
    query.mockImplementation(async (text) => {
      if (text.includes('FROM cargos WHERE')) return { rows: [{ id_cargo: 1 }] };
      if (text.includes('SELECT codigo, id_area_responsable')) return { rows: [{ codigo: 'C', id_area_responsable: 2 }] };
      if (text.includes('UPDATE correspondencia_recibida SET')) return { rows: [{ id_recibida: 1, codigo: 'C' }] };
      return { rows: [] };
    });
    expect((await request(app).put('/api/correspondencia-recibida/1').send(body)).status).toBe(200);
    // Operador de otra área sigue restringido → 403
    global.__TEST_USER__ = { ...OPERADOR, permisos: ['RECIBIDA_EDITAR'] };
    expect((await request(app).put('/api/correspondencia-recibida/1').send(body)).status).toBe(403);
    global.__TEST_USER__ = { ...ADMIN };
  });

  test('PATCH anular → 200, sin motivo → 400, Operador → 403', async () => {
    mockTx({
      'FROM correspondencia_recibida WHERE id_recibida': [{ codigo: 'COR-REC-1', estado: 'Recibido', id_area_responsable: 1, cargo_responsable: 'Jefe' }],
      'SET estado = \'ANULADO\'': [],
      'INSERT INTO seguimientos': []
    });
    const res = await request(app).patch('/api/correspondencia-recibida/1/anular').send({ motivo_anulacion: 'Error' });
    expect(res.status).toBe(200);
    expect((await request(app).patch('/api/correspondencia-recibida/1/anular').send({})).status).toBe(400);
    global.__TEST_USER__ = { ...OPERADOR };
    expect((await request(app).patch('/api/correspondencia-recibida/1/anular').send({ motivo_anulacion: 'x' })).status).toBe(403);
  });

  test('PATCH estado → 200, inválido → 400, inexistente → 404', async () => {
    mockTx({
      'FROM correspondencia_recibida WHERE id_recibida': [{ codigo: 'C', estado: 'Recibido', id_area_responsable: 1, cargo_responsable: 'J' }],
      'SET estado = $1': [],
      'INSERT INTO seguimientos': []
    });
    expect((await request(app).patch('/api/correspondencia-recibida/1/estado').send({ nuevo_estado: 'En proceso' })).status).toBe(200);
    expect((await request(app).patch('/api/correspondencia-recibida/1/estado').send({ nuevo_estado: 'Quemado' })).status).toBe(400);
    mockTx({ 'FROM correspondencia_recibida WHERE id_recibida': [] });
    expect((await request(app).patch('/api/correspondencia-recibida/1/estado').send({ nuevo_estado: 'Atendido' })).status).toBe(404);
  });

  test('POST adjuntos con PDF real → 201 y sin archivo → 400', async () => {
    mockTx({
      'FROM correspondencia_recibida WHERE id_recibida': [{ codigo: 'COR-REC-1', estado: 'Recibido' }],
      'INSERT INTO documentos_adjuntos': [{ id_documento: 8 }],
      'INSERT INTO seguimientos': []
    });
    const pdf = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), Buffer.from('qa')]);
    const res = await request(app).post('/api/correspondencia-recibida/1/adjuntos').attach('archivo', pdf, 'anexo.pdf');
    expect(res.status).toBe(201);
    expect((await request(app).post('/api/correspondencia-recibida/1/adjuntos')).status).toBe(400);
  });

  test('Fallo BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/correspondencia-recibida')).status).toBe(500);
  });
});
