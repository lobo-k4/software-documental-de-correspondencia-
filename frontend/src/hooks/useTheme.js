import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ganesha-theme';

/**
 * useTheme — Alterna el atributo data-theme de <html> entre 'light' y 'dark'.
 * Es una concern puramente visual: no toca rutas, API ni estado de sesión.
 * El modo CLARO es siempre el predeterminado; el oscuro solo se activa por
 * decisión explícita del usuario (toggle del Sidebar) y persiste en localStorage.
 */
export const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) { /* localStorage bloqueado */ }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) { /* noop */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
};

export default useTheme;