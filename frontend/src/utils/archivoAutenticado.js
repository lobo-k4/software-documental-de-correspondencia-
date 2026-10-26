/**
 * Utilidad para consumir archivos protegidos (/uploads/...) con JWT.
 * El backend exige header `Authorization: Bearer <token>`, por lo que
 * <img src="..."> o <a href="..."> directos devuelven 401.
 * Estas funciones descargan con fetch autenticado y devuelven un blob URL.
 */

export const obtenerUrlArchivoAutenticado = async (ruta) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No hay sesión activa.');
  }
  const respuesta = await fetch(ruta, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el archivo (${respuesta.status}).`);
  }
  const blob = await respuesta.blob();
  return URL.createObjectURL(blob);
};

export const descargarArchivoAutenticado = async (ruta, nombre = 'archivo') => {
  const url = await obtenerUrlArchivoAutenticado(ruta);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
