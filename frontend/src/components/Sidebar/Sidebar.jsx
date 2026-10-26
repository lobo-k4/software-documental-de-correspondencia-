import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  Send,
  ChevronDown,
  ArrowRightLeft,
  Search,
  Archive,
  FilePlus2,
  BarChart3,
  Users,
  ShieldAlert,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import './Sidebar.css';

const Sidebar = () => {
  const { hasRole } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const isAdmin = hasRole('Administrador');
  const location = useLocation();
  const [correspondenciaAbierta, setCorrespondenciaAbierta] = useState(
    location.pathname.startsWith('/correspondencia')
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => location.pathname.startsWith(path);
  const NavItem = ({ to, icon: Icon, children, end = false }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? 'active' : ''}`
      }
      onClick={() => setMobileOpen(false)}
    >
      <Icon size={16} className="sidebar-nav-icon" />
      <span>{children}</span>
    </NavLink>
  );

  const SectionLabel = ({ children }) => (
    <div className="sidebar-section-label">{children}</div>
  );

  const sidebarContent = (
    <>
      {/* Header / Logo institucional */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">GANESHA</span>
            <span className="sidebar-logo-sub">Correspondencia</span>
          </div>
        </div>
      </div>

      {/* Navegación principal */}
      <nav className="sidebar-nav">
        <NavItem to="/dashboard" icon={LayoutDashboard} end>
          Dashboard
        </NavItem>

        {/* Correspondencia (expandible) */}
        <SectionLabel>Correspondencia</SectionLabel>

        <button
          type="button"
          className={`sidebar-nav-item sidebar-nav-dropdown ${isActive('/correspondencia') ? 'active' : ''}`}
          onClick={() => setCorrespondenciaAbierta(!correspondenciaAbierta)}
          aria-expanded={correspondenciaAbierta}
        >
          <Inbox size={16} className="sidebar-nav-icon" />
          <span style={{ flex: 1 }}>Correspondencia</span>
          <ChevronDown
            size={14}
            className={`sidebar-chevron ${correspondenciaAbierta ? 'open' : ''}`}
          />
        </button>

        {correspondenciaAbierta && (
          <div className="sidebar-submenu">
            <NavLink
              to="/correspondencia/entrada"
              className={({ isActive }) =>
                `sidebar-nav-item sidebar-sub-item ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Inbox size={14} className="sidebar-nav-icon" />
              <span>Recibida</span>
              <span className="sidebar-entry-indicator entrada">Entrada</span>
            </NavLink>
            <NavLink
              to="/correspondencia/salida"
              className={({ isActive }) =>
                `sidebar-nav-item sidebar-sub-item ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Send size={14} className="sidebar-nav-icon" />
              <span>Entregada</span>
              <span className="sidebar-entry-indicator salida">Salida</span>
            </NavLink>
          </div>
        )}

        {/* Gestión y Trazabilidad */}
        <SectionLabel>Gestión</SectionLabel>
        <NavItem to="/gestion/derivaciones" icon={ArrowRightLeft}>Derivaciones</NavItem>
        <NavItem to="/gestion/seguimiento" icon={Search}>Seguimiento</NavItem>
        <NavItem to="/gestion/archivo" icon={Archive}>Archivo Digital</NavItem>

        {/* Documentos */}
        <SectionLabel>Documentos</SectionLabel>
        <NavItem to="/documentos/generar" icon={FilePlus2}>Generar Nota</NavItem>

        {/* Reportes */}
        <SectionLabel>Reportes</SectionLabel>
        <NavItem to="/reportes" icon={BarChart3}>Reportes</NavItem>

        {/* Administración */}
        {isAdmin && (
          <>
            <SectionLabel>Administración</SectionLabel>
            <NavItem to="/admin/usuarios" icon={Users}>Usuarios y Roles</NavItem>
            <NavItem to="/admin/auditoria" icon={ShieldAlert}>Auditoría</NavItem>
          </>
        )}
      </nav>

      {/* Pie de sidebar — interruptor de tema */}
      <div className="sidebar-footer">
        <div
          className="sidebar-theme"
          onClick={toggleTheme}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <span className="sidebar-theme-label">
            {isDark ? 'Modo oscuro' : 'Modo claro'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Cambiar entre modo claro y oscuro"
            className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTheme();
            }}
          >
            <Sun size={13} className="theme-toggle-icon theme-icon-sun" />
            <Moon size={13} className="theme-toggle-icon theme-icon-moon" />
            <span className="theme-toggle-thumb" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Botón hamburguesa móvil */}
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Overlay móvil */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar principal */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Botón cerrar en móvil */}
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
