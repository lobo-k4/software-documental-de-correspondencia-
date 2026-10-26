import { useEffect, useState } from 'react';
import { obtenerUrlArchivoAutenticado } from '../../utils/archivoAutenticado';

const AvatarUsuario = ({ user, className = '' }) => {
  const [urlAutenticada, setUrlAutenticada] = useState('');
  const [imagenDisponible, setImagenDisponible] = useState(Boolean(user?.foto_perfil));
  const inicial = user?.nombre_completo?.trim()?.[0]?.toLocaleUpperCase('es') || 'U';

  useEffect(() => {
    let vigente = true;
    let urlObjeto = '';

    if (!user?.foto_perfil) {
      setUrlAutenticada('');
      setImagenDisponible(false);
      return undefined;
    }

    setImagenDisponible(true);
    obtenerUrlArchivoAutenticado(user.foto_perfil)
      .then((url) => {
        if (!vigente) {
          URL.revokeObjectURL(url);
          return;
        }
        urlObjeto = url;
        setUrlAutenticada(url);
      })
      .catch(() => {
        if (vigente) {
          setImagenDisponible(false);
          setUrlAutenticada('');
        }
      });

    return () => {
      vigente = false;
      if (urlObjeto) URL.revokeObjectURL(urlObjeto);
    };
  }, [user?.foto_perfil]);

  return (
    <div className={className} aria-label={user?.nombre_completo || 'Usuario'}>
      {urlAutenticada && imagenDisponible ? (
        <img
          src={urlAutenticada}
          alt={user?.nombre_completo || 'Foto de perfil'}
          onError={() => setImagenDisponible(false)}
        />
      ) : (
        <span>{inicial}</span>
      )}
    </div>
  );
};

export default AvatarUsuario;
