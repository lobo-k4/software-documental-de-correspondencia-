import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Eye, 
  Paperclip, 
  Download,
  Clock,
  CheckCircle2,
  FileText,
  Send,
  ScanLine,
  Edit3,
  Ban,
  LoaderCircle
} from 'lucide-react';
import { api, documentos as documentosAPI } from '../../services/api';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Timeline from '../../components/Timeline/Timeline';
import ScannerDialog from '../../components/ScannerDialog/ScannerDialog';
import { useAuth } from '../../hooks/useAuth';
import { formatearFechaBolivia, formatearFechaHoraBolivia } from '../../utils/fecha';

const CorrespondenciaEntregada = () => {
  const { hasPermission, hasRole } = useAuth();
  const { id: idNotificado } = useParams();

  const [items, setItems] = useState([]);
  const [paginacion, setPaginacion] = useState({ total: 0, pagina: 1, limite: 10, total_paginas: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroMedio, setFiltroMedio] = useState('');

  // Catálogos
  const [areas, setAreas] = useState([]);
  const [tiposDoc, setTiposDoc] = useState([]);

  // Modales
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalAnularOpen, setModalAnularOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalAdjuntarOpen, setModalAdjuntarOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [scannerAdjuntoOpen, setScannerAdjuntoOpen] = useState(false);

  // Registro seleccionado
  const [selectedItem, setSelectedItem] = useState(null);
  const [detalleItem, setDetalleItem] = useState(null);

  // Formularios
  const [nuevoForm, setNuevoForm] = useState({
    numero_nota: '',
    destinatario: '',
    institucion_destinatario: '',
    cargo_destinatario: '',
    asunto: '',
    id_tipo_doc: '',
    id_area_remitente: '',
    responsable_remitente: '',
    medio_entrega: 'Entrega física',
    observaciones: '',
    archivo: null,
    archivo_escaneado: null
  });

  const [estadoForm, setEstadoForm] = useState({
    nuevo_estado: 'Entregado',
    observaciones: ''
  });

  const [adjuntoFile, setAdjuntoFile] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [mensajeFeedback, setMensajeFeedback] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const handleConfirmarEscaneo = (archivo) => setNuevoForm(form => ({
    ...form,
    archivo_escaneado: archivo
  }));
  const handleConfirmarEscaneoAdjunto = (archivo) => setAdjuntoFile(archivo);
  const [descargandoId, setDescargandoId] = useState(null);

  const handleDescargarAdjunto = async (adj) => {
    try {
      setDescargandoId(adj.id_documento);
      await documentosAPI.descargar(adj.id_documento, adj.nombre_original || `documento-${adj.id_documento}`);
    } catch (err) {
      console.error('Error al descargar documento:', err);
      alert('Error al descargar el archivo: ' + (err.message || 'No se pudo completar la descarga.'));
    } finally {
      setDescargandoId(null);
    }
  };

  const fetchData = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/correspondencia-entregada', {
        busqueda,
        estado: filtroEstado,
        id_area_remitente: filtroArea,
        medio_entrega: filtroMedio,
        pagina: page,
        limite: paginacion.limite
      });
      if (res.success) {
        setItems(res.data.correspondencias);
        setPaginacion(res.data.paginacion);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar correspondencia entregada.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const [areasRes, tiposRes] = await Promise.all([
          api.get('/catalogos/areas'),
          api.get('/catalogos/tipos-documento')
        ]);
        if (areasRes.success) setAreas(areasRes.data);
        if (tiposRes.success) setTiposDoc(tiposRes.data);
      } catch (e) {
        console.error('Error al cargar catálogos:', e);
      }
    };
    fetchCatalogos();
  }, []);

  useEffect(() => {
    fetchData(1);
  }, [filtroEstado, filtroArea, filtroMedio]);

  const handleBuscar = (e) => {
    e.preventDefault();
    fetchData(1);
  };

  const handleOpenDetalle = async (id) => {
    try {
      const res = await api.get(`/correspondencia-entregada/${id}`);
      if (res.success) {
        setDetalleItem(res.data);
        setModalDetalleOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Error al obtener detalle.');
    }
  };

  useEffect(() => {
    if (idNotificado) handleOpenDetalle(idNotificado);
  }, [idNotificado]);

  const handleCrearSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const formData = new FormData();
      Object.entries(nuevoForm).forEach(([k, v]) => {
        if ((k === 'archivo' || k === 'archivo_escaneado') && v) {
          formData.append(k, v);
        } else if (v !== null && v !== undefined && k !== 'archivo' && k !== 'archivo_escaneado') {
          formData.append(k, v);
        }
      });

      const res = await api.upload('/correspondencia-entregada', formData);
      if (res.success) {
        setMensajeFeedback(`Correspondencia de salida registrada con código: ${res.data.codigo}`);
        setModalNuevoOpen(false);
        setNuevoForm({
          numero_nota: '',
          destinatario: '',
          institucion_destinatario: '',
          cargo_destinatario: '',
          asunto: '',
          id_tipo_doc: '',
          id_area_remitente: '',
          responsable_remitente: '',
          medio_entrega: 'Entrega física',
          observaciones: '',
          archivo: null,
          archivo_escaneado: null
        });
        fetchData(1);
      }
    } catch (err) {
      alert(err.message || 'Error al registrar correspondencia entregada.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditarSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const { archivo, ...datos } = nuevoForm;
      const res = await api.put(`/correspondencia-entregada/${selectedItem.id_entregada}`, datos);
      if (res.success) {
        setMensajeFeedback('Correspondencia entregada actualizada correctamente.');
        setModalEditarOpen(false);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al actualizar correspondencia de salida.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnular = (item) => {
    setSelectedItem(item);
    setMotivoAnulacion('');
    setModalAnularOpen(true);
  };

  const handleConfirmarAnulacion = async (e) => {
    e.preventDefault();
    if (!motivoAnulacion.trim()) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/correspondencia-entregada/${selectedItem.id_entregada}/anular`, { motivo_anulacion: motivoAnulacion });
      if (res.success) {
        setMensajeFeedback('Correspondencia entregada anulada correctamente.');
        setModalAnularOpen(false);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al anular correspondencia de salida.');
    } finally {
      setActionLoading(false);
    }
  };

  const abrirEdicion = (item) => {
    setSelectedItem(item);
    setNuevoForm({
      numero_nota: item.numero_nota || '',
      destinatario: item.destinatario || '',
      institucion_destinatario: item.institucion_destinatario || '',
      cargo_destinatario: item.cargo_destinatario || '',
      asunto: item.asunto || '',
      id_tipo_doc: item.id_tipo_doc || '',
      id_area_remitente: item.id_area_remitente || '',
      responsable_remitente: item.responsable_remitente || '',
      medio_entrega: item.medio_entrega || 'Entrega física',
      observaciones: item.observaciones || '',
      archivo: null,
      archivo_escaneado: null
    });
    setModalEditarOpen(true);
  };

  const handleEstadoSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.patch(`/correspondencia-entregada/${selectedItem.id_entregada}/estado`, estadoForm);
      if (res.success) {
        setMensajeFeedback(`Estado actualizado a: ${res.data.nuevo_estado}`);
        setModalEstadoOpen(false);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al cambiar estado.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjuntarSubmit = async (e) => {
    e.preventDefault();
    if (!adjuntoFile) return alert('Seleccione un archivo.');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('archivo', adjuntoFile);
      const res = await api.upload(`/correspondencia-entregada/${selectedItem.id_entregada}/adjuntos`, formData);
      if (res.success) {
        setMensajeFeedback('Documento adjuntado exitosamente.');
        setModalAdjuntarOpen(false);
        setAdjuntoFile(null);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al adjuntar.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-container page-enter">
      {mensajeFeedback && (
        <div style={{
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success-dark)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{mensajeFeedback}</span>
          <button onClick={() => setMensajeFeedback('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Correspondencia Entregada (Mesa de Salida)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Registro, digitalización y control de despachos y envíos institucionales
          </p>
        </div>
        {hasPermission('ENTREGADA_CREAR') && (
          <button onClick={() => setModalNuevoOpen(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>Nuevo Despacho</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por código, número de nota, destinatario, asunto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select className="form-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los Estados</option>
              <option value="Borrador">Borrador</option>
              <option value="Emitido">Emitido</option>
              <option value="Entregado">Entregado</option>
              <option value="Archivado">Archivado</option>
              <option value="ANULADO">ANULADO</option>
            </select>
          </div>

          <div style={{ width: '200px' }}>
            <select className="form-select" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
              <option value="">Todas las Áreas</option>
              {areas.map(a => (
                <option key={a.id_area} value={a.id_area}>{a.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '170px' }}>
            <select className="form-select" value={filtroMedio} onChange={(e) => setFiltroMedio(e.target.value)}>
              <option value="">Medio de Entrega</option>
              <option value="Entrega física">Entrega física</option>
              <option value="Correo electrónico">Correo electrónico</option>
              <option value="Mensajería">Mensajería</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            <Search size={16} />
            <span>Filtrar</span>
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>N° Nota</th>
                <th>Fecha Emisión</th>
                <th>Destinatario</th>
                <th>Asunto</th>
                <th>Área Remitente</th>
                <th>Responsable</th>
                <th>Medio</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Adjuntos</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Cargando correspondencia entregada...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron registros de correspondencia entregada.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id_entregada}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {item.codigo}
                    </td>
                    <td><strong>{item.numero_nota}</strong></td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatearFechaBolivia(item.fecha_emision)}<br/>
                      <span style={{ color: 'var(--text-muted)' }}>{item.hora_emision?.substring(0, 5)}</span>
                    </td>
                    <td>
                      <strong>{item.destinatario}</strong>
                      {item.institucion_destinatario && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.institucion_destinatario}</div>
                      )}
                    </td>
                    <td style={{ maxWidth: '260px' }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {item.asunto}
                      </div>
                    </td>
                    <td><span title={item.area_remitente_nombre}>{item.area_remitente_sigla || item.area_remitente_nombre}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{item.responsable_remitente}</td>
                    <td><span className="badge" style={{ backgroundColor: 'var(--bg-subtle)' }}>{item.medio_entrega}</span></td>
                    <td><Badge>{item.estado}</Badge></td>
                    <td style={{ textAlign: 'center' }}>
                      {parseInt(item.total_adjuntos, 10) > 0 ? (
                        <span className="badge" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
                          <Paperclip size={12} style={{ marginRight: '2px' }} />
                          {item.total_adjuntos}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--border-strong)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetalle(item.id_entregada)}
                          className="btn-action btn-action-view"
                          title="Ver Detalle"
                        >
                          <Eye size={15} />
                        </button>

                        {hasPermission('ENTREGADA_EDITAR') && item.estado !== 'ANULADO' && (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirEdicion(item)}
                              className="btn-action btn-action-edit"
                              title="Editar correspondencia"
                            >
                              <Edit3 size={15} />
                            </button>
                            {hasRole('Administrador') && (
                              <button
                                type="button"
                                onClick={() => handleAnular(item)}
                                className="btn-action btn-action-ban"
                                title="Anular correspondencia"
                                disabled={actionLoading}
                              >
                                <Ban size={15} />
                              </button>
                            )}
                          </>
                        )}

                        {hasPermission('ENTREGADA_EDITAR') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setEstadoForm({ nuevo_estado: item.estado, observaciones: '' });
                              setModalEstadoOpen(true);
                            }}
                            className="btn-action btn-action-status"
                            title="Cambiar Estado"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}

                        {hasPermission('ARCHIVO_SUBIR') && item.estado !== 'ANULADO' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setAdjuntoFile(null);
                              setModalAdjuntarOpen(true);
                            }}
                            className="btn-action btn-action-attach"
                            title="Adjuntar Respaldo Digital"
                          >
                            <Paperclip size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {paginacion.total > 0 && (
          <div className="pagination" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Mostrando {items.length} de {paginacion.total} registros
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={paginacion.pagina <= 1}
                onClick={() => fetchData(paginacion.pagina - 1)}
                className="btn btn-secondary btn-sm"
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.85rem', padding: '4px 10px', color: 'var(--text-secondary)' }}>
                Página {paginacion.pagina} de {paginacion.total_paginas}
              </span>
              <button
                disabled={paginacion.pagina >= paginacion.total_paginas}
                onClick={() => fetchData(paginacion.pagina + 1)}
                className="btn btn-secondary btn-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: REGISTRAR NUEVA CORRESPONDENCIA ENTREGADA */}
      <Modal
        isOpen={modalNuevoOpen}
        onClose={() => setModalNuevoOpen(false)}
        title="Registrar Correspondencia Entregada (Salida)"
        maxWidth="720px"
      >
        <form onSubmit={handleCrearSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número de Nota / Oficio *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. NOT-DIR-002/2026"
                value={nuevoForm.numero_nota}
                onChange={(e) => setNuevoForm({ ...nuevoForm, numero_nota: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Documento *</label>
              <select
                className="form-select"
                value={nuevoForm.id_tipo_doc}
                onChange={(e) => setNuevoForm({ ...nuevoForm, id_tipo_doc: e.target.value })}
                required
              >
                <option value="">Seleccione Tipo</option>
                {tiposDoc.map(t => (
                  <option key={t.id_tipo_doc} value={t.id_tipo_doc}>{t.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Destinatario *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre del receptor"
                value={nuevoForm.destinatario}
                onChange={(e) => setNuevoForm({ ...nuevoForm, destinatario: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Institución del Destinatario</label>
              <input
                type="text"
                className="form-input"
                placeholder="Empresa u organismo externo"
                value={nuevoForm.institucion_destinatario}
                onChange={(e) => setNuevoForm({ ...nuevoForm, institucion_destinatario: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Asunto / Referencia *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contenido central del despacho"
              value={nuevoForm.asunto}
              onChange={(e) => setNuevoForm({ ...nuevoForm, asunto: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Área Remitente *</label>
              <select
                className="form-select"
                value={nuevoForm.id_area_remitente}
                onChange={(e) => setNuevoForm({ ...nuevoForm, id_area_remitente: e.target.value })}
                required
              >
                <option value="">Seleccione Área Emisora</option>
                {areas.map(a => (
                  <option key={a.id_area} value={a.id_area}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Funcionario Responsable Remitente *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre del firmante / remitente"
                value={nuevoForm.responsable_remitente}
                onChange={(e) => setNuevoForm({ ...nuevoForm, responsable_remitente: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Medio de Entrega *</label>
              <select
                className="form-select"
                value={nuevoForm.medio_entrega}
                onChange={(e) => setNuevoForm({ ...nuevoForm, medio_entrega: e.target.value })}
                required
              >
                <option value="Entrega física">Entrega física</option>
                <option value="Correo electrónico">Correo electrónico</option>
                <option value="Mensajería">Mensajería</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Copia Digital / Firma (Opcional)</label>
              <input
                type="file"
                className="form-input"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.png"
                onChange={(e) => setNuevoForm({ ...nuevoForm, archivo: e.target.files[0] })}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScannerDialogOpen(true)}
                style={{ marginTop: '8px' }}
                title="Detectar un escáner WIA conectado a este equipo"
              >
                <ScanLine size={16} />
                <span>Escanear documento</span>
              </button>
              {nuevoForm.archivo && (
                <small style={{ display: 'block', marginTop: '6px', color: 'var(--success-dark)' }}>
                  Documento seleccionado: {nuevoForm.archivo.name}
                </small>
              )}
              {nuevoForm.archivo_escaneado && (
                <small style={{ display: 'block', marginTop: '6px', color: 'var(--success-dark)' }}>
                  Documento escaneado listo para adjuntar: {nuevoForm.archivo_escaneado.name}
                </small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Detalles de mensajería, número de guía o despacho..."
              value={nuevoForm.observaciones}
              onChange={(e) => setNuevoForm({ ...nuevoForm, observaciones: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalNuevoOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">
              {actionLoading ? 'Registrando...' : 'Registrar Salida'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDITAR CORRESPONDENCIA ENTREGADA */}
      <Modal
        isOpen={modalEditarOpen}
        onClose={() => setModalEditarOpen(false)}
        title={`Editar Salida: ${selectedItem?.codigo}`}
        maxWidth="720px"
      >
        <form onSubmit={handleEditarSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Número de Nota / Oficio *</label>
              <input className="form-input" value={nuevoForm.numero_nota} onChange={(e) => setNuevoForm({ ...nuevoForm, numero_nota: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Documento *</label>
              <select className="form-select" value={nuevoForm.id_tipo_doc} onChange={(e) => setNuevoForm({ ...nuevoForm, id_tipo_doc: e.target.value })} required>
                <option value="">Seleccione Tipo</option>
                {tiposDoc.map(t => <option key={t.id_tipo_doc} value={t.id_tipo_doc}>{t.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Destinatario *</label>
              <input className="form-input" value={nuevoForm.destinatario} onChange={(e) => setNuevoForm({ ...nuevoForm, destinatario: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Institución del Destinatario</label>
              <input className="form-input" value={nuevoForm.institucion_destinatario} onChange={(e) => setNuevoForm({ ...nuevoForm, institucion_destinatario: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo del Destinatario</label>
              <input className="form-input" value={nuevoForm.cargo_destinatario} onChange={(e) => setNuevoForm({ ...nuevoForm, cargo_destinatario: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Asunto / Referencia *</label>
              <input className="form-input" value={nuevoForm.asunto} onChange={(e) => setNuevoForm({ ...nuevoForm, asunto: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Área Remitente *</label>
              <select className="form-select" value={nuevoForm.id_area_remitente} onChange={(e) => setNuevoForm({ ...nuevoForm, id_area_remitente: e.target.value })} required>
                <option value="">Seleccione Área Emisora</option>
                {areas.map(a => <option key={a.id_area} value={a.id_area}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Funcionario Responsable Remitente *</label>
              <input className="form-input" value={nuevoForm.responsable_remitente} onChange={(e) => setNuevoForm({ ...nuevoForm, responsable_remitente: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Medio de Entrega *</label>
              <select className="form-select" value={nuevoForm.medio_entrega} onChange={(e) => setNuevoForm({ ...nuevoForm, medio_entrega: e.target.value })} required>
                <option value="Entrega física">Entrega física</option><option value="Correo electrónico">Correo electrónico</option><option value="Mensajería">Mensajería</option><option value="Otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea className="form-textarea" rows="3" value={nuevoForm.observaciones} onChange={(e) => setNuevoForm({ ...nuevoForm, observaciones: e.target.value })}></textarea>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalEditarOpen(false)} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">{actionLoading ? 'Guardando...' : 'Guardar Cambios'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalAnularOpen} onClose={() => setModalAnularOpen(false)} title={`Anular Salida: ${selectedItem?.codigo}`} maxWidth="500px">
        <form onSubmit={handleConfirmarAnulacion}>
          <p style={{ marginBottom: '16px' }}>¿Está seguro de que desea anular esta correspondencia?</p>
          <div className="form-group">
            <label className="form-label">Motivo de la anulación *</label>
            <textarea className="form-textarea" rows="4" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} placeholder="Ej. Registro duplicado." required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalAnularOpen(false)} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={actionLoading || !motivoAnulacion.trim()} className="btn btn-primary">{actionLoading ? 'Anulando...' : 'Confirmar anulación'}</button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: DETALLE Y LÍNEA DE TIEMPO */}
      <Modal
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        title={`Detalle de Salida: ${detalleItem?.codigo}`}
        maxWidth="800px"
      >
        {detalleItem && (
          <div>
            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{detalleItem.asunto}</span>
                <Badge>{detalleItem.estado}</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                <div><strong>N° Nota:</strong> {detalleItem.numero_nota}</div>
                <div><strong>Destinatario:</strong> {detalleItem.destinatario} {detalleItem.institucion_destinatario ? `(${detalleItem.institucion_destinatario})` : ''}</div>
                <div><strong>Área Remitente:</strong> {detalleItem.area_remitente_nombre}</div>
                <div><strong>Responsable:</strong> {detalleItem.responsable_remitente}</div>
                <div><strong>Medio:</strong> {detalleItem.medio_entrega}</div>
                <div><strong>Fecha:</strong> {formatearFechaBolivia(detalleItem.fecha_emision)}</div>
              </div>
              {detalleItem.estado === 'ANULADO' && (
                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--danger-dark)', borderTop: '1px dashed var(--danger-border)', paddingTop: '8px' }}>
                  <strong>Motivo:</strong> {detalleItem.motivo_anulacion}<br />
                  <strong>Anulado por:</strong> {detalleItem.usuario_anulacion_nombre} ({detalleItem.usuario_anulacion_rol})<br />
                  <strong>Fecha:</strong> {detalleItem.fecha_anulacion ? formatearFechaHoraBolivia(detalleItem.fecha_anulacion) : 'No disponible'}
                </div>
              )}
            </div>

            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Paperclip size={18} /> Documentos Adjuntos ({detalleItem.adjuntos?.length || 0})
            </h4>
            {detalleItem.adjuntos?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {detalleItem.adjuntos.map(adj => (
                  <div key={adj.id_documento} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{adj.nombre_original}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(adj.tamano_bytes / 1024).toFixed(1)} KB • Subido por {adj.usuario_subio_nombre}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDescargarAdjunto(adj)}
                      disabled={descargandoId === adj.id_documento}
                      className="btn btn-secondary btn-sm"
                      title="Descargar documento digital"
                    >
                      {descargandoId === adj.id_documento ? (
                        <LoaderCircle size={14} className="spinner-sm" style={{ display: 'inline-block' }} />
                      ) : (
                        <Download size={14} />
                      )} Descargar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px' }}>
                No tiene documentos adjuntos.
              </p>
            )}

            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} /> Línea de Tiempo de Despacho
            </h4>
            <Timeline items={detalleItem.seguimientos} />
          </div>
        )}
      </Modal>

      {/* MODAL 3: CAMBIAR ESTADO */}
      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title={`Actualizar Estado de Salida: ${selectedItem?.codigo}`}
        maxWidth="500px"
      >
        <form onSubmit={handleEstadoSubmit}>
          <div className="form-group">
            <label className="form-label">Nuevo Estado *</label>
            <select
              className="form-select"
              value={estadoForm.nuevo_estado}
              onChange={(e) => setEstadoForm({ ...estadoForm, nuevo_estado: e.target.value })}
              required
            >
              <option value="Borrador">Borrador</option>
              <option value="Emitido">Emitido</option>
              <option value="Entregado">Entregado</option>
              <option value="Archivado">Archivado</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Constancia de recepción, guía o motivo de cambio..."
              value={estadoForm.observaciones}
              onChange={(e) => setEstadoForm({ ...estadoForm, observaciones: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalEstadoOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">
              {actionLoading ? 'Guardando...' : 'Actualizar Estado'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: ADJUNTAR */}
      <Modal
        isOpen={modalAdjuntarOpen}
        onClose={() => setModalAdjuntarOpen(false)}
        title={`Adjuntar Respaldo a: ${selectedItem?.codigo}`}
        maxWidth="500px"
      >
        <form onSubmit={handleAdjuntarSubmit}>
          <div className="form-group">
            <label className="form-label">Archivo de Respaldo / Copia Firmada *</label>
            <input
              type="file"
              className="form-input"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.png"
              onChange={(e) => setAdjuntoFile(e.target.files[0])}
            />
            <button type="button" className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={() => setScannerAdjuntoOpen(true)}>
              <ScanLine size={16} /> Escanear documento
            </button>
            {adjuntoFile && <small style={{ display: 'block', marginTop: '6px', color: 'var(--success-dark)' }}>Listo para adjuntar: {adjuntoFile.name}</small>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalAdjuntarOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">
              {actionLoading ? 'Subiendo...' : 'Adjuntar Documento'}
            </button>
          </div>
        </form>
      </Modal>
      <ScannerDialog
        open={scannerDialogOpen}
        onClose={() => setScannerDialogOpen(false)}
        onConfirm={handleConfirmarEscaneo}
        nombreCorrespondencia="Correspondencia entregada"
      />
      <ScannerDialog
        open={scannerAdjuntoOpen}
        onClose={() => setScannerAdjuntoOpen(false)}
        onConfirm={handleConfirmarEscaneoAdjunto}
        nombreCorrespondencia={`${selectedItem?.codigo || 'Correspondencia entregada'} escaneada`}
      />
    </div>
  );
};

export default CorrespondenciaEntregada;
