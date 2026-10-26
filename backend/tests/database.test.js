/**
 * Suite config/database — Pool pg mockeado. Cubre query/getClient/
 * testConnection y los parsers de fecha (timestamp/timestamptz/date).
 */
process.env.NODE_ENV = 'test';

jest.mock('pg', () => {
  const parsers = {};
  const poolInstance = { query: jest.fn(), connect: jest.fn(), end: jest.fn(), on: jest.fn() };
  return {
    Pool: jest.fn(() => poolInstance),
    types: { setTypeParser: jest.fn((oid, fn) => { parsers[oid] = fn; }) },
    __parsers: parsers,
    __pool: poolInstance
  };
});

const pg = require('pg');
const db = require('../src/config/database');

beforeEach(() => jest.clearAllMocks());

describe('config/database', () => {
  test('parsers 1114/1184/1082 registrados al cargar', () => {
    expect(pg.__parsers[1114]).toBeDefined();
    expect(pg.__parsers[1184]).toBeDefined();
    expect(pg.__parsers[1082]).toBeDefined();
  });

  test('query delega al pool y retorna', async () => {
    pg.__pool.query.mockResolvedValue({ rows: [{ a: 1 }] });
    const res = await db.query('SELECT 1', []);
    expect(res.rows).toEqual([{ a: 1 }]);
  });

  test('query propaga error de BD', async () => {
    pg.__pool.query.mockRejectedValue(new Error('caída'));
    await expect(db.query('SELECT 1')).rejects.toThrow('caída');
  });

  test('getClient adquiere cliente', async () => {
    const fake = { query: jest.fn(), release: jest.fn() };
    pg.__pool.connect.mockResolvedValue(fake);
    await expect(db.getClient()).resolves.toBe(fake);
  });

  test('testConnection true/false', async () => {
    pg.__pool.query.mockResolvedValue({ rows: [{ now: 'x', db: 'd', tz: 'tz' }] });
    await expect(db.testConnection()).resolves.toBe(true);
    pg.__pool.query.mockRejectedValue(new Error('no'));
    await expect(db.testConnection()).resolves.toBe(false);
  });

  test('parser timestamp convierte a ISO', () => {
    const out = pg.__parsers[1114]('2026-10-03 18:45:10.123');
    expect(out).toBe('2026-10-03T18:45:10.123Z');
    expect(pg.__parsers[1114]('2026-10-03 18:45:10-04')).toContain('2026-10-03T22:45:10');
    expect(pg.__parsers[1114](null)).toBeNull();
    expect(pg.__parsers[1114]('')).toBeNull();
    expect(pg.__parsers[1114](123)).toBe(123);
  });

  test('parser date devuelve literal y null', () => {
    expect(pg.__parsers[1082]('2026-10-03')).toBe('2026-10-03');
    expect(pg.__parsers[1082](null)).toBeNull();
  });
});
