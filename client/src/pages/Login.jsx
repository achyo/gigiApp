import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import useAuthStore  from '../stores/authStore';
import usePrefsStore from '../stores/prefsStore';
import { Button, Input } from '../components/ui';
import BrandLogo from '../components/BrandLogo';

const ROLE_PRESETS = [
  { id: 'client', label: 'Cliente', icon: '👶', hint: 'Padre/tutor', email: 'familia@ejemplo.com', password: 'Client1234!' },
  { id: 'specialist', label: 'Especialista', icon: '🧑‍⚕️', hint: 'Profesional', email: 'especialista@proyectogigi.com', password: 'Spec1234!' },
  { id: 'admin', label: 'Admin', icon: '🛡️', hint: 'Gestión', email: 'admin@proyectogigi.com', password: 'Admin1234!' },
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState('client');
  const [email,        setEmail]        = useState(ROLE_PRESETS[0].email);
  const [password,     setPassword]     = useState(ROLE_PRESETS[0].password);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const { login } = useAuthStore();
  const { PALETTES, paletteId, setPalette } = usePrefsStore();
  const navigate = useNavigate();

  const pickRole = (roleId) => {
    const preset = ROLE_PRESETS.find(role => role.id === roleId);
    if (!preset) return;
    setSelectedRole(roleId);
    setEmail(preset.email);
    setPassword(preset.password);
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin')      navigate('/admin');
      else if (user.role === 'specialist') navigate('/specialist');
      else navigate('/client');
    } catch (err) {
      const code = err.response?.data?.error?.code;
      setError(code === 'INVALID_CREDENTIALS' ? 'Email o contraseña incorrectos' : 'Error al conectar con el servidor');
    } finally { setLoading(false); }
  };

  return (
    <div className="lw">
      <div className="lc login-card scale-in shadow-soft">
        <h1 className="ll login-title">
          <BrandLogo className="login-brand" imageClassName="brand-logo__image--login" syncFavicon />
        </h1>
        <p className="login-subtitle">
          Pulsa un rol para entrar
        </p>

        <div className="login-role-grid" role="tablist" aria-label="Seleccionar rol de acceso">
          {ROLE_PRESETS.map(role => (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={selectedRole === role.id}
              aria-label={`Acceder como ${role.label}`}
              className={`login-role-btn ${selectedRole === role.id ? 'is-active' : ''}`}
              onClick={() => pickRole(role.id)}
            >
              <span className="login-role-icon">{role.icon}</span>
              <span className="login-role-label">{role.label}</span>
              <span className="login-role-hint">{role.hint}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email" value={email} required autoFocus
            onChange={e => setEmail(e.target.value)}
            placeholder="demo@proyectogigi.com"
          />
          <Input
            label="Contraseña"
            type="password" value={password} required
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && (
            <p className="rounded-[var(--r)] border border-[var(--erbd)] bg-[var(--erb)] p-2 text-center text-xs text-[var(--er)]">
              {error}
            </p>
          )}
          <div className="login-palette-block">
            <p className="login-section-label">Paleta de accesibilidad</p>
            <div className="pstrip">
            {PALETTES.map(p => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                aria-label={`Usar paleta ${p.label}`}
                onClick={() => setPalette(p.id)}
                className={`pbtn ${paletteId === p.id ? 'on' : ''}`}
                style={{ background: p.bg, borderColor: p.ac }}
              />
            ))}
            </div>
          </div>
          <Button type="submit" disabled={loading} className="mt-1 w-full justify-center" size="lg" aria-label="Entrar en la aplicación">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
          <div className="text-center text-[11px] text-[var(--tx3)]">
            Usa el rol superior para rellenar automáticamente las credenciales demo.
          </div>
        </form>
      </div>
    </div>
  );
}
