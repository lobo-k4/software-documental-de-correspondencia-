/**
 * Suite Notas — verificar (pública), previsualizar, generar, registrar-entregada,
 * listado, detalle, PDF/DOCX, config QR.
 * 200/201 éxito, 400 validación, 403 permiso/rol, 404 inexistente, 429 límite.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1,
      permisos: ['NOTAS_VER', 'NOTAS_CREAR', 'ENTREGADA_CREAR']
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
  generarCodigoCorrelativo: jest.fn().mockResolvedValue('COR-NOTA-2026-00001')
}));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { query, getClient } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const pdfReal = path.join(os.tmpdir(), `qa-nota-${Date.now()}.pdf`);
beforeAll(() => fs.writeFileSync(pdfReal, '%PDF-1.4 nota QA'));
afterAll(() => { try { fs.unlinkSync(pdfReal); } catch { /* noop */ } });

const USER = {
  id_usuario: 1, username: 'op_qa', id_rol: 2, rol_nombre: 'Operador',
  id_area: 1, permisos: ['NOTAS_VER', 'NOTAS_CREAR', 'ENTREGADA_CREAR']
};
const ADMIN = { id_usuario: 1, username: 'admin_qa', id_rol: 1, rol_nombre: 'Administrador', id_area: 1, permisos: ['NOTAS_VER'] };

const mockTx = (handlers) => {
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    for (const [clave, filas] of Object.entries(handlers)) {
      if (text.includes(clave)) return typeof filas === 'function' ? filas(text) : { rows: filas };
    }
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
  return clientQuery;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...USER };
  query.mockImplementation(async (text) => {
    const t = text.replace(/\s+/g, ' ');
    if (t.includes('SELECT COUNT(*) AS total')) return { rows: [{ total: '6' }] };
    if (t.includes('ruta_almacenamiento')) return { rows: [{ numero_nota: 'CITE-1', ruta_almacenamiento: pdfReal }] };
    if (t.includes('FROM notas_generadas ng') && t.includes('ORDER BY ng.id_nota DESC')) {
      return { rows: [{ id_nota: 1, numero_nota: 'CITE-1' }] };
    }
    if (t.includes('FROM notas_generadas ng') && t.includes('WHERE ng.id_nota')) {
      return { rows: [{ id_nota: 1, numero_nota: 'CITE-1', contenido_renderizado: '<p>x</p>', plantilla_titulo: 'T' }] };
    }
    if (t.includes('FROM plantillas_notas WHERE id_plantilla')) {
      return { rows: [{ codigo: 'OTRO', cuerpo_plantilla: 'Hola {{nombre}}', titulo: 'T', tipo: 'Nota' }] };
    }
    if (t.includes('plantilla_codigo')) {
      return { rows: [{ id_nota: 1, numero_nota: 'CITE-1', datos_variables: {}, contenido_renderizado: 'x', plantilla_codigo: 'OTRO', url_verificacion: 'http://x/v/1' }] };
    }
    if (t.includes('FROM notas_generadas WHERE id_nota')) {
      return { rows: [{ id_nota: 1, numero_nota: 'CITE-1', verificaciones_qr: 0, limite_verificaciones_qr: 3 }] };
    }
    if (t.includes('UPDATE notas_generadas')) return { rows: [{ id_nota: 1, numero_nota: 'CITE-1', verificaciones_qr: 0, limite_verificaciones_qr: 5 }] };
    return { rows: [] };
  });
  mockTx({});
});

describe('Notas', () => {
  test('GET listado → 200', async () => {
    const res = await request(app).get('/api/notas');
    expect(res.status).toBe(200);
    expect(res.body.data.paginacion.total).toBe(6);
  });

  test('GET :id → 200 y 404', async () => {
    expect((await request(app).get('/api/notas/1')).status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/notas/99')).status).toBe(404);
  });

  test('GET sin permiso → 403', async () => {
    global.__TEST_USER__ = { ...USER, permisos: [] };
    expect((await request(app).get('/api/notas')).status).toBe(403);
  });

  test('POST previsualizar → 200, 400 sin plantilla, 404 inexistente', async () => {
    const res = await request(app).post('/api/notas/previsualizar').send({ id_plantilla: 1, datos_variables: { nombre: 'Juan' } });
    expect(res.status).toBe(200);
    expect(res.body.data.contenido_renderizado).toContain('Juan');
    expect((await request(app).post('/api/notas/previsualizar').send({})).status).toBe(400);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).post('/api/notas/previsualizar').send({ id_plantilla: 99 })).status).toBe(404);
  });

  test('POST generar → 201', async () => {
    mockTx({
      'FROM plantillas_notas WHERE id_plantilla': [{ codigo: 'OTRO-TIPO', cuerpo_plantilla: 'Nota para {{destinatario}}', titulo: 'Nota QA', tipo: 'Nota' }],
      'FROM configuracion_qr': [{ limite_verificaciones: 3 }],
      'INSERT INTO notas_generadas': [{ id_nota: 21, numero_nota: 'CITE-QA-001' }],
      'UPDATE notas_generadas SET url_verificacion': [],
      'INSERT INTO documentos_adjuntos': []
    });
    const res = await request(app).post('/api/notas/generar').send({
      id_plantilla: 1, numero_nota: 'CITE-QA-001', datos_variables: { destinatario: 'Dirección' }
    });
    expect(res.status).toBe(201);
    expect(res.body.data.numero_nota).toBe('CITE-QA-001');
  }, 30000);

  test('POST generar sin plantilla → 400 y despacho incompleto → 400', async () => {
    expect((await request(app).post('/api/notas/generar').send({})).status).toBe(400);
    expect((await request(app).post('/api/notas/generar').send({ id_plantilla: 1, despachar_como_entregada: true })).status).toBe(400);
  });

  test('POST generar plantilla inexistente → 404', async () => {
    mockTx({ 'FROM plantillas_notas WHERE id_plantilla': [] });
    expect((await request(app).post('/api/notas/generar').send({ id_plantilla: 99 })).status).toBe(404);
  });

  test('POST registrar-entregada → 200, 400 sin área, 404 inexistente', async () => {
    mockTx({
      'FROM notas_generadas ng': [{ id_nota: 1, numero_nota: 'CITE-1', id_entregada: null, datos_variables: {}, titulo: 'T' }],
      'ILIKE': [{ id_tipo_doc: 2 }],
      'INSERT INTO correspondencia_entregada': [{ id_entregada: 5 }],
      'UPDATE notas_generadas SET id_entregada': [],
      'UPDATE documentos_adjuntos SET id_entregada': [],
      'INSERT INTO seguimientos': []
    });
    const res = await request(app).post('/api/notas/1/registrar-entregada').send({ id_area_remitente: 2, responsable_remitente: 'Jefe' });
    expect(res.status).toBe(200);
    expect(res.body.data.id_entregada).toBe(5);
    expect((await request(app).post('/api/notas/1/registrar-entregada').send({})).status).toBe(400);
    mockTx({ 'FROM notas_generadas ng': [] });
    expect((await request(app).post('/api/notas/9/registrar-entregada').send({ id_area_remitente: 2, responsable_remitente: 'J' })).status).toBe(404);
  });

  test('GET verificar pública → 200, 404 y 429 por límite', async () => {
    mockTx({
      'FROM notas_generadas ng': [{ id_nota: 1, numero_nota: 'CITE-1', verificaciones_qr: 0, limite_verificaciones_qr: 3, datos_variables: {} }],
      'UPDATE notas_generadas': [{ verificaciones_qr: 1 }]
    });
    expect((await request(app).get('/api/notas/verificar/1')).status).toBe(200);
    expect((await request(app).get('/api/notas/verificar/abc')).status).toBe(404);
    mockTx({ 'FROM notas_generadas ng': [] });
    expect((await request(app).get('/api/notas/verificar/99')).status).toBe(404);
    mockTx({
      'FROM notas_generadas ng': [{ id_nota: 1, numero_nota: 'CITE-1', verificaciones_qr: 3, limite_verificaciones_qr: 3, datos_variables: {} }]
    });
    expect((await request(app).get('/api/notas/verificar/1')).status).toBe(429);
  });

  test('GET pdf → 200, 404 sin fila y sin físico', async () => {
    const res = await request(app).get('/api/notas/1/pdf');
    expect(res.status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/notas/9/pdf')).status).toBe(404);
    query.mockImplementation(async (text) => {
      const t = text.replace(/\s+/g, ' ');
      if (t.includes('ruta_almacenamiento')) return { rows: [{ numero_nota: 'C', ruta_almacenamiento: '/no/existe.pdf' }] };
      return { rows: [] };
    });
    expect((await request(app).get('/api/notas/1/pdf')).status).toBe(404);
  });

  test('GET docx → 200 y 404', async () => {
    const res = await request(app).get('/api/notas/1/docx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('officedocument');
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/notas/9/docx')).status).toBe(404);
  }, 30000);

  test('GET configuracion-qr → 200 y 404', async () => {
    expect((await request(app).get('/api/notas/1/configuracion-qr')).status).toBe(200);
    query.mockImplementation(async () => ({ rows: [] }));
    expect((await request(app).get('/api/notas/99/configuracion-qr')).status).toBe(404);
  });

  test('PUT configuracion-qr Admin → 200, límite inválido → 400, Operador → 403', async () => {
    global.__TEST_USER__ = { ...ADMIN };
    expect((await request(app).put('/api/notas/1/configuracion-qr').send({ limite_verificaciones: 5 })).status).toBe(200);
    expect((await request(app).put('/api/notas/1/configuracion-qr').send({ limite_verificaciones: 0 })).status).toBe(400);
    global.__TEST_USER__ = { ...USER };
    expect((await request(app).put('/api/notas/1/configuracion-qr').send({ limite_verificaciones: 5 })).status).toBe(403);
  });

  test('Fallo BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/notas')).status).toBe(500);
  });
});
