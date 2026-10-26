import React from 'react';

/* Mapa de estados → clase CSS */
const ESTADO_MAP = {
  'recibido':   'badge-recibido',
  'en revisión':'badge-revision',
  'revision':   'badge-revision',
  'derivado':   'badge-derivado',
  'en proceso': 'badge-proceso',
  'proceso':    'badge-proceso',
  'atendido':   'badge-atendido',
  'entregado':  'badge-atendido',
  'activo':     'badge-atendido',
  'aceptado':   'badge-atendido',
  'archivado':  'badge-archivado',
  'inactivo':   'badge-archivado',
  'rechazado':  'badge-archivado',
  'emitido':    'badge-emitido',
  'borrador':   'badge-emitido',
  'anulado':    'badge-anulado',
  'urgente':    'badge-urgente',
  'alta':       'badge-alta',
  'normal':     'badge-normal',
  'baja':       'badge-baja',
};

/* Puntos de color para el indicador visual */
const DOT_COLORS = {
  'badge-recibido':  '#1d4ed8',
  'badge-revision':  '#6d28d9',
  'badge-derivado':  '#92400e',
  'badge-proceso':   '#713f12',
  'badge-atendido':  '#14532d',
  'badge-archivado': '#475569',
  'badge-anulado':   '#991b1b',
  'badge-emitido':   '#1e40af',
  'badge-urgente':   '#991b1b',
  'badge-alta':      '#9a3412',
  'badge-normal':    '#1e40af',
  'badge-baja':      '#475569',
};

const Badge = ({ children, value, showDot = false }) => {
  const contenido = children ?? value;
  const val = String(contenido || '').toLowerCase().trim();
  const badgeClass = ESTADO_MAP[val] || 'badge-gray';
  const dotColor = DOT_COLORS[badgeClass];

  return (
    <span className={`badge ${badgeClass}`}>
      {showDot && dotColor && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {contenido}
    </span>
  );
};

export default Badge;
