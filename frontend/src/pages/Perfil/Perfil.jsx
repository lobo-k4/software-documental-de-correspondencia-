import { useEffect, useRef, useState } from 'react';
import { Camera, Check, LockKeyhole, UserRound } from 'lucide-react';
import AvatarUsuario from '../../components/AvatarUsuario/AvatarUsuario';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import './Perfil.css';

const MAX_TAMANO_FOTO = 5 * 1024 * 1024;

const Perfil = () => {
  const { user, actualizarFotoPerfil } = useAuth();
  const inputFoto = useRef(null);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [previsualizacion, setPrevisualizacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  useEffect(() => {
    if (!archivoSeleccionado) {
      setPrevisualizacion('');
      return undefined;
    }

    const url = URL.createObjectURL(archivoSeleccionado);
    setPrevisualizacion(url);
    return () => URL.revokeObjectURL(url);
  }, [archivoSeleccionado]);

  const seleccionarFoto = (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;

    setMensajeError('');
    setMensajeExito('');
    if (!['image/jpeg', 'image/png'].includes(archivo.type)) {
      setMensajeError('El formato no es compatible. Seleccione una imagen JPEG o PNG.');
      return;
    }
    if (archivo.size > MAX_TAMANO_FOTO) {
      setMensajeError('La imagen no puede superar los 5 MB.');
      return;
    }

    setArchivoSeleccionado(archivo);
  };

  const guardarFoto = async () => {
    if (!archivoSeleccionado) return;
    setGuardando(true);
    setMensajeError('');
    setMensajeExito('');

    try {
      const formData = new FormData();
      formData.append('foto', archivoSeleccionado);
      const response = await api.upload('/auth/foto-perfil', formData);
      if (!response.success || !response.data?.foto_perfil) {
        throw new Error(response.message || 'No se pudo actualizar la foto.');
      }
      actualizarFotoPerfil(response.data.foto_perfil);
      setArchivoSeleccionado(null);
      setMensajeExito('La foto de perfil se actualizó correctamente.');
    } catch (error) {
      setMensajeError(error.message || 'No se pudo guardar la foto. Intente nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const datosPerfil = [
    { etiqueta: 'Nombre completo', valor: user?.nombre_completo },
    { etiqueta: 'Nombre de usuario', valor: user?.username },
    { etiqueta: 'Correo electrónico', valor: user?.email },
    { etiqueta: 'Rol institucional', valor: user?.rol_nombre },
    { etiqueta: 'Área asignada', valor: user?.area_nombre || 'Sin área asignada' },
    { etiqueta: 'Cargo / Función', valor: user?.cargo || 'Sin cargo asignado' }
  ];

  return (
    <main className="page-container page-enter profile-page">
      <header className="page-header profile-page-header">
        <div className="page-header-left">
          <h2 className="page-title"><UserRound size={20} /> Mi Perfil</h2>
          <p className="page-subtitle">Consulta tu información institucional y administra tu foto de perfil.</p>
        </div>
      </header>

      <section className="profile-card" aria-label="Información de perfil">
        <div className="profile-photo-panel">
          <div className="profile-photo-wrap">
            {previsualizacion ? (
              <div className="profile-photo-avatar">
                <img src={previsualizacion} alt="Previsualización de la foto de perfil" />
              </div>
            ) : (
              <button
                type="button"
                className="profile-photo-picker"
                onClick={() => inputFoto.current?.click()}
                aria-label="Seleccionar foto de perfil"
                title="Seleccionar foto de perfil"
              >
                <AvatarUsuario user={user} className="profile-photo-avatar" />
                <span className="profile-photo-camera"><Camera size={17} /></span>
              </button>
            )}
          </div>
          <h3 className="profile-user-name">{user?.nombre_completo || 'Usuario'}</h3>
          <p className="profile-user-role">{user?.rol_nombre || 'Usuario institucional'}</p>
          <input
            ref={inputFoto}
            className="profile-file-input"
            type="file"
            accept="image/jpeg,image/png"
            onChange={seleccionarFoto}
            aria-label="Seleccionar una imagen JPEG o PNG"
          />
          <button
            type="button"
            className="profile-change-photo"
            onClick={() => inputFoto.current?.click()}
            disabled={guardando}
          >
            <Camera size={15} />
            {archivoSeleccionado ? 'Elegir otra foto' : 'Cambiar foto'}
          </button>
          <p className="profile-photo-hint">JPEG o PNG · máximo 5 MB</p>
          {archivoSeleccionado && (
            <div className="profile-photo-actions">
              <button
                type="button"
                className="profile-save-photo"
                onClick={guardarFoto}
                disabled={guardando}
              >
                <Check size={15} />
                {guardando ? 'Guardando…' : 'Guardar foto'}
              </button>
              <button
                type="button"
                className="profile-cancel-photo"
                onClick={() => setArchivoSeleccionado(null)}
                disabled={guardando}
              >
                Descartar
              </button>
            </div>
          )}
        </div>

        <div className="profile-details-panel">
          <div className="profile-details-heading">
            <div>
              <h3>Información institucional</h3>
              <p>Estos datos son administrados por el Administrador.</p>
            </div>
            <span className="profile-readonly-label"><LockKeyhole size={13} /> Solo lectura</span>
          </div>

          <dl className="profile-details-grid">
            {datosPerfil.map(({ etiqueta, valor }) => (
              <div className="profile-detail" key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor || 'No especificado'}</dd>
              </div>
            ))}
            <div className="profile-detail">
              <dt>Estado de la cuenta</dt>
              <dd>
                <span className={`profile-account-status ${user?.activo ? 'is-active' : 'is-inactive'}`}>
                  <span className="profile-status-dot" />
                  {user?.activo ? 'Activo' : 'Inactivo'}
                </span>
              </dd>
            </div>
          </dl>

          <p className="profile-security-note">
            Los datos personales e institucionales no se pueden modificar desde Mi Perfil. Para solicitar un cambio,
            contacta al Administrador del sistema.
          </p>
          {mensajeError && <p className="profile-feedback is-error" role="alert">{mensajeError}</p>}
          {mensajeExito && <p className="profile-feedback is-success" role="status">{mensajeExito}</p>}
        </div>
      </section>
    </main>
  );
};

export default Perfil;
