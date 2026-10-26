import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  Download, 
  Calendar, 
  Filter, 
  Inbox, 
  Send, 
  Users, 
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import Badge from '../../components/Badge/Badge';
import { useAuth } from '../../hooks/useAuth';
import { fechaActualBoliviaISO, formatearFechaBolivia } from '../../utils/fecha';
import './Reportes.css';

const columnasExportacion = {
  recibida: [
    ['Código', 'codigo'],
    ['N.º documento externo', 'numero_documento_externo'],
    ['Fecha de recepción', 'fecha_recepcion'],
    ['Hora de recepción', 'hora_recepcion'],
    ['Remitente', 'remitente'],
    ['Institución remitente', 'institucion_remitente'],
    ['Asunto', 'asunto'],
    ['Destinatario', 'destinatario'],
    ['Prioridad', 'prioridad'],
    ['Estado', 'estado'],
    ['Tipo de documento', 'tipo_documento'],
    ['Área responsable', 'area_responsable'],
    ['Registrado por', 'registrado_por'],
  ],
  entregada: [
    ['Código', 'codigo'],
    ['N.º de nota', 'numero_nota'],
    ['Fecha de emisión', 'fecha_emision'],
    ['Hora de emisión', 'hora_emision'],
    ['Destinatario', 'destinatario'],
    ['Institución destinataria', 'institucion_destinatario'],
    ['Cargo del destinatario', 'cargo_destinatario'],
    ['Asunto', 'asunto'],
    ['Responsable remitente', 'responsable_remitente'],
    ['Medio de entrega', 'medio_entrega'],
    ['Estado', 'estado'],
    ['Tipo de documento', 'tipo_documento'],
    ['Área remitente', 'area_remitente'],
    ['Registrado por', 'registrado_por'],
  ],
  usuarios: [
    ['ID de usuario', 'id_usuario'],
    ['Nombre de usuario', 'username'],
    ['Nombre completo', 'nombre_completo'],
    ['Rol', 'rol_nombre'],
    ['Área', 'area_nombre'],
    ['Correspondencia recibida registrada', 'total_recibidas_registradas'],
    ['Correspondencia entregada registrada', 'total_entregadas_registradas'],
    ['Derivaciones realizadas', 'total_derivaciones_realizadas'],
    ['Notas generadas', 'total_notas_generadas'],
    ['Operaciones auditadas', 'total_operaciones_auditadas'],
    ['Último acceso', 'ultimo_acceso'],
  ],
};

export default function Reportes() {
  const { hasRole } = useAuth();
  const esAdmin = hasRole('Administrador');

  const [tipo, setTipo] = useState('recibida'); // 'recibida' | 'entregada' | 'usuarios'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState(null);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Catálogos para filtros
  const [areas, setAreas] = useState([]);

  // Filtros
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    estado: '',
    id_area: '',
    prioridad: ''
  });

  useEffect(() => {
    const cargarAreas = async () => {
      try {
        const res = await api.get('/catalogos/areas');
        setAreas(res.data || []);
      } catch (err) {
        console.error('Error cargando áreas:', err);
      }
    };
    cargarAreas();
  }, []);

  const handleChangeFiltro = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const handleLimpiarFiltros = () => {
    setFiltros({
      fecha_inicio: '',
      fecha_fin: '',
      estado: '',
      id_area: '',
      prioridad: ''
    });
  };

  const consultar = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filtros.fecha_inicio) params.fecha_inicio = filtros.fecha_inicio;
      if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.id_area) params.id_area = filtros.id_area;
      if (filtros.prioridad) params.prioridad = filtros.prioridad;

      const endpoint = tipo === 'usuarios' ? '/reportes/usuarios' : `/reportes/${tipo}`;
      const response = await api.get(endpoint, params);
      
      const payload = response.data || response;
      const filas = payload.datos || payload.data?.datos || (Array.isArray(payload) ? payload : []);
      const total = payload.total_registros || payload.data?.total_registros || filas.length;
      
      setDatos(filas);
      setTotalRegistros(total);
    } catch (err) {
      setError(err.message || 'No se pudo generar el reporte.');
      setDatos([]);
      setTotalRegistros(0);
    } finally {
      setLoading(false);
    }
  };

  // Cargar al cambiar de tipo
  useEffect(() => {
    consultar();
  }, [tipo]);

  // Exportar a Excel
  const exportarExcel = async () => {
    if (!datos || datos.length === 0) return;
    setError('');
    const columnas = columnasExportacion[tipo];
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema de Correspondencia';
      workbook.subject = 'Reporte administrativo';
      workbook.created = new Date();

      const nombreHoja = {
        recibida: 'Correspondencia recibida',
        entregada: 'Correspondencia entregada',
        usuarios: 'Actividad de usuarios',
      }[tipo];
      const worksheet = workbook.addWorksheet(nombreHoja);
      worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];
      worksheet.properties.defaultRowHeight = 22;
      worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      };

      worksheet.addRow(columnas.map(([titulo]) => titulo));
      datos.forEach(row => {
        worksheet.addRow(columnas.map(([, campo]) => row[campo] ?? ''));
      });

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: worksheet.rowCount, column: columnas.length },
      };

      worksheet.columns = columnas.map(([titulo], index) => {
        const anchoContenido = datos.reduce((maximo, row) => {
          const valor = row[columnas[index][1]];
          return Math.max(maximo, valor === null || valor === undefined ? 0 : String(valor).length);
        }, titulo.length);

        return { width: Math.min(Math.max(anchoContenido + 2, 14), 42) };
      });

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD5DEE8' } },
            left: { style: 'thin', color: { argb: 'FFD5DEE8' } },
            bottom: { style: 'thin', color: { argb: 'FFD5DEE8' } },
            right: { style: 'thin', color: { argb: 'FFD5DEE8' } },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
          };

          if (rowNumber === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF164E63' },
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'center',
              wrapText: true,
            };
            cell.border.bottom = { style: 'medium', color: { argb: 'FF0E3747' } };
          } else if (rowNumber % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F6FA' },
            };
          }
        });
      });
      worksheet.getRow(1).height = 32;

      const contenido = await workbook.xlsx.writeBuffer();
      const blob = new Blob([contenido], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fechaLocal = fechaActualBoliviaISO();
      link.setAttribute('download', `reporte_${tipo}_${fechaLocal}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || 'No se pudo exportar el reporte a Excel.');
    }
  };

  // Métricas del reporte actual
  const metricas = {
    total: datos ? datos.length : 0,
    atendidos: datos ? datos.filter(d => (d.estado || '').toLowerCase() === 'atendido' || (d.estado || '').toLowerCase() === 'entregado').length : 0,
    pendientes: datos ? datos.filter(d => ['recibido', 'derivado', 'en proceso', 'pendiente'].includes((d.estado || '').toLowerCase())).length : 0,
    archivados: datos ? datos.filter(d => (d.estado || '').toLowerCase() === 'archivado').length : 0,
  };

  return (
    <div className="page-container page-enter reportes-container">
      {/* Encabezado */}
      <div className="reportes-header">
        <div className="reportes-header-info">
          <h2>Reportes y Analítica</h2>
          <p>Consolidado, exportación y análisis estadístico del flujo documental — GANESHA LTDA</p>
        </div>

        <div>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={exportarExcel} 
            disabled={!datos || datos.length === 0}
            title="Descargar reporte de Excel con formato de tabla"
          >
            <Download size={16} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Selector de Tipo de Reporte (Pestañas) */}
      <div className="reportes-tabs-row">
        <button
          type="button"
          className={`reportes-tab-btn ${tipo === 'recibida' ? 'active' : ''}`}
          onClick={() => setTipo('recibida')}
        >
          <Inbox size={16} />
          <span>Correspondencia Recibida</span>
        </button>
        <button
          type="button"
          className={`reportes-tab-btn ${tipo === 'entregada' ? 'active' : ''}`}
          onClick={() => setTipo('entregada')}
        >
          <Send size={16} />
          <span>Correspondencia Entregada</span>
        </button>
        {esAdmin && (
          <button
            type="button"
            className={`reportes-tab-btn ${tipo === 'usuarios' ? 'active' : ''}`}
            onClick={() => setTipo('usuarios')}
          >
            <Users size={16} />
            <span>Actividad por Usuarios</span>
          </button>
        )}
      </div>

      {/* Tarjetas de Resumen Rápido / Métricas */}
      {datos && (
        <div className="reportes-metrics-grid">
          <div className="reportes-metric-card accent">
            <div className="reportes-metric-label">Total Registros</div>
            <div className="reportes-metric-value">{totalRegistros}</div>
          </div>
          {tipo !== 'usuarios' && (
            <>
              <div className="reportes-metric-card success">
                <div className="reportes-metric-label">Atendidos / Entregados</div>
                <div className="reportes-metric-value" style={{ color: 'var(--success)' }}>{metricas.atendidos}</div>
              </div>
              <div className="reportes-metric-card warning">
                <div className="reportes-metric-label">En Trámite / Pendientes</div>
                <div className="reportes-metric-value" style={{ color: 'var(--warning)' }}>{metricas.pendientes}</div>
              </div>
              <div className="reportes-metric-card muted">
                <div className="reportes-metric-label">Archivados</div>
                <div className="reportes-metric-value" style={{ color: 'var(--pizarra)' }}>{metricas.archivados}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Panel de Filtros */}
      {tipo !== 'usuarios' && (
        <div className="reportes-filters-card">
          <div className="reportes-filters-title">
            <Filter size={16} />
            <span>Parámetros de Filtrado</span>
          </div>
          <div className="reportes-filters-grid">
            <div>
              <label className="form-label">Fecha Desde</label>
              <input 
                type="date" 
                className="form-input" 
                value={filtros.fecha_inicio} 
                onChange={e => handleChangeFiltro('fecha_inicio', e.target.value)} 
              />
            </div>
            <div>
              <label className="form-label">Fecha Hasta</label>
              <input 
                type="date" 
                className="form-input" 
                value={filtros.fecha_fin} 
                onChange={e => handleChangeFiltro('fecha_fin', e.target.value)} 
              />
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select 
                className="form-select" 
                value={filtros.estado} 
                onChange={e => handleChangeFiltro('estado', e.target.value)}
              >
                <option value="">Todos los Estados</option>
                <option value="Recibido">Recibido</option>
                <option value="Derivado">Derivado</option>
                <option value="En proceso">En proceso</option>
                <option value="Atendido">Atendido</option>
                <option value="Archivado">Archivado</option>
                <option value="Entregado">Entregado</option>
              </select>
            </div>
            <div>
              <label className="form-label">Área</label>
              <select 
                className="form-select" 
                value={filtros.id_area} 
                onChange={e => handleChangeFiltro('id_area', e.target.value)}
              >
                <option value="">Todas las Áreas</option>
                {areas.map(a => (
                  <option key={a.id_area} value={a.id_area}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Prioridad</label>
              <select 
                className="form-select" 
                value={filtros.prioridad} 
                onChange={e => handleChangeFiltro('prioridad', e.target.value)}
              >
                <option value="">Todas</option>
                <option value="Baja">Baja</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="reportes-filters-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLimpiarFiltros}>
              <RotateCcw size={14} />
              <span>Limpiar</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={consultar} disabled={loading}>
              <Search size={14} />
              <span>{loading ? 'Consultando...' : 'Aplicar Filtros'}</span>
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      {/* Tabla de Resultados */}
      <div className="reportes-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
            <p style={{ margin: 0 }}>Generando reporte consolidado...</p>
          </div>
        ) : !datos || datos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <AlertCircle size={40} style={{ opacity: 0.35, marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No se encontraron registros con los criterios seleccionados.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="reportes-table">
              <thead>
                {tipo === 'recibida' ? (
                  <tr>
                    <th>Código</th>
                    <th>Fecha</th>
                    <th>Remitente</th>
                    <th>Tipo Doc.</th>
                    <th>Asunto</th>
                    <th>Área Resp.</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                  </tr>
                ) : tipo === 'entregada' ? (
                  <tr>
                    <th>Código</th>
                    <th>Fecha Emisión</th>
                    <th>Destinatario</th>
                    <th>Tipo Doc.</th>
                    <th>Asunto</th>
                    <th>Área Remitente</th>
                    <th>Medio Entrega</th>
                    <th>Estado</th>
                  </tr>
                ) : (
                  <tr>
                    {Object.keys(datos[0] || {}).map(k => (
                      <th key={k} style={{ textTransform: 'capitalize' }}>
                        {k.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {datos.map((row, idx) => (
                  <tr key={row.id_recibida || row.id_entregada || row.id_usuario || idx}>
                    {tipo === 'recibida' ? (
                      <>
                        <td style={{ fontWeight: 700, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                          {row.codigo}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {formatearFechaBolivia(row.fecha_recepcion)}
                        </td>
                        <td>
                          <strong>{row.remitente}</strong>
                          {row.institucion_remitente && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.institucion_remitente}</div>
                          )}
                        </td>
                        <td>{row.tipo_documento || '—'}</td>
                        <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.asunto}>
                          {row.asunto}
                        </td>
                        <td>{row.area_responsable || '—'}</td>
                        <td><Badge type="prioridad" value={row.prioridad} /></td>
                        <td><Badge type="estado" value={row.estado} /></td>
                      </>
                    ) : tipo === 'entregada' ? (
                      <>
                        <td style={{ fontWeight: 700, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                          {row.codigo}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {formatearFechaBolivia(row.fecha_emision)}
                        </td>
                        <td>
                          <strong>{row.destinatario}</strong>
                          {row.institucion_destino && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.institucion_destino}</div>
                          )}
                        </td>
                        <td>{row.tipo_documento || '—'}</td>
                        <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.asunto}>
                          {row.asunto}
                        </td>
                        <td>{row.area_remitente || '—'}</td>
                        <td>{row.medio_entrega || '—'}</td>
                        <td><Badge type="estado" value={row.estado} /></td>
                      </>
                    ) : (
                      Object.keys(datos[0] || {}).map(k => (
                        <td key={k}>{String(row[k] ?? '—')}</td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}