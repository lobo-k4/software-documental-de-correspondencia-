import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('usuario');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarSesion = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem('usuario', JSON.stringify(res.data));
          }
        } catch (error) {
          console.warn('Sesión expirada o no válida:', error.message);
          logout();
        }
      }
      setLoading(false);
    };

    verificarSesion();
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.success && res.data) {
      const { token: nuevoToken, usuario } = res.data;
      setToken(nuevoToken);
      setUser(usuario);
      localStorage.setItem('token', nuevoToken);
      localStorage.setItem('usuario', JSON.stringify(usuario));
      return usuario;
    }
    throw new Error(res.message || 'Error al iniciar sesión');
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (e) {
      // Ignorar error al salir
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
  };

  const actualizarFotoPerfil = (foto_perfil) => {
    setUser((usuarioActual) => {
      if (!usuarioActual) return usuarioActual;
      const usuarioActualizado = { ...usuarioActual, foto_perfil };
      localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
      return usuarioActualizado;
    });
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.rol_nombre);
  };

  const hasPermission = (codigoPermiso) => {
    if (!user) return false;
    if (user.rol_nombre === 'Administrador') return true;
    return user.permisos && user.permisos.includes(codigoPermiso);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        actualizarFotoPerfil,
        hasRole,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
};
