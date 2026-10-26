import { useState, useEffect } from 'react';
import { FileText, Eye, Send, RefreshCw } from 'lucide-react';
import { plantillas as plantillasAPI, notas as notasAPI } from '../../services/api';
import Modal from '../../components/Modal/Modal';
import { useAuth } from '../../hooks/useAuth';
import { formatearFechaBolivia, formatearFechaLargaBolivia } from '../../utils/fecha';
import './GeneradorNotas.css';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function renderPlantilla(html, variables, codigo) {
  const especiales = ['PLANT-NOTA-OFICIAL', 'PLANT-MEMO-INTERNO', 'PLANT-CIRCULAR-INT'];
  if (especiales.includes(codigo)) {
    const value = (key) => escapeHtml(variables[key] || '—');
    const titles = {
      'PLANT-NOTA-OFICIAL': 'NOTA OFICIAL INSTITUCIONAL',
      'PLANT-MEMO-INTERNO': 'MEMORÁNDUM INTERNO',
      'PLANT-CIRCULAR-INT': 'CIRCULAR INTERNA',
    };
    const row = (label, content) => `<tr><th style="width:20%;padding:9px 10px;border:1px solid #b7c5cc;background:#edf3f6;text-align:left;font:700 10px Arial,sans-serif;color:#31566a">${label}</th><td style="padding:9px 10px;border:1px solid #b7c5cc;font:12px Georgia,'Times New Roman',serif">${content}</td></tr>`;
    const table = (rows) => `<table style="width:100%;border-collapse:collapse;margin:0 0 22px">${rows}</table>`;
    const paragraph = (content) => `<p style="margin:0 0 16px;font:13px/1.7 Georgia,'Times New Roman',serif;white-space:pre-wrap">${content}</p>`;
    const signature = `<div style="margin:48px auto 0;text-align:center;font:12px/1.5 Georgia,'Times New Roman',serif"><div style="width:260px;margin:0 auto 7px;border-top:1px solid #45545c"></div><strong>${value('remitente_nombre')}</strong><br>${value('remitente_cargo')}</div>`;
    const header = `<header style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:4px solid #2677a8;padding:0 0 14px;margin:0 0 28px"><div><strong style="display:block;font-size:28px;line-height:1.1;color:#1c5d86">Ganesha</strong><span style="font:700 9px Arial,sans-serif;color:#2876a3">CONSULTORES MULTIDISCIPLINARIOS</span></div><div style="text-align:right;font:12px Arial,sans-serif;color:#26343b"><strong style="display:block;font-size:13px">CITE: ${value('numero_nota') === '—' ? 'Pendiente de asignación' : value('numero_nota')}</strong><span>${variables.lugar ? `${value('lugar')}, ` : ''}${value('fecha')}</span></div></header><h1 style="margin:0 0 24px;text-align:center;color:#1c5d86;font:700 17px Arial,sans-serif">${titles[codigo]}</h1>`;

    if (codigo === 'PLANT-NOTA-OFICIAL') {
      return `${header}${table(row('DESTINATARIO', `${value('destinatario')}<br>${value('cargo_destinatario')}<br><strong>${value('institucion_destinatario')}</strong>`) + row('REFERENCIA', `<strong>${value('asunto')}</strong>`))}<p style="font:13px Georgia,'Times New Roman',serif">De mi mayor consideración:</p>${paragraph(value('contenido'))}<p style="font:13px Georgia,'Times New Roman',serif">Sin otro particular, me despido con las consideraciones más distinguidas.</p>${signature}`;
    }
    if (codigo === 'PLANT-MEMO-INTERNO') {
      return `${header}${table(row('A', `${value('destinatario')} - ${value('cargo_destinatario')}`) + row('DE', `${value('remitente_nombre')} - ${value('remitente_cargo')}`) + row('FECHA', value('fecha')) + row('ASUNTO', `<strong>${value('asunto')}</strong>`))}${paragraph(value('contenido'))}${signature}`;
    }
    return `${header}${table(row('FECHA', value('fecha')) + row('DE', `${value('remitente_nombre')} - ${value('remitente_cargo')}`) + row('PARA', 'TODO EL PERSONAL INSTITUCIONAL') + row('ASUNTO', `<strong>${value('asunto')}</strong>`))}${paragraph(value('contenido'))}<p style="font:13px Georgia,'Times New Roman',serif">Agradeciendo su atención y cumplimiento estricto.</p>${signature}`;
  }
  if (!html) return '';
  let out = html;
  Object.entries(variables).forEach(([key, val]) => {
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), escapeHtml(val));
  });
  return out.replace(/{{\s*[^{}]+\s*}}/g, '');
}

const camposPorPlantilla = {
  'PLANT-NOTA-OFICIAL': {
    numero_nota: { etiqueta: 'CITE', requerida: true, placeholder: 'Ingrese el CITE de la nota' },
    lugar: { etiqueta: 'Lugar', valor_inicial: 'Cochabamba' },
    fecha: { etiqueta: 'Fecha', valor_inicial: 'fecha_actual' },
    destinatario: { etiqueta: 'Destinatario', valor_inicial: 'Gobierno Autónomo Municipal de Pocona' },
    cargo_destinatario: { etiqueta: 'Cargo del destinatario', valor_inicial: 'Máxima Autoridad Ejecutiva' },
    institucion_destinatario: { etiqueta: 'Institución destinataria', valor_inicial: 'Gobierno Autónomo Municipal de Pocona' },
    asunto: { etiqueta: 'Asunto', valor_inicial: 'Cotización de servicios de auditoría externa' },
    contenido: { etiqueta: 'Contenido', tipo: 'textarea', valor_inicial: 'En respuesta a su solicitud, remitimos la información correspondiente para su consideración y las acciones que estime pertinentes.' },
    remitente_nombre: { etiqueta: 'Nombre del remitente', valor_inicial: 'usuario_actual' },
    remitente_cargo: { etiqueta: 'Cargo del remitente', valor_inicial: 'cargo_actual' },
  },
  'PLANT-MEMO-INTERNO': {
    numero_nota: { etiqueta: 'CITE', requerida: true, placeholder: 'Ingrese el CITE del memorándum' },
    destinatario: { etiqueta: 'Destinatario', valor_inicial: 'Personal administrativo' },
    cargo_destinatario: { etiqueta: 'Cargo del destinatario', valor_inicial: 'Personal de la institución' },
    remitente_nombre: { etiqueta: 'Nombre del remitente', valor_inicial: 'usuario_actual' },
    remitente_cargo: { etiqueta: 'Cargo del remitente', valor_inicial: 'cargo_actual' },
    fecha: { etiqueta: 'Fecha', valor_inicial: 'fecha_actual' },
    asunto: { etiqueta: 'Asunto', valor_inicial: 'Coordinación de actividades institucionales' },
    contenido: { etiqueta: 'Contenido', tipo: 'textarea', valor_inicial: 'Por medio del presente, se solicita coordinar las actividades pendientes y remitir un informe de avance a la jefatura correspondiente.' },
  },
  'PLANT-CIRCULAR-INT': {
    numero_nota: { etiqueta: 'CITE', requerida: true, placeholder: 'Ingrese el CITE de la circular' },
    fecha: { etiqueta: 'Fecha', valor_inicial: 'fecha_actual' },
    remitente_nombre: { etiqueta: 'Nombre del remitente', valor_inicial: 'usuario_actual' },
    remitente_cargo: { etiqueta: 'Cargo del remitente', valor_inicial: 'cargo_actual' },
    asunto: { etiqueta: 'Asunto', valor_inicial: 'Comunicado interno' },
    contenido: { etiqueta: 'Contenido', tipo: 'textarea', valor_inicial: 'Se comunica a todo el personal que las actividades institucionales se desarrollarán conforme a la planificación vigente. Se agradece tomar nota y cumplir las disposiciones correspondientes.' },
  },
};

function prepararVariables(plantilla, usuario) {
  const metadatos = camposPorPlantilla[plantilla.codigo] || {};
  const variables = {};
  const campos = (plantilla.variables_requeridas || []).map(campo => {
    const variable = typeof campo === 'string' ? { nombre: campo } : campo;
    const configuracion = metadatos[variable.nombre] || {};
    const valorInicial = configuracion.valor_inicial === 'fecha_actual'
      ? formatearFechaLargaBolivia(new Date())
      : configuracion.valor_inicial === 'usuario_actual'
        ? usuario?.nombre_completo || 'Responsable de la institución'
        : configuracion.valor_inicial === 'cargo_actual'
          ? usuario?.cargo || 'Responsable de área'
          : configuracion.valor_inicial;
    variables[variable.nombre] = (typeof campo === 'string' ? '' : campo.valor_inicial) || valorInicial || '';
    return { ...variable, ...configuracion };
  });
  return { variables, campos };
}

export default function GeneradorNotas() {
  const { user } = useAuth();
  const [plantillas, setPlantillas]   = useState([]);
  const [plantilla, setPlantilla]     = useState(null);
  const [variables, setVariables]     = useState({});
  const [preview, setPreview]         = useState('');
  const [modalPreview, setModalPreview] = useState(false);
  const [modalConfirmarGeneracion, setModalConfirmarGeneracion] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [modalVistaNota, setModalVistaNota] = useState(false);
  const [historial, setHistorial]     = useState([]);
  const [notaVista, setNotaVista] = useState(null);
  const [cargandoNotaVista, setCargandoNotaVista] = useState(false);
  const [errorNotaVista, setErrorNotaVista] = useState('');
  const [notaGenerada, setNotaGenerada] = useState(null);
  const [errorGeneracion, setErrorGeneracion] = useState('');
  const [generando, setGenerando]     = useState(false);
  const [registrandoEntregada, setRegistrandoEntregada] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);

  useEffect(() => {
    plantillasAPI.getAll().then(res => {
      const lista = res.data || [];
      setPlantillas(lista);
      if (lista.length > 0) {
        const primeraPlantilla = lista.find(p => p.codigo === 'GANESHA-NOTA-OFICIAL')
          || lista.find(p => p.titulo === 'Circular Interna')
          || lista[0];
        const { variables: vars } = prepararVariables(primeraPlantilla, user);
        setPlantilla(primeraPlantilla);
        setVariables(vars);
        setPreview(renderPlantilla(primeraPlantilla.cuerpo_plantilla, vars, primeraPlantilla.codigo));
      }
    });
    cargarHistorial();
  }, []);

  useEffect(() => {
    if (plantilla) {
      setPreview(renderPlantilla(plantilla.cuerpo_plantilla, variables, plantilla.codigo));
    }
  }, [plantilla, variables]);

  const cargarHistorial = async () => {
    const res = await notasAPI.getAll();
    setHistorial(res.data?.notas || []);
  };

  const handleVerNota = async (nota) => {
    setModalHistorial(false);
    setModalVistaNota(true);
    setNotaVista(null);
    setErrorNotaVista('');
    setCargandoNotaVista(true);
    try {
      const res = await notasAPI.getById(nota.id_nota);
      if (!res.data?.contenido_renderizado?.trim()) {
        throw new Error('No hay una vista previa disponible para esta nota.');
      }
      setNotaVista(res.data);
    } catch (err) {
      setErrorNotaVista(err.message || 'No se pudo cargar la nota.');
    } finally {
      setCargandoNotaVista(false);
    }
  };

  const handlePlantillaChange = (id) => {
    const p = plantillas.find(p => p.id_plantilla === parseInt(id, 10));
    setPlantilla(p || null);
    if (p) {
      const { variables: vars } = prepararVariables(p, user);
      setVariables(vars);
      setPreview(renderPlantilla(p.cuerpo_plantilla, vars, p.codigo));
    }
  };

  const handleVar = (key, val) => setVariables(v => ({ ...v, [key]: val }));

  const handlePreview = async () => {
    if (!plantilla) return;
    setLoadingPrev(true);
    try {
      const res = await notasAPI.previsualizar({
        id_plantilla: plantilla.id_plantilla,
        datos_variables: variables,
      });
      setPreview(renderPlantilla(plantilla.cuerpo_plantilla, variables, plantilla.codigo) || res.data?.contenido_renderizado);
      setModalPreview(true);
    } catch {
      setPreview(renderPlantilla(plantilla.cuerpo_plantilla, variables, plantilla.codigo));
      setModalPreview(true);
    } finally {
      setLoadingPrev(false);
    }
  };

  const handleGenerar = async () => {
    if (!plantilla) return;
    setErrorGeneracion('');
    const metadatos = camposPorPlantilla[plantilla.codigo] || {};
    const faltantes = (plantilla.variables_requeridas || [])
      .map(v => typeof v === 'string' ? { nombre: v } : v)
      .filter(v => (metadatos[v.nombre]?.requerida ?? v.requerida)
        && !String(variables[v.nombre] || '').trim());
    if (faltantes.length > 0) {
      alert(`Complete los campos obligatorios: ${faltantes.map(v => v.etiqueta || v.nombre).join(', ')}.`);
      return;
    }
    setGenerando(true);
    try {
      const res = await notasAPI.generar({
        id_plantilla: plantilla.id_plantilla,
        datos_variables: variables,
        despachar_como_entregada: false,
      });
      setNotaGenerada(res.data);
      cargarHistorial();
    } catch (err) {
      const respuesta = typeof err.data === 'string' ? err.data.replace(/<[^>]*>/g, ' ').trim() : '';
      setErrorGeneracion(err.data?.error
        ? `No se pudo generar: ${err.data.error}`
        : err.data?.message || (respuesta
        ? `El servidor respondió con un error${err.status ? ` (HTTP ${err.status})` : ''}: ${respuesta.slice(0, 240)}`
        : `${err.message || 'Error al generar la nota.'}${err.status ? ` (HTTP ${err.status})` : ''}`));
    } finally {
      setGenerando(false);
    }
  };

  const handleRegistrarEntregada = async (nota) => {
    if (!nota?.id_nota || nota.id_entregada) return;
    setRegistrandoEntregada(true);
    try {
      const res = await notasAPI.registrarEntregada(nota.id_nota, {
        id_area_remitente: user?.id_area,
        responsable_remitente: user?.nombre_completo,
      });
      setNotaGenerada(prev => prev?.id_nota === nota.id_nota
        ? { ...prev, id_entregada: res.data.id_entregada, correspondencia_entregada_codigo: res.data.codigo }
        : prev);
      alert(`Registrada como correspondencia entregada: ${res.data.codigo}`);
      cargarHistorial();
    } catch (err) {
      alert(err.data?.message || err.message || 'Error al registrar la salida.');
    } finally {
      setRegistrandoEntregada(false);
    }
  };

  return (
    <div className="page-container page-enter generador-container">
      {/* Encabezado */}
      <div className="generador-header">
        <div className="generador-header-info">
          <h2>Generador de Notas Institucionales</h2>
          <p>Redacte y emita documentos formales con código QR a partir de plantillas preconfiguradas</p>
        </div>
        <div className="generador-header-actions">
          <button className="btn btn-secondary" onClick={() => setModalHistorial(true)}>
            <Eye size={16} />
            <span>Historial de notas</span>
          </button>
        </div>
      </div>

      <div className="generador-layout">
        {/* Panel izquierdo: formulario */}
        <div className="generador-form-card">
          <h3 className="generador-section-title">Configuración del Documento</h3>

          <div className="form-group">
            <label className="form-label">Plantilla Institucional *</label>
            <select
              className="form-select"
              value={plantilla?.id_plantilla || ''}
              onChange={e => handlePlantillaChange(e.target.value)}
            >
              <option value="">Seleccionar plantilla...</option>
              {plantillas.map(p => <option key={p.id_plantilla} value={p.id_plantilla}>{p.titulo}</option>)}
            </select>
          </div>

          {plantilla && (
            <>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>{plantilla.tipo}</p>

              {(plantilla.variables_requeridas || []).length > 0 && (
                <div className="generador-variables-list">
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Variables Requeridas</h4>
                  {prepararVariables(plantilla, user).campos.map(variable => {
                    return (
                      <div className="form-group" key={variable.nombre} style={{ marginBottom: 0 }}>
                        <label className="generador-field-label">
                          <span>
                            {variable.etiqueta || variable.nombre}
                            {variable.requerida && <span className="generador-field-required">*</span>}
                          </span>
                        </label>
                        {variable.tipo === 'textarea' ? (
                          <textarea
                            className="form-input"
                            rows={3}
                            required={variable.requerida}
                            value={variables[variable.nombre] || ''}
                            onChange={e => handleVar(variable.nombre, e.target.value)}
                            placeholder={variable.placeholder || ''}
                            readOnly={variable.soloLectura}
                          />
                        ) : (
                          <input
                            className="form-input"
                            type={variable.tipo || 'text'}
                            required={variable.requerida}
                            value={variables[variable.nombre] || ''}
                            onChange={e => handleVar(variable.nombre, e.target.value)}
                            placeholder={variable.placeholder || (variable.soloLectura ? 'Se asigna al generar el documento' : '')}
                            readOnly={variable.soloLectura}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handlePreview} disabled={loadingPrev}>
                  <Eye size={16} /> {loadingPrev ? 'Generando...' : 'Vista previa'}
                </button>
                <button className="btn btn-primary" onClick={() => setModalConfirmarGeneracion(true)} disabled={generando}>
                  <Send size={16} /> {generando ? 'Generando...' : 'Generar documento'}
                </button>
              </div>

              {errorGeneracion && (
                <div className="alert alert-danger" style={{ marginTop: '16px' }} role="alert">
                  {errorGeneracion}
                </div>
              )}

              {notaGenerada && (
                <div className="generador-success-card">
                  <strong style={{ fontSize: '0.9375rem' }}>Nota {notaGenerada.numero_nota} generada con éxito</strong>
                  <span style={{ fontSize: '0.85rem' }}>El documento digital con QR ha sido registrado en el archivo.</span>
                  {notaGenerada.codigo_qr && (
                    <div className="generador-qr-wrap">
                      <img className="generador-qr-img" src={notaGenerada.codigo_qr} alt={`QR para ${notaGenerada.numero_nota}`} />
                      <a href={notaGenerada.url_verificacion} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-link)' }}>
                        Abrir verificación pública de la nota
                      </a>
                    </div>
                  )}
                  {!notaGenerada.id_entregada && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleRegistrarEntregada(notaGenerada)} disabled={registrandoEntregada} style={{ alignSelf: 'flex-start' }}>
                      {registrandoEntregada ? 'Registrando...' : 'Registrar como correspondencia entregada'}
                    </button>
                  )}
                  {notaGenerada.id_entregada && (
                    <span style={{ fontSize: '0.85rem' }}>
                      Asociada a salida: <strong>{notaGenerada.correspondencia_entregada_codigo}</strong>
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {!plantilla && (
            <div className="generador-empty-state">
              <FileText size={48} />
              <p>Seleccione una plantilla en el selector superior para comenzar a redactar.</p>
            </div>
          )}
        </div>

        {/* Panel derecho: vista previa en hoja ejecutiva */}
        {plantilla && (
          <div className="generador-preview-card">
            <div className="generador-preview-header">
              <h3>Vista Previa en Tiempo Real</h3>
            </div>
            <div className="generador-sheet-viewport">
              <article
                className="generador-paper-sheet"
                dangerouslySetInnerHTML={{ __html: preview || renderPlantilla(plantilla.cuerpo_plantilla, variables, plantilla.codigo) }}
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalConfirmarGeneracion}
        onClose={() => setModalConfirmarGeneracion(false)}
        title="Confirmar generación"
        size="sm"
      >
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)' }}>
          ¿Está seguro de que desea generar este documento?
        </p>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setModalConfirmarGeneracion(false)}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setModalConfirmarGeneracion(false);
              handleGenerar();
            }}
            disabled={generando}
          >
            Confirmar
          </button>
        </div>
      </Modal>

      {/* Modal Vista Previa completa */}
      <Modal isOpen={modalPreview} onClose={() => setModalPreview(false)} title="Vista Previa del Documento" size="lg">
        <div className="nota-preview-body" dangerouslySetInnerHTML={{ __html: preview }} />
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => { setModalPreview(false); handleGenerar(); }}>
            <Send size={16} /> Generar
          </button>
        </div>
      </Modal>

      {/* Modal Historial */}
      <Modal isOpen={modalHistorial} onClose={() => setModalHistorial(false)} title="Historial de Notas Generadas" size="lg">
        <table className="data-table">
          <thead>
            <tr><th>Código</th><th>Plantilla</th><th>Fecha</th><th>Generado por</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {historial.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted">Sin notas generadas.</td></tr>
            ) : historial.map(n => (
              <tr key={n.id_nota}>
                <td><span className="code-tag">{n.numero_nota}</span></td>
                <td>{n.plantilla_titulo || '—'}</td>
                <td>{formatearFechaBolivia(n.fecha_generacion)}</td>
                <td>{n.usuario_genero_nombre || '—'}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => handleVerNota(n)}>
                    <Eye size={14} /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      <Modal
        isOpen={modalVistaNota}
        onClose={() => setModalVistaNota(false)}
        title={`Vista previa${notaVista?.numero_nota ? ` - ${notaVista.numero_nota}` : ''}`}
        size="xl"
      >
        {cargandoNotaVista ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }} role="status">
            Cargando documento...
          </div>
        ) : errorNotaVista ? (
          <div className="generador-error" role="alert">{errorNotaVista}</div>
        ) : notaVista && (
          <iframe
            title={`Vista previa de la nota ${notaVista.numero_nota}`}
            sandbox=""
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{box-sizing:border-box;max-width:900px;margin:0 auto;padding:32px;background:#fff;color:#111827;font-family:"Times New Roman",Georgia,serif;line-height:1.6}img{max-width:100%;height:auto}table{max-width:100%;border-collapse:collapse}@media(max-width:600px){body{padding:16px}}</style></head><body>${notaVista.contenido_renderizado}</body></html>`}
            style={{ display: 'block', width: '100%', height: '70vh', border: '1px solid var(--border-color)', borderRadius: '6px', background: '#fff' }}
          />
        )}
      </Modal>

    </div>
  );
}
