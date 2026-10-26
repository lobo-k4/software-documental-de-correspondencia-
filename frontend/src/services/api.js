/**
 * Cliente HTTP para comunicación con la API REST del backend.
 * Incluye gestión de tokens JWT, serialización de peticiones y control de errores.
 *
 * CARACTERÍSTICAS DE ROBUSTEZ:
 * - Timeout configurable por solicitud (por defecto 2 min).
 * - Reintento automático para fallos de red transitorios (ECONNRESET, socket hang up,
 *   "Failed to fetch"). Útil cuando el servidor acaba de arrancar y las primeras
 *   peticiones son rechazadas por el proxy de Vite o el keep-alive expira.
 * - Reintento extra para /auth/login (hasta 3 intentos con backoff).
 */

const BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 120 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Detecta errores transitorios de red / socket que merecen reintento.
const esErrorTransitorio = (err) => {
  if (!err) return false;
  // TypeError en fetch nativo usualmente es "Failed to fetch", ECONNRESET, etc.
  if (err instanceof TypeError) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('econnaborted') ||
    msg.includes('socket hang up') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network error') ||
    msg.includes('the user aborted a request') // casos raros
  );
};

// Cantidad de reintentos por endpoint. /login tiene más.
const reintentosPara = (endpoint = '') => {
  if (endpoint.startsWith('/auth/login')) return 2; // 1 petición + 2 reintentos = 3
  if (endpoint.startsWith('/auth/foto-perfil')) return 0; // Evita sobrescrituras duplicadas no idempotentes
  if (endpoint.startsWith('/notas/verificar/')) return 0; // La consulta QR incrementa un contador y no es idempotente
  return 1; // 1 petición + 1 reintento = 2
};

/**
 * Fetch envuelto con timeout y reintentos automáticos.
 */
const fetchConReintento = async (url, opciones = {}, endpoint = '') => {
  const maxIntentos = reintentosPara(endpoint) + 1;
  let ultimoError = null;
  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    const controller = new AbortController();
    const idTimeout = setTimeout(
      () => controller.abort(),
      opciones.timeoutMs || DEFAULT_TIMEOUT_MS
    );
    try {
      const res = await fetch(url, {
        ...opciones,
        signal: controller.signal
      });
      clearTimeout(idTimeout);
      return res;
    } catch (err) {
      clearTimeout(idTimeout);
      ultimoError = err;
      if (intento < maxIntentos && esErrorTransitorio(err)) {
        // Backoff: 500ms, luego 1200ms
        await sleep(350 * intento + 150 * (intento - 1));
        continue;
      }
      break;
    }
  }
  throw ultimoError;
};

/**
 * Obtener cabeceras con token de autenticación
 */
const getHeaders = (isFormData = false) => {
  const token = localStorage.getItem('token');
  const headers = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Manejo centralizado de la respuesta HTTP
 */
const handleResponse = async (response) => {
  if (response.status === 401) {
    // Si la sesión expiró o es inválida, limpiar y redirigir a login
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(data.message || 'Error en la solicitud al servidor');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  get: async (endpoint, params = {}, opciones = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });

    const url = `${BASE_URL}${endpoint}${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetchConReintento(url, {
      method: 'GET',
      headers: getHeaders(),
      timeoutMs: opciones.timeoutMs
    }, endpoint);

    return handleResponse(response);
  },

  post: async (endpoint, body = {}, opciones = {}) => {
    const response = await fetchConReintento(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: opciones.signal,
      timeoutMs: opciones.timeoutMs
    }, endpoint);

    return handleResponse(response);
  },

  put: async (endpoint, body = {}, opciones = {}) => {
    const response = await fetchConReintento(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
      timeoutMs: opciones.timeoutMs
    }, endpoint);

    return handleResponse(response);
  },

  patch: async (endpoint, body = {}, opciones = {}) => {
    const response = await fetchConReintento(`${BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body),
      timeoutMs: opciones.timeoutMs
    }, endpoint);

    return handleResponse(response);
  },

  delete: async (endpoint, opciones = {}) => {
    const response = await fetchConReintento(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
      timeoutMs: opciones.timeoutMs
    }, endpoint);

    return handleResponse(response);
  },

  upload: async (endpoint, formData, opciones = {}) => {
    const response = await fetchConReintento(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(true), // sin Content-Type para que el navegador configure el boundary multipart
      body: formData,
      timeoutMs: opciones.timeoutMs || 10 * 60 * 1000 // upload con timeout más holgado
    }, endpoint);

    return handleResponse(response);
  },

  download: async (endpoint, opciones = {}) => {
    const response = await fetchConReintento(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(),
      timeoutMs: opciones.timeoutMs || 5 * 60 * 1000
    }, endpoint);

    if (!response.ok) {
      await handleResponse(response);
    }

    return response.blob();
  }
};

export const plantillas = {
  getAll: (params = {}) => api.get('/plantillas', params),
  create: (body) => api.post('/plantillas', body),
  update: (id, body) => api.put(`/plantillas/${id}`, body)
};

export const notas = {
  getAll: (params = {}) => api.get('/notas', params),
  getById: (id) => api.get(`/notas/${encodeURIComponent(id)}`),
  verificar: (id) => api.get(`/notas/verificar/${encodeURIComponent(id)}`),
  previsualizar: (body) => api.post('/notas/previsualizar', body),
  generar: (body) => api.post('/notas/generar', body),
  getLimiteVerificaciones: (id) => api.get(`/notas/${encodeURIComponent(id)}/configuracion-qr`),
  actualizarLimiteVerificaciones: (id, body) => api.put(`/notas/${encodeURIComponent(id)}/configuracion-qr`, body),
  descargarPdf: (id) => descargarArchivo(`/notas/${id}/pdf`, `nota-${id}.pdf`),
  descargarWord: (id) => descargarArchivo(`/notas/${id}/docx`, `nota-${id}.docx`),
  registrarEntregada: (id, body) => api.post(`/notas/${id}/registrar-entregada`, body)
};

const descargarArchivo = async (endpoint, nombre) => {
  const blob = await api.download(endpoint);
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
};

export const scanner = {
  getDevices: () => api.get('/scanner/devices'),
  getCapabilities: (id) => api.get(`/scanner/devices/${encodeURIComponent(id)}/capabilities`),
  scan: (body, options) => api.post('/scanner/scan', body, options)
};

export const documentos = {
  getAll: (params = {}) => api.get('/documentos', params),
  descargar: async (id, filename = `documento-${id}`) => {
    const blob = await api.download(`/documentos/${id}/descargar`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
  eliminar: (id) => api.delete(`/documentos/${id}`)
};

export const derivaciones = {
  getAll: ({ q, estado, ...params } = {}) => api.get('/derivaciones', {
    ...params,
    estado_derivacion: estado,
    q
  }),
  cambiarEstado: (id, body) => api.patch(`/derivaciones/${id}/estado`, {
    estado_derivacion: body.estado,
    observaciones: body.observacion
  })
};

export const seguimientos = {
  getByCodigo: (codigo) => api.get('/seguimientos', { codigo })
};
