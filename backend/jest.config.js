module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  coverageProvider: 'v8',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/models/database/initDb.js', '!src/models/database/migracionCargosNotificaciones.js'],
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: false
};
