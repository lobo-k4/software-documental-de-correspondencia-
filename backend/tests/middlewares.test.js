/**
 * Suite Middlewares — authMiddleware real + roleMiddleware directo.
 * Cubre 401 (sin token/inválido/expirado/inactivo/inexistente/error BD),
 * 200 con inyección de req.user, y 403/permiso de roles.
 */
process.env.NODE_ENV = 'test';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn(), query: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(true)
}));

const { query } = require('../src/config/database');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const authenticateToken = require('../src/middleware/authMiddleware');
const { requireRole, requirePermission } = require('../src/middleware/roleMiddleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const filaUsuario = (activo = true) => ({
  id_usuario: 7, username: 'mid_qa', email: 'm@bo.bo',
  nombre_completo: 'Mid QA', cargo: 'Técnico', foto_perfil: null,
  id_rol: 2, rol_nombre: 'Operador', id_area: 3, area_nombre: 'Archivo', activo
});

const mockQueryAuth = (usuario) => {
  query.mockImplementation(async (text) => {
    if (text.includes('WHERE u.id_usuario = $1')) {
      return usuario ? { rows: [usuario] } : { rows: [] };
    }
    if (text.includes('FROM rol_permisos')) return { rows: [{ codigo: 'RECIBIDA_VER' }] };
    return { rows: [] };
  });
};

describe('authMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('Sin token → 401', async () => {
    const req = { headers: {}, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('Token inválido → 401', async () => {
    const req = { headers: { authorization: 'Bearer .invalido.' }, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('Token expirado → 401 sesión expirada', async () => {
    const token = jwt.sign({ id_usuario: 7 }, config.jwt.secret, { expiresIn: '-10s' });
    const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    mockQueryAuth(filaUsuario());
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('Token válido + usuario activo → next con req.user y permisos', async () => {
    const token = jwt.sign({ id_usuario: 7, username: 'mid_qa' }, config.jwt.secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    mockQueryAuth(filaUsuario(true));
    await authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe('mid_qa');
    expect(req.user.permisos).toContain('RECIBIDA_VER');
  });

  test('Usuario inexistente → 401', async () => {
    const token = jwt.sign({ id_usuario: 999 }, config.jwt.secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    mockQueryAuth(null);
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('Cuenta desactivada → 401', async () => {
    const token = jwt.sign({ id_usuario: 7 }, config.jwt.secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    mockQueryAuth(filaUsuario(false));
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('Error de BD → 401', async () => {
    const token = jwt.sign({ id_usuario: 7 }, config.jwt.secret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/x', url: '/x', socket: {} };
    const res = mockRes(); const next = jest.fn();
    query.mockRejectedValue(new Error('BD caída'));
    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('roleMiddleware', () => {
  test('requireRole permite rol autorizado', () => {
    const req = { user: { rol_nombre: 'Administrador' } };
    const res = mockRes(); const next = jest.fn();
    requireRole('Administrador')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('requireRole deniega otro rol → 403', () => {
    const req = { user: { rol_nombre: 'Operador' } };
    const res = mockRes(); const next = jest.fn();
    requireRole('Administrador')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireRole sin usuario → 403', () => {
    const req = {};
    const res = mockRes(); const next = jest.fn();
    requireRole('Administrador')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('requirePermission permite con permiso', () => {
    const req = { user: { permisos: ['RECIBIDA_CREAR'] } };
    const res = mockRes(); const next = jest.fn();
    requirePermission('RECIBIDA_CREAR')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('requirePermission deniega sin permiso → 403', () => {
    const req = { user: { permisos: ['RECIBIDA_VER'] } };
    const res = mockRes(); const next = jest.fn();
    requirePermission('RECIBIDA_CREAR')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('requirePermission sin usuario → 403', () => {
    const req = {};
    const res = mockRes(); const next = jest.fn();
    requirePermission('X')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
