import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fechaActualBoliviaISO } from '../../utils/fecha';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Verifique e intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="login-page">
      {/* Panel izquierdo — decorativo elegante (sin logo ni marca de agua) */}
      <div className="login-brand">
        {/* Elementos decorativos de fondo */}
        <div className="login-brand-deco" />
        <div className="login-brand-glow" />



        {/* Contenido central */}
        <div className="login-brand-inner">
          <h1 className="login-brand-name">GANESHA</h1>
          <p className="login-brand-tagline">LTDA.</p>
          <div className="login-brand-divider" />
          <p className="login-brand-desc">
            Gestión Documental de Correspondencia Institucional
          </p>
          <div className="login-brand-features">
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Control de correspondencia recibida y entregada
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Trazabilidad y seguimiento documental
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Generación de notas institucionales
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Archivo digital y derivaciones
            </div>
          </div>
        </div>

        {/* Pie decorativo del panel */}
        <div className="login-brand-footer">
          <span>Organización</span>
          <span className="login-brand-footer-dot" />
          <span>Seguridad</span>
          <span className="login-brand-footer-dot" />
          <span>Eficiencia</span>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-form-panel">
        <div className="login-form-box">

          {/* Encabezado del formulario */}
          <div className="login-form-header">
            <h2 className="login-form-title">Iniciar Sesión</h2>
            <p className="login-form-subtitle">
              Ingrese sus credenciales institucionales para acceder al sistema.
            </p>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="alert alert-danger">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-username">
                <User size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Usuario o correo institucional
                <span className="required"> *</span>
              </label>
              <input
                id="login-username"
                type="text"
                className="form-input"
                placeholder="Ej: admin o secretaria01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="login-password">
                <Lock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Contraseña
                <span className="required"> *</span>
              </label>
              <div className="login-password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit-btn"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Accesos rápidos de demostración */}
          <div className="login-quick-access">
            <span className="login-quick-label">Acceso rápido de demostración</span>
            <div className="login-quick-buttons">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickLogin('admin', 'Admin123*')}
                title="Rol: Administrador"
              >
                Administrador
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickLogin('secretaria01', 'Admin123*')}
                title="Rol: Secretaría"
              >
                Secretaría
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickLogin('operador01', 'Admin123*')}
                title="Rol: Operador"
              >
                Operador
              </button>
            </div>
          </div>

        </div>

        {/* Pie del formulario */}
        <footer className="login-footer">
          Sistema de Gestión de Correspondencia · GANESHA LTDA &copy; {fechaActualBoliviaISO().slice(0, 4)}
        </footer>
      </div>
    </div>
  );
};

export default Login;
