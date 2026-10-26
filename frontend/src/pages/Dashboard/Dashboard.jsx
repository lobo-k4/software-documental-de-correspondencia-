import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Send,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { api } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/* Paleta premium: oro viejo + pizarra sobre lino. */
const ACCENT = '#C5A880';
const ACCENT_DEEP = '#93763F';
const SLATE = '#75828D';
const SLATE_SOFT = 'rgba(117, 130, 141, 0.85)';
const GRID = 'rgba(117, 130, 141, 0.16)';
const TOOLTIP_BG = '#141E26';

/* ── Opciones de gráficos ────────────────────────────────── */
const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      align: 'end',
      labels: {
        font: { size: 12, family: 'Inter, system-ui, sans-serif', weight: '600' },
        color: SLATE_SOFT,
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        padding: 18,
      },
    },
    tooltip: {
      backgroundColor: TOOLTIP_BG,
      titleFont: { size: 12, weight: '600' },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 10,
      displayColors: true,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { font: { size: 11 }, color: SLATE_SOFT },
    },
    y: {
      grid: { color: GRID },
      border: { display: false },
      ticks: { font: { size: 11 }, color: SLATE_SOFT, precision: 0 },
      beginAtZero: true,
    },
  },
};

const DOUGHNUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
        color: SLATE_SOFT,
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: TOOLTIP_BG,
      titleFont: { size: 12, weight: '600' },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 4,
    },
  },
};

const ESTADO_COLORS = ['#C5A880', '#E7D6B4', '#D8D5CB', '#8B95A2', '#75828D', '#232B32'];

/* ── Tarjeta de indicador ─────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, color, bg }) => (
  <div className="stat-card" style={{ '--stat-accent': color, borderLeftColor: color }}>
    <div className="stat-card-icon" style={{ backgroundColor: bg, color }}>
      <Icon size={22} />
    </div>
    <div style={{ flex: 1 }}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value ?? '—'}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  </div>
);

/* ── Componente principal ─────────────────────────────────── */
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isDark } = useTheme();

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/dashboard/metricas');
      if (res.success) setData(res.data);
    } catch (err) {
      setError(err.message || 'Error al cargar las métricas del Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  if (loading) {
    return (
      <div className="page-container dashboard-loading">
        <div className="spinner" />
        <p>Cargando indicadores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="alert alert-danger" style={{ marginTop: '24px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const resumen = data?.resumen || {};

  const chartMensualData = {
    labels: data?.evolucion_mensual?.map(m => m.mes_etiqueta) || [],
    datasets: [
      {
        label: 'Recibida',
        data: data?.evolucion_mensual?.map(m => m.recibidos) || [],
        backgroundColor: ACCENT,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 28,
      },
      {
        label: 'Entregada',
        data: data?.evolucion_mensual?.map(m => m.entregados) || [],
        backgroundColor: SLATE,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 28,
      },
    ],
  };

  const estadosLabels = data?.por_estado?.map(e => e.estado) || [];
  const chartEstadosData = {
    labels: estadosLabels,
    datasets: [{
      data: data?.por_estado?.map(e => e.cantidad) || [],
      backgroundColor: ESTADO_COLORS,
      borderWidth: 3,
      borderColor: isDark ? '#14181E' : '#FFFFFF',
      hoverBorderWidth: 3,
      hoverOffset: 6,
    }],
  };

  return (
    <div className="page-container page-enter">

      {/* Encabezado de página */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="dashboard-greeting">
            <TrendingUp size={18} />
            Panel de Indicadores
          </div>
          <p className="page-subtitle">
            Resumen estadístico en tiempo real · GANESHA LTDA
          </p>
        </div>
        <button onClick={fetchDashboardData} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas de indicadores */}
      <div className="dashboard-stats-grid">
        <StatCard
          icon={Inbox}
          label="Correspondencia Recibida"
          value={resumen.total_recibida}
          sub={`${resumen.recibidos_mes_actual ?? 0} este mes`}
          color="#C5A880"
          bg="var(--accent-soft-2)"
        />
        <StatCard
          icon={Send}
          label="Correspondencia Entregada"
          value={resumen.total_entregada}
          sub={`${resumen.entregados_mes_actual ?? 0} este mes`}
          color="#75828D"
          bg="var(--bg-subtle)"
        />
        <StatCard
          icon={Clock}
          label="En Proceso / Derivada"
          value={resumen.en_proceso}
          sub={`${resumen.pendientes ?? 0} pendientes iniciales`}
          color="#B3986F"
          bg="var(--warning-bg)"
        />
        <StatCard
          icon={CheckCircle2}
          label="Atendidas"
          value={resumen.atendidas}
          sub={`${resumen.archivadas ?? 0} archivadas`}
          color="#1E7A45"
          bg="var(--success-bg)"
        />
      </div>

      {/* Gráficos */}
      <div className="dashboard-charts-grid">

        {/* Evolución mensual */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Inbox size={16} />
              Correspondencia Mensual
            </h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Bar data={chartMensualData} options={BAR_OPTIONS} />
            </div>
          </div>
        </div>

        {/* Por estado */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Archive size={16} />
              Distribución por Estado
            </h3>
          </div>
          <div className="card-body">
            <div className="chart-container chart-doughnut">
              {estadosLabels.length > 0 ? (
                <Doughnut data={chartEstadosData} options={DOUGHNUT_OPTIONS} />
              ) : (
                <div className="chart-empty">
                  <Archive size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
                  <p>Sin datos suficientes para graficar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla por área */}
      <div className="card" style={{ marginTop: '4px' }}>
        <div className="card-header">
          <h3 className="card-title">Carga de Documentos por Área Institucional</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Área Institucional</th>
                <th>Sigla</th>
                <th style={{ textAlign: 'right' }}>Total Documentos</th>
              </tr>
            </thead>
            <tbody>
              {data?.por_area?.length > 0 ? (
                data.por_area.map((a, i) => (
                  <tr key={i}>
                    <td className="text-muted text-xs">{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{a.area_nombre}</td>
                    <td>
                      {a.sigla ? (
                        <span className="code-tag">{a.sigla}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>
                        {a.total_documentos}
                      </strong>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    <div className="table-empty">
                      <p className="table-empty-text">Sin datos por área disponibles</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
