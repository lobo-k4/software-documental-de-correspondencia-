/**
 * Suite scannerService — child_process mockeado, sin hardware.
 * Cubre runPowerShell, devices, capabilities y validaciones de escaneo.
 */
process.env.NODE_ENV = 'test';

jest.mock('child_process', () => ({ execFile: jest.fn() }));

const { execFile } = require('child_process');
const scanner = require('../src/services/scannerService');

const ok = (payload) => (file, args, opts, cb) => cb(null, JSON.stringify(payload), '');

beforeEach(() => jest.clearAllMocks());

describe('scannerService', () => {
  test('getScannerDevices filtra inválidos y normaliza objeto único', async () => {
    execFile.mockImplementation(ok([
      { id: 'd1', nombre: 'Epson', fabricante: 'E' },
      { id: null, nombre: 'X' },
      {}
    ]));
    const devs = await scanner.getScannerDevices();
    expect(devs).toEqual([{ id: 'd1', nombre: 'Epson', fabricante: 'E' }]);

    execFile.mockImplementation(ok({ id: 'solo', nombre: 'Uno' }));
    expect(await scanner.getScannerDevices()).toEqual([{ id: 'solo', nombre: 'Uno' }]);

    execFile.mockImplementation(ok(null));
    expect(await scanner.getScannerDevices()).toEqual([]);
  });

  test('runPowerShell: stderr, JSON inválido y AbortError', async () => {
    execFile.mockImplementation((f, a, o, cb) => cb(new Error('boom'), '', '  '));
    await expect(scanner.getScannerDevices()).rejects.toThrow('boom');
    execFile.mockImplementation((f, a, o, cb) => cb(new Error('boom'), '', 'falló WIA'));
    await expect(scanner.getScannerDevices()).rejects.toThrow('falló WIA');
    execFile.mockImplementation((f, a, o, cb) => cb(null, 'no-json{{{', ''));
    await expect(scanner.getScannerDevices()).rejects.toThrow(/respuesta válida/);
    const abort = new Error('x'); abort.name = 'AbortError';
    execFile.mockImplementation((f, a, o, cb) => cb(abort, '', ''));
    await expect(scanner.getScannerDevices()).rejects.toBe(abort);
  });

  test('runPowerShell exige win32', async () => {
    const real = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      await expect(scanner.getScannerDevices()).rejects.toThrow(/requiere Windows/);
    } finally {
      Object.defineProperty(process, 'platform', { value: real, configurable: true });
    }
  });

  test('getScannerCapabilities mapea etiquetas', async () => {
    execFile.mockImplementation(ok({
      tamanoPapel: [1, 9], resoluciones: [300], modosColor: [1, 3, 7],
      alimentador: true, dobleCara: false
    }));
    const caps = await scanner.getScannerCapabilities('d1');
    expect(caps.tamanoPapel).toEqual([{ valor: 1, etiqueta: 'A4' }, { valor: 9, etiqueta: 'Tamaño 9' }]);
    expect(caps.modosColor[0]).toEqual({ valor: 1, etiqueta: 'Blanco y negro' });
    expect(caps.alimentador).toBe(true);
  });

  test('scanWithWia feliz retorna páginas con id', async () => {
    execFile
      .mockImplementationOnce(ok([{ id: 'd1', nombre: 'Epson' }]))
      .mockImplementationOnce(ok({ tamanoPapel: [1], resoluciones: [300], modosColor: [3], alimentador: false, dobleCara: false }))
      .mockImplementationOnce(ok({ paginas: [{ ancho: 100, alto: 200, imagen: 'abc' }] }));
    const pags = await scanner.scanWithWia('d1', { pageSize: 1, dpi: 300, colorMode: 3 }, undefined);
    expect(pags).toHaveLength(1);
    expect(pags[0]).toMatchObject({ ancho: 100, alto: 200, imagen: 'abc' });
  });

  test('scanWithWia validaciones: dispositivo, opciones, adf, duplex, sin páginas', async () => {
    // FIFO reiniciada en cada caso: las validaciones tempranas no consumen
    // todas las respuestas, así que no se puede usar cola global.
    let respuestas = [];
    execFile.mockImplementation((f, a, o, cb) => cb(null, JSON.stringify(respuestas.shift()), ''));
    const DEV = [{ id: 'd1', nombre: 'E' }];
    const capsBase = { tamanoPapel: [1], resoluciones: [300], modosColor: [3], alimentador: false, dobleCara: false };

    respuestas = [DEV, capsBase];
    await expect(scanner.scanWithWia('otro', {})).rejects.toThrow(/no está disponible/);

    respuestas = [DEV, capsBase];
    await expect(scanner.scanWithWia('d1', { pageSize: 2 })).rejects.toThrow(/tamaño de papel/);

    respuestas = [DEV, capsBase];
    await expect(scanner.scanWithWia('d1', { adf: true })).rejects.toThrow(/alimentador/);

    respuestas = [DEV, capsBase];
    await expect(scanner.scanWithWia('d1', { duplex: true })).rejects.toThrow(/doble cara/);

    respuestas = [DEV, capsBase, { paginas: [] }];
    await expect(scanner.scanWithWia('d1', {})).rejects.toThrow(/no devolvió páginas/);
  });
});
