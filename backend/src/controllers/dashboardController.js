/**
 * Controlador para el Dashboard e Indicadores Estadísticos (Módulo 5).
 * Todas las métricas y gráficos se calculan directamente desde PostgreSQL.
 */
const { query } = require('../config/database');
const { success, serverError } = require('../utils/responseHelper');

/**
 * Obtener métricas consolidadas para el Dashboard
 * GET /api/dashboard/metricas
 */
const getMetricasDashboard = async (req, res) => {
  try {
    // 1. Totales globales y por estado en correspondencia recibida
    const sqlRecibidaEstados = `
      SELECT 
        COUNT(*) AS total_recibida,
        COUNT(*) FILTER (WHERE estado IN ('Recibido', 'En revisión')) AS pendientes,
        COUNT(*) FILTER (WHERE estado IN ('Derivado', 'En proceso')) AS en_proceso,
        COUNT(*) FILTER (WHERE estado = 'Atendido') AS atendidas,
        COUNT(*) FILTER (WHERE estado = 'Archivado') AS archivadas,
        COUNT(*) FILTER (WHERE date_trunc('month', fecha_recepcion) = date_trunc('month', CURRENT_DATE)) AS recibidos_mes_actual
      FROM correspondencia_recibida
      WHERE activo = TRUE
    `;
    const resRecibida = await query(sqlRecibidaEstados);
    const statsRecibida = resRecibida.rows[0];

    // 2. Totales globales en correspondencia entregada
    const sqlEntregadaEstados = `
      SELECT 
        COUNT(*) AS total_entregada,
        COUNT(*) FILTER (WHERE estado = 'Emitido') AS emitidas,
        COUNT(*) FILTER (WHERE estado = 'Entregado') AS entregadas_confirmadas,
        COUNT(*) FILTER (WHERE date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE)) AS entregados_mes_actual
      FROM correspondencia_entregada
      WHERE activo = TRUE
    `;
    const resEntregada = await query(sqlEntregadaEstados);
    const statsEntregada = resEntregada.rows[0];

    // 3. Distribución por Estado (Correspondencia Recibida)
    const sqlEstados = `
      SELECT estado, COUNT(*) AS cantidad
      FROM correspondencia_recibida
      WHERE activo = TRUE
      GROUP BY estado
      ORDER BY cantidad DESC
    `;
    const resEstados = await query(sqlEstados);

    // 4. Distribución por Área Responsable (Correspondencia Recibida)
    const sqlAreas = `
      SELECT a.nombre AS area_nombre, a.sigla, COUNT(cr.id_recibida) AS total_documentos
      FROM areas a
      LEFT JOIN correspondencia_recibida cr ON a.id_area = cr.id_area_responsable AND cr.activo = TRUE
      WHERE a.activo = TRUE
      GROUP BY a.id_area, a.nombre, a.sigla
      ORDER BY total_documentos DESC
    `;
    const resAreas = await query(sqlAreas);

    // 5. Comparativa mensual de correspondencia (últimos 6 meses)
    const sqlMensual = `
      WITH meses AS (
        SELECT to_char(d, 'YYYY-MM') AS mes, to_char(d, 'Mon YYYY') AS mes_etiqueta
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) d
      )
      SELECT 
        m.mes,
        m.mes_etiqueta,
        COALESCE(rec.cantidad, 0) AS recibidos,
        COALESCE(ent.cantidad, 0) AS entregados
      FROM meses m
      LEFT JOIN (
        SELECT to_char(fecha_recepcion, 'YYYY-MM') AS mes, COUNT(*) AS cantidad
        FROM correspondencia_recibida
        WHERE activo = TRUE
        GROUP BY to_char(fecha_recepcion, 'YYYY-MM')
      ) rec ON m.mes = rec.mes
      LEFT JOIN (
        SELECT to_char(fecha_emision, 'YYYY-MM') AS mes, COUNT(*) AS cantidad
        FROM correspondencia_entregada
        WHERE activo = TRUE
        GROUP BY to_char(fecha_emision, 'YYYY-MM')
      ) ent ON m.mes = ent.mes
      ORDER BY m.mes ASC
    `;
    const resMensual = await query(sqlMensual);

    return success(res, {
      resumen: {
        total_recibida: parseInt(statsRecibida.total_recibida, 10),
        total_entregada: parseInt(statsEntregada.total_entregada, 10),
        pendientes: parseInt(statsRecibida.pendientes, 10),
        en_proceso: parseInt(statsRecibida.en_proceso, 10),
        atendidas: parseInt(statsRecibida.atendidas, 10),
        archivadas: parseInt(statsRecibida.archivadas, 10),
        recibidos_mes_actual: parseInt(statsRecibida.recibidos_mes_actual, 10),
        entregados_mes_actual: parseInt(statsEntregada.entregados_mes_actual, 10)
      },
      por_estado: resEstados.rows,
      por_area: resAreas.rows,
      evolucion_mensual: resMensual.rows
    }, 'Métricas del Dashboard obtenidas.');
  } catch (error) {
    console.error('[GET METRICAS DASHBOARD ERROR]:', error);
    return serverError(res, 'Error al calcular métricas del Dashboard.', error);
  }
};

module.exports = {
  getMetricasDashboard
};
