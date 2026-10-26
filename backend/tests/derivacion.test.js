/**
 * Suite C) Derivaciones — POST /api/derivaciones y PATCH /api/derivaciones/:id/estado
 * - Derivación a área diferente (201)
 * - Misma área origen/destino (400)
 * - Transición de estado inválida (400)
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
      permisos: ['RECIBIDA_DERIVAR', 'DERIVACIONES_VER']
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

// Cliente transaccional parametrizable por test
const mockClientFor = (escenario) => {
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    // POST /derivaciones: lectura de correspondencia y área origen
    if (text.includes('FROM correspondencia_recibida cr') && text.includes('id_area_responsable')) {
      return {
        rows: [{
          id_recibida: 99,
          codigo: 'COR-REC-2026-00001',
          estado: 'Recibido',
          id_area_responsable: 1,
          area_origen_nombre: 'Sistemas'
        }]
      };
    }
    if (text.includes('SELECT nombre FROM areas')) {
      return { rows: [{ nombre: 'Archivo Central' }] };
    }
    if (text.includes('INSERT INTO derivaciones')) {
      return {
        rows: [{
          id_derivacion: 10,
          id_recibida: 99,
          id_area_origen: 1,
          id_area_destino: 2,
          estado_derivacion: 'Pendiente'
        }]
      };
    }
    // PATCH /derivaciones/:id/estado: lectura de la derivación (estado actual Pendiente)
    if (text.includes('FROM derivaciones d') && text.includes('id_derivacion')) {
      return {
        rows: [{
          id_derivacion: 10,
          id_recibida: 99,
          id_area_origen: 1,
          id_area_destino: 1, // coincide con req.user.id_area para pasar el control de área
          id_usuario_derivo: 5,
          estado_derivacion: escenario === 'rechazado-final' ? 'Rechazado' : 'Pendiente',
          codigo: 'COR-REC-2026-00001',
          estado_actual: 'Derivado',
          area_destino_nombre: 'Sistemas'
        }]
      };
    }
    if (text.includes('UPDATE') || text.includes('INSERT INTO seguimientos')) return { rows: [] };
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = {
    id_usuario: 1,
    username: 'operador_qa',
    id_rol: 2,
    rol_nombre: 'Operador',
    id_area: 1,
    permisos: ['RECIBIDA_DERIVAR', 'DERIVACIONES_VER']
  };
  // Validación de cargo destino: pertenece al área destino
  query.mockResolvedValue({ rows: [{ id_cargo: 3 }] });
});

describe('C) Derivaciones', () => {
  test('Derivación exitosa a un área diferente retorna 201', async () => {
    mockClientFor('ok');
    const res = await request(app)
      .post('/api/derivaciones')
      .send({
        id_recibida: 99,
        id_area_destino: 2, // diferente del área origen (1)
        cargo_destino: 'Jefe de Archivo',
        responsable_destino: 'Ana Gómez',
        instruccion_observacion: 'Atender según corresponda'
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Rechazo al derivar a la misma área de origen retorna 400', async () => {
    mockClientFor('ok');
    const res = await request(app)
      .post('/api/derivaciones')
      .send({
        id_recibida: 99,
        id_area_destino: 1, // igual al área origen (1)
        cargo_destino: 'Jefe de Archivo',
        responsable_destino: 'Ana Gómez',
        instruccion_observacion: 'Derivación inválida'
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Rechazo de transición inválida de estado retorna 400', async () => {
    mockClientFor('ok'); // derivación actual en "Pendiente"
    const res = await request(app)
      .patch('/api/derivaciones/10/estado')
      .send({ estado_derivacion: 'Completado', observaciones: 'Salto inválido' });
    // Pendiente solo permite Aceptado/Rechazado → Completado es inválido
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
