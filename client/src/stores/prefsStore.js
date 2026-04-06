import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useAuthStore from './authStore';

const PALETTES = [
  { id: 'def', label: 'Predeterminado',  cls: '',     bg: '#F5F3EF', ac: '#1A5FD4' },
  { id: 'bw',  label: 'Negro/Blanco',    cls: 'p-bw', bg: '#000',    ac: '#4D9FFF' },
  { id: 'wb',  label: 'Blanco/Negro',    cls: 'p-wb', bg: '#fff',    ac: '#0044BB' },
  { id: 'de',  label: 'Deuteranopía',    cls: 'p-de', bg: '#fff',    ac: '#0077BB' },
  { id: 'tr',  label: 'Tritanopía',      cls: 'p-tr', bg: '#fff',    ac: '#CC3300' },
  { id: 'ye',  label: 'Fondo amarillo',  cls: 'p-ye', bg: '#FFFF99', ac: '#003399' },
];

const FONT_SIZES = [
  { id: 's',  label: 'A-',  px: '14px', zoom: 0.85 },
  { id: 'm',  label: 'A',   px: '16px', zoom: 1.0  },
  { id: 'l',  label: 'A+',  px: '18px', zoom: 1.2  },
  { id: 'xl', label: 'A++', px: '20px', zoom: 1.45 },
];

function applyZoom(id) {
  const f = FONT_SIZES.find(x => x.id === id) || FONT_SIZES[1];
  document.documentElement.style.setProperty('--fs', f.px);
  document.documentElement.style.zoom = f.zoom;
}

function applyPalette(id) {
  const p = PALETTES.find(x => x.id === id) || PALETTES[0];
  // Remover todas las clases de paleta excepto la vacía
  PALETTES.forEach(x => {
    if (x.cls && x.cls.trim()) {
      document.body.classList.remove(x.cls);
    }
  });
  // Aplicar nueva paleta si existe
  if (p.cls && p.cls.trim()) {
    document.body.classList.add(p.cls);
  }
}

function syncPreferences() {
  const authStore = useAuthStore.getState();
  const prefsStore = usePrefsStore.getState();
  if (!authStore.user?.id) return;

  const textSizeMap = { s: 0, m: 1, l: 2, xl: 3 };
  authStore.updatePreferences({
    tts_enabled: prefsStore.ttsEnabled,
    text_size: textSizeMap[prefsStore.fontSizeId] ?? 1,
  }).catch(() => {});
}

const usePrefsStore = create(
  persist(
    (set, get) => ({
      paletteId:  'def',
      fontSizeId: 'm',
      ttsEnabled: true,
      PALETTES,
      FONT_SIZES,

      setPalette: (id) => {
        applyPalette(id);
        set({ paletteId: id });
        syncPreferences();
      },

      setFontSize: (id) => {
        applyZoom(id);
        set({ fontSizeId: id });
        syncPreferences();
      },

      setTts: (v) => {
        set({ ttsEnabled: v });
        syncPreferences();
      },

      incFont: () => {
        const idx = FONT_SIZES.findIndex(f => f.id === get().fontSizeId);
        if (idx < FONT_SIZES.length - 1) get().setFontSize(FONT_SIZES[idx + 1].id);
      },

      decFont: () => {
        const idx = FONT_SIZES.findIndex(f => f.id === get().fontSizeId);
        if (idx > 0) get().setFontSize(FONT_SIZES[idx - 1].id);
      },

      applyAll: () => {
        applyPalette(get().paletteId);
        applyZoom(get().fontSizeId);
      },
    }),
    { name: 'gigi-prefs' }
  )
);

export default usePrefsStore;
