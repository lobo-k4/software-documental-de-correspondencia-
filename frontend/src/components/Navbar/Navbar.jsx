import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { formatearFechaBolivia } from '../../utils/fecha';
import AvatarUsuario from '../AvatarUsuario/AvatarUsuario';
import './Navbar.css';

/* Mapa de rutas a títulos de página */
const PAGE_TITLES = {
  '/dashboard':              'Dashboard',
  '/correspondencia/entrada':'Correspondencia Recibida',
  '/correspondencia/salida': 'Correspondencia Entregada',
  '/gestion/derivaciones':   'Derivaciones',
  '/gestion/seguimiento':    'Seguimiento',
  '/gestion/archivo':        'Archivo Digital',
  '/documentos/generar':     'Generar Nota',
  '/reportes':               'Reportes',
  '/admin/usuarios':         'Usuarios y Roles',
  '/admin/auditoria':        'Auditoría del Sistema',
  '/mi-perfil':                'Mi Perfil',
};

const tiempoTranscurrido = (fecha) => {
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (!Number.isFinite(minutos) || minutos < 1) return 'Ahora mismo';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias < 7 ? `Hace ${dias} d` : formatearFechaBolivia(fecha);
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [errorNotificaciones, setErrorNotificaciones] = useState('');
  const panelRef = useRef(null);

  const cargarNotificaciones = async () => {
    try {
      const response = await api.get('/notificaciones');
      setNotificaciones(response.data?.notificaciones || []);
      setNoLeidas(response.data?.no_leidas || 0);
      setErrorNotificaciones('');
    } catch {
      setErrorNotificaciones('No se pudieron cargar las notificaciones.');
    }
  };

  /* Título dinámico según la ruta activa */
  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] || 'Sistema de Correspondencia';

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      try {
        const response = await api.get('/notificaciones');
        if (!mounted) return;
        setNotificaciones(response.data?.notificaciones || []);
        setNoLeidas(response.data?.no_leidas || 0);
        setErrorNotificaciones('');
      } catch {
        if (mounted) setErrorNotificaciones('No se pudieron cargar las notificaciones.');
      }
    };
    cargar();
    const intervalo = window.setInterval(cargar, 10000);
    return () => { mounted = false; window.clearInterval(intervalo); };
  }, []);

  useEffect(() => {
    const cerrarAlHacerClicFuera = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setAbierto(false);
    };
    const cerrarConEscape = (event) => { if (event.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', cerrarAlHacerClicFuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarAlHacerClicFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, []);

  const abrirNotificacion = async (notificacion) => {
    setAbierto(false);
    if (!notificacion.leida_en) {
      try {
        await api.patch(`/notificaciones/${notificacion.id_notificacion}/leida`);
        setNotificaciones((actuales) =>
          actuales.map((item) =>
            item.id_notificacion === notificacion.id_notificacion
              ? { ...item, leida_en: new Date().toISOString() }
              : item
          )
        );
        setNoLeidas((actual) => Math.max(0, actual - 1));
      } catch {
        setErrorNotificaciones('No se pudo actualizar el estado de lectura.');
      }
    }
    if (notificacion.id_recibida) navigate(`/correspondencia/entrada/${notificacion.id_recibida}`);
    else if (notificacion.id_entregada) navigate(`/correspondencia/salida/${notificacion.id_entregada}`);
  };

  const marcarTodasLeidas = async () => {
    try {
      await api.patch('/notificaciones/leidas');
      const ahora = new Date().toISOString();
      setNotificaciones((actuales) =>
        actuales.map((item) => ({ ...item, leida_en: item.leida_en || ahora }))
      );
      setNoLeidas(0);
    } catch {
      setErrorNotificaciones('No se pudieron marcar como leídas.');
    }
  };

  return (
    <header className="navbar">
      {/* Título de la sección activa */}
      <div className="navbar-title">
        <h1 className="navbar-page-title">{pageTitle}</h1>
      </div>

      {/* Acciones del navbar */}
      <div className="navbar-actions">

        {/* Notificaciones */}
        <div ref={panelRef} className="navbar-notifications">
          <button
            type="button"
            className="navbar-icon-btn"
            title="Notificaciones"
            aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
            aria-expanded={abierto}
            onClick={() => {
              setAbierto((a) => {
                if (!a) cargarNotificaciones();
                return !a;
              });
            }}
          >
            <Bell size={17} />
            {noLeidas > 0 && (
              <span className="notif-badge">
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            )}
          </button>

          {abierto && (
            <div className="notif-panel" role="region" aria-label="Notificaciones">
              <div className="notif-header">
                <span className="notif-title">
                  Notificaciones
                  {noLeidas > 0 && (
                    <span className="notif-count">{noLeidas}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={marcarTodasLeidas}
                  disabled={!noLeidas}
                  className={`notif-mark-all ${!noLeidas ? 'disabled' : ''}`}
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={13} />
                  Marcar leídas
                </button>
              </div>

              {errorNotificaciones && (
                <p className="notif-error">{errorNotificaciones}</p>
              )}

              <div className="notif-list">
                {notificaciones.length === 0 ? (
                  <div className="notif-empty">
                    <Bell size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
                    <p>No tienes notificaciones</p>
                  </div>
                ) : (
                  notificaciones.map((notif) => (
                    <button
                      key={notif.id_notificacion}
                      type="button"
                      className={`notif-item ${!notif.leida_en ? 'unread' : ''}`}
                      onClick={() => abrirNotificacion(notif)}
                    >
                      <div className="notif-item-dot">
                        {!notif.leida_en && <span className="unread-dot" />}
                      </div>
                      <div className="notif-item-body">
                        <span className="notif-item-title">{notif.titulo}</span>
                        <span className="notif-item-msg">{notif.mensaje}</span>
                        <div className="notif-item-meta">
                          {notif.referencia_codigo && (
                            <span className="notif-item-code">{notif.referencia_codigo}</span>
                          )}
                          <span className="notif-item-time">
                            {tiempoTranscurrido(notif.creado_en)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={12} className="notif-item-arrow" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="navbar-separator" />

        {/* Información del usuario */}
        <button
          type="button"
          className="navbar-user navbar-user-button"
          onClick={() => navigate('/mi-perfil')}
          title="Ver Mi Perfil"
          aria-label="Ver Mi Perfil"
        >
          <AvatarUsuario user={user} className="navbar-user-avatar" />
          <div className="navbar-user-info">
            <span className="navbar-user-name">{user?.nombre_completo}</span>
            <span className="navbar-user-role">
              {user?.area_nombre ? `${user.area_nombre} · ` : ''}
              {user?.rol_nombre}
            </span>
          </div>
        </button>

        {/* Botón Cerrar Sesión */}
        <button
          type="button"
          onClick={logout}
          title="Cerrar sesión"
          className="navbar-logout-btn"
        >
          <LogOut size={15} />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
