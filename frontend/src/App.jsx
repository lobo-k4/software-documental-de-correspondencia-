import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Navbar from './components/Navbar/Navbar';
import { useAuth } from './hooks/useAuth';
import './assets/styles/variables.css';
import './assets/styles/global.css';
import './App.css';

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default ProtectedLayout;
