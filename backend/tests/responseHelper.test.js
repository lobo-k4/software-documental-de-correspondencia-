/**
 * Suite responseHelper — cobertura directa de todos los helpers de respuesta.
 */
process.env.NODE_ENV = 'test';

const helper = require('../src/utils/responseHelper');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('responseHelper', () => {
  test('success → 200 con envoltorio', () => {
    const res = mockRes();
    helper.success(res, { a: 1 }, 'ok');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'ok', data: { a: 1 } });
  });

  test('success con status personalizado', () => {
    const res = mockRes();
    helper.success(res, null, 'x', 202);
    expect(res.status).toHaveBeenCalledWith(202);
  });

  test('created → 201', () => {
    const res = mockRes();
    helper.created(res, { id: 1 }, 'creado');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('badRequest → 400', () => {
    const res = mockRes();
    helper.badRequest(res, 'mal', { campo: 'x' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'mal', errors: { campo: 'x' } });
  });

  test('unauthorized → 401', () => {
    const res = mockRes();
    helper.unauthorized(res, 'no');
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('forbidden → 403', () => {
    const res = mockRes();
    helper.forbidden(res, 'denegado');
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('notFound → 404', () => {
    const res = mockRes();
    helper.notFound(res, 'ausente');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('conflict → 409', () => {
    const res = mockRes();
    helper.conflict(res, 'duplicado');
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('serverError en development expone error.message', () => {
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = mockRes();
      helper.serverError(res, 'falló', new Error('detalle'));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'falló', error: 'detalle' })
      );
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });

  test('serverError sin error no incluye campo error', () => {
    const res = mockRes();
    helper.serverError(res, 'falló');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'falló' })
    );
  });
});
