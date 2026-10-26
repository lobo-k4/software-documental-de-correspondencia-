/**
 * Módulo de conexión a PostgreSQL utilizando Pool de conexiones (pg).
 * Diseñado para alta concurrencia, transacciones seguras y consultas parametrizadas.
 *
 * Las sesiones PostgreSQL usan America/La_Paz para que las fechas/calendarios
 * generados por SQL correspondan a la operación institucional en Bolivia.
 * Los TIMESTAMPTZ se normalizan a ISO UTC preservando el instante; el frontend
 * los muestra explícitamente en America/La_Paz.
 */
const { Pool, types } = require('pg');
const config = require('./env');

/* ===============================================================
   TypeParsers personalizados para fechas/horas.
   OIDs estándar PostgreSQL:
     1114 → timestamp (sin zona horaria) → lo tratamos como UTC
     1184 → timestamptz (con zona horaria) → PG devuelve el offset de la sesión
     1082 → date (solo fecha) → devolvemos string yyyy-mm-dd literal
   =============================================================== */
const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');

// Regex que parsea el string crudo que pg recibe del socket:
//   "2026-10-03 18:45:10.123"
//   "2026-10-03 18:45:10"
//   "2026-10-03 18:45:10-04" (timestamptz en sesión Bolivia)
const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

const timestampToIsoZ = (rawValue) => {
  if (rawValue == null || rawValue === '') return null;
  if (typeof rawValue === 'string') {
    const m = rawValue.match(TIMESTAMP_RE);
    if (m) {
      const [, y, mo, d, h, mi, s, msRaw, zoneRaw] = m;
      const ms = msRaw ? parseInt((msRaw + '000').slice(0, 3), 10) : 0;
      const zone = zoneRaw && zoneRaw !== 'Z'
        ? zoneRaw.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2').replace(/^([+-]\d{2})$/, '$1:00')
        : zoneRaw || 'Z';
      const isoValue = `${y}-${mo}-${d}T${h}:${mi}:${s}.${pad3(ms)}${zone}`;
      try { return new Date(isoValue).toISOString(); }
      catch (_) { return rawValue; }
    }
    if (!rawValue.endsWith('Z') && !/[+-]\d{2}(?::?\d{2})?$/.test(rawValue)) {
      try { return new Date(rawValue).toISOString(); }
      catch (_) { return rawValue; }
    }
    return rawValue;
  }
  return rawValue;
};

// 1114 = TIMESTAMP WITHOUT TIME ZONE (valores históricos se interpretan como UTC)
types.setTypeParser(1114, (value) => timestampToIsoZ(value));

// 1184 = TIMESTAMP WITH TIME ZONE (normaliza el offset local sin cambiar el instante)
types.setTypeParser(1184, (value) => timestampToIsoZ(value));

// 1082 = DATE (solo fecha). Se devuelve literal como yyyy-mm-dd para no desplazar
// fechas oficiales de registro/emisión por una conversión de zona horaria.
types.setTypeParser(1082, (value) => (value == null ? null : value));

const pool = new Pool({
  user: config.db.user,
  password: config.db.password,
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  max: 20, // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Aplicar la zona institucional al inicio evita SET concurrentes
  // al reutilizar una conexión recién creada del pool.
  options: '-c timezone=America/La_Paz',
  application_name: 'ganesha_correspondencia_api'
});

// Eventos de monitoreo del pool
pool.on('error', (err) => {
  console.error('Error inesperado en cliente inactivo del pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta parametrizada contra el pool de PostgreSQL.
 * @param {string} text - Consulta SQL parametrizada ($1, $2...)
 * @param {Array} params - Parámetros ordenados
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development' && duration > 500) {
      console.warn(`[SLOW QUERY - ${duration}ms]:`, text);
    }
    return res;
  } catch (error) {
    console.error('[DB QUERY ERROR]:', error.message, '| Query:', text);
    throw error;
  }
};

/**
 * Adquiere un cliente dedicado para transacciones compuestas (BEGIN / COMMIT / ROLLBACK).
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Comprueba la conectividad hacia la base de datos PostgreSQL.
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    const res = await pool.query(`
      SELECT NOW() AS now,
             current_database() AS db,
             current_setting('TIMEZONE') AS tz
    `);
    const row = res.rows[0];
    console.log(
      `✓ Conectado a PostgreSQL [DB: ${row.db}] ` +
      `[TZ: ${row.tz}] — Hora del servidor (ISO): ${row.now}`
    );
    return true;
  } catch (error) {
    console.error('✗ No se pudo conectar a PostgreSQL:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection
};
