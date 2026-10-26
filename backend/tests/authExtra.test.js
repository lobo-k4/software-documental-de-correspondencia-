/**
 * Suite Auth extra — /me, cambiar-password, logout, foto-perfil.
 * AuthMiddleware REAL con PG mockeado; 200 éxito, 400 validación, 401 auth.
 */
process.env.NODE_ENV = 'test';

const bcrypt = require('bcryptjs');

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn(), query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true)
}));

const { query } = require('../src/config/database');
const request = require('supertest');
const app = require('../src/app');

const PWD = 'Password123!';
const hash = bcrypt.hashSync(PWD, 10);
const FILA = {
  id_usuario: 1, username: 'admin', email: 'a@bo.bo', password_hash: hash,
  nombre_completo: 'Admin', cargo: 'Jefe', foto_perfil: null,
  id_rol: 1, rol_nombre: 'Administrador', id_area: 1, area_nombre: 'Sis', activo: true
};

query.mockImplementation(async (text) => {
  if (text.includes('LOWER(u.username)')) return { rows: [{ ...FILA }] };
  if (text.includes('WHERE u.id_usuario = $1')) return { rows: [{ ...FILA }] };
  if (text.includes('FROM rol_permisos')) return { rows: [{ codigo: 'X' }] };
  if (text.includes('UPDATE usuarios SET ultimo_acceso')) return { rows: [] };
  if (text.includes('SELECT password_hash FROM usuarios')) return { rows: [{ password_hash: hash }] };
  if (text.includes('RETURNING foto_perfil')) return { rows: [{ foto_perfil: '/uploads/perfiles/q.png' }] };
  if (text.includes('UPDATE usuarios')) return { rows: [] };
  return { rows: [] };
});

let token;
beforeAll(async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: PWD });
  token = res.body.data.token;
});
const auth = (r) => r.set('Authorization', `Bearer ${token}`);

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Auth extra', () => {
  test('GET /me con token → 200', async () => {
    const res = await auth(request(app).get('/api/auth/me'));
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('admin');
  });

  test('GET /me sin token → 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  test('PUT cambiar-password válida → 200', async () => {
    const res = await auth(request(app).put('/api/auth/cambiar-password')).send({
      password_actual: PWD, password_nuevo: 'NuevaSegura123!@#'
    });
    expect(res.status).toBe(200);
  });

  test('PUT cambiar-password actual errónea → 400 y débil → 400', async () => {
    const r1 = await auth(request(app).put('/api/auth/cambiar-password')).send({
      password_actual: 'Otra12345678!', password_nuevo: 'NuevaSegura123!@#'
    });
    expect(r1.status).toBe(400);
    const r2 = await auth(request(app).put('/api/auth/cambiar-password')).send({
      password_actual: PWD, password_nuevo: 'corta'
    });
    expect(r2.status).toBe(400);
    const r3 = await auth(request(app).put('/api/auth/cambiar-password')).send({});
    expect(r3.status).toBe(400);
  });

  test('POST foto-perfil PNG real → 200 e inválida → 400', async () => {
    const res = await auth(request(app).post('/api/auth/foto-perfil')).attach('foto', PNG, 'foto.png');
    expect(res.status).toBe(200);
    const r2 = await auth(request(app).post('/api/auth/foto-perfil')).attach('foto', Buffer.from('hola'), 'foto.txt');
    expect(r2.status).toBe(400);
  });

  test('POST logout → 200', async () => {
    const res = await auth(request(app).post('/api/auth/logout'));
    expect(res.status).toBe(200);
  });
});
