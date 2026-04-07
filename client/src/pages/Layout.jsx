import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import useAuthStore  from '../stores/authStore';
import usePrefsStore from '../stores/prefsStore';

const NAV = {
  client:     [{ to: '/client',     icon: '🏠', label: 'Actividades' }],
  specialist: [
    { to: '/specialist',            icon: '📊', label: 'Panel'        },
    { to: '/specialist/clients',    icon: '👶', label: 'Clientes'     },
    { to: '/specialist/activities', icon: '📋', label: 'Actividades'  },
    { to: '/specialist/objects',    icon: '📦', label: 'Objetos'      },
    { to: '/specialist/categories', icon: '🗂', label: 'Categorías'   },
    { to: '/specialist/groups',     icon: '👥', label: 'Grupos'       },
  ],
  admin: [
    { to: '/admin',                 icon: '📊', label: 'Panel'        },
    { to: '/admin/specialists',     icon: '🧑‍⚕️', label: 'Especialistas' },
    { to: '/admin/clients',         icon: '👶', label: 'Clientes'     },
    { to: '/admin/activities',      icon: '📋', label: 'Actividades'  },
    { to: '/admin/objects',         icon: '📦', label: 'Objetos'      },
    { to: '/admin/categories',      icon: '🗂', label: 'Categorías'   },
    { to: '/admin/groups',          icon: '👥', label: 'Grupos'       },
    { to: '/admin/subscriptions',   icon: '💳', label: 'Suscripciones'},
  ],
};

export default function Layout() {
  // 🔧 CORREGIDO: shell principal alineado con la topbar y sidebar del mockup.
  const { user, logout } = useAuthStore();
  const { PALETTES, FONT_SIZES, paletteId, fontSizeId, ttsEnabled,
          setPalette, incFont, decFont, setTts } = usePrefsStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = NAV[user?.role] || [];

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div id="app" className="app-shell">
      <header className="topbar">
        <button className="menu-toggle lg:hidden" onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menu">
          ☰
        </button>
        <button className="brand" onClick={() => navigate('/')}>
          Proyecto<b>Gigi</b>
        </button>

        <div className="topact">
          <button onClick={decFont} className="fsbtn" title={`Reducir texto (${FONT_SIZES.find(size => size.id === fontSizeId)?.label || 'A'})`}>
            A-
          </button>
          <button onClick={incFont} className="fsbtn" title={`Aumentar texto (${FONT_SIZES.find(size => size.id === fontSizeId)?.label || 'A'})`}>
            A+
          </button>
          <button
            onClick={() => setTts(!ttsEnabled)}
            className={`ttsbtn ${ttsEnabled ? 'on' : ''}`}
            title={ttsEnabled ? 'Desactivar lectura' : 'Activar lectura'}
          >
            <span>{ttsEnabled ? '🔊' : '🔇'}</span>
            <span className="hidden sm:inline">TTS</span>
          </button>

          <div className="pstrip" aria-label="Paletas de accesibilidad">
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

          <span className="role-chip hidden sm:inline-flex">
            {user?.role === 'admin' ? '⚙️ Admin' : user?.role === 'specialist' ? '🧑‍⚕️ Especialista' : '👶 Cliente'}
          </span>
          <button onClick={() => navigate('/settings')} className="icon-btn" title="Configuracion">⚙️</button>
          <button onClick={handleLogout} className="ghost-link" title="Cerrar sesion">Salir</button>
        </div>
      </header>

      <div className="ml">
        {sidebarOpen && <button className="mobile-backdrop lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menu" />}
        <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <p className="nsec">Menu</p>
          {navItems.map(n => (
            <NavLink
              key={n.to} to={n.to} end={n.to.split('/').length <= 2}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `ni ${isActive ? 'on' : ''}`
              }
            >
              <span className="nico">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <div className="sidebar-foot">
            <p className="truncate text-xs text-[var(--tx3)]">{user?.name}</p>
            <p className="truncate text-[11px] text-[var(--tx3)]">{user?.email}</p>
          </div>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
