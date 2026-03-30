import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore  from '../stores/authStore';
import usePrefsStore from '../stores/prefsStore';

const NAV = {
  client:     [{ to: '/client',     icon: '🏠', label: 'Actividades' }],
  specialist: [
    { to: '/specialist/clients',    icon: '👶', label: 'Clientes'     },
    { to: '/specialist/activities', icon: '📋', label: 'Actividades'  },
    { to: '/specialist/objects',    icon: '📦', label: 'Objetos'      },
    { to: '/specialist/groups',     icon: '👥', label: 'Grupos'       },
  ],
  admin: [
    { to: '/admin',                 icon: '📊', label: 'Panel'        },
    { to: '/admin/specialists',     icon: '🧑‍⚕️', label: 'Especialistas' },
    { to: '/admin/clients',         icon: '👶', label: 'Clientes'     },
    { to: '/admin/activities',      icon: '📋', label: 'Actividades'  },
    { to: '/admin/objects',         icon: '📦', label: 'Objetos'      },
    { to: '/admin/groups',          icon: '👥', label: 'Grupos'       },
    { to: '/admin/subscriptions',   icon: '💳', label: 'Suscripciones'},
  ],
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { PALETTES, FONT_SIZES, paletteId, fontSizeId, ttsEnabled,
          setPalette, incFont, decFont, setTts } = usePrefsStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = NAV[user?.role] || [];

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div id="app" className="flex flex-col min-h-screen">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-40 h-14 flex items-center gap-2 px-4
        bg-[var(--sf)] border-b border-[var(--bd)] flex-shrink-0">
        <button className="md:hidden text-xl mr-1" onClick={() => setSidebarOpen(o => !o)}>☰</button>
        <span className="font-black text-lg tracking-tight mr-auto">
          Proyecto<span className="text-[var(--ac)]">Gigi</span>
        </span>

        {/* Font size */}
        <button onClick={decFont} className="text-xs font-black px-2 py-1 rounded border border-[var(--bd)] hover:border-[var(--ac)]">A-</button>
        <button onClick={incFont} className="text-xs font-black px-2 py-1 rounded border border-[var(--bd)] hover:border-[var(--ac)]">A+</button>

        {/* TTS toggle */}
        <button
          onClick={() => setTts(!ttsEnabled)}
          className={`text-sm px-2 py-1 rounded border font-bold transition-all
            ${ttsEnabled ? 'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]' : 'border-[var(--bd)] text-[var(--tx2)]'}`}
        >
          {ttsEnabled ? '🔊' : '🔇'}
        </button>

        {/* Palette dots */}
        <div className="hidden sm:flex gap-1">
          {PALETTES.map(p => (
            <button
              key={p.id} title={p.label}
              onClick={() => setPalette(p.id)}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110
                ${paletteId === p.id ? 'ring-2 ring-[var(--ac)] ring-offset-1' : ''}`}
              style={{ background: p.bg, borderColor: p.ac }}
            />
          ))}
        </div>

        {/* Role badge + logout */}
        <span className="hidden sm:inline text-xs font-bold px-2 py-1 rounded-full bg-[var(--acb)] text-[var(--act)]">
          {user?.role === 'admin' ? '⚙️ Admin' : user?.role === 'specialist' ? '🧑‍⚕️ Especialista' : '👶 Cliente'}
        </span>
        <button onClick={() => navigate('/settings')} className="text-[var(--tx3)] hover:text-[var(--tx)] text-sm">⚙️</button>
        <button onClick={handleLogout} className="text-xs text-[var(--tx3)] hover:text-[var(--er)] font-bold">Salir</button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ── */}
        <aside className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-48 flex-shrink-0
          bg-[var(--sf)] border-r border-[var(--bd)] py-3 fixed md:static top-14 bottom-0 left-0 z-30 md:z-auto`}>
          <p className="px-3 pb-1 text-[.6rem] font-bold uppercase tracking-widest text-[var(--tx3)]">Menú</p>
          {navItems.map(n => (
            <NavLink
              key={n.to} to={n.to} end={n.to.split('/').length <= 2}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-l-[3px]
                ${isActive
                  ? 'bg-[var(--acb)] text-[var(--act)] border-[var(--ac)] font-bold'
                  : 'text-[var(--tx2)] border-transparent hover:bg-[var(--bg2)]'}`
              }
            >
              <span className="w-4 text-center">{n.icon}</span>{n.label}
            </NavLink>
          ))}
          <div className="mt-auto px-4 py-3">
            <p className="text-xs text-[var(--tx3)] truncate">{user?.name}</p>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
