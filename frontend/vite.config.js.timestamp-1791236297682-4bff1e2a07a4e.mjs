// vite.config.js
import { defineConfig } from "file:///C:/Users/lobo.DESKTOP-BG9I1FB/Desktop/SistemaCorrespondencia/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/lobo.DESKTOP-BG9I1FB/Desktop/SistemaCorrespondencia/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import https from "node:https";
import http from "node:http";
var httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60 * 1e3,
  maxSockets: 50,
  timeout: 2 * 60 * 1e3
});
var httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60 * 1e3,
  maxSockets: 50,
  timeout: 2 * 60 * 1e3
});
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: false,
        timeout: 120 * 1e3,
        proxyTimeout: 120 * 1e3,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            if (proxyReq.agent !== void 0) return;
            proxyReq.agent = proxyReq.protocol === "https:" ? httpsAgent : httpAgent;
          });
          proxy.on("error", (err, _req, _res) => {
            console.warn("[Vite PROXY] Error al reenviar solicitud al backend:", err.code || err.message);
          });
        }
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
        timeout: 120 * 1e3,
        proxyTimeout: 120 * 1e3,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            if (proxyReq.agent !== void 0) return;
            proxyReq.agent = proxyReq.protocol === "https:" ? httpsAgent : httpAgent;
          });
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxsb2JvLkRFU0tUT1AtQkc5STFGQlxcXFxEZXNrdG9wXFxcXFNpc3RlbWFDb3JyZXNwb25kZW5jaWFcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGxvYm8uREVTS1RPUC1CRzlJMUZCXFxcXERlc2t0b3BcXFxcU2lzdGVtYUNvcnJlc3BvbmRlbmNpYVxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvbG9iby5ERVNLVE9QLUJHOUkxRkIvRGVza3RvcC9TaXN0ZW1hQ29ycmVzcG9uZGVuY2lhL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IGh0dHBzIGZyb20gJ25vZGU6aHR0cHMnO1xuaW1wb3J0IGh0dHAgZnJvbSAnbm9kZTpodHRwJztcblxuLy8gQWdlbnRlIEhUVFAgcmV1dGlsaXphYmxlIGNvbiBrZWVwLWFsaXZlIHBhcmEgZXZpdGFyIEVDT05OUkVTRVRcbi8vIGVuIGVsIHByb3h5IGRlIFZpdGUgY3VhbmRvIGVsIHByaW1lciByZXF1ZXN0IHRhcmRhID4gMXMgKHdhcm11cCkuXG5jb25zdCBodHRwQWdlbnQgPSBuZXcgaHR0cC5BZ2VudCh7XG4gIGtlZXBBbGl2ZTogdHJ1ZSxcbiAga2VlcEFsaXZlTXNlY3M6IDYwICogMTAwMCxcbiAgbWF4U29ja2V0czogNTAsXG4gIHRpbWVvdXQ6IDIgKiA2MCAqIDEwMDBcbn0pO1xuY29uc3QgaHR0cHNBZ2VudCA9IG5ldyBodHRwcy5BZ2VudCh7XG4gIGtlZXBBbGl2ZTogdHJ1ZSxcbiAga2VlcEFsaXZlTXNlY3M6IDYwICogMTAwMCxcbiAgbWF4U29ja2V0czogNTAsXG4gIHRpbWVvdXQ6IDIgKiA2MCAqIDEwMDBcbn0pO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgcG9ydDogNTE3MyxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NTAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgd3M6IGZhbHNlLFxuICAgICAgICB0aW1lb3V0OiAxMjAgKiAxMDAwLFxuICAgICAgICBwcm94eVRpbWVvdXQ6IDEyMCAqIDEwMDAsXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5KSA9PiB7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJveHlSZXEuYWdlbnQgIT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICAgICAgcHJveHlSZXEuYWdlbnQgPSBwcm94eVJlcS5wcm90b2NvbCA9PT0gJ2h0dHBzOicgPyBodHRwc0FnZW50IDogaHR0cEFnZW50O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW1ZpdGUgUFJPWFldIEVycm9yIGFsIHJlZW52aWFyIHNvbGljaXR1ZCBhbCBiYWNrZW5kOicsIGVyci5jb2RlIHx8IGVyci5tZXNzYWdlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICcvdXBsb2Fkcyc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo1MDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB0aW1lb3V0OiAxMjAgKiAxMDAwLFxuICAgICAgICBwcm94eVRpbWVvdXQ6IDEyMCAqIDEwMDAsXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5KSA9PiB7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJveHlSZXEuYWdlbnQgIT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICAgICAgcHJveHlSZXEuYWdlbnQgPSBwcm94eVJlcS5wcm90b2NvbCA9PT0gJ2h0dHBzOicgPyBodHRwc0FnZW50IDogaHR0cEFnZW50O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNlksU0FBUyxvQkFBb0I7QUFDMWEsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFJakIsSUFBTSxZQUFZLElBQUksS0FBSyxNQUFNO0FBQUEsRUFDL0IsV0FBVztBQUFBLEVBQ1gsZ0JBQWdCLEtBQUs7QUFBQSxFQUNyQixZQUFZO0FBQUEsRUFDWixTQUFTLElBQUksS0FBSztBQUNwQixDQUFDO0FBQ0QsSUFBTSxhQUFhLElBQUksTUFBTSxNQUFNO0FBQUEsRUFDakMsV0FBVztBQUFBLEVBQ1gsZ0JBQWdCLEtBQUs7QUFBQSxFQUNyQixZQUFZO0FBQUEsRUFDWixTQUFTLElBQUksS0FBSztBQUNwQixDQUFDO0FBR0QsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLElBQUk7QUFBQSxRQUNKLFNBQVMsTUFBTTtBQUFBLFFBQ2YsY0FBYyxNQUFNO0FBQUEsUUFDcEIsV0FBVyxDQUFDLFVBQVU7QUFDcEIsZ0JBQU0sR0FBRyxZQUFZLENBQUMsYUFBYTtBQUNqQyxnQkFBSSxTQUFTLFVBQVUsT0FBVztBQUNsQyxxQkFBUyxRQUFRLFNBQVMsYUFBYSxXQUFXLGFBQWE7QUFBQSxVQUNqRSxDQUFDO0FBQ0QsZ0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxNQUFNLFNBQVM7QUFDckMsb0JBQVEsS0FBSyx3REFBd0QsSUFBSSxRQUFRLElBQUksT0FBTztBQUFBLFVBQzlGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLE1BQ0EsWUFBWTtBQUFBLFFBQ1YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsU0FBUyxNQUFNO0FBQUEsUUFDZixjQUFjLE1BQU07QUFBQSxRQUNwQixXQUFXLENBQUMsVUFBVTtBQUNwQixnQkFBTSxHQUFHLFlBQVksQ0FBQyxhQUFhO0FBQ2pDLGdCQUFJLFNBQVMsVUFBVSxPQUFXO0FBQ2xDLHFCQUFTLFFBQVEsU0FBUyxhQUFhLFdBQVcsYUFBYTtBQUFBLFVBQ2pFLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
