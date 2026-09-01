import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import MachineRegistryPage from './pages/MachineRegistryPage';
import MachineFormPage from './pages/MachineFormPage';
import PMDashboardPage from './pages/PMDashboardPage';
import ServiceTicketsPage from './pages/ServiceTicketsPage';
import TicketFormPage from './pages/TicketFormPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import PermissionsPage from './pages/PermissionsPage';
import HistoryPage from './pages/HistoryPage';
import LoginLogsPage from './pages/LoginLogsPage';
import BackupPage from './pages/BackupPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || user.role !== 'main_admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<MachineRegistryPage />} />
        <Route path="machines/new" element={<MachineFormPage />} />
        <Route path="machines/:id/edit" element={<MachineFormPage />} />
        <Route path="pm-dashboard" element={<PMDashboardPage />} />
        <Route path="service-tickets" element={<ServiceTicketsPage />} />
        <Route path="service-tickets/new" element={<TicketFormPage />} />
        <Route path="service-tickets/:id" element={<TicketFormPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="login-logs" element={<AdminRoute><LoginLogsPage /></AdminRoute>} />
        <Route path="backup" element={<AdminRoute><BackupPage /></AdminRoute>} />
        <Route path="permissions" element={<AdminRoute><PermissionsPage /></AdminRoute>} />
        <Route path="admin" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '14px' } }} />
      <AppRoutes />
    </AuthProvider>
  );
}
