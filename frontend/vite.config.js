import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'node:https';
import http from 'node:http';

// Agente HTTP reutilizable con keep-alive para evitar ECONNRESET
// en el proxy de Vite cuando el primer request tarda > 1s (warmup).
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60 * 1000,
  maxSockets: 50,
  timeout: 2 * 60 * 1000
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60 * 1000,
  maxSockets: 50,
  timeout: 2 * 60 * 1000
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: false,
        timeout: 120 * 1000,
        proxyTimeout: 120 * 1000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (proxyReq.agent !== undefined) return;
            proxyReq.agent = proxyReq.protocol === 'https:' ? httpsAgent : httpAgent;
          });
          proxy.on('error', (err, _req, _res) => {
            console.warn('[Vite PROXY] Error al reenviar solicitud al backend:', err.code || err.message);
          });
        }
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 120 * 1000,
        proxyTimeout: 120 * 1000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (proxyReq.agent !== undefined) return;
            proxyReq.agent = proxyReq.protocol === 'https:' ? httpsAgent : httpAgent;
          });
        }
      }
    }
  }
});
