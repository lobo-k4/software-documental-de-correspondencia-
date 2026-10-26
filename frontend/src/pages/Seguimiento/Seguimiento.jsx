import { useState } from 'react';
import { Search, Clock, FileText, ArrowRight } from 'lucide-react';
import { seguimientos as seguimientosAPI } from '../../services/api';
import Timeline from '../../components/Timeline/Timeline';
import Badge from '../../components/Badge/Badge';
import { formatearFechaBolivia } from '../../utils/fecha';
import './Seguimiento.css';

export default function Seguimiento() {
  const [codigo, setCodigo]     = useState('');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const buscar = async () => {
    if (!codigo.trim()) return;
    setLoading(true);
    setError('');
    setResultado(null);
    try {
      const res = await seguimientosAPI.getByCodigo(codigo.trim());
      const data = res.data?.data || res.data;
      setResultado({
        ...data.documento,
        tipo: data.documento?.tipo_flujo?.toLowerCase(),
        area_nombre: data.documento?.area_responsable_nombre || data.documento?.area_remitente_nombre,
        seguimiento: data.linea_tiempo || []
      });
    } catch (err) {
      if (err.status === 404) {
        setError(`No se encontró ningún documento con el código "${codigo}".`);
      } else {
        setError('Error al realizar la búsqueda. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') buscar(); };

  return (
    <div className="page-container page-enter seguimiento-container">
      {/* Encabezado */}
      <div className="seguimiento-header-page">
        <h2>Seguimiento de Correspondencia</h2>
        <p>Consulte el estado, derivaciones y trayectoria de cualquier documento por su código</p>
      </div>

      {/* Buscador */}
      <div className="seguimiento-search-card">
        <label className="seguimiento-search-label">
          Ingrese el código del documento institucional
        </label>
        <div className="seguimiento-search-row">
          <input
            className="seguimiento-search-input"
            type="text"
            placeholder="Ej: COR-REC-2026-00001"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="btn btn-primary seguimiento-btn-track"
            onClick={buscar}
            disabled={loading || !codigo.trim()}
          >
            {loading ? <div className="spinner-sm"></div> : <><Search size={18} /> Rastrear Documento</>}
          </button>
        </div>
        {error && <div className="alert alert-danger" style={{ marginTop: '16px' }}>{error}</div>}
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="seguimiento-result-card">
          {/* Encabezado del documento */}
          <div className="seguimiento-doc-header">
            <div>
              <span className="seguimiento-doc-code">{resultado.codigo}</span>
              <h3 className="seguimiento-doc-asunto">{resultado.asunto}</h3>
            </div>
            <Badge type="estado" value={resultado.estado} size="lg" />
          </div>

          <div className="seguimiento-meta-grid">
            <div className="seguimiento-meta-item">
              <span className="seguimiento-meta-label">Tipo de Flujo</span>
              <span className="seguimiento-meta-val">
                {resultado.tipo === 'recibida' ? '📥 Correspondencia Recibida' : '📤 Correspondencia Entregada'}
              </span>
            </div>
            <div className="seguimiento-meta-item">
              <span className="seguimiento-meta-label">Remitente / Destinatario</span>
              <span className="seguimiento-meta-val">{resultado.remitente || resultado.destinatario || '—'}</span>
            </div>
            <div className="seguimiento-meta-item">
              <span className="seguimiento-meta-label">Área Asignada Actual</span>
              <span className="seguimiento-meta-val">{resultado.area_nombre || '—'}</span>
            </div>
            <div className="seguimiento-meta-item">
              <span className="seguimiento-meta-label">Fecha de Registro</span>
              <span className="seguimiento-meta-val">
                {resultado.fecha_recepcion || resultado.fecha_emision
                  ? formatearFechaBolivia(resultado.fecha_recepcion || resultado.fecha_emision)
                  : '—'}
              </span>
            </div>
          </div>

          {/* Timeline de seguimiento */}
          <div className="seguimiento-timeline-section">
            <h3 className="seguimiento-timeline-title">
              <FileText size={18} /> Historial y Hoja de Ruta
            </h3>
            {resultado.seguimiento && resultado.seguimiento.length > 0 ? (
              <Timeline items={resultado.seguimiento} />
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin eventos registrados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
