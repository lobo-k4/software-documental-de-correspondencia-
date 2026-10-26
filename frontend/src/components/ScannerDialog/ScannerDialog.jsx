import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  ArrowDown, ArrowUp, Check, Eye, LoaderCircle, Plus, RefreshCw,
  ScanLine, Trash2, X
} from 'lucide-react';
import Modal from '../Modal/Modal';
import { scanner as scannerAPI } from '../../services/api';

const dimensionesPapel = {
  1: [595.28, 841.89],
  2: [612, 792],
  3: [612, 1008],
  4: [419.53, 595.28],
  5: [498.9, 708.66],
  6: [792, 1224]
};

const obtenerMensajeError = (error) => error.data?.message || error.message || 'Se produjo un error durante el escaneo.';

const convertirPaginaAJpeg = async (imagenBase64) => {
  const imagen = new Image();
  imagen.src = `data:image/jpeg;base64,${imagenBase64}`;
  await imagen.decode();

  const canvas = document.createElement('canvas');
  canvas.width = imagen.naturalWidth;
  canvas.height = imagen.naturalHeight;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('No se pudo preparar la página escaneada para el PDF.');

  contexto.fillStyle = '#fff';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(imagen, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo convertir la página escaneada a JPEG.')), 'image/jpeg', 0.92);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height
  };
};

export { convertirPaginaAJpeg };

export const generarPdfEscaneado = async ({ paginas, opciones, nombreCorrespondencia }) => {
  const documento = await PDFDocument.create();
  const tamanoSolicitado = dimensionesPapel[opciones.pageSize] || null;
  const dpi = Number(opciones.dpi) || 300;

  for (const pagina of paginas) {
    const jpeg = await convertirPaginaAJpeg(pagina.imagen);
    const imagen = await documento.embedJpg(jpeg.bytes);
    let [ancho, alto] = tamanoSolicitado || [jpeg.width * 72 / dpi, jpeg.height * 72 / dpi];
    if ((jpeg.width > jpeg.height) !== (ancho > alto)) [ancho, alto] = [alto, ancho];
    const paginaPdf = documento.addPage([ancho, alto]);
    const escala = Math.min(ancho / imagen.width, alto / imagen.height);
    const anchoImagen = imagen.width * escala;
    const altoImagen = imagen.height * escala;
    paginaPdf.drawImage(imagen, {
      x: (ancho - anchoImagen) / 2,
      y: (alto - altoImagen) / 2,
      width: anchoImagen,
      height: altoImagen
    });
  }

  documento.setTitle(nombreCorrespondencia);
  return documento.save();
};

export default function ScannerDialog({ open, onClose, onConfirm, nombreCorrespondencia }) {
  const [dispositivos, setDispositivos] = useState([]);
  const [dispositivoId, setDispositivoId] = useState('');
  const [capacidades, setCapacidades] = useState(null);
  const [paginas, setPaginas] = useState([]);
  const [opciones, setOpciones] = useState({ dpi: '', pageSize: '', colorMode: '', adf: false, duplex: false });
  const [buscando, setBuscando] = useState(false);
  const [consultandoCapacidades, setConsultandoCapacidades] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [previewPagina, setPreviewPagina] = useState(null);
  const scanController = useRef(null);

  const detectarDispositivos = async () => {
    setBuscando(true);
    setError('');
    setMensaje('Buscando escáneres...');
    try {
      const response = await scannerAPI.getDevices();
      const encontrados = response.data?.dispositivos || [];
      setDispositivos(encontrados);
      setDispositivoId(current => encontrados.some(device => device.id === current)
        ? current
        : (encontrados.length === 1 ? encontrados[0].id : ''));
      setMensaje(encontrados.length ? 'Escáner detectado.' : 'No se detectaron escáneres disponibles.');
    } catch (requestError) {
      setDispositivos([]);
      setDispositivoId('');
      setMensaje('El escáner no está disponible.');
      setError(obtenerMensajeError(requestError));
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    setPaginas([]);
    setError('');
    setMensaje('');
    setPreviewPagina(null);
    detectarDispositivos();
    return () => scanController.current?.abort();
  }, [open]);

  useEffect(() => {
    if (!open || !dispositivoId) {
      setCapacidades(null);
      return undefined;
    }

    let vigente = true;
    setConsultandoCapacidades(true);
    setError('');
    scannerAPI.getCapabilities(dispositivoId)
      .then(response => {
        if (!vigente) return;
        const disponibles = response.data;
        setCapacidades(disponibles);
        setOpciones({
          dpi: disponibles.resoluciones.includes(300) ? '300' : String(disponibles.resoluciones[0] || ''),
          pageSize: String(disponibles.tamanoPapel[0]?.valor ?? ''),
          colorMode: String(disponibles.modosColor.find(mode => mode.valor === 3)?.valor ?? disponibles.modosColor[0]?.valor ?? ''),
          adf: false,
          duplex: false
        });
        setMensaje('Escáner detectado.');
      })
      .catch(requestError => {
        if (!vigente) return;
        setCapacidades(null);
        setError(obtenerMensajeError(requestError));
        setMensaje('El escáner no está disponible.');
      })
      .finally(() => { if (vigente) setConsultandoCapacidades(false); });

    return () => { vigente = false; };
  }, [open, dispositivoId]);

  const actualizarOpcion = (campo, valor) => setOpciones(current => ({ ...current, [campo]: valor }));

  const escanear = async (reemplazar = false) => {
    if (!dispositivoId || !capacidades) return;
    const controller = new AbortController();
    scanController.current = controller;
    setEscaneando(true);
    setError('');
    setMensaje('Escaneando página...');
    try {
      const response = await scannerAPI.scan({
        deviceId: dispositivoId,
        options: {
          ...opciones,
          dpi: opciones.dpi ? Number(opciones.dpi) : undefined,
          pageSize: opciones.pageSize === '' ? undefined : Number(opciones.pageSize),
          colorMode: opciones.colorMode === '' ? undefined : Number(opciones.colorMode)
        }
      }, { signal: controller.signal });
      const paginasNuevas = response.data?.paginas || [];
      setPaginas(current => reemplazar ? paginasNuevas : [...current, ...paginasNuevas]);
      setMensaje('Procesando documento...');
      setMensaje('Documento escaneado correctamente.');
    } catch (scanError) {
      if (controller.signal.aborted || scanError.name === 'AbortError') {
        setMensaje('Escaneo cancelado.');
      } else {
        setMensaje('Se produjo un error durante el escaneo.');
        setError(obtenerMensajeError(scanError));
      }
    } finally {
      if (scanController.current === controller) scanController.current = null;
      setEscaneando(false);
    }
  };

  const cancelarEscaneo = () => scanController.current?.abort();

  const eliminarPagina = (id) => setPaginas(current => current.filter(page => page.id !== id));

  const moverPagina = (index, direction) => setPaginas(current => {
    const destino = index + direction;
    if (destino < 0 || destino >= current.length) return current;
    const ordenadas = [...current];
    [ordenadas[index], ordenadas[destino]] = [ordenadas[destino], ordenadas[index]];
    return ordenadas;
  });

  const crearPdf = async () => {
    if (!paginas.length) return;
    setGenerandoPdf(true);
    setError('');
    setMensaje('Generando PDF...');
    try {
      const pdf = await generarPdfEscaneado({ paginas, opciones, nombreCorrespondencia });
      if (pdf.byteLength > 10 * 1024 * 1024) {
        throw new Error('El PDF supera el límite actual de 10 MB. Reduzca el DPI o escanee en escala de grises.');
      }
      const nombreBase = String(nombreCorrespondencia || 'Correspondencia')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-|-$/g, '');
      const archivo = new File([pdf], `${nombreBase}-escaneado-${Date.now()}.pdf`, { type: 'application/pdf' });
      await onConfirm(archivo);
      setMensaje('Documento listo para adjuntar.');
      onClose();
    } catch (pdfError) {
      setMensaje('No se pudo generar el PDF.');
      setError(obtenerMensajeError(pdfError));
    } finally {
      setGenerandoPdf(false);
    }
  };

  const cerrar = () => {
    if (escaneando) cancelarEscaneo();
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={cerrar} title="Escanear documento" size="lg">
      <div className="scanner-dialog">
        <div className="scanner-status" role="status">
          {(buscando || escaneando || generandoPdf) && <LoaderCircle className="scanner-spin" size={18} />}
          <span>{mensaje}</span>
        </div>
        {error && <div className="scanner-error" role="alert">{error}</div>}

        {!dispositivos.length ? (
          <div className="scanner-empty">
            <ScanLine size={34} />
            <strong>No se detectaron escáneres disponibles.</strong>
            <p>Verifique que el escáner esté conectado, encendido y que sus controladores estén instalados correctamente.</p>
            <button type="button" className="btn btn-outline" onClick={detectarDispositivos} disabled={buscando}>
              <RefreshCw size={16} /> Volver a detectar
            </button>
          </div>
        ) : (
          <>
            <div className="scanner-config">
              <div className="form-group">
                <label className="form-label" htmlFor="scanner-device">Escáner disponible</label>
                <select id="scanner-device" className="form-input" value={dispositivoId} onChange={event => setDispositivoId(event.target.value)}>
                  <option value="">Seleccionar escáner...</option>
                  {dispositivos.map(device => <option key={device.id} value={device.id}>{device.nombre}{device.fabricante ? ` · ${device.fabricante}` : ''}</option>)}
                </select>
              </div>

              {consultandoCapacidades && <p className="scanner-hint">Consultando capacidades del dispositivo...</p>}
              {capacidades && <div className="scanner-options">
                {capacidades.tamanoPapel.length > 0 && <label className="form-group">
                  <span className="form-label">Tamaño de papel</span>
                  <select className="form-input" value={opciones.pageSize} onChange={event => actualizarOpcion('pageSize', event.target.value)}>
                    {capacidades.tamanoPapel.map(size => <option key={size.valor} value={size.valor}>{size.etiqueta}</option>)}
                  </select>
                </label>}
                {capacidades.resoluciones.length > 0 && <label className="form-group">
                  <span className="form-label">Resolución (DPI)</span>
                  <select className="form-input" value={opciones.dpi} onChange={event => actualizarOpcion('dpi', event.target.value)}>
                    {capacidades.resoluciones.map(dpi => <option key={dpi} value={dpi}>{dpi} DPI</option>)}
                  </select>
                </label>}
                {capacidades.modosColor.length > 0 && <label className="form-group">
                  <span className="form-label">Color</span>
                  <select className="form-input" value={opciones.colorMode} onChange={event => actualizarOpcion('colorMode', event.target.value)}>
                    {capacidades.modosColor.map(mode => <option key={mode.valor} value={mode.valor}>{mode.etiqueta}</option>)}
                  </select>
                </label>}
                {capacidades.alimentador && <label className="scanner-check">
                  <input type="checkbox" checked={opciones.adf} onChange={event => actualizarOpcion('adf', event.target.checked)} />
                  Alimentador automático (ADF)
                </label>}
                {capacidades.alimentador && capacidades.dobleCara && opciones.adf && <label className="scanner-check">
                  <input type="checkbox" checked={opciones.duplex} onChange={event => actualizarOpcion('duplex', event.target.checked)} />
                  Doble cara
                </label>}
                {capacidades.alimentador && !opciones.duplex && <span className="scanner-hint">Una cara</span>}
              </div>}

              {dispositivoId && <div className="scanner-actions">
                <button type="button" className="btn btn-primary" onClick={() => escanear(false)} disabled={!capacidades || escaneando || generandoPdf}>
                  <ScanLine size={16} /> {paginas.length ? 'Agregar página' : 'Escanear documento'}
                </button>
                {escaneando && <button type="button" className="btn btn-outline" onClick={cancelarEscaneo}>Cancelar escaneo</button>}
                {paginas.length > 0 && <button type="button" className="btn btn-outline" onClick={() => { setPaginas([]); escanear(true); }} disabled={escaneando || generandoPdf}>
                  <RefreshCw size={16} /> Volver a escanear
                </button>}
              </div>}
            </div>

            {paginas.length > 0 && <section className="scanner-preview">
              <div className="scanner-preview-header">
                <div>
                  <h4>Documento escaneado</h4>
                  <span>{paginas.length} página{paginas.length === 1 ? '' : 's'}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={crearPdf}
                  disabled={generandoPdf || escaneando}
                >
                  {generandoPdf ? <LoaderCircle className="scanner-spin" size={15} /> : <Check size={15} />}
                  {generandoPdf ? 'Generando PDF...' : 'Confirmar documento'}
                </button>
              </div>
              <div className="scanner-pages">
                {paginas.map((page, index) => (
                  <article className="scanner-page" key={page.id}>
                    <div
                      className="scanner-page-image"
                      onClick={() => setPreviewPagina(page)}
                      title="Clic para ver página completa"
                    >
                      <img
                        src={`data:image/jpeg;base64,${page.imagen}`}
                        alt={`Vista previa de página ${index + 1}`}
                      />
                      <div className="scanner-page-overlay">
                        <span><Eye size={13} /> Ver completa</span>
                      </div>
                    </div>
                    <div className="scanner-page-footer">
                      <span className="scanner-page-badge">Pág. {index + 1}</span>
                      <div className="scanner-page-actions">
                        <button
                          type="button"
                          className="btn btn-icon btn-outline"
                          title="Ver página completa"
                          aria-label="Ver página completa"
                          onClick={() => setPreviewPagina(page)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-outline"
                          title="Subir página"
                          aria-label="Subir página"
                          onClick={() => moverPagina(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-outline"
                          title="Bajar página"
                          aria-label="Bajar página"
                          onClick={() => moverPagina(index, 1)}
                          disabled={index === paginas.length - 1}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-outline scanner-remove"
                          title="Eliminar página"
                          aria-label="Eliminar página"
                          onClick={() => eliminarPagina(page.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>}
          </>
        )}

        {previewPagina && (
          <div className="scanner-lightbox" onClick={() => setPreviewPagina(null)}>
            <div className="scanner-lightbox-card" onClick={e => e.stopPropagation()}>
              <div className="scanner-lightbox-header">
                <strong>Vista previa — Página {paginas.findIndex(p => p.id === previewPagina.id) + 1}</strong>
                <button
                  type="button"
                  className="scanner-lightbox-close"
                  onClick={() => setPreviewPagina(null)}
                  aria-label="Cerrar vista previa"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="scanner-lightbox-body">
                <img
                  src={`data:image/jpeg;base64,${previewPagina.imagen}`}
                  alt="Página completa escaneada"
                />
              </div>
            </div>
          </div>
        )}

        <style>{`
          .scanner-dialog { display: grid; gap: 16px; }
          .scanner-status { display: flex; align-items: center; gap: 8px; min-height: 22px; color: var(--text-secondary); font-size: .9rem; }
          .scanner-spin { animation: scanner-rotate 1s linear infinite; }
          @keyframes scanner-rotate { to { transform: rotate(360deg); } }
          .scanner-error { padding: 10px 12px; border-left: 3px solid #b42318; background: #fff2f0; color: #8f1d14; overflow-wrap: anywhere; border-radius: 4px; }
          .scanner-empty { display: grid; justify-items: center; gap: 10px; padding: 32px 16px; color: var(--text-secondary); text-align: center; }
          .scanner-empty svg { color: var(--primary); }
          .scanner-empty strong { color: var(--text-primary); }
          .scanner-empty p { max-width: 520px; margin: 0 0 8px; }
          .scanner-config { display: grid; gap: 12px; }
          .scanner-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); align-items: end; gap: 12px; }
          .scanner-options .form-group { margin: 0; }
          .scanner-check { display: flex; align-items: center; gap: 8px; min-height: 40px; color: var(--text-primary); font-size: .9rem; }
          .scanner-check input { width: 16px; height: 16px; accent-color: var(--primary); }
          .scanner-hint { margin: 0; color: var(--text-muted); font-size: .85rem; }
          .scanner-actions { display: flex; flex-wrap: wrap; gap: 8px; }
          
          .scanner-preview { display: grid; gap: 14px; padding-top: 16px; border-top: 1px solid var(--border-color); }
          .scanner-preview-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
          .scanner-preview-header h4 { margin: 0 0 2px; color: var(--text-primary); font-size: 1rem; }
          .scanner-preview-header span { color: var(--text-muted); font-size: .85rem; }

          .scanner-pages {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 16px;
          }
          .scanner-page {
            display: flex;
            flex-direction: column;
            min-width: 0;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background: var(--surface, #ffffff);
            overflow: hidden;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          }
          .scanner-page:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border-color: var(--primary-light, #93c5fd);
          }
          .scanner-page-image {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 270px;
            min-height: 200px;
            background: #f1f5f9;
            padding: 12px;
            overflow: hidden;
            cursor: pointer;
            user-select: none;
          }
          .scanner-page-image img {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
            border-radius: 2px;
            background: #ffffff;
            display: block;
          }
          .scanner-page-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.18s ease;
          }
          .scanner-page-image:hover .scanner-page-overlay {
            opacity: 1;
          }
          .scanner-page-overlay span {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            background: rgba(15, 23, 42, 0.85);
            color: #ffffff;
            border-radius: 20px;
            font-size: 0.78rem;
            font-weight: 500;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
          }
          .scanner-page-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 8px 10px;
            background: var(--surface, #ffffff);
            border-top: 1px solid var(--border-color);
            position: relative;
            z-index: 2;
          }
          .scanner-page-badge {
            font-size: 0.78rem;
            font-weight: 600;
            color: var(--text-secondary);
            background: #f1f5f9;
            padding: 3px 8px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            white-space: nowrap;
          }
          .scanner-page-actions {
            display: flex;
            gap: 4px;
          }
          .scanner-page-actions .btn {
            min-width: 28px;
            height: 28px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .scanner-remove { color: #dc2626; }
          .scanner-remove:hover { background: #fee2e2; border-color: #fca5a5; }

          /* Lightbox preview */
          .scanner-lightbox {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(2px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: scanner-fade-in 0.15s ease-out;
          }
          .scanner-lightbox-card {
            background: #ffffff;
            border-radius: 8px;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            overflow: hidden;
          }
          .scanner-lightbox-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            background: #f8fafc;
          }
          .scanner-lightbox-header strong {
            font-size: 0.95rem;
            color: var(--text-primary);
          }
          .scanner-lightbox-close {
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .scanner-lightbox-close:hover {
            background: #e2e8f0;
            color: var(--text-primary);
          }
          .scanner-lightbox-body {
            padding: 16px;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #e2e8f0;
          }
          .scanner-lightbox-body img {
            max-width: 100%;
            max-height: 75vh;
            object-fit: contain;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            background: #ffffff;
          }

          @keyframes scanner-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @media (max-width: 560px) {
            .scanner-preview-header { align-items: flex-start; flex-direction: column; }
            .scanner-pages { grid-template-columns: 1fr; }
            .scanner-page-image { height: 220px; }
          }
        `}</style>
      </div>
    </Modal>
  );
}