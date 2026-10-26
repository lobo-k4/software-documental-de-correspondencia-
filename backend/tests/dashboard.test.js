/**
 * Suite Dashboard — GET /api/dashboard/metricas.
 * 200 con métricas agregadas, 500 ante fallo BD.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1, username: 'op_qa', id_rol: 2,
      rol_nombre: 'Operador', id_area: 1, permisos: []
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
  query.mockImplementation(async (text) => {
    if (text.includes('total_recibida')) {
      return { rows: [{ total_recibida: '10', pendientes: '3', en_proceso: '2', atendidas: '4', archivadas: '1', recibidos_mes_actual: '5' }] };
    }
    if (text.includes('total_entregada')) {
      return { rows: [{ total_entregada: '7', emitidas: '5', entregadas_confirmadas: '2', entregados_mes_actual: '3' }] };
    }
    if (text.includes('GROUP BY estado')) return { rows: [{ estado: 'Recibido', cantidad: '3' }] };
    if (text.includes('LEFT JOIN correspondencia_recibida cr')) {
      return { rows: [{ area_nombre: 'Sistemas', sigla: 'SIS', total_documentos: '10' }] };
    }
    if (text.includes('generate_series') || text.includes('WITH meses')) {
      return { rows: [{ mes: '2026-01', mes_etiqueta: 'Ene', recibidos: '2', entregados: '1' }] };
    }
    return { rows: [{ total_recibida: '0', pendientes: '0', en_proceso: '0', atendidas: '0', archivadas: '0', recibidos_mes_actual: '0' }] };
  });
});

describe('Dashboard', () => {
  test('GET metricas → 200 con resumen', async () => {
    const res = await request(app).get('/api/dashboard/metricas');
    expect(res.status).toBe(200);
    expect(res.body.data.resumen.total_recibida).toBe(10);
    expect(res.body.data.resumen.total_entregada).toBe(7);
    expect(res.body.data.por_estado).toHaveLength(1);
    expect(res.body.data.por_area).toHaveLength(1);
    expect(res.body.data.evolucion_mensual).toHaveLength(1);
  });

  test('Fallo BD → 500', async () => {
    query.mockRejectedValue(new Error('caída'));
    expect((await request(app).get('/api/dashboard/metricas')).status).toBe(500);
  });
});
