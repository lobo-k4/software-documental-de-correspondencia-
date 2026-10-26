/**
 * Punto de entrada del servidor Backend (Express + Node.js)
 *
 * La lógica de negocio y los valores de calendario oficiales usan
 * America/La_Paz, independientemente de la zona horaria del sistema operativo.
 */
process.env.TZ = 'America/La_Paz';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = require('./src/app');
const config = require('./src/config/env');
const { testConnection, pool } = require('./src/config/database');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Asegurar que el directorio de subidas exista
if (!fs.existsSync(config.uploads.directory)) {
  fs.mkdirSync(config.uploads.directory, { recursive: true });
}

/**
 * Warmup inicial (evita ECONNRESET en el 1er request real).
 * Pre-calienta:
 *   1. El pool de PostgreSQL (adquiere una conexión física)
 *   2. bcryptjs (inicializa su fuente aleatoria y sus tablas internas Blowfish)
 *   3. jsonwebtoken (prueba firmar un token dummy)
 * Esto hace que el primer LOGIN de usuario sea inmediato y no venza timeout.
 */
const warmupServicio = async () => {
  try {
    console.log('🔄 Precalentando servicios (PG + bcrypt + JWT)...');
    const cliente = await pool.connect();
    await cliente.query('SELECT 1 AS warmup');
    cliente.release(true);
    const dummyHash = await bcrypt.hash('warmup_pre_login_password', 10);
    await bcrypt.compare('warmup_pre_login_password', dummyHash);
    const jwt = require('jsonwebtoken');
    jwt.sign({ warmup: true }, config.jwt.secret, { expiresIn: '1s' });
    console.log('✅ Warmup finalizado correctamente.');
  } catch (err) {
    console.warn('⚠️  Warmup no crítico falló:', err.message);
  }
};

// Iniciar servidor HTTP con keep-alive generoso
const server = app.listen(config.port, async () => {
  console.log('====================================================');
  console.log(`🚀 Servidor ejecutándose en el puerto: ${config.port}`);
  console.log(`🌐 Modo: ${config.env}  |  Zona horaria: ${process.env.TZ}`);
  console.log(`📁 Directorio de subidas: ${config.uploads.directory}`);
  console.log('====================================================');

  // Comprobar estado de conexión con PostgreSQL
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn('⚠️  ADVERTENCIA: La base de datos PostgreSQL no respondió.');
    console.warn('   Verifique que el servicio PostgreSQL esté en ejecución y los datos de .env sean correctos.');
  }

  // Lanzar warmup (asíncrono, no bloquea el listen)
  warmupServicio();
});

// Aumentar timeouts de keep-alive HTTP para evitar ECONNRESET con proxies/Vite
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 70 * 1000;
server.requestTimeout = 90 * 1000;

// Manejo seguro del cierre de la aplicación
const shutdown = () => {
  console.log('\nCerrando servidor HTTP y conexiones de base de datos...');
  server.close(async () => {
    try { await pool.end(); } catch (_) { /* ignorar */ }
    console.log('Servidor finalizado de forma ordenada.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
