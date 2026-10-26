import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Eye, 
  ArrowRightLeft, 
  Paperclip, 
  Edit3, 
  Ban,
  Download,
  Clock,
  Filter,
  CheckCircle2,
  FileText,
  ScanLine,
  LoaderCircle
} from 'lucide-react';
import { api, documentos as documentosAPI } from '../../services/api';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Timeline from '../../components/Timeline/Timeline';
import ScannerDialog from '../../components/ScannerDialog/ScannerDialog';
import { useAuth } from '../../hooks/useAuth';
import { formatearFechaBolivia, formatearFechaHoraBolivia } from '../../utils/fecha';

const CorrespondenciaRecibida = () => {
  const { hasPermission, hasRole } = useAuth();
  const { id: idNotificado } = useParams();

  // Estados de datos y filtros
  const [items, setItems] = useState([]);
  const [paginacion, setPaginacion] = useState({ total: 0, pagina: 1, limite: 10, total_paginas: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');

  // Catálogos
  const [areas, setAreas] = useState([]);
  const [tiposDoc, setTiposDoc] = useState([]);
  const [cargos, setCargos] = useState([]);

  // Modales
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalAnularOpen, setModalAnularOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalDerivarOpen, setModalDerivarOpen] = useState(false);
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false);
  const [modalAdjuntarOpen, setModalAdjuntarOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [scannerAdjuntoOpen, setScannerAdjuntoOpen] = useState(false);

  // Registro seleccionado
  const [selectedItem, setSelectedItem] = useState(null);
  const [detalleItem, setDetalleItem] = useState(null);

  // Formularios
  const [nuevoForm, setNuevoForm] = useState({
    numero_documento_externo: '',
    remitente: '',
    institucion_remitente: '',
    id_tipo_doc: '',
    asunto: '',
    destinatario: '',
    id_area_responsable: '',
    cargo_responsable: '',
    prioridad: 'Normal',
    observaciones: '',
    archivo: null,
    archivo_escaneado: null
  });

  const [derivarForm, setDerivarForm] = useState({
    id_area_destino: '',
    cargo_destino: '',
    responsable_destino: '',
    instruccion_observacion: ''
  });

  const [estadoForm, setEstadoForm] = useState({
    nuevo_estado: 'En revisión',
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

  // Cargar lista principal
  const fetchData = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/correspondencia-recibida', {
        busqueda,
        estado: filtroEstado,
        id_area_responsable: filtroArea,
        prioridad: filtroPrioridad,
        pagina: page,
        limite: paginacion.limite
      });
      if (res.success) {
        setItems(res.data.correspondencias);
        setPaginacion(res.data.paginacion);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar correspondencia recibida.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar catálogos iniciales
  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const [areasRes, tiposRes, cargosRes] = await Promise.all([
          api.get('/catalogos/areas'),
          api.get('/catalogos/tipos-documento'),
          api.get('/catalogos/cargos')
        ]);
        if (areasRes.success) setAreas(areasRes.data);
        if (tiposRes.success) setTiposDoc(tiposRes.data);
        if (cargosRes.success) setCargos(cargosRes.data);
      } catch (e) {
        console.error('Error al cargar catálogos:', e);
      }
    };
    fetchCatalogos();
  }, []);

  useEffect(() => {
    fetchData(1);
  }, [filtroEstado, filtroArea, filtroPrioridad]);

  const handleBuscar = (e) => {
    e.preventDefault();
    fetchData(1);
  };

  // Ver Detalle
  const handleOpenDetalle = async (id) => {
    try {
      const res = await api.get(`/correspondencia-recibida/${id}`);
      if (res.success) {
        setDetalleItem(res.data);
        setModalDetalleOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Error al obtener detalle del expediente.');
    }
  };

  useEffect(() => {
    if (idNotificado) handleOpenDetalle(idNotificado);
  }, [idNotificado]);

  // Crear Correspondencia
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

      const res = await api.upload('/correspondencia-recibida', formData);
      if (res.success) {
        setMensajeFeedback(`Correspondencia registrada correctamente con código: ${res.data.codigo}`);
        setModalNuevoOpen(false);
        setNuevoForm({
          numero_documento_externo: '',
          remitente: '',
          institucion_remitente: '',
          id_tipo_doc: '',
          asunto: '',
          destinatario: '',
          id_area_responsable: '',
          cargo_responsable: '',
          prioridad: 'Normal',
          observaciones: '',
          archivo: null,
          archivo_escaneado: null
        });
        fetchData(1);
      }
    } catch (err) {
      alert(err.message || 'Error al registrar correspondencia.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditarSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const { archivo, ...datos } = nuevoForm;
      const res = await api.put(`/correspondencia-recibida/${selectedItem.id_recibida}`, datos);
      if (res.success) {
        setMensajeFeedback('Correspondencia recibida actualizada correctamente.');
        setModalEditarOpen(false);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al actualizar correspondencia.');
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
      const res = await api.patch(`/correspondencia-recibida/${selectedItem.id_recibida}/anular`, { motivo_anulacion: motivoAnulacion });
      if (res.success) {
        setMensajeFeedback('Correspondencia recibida anulada correctamente.');
        setModalAnularOpen(false);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al anular correspondencia.');
    } finally {
      setActionLoading(false);
    }
  };

  const abrirEdicion = (item) => {
    setSelectedItem(item);
    setNuevoForm({
      numero_documento_externo: item.numero_documento_externo || '',
      remitente: item.remitente || '',
      institucion_remitente: item.institucion_remitente || '',
      id_tipo_doc: item.id_tipo_doc || '',
      asunto: item.asunto || '',
      destinatario: item.destinatario || '',
      id_area_responsable: item.id_area_responsable || '',
      cargo_responsable: item.cargo_responsable || '',
      prioridad: item.prioridad || 'Normal',
      observaciones: item.observaciones || '',
      archivo: null,
      archivo_escaneado: null
    });
    setModalEditarOpen(true);
  };

  // Derivar Correspondencia
  const handleDerivarSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post('/derivaciones', {
        id_recibida: selectedItem.id_recibida,
        ...derivarForm
      });
      if (res.success) {
        setMensajeFeedback(`Correspondencia derivada correctamente.`);
        setModalDerivarOpen(false);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al derivar correspondencia.');
    } finally {
      setActionLoading(false);
    }
  };

  // Cambiar Estado
  const handleEstadoSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.patch(`/correspondencia-recibida/${selectedItem.id_recibida}/estado`, estadoForm);
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

  // Adjuntar Archivo Adicional
  const handleAdjuntarSubmit = async (e) => {
    e.preventDefault();
    if (!adjuntoFile) return alert('Seleccione un archivo.');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('archivo', adjuntoFile);
      const res = await api.upload(`/correspondencia-recibida/${selectedItem.id_recibida}/adjuntos`, formData);
      if (res.success) {
        setMensajeFeedback('Documento adjuntado exitosamente.');
        setModalAdjuntarOpen(false);
        setAdjuntoFile(null);
        fetchData(paginacion.pagina);
      }
    } catch (err) {
      alert(err.message || 'Error al adjuntar documento.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-container page-enter">
      {/* Mensaje de retroalimentación temporal */}
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
            Correspondencia Recibida (Mesa de Entrada)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Registro, digitalización, control y derivación de documentos ingresados
          </p>
        </div>
        {hasPermission('RECIBIDA_CREAR') && (
          <button onClick={() => setModalNuevoOpen(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>Nuevo Registro</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por código, remitente, asunto, número..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div style={{ width: '180px' }}>
            <select className="form-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los Estados</option>
              <option value="Recibido">Recibido</option>
              <option value="En revisión">En revisión</option>
              <option value="Derivado">Derivado</option>
              <option value="En proceso">En proceso</option>
              <option value="Atendido">Atendido</option>
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

          <div style={{ width: '150px' }}>
            <select className="form-select" value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
              <option value="">Toda Prioridad</option>
              <option value="Baja">Baja</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            <Search size={16} />
            <span>Filtrar</span>
          </button>
        </form>
      </div>

      {/* Tabla de Correspondencia Recibida */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha / Hora</th>
                <th>Remitente</th>
                <th>Tipo Doc.</th>
                <th>Asunto</th>
                <th>Área Responsable</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Adjuntos</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Cargando correspondencia recibida...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron registros de correspondencia recibida con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id_recibida}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {item.codigo}
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatearFechaBolivia(item.fecha_recepcion)}<br/>
                      <span style={{ color: 'var(--text-muted)' }}>{item.hora_recepcion?.substring(0, 5)}</span>
                    </td>
                    <td>
                      <strong>{item.remitente}</strong>
                      {item.institucion_remitente && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.institucion_remitente}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-subtle)' }}>{item.tipo_documento_nombre}</span>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {item.asunto}
                      </div>
                      {item.numero_documento_externo && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N° Ext: {item.numero_documento_externo}</div>
                      )}
                    </td>
                    <td>
                      <span title={item.area_responsable_nombre}>{item.area_responsable_sigla || item.area_responsable_nombre}</span>
                    </td>
                    <td>
                      <Badge>{item.prioridad}</Badge>
                    </td>
                    <td>
                      <Badge>{item.estado}</Badge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {parseInt(item.total_adjuntos, 10) > 0 ? (
                        <span className="badge" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-dark)' }}>
                          <Paperclip size={12} style={{ marginRight: '2px' }} />
                          {item.total_adjuntos}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--border-strong)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="action-buttons" style={{ justifyContent: 'flex-end', gap: '5px' }}>
                        {/* Ver Expediente */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetalle(item.id_recibida)}
                          className="btn-action btn-action-view"
                          title="Ver Expediente y Línea de Tiempo"
                        >
                          <Eye size={15} />
                        </button>

                        {hasPermission('RECIBIDA_EDITAR') && item.estado !== 'ANULADO' && (
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

                        {/* Derivar */}
                        {hasPermission('RECIBIDA_DERIVAR') && item.estado !== 'ANULADO' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setDerivarForm({ id_area_destino: '', cargo_destino: '', responsable_destino: '', instruccion_observacion: '' });
                              setModalDerivarOpen(true);
                            }}
                            className="btn-action btn-action-derive"
                            title="Derivar a otra Área"
                          >
                            <ArrowRightLeft size={15} />
                          </button>
                        )}

                        {/* Cambiar Estado */}
                        {hasPermission('RECIBIDA_ESTADO') && item.estado !== 'ANULADO' && (
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

                        {/* Adjuntar Archivo */}
                        {hasPermission('ARCHIVO_SUBIR') && item.estado !== 'ANULADO' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setAdjuntoFile(null);
                              setModalAdjuntarOpen(true);
                            }}
                            className="btn-action btn-action-attach"
                            title="Adjuntar Documento Digital"
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

      {/* MODAL 1: REGISTRAR NUEVA CORRESPONDENCIA */}
      <Modal
        isOpen={modalNuevoOpen}
        onClose={() => setModalNuevoOpen(false)}
        title="Registrar Correspondencia Recibida (Entrada)"
      >
        <form onSubmit={handleCrearSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Remitente *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre del emisor"
                value={nuevoForm.remitente}
                onChange={(e) => setNuevoForm({ ...nuevoForm, remitente: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Institución / Empresa Emisora</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Ministerio de Finanzas"
                value={nuevoForm.institucion_remitente}
                onChange={(e) => setNuevoForm({ ...nuevoForm, institucion_remitente: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
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
            <div className="form-group">
              <label className="form-label">Número de Documento Externo</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. OFICIO-045/2026"
                value={nuevoForm.numero_documento_externo}
                onChange={(e) => setNuevoForm({ ...nuevoForm, numero_documento_externo: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Asunto / Referencia del Documento *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Descripción breve y precisa del contenido"
              value={nuevoForm.asunto}
              onChange={(e) => setNuevoForm({ ...nuevoForm, asunto: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Destinatario *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Persona o cargo a quien se dirige"
                value={nuevoForm.destinatario}
                onChange={(e) => setNuevoForm({ ...nuevoForm, destinatario: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Área Responsable Inicial *</label>
              <select
                className="form-select"
                value={nuevoForm.id_area_responsable}
                onChange={(e) => setNuevoForm({ ...nuevoForm, id_area_responsable: e.target.value, cargo_responsable: '' })}
                required
              >
                <option value="">Seleccione Área</option>
                {areas.map(a => (
                  <option key={a.id_area} value={a.id_area}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cargo Responsable Inicial *</label>
            <select
              className="form-select"
              value={nuevoForm.cargo_responsable}
              disabled={!nuevoForm.id_area_responsable}
              onChange={(e) => setNuevoForm({ ...nuevoForm, cargo_responsable: e.target.value })}
              required
            >
              <option value="">
                {nuevoForm.id_area_responsable ? '-- Seleccione Cargo Responsable --' : 'Primero seleccione un Área Responsable'}
              </option>
              {cargos
                .filter(c => Number(c.id_area) === Number(nuevoForm.id_area_responsable))
                .map(c => (
                  <option key={c.id_cargo} value={c.nombre}>{c.nombre}</option>
                ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prioridad *</label>
              <select
                className="form-select"
                value={nuevoForm.prioridad}
                onChange={(e) => setNuevoForm({ ...nuevoForm, prioridad: e.target.value })}
                required
              >
                <option value="Normal">Normal</option>
                <option value="Baja">Baja</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Adjuntar Documento Digital (Opcional)</label>
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
              placeholder="Notas sobre el estado físico, anexos o instrucciones iniciales"
              value={nuevoForm.observaciones}
              onChange={(e) => setNuevoForm({ ...nuevoForm, observaciones: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalNuevoOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">
              {actionLoading ? 'Registrando...' : 'Registrar Correspondencia'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDITAR CORRESPONDENCIA */}
      <Modal
        isOpen={modalEditarOpen}
        onClose={() => setModalEditarOpen(false)}
        title={`Editar Correspondencia: ${selectedItem?.codigo}`}
        maxWidth="720px"
      >
        <form onSubmit={handleEditarSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Remitente *</label>
              <input className="form-input" value={nuevoForm.remitente} onChange={(e) => setNuevoForm({ ...nuevoForm, remitente: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Institución / Empresa Emisora</label>
              <input className="form-input" value={nuevoForm.institucion_remitente} onChange={(e) => setNuevoForm({ ...nuevoForm, institucion_remitente: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de Documento *</label>
              <select className="form-select" value={nuevoForm.id_tipo_doc} onChange={(e) => setNuevoForm({ ...nuevoForm, id_tipo_doc: e.target.value })} required>
                <option value="">Seleccione Tipo</option>
                {tiposDoc.map(t => <option key={t.id_tipo_doc} value={t.id_tipo_doc}>{t.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Número de Documento Externo</label>
              <input className="form-input" value={nuevoForm.numero_documento_externo} onChange={(e) => setNuevoForm({ ...nuevoForm, numero_documento_externo: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Asunto / Referencia *</label>
            <input className="form-input" value={nuevoForm.asunto} onChange={(e) => setNuevoForm({ ...nuevoForm, asunto: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Destinatario *</label>
              <input className="form-input" value={nuevoForm.destinatario} onChange={(e) => setNuevoForm({ ...nuevoForm, destinatario: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Área Responsable Inicial *</label>
              <select
                className="form-select"
                value={nuevoForm.id_area_responsable}
                onChange={(e) => setNuevoForm({
                  ...nuevoForm,
                  id_area_responsable: e.target.value,
                  cargo_responsable: ''
                })}
                required
              >
                <option value="">Seleccione Área</option>
                {areas.map(a => <option key={a.id_area} value={a.id_area}>{a.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Cargo Responsable *</label>
            <select
              className="form-select"
              value={nuevoForm.cargo_responsable}
              disabled={!nuevoForm.id_area_responsable}
              onChange={(e) => setNuevoForm({ ...nuevoForm, cargo_responsable: e.target.value })}
              required
            >
              <option value="">
                {nuevoForm.id_area_responsable ? '-- Seleccione Cargo Responsable --' : 'Primero seleccione un Área Responsable'}
              </option>
              {cargos
                .filter(c => Number(c.id_area) === Number(nuevoForm.id_area_responsable))
                .map(c => (
                  <option key={c.id_cargo} value={c.nombre}>{c.nombre}</option>
                ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prioridad *</label>
              <select className="form-select" value={nuevoForm.prioridad} onChange={(e) => setNuevoForm({ ...nuevoForm, prioridad: e.target.value })} required>
                <option value="Baja">Baja</option><option value="Normal">Normal</option><option value="Alta">Alta</option><option value="Urgente">Urgente</option>
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

      <Modal isOpen={modalAnularOpen} onClose={() => setModalAnularOpen(false)} title={`Anular Correspondencia: ${selectedItem?.codigo}`} maxWidth="500px">
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

      {/* MODAL 2: VER EXPEDIENTE COMPLETO */}
      <Modal
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        title={`Expediente: ${detalleItem?.codigo}`}
        maxWidth="820px"
      >
        {detalleItem && (
          <div>
            {/* Tarjeta de Resumen */}
            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{detalleItem.asunto}</span>
                <Badge>{detalleItem.estado}</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                <div><strong>Remitente:</strong> {detalleItem.remitente} {detalleItem.institucion_remitente ? `(${detalleItem.institucion_remitente})` : ''}</div>
                <div><strong>Destinatario:</strong> {detalleItem.destinatario}</div>
                <div><strong>Área Responsable:</strong> {detalleItem.area_responsable_nombre}</div>
                <div><strong>Prioridad:</strong> <Badge>{detalleItem.prioridad}</Badge></div>
                <div><strong>Fecha Recepción:</strong> {formatearFechaBolivia(detalleItem.fecha_recepcion)} a las {detalleItem.hora_recepcion}</div>
                <div><strong>Registrado por:</strong> {detalleItem.usuario_registro_nombre}</div>
              </div>
              {detalleItem.observaciones && (
                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-strong)', paddingTop: '8px' }}>
                  <strong>Observaciones:</strong> {detalleItem.observaciones}
                </div>
              )}
              {detalleItem.estado === 'ANULADO' && (
                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--danger-dark)', borderTop: '1px dashed var(--danger-border)', paddingTop: '8px' }}>
                  <strong>Motivo:</strong> {detalleItem.motivo_anulacion}<br />
                  <strong>Anulado por:</strong> {detalleItem.usuario_anulacion_nombre} ({detalleItem.usuario_anulacion_rol})<br />
                  <strong>Fecha:</strong> {detalleItem.fecha_anulacion ? formatearFechaHoraBolivia(detalleItem.fecha_anulacion) : 'No disponible'}
                </div>
              )}
            </div>

            {/* Documentos Adjuntos */}
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
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={20} color="var(--info)" />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{adj.nombre_original}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(adj.tamano_bytes / 1024).toFixed(1)} KB • Subido por {adj.usuario_subio_nombre}
                        </div>
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
                No tiene documentos digitales adjuntos.
              </p>
            )}

            {/* Historial de Derivaciones */}
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={18} /> Historial de Derivaciones ({detalleItem.derivaciones?.length || 0})
            </h4>
            {detalleItem.derivaciones?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {detalleItem.derivaciones.map(der => (
                  <div key={der.id_derivacion} style={{ padding: '10px 14px', border: '1px solid var(--warning-border)', backgroundColor: 'var(--warning-bg)', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>De: {der.area_origen_nombre || 'Mesa de Entrada'} → Para: {der.area_destino_nombre}</span>
                      <Badge>{der.estado_derivacion}</Badge>
                    </div>
                    {der.responsable_destino && <div>Responsable asignado: {der.responsable_destino}</div>}
                    {der.instruccion_observacion && <div style={{ color: 'var(--warning-dark)', marginTop: '4px' }}>Instrucción: {der.instruccion_observacion}</div>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning-dark)', marginTop: '4px' }}>
                      Derivado el {formatearFechaBolivia(der.fecha_derivacion)} por {der.usuario_derivo_nombre}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px' }}>
                Este expediente no registra derivaciones previas.
              </p>
            )}

            {/* Línea de Tiempo de Trazabilidad */}
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} /> Línea de Tiempo de Seguimiento (Trazabilidad)
            </h4>
            <Timeline items={detalleItem.seguimientos} />
          </div>
        )}
      </Modal>

      {/* MODAL 3: DERIVAR CORRESPONDENCIA */}
      <Modal
        isOpen={modalDerivarOpen}
        onClose={() => setModalDerivarOpen(false)}
        title={`Derivar: ${selectedItem?.codigo}`}
        maxWidth="550px"
      >
        <form onSubmit={handleDerivarSubmit}>
          <div style={{ backgroundColor: 'var(--info-bg)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: 'var(--info-dark)' }}>
            <strong>Documento:</strong> {selectedItem?.asunto}<br/>
            <strong>Área actual:</strong> {selectedItem?.area_responsable_nombre}
          </div>

          <div className="form-group">
            <label className="form-label">Área de Destino *</label>
            <select
              className="form-select"
              value={derivarForm.id_area_destino}
              onChange={(e) => setDerivarForm({ ...derivarForm, id_area_destino: e.target.value, cargo_destino: '', responsable_destino: '' })}
              required
            >
              <option value="">Seleccione Área Destino</option>
              {areas
                .filter(a => a.id_area !== selectedItem?.id_area_responsable)
                .map(a => (
                  <option key={a.id_area} value={a.id_area}>{a.nombre}</option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Cargo Responsable en Destino *</label>
            <select
              className="form-select"
              value={derivarForm.cargo_destino}
              disabled={!derivarForm.id_area_destino}
              onChange={(e) => setDerivarForm({
                ...derivarForm,
                cargo_destino: e.target.value
              })}
              required
            >
              <option value="">
                {derivarForm.id_area_destino ? '-- Seleccione Cargo Responsable --' : 'Primero seleccione Área de Destino'}
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
              type="text"
              className="form-input"
              placeholder="Nombre del responsable en el área destino"
              value={derivarForm.responsable_destino || ''}
              onChange={(e) => setDerivarForm({ ...derivarForm, responsable_destino: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Instrucción / Observación de la Derivación</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Indique las instrucciones o requerimientos para el área de destino..."
              value={derivarForm.instruccion_observacion}
              onChange={(e) => setDerivarForm({ ...derivarForm, instruccion_observacion: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalDerivarOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">
              {actionLoading ? 'Procesando...' : 'Confirmar Derivación'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: CAMBIAR ESTADO */}
      <Modal
        isOpen={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title={`Cambiar Estado: ${selectedItem?.codigo}`}
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
              <option value="Recibido">Recibido</option>
              <option value="En revisión">En revisión</option>
              <option value="Derivado">Derivado</option>
              <option value="En proceso">En proceso</option>
              <option value="Atendido">Atendido</option>
              <option value="Archivado">Archivado</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo o Descripción del Cambio</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Explique el motivo del cambio de estado..."
              value={estadoForm.observaciones}
              onChange={(e) => setEstadoForm({ ...estadoForm, observaciones: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalEstadoOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-success">
              {actionLoading ? 'Guardando...' : 'Actualizar Estado'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: ADJUNTAR DOCUMENTO */}
      <Modal
        isOpen={modalAdjuntarOpen}
        onClose={() => setModalAdjuntarOpen(false)}
        title={`Adjuntar Respaldo Digital a: ${selectedItem?.codigo}`}
        maxWidth="500px"
      >
        <form onSubmit={handleAdjuntarSubmit}>
          <div className="form-group">
            <label className="form-label">Seleccionar Archivo (PDF, Word, Excel, JPG, PNG) *</label>
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
            <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>
              Tamaño máximo permitido: 10 Megabytes.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setModalAdjuntarOpen(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={actionLoading} className="btn btn-primary">
              {actionLoading ? 'Subiendo...' : 'Cargar Archivo'}
            </button>
          </div>
        </form>
      </Modal>
      <ScannerDialog
        open={scannerDialogOpen}
        onClose={() => setScannerDialogOpen(false)}
        onConfirm={handleConfirmarEscaneo}
        nombreCorrespondencia="Correspondencia recibida"
      />
      <ScannerDialog
        open={scannerAdjuntoOpen}
        onClose={() => setScannerAdjuntoOpen(false)}
        onConfirm={handleConfirmarEscaneoAdjunto}
        nombreCorrespondencia={`${selectedItem?.codigo || 'Correspondencia recibida'} escaneada`}
      />
    </div>
  );
};

export default CorrespondenciaRecibida;
