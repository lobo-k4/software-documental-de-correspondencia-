/**
 * Suite Servicios — auditoriaService, notificacionService, codigoCorrelativoService
 * reales con PG mockeado. Cubre ramas: administrativa/directa/operativa,
 * 0/1-5/>5 responsables, errores tragados, correlativos nuevo/existente.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn(), query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true)
}));

const { query } = require('../src/config/database');
const { registrarAuditoria } = require('../src/services/auditoriaService');
const { crearNotificacion, crearAvisosPendientes } = require('../src/services/notificacionService');
const { generarCodigoCorrelativo } = require('../src/services/codigoCorrelativoService');

const fakeClient = (filas) => ({
  query: jest.fn(async () => ({ rows: filas }))
});

beforeEach(() => jest.clearAllMocks());

describe('auditoriaService', () => {
  test('registra con IP de x-forwarded-for', async () => {
    query.mockResolvedValue({ rows: [{ id_auditoria: 1 }] });
    await registrarAuditoria({
      id_usuario: 1, username: 'qa', accion: 'LOGIN', modulo: 'Auth',
      req: { headers: { 'x-forwarded-for': '10.0.0.5' }, socket: {}, ip: 'x' }
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO auditoria'), expect.any(Array));
    expect(query.mock.calls[0][1]).toContain('10.0.0.5');
  });

  test('limpia prefijo ::ffff: y funciona sin req', async () => {
    query.mockResolvedValue({ rows: [] });
    await registrarAuditoria({ username: 'S', accion: 'X', modulo: 'M', req: { headers: {}, socket: { remoteAddress: '::ffff:127.0.0.1' }, ip: 'y' } });
    expect(query.mock.calls[0][1]).toContain('127.0.0.1');
    await registrarAuditoria({ accion: 'X', modulo: 'M' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('error de BD no lanza', async () => {
    query.mockRejectedValue(new Error('caída'));
    await expect(registrarAuditoria({ accion: 'X', modulo: 'M' })).resolves.toBeUndefined();
  });
});

describe('notificacionService', () => {
  test('administrativa → inserta a administradores', async () => {
    query.mockResolvedValue({ rows: [] });
    await crearNotificacion({ id_usuario_origen: 1, es_administrativa: true, tipo: 'T', titulo: 'Ti', mensaje: 'Me' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('Administrador'), expect.any(Array));
  });

  test('destinatario directo por ID', async () => {
    query.mockResolvedValue({ rows: [] });
    await crearNotificacion({ id_usuario_origen: 1, id_usuario_destino: 9, tipo: 'T', titulo: 'Ti', mensaje: 'Me' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('operativa con 1 responsable → inserta', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('SELECT id_usuario')) return { rows: [{ id_usuario: 4 }] };
      return { rows: [] };
    });
    await crearNotificacion({ id_usuario_origen: 1, id_area_destino: 2, cargo_destino: 'Jefe', tipo: 'T', titulo: 'Ti', mensaje: 'Me' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('operativa sin responsables → no inserta', async () => {
    query.mockResolvedValue({ rows: [] });
    await crearNotificacion({ id_usuario_origen: 1, id_area_destino: 2, cargo_destino: 'Nadie', tipo: 'T', titulo: 'Ti', mensaje: 'Me' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('operativa con >5 responsables → no inserta', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('SELECT id_usuario')) return { rows: [1, 2, 3, 4, 5, 6].map((id_usuario) => ({ id_usuario })) };
      return { rows: [] };
    });
    await crearNotificacion({ id_usuario_origen: 1, id_area_destino: 2, cargo_destino: 'Jefe', tipo: 'T', titulo: 'Ti', mensaje: 'Me' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('solo área sin cargo → no inserta', async () => {
    query.mockResolvedValue({ rows: [] });
    await crearNotificacion({ id_area_destino: 2, tipo: 'T', titulo: 'Ti', mensaje: 'Me' });
    expect(query).not.toHaveBeenCalled();
  });

  test('error de BD no lanza', async () => {
    query.mockRejectedValue(new Error('caída'));
    await expect(crearNotificacion({ id_usuario_destino: 1, tipo: 'T', titulo: 'Ti', mensaje: 'Me' })).resolves.toBeUndefined();
  });

  test('crearAvisosPendientes ok y con error', async () => {
    query.mockResolvedValue({ rows: [] });
    await crearAvisosPendientes(3);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRejectedValue(new Error('caída'));
    await expect(crearAvisosPendientes(3)).resolves.toBeUndefined();
  });
});

describe('codigoCorrelativoService', () => {
  test('crea correlativo nuevo RECIBIDA', async () => {
    const client = { query: jest.fn(async (t) => (t.includes('SELECT ultimo_numero') ? { rows: [] } : { rows: [] })) };
    const codigo = await generarCodigoCorrelativo(client, 'RECIBIDA', 2026);
    expect(codigo).toBe('COR-REC-2026-00001');
  });

  test('incrementa existente ENTREGADA y NOTA', async () => {
    const client = { query: jest.fn(async (t) => (t.includes('SELECT ultimo_numero') ? { rows: [{ ultimo_numero: 41 }] } : { rows: [] })) };
    expect(await generarCodigoCorrelativo(client, 'ENTREGADA', 2026)).toBe('COR-ENT-2026-00042');
    expect(await generarCodigoCorrelativo(client, 'NOTA', 2026)).toBe('NOTA-2026-00042');
  });

  test('tipo genérico usa fallback', async () => {
    expect(await generarCodigoCorrelativo(fakeClient([]), 'OTRO', 2026)).toBe('OTRO-2026-00001');
  });
});
