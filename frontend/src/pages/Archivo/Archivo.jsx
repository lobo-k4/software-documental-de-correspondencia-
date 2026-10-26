import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, FileArchive, Download, Eye, FileText, Save, Search, Settings2, Trash2 } from 'lucide-react';
import { documentos as documentosAPI, notas as notasAPI } from '../../services/api';
import Modal from '../../components/Modal/Modal';
import { useAuth } from '../../hooks/useAuth';
import { formatearFechaBolivia, formatearFechaHoraBolivia } from '../../utils/fecha';
import './Archivo.css';

const TIPOS_DOC = ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'JPG', 'JPEG', 'PNG'];
const LIMITE_POR_PAGINA = 15;

export default function Archivo() {
  const { hasPermission, hasRole } = useAuth();
  const esAdministrador = hasRole('Administrador');
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [filtros, setFiltros]   = useState({ q: '', extension: '' });
  const [paginacion, setPaginacion] = useState({ pagina: 1, total_paginas: 1, total: 0 });
  const [seleccionado, setSeleccionado] = useState(null);
  const [modalVer, setModalVer] = useState(false);
  const [documentoADescargar, setDocumentoADescargar] = useState(null);
  const [descargandoFormato, setDescargandoFormato] = useState('');
  const [notaQrId, setNotaQrId] = useState(null);
  const [notaQr, setNotaQr] = useState(null);
  const [limiteQr, setLimiteQr] = useState('');
  const [cargandoQr, setCargandoQr] = useState(false);
  const [guardandoLimiteQr, setGuardandoLimiteQr] = useState(false);
  const [errorQr, setErrorQr] = useState('');
  const [mensajeQr, setMensajeQr] = useState('');
  const [documentoAEliminar, setDocumentoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async (pagina = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { pagina, limite: LIMITE_POR_PAGINA };
      if (filtros.q.trim()) params.q = filtros.q.trim();
      if (filtros.extension) params.extension = filtros.extension;
      const res = await documentosAPI.getAll(params);
      const resultado = res.data || {};
      setDocs(Array.isArray(resultado.documentos) ? resultado.documentos : []);
      setPaginacion(resultado.paginacion || { pagina, total_paginas: 1, total: 0 });
    } catch {
      setError('Error al cargar el archivo digital.');
    } finally {
      setLoading(false);
    }
  }, [filtros.q, filtros.extension]);

  useEffect(() => { cargar(1); }, []);

  const handleFiltro = (campo, valor) => setFiltros(f => ({ ...f, [campo]: valor }));
  const handleBuscar = () => {
    setPaginacion(p => ({ ...p, pagina: 1 }));
    cargar(1);
  };

  const handleDescargar = async (doc) => {
    setModalVer(false);
    setDocumentoADescargar(doc);
  };

  const abrirVerificacionQr = async (idNota) => {
    setNotaQrId(idNota);
    setNotaQr(null);
    setLimiteQr('');
    setErrorQr('');
    setMensajeQr('');
    setCargandoQr(true);
    try {
      const [notaRes, limiteRes] = await Promise.all([
        notasAPI.getById(idNota),
        notasAPI.getLimiteVerificaciones(idNota)
      ]);
      setNotaQr(notaRes.data);
      setLimiteQr(String(limiteRes.data.limite_verificaciones_qr));
    } catch (error) {
      setErrorQr(error.message || 'No se pudo cargar la información de verificación.');
    } finally {
      setCargandoQr(false);
    }
  };

  const cerrarVerificacionQr = () => {
    if (guardandoLimiteQr) return;
    setNotaQrId(null);
    setNotaQr(null);
  };

  const guardarLimiteQr = async (event) => {
    event.preventDefault();
    if (!esAdministrador || !notaQrId || guardandoLimiteQr) return;
    setGuardandoLimiteQr(true);
    setErrorQr('');
    setMensajeQr('');
    try {
      const result = await notasAPI.actualizarLimiteVerificaciones(notaQrId, {
        limite_verificaciones: Number(limiteQr)
      });
      setNotaQr(prev => ({ ...prev, ...result.data }));
      setLimiteQr(String(result.data.limite_verificaciones_qr));
      setMensajeQr(result.message || 'Límite individual actualizado.');
    } catch (error) {
      setErrorQr(error.message || 'No se pudo actualizar el límite de este QR.');
    } finally {
      setGuardandoLimiteQr(false);
    }
  };

  const descargarNota = async (formato) => {
    if (!documentoADescargar || descargandoFormato) return;
    setDescargandoFormato(formato);
    try {
      if (formato === 'pdf') {
        await documentosAPI.descargar(
          documentoADescargar.id_documento,
          documentoADescargar.nombre_original || `nota-${documentoADescargar.id_nota}.pdf`
        );
      } else if (documentoADescargar.id_nota) {
        await notasAPI.descargarWord(documentoADescargar.id_nota);
      } else {
        await documentosAPI.descargar(
          documentoADescargar.id_documento,
          documentoADescargar.nombre_original || `documento-${documentoADescargar.id_documento}.docx`
        );
      }
      setDocumentoADescargar(null);
    } catch (error) {
      alert(error.data?.message || error.message || `No se pudo descargar la nota en ${formato.toUpperCase()}.`);
    } finally {
      setDescargandoFormato('');
    }
  };

  const extensionDescarga = documentoADescargar?.extension?.toLowerCase();
  const pdfDisponible = extensionDescarga === '.pdf';
  const wordDisponible = Boolean(documentoADescargar?.id_nota) || extensionDescarga === '.docx';

  const solicitarEliminar = (doc) => setDocumentoAEliminar(doc);

  const handleEliminar = async () => {
    if (!documentoAEliminar || eliminando) return;
    setEliminando(true);
    try {
      await documentosAPI.eliminar(documentoAEliminar.id_documento);
      setDocumentoAEliminar(null);
      setModalVer(false);
      setSeleccionado(null);
      cargar(paginacion.pagina);
    } catch (error) {
      alert(error.message || 'Error al eliminar el documento.');
    } finally {
      setEliminando(false);
    }
  };

  const tipoIcono = (tipo) => {
    const extension = tipo?.replace(/^\./, '').toUpperCase();
    const iconos = { PDF: '📄', DOC: '📝', DOCX: '📝', XLS: '📊', XLSX: '📊', JPG: '🖼️', JPEG: '🖼️', PNG: '🖼️' };
    return iconos[extension] || '📎';
  };

  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined || bytes === '') return '—';
    const valor = Number(bytes);
    if (!Number.isFinite(valor)) return '—';
    if (valor < 1024) return `${valor} B`;
    if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1)} KB`;
    return `${(valor / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="page-container page-enter archivo-container">
      {/* Encabezado */}
      <div className="archivo-header">
        <div className="archivo-header-info">
          <h2>Archivo Digital</h2>
          <p>Repositorio centralizado de documentos y adjuntos digitalizados del sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="archivo-filters-card">
        <div className="archivo-filters-row">
          <div className="archivo-search-wrap">
            <input
              className="form-input"
              type="text"
              placeholder="Buscar por nombre, código de correspondencia o nota..."
              value={filtros.q}
              onChange={e => handleFiltro('q', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            />
          </div>
          <div className="archivo-select-wrap">
            <select
              className="form-select"
              value={filtros.extension}
              onChange={e => handleFiltro('extension', e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {TIPOS_DOC.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleBuscar} disabled={loading}>
            <Search size={16} />
            <span>Buscar</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className="archivo-table-card">
        {loading ? (
          <div className="table-loading" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="archivo-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th>Código Asociado</th>
                  <th>Fecha de Carga</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No se encontraron documentos en el archivo digital.
                    </td>
                  </tr>
                ) : docs.map(d => (
                  <tr key={d.id_documento}>
                    <td>
                      <div className="archivo-name-cell">
                        <span style={{ fontSize: '1.25rem' }}>{tipoIcono(d.extension)}</span>
                        <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.nombre_original}>
                          {d.nombre_original}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="archivo-ext-badge">
                        {d.extension?.replace(/^\./, '').toUpperCase() || '—'}
                      </span>
                    </td>
                    <td>{formatBytes(d.tamano_bytes)}</td>
                    <td>
                      <span className="archivo-code-badge">
                        {d.correspondencia_recibida_codigo || d.correspondencia_entregada_codigo || d.nota_numero || '—'}
                      </span>
                    </td>
                    <td>{formatearFechaBolivia(d.creado_en)}</td>
                    <td>
                      <div className="archivo-actions" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-archivo-action view"
                          title="Ver detalle"
                          onClick={() => { setSeleccionado(d); setModalVer(true); }}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-archivo-action download"
                          title="Descargar"
                          onClick={() => handleDescargar(d)}
                          disabled={loading}
                        >
                          <Download size={15} />
                        </button>
                        {d.id_nota && (
                          <button
                            type="button"
                            className="btn-archivo-action qr"
                            title="Verificar QR"
                            aria-label="Verificar QR"
                            onClick={() => abrirVerificacionQr(d.id_nota)}
                          >
                            <Settings2 size={15} />
                          </button>
                        )}
                        {hasPermission('ARCHIVO_ELIMINAR') && (
                          <button
                            type="button"
                            className="btn-archivo-action delete"
                            title="Eliminar documento"
                            onClick={() => solicitarEliminar(d)}
                            disabled={loading}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {paginacion.total > 0 && (
          <div className="archivo-pagination">
            <span>Mostrando {docs.length} de {paginacion.total} documentos</span>
            <div className="archivo-pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => cargar(paginacion.pagina - 1)}
                disabled={loading || paginacion.pagina <= 1}
                aria-label="Página anterior"
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.85rem', padding: '0 8px' }}>
                Página {paginacion.pagina} de {Math.max(1, paginacion.total_paginas)}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => cargar(paginacion.pagina + 1)}
                disabled={loading || paginacion.pagina >= paginacion.total_paginas}
                aria-label="Página siguiente"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ver */}
      <Modal isOpen={modalVer} onClose={() => setModalVer(false)} title="Detalle del Documento" size="md">
        {seleccionado && (
          <div>
            <div className="doc-preview-icon">{tipoIcono(seleccionado.extension)}</div>
            <div className="detail-grid">
              <div className="detail-row"><span className="detail-label">Nombre</span><span>{seleccionado.nombre_original}</span></div>
              <div className="detail-row"><span className="detail-label">Tipo</span><span>{seleccionado.extension?.replace(/^\./, '').toUpperCase() || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Tamaño</span><span>{formatBytes(seleccionado.tamano_bytes)}</span></div>
              <div className="detail-row"><span className="detail-label">Código</span><span>{seleccionado.correspondencia_recibida_codigo || seleccionado.correspondencia_entregada_codigo || seleccionado.nota_numero || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Asunto</span><span>{seleccionado.correspondencia_recibida_asunto || seleccionado.correspondencia_entregada_asunto || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Fecha</span><span>{formatearFechaHoraBolivia(seleccionado.creado_en)}</span></div>
              <div className="detail-row"><span className="detail-label">Subido por</span><span>{seleccionado.usuario_subio_nombre || seleccionado.usuario_subio_username || '—'}</span></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => handleDescargar(seleccionado)}>
                <Download size={16} /> Descargar
              </button>
              {seleccionado.id_nota && (
                <button className="btn btn-outline" onClick={() => abrirVerificacionQr(seleccionado.id_nota)}>
                  <Settings2 size={16} /> Verificar QR
                </button>
              )}
              {hasPermission('ARCHIVO_ELIMINAR') && (
                <button className="btn btn-outline" onClick={() => solicitarEliminar(seleccionado)}>
                  <Trash2 size={16} color="#dc2626" /> Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(documentoADescargar)}
        onClose={() => !descargandoFormato && setDocumentoADescargar(null)}
        title={documentoADescargar?.nota_numero ? 'Descargar nota' : 'Descargar documento'}
        size="sm"
      >
        <p>
          {documentoADescargar?.nota_numero
            ? `Selecciona el formato para la nota ${documentoADescargar.nota_numero}.`
            : `Selecciona el formato disponible para ${documentoADescargar?.nombre_original || 'este documento'}.`}
        </p>
        {!wordDisponible && <p className="text-muted">Este archivo no tiene una versión Word asociada.</p>}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => descargarNota('pdf')} disabled={Boolean(descargandoFormato) || !pdfDisponible}>
            <Download size={16} /> {descargandoFormato === 'pdf' ? 'Descargando...' : 'PDF'}
          </button>
          <button className="btn btn-primary" onClick={() => descargarNota('word')} disabled={Boolean(descargandoFormato) || !wordDisponible}>
            <FileText size={16} /> {descargandoFormato === 'word' ? 'Descargando...' : 'Word'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(notaQrId)}
        onClose={cerrarVerificacionQr}
        title="Verificación QR"
        size="xl"
      >
        {cargandoQr ? (
          <div className="table-loading"><div className="spinner"></div></div>
        ) : errorQr && !notaQr ? (
          <div className="alert alert-danger" role="alert">{errorQr}</div>
        ) : notaQr && (
          <div className="qr-verificacion-modal">
            <section className="qr-verificacion-configuracion">
              <h4>Límite de verificaciones</h4>
              <p className="text-muted">Este límite se aplica únicamente al QR de esta nota.</p>
              <form onSubmit={guardarLimiteQr}>
                <div className="form-group">
                  <label className="form-label" htmlFor="limite-qr-nota">Verificaciones permitidas por QR</label>
                  <input
                    id="limite-qr-nota"
                    className="form-input"
                    type="number"
                    min="1"
                    max="2147483647"
                    step="1"
                    required
                    value={limiteQr}
                    onChange={event => setLimiteQr(event.target.value)}
                    disabled={!esAdministrador || guardandoLimiteQr}
                  />
                </div>
                <p className="text-muted">
                  Usadas: {notaQr.verificaciones_qr} de {notaQr.limite_verificaciones_qr}
                </p>
                {!esAdministrador && <p className="text-muted">Solo el Administrador puede cambiar este límite.</p>}
                {esAdministrador && (
                  <button className="btn btn-primary" type="submit" disabled={guardandoLimiteQr || !limiteQr}>
                    <Save size={16} /> {guardandoLimiteQr ? 'Guardando...' : 'Guardar límite'}
                  </button>
                )}
              </form>
              {errorQr && <div className="alert alert-danger" role="alert">{errorQr}</div>}
              {mensajeQr && <div className="alert alert-success" role="status">{mensajeQr}</div>}
            </section>

            <section className="qr-verificacion-nota">
              <div className="qr-verificacion-estado">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Nota registrada en el sistema</strong>
                  <span>Los datos corresponden al documento asociado a este código QR.</span>
                </div>
              </div>
              <div className="qr-verificacion-cabecera">
                <div><span>CITE</span><strong>{notaQr.numero_nota}</strong></div>
                <div><span>REGISTRADA</span><strong>{formatearFechaHoraBolivia(notaQr.fecha_generacion)}</strong></div>
              </div>
              <p className="qr-verificacion-contador">
                Verificaciones: {notaQr.verificaciones_qr} de {notaQr.limite_verificaciones_qr}
                {' · '}{Math.max(0, Number(notaQr.limite_verificaciones_qr) - Number(notaQr.verificaciones_qr))} restantes
              </p>
              <h4>{notaQr.plantilla_titulo}</h4>
              <div className="qr-verificacion-contenido" dangerouslySetInnerHTML={{ __html: notaQr.contenido_renderizado || '' }} />
            </section>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(documentoAEliminar)}
        onClose={() => !eliminando && setDocumentoAEliminar(null)}
        title="Confirmar eliminación"
        maxWidth="440px"
      >
        <p>¿Está seguro de eliminar el documento «{documentoAEliminar?.nombre_original}»?</p>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setDocumentoAEliminar(null)} disabled={eliminando}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleEliminar} disabled={eliminando}>
            <Trash2 size={16} /> {eliminando ? 'Eliminando...' : 'Aceptar'}
          </button>
        </div>
      </Modal>

      <style>{`
        .doc-preview-icon { font-size: 3rem; text-align: center; margin-bottom: 1rem; }
        .code-tag.small { font-size: 0.7rem; }
        .table-footer { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
        .qr-verificacion-modal { display: grid; grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.5fr); gap: 1.25rem; }
        .qr-verificacion-configuracion { padding-right: 1.25rem; border-right: 1px solid var(--border-color); }
        .qr-verificacion-configuracion h4, .qr-verificacion-nota h4 { margin: 0 0 0.75rem; }
        .qr-verificacion-estado { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.9rem; color: #23613f; background: #f0f6f3; }
        .qr-verificacion-estado div { display: grid; gap: 0.25rem; }
        .qr-verificacion-estado span { font-size: 0.85rem; }
        .qr-verificacion-cabecera { display: flex; justify-content: space-between; gap: 1rem; margin: 1rem 0 0.5rem; }
        .qr-verificacion-cabecera div { display: grid; gap: 0.3rem; min-width: 0; }
        .qr-verificacion-cabecera div:last-child { text-align: right; }
        .qr-verificacion-cabecera span { color: var(--text-muted); font-size: 0.72rem; font-weight: 700; }
        .qr-verificacion-cabecera strong { overflow-wrap: anywhere; }
        .qr-verificacion-contador { margin: 0 0 1rem; color: var(--text-secondary); font-size: 0.82rem; text-align: right; }
        .qr-verificacion-contenido { max-height: 48vh; overflow: auto; padding-top: 0.75rem; border-top: 1px solid var(--border-color); }
        .qr-verificacion-contenido table { width: 100%; border-collapse: collapse; }
        .qr-verificacion-contenido th, .qr-verificacion-contenido td { padding: 0.4rem; border: 1px solid var(--border-color); }
        @media (max-width: 700px) { .qr-verificacion-modal { grid-template-columns: 1fr; } .qr-verificacion-configuracion { padding: 0 0 1rem; border-right: 0; border-bottom: 1px solid var(--border-color); } }
      `}</style>
    </div>
  );
}
