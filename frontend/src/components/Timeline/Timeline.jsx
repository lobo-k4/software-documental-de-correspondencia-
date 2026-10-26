import React from 'react';
import { CheckCircle2, ArrowRightCircle, FileText, UploadCloud, Clock, Edit2, FolderArchive, XCircle } from 'lucide-react';
import { formatearFechaHoraBolivia } from '../../utils/fecha';

const ACTION_CONFIG = {
  REGISTRO_INICIAL:     { icon: FileText,        color: '#2563eb', bg: '#dbeafe', label: 'Registro Inicial' },
  EMISION_DESPACHO:     { icon: FileText,        color: '#2563eb', bg: '#dbeafe', label: 'Emisión / Despacho' },
  DERIVACION:           { icon: ArrowRightCircle, color: '#d97706', bg: '#fef3c7', label: 'Derivación' },
  DERIVACION_ACEPTADO:  { icon: ArrowRightCircle, color: '#d97706', bg: '#fef3c7', label: 'Derivación Aceptada' },
  ADJUNTAR_DOCUMENTO:   { icon: UploadCloud,      color: '#0284c7', bg: '#e0f2fe', label: 'Adjuntar Documento' },
  CAMBIO_ESTADO:        { icon: Edit2,            color: '#7c3aed', bg: '#ede9fe', label: 'Cambio de Estado' },
  ARCHIVADO:            { icon: FolderArchive,    color: '#475569', bg: '#f1f5f9', label: 'Archivado' },
  ANULACION:            { icon: XCircle,          color: '#dc2626', bg: '#fee2e2', label: 'Anulación' },
};

const DEFAULT_CONFIG = { icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7', label: 'Actualización' };

const Timeline = ({ items = [] }) => {
  if (!items || items.length === 0) {
    return (
      <div className="timeline-empty">
        <Clock size={28} style={{ opacity: 0.25, marginBottom: '8px' }} />
        <p>No hay registros de seguimiento disponibles.</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {items.map((item, idx) => {
        const config = ACTION_CONFIG[item.accion] || DEFAULT_CONFIG;
        const Icon = config.icon;
        const isLast = idx === items.length - 1;

        return (
          <div key={item.id_seguimiento || idx} className={`timeline-item ${isLast ? 'last' : ''}`}>
            {/* Línea vertical y nodo */}
            <div className="timeline-left">
              <div
                className="timeline-node"
                style={{ backgroundColor: config.bg, borderColor: config.color + '55' }}
              >
                <Icon size={14} color={config.color} />
              </div>
              {!isLast && <div className="timeline-line" />}
            </div>

            {/* Contenido */}
            <div className="timeline-card">
              <div className="timeline-card-header">
                <div>
                  <span className="timeline-action">{item.estado_nuevo || config.label || item.accion}</span>
                  {item.estado_anterior && item.estado_nuevo && (
                    <span className="timeline-transition">
                      <span className="timeline-state-from">{item.estado_anterior}</span>
                      <ArrowRightCircle size={10} />
                      <span className="timeline-state-to">{item.estado_nuevo}</span>
                    </span>
                  )}
                </div>
                <time className="timeline-time">
                  <Clock size={11} />
                  {formatearFechaHoraBolivia(item.fecha_hora)}
                </time>
              </div>

              {item.descripcion && (
                <p className="timeline-desc">{item.descripcion}</p>
              )}

              <div className="timeline-meta">
                <span>
                  <strong>{item.usuario_nombre || 'Sistema'}</strong>
                  {item.usuario_cargo && ` · ${item.usuario_cargo}`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;
