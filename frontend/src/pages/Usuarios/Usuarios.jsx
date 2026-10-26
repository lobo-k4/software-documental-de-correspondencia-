import { useEffect, useState } from 'react';
import { Edit3, KeyRound, Plus, Search, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { api } from '../../services/api';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import { useAuth } from '../../hooks/useAuth';
import { formatearFechaHoraBolivia } from '../../utils/fecha';
import './Usuarios.css';

const renderRolBadge = (rolNombre = '') => {
  const norm = (rolNombre || '').toLowerCase();
  if (norm.includes('admin')) {
    return (
      <span className="badge-rol badge-rol-admin" title="Rol de Administrador">
        <span className="badge-rol-dot" style={{ backgroundColor: '#7c3aed' }} />
        {rolNombre || 'Administrador'}
      </span>
    );
  }
  if (norm.includes('operador') || norm.includes('secretar')) {
    return (
      <span className="badge-rol badge-rol-operador" title={`Rol de ${rolNombre}`}>
        <span className="badge-rol-dot" style={{ backgroundColor: '#0284c7' }} />
        {rolNombre || 'Operador'}
      </span>
    );
  }
  return (
    <span className="badge-rol badge-rol-default">
      <span className="badge-rol-dot" style={{ backgroundColor: '#64748b' }} />
      {rolNombre || 'Sin rol'}
    </span>
  );
};

export default function Usuarios() {
  const { hasRole } = useAuth();
  const esAdministrador = hasRole('Administrador');
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [paginacion, setPaginacion] = useState({ total: 0, pagina: 1, limite: 10, total_paginas: 1 });
  const [filtros, setFiltros] = useState({ busqueda: '', id_rol: '', id_area: '', activo: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [modal, setModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', nombre_completo: '', id_rol: '2', id_area: '', cargo: '' });
  const [password, setPassword] = useState('');

  const cargar = async (pagina = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/usuarios', { ...filtros, pagina, limite: paginacion.limite });
      setItems(response.data?.usuarios || []);
      setPaginacion(response.data?.paginacion || paginacion);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const [rolesRes, areasRes, cargosRes] = await Promise.all([
          api.get('/catalogos/roles'),
          api.get('/catalogos/areas'),
          api.get('/catalogos/cargos')
        ]);
        setRoles((rolesRes.data || []).filter((role) => [1, 2, 3].includes(role.id_rol)));
        setAreas(areasRes.data || []);
        setCargos(cargosRes.data || []);
      } catch (err) {
        setError(err.message || 'No se pudieron cargar los catálogos.');
      }
    };
    cargarCatalogos();
  }, []);

  useEffect(() => { cargar(); }, [filtros.id_rol, filtros.id_area, filtros.activo]);

  const abrirCrear = () => {
    setForm({ username: '', email: '', password: '', nombre_completo: '', id_rol: '2', id_area: '', cargo: '' });
    setModal('crear');
  };

  const abrirEditar = (item) => {
    setForm({ username: item.username, email: item.email, password: '', nombre_completo: item.nombre_completo, id_rol: String(item.id_rol), id_area: item.id_area ? String(item.id_area) : '', cargo: item.cargo || '' });
    setModal({ tipo: 'editar', item });
  };

  const guardarUsuario = async (event) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const body = { ...form, id_rol: Number(form.id_rol), id_area: form.id_area ? Number(form.id_area) : null };
      const response = modal === 'crear'
        ? await api.post('/usuarios', body)
        : await api.put(`/usuarios/${modal.item.id_usuario}`, body);
      setFeedback(response.message || 'Usuario guardado correctamente.');
      setModal(null);
      await cargar(paginacion.pagina);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el usuario.');
    } finally {
      setActionLoading(false);
    }
  };

  const cambiarEstado = async (item) => {
    const accion = item.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Desea ${accion} al usuario ${item.username}?`)) return;
    try {
      const response = await api.patch(`/usuarios/${item.id_usuario}/estado`, { activo: !item.activo });
      setFeedback(response.message || 'Estado actualizado correctamente.');
      cargar(paginacion.pagina);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.');
    }
  };

  const eliminarUsuario = async () => {
    if (!modal?.item || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await api.delete(`/usuarios/${modal.item.id_usuario}`);
      setFeedback(response.message || 'Usuario eliminado correctamente.');
      setModal(null);
      await cargar(paginacion.pagina);
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el usuario.');
    } finally {
      setActionLoading(false);
    }
  };

  const abrirPassword = (item) => { setPassword(''); setModal({ tipo: 'password', item }); };

  const restablecerPassword = async (event) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const response = await api.put(`/usuarios/${modal.item.id_usuario}/restablecer-password`, { password_nuevo: password });
      setFeedback(response.message || 'Contraseña restablecida correctamente.');
      setModal(null);
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setActionLoading(false);
    }
  };

  const actualizarFiltro = (key, value) => setFiltros((actuales) => ({ ...actuales, [key]: value }));
  const submitBusqueda = (event) => { event.preventDefault(); cargar(1); };

  return (
    <div className="page-container page-enter usuarios-container">
      {/* Encabezado */}
      <div className="usuarios-header">
        <div className="usuarios-header-title">
          <div className="usuarios-header-icon">
            <Users size={22} />
          </div>
          <div className="usuarios-title-text">
            <h2>Directorio de Usuarios y Roles</h2>
            <p>Gestión de cuentas de acceso, roles y asignación institucional de áreas de operación</p>
          </div>
        </div>
        {esAdministrador && (
          <button className="btn btn-primary" onClick={abrirCrear}>
            <Plus size={16} /> <span>Nuevo Usuario</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="usuarios-search-card">
        <form className="usuarios-search-form" onSubmit={submitBusqueda}>
          <input
            className="form-input"
            style={{ flex: '1 1 250px' }}
            placeholder="Buscar por usuario, nombre completo o correo institucional..."
            value={filtros.busqueda}
            onChange={(event) => actualizarFiltro('busqueda', event.target.value)}
          />
          <select
            className="form-select"
            style={{ width: '190px' }}
            value={filtros.id_rol}
            onChange={(event) => actualizarFiltro('id_rol', event.target.value)}
          >
            <option value="">Todos los roles</option>
            {roles.map((role) => (
              <option key={role.id_rol} value={role.id_rol}>{role.nombre}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: '170px' }}
            value={filtros.activo}
            onChange={(event) => actualizarFiltro('activo', event.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          <button className="btn btn-secondary" type="submit">
            <Search size={15} /> Buscar
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre / Correo</th>
                <th>Rol Asignado</th>
                <th>Área de Operación</th>
                <th>Último Acceso</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                    Cargando directorio de usuarios...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                    No se encontraron usuarios con los criterios especificados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id_usuario}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="usuario-avatar-initial">
                          {(item.nombre_completo || item.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.username}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.cargo || 'Sin cargo asignado'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.nombre_completo}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.email}</div>
                    </td>
                    <td>
                      {renderRolBadge(item.rol_nombre)}
                    </td>
                    <td>{item.area_sigla || item.area_nombre || '—'}</td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {item.ultimo_acceso ? formatearFechaHoraBolivia(item.ultimo_acceso) : 'Sin registros'}
                    </td>
                    <td>
                      <span className={`badge ${item.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {esAdministrador && (
                        <div className="action-buttons" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-action btn-action-edit"
                            title="Editar datos del usuario"
                            onClick={() => abrirEditar(item)}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-action-key"
                            title="Restablecer contraseña"
                            onClick={() => abrirPassword(item)}
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            type="button"
                            className={`btn-action ${item.activo ? 'btn-action-deactivate' : 'btn-action-activate'}`}
                            title={item.activo ? 'Desactivar usuario' : 'Activar usuario'}
                            onClick={() => cambiarEstado(item)}
                          >
                            {item.activo ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-action-delete"
                            title="Eliminar usuario"
                            onClick={() => setModal({ tipo: 'eliminar', item })}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {paginacion.total > 0 && (
          <div className="pagination">
            <span>
              Mostrando {items.length} de <strong>{paginacion.total}</strong> usuarios registrados
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={paginacion.pagina <= 1 || loading}
                onClick={() => cargar(paginacion.pagina - 1)}
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Pág. {paginacion.pagina} de {paginacion.total_paginas}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={paginacion.pagina >= paginacion.total_paginas || loading}
                onClick={() => cargar(paginacion.pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modal === 'crear' || modal?.tipo === 'editar'}
        onClose={() => setModal(null)}
        title={modal === 'crear' ? 'Registrar Nuevo Usuario' : `Editar Usuario: ${modal?.item?.username || ''}`}
        size="md"
      >
        <form onSubmit={guardarUsuario}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input
                className="form-input"
                required
                value={form.nombre_completo}
                onChange={(event) => setForm({ ...form, nombre_completo: event.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre de usuario *</label>
              <input
                className="form-input"
                required
                disabled={modal !== 'crear'}
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Correo electrónico *</label>
              <input
                type="email"
                className="form-input"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rol institucional *</label>
              <select
                className="form-select"
                required
                value={form.id_rol}
                onChange={(event) => setForm({ ...form, id_rol: event.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.id_rol} value={role.id_rol}>{role.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          {modal === 'crear' && (
            <div className="form-group">
              <label className="form-label">Contraseña inicial *</label>
              <input
                type="password"
                className="form-input"
                minLength="6"
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Área asignada</label>
              <select
                className="form-select"
                value={form.id_area}
                onChange={(event) => {
                  const nuevaArea = event.target.value;
                  setForm({ ...form, id_area: nuevaArea, cargo: '' });
                }}
              >
                <option value="">Sin área específica</option>
                {areas.map((area) => (
                  <option key={area.id_area} value={area.id_area}>{area.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cargo / Función{form.id_area ? ' *' : ''}</label>
              <select
                className="form-select"
                value={form.cargo}
                disabled={!form.id_area}
                required={Boolean(form.id_area)}
                onChange={(event) => setForm({ ...form, cargo: event.target.value })}
              >
                <option value="">
                  {form.id_area ? '-- Seleccione un Cargo / Función --' : 'Primero seleccione un área asignada'}
                </option>
                {cargos
                  .filter((c) => Number(c.id_area) === Number(form.id_area))
                  .map((c) => (
                    <option key={c.id_cargo} value={c.nombre}>{c.nombre}</option>
                  ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Guardando...' : 'Guardar usuario'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modal?.tipo === 'password'}
        onClose={() => setModal(null)}
        title={`Restablecer Contraseña: ${modal?.item?.username || ''}`}
        size="sm"
      >
        <form onSubmit={restablecerPassword}>
          <div className="form-group">
            <label className="form-label">Nueva contraseña *</label>
            <input
              type="password"
              className="form-input"
              minLength="6"
              required
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Guardando...' : 'Restablecer contraseña'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modal?.tipo === 'eliminar'}
        onClose={() => !actionLoading && setModal(null)}
        title="Eliminar Usuario"
        size="sm"
      >
        <p style={{ margin: '0 0 10px', color: 'var(--text-primary)' }}>
          ¿Está seguro de eliminar al usuario <strong>«{modal?.item?.username}»</strong>?
        </p>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Esta acción no se puede deshacer. Si el usuario ya cuenta con registros históricos asociados, es preferible desactivarlo en lugar de eliminarlo.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModal(null)} disabled={actionLoading}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" onClick={eliminarUsuario} disabled={actionLoading}>
            <Trash2 size={15} /> {actionLoading ? 'Eliminando...' : 'Eliminar Usuario'}
          </button>
        </div>
      </Modal>
    </div>
  );
}