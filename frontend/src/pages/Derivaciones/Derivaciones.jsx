import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import { api, derivaciones as derivacionesAPI } from '../../services/api';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Timeline from '../../components/Timeline/Timeline';
import { formatearFechaBolivia, formatearFechaHoraBolivia } from '../../utils/fecha';
import './Derivaciones.css';

// Formulario vacío de derivación
const FORM_VACIO = {
  id_recibida: '',
  id_area_destino: '',
  cargo_destino: '',
  responsable_destino: '',
  instruccion_observacion: ''
};

const ESTADOS_DOCUMENTO = ['Recibido', 'Derivado', 'En proceso', 'Atendido', 'Archivado'];
const ESTADOS_DERIVACION = ['Pendiente', 'Aceptado', 'Rechazado', 'Completado'];

export default function Derivaciones() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [mensaje, setMensaje]   = useState('');
  const [filtros, setFiltros]   = useState({ q: '', estado: '' });
  const [seleccionado, setSeleccionado] = useState(null);
  const [modalVer, setModalVer] = useState(false);
  const [modalCambiarEstado, setModalCambiarEstado] = useState(false);
  const [modalDerivar, setModalDerivar] = useState(false);
  const [areas, setAreas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [correspondencias, setCorrespondencias] = useState([]);
  const [derivarForm, setDerivarForm] = useState(FORM_VACIO);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filtros.q)      params.q      = filtros.q;
      if (filtros.estado) params.estado = filtros.estado;
      const res = await derivacionesAPI.getAll(params);
      setItems(res.data?.derivaciones || res.data?.data || res.data || []);
    } catch (err) {
      setError('Error al cargar derivaciones');
    } finally {
      setLoading(false);
    }
  }, [filtros.estado, filtros.q]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    Promise.all([
      api.get('/catalogos/areas'),
      api.get('/catalogos/cargos'),
      api.get('/correspondencia-recibida', { limite: 200, estado: 'Recibido' })
    ])
      .then(([areasRes, cargosRes, corrRes]) => {
        setAreas(areasRes.data || []);
        setCargos(cargosRes.data || []);
        // Normaliza cualquier forma que devuelva la API
        const lista = corrRes.data?.correspondencias
          || corrRes.data?.data
          || corrRes.data
          || [];
        setCorrespondencias(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        setAreas([]);
        setCargos([]);
        setCorrespondencias([]);
      });
  }, []);

  const handleFiltro = (campo, valor) => { setMensaje(''); setFiltros(f => ({ ...f, [campo]: valor })); };

  const abrirVer = (item) => { setSeleccionado(item); setModalVer(true); };

  const abrirCambiarEstado = (item) => {
    setSeleccionado(item);
    setNuevoEstado('');
    setObservacion('');
    setModalCambiarEstado(true);
  };

  const abrirDerivar = (item = null) => {
    // Siempre reseteamos el formulario completo para evitar valores residuales
    setDerivarForm({
      ...FORM_VACIO,
      // id_recibida siempre es el ID numérico, nunca el código de texto
      id_recibida: item?.id_recibida ? String(item.id_recibida) : ''
    });
    setSeleccionado(item);
    setMensaje('');
    setError('');
    setModalDerivar(true);
  };

  const handleDerivar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');

    const idRecibida = Number(derivarForm.id_recibida);
    const idAreaDestino = Number(derivarForm.id_area_destino);

    // Validación en frontend antes de enviar
    if (!idRecibida || !idAreaDestino || !derivarForm.cargo_destino) {
      setError('Debe seleccionar la correspondencia, el área de destino y el cargo responsable.');
      setGuardando(false);
      return;
    }

    try {
      const res = await api.post('/derivaciones', {
        id_recibida: idRecibida,
        id_area_destino: idAreaDestino,
        cargo_destino: derivarForm.cargo_destino,
        responsable_destino: derivarForm.responsable_destino?.trim()
          ? derivarForm.responsable_destino.trim()
          : derivarForm.cargo_destino,
        instruccion_observacion: derivarForm.instruccion_observacion
      });
      setModalDerivar(false);
      setMensaje(res?.message || 'Derivación registrada correctamente.');
      await cargar();
    } catch (err) {
      setError(err.data?.message || err.message || 'Error al derivar correspondencia.');
    } finally {
      setGuardando(false);
    }
  };

  const handleCambiarEstado = async () => {
    if (!nuevoEstado) return;
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await derivacionesAPI.cambiarEstado(seleccionado.id_derivacion, { estado: nuevoEstado, observacion });
      setModalCambiarEstado(false);
      setMensaje('Estado actualizado correctamente.');
      await cargar();
    } catch (err) {
      setError(err.data?.message || err.message || 'Error al cambiar estado');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="page-container page-enter derivaciones-container">
      {/* Encabezado */}
      <div className="derivaciones-header">
        <div className="derivaciones-header-info">
          <h2>Derivaciones de Correspondencia</h2>
          <p>Derive documentos y consulte su trazabilidad entre áreas</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirDerivar()}>
          <Plus size={16} />
          <span>Derivar correspondencia</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="derivaciones-filters-card">
        <div className="derivaciones-filters-row">
          <div className="derivaciones-search-wrap">
            <input
              className="form-input"
              type="text"
              placeholder="Buscar por código o área..."
              value={filtros.q}
              onChange={e => handleFiltro('q', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && cargar()}
            />
          </div>
          <div className="derivaciones-filter-select">
            <select
              className="form-select"
              value={filtros.estado}
              onChange={e => handleFiltro('estado', e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_DOCUMENTO.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={cargar}>
            <Search size={15} />
            <span>Buscar</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}
      {mensaje && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{mensaje}</div>}

      <div className="derivaciones-table-card">
        {loading ? (
          <div className="table-loading" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="derivaciones-table">
              <thead>
                <tr>
                  <th>Código Correspondencia</th>
                  <th>Área Origen</th>
                  <th>Área Destino</th>
                  <th>Asignado a</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Sin registros de derivación encontrados
                    </td>
                  </tr>
                ) : items.map(d => (
                  <tr key={d.id_recibida}>
                    <td>
                      <span className="derivaciones-code">
                        {d.codigo_correspondencia || d.correspondencia_codigo || d.id_recibida || '—'}
                      </span>
                    </td>
                    <td>{d.area_origen_nombre || '—'}</td>
                    <td>{d.area_destino_nombre || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente de derivar</span>}</td>
                    <td>{d.responsable_nombre || '—'}</td>
                    <td><Badge type="estado" value={d.estado_derivacion || d.estado || 'Recibido'} /></td>
                    <td>{formatearFechaBolivia(d.fecha_derivacion || d.fecha_recepcion)}</td>
                    <td>
                      <div className="derivaciones-actions" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-derivacion-action view"
                          title="Ver detalle"
                          onClick={() => abrirVer(d)}
                        >
                          <Eye size={15} />
                        </button>
                        {d.id_derivacion && d.estado && !['Atendido', 'Archivado'].includes(d.estado) && (
                          <button
                            type="button"
                            className="btn-derivacion-action status"
                            title="Cambiar estado"
                            onClick={() => abrirCambiarEstado(d)}
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-derivacion-action derive"
                          title={d.id_derivacion ? 'Derivar nuevamente' : 'Derivar correspondencia'}
                          onClick={() => abrirDerivar(d)}
                        >
                          <GitBranch size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ver */}
      <Modal isOpen={modalVer} onClose={() => setModalVer(false)} title="Detalle de Derivación" size="md">
        {seleccionado && (
          <div className="derivacion-detail-grid">
            <div className="derivacion-detail-item">
              <span className="derivacion-detail-label">Código</span>
              <span className="derivaciones-code">{seleccionado.codigo_correspondencia || '—'}</span>
            </div>
            <div className="derivacion-detail-item">
              <span className="derivacion-detail-label">Área Origen</span>
              <span className="derivacion-detail-value">{seleccionado.area_origen_nombre || '—'}</span>
            </div>
            <div className="derivacion-detail-item">
              <span className="derivacion-detail-label">Área Destino</span>
              <span className="derivacion-detail-value">{seleccionado.area_destino_nombre || '—'}</span>
            </div>
            <div className="derivacion-detail-item">
              <span className="derivacion-detail-label">Cargo Responsable</span>
              <span className="derivacion-detail-value">{seleccionado.cargo_destino || seleccionado.responsable_destino || seleccionado.responsable_nombre || '—'}</span>
            </div>
            <div className="derivacion-detail-item">
              <span className="derivacion-detail-label">Estado</span>
              <Badge type="estado" value={seleccionado.estado_derivacion || seleccionado.estado} />
            </div>
            <div className="derivacion-detail-item derivacion-detail-obs">
              <span className="derivacion-detail-label">Observaciones</span>
              <span className="derivacion-detail-value">{seleccionado.observaciones || seleccionado.instruccion_observacion || 'Sin observaciones'}</span>
            </div>
            <div className="derivacion-detail-item">
              <span className="derivacion-detail-label">Fecha</span>
              <span className="derivacion-detail-value">{formatearFechaHoraBolivia(seleccionado.fecha_derivacion)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Cambiar Estado */}
      <Modal isOpen={modalCambiarEstado} onClose={() => setModalCambiarEstado(false)} title="Cambiar Estado de Derivación" size="sm">
        <div className="form-group">
          <label className="form-label">Nuevo Estado *</label>
          <select className="form-input" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
            <option value="">Seleccionar...</option>
            {ESTADOS_DERIVACION.map(estado => <option key={estado} value={estado}>{estado}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Observación</label>
          <textarea className="form-input" rows={3} value={observacion} onChange={e => setObservacion(e.target.value)} placeholder="Motivo del cambio..." />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setModalCambiarEstado(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCambiarEstado} disabled={!nuevoEstado || guardando}>
            {guardando ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={modalDerivar} onClose={() => setModalDerivar(false)} title="Derivar Correspondencia" size="md">
        <form onSubmit={handleDerivar}>
          <div className="form-group">
            <label className="form-label">Correspondencia *</label>
            {seleccionado ? (
              /* ── Item preseleccionado desde la tabla: mostramos solo lectura ── */
              <div className="form-input" style={{ background: 'var(--bg-input-disabled)', cursor: 'default', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {seleccionado.codigo_correspondencia || `#${seleccionado.id_recibida}`}
                </span>
                {seleccionado.area_origen_nombre && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>— {seleccionado.area_origen_nombre}</span>
                )}
              </div>
            ) : (
              /* ── Sin preselección: el usuario elige de la lista ── */
              <select
                className="form-input"
                value={derivarForm.id_recibida}
                onChange={event => setDerivarForm(form => ({ ...form, id_recibida: event.target.value }))}
                required
              >
                <option value="">— Seleccione una correspondencia —</option>
                {correspondencias.length > 0
                  ? correspondencias.map(c => (
                      <option key={c.id_recibida} value={c.id_recibida}>
                        {c.codigo || c.codigo_correspondencia || `#${c.id_recibida}`}
                        {c.asunto ? ` · ${c.asunto}` : ''}
                      </option>
                    ))
                  : <option disabled>No hay correspondencias disponibles</option>
                }
              </select>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Área destino *</label>
            <select
              className="form-input"
              value={derivarForm.id_area_destino}
              onChange={event => setDerivarForm(form => ({ ...form, id_area_destino: event.target.value, cargo_destino: '', responsable_destino: '' }))}
              required
            >
              <option value="">Seleccione un área</option>
              {areas.map(area => <option key={area.id_area} value={area.id_area}>{area.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cargo Responsable en Destino *</label>
            <select
              className="form-input"
              value={derivarForm.cargo_destino}
              disabled={!derivarForm.id_area_destino}
              onChange={event => setDerivarForm(form => ({ ...form, cargo_destino: event.target.value }))}
              required
            >
              <option value="">
                {derivarForm.id_area_destino ? '-- Seleccione Cargo Responsable --' : 'Primero seleccione Área destino'}
              </option>
              {cargos
                .filter(c => Number(c.id_area) === Number(derivarForm.id_area_destino))
                .map(c => (
                  <option key={c.id_cargo} value={c.nombre}>{c.nombre}</option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Responsable Destino</label>
            <input
              className="form-input"
              type="text"
              value={derivarForm.responsable_destino}
              onChange={event => setDerivarForm(form => ({ ...form, responsable_destino: event.target.value }))}
              placeholder="Nombre del responsable en el área destino"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Observación</label>
            <textarea
              className="form-input"
              rows={4}
              value={derivarForm.instruccion_observacion}
              onChange={event => setDerivarForm(form => ({ ...form, instruccion_observacion: event.target.value }))}
              placeholder="Indique el motivo o las instrucciones de la derivación"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setModalDerivar(false)}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={guardando || !derivarForm.id_recibida || !derivarForm.id_area_destino || !derivarForm.cargo_destino}
            >
              {guardando ? 'Derivando...' : 'Derivar Correspondencia'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
