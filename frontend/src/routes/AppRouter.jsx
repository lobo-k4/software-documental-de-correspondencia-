import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import App from '../App';

// Carga lazy de páginas
const Login               = lazy(() => import('../pages/Login/Login'));
const Dashboard           = lazy(() => import('../pages/Dashboard/Dashboard'));
const Correspondencia     = lazy(() => import('../pages/Correspondencia/Correspondencia'));
const CorrespondenciaRecibida  = lazy(() => import('../pages/CorrespondenciaRecibida/CorrespondenciaRecibida'));
const CorrespondenciaEntregada = lazy(() => import('../pages/CorrespondenciaEntregada/CorrespondenciaEntregada'));
const Derivaciones         = lazy(() => import('../pages/Derivaciones/Derivaciones'));
const Seguimiento          = lazy(() => import('../pages/Seguimiento/Seguimiento'));
const Archivo              = lazy(() => import('../pages/Archivo/Archivo'));
const GeneradorNotas       = lazy(() => import('../pages/GeneradorNotas/GeneradorNotas'));
const VerificarNota        = lazy(() => import('../pages/GeneradorNotas/VerificarNota'));
const Reportes             = lazy(() => import('../pages/Reportes/Reportes'));
const Usuarios             = lazy(() => import('../pages/Usuarios/Usuarios'));
const Auditoria            = lazy(() => import('../pages/Auditoria/Auditoria'));
const Perfil               = lazy(() => import('../pages/Perfil/Perfil'));

// Página 404
function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <h2 style={{ fontSize: '4rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>404</h2>
      <p style={{ color: 'var(--text-secondary)' }}>La página que buscas no existe.</p>
      <a href="/dashboard" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
        Volver al inicio
      </a>
    </div>
  );
}

// Loading fallback
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner"></div>
    </div>
  );
}

// Rutas que requieren un rol específico
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const rolActual = user.rol_nombre || user.rol;
  if (roles && !roles.includes(rolActual)) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2 style={{ color: 'var(--danger-color)' }}>Acceso denegado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }
  return children;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />
          <Route path="/verificar/:id" element={<VerificarNota />} />

          {/* Rutas protegidas dentro del layout */}
          <Route element={<App />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Correspondencia */}
            <Route path="/correspondencia" element={<Correspondencia />}>
              <Route index element={<Navigate to="entrada" replace />} />
              <Route path="entrada" element={<CorrespondenciaRecibida />} />
              <Route path="entrada/:id" element={<CorrespondenciaRecibida />} />
              <Route path="salida" element={<CorrespondenciaEntregada />} />
              <Route path="salida/:id" element={<CorrespondenciaEntregada />} />
            </Route>
            <Route path="/correspondencia/recibida" element={<Navigate to="/correspondencia/entrada" replace />} />
            <Route path="/correspondencia/entregada" element={<Navigate to="/correspondencia/salida" replace />} />

            {/* Gestión */}
            <Route path="/gestion/derivaciones" element={<Derivaciones />} />
            <Route path="/gestion/seguimiento"  element={<Seguimiento />} />
            <Route path="/gestion/archivo"      element={<Archivo />} />

            {/* Documentos */}
            <Route path="/documentos/generar"   element={<GeneradorNotas />} />

            {/* Reportes */}
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/mi-perfil" element={<Perfil />} />

            {/* Administración */}
            <Route path="/admin/usuarios" element={
              <RequireRole roles={['Administrador']}>
                <Usuarios />
              </RequireRole>
            } />
            <Route path="/admin/auditoria" element={
              <RequireRole roles={['Administrador']}>
                <Auditoria />
              </RequireRole>
            } />

            {/* 404 dentro del layout */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
