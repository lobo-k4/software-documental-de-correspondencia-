const ZONA_HORARIA_BOLIVIA = 'America/La_Paz';

const obtenerFecha = (valor) => {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor !== 'string' || !valor.trim()) return null;

  const texto = valor.trim();
  const fechaCalendario = texto.match(/^(\d{4}-\d{2}-\d{2})$/);
  const fecha = new Date(fechaCalendario ? `${fechaCalendario[1]}T12:00:00Z` : texto.replace(' ', 'T'));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const formatearFechaBolivia = (valor, opciones = {}) => {
  const fecha = obtenerFecha(valor);
  if (!fecha) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opciones,
  }).format(fecha);
};

export const formatearFechaHoraBolivia = (valor) => formatearFechaBolivia(valor, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatearHoraBolivia = (valor) => {
  const fecha = obtenerFecha(valor);
  if (!fecha) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);
};

export const formatearFechaLargaBolivia = (valor) => formatearFechaBolivia(valor, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const fechaActualBoliviaISO = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
};
