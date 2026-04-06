import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import useAuthStore  from '../stores/authStore';
import usePrefsStore from '../stores/prefsStore';
import { Button, Input } from '../components/ui';

export default function Login() {
  // 🔧 CORREGIDO: pantalla de acceso ajustada al mockup con paletas visibles y accesos demo.
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
    <div className="lw">
      <div className="lc scale-in shadow-soft">
        <h1 className="ll">
          Proyecto<b>Gigi</b>
        </h1>
        <p className="mb-5 text-center text-sm text-[var(--tx2)]">
          Acceso adaptado para administracion, especialistas y familias.
        </p>

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
            <p className="rounded-[var(--r)] border border-[var(--erbd)] bg-[var(--erb)] p-2 text-center text-xs text-[var(--er)]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="mt-1 w-full justify-center" size="lg">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 border-t border-[var(--bd)] pt-4">
          <p className="mb-2 text-xs font-bold text-[var(--tx3)]">Paleta de accesibilidad</p>
          <div className="pstrip justify-center">
            {PALETTES.map(p => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => setPalette(p.id)}
                className={`pbtn ${paletteId === p.id ? 'on' : ''}`}
                style={{ background: p.bg, borderColor: p.ac }}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--tx3)]">Puedes cambiar la paleta antes de iniciar sesion.</p>
        </div>

        <div className="mt-5 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3 text-center text-xs text-[var(--tx3)]">
          <p className="mb-2 font-bold text-[var(--tx2)]">Demo rapido</p>
          <div className="flex flex-wrap justify-center gap-2">
          {[
            ['Admin', 'admin@proyectogigi.com', 'Admin1234!'],
            ['Especialista', 'especialista@proyectogigi.com', 'Spec1234!'],
            ['Cliente', 'familia@ejemplo.com', 'Client1234!'],
          ].map(([label, em, pw]) => (
            <button
              key={label}
              onClick={() => { setEmail(em); setPassword(pw); }}
              className="tag"
            >
              {label}
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
