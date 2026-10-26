/**
 * Suite Usuarios — GET/POST/PUT/PATCH/DELETE /api/usuarios (solo Administrador)
 * 200/201 éxito, 400 validación, 403 permiso, 404 no encontrado, 409 duplicado.
 * Auth y PG mockeados: no toca datos reales.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/middleware/authMiddleware', () => {
  const mock = jest.fn((req, res, next) => {
    req.user = global.__TEST_USER__ || {
      id_usuario: 1,
      username: 'admin_qa',
      id_rol: 1,
      rol_nombre: 'Administrador',
      id_area: 1,
      permisos: []
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

const ADMIN = {
  id_usuario: 1, username: 'admin_qa', id_rol: 1,
  rol_nombre: 'Administrador', id_area: 1, permisos: []
};
const OPERADOR = {
  id_usuario: 2, username: 'operador_qa', id_rol: 2,
  rol_nombre: 'Operador', id_area: 1, permisos: ['RECIBIDA_VER']
};
const PWD_OK = 'Segura123!@#x';

const mockClienteTx = (sobreescribir = {}) => {
  const clientQuery = jest.fn(async (text) => {
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    if (text.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (text.includes('COUNT(*)::INT AS total')) return { rows: [{ total: 0 }] };
    if (text.includes('INSERT INTO usuarios')) {
      return { rows: [{ id_usuario: 9, username: 'nuevo_qa', email: 'nuevo@bo.bo', nombre_completo: 'Nuevo QA', cargo: 'Jefe', id_rol: 2, id_area: 1, activo: true }] };
    }
    if (text.includes('UPDATE usuarios SET')) return { rows: [{ id_usuario: 2, username: 'jdoe' }] };
    return sobreescribir.default || { rows: [] };
  });
  getClient.mockResolvedValue({ query: clientQuery, release: jest.fn() });
  return clientQuery;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__TEST_USER__ = { ...ADMIN };
  query.mockImplementation(async (text) => {
    if (text.includes('SELECT COUNT(*) AS total FROM usuarios')) return { rows: [{ total: '1' }] };
    if (text.includes('LOWER(username)')) return { rows: [] };
    if (text.includes('LOWER(email)')) return { rows: [] };
    if (text.includes('FROM cargos WHERE')) return { rows: [{ id_cargo: 1 }] };
    if (text.includes('SELECT id_usuario, username, activo FROM usuarios')) {
      return { rows: [{ id_usuario: 2, username: 'jdoe', activo: true }] };
    }
    if (text.includes('SELECT username, id_area, cargo, activo FROM usuarios')) {
      return { rows: [{ username: 'jdoe', id_area: 1, cargo: 'Jefe', activo: true }] };
    }
    if (text.includes('SELECT username FROM usuarios WHERE')) return { rows: [{ username: 'jdoe' }] };
    if (text.includes('DELETE FROM usuarios')) return { rows: [] };
    if (text.includes('UPDATE usuarios SET password_hash')) return { rows: [] };
    if (text.includes('UPDATE usuarios SET activo')) return { rows: [] };
    if (text.includes('FROM usuarios u')) {
      return { rows: [{ id_usuario: 2, username: 'jdoe', email: 'j@bo.bo', nombre_completo: 'J Doe', cargo: 'Jefe', id_rol: 2, rol_nombre: 'Operador', id_area: 1, area_nombre: 'Sistemas', area_sigla: 'SIS', activo: true }] };
    }
    return { rows: [] };
  });
  mockClienteTx();
});

describe('Usuarios', () => {
  test('GET /api/usuarios → 200 con paginación', async () => {
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paginacion.total).toBe(1);
  });

  test('GET /api/usuarios como Operador → 403', async () => {
    global.__TEST_USER__ = { ...OPERADOR };
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(403);
  });

  test('GET /api/usuarios/2 → 200', async () => {
    const res = await request(app).get('/api/usuarios/2');
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('jdoe');
  });

  test('GET /api/usuarios/999 inexistente → 404', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('FROM usuarios u')) return { rows: [] };
      return { rows: [] };
    });
    const res = await request(app).get('/api/usuarios/999');
    expect(res.status).toBe(404);
  });

  test('POST /api/usuarios válido → 201', async () => {
    const res = await request(app).post('/api/usuarios').send({
      username: 'nuevo_qa', email: 'nuevo@bo.bo', password: PWD_OK,
      nombre_completo: 'Nuevo QA', id_rol: 2, id_area: 1, cargo: 'Jefe'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('nuevo_qa');
  });

  test('POST /api/usuarios sin campos → 400', async () => {
    const res = await request(app).post('/api/usuarios').send({ username: 'x' });
    expect(res.status).toBe(400);
  });

  test('POST /api/usuarios password débil → 400', async () => {
    const res = await request(app).post('/api/usuarios').send({
      username: 'nuevo_qa', email: 'nuevo@bo.bo', password: 'corta',
      nombre_completo: 'Nuevo QA', id_rol: 2
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/usuarios duplicado → 409', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('LOWER(username)')) return { rows: [{ id_usuario: 5 }] };
      return { rows: [] };
    });
    const res = await request(app).post('/api/usuarios').send({
      username: 'jdoe', email: 'otro@bo.bo', password: PWD_OK,
      nombre_completo: 'Otro', id_rol: 2
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/usuarios como Operador → 403', async () => {
    global.__TEST_USER__ = { ...OPERADOR };
    const res = await request(app).post('/api/usuarios').send({});
    expect(res.status).toBe(403);
  });

  test('PUT /api/usuarios/2 válido → 200', async () => {
    const res = await request(app).put('/api/usuarios/2').send({
      email: 'nuevo@bo.bo', nombre_completo: 'J Doe Nuevo',
      id_rol: 2, id_area: 1, cargo: 'Jefe'
    });
    expect(res.status).toBe(200);
  });

  test('PUT /api/usuarios/999 inexistente → 404', async () => {
    query.mockImplementation(async (text) => {
      if (text.includes('SELECT id_usuario, username, activo FROM usuarios')) return { rows: [] };
      return { rows: [] };
    });
    const res = await request(app).put('/api/usuarios/999').send({
      email: 'n@bo.bo', nombre_completo: 'X', id_rol: 2
    });
    expect(res.status).toBe(404);
  });

  test('PATCH /api/usuarios/2/estado → 200', async () => {
    const res = await request(app).patch('/api/usuarios/2/estado').send({ activo: false });
    expect(res.status).toBe(200);
  });

  test('PATCH autodesactivación del admin → 400', async () => {
    const res = await request(app).patch('/api/usuarios/1/estado').send({ activo: false });
    expect(res.status).toBe(400);
  });

  test('DELETE /api/usuarios/2 → 200', async () => {
    const res = await request(app).delete('/api/usuarios/2');
    expect(res.status).toBe(200);
  });

  test('DELETE propia cuenta → 400', async () => {
    const res = await request(app).delete('/api/usuarios/1');
    expect(res.status).toBe(400);
  });

  test('PUT restablecer-password válido → 200', async () => {
    const res = await request(app).put('/api/usuarios/2/restablecer-password').send({ password_nuevo: PWD_OK });
    expect(res.status).toBe(200);
  });

  test('PUT restablecer-password débil → 400', async () => {
    const res = await request(app).put('/api/usuarios/2/restablecer-password').send({ password_nuevo: '123' });
    expect(res.status).toBe(400);
  });

  test('Error de BD en listado → 500', async () => {
    query.mockRejectedValue(new Error('BD caída'));
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(500);
  });
});
