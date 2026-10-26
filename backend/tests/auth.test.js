/**
 * Suite A) Autenticación — POST /api/auth/login
 * - Login exitoso (200) | Contraseña incorrecta (401)
 * - Usuario inexistente (401) | Rate limiting tras 5 intentos (429)
 * DB PostgreSQL mockeada: no toca datos reales.
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

// Hash real para validar el flujo bcrypt sin exponer credenciales
const PASSWORD_VALIDA = 'Password123!';
const passwordHash = bcrypt.hashSync(PASSWORD_VALIDA, 10);

const filaUsuarioAdmin = {
  id_usuario: 1,
  username: 'admin',
  email: 'admin@institucion.bo',
  password_hash: passwordHash,
  nombre_completo: 'Administrador QA',
  cargo: 'Jefe de Sistemas',
  foto_perfil: null,
  id_rol: 1,
  rol_nombre: 'Administrador',
  id_area: 1,
  area_nombre: 'Sistemas',
  activo: true
};

// Mock central: distingue la consulta por su texto SQL
query.mockImplementation(async (text, params = []) => {
  if (text.includes('FROM usuarios u') && text.includes('LOWER(u.username)')) {
    const login = String(params[0] || '').toLowerCase();
    if (login === 'admin' || login === 'admin@institucion.bo') {
      return { rows: [filaUsuarioAdmin] };
    }
    return { rows: [] }; // usuario inexistente
  }
  if (text.includes('FROM rol_permisos')) {
    return { rows: [{ codigo: 'USUARIOS_VER' }, { codigo: 'RECIBIDA_VER' }] };
  }
  if (text.includes('UPDATE usuarios SET ultimo_acceso')) {
    return { rows: [] };
  }
  return { rows: [] };
});

describe('A) Autenticación — POST /api/auth/login', () => {
  test('Login exitoso retorna 200 con token y usuario', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: PASSWORD_VALIDA });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.usuario.username).toBe('admin');
  });

  test('Contraseña incorrecta retorna 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'ClaveEquivocada123!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Usuario inexistente retorna 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'usuario_que_no_existe', password: 'Cualquiera123!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Rate limiting: tras 5 intentos se responde 429', async () => {
    // El limiter es global por IP (max 5 / 15min). Los tests previos ya
    // consumieron intentos, así que disparamos fallidos hasta forzar el 429.
    const estados = [];
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'ClaveEquivocada123!' });
      estados.push(res.status);
      if (res.status === 429) break;
    }
    expect(estados).toContain(429);
  });
});
