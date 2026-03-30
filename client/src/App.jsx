import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore  from './stores/authStore';
import usePrefsStore from './stores/prefsStore';

// Pages
import Login           from './pages/Login';
import Layout          from './pages/Layout';
import ClientHome      from './pages/client/Home';
import SpecialistHome  from './pages/specialist/Home';
import AdminHome       from './pages/admin/Home';
import Settings        from './pages/Settings';
import NotFound        from './pages/NotFound';

function RequireAuth({ role, children }) {
  const { user, isLoggedIn } = useAuthStore();
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin')      return <Navigate to="/admin"      replace />;
  if (user.role === 'specialist') return <Navigate to="/specialist" replace />;
  return <Navigate to="/client" replace />;
}

export default function App() {
  const applyAll = usePrefsStore(s => s.applyAll);
  useEffect(() => { applyAll(); }, [applyAll]);

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
