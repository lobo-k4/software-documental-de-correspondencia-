/**
 * Suite E) Archivos — POST /api/correspondencia-recibida/:id/adjuntos
 * - Archivo falso (.exe renombrado a .pdf) rechazado por magic numbers → 400.
 * Auth y PG mockeados: no toca datos reales.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1,
      username: 'operador_qa',
      id_rol: 2,
      rol_nombre: 'Operador',
      id_area: 1,
      permisos: ['ARCHIVO_SUBIR', 'RECIBIDA_VER']
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

const { query, getClient } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = {
    id_usuario: 1,
    username: 'operador_qa',
    id_rol: 2,
    rol_nombre: 'Operador',
    id_area: 1,
    permisos: ['ARCHIVO_SUBIR', 'RECIBIDA_VER']
  };
  query.mockResolvedValue({ rows: [] });
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    if (text.includes('SELECT codigo')) {
      return { rows: [{ codigo: 'COR-REC-2026-00001', estado: 'Recibido' }] };
    }
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
});

describe('E) Archivos — verificación de magic numbers', () => {
  test('Rechazo de .exe renombrado a .pdf (contenido no coincide con %PDF)', async () => {
    // Cabecera MZ de ejecutable Windows, NO %PDF → firma inválida
    const falsoPdf = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      0x46, 0x41, 0x4b, 0x45, 0x2d, 0x45, 0x58, 0x45
    ]);
    const res = await request(app)
      .post('/api/correspondencia-recibida/99/adjuntos')
      .attach('archivo', falsoPdf, 'falso.pdf');

    // El archivo falso debe rechazarse con 400 (Bad Request), nunca 201 ni 500
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no es válido o no coincide/);
  });
});
