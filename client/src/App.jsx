import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import useAuthStore  from './stores/authStore';
import usePrefsStore from './stores/prefsStore';

// Pages
import Login           from './pages/Login';
import Layout          from './pages/Layout';
import ClientHome      from './pages/client/Home';
import SpecialistHome  from './pages/specialist/Home';
import AdminHome       from './pages/admin/Home';
import Settings        from './pages/Settings';

function RequireAuth({ role, children }) {
  // ✅ IMPLEMENTADO: proteccion de rutas por sesion y rol.
  const { user, isLoggedIn } = useAuthStore();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  // 🔧 CORREGIDO: la raiz redirige a la primera vista util por rol.
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin')      return <Navigate to="/admin"      replace />;
  if (user.role === 'specialist') return <Navigate to="/specialist" replace />;
  return <Navigate to="/client" replace />;
}

export default function App() {
  // 🔧 CORREGIDO: se aplican preferencias globales al montar la app.
  const applyAll = usePrefsStore(s => s.applyAll);
  const hydrateUserPreferences = usePrefsStore(s => s.hydrateUserPreferences);
  const loadPalettes = usePrefsStore(s => s.loadPalettes);
  const userId = useAuthStore(s => s.user?.id);
  const preferences = useAuthStore(s => s.preferences);
  const refreshPreferences = useAuthStore(s => s.refreshPreferences);
  useEffect(() => { applyAll(); }, [applyAll]);
  useEffect(() => {
    hydrateUserPreferences(preferences);
  }, [hydrateUserPreferences, preferences]);
  useEffect(() => {
    if (!userId) return;
    loadPalettes().catch(() => {});
  }, [loadPalettes, userId]);
  useEffect(() => {
    if (!userId) return;
    refreshPreferences().catch(() => {});
  }, [refreshPreferences, userId]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<RoleRedirect />} />
        <Route path="client" element={<RequireAuth role="client"><ClientHome /></RequireAuth>} />
        <Route path="specialist/*" element={<RequireAuth role="specialist"><SpecialistHome /></RequireAuth>} />
        <Route path="admin/*" element={<RequireAuth role="admin"><AdminHome /></RequireAuth>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
