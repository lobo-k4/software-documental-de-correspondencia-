/**
 * Suite Documentos — GET /api/documentos, descargar y eliminar.
 * 200 éxito/binario, 404 BD/archivo, 403 permiso, 500 fallo BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1,
      permisos: ['ARCHIVO_DESCARGAR', 'ARCHIVO_ELIMINAR']
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

const fs = require('fs');
const os = require('os');
const path = require('path');
const { query } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const archivoReal = path.join(os.tmpdir(), `qa-doc-${Date.now()}.pdf`);
beforeAll(() => fs.writeFileSync(archivoReal, '%PDF-1.4 QA binario'));
afterAll(() => { try { fs.unlinkSync(archivoReal); } catch { /* noop */ } });

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = {
    id_usuario: 1, username: 'op_qa', id_rol: 2, rol_nombre: 'Operador',
    id_area: 1, permisos: ['ARCHIVO_DESCARGAR', 'ARCHIVO_ELIMINAR']
  };
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total')) return { rows: [{ total: '2' }] };
    if (text.includes('FROM documentos_adjuntos da')) {
      if (text.includes('WHERE da.id_documento')) {
        return {
          rows: [{
            id_documento: 1, nombre_original: 'qa.pdf', ruta_almacenamiento: archivoReal,
            mime_type: 'application/pdf', codigo_recibida: 'COR-REC-1', codigo_entregada: null, numero_nota: null
          }]
        };
      }
      return { rows: [{ id_documento: 1, nombre_original: 'qa.pdf' }] };
    }
    if (text.includes('DELETE FROM documentos_adjuntos')) return { rows: [] };
    return { rows: [] };
  });
});

describe('Documentos', () => {
  test('GET listado → 200 con paginación', async () => {
    const res = await request(app).get('/api/documentos');
    expect(res.status).toBe(200);
    expect(res.body.data.documentos).toHaveLength(1);
  });

  test('GET descargar existente → 200 binario', async () => {
    const res = await request(app).get('/api/documentos/1/descargar');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  test('GET descargar inexistente en BD → 404', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('WHERE da.id_documento')) return { rows: [] };
      return { rows: [] };
    });
    expect((await request(app).get('/api/documentos/99/descargar')).status).toBe(404);
  });

  test('GET descargar sin archivo físico → 404', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('WHERE da.id_documento')) {
        return { rows: [{ id_documento: 1, nombre_original: 'x.pdf', ruta_almacenamiento: '/no/existe.pdf', mime_type: 'application/pdf' }] };
      }
      return { rows: [] };
    });
    expect((await request(app).get('/api/documentos/1/descargar')).status).toBe(404);
  });

  test('GET descargar sin permiso → 403', async () => {
    global.__TEST_USER__ = { id_usuario: 2, username: 's', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
    expect((await request(app).get('/api/documentos/1/descargar')).status).toBe(403);
  });

  test('DELETE existente → 200', async () => {
    const res = await request(app).delete('/api/documentos/1');
    expect(res.status).toBe(200);
  });

  test('DELETE inexistente → 404', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('WHERE da.id_documento')) return { rows: [] };
      return { rows: [] };
    });
    expect((await request(app).delete('/api/documentos/99')).status).toBe(404);
  });

  test('DELETE sin permiso → 403', async () => {
    global.__TEST_USER__ = { id_usuario: 2, username: 's', id_rol: 2, rol_nombre: 'Operador', id_area: 1, permisos: [] };
    expect((await request(app).delete('/api/documentos/1')).status).toBe(403);
  });

  test('Fallo BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/documentos')).status).toBe(500);
  });
});
