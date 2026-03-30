import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore  from '../stores/authStore';
import usePrefsStore from '../stores/prefsStore';
import { Button, Input } from '../components/ui';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuthStore();
  const { PALETTES, paletteId, setPalette } = usePrefsStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin')      navigate('/admin');
      else if (user.role === 'specialist') navigate('/specialist/clients');
      else navigate('/client');
    } catch (err) {
      const code = err.response?.data?.error?.code;
      setError(code === 'INVALID_CREDENTIALS' ? 'Email o contraseña incorrectos' : 'Error al conectar con el servidor');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--rl)] p-8 scale-in">
        <h1 className="text-2xl font-black text-center mb-6">
          Proyecto<span className="text-[var(--ac)]">Gigi</span>
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            label="Correo electrónico"
            type="email" value={email} required autoFocus
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
          <Input
            label="Contraseña"
            type="password" value={password} required
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && (
            <p className="text-xs text-[var(--er)] bg-[var(--erb)] border border-[var(--erbd)] rounded p-2 text-center">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full justify-center mt-1">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        {/* Accessibility palette */}
        <div className="mt-6 pt-4 border-t border-[var(--bd)]">
          <p className="text-xs text-[var(--tx3)] mb-2 font-bold">Paleta de accesibilidad</p>
          <div className="flex gap-2 flex-wrap">
            {PALETTES.map(p => (
              <button key={p.id} title={p.label} onClick={() => setPalette(p.id)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                  ${paletteId === p.id ? 'ring-2 ring-offset-1 ring-[var(--ac)]' : ''}`}
                style={{ background: p.bg, borderColor: p.ac }}
              />
            ))}
          </div>
        </div>

        {/* Demo quick-login */}
        <div className="mt-4 text-center text-xs text-[var(--tx3)]">
          <p className="font-bold mb-1">Demo rápido:</p>
          {[
            ['Admin', 'admin@proyectogigi.com', 'Admin1234!'],
            ['Especialista', 'especialista@proyectogigi.com', 'Spec1234!'],
            ['Cliente', 'familia@ejemplo.com', 'Client1234!'],
          ].map(([label, em, pw]) => (
            <button key={label} onClick={() => { setEmail(em); setPassword(pw); }}
              className="mr-2 underline text-[var(--ac)] hover:opacity-80">
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
