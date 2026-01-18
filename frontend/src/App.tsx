import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import LeadsPage from './pages/LeadsPage';
import TeamsPage from './pages/TeamsPage';
import AssignTeamPage from './pages/AssignTeamPage';
import LoginPage from './pages/LoginPage';
import ClientsPage from './pages/Clientpage';
import AllClientsPage from './pages/AllClientsPage';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated, loading, checkAuth } = useAuthStore();
  const [appReady, setAppReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      setAppReady(true);
    };
    init();
  }, [checkAuth]);

  if (!appReady || loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      {/* Login route */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected Routes */}
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'team_leader']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="leads"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'team_leader', 'relationship_mgr', 'financial_manager']}>
              <LeadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="teams"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <TeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="assign-team"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AssignTeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="clients"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'team_leader', 'relationship_mgr', 'financial_manager']}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="all-clients"
          element={
            <ProtectedRoute allowedRoles={['financial_manager']}>
              <AllClientsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
