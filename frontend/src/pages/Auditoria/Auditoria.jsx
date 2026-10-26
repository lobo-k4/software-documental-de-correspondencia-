import { useEffect, useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  RotateCcw, 
  Calendar, 
  User, 
  Eye, 
  ShieldCheck, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import Modal from '../../components/Modal/Modal';
import { formatearFechaBolivia, formatearFechaHoraBolivia, formatearHoraBolivia } from '../../utils/fecha';
import './Auditoria.css';

const ACCIONES = [
  'LOGIN',
  'LOGOUT',
  'CREAR',
  'ACTUALIZAR',
  'ELIMINAR',
  'ANULAR',
  'DERIVAR',
  'CAMBIAR_ESTADO',
  'SUBIR_ADJUNTO'
];

const MODULOS = [
  'AUTENTICACION',
  'CORRESPONDENCIA_RECIBIDA',
  'CORRESPONDENCIA_ENTREGADA',
  'DERIVACIONES',
  'DOCUMENTOS',
  'USUARIOS',
  'PLANTILLAS',
  'NOTAS'
];

export default function Auditoria() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Paginación
  const [paginacion, setPaginacion] = useState({
    total: 0,
    pagina: 1,
    limite: 20,
    total_paginas: 1
  });

  // Filtros
  const [filtros, setFiltros] = useState({
    username: '',
    accion: '',
    modulo: '',
    registro_afectado: '',
    fecha_inicio: '',
    fecha_fin: ''
  });

  // Modal para ver detalles completos
  const [detalleModal, setDetalleModal] = useState(null);

  const cargar = async (pagina = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        pagina,
        limite: paginacion.limite
      };
      if (filtros.username.trim()) params.username = filtros.username.trim();
      if (filtros.accion) params.accion = filtros.accion;
      if (filtros.modulo) params.modulo = filtros.modulo;
      if (filtros.registro_afectado.trim()) params.registro_afectado = filtros.registro_afectado.trim();
      if (filtros.fecha_inicio) params.fecha_inicio = filtros.fecha_inicio;
      if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin;

      const response = await api.get('/auditoria', params);
      const data = response.data || response;
      setItems(data.registros || []);
      if (data.paginacion) {
        setPaginacion(data.paginacion);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la auditoría del sistema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar(1);
  }, []);

  const handleBuscar = (e) => {
    e?.preventDefault();
    cargar(1);
  };

  const handleLimpiar = () => {
    setFiltros({
      username: '',
      accion: '',
      modulo: '',
      registro_afectado: '',
      fecha_inicio: '',
      fecha_fin: ''
    });
  };

  // Helper para badge de acción con semántica visual
  const renderAccionBadge = (accion) => {
    const act = (accion || '').toUpperCase();
    let badgeClass = 'badge-accion-auth';

    if (act.includes('CREAR') || act.includes('INSERT') || act.includes('SUBIR')) {
      badgeClass = 'badge-accion-crear';
    } else if (act.includes('ACTUALIZAR') || act.includes('MODIFICAR') || act.includes('CAMBIAR') || act.includes('DERIVAR')) {
      badgeClass = 'badge-accion-modificar';
    } else if (act.includes('ELIMINAR') || act.includes('ANULAR') || act.includes('ERROR')) {
      badgeClass = 'badge-accion-eliminar';
    }

    return (
      <span className={`badge-accion ${badgeClass}`}>
        {act}
      </span>
    );
  };

  return (
    <div className="page-container page-enter auditoria-container">
      {/* Encabezado */}
      <div className="auditoria-header">
        <div className="auditoria-header-title">
          <div className="auditoria-header-icon">
            <History size={22} />
          </div>
          <div className="auditoria-title-text">
            <h1>Bitácora de Auditoría</h1>
            <p>Registro cronológico de actividades y operaciones del sistema — Exclusivo Administrador</p>
          </div>
        </div>
      </div>

      {/* Panel de Filtros */}
      <div className="auditoria-filters-card">
        <form onSubmit={handleBuscar}>
          <div className="auditoria-filters-grid">
            <div className="auditoria-filter-field">
              <label>Usuario</label>
              <input
                className="form-input"
                type="text"
                placeholder="Filtrar por usuario..."
                value={filtros.username}
                onChange={e => setFiltros({ ...filtros, username: e.target.value })}
              />
            </div>
            <div className="auditoria-filter-field">
              <label>Módulo</label>
              <select
                className="form-select"
                value={filtros.modulo}
                onChange={e => setFiltros({ ...filtros, modulo: e.target.value })}
              >
                <option value="">Todos los Módulos</option>
                {MODULOS.map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="auditoria-filter-field">
              <label>Acción</label>
              <select
                className="form-select"
                value={filtros.accion}
                onChange={e => setFiltros({ ...filtros, accion: e.target.value })}
              >
                <option value="">Todas las Acciones</option>
                {ACCIONES.map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="auditoria-filter-field">
              <label>Código / Registro</label>
              <input
                className="form-input"
                type="text"
                placeholder="Ej. COR-REC-2026..."
                value={filtros.registro_afectado}
                onChange={e => setFiltros({ ...filtros, registro_afectado: e.target.value })}
              />
            </div>
            <div className="auditoria-filter-field">
              <label>Fecha Desde</label>
              <input
                className="form-input"
                type="date"
                value={filtros.fecha_inicio}
                onChange={e => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
              />
            </div>
            <div className="auditoria-filter-field">
              <label>Fecha Hasta</label>
              <input
                className="form-input"
                type="date"
                value={filtros.fecha_fin}
                onChange={e => setFiltros({ ...filtros, fecha_fin: e.target.value })}
              />
            </div>
          </div>

          <div className="auditoria-filters-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLimpiar}>
              <RotateCcw size={14} /> Limpiar
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              <Search size={14} /> {loading ? 'Buscando...' : 'Filtrar'}
            </button>
          </div>
        </form>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* Tabla de Registros */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
            <p style={{ margin: 0 }}>Consultando bitácora de auditoría...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <AlertCircle size={40} style={{ opacity: 0.35, marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No se encontraron registros de auditoría con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>Registro Afectado</th>
                  <th>Detalle de Operación</th>
                  <th style={{ textAlign: 'center' }}>Ver</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id_auditoria}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      <strong>{formatearFechaBolivia(item.fecha_hora)}</strong><br/>
                      <span style={{ color: 'var(--text-muted)' }}>{formatearHoraBolivia(item.fecha_hora)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.username || 'Sistema'}</span>
                      </div>
                    </td>
                    <td>{renderAccionBadge(item.accion)}</td>
                    <td>
                      <span className="badge-modulo">
                        {(item.modulo || '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {item.registro_afectado ? (
                        <span className="code-tag small">{item.registro_afectado}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }} title={item.detalles}>
                      {item.detalles || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Ver detalle del registro"
                        onClick={() => setDetalleModal(item)}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {paginacion.total > 0 && (
          <div className="pagination">
            <span>
              Mostrando {items.length} de <strong>{paginacion.total}</strong> eventos
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={paginacion.pagina <= 1 || loading}
                onClick={() => cargar(paginacion.pagina - 1)}
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Pág. {paginacion.pagina} de {paginacion.total_paginas}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={paginacion.pagina >= paginacion.total_paginas || loading}
                onClick={() => cargar(paginacion.pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detalle Completo de Auditoría */}
      <Modal
        isOpen={Boolean(detalleModal)}
        onClose={() => setDetalleModal(null)}
        title="Detalle de Evento de Auditoría"
        size="md"
      >
        {detalleModal && (
          <div className="auditoria-detail-list">
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">ID Registro</span>
              <span className="auditoria-detail-value">#{detalleModal.id_auditoria}</span>
            </div>
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">Fecha y Hora</span>
              <span className="auditoria-detail-value">{formatearFechaHoraBolivia(detalleModal.fecha_hora)}</span>
            </div>
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">Usuario</span>
              <span className="auditoria-detail-value">{detalleModal.username || 'Sistema'}</span>
            </div>
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">Módulo</span>
              <span className="badge-modulo">{detalleModal.modulo}</span>
            </div>
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">Acción</span>
              <span>{renderAccionBadge(detalleModal.accion)}</span>
            </div>
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">Registro Afectado</span>
              <span className="code-tag small">{detalleModal.registro_afectado || '—'}</span>
            </div>
            <div className="auditoria-detail-row">
              <span className="auditoria-detail-label">Dirección IP</span>
              <span className="auditoria-detail-value" style={{ fontFamily: 'monospace' }}>{detalleModal.ip_origen || 'No registrada'}</span>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Detalle de la Operación
              </label>
              <div className="auditoria-raw-box">
                {detalleModal.detalles || 'Sin detalles adicionales.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetalleModal(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}