/**
 * Suite B) Correspondencia — POST /api/correspondencia-recibida
 * - Creación exitosa (201) | Fecha inválida (400) | IDs no numéricos (400)
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
      permisos: ['RECIBIDA_VER', 'RECIBIDA_CREAR', 'RECIBIDA_EDITAR']
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
  generarCodigoCorrelativo: jest.fn().mockResolvedValue('COR-REC-2026-00001')
}));

const { query, getClient } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const hoy = () => new Date().toISOString().slice(0, 10);

const cuerpoValido = () => ({
  remitente: 'Juan Pérez',
  institucion_remitente: 'Gobernación',
  id_tipo_doc: 1,
  asunto: 'Solicitud de informe QA',
  destinatario: 'Dirección Administrativa',
  id_area_responsable: 1,
  cargo_responsable: 'Jefe de Archivo',
  prioridad: 'Normal',
  fecha_recepcion: hoy(),
  observaciones: 'Caso de prueba'
});

beforeEach(() => {
  jest.clearAllMocks();
  // Validación de cargo: existe en el área indicada
  query.mockResolvedValue({ rows: [{ id_cargo: 7 }] });

  // Cliente transaccional falso
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    if (text.includes('INSERT INTO correspondencia_recibida')) {
      return {
        rows: [{
          id_recibida: 99,
          codigo: 'COR-REC-2026-00001',
          asunto: 'Solicitud de informe QA',
          remitente: 'Juan Pérez',
          id_area_responsable: 1,
          cargo_responsable: 'Jefe de Archivo',
          estado: 'Recibido'
        }]
      };
    }
    if (text.includes('INSERT INTO seguimientos')) return { rows: [] };
    return { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
});

describe('B) Correspondencia — POST /api/correspondencia-recibida', () => {
  test('Creación exitosa con datos válidos retorna 201', async () => {
    const res = await request(app)
      .post('/api/correspondencia-recibida')
      .send(cuerpoValido());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.codigo).toBe('COR-REC-2026-00001');
  });

  test('Rechazo por fecha inválida retorna 400', async () => {
    const res = await request(app)
      .post('/api/correspondencia-recibida')
      .send({ ...cuerpoValido(), fecha_recepcion: '31-12-2026' }); // formato no YYYY-MM-DD
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Rechazo por IDs no numéricos retorna 400', async () => {
    const res = await request(app)
      .post('/api/correspondencia-recibida')
      .send({ ...cuerpoValido(), id_tipo_doc: 'abc', id_area_responsable: 'xyz' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
