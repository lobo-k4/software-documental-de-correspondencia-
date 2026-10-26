import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { notas as notasAPI } from '../../services/api';
import { formatearFechaHoraBolivia } from '../../utils/fecha';

const conceptosGanesha = [
  ['Auditoría Externa Financiera a Proyecto de Inversión Pública FDI', 'detalle_1'],
  ['N° de comprobantes:', 'comprobantes_1'],
  ['Costo del servicio:', 'costo_1'],
  ['Auditoría Externa Financiera a Proyecto de Inversión Pública MMAyA-VMRHR', 'detalle_2'],
  ['N° de comprobantes:', 'comprobantes_2'],
  ['Costo del servicio:', 'costo_2'],
  ['Plazo de ejecución:', 'plazo'],
  ['COSTO TOTAL DEL SERVICIO:', 'costo_total']
];

export default function VerificarNota() {
  const { id } = useParams();
  const solicitudes = useRef(new Map());
  const [nota, setNota] = useState(null);
  const [error, setError] = useState('');
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activa = true;
    setNota(null);
    setError('');
    setLimiteAlcanzado(null);
    setCargando(true);
    let solicitud = solicitudes.current.get(id);
    if (!solicitud) {
      solicitud = notasAPI.verificar(id);
      solicitudes.current.set(id, solicitud);
      solicitud.finally(() => {
        if (solicitudes.current.get(id) === solicitud) solicitudes.current.delete(id);
      }).catch(() => {});
    }

    solicitud
      .then(res => { if (activa) setNota(res.data); })
      .catch(err => {
        if (!activa) return;
        setError(err.message || 'No se pudo verificar la nota.');
        if (err.status === 429) setLimiteAlcanzado(err.data?.data || null);
      })
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
  }, [id]);

  const variables = nota?.datos_variables || {};
  const institucional = nota?.plantilla_codigo === 'GANESHA-NOTA-OFICIAL';
  const documentoInstitucional = ['PLANT-NOTA-OFICIAL', 'PLANT-MEMO-INTERNO', 'PLANT-CIRCULAR-INT']
    .includes(nota?.plantilla_codigo);
  const fechaRegistro = nota?.fecha_generacion
    ? formatearFechaHoraBolivia(nota.fecha_generacion)
    : '—';

  return (
    <main className="verificacion-page">
      <article className="verificacion-documento">
        <header className="verificacion-membrete">
          <div>
            <strong>Ganesha</strong>
            <span>CONSULTORES MULTIDISCIPLINARIOS</span>
          </div>
          <span className="verificacion-sistema">VERIFICACIÓN DE DOCUMENTO</span>
        </header>

        {cargando ? (
          <div className="verificacion-estado" role="status">
            <LoaderCircle className="verificacion-spinner" size={22} /> Consultando registro oficial...
          </div>
        ) : error ? (
          <div className="verificacion-estado verificacion-error" role="alert">
            <CircleAlert size={22} />
            <div>
              <strong>{limiteAlcanzado ? 'Límite de verificaciones alcanzado' : 'No se pudo verificar'}</strong>
              <p>{error}</p>
              {limiteAlcanzado && (
                <p>Verificaciones realizadas: {limiteAlcanzado.verificaciones_realizadas} de {limiteAlcanzado.limite_verificaciones}. No quedan verificaciones disponibles.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="verificacion-resultado">
              <CheckCircle2 size={22} />
              <div><strong>Nota registrada en el sistema</strong><span>Los datos corresponden al documento asociado a este código QR.</span></div>
            </div>

            <p className="verificacion-uso">
              Verificaciones: {nota.verificaciones_realizadas} de {nota.limite_verificaciones}
              {' · '}{nota.verificaciones_restantes} restantes
            </p>

            <div className="verificacion-titulo">
              <div><span>CITE</span><h1>{nota.numero_nota}</h1></div>
              <div className="verificacion-fecha"><span>REGISTRADA</span><strong>{fechaRegistro}</strong></div>
            </div>

            <h2>{nota.plantilla_titulo}</h2>
            {documentoInstitucional ? (
              <div className="verificacion-contenido-institucional" dangerouslySetInnerHTML={{ __html: nota.contenido_renderizado || '' }} />
            ) : institucional ? (
              <>
                <dl className="verificacion-datos">
                  <div><dt>Lugar</dt><dd>{variables.lugar}</dd></div>
                  <div><dt>Fecha de la nota</dt><dd>{variables.fecha}</dd></div>
                  <div><dt>Destinatario</dt><dd>{variables.destinatario}</dd></div>
                  <div><dt>Referencia</dt><dd>{variables.referencia}</dd></div>
                </dl>
                <p className="verificacion-cuerpo">{variables.cuerpo}</p>
                <div className="verificacion-tabla-wrap">
                  <table className="verificacion-tabla">
                    <thead><tr><th>CONCEPTO</th><th>DETALLE</th></tr></thead>
                    <tbody>
                      {conceptosGanesha.map(([concepto, campo], indice) => (
                        <tr key={campo}>
                          {indice === conceptosGanesha.length - 1
                            ? <th scope="row">{concepto}</th>
                            : <td>{concepto}</td>}
                          <td>{variables[campo]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="verificacion-cierre">{variables.despedida}</p>
                <div className="verificacion-firma">
                  <strong>{variables.firmante_nombre}</strong>
                  <span>{variables.firmante_cargo}</span>
                  <span>GANESHA LTDA.</span>
                </div>
              </>
            ) : (
              <dl className="verificacion-datos">
                {Object.entries(variables)
                  .filter(([clave]) => !['numero_nota', 'cite'].includes(clave))
                  .map(([clave, valor]) => <div key={clave}><dt>{clave.replaceAll('_', ' ')}</dt><dd>{String(valor ?? '')}</dd></div>)}
              </dl>
            )}
          </>
        )}
        <footer className="verificacion-pie">GANESHA LTDA. · Registro digital de correspondencia</footer>
      </article>
      <style>{`
        .verificacion-page { min-height: 100vh; box-sizing: border-box; padding: 32px 18px; background: #edf1f2; color: #1b252b; font-family: Georgia, 'Times New Roman', serif; }
        .verificacion-documento { position: relative; max-width: 820px; min-height: 580px; box-sizing: border-box; margin: 0 auto; padding: 38px 54px 28px; background: #fff; border: 1px solid #d5dcde; box-shadow: 0 12px 34px rgba(20, 38, 48, .1); }
        .verificacion-documento::before { position: absolute; top: 0; left: 0; right: 0; height: 7px; background: #286f99; content: ''; }
        .verificacion-membrete { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 3px solid #d4933d; }
        .verificacion-membrete div { display: grid; gap: 2px; color: #1c5d86; }
        .verificacion-membrete strong { font-size: 29px; line-height: 1; }
        .verificacion-membrete span { font-family: Arial, sans-serif; font-size: 9px; font-weight: 700; }
        .verificacion-sistema { padding-top: 8px; color: #56656c; text-align: right; }
        .verificacion-estado, .verificacion-resultado { display: flex; align-items: center; gap: 12px; margin: 30px 0; padding: 16px; background: #f0f6f3; color: #23613f; font-family: Arial, sans-serif; }
        .verificacion-estado { background: #f2f5f6; color: #44545c; }
        .verificacion-error { background: #fff2f0; color: #a33329; }
        .verificacion-error p { margin: 4px 0 0; }
        .verificacion-resultado div { display: grid; gap: 4px; }
        .verificacion-resultado span { font-size: 13px; }
        .verificacion-uso { margin: -18px 0 24px; color: #56656c; font: 12px Arial, sans-serif; text-align: right; }
        .verificacion-spinner { animation: verificacion-giro 1s linear infinite; }
        @keyframes verificacion-giro { to { transform: rotate(360deg); } }
        .verificacion-titulo { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 28px 0 24px; }
        .verificacion-titulo span, .verificacion-fecha span { display: block; margin-bottom: 5px; color: #64737a; font: 700 10px Arial, sans-serif; }
        .verificacion-titulo h1 { margin: 0; overflow-wrap: anywhere; color: #1c5d86; font-size: 23px; }
        .verificacion-fecha { text-align: right; font: 12px Arial, sans-serif; }
        .verificacion-documento h2 { margin: 0 0 20px; font-size: 17px; }
        .verificacion-datos { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 24px; margin: 20px 0; }
        .verificacion-datos div { min-width: 0; }
        .verificacion-datos dt { margin-bottom: 4px; color: #61717a; font: 700 11px Arial, sans-serif; text-transform: uppercase; }
        .verificacion-datos dd { margin: 0; overflow-wrap: anywhere; line-height: 1.45; }
        .verificacion-cuerpo, .verificacion-cierre { white-space: pre-wrap; line-height: 1.55; }
        .verificacion-tabla-wrap { overflow-x: auto; }
        .verificacion-tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
        .verificacion-tabla th, .verificacion-tabla td { padding: 8px; border: 1px solid #7b8589; text-align: left; vertical-align: top; }
        .verificacion-tabla thead { background: #e4e8eb; }
        .verificacion-tabla th:first-child, .verificacion-tabla td:first-child { width: 34%; }
        .verificacion-firma { display: grid; margin-top: 42px; line-height: 1.45; }
        .verificacion-pie { margin-top: 38px; padding-top: 12px; border-top: 3px solid #286f99; color: #64737a; font: 10px Arial, sans-serif; }
        @media (max-width: 600px) { .verificacion-page { padding: 0; } .verificacion-documento { min-height: 100vh; padding: 30px 20px 24px; border: 0; } .verificacion-membrete { gap: 8px; } .verificacion-membrete strong { font-size: 25px; } .verificacion-membrete span { font-size: 8px; } .verificacion-titulo { align-items: flex-start; flex-direction: column; } .verificacion-fecha { text-align: left; } .verificacion-datos { grid-template-columns: 1fr; } .verificacion-tabla { min-width: 560px; } }
        @media print { .verificacion-page { padding: 0; background: #fff; } .verificacion-documento { max-width: none; border: 0; box-shadow: none; } }
      `}</style>
    </main>
  );
}