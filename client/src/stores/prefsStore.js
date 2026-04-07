import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { colorProfilesApi } from '../api';
import useAuthStore from './authStore';

const FALLBACK_PALETTES = [
  { id: 'def', label: 'Predeterminado', bg: '#F5F3EF', tx: '#12100E', ac: '#1A5FD4', isDefault: true },
  { id: 'bw', label: 'Negro/Blanco', bg: '#000000', tx: '#FFFFFF', ac: '#4D9FFF', isDefault: false },
  { id: 'wb', label: 'Blanco/Negro', bg: '#FFFFFF', tx: '#000000', ac: '#0044BB', isDefault: false },
  { id: 'de', label: 'Deuteranopía', bg: '#FFFFFF', tx: '#000000', ac: '#0077BB', isDefault: false },
  { id: 'tr', label: 'Tritanopía', bg: '#FFFFFF', tx: '#000000', ac: '#CC3300', isDefault: false },
  { id: 'ye', label: 'Fondo amarillo', bg: '#FFFF99', tx: '#000000', ac: '#003399', isDefault: false },
];

const FONT_SIZES = [
  { id: 's', label: 'A-', px: '14px', zoom: 0.85 },
  { id: 'm', label: 'A', px: '16px', zoom: 1.0 },
  { id: 'l', label: 'A+', px: '18px', zoom: 1.2 },
  { id: 'xl', label: 'A++', px: '20px', zoom: 1.45 },
];

const TTS_LANGUAGE_OPTIONS = [
  { id: 'es-ES', label: 'Español (España)' },
  { id: 'es-MX', label: 'Español (México)' },
  { id: 'en-US', label: 'Inglés (Estados Unidos)' },
];

const TTS_RATE_OPTIONS = [
  { id: 0.7, label: 'Lenta' },
  { id: 0.9, label: 'Normal' },
  { id: 1.1, label: 'Ágil' },
  { id: 1.3, label: 'Rápida' },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '').trim();
  const expanded = normalized.length === 3
    ? normalized.split('').map((chunk) => `${chunk}${chunk}`).join('')
    : normalized;
  const intValue = Number.parseInt(expanded, 16);

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function mixColors(left, right, amount) {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  const ratio = clamp(amount, 0, 1);

  return rgbToHex({
    r: a.r + ((b.r - a.r) * ratio),
    g: a.g + ((b.g - a.g) * ratio),
    b: a.b + ((b.b - a.b) * ratio),
  });
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function buildPaletteVariables(palette) {
  const bg = palette?.bg || FALLBACK_PALETTES[0].bg;
  const tx = palette?.tx || FALLBACK_PALETTES[0].tx;
  const ac = palette?.ac || FALLBACK_PALETTES[0].ac;
  const isDark = luminance(bg) < 0.4;

  return {
    '--bg': bg,
    '--bg2': isDark ? mixColors(bg, '#FFFFFF', 0.08) : mixColors(bg, '#000000', 0.05),
    '--bg3': isDark ? mixColors(bg, '#FFFFFF', 0.16) : mixColors(bg, '#000000', 0.12),
    '--sf': isDark ? mixColors(bg, '#FFFFFF', 0.05) : '#FFFFFF',
    '--bd': isDark ? mixColors(bg, '#FFFFFF', 0.22) : mixColors(bg, '#000000', 0.18),
    '--tx': tx,
    '--tx2': mixColors(tx, bg, 0.28),
    '--tx3': mixColors(tx, bg, 0.48),
    '--ac': ac,
    '--acb': mixColors(ac, bg, isDark ? 0.24 : 0.14),
    '--act': isDark ? mixColors(ac, '#FFFFFF', 0.48) : mixColors(ac, '#000000', 0.35),
  };
}

function normalizePalette(profile) {
  return {
    id: profile.id,
    label: profile.name,
    bg: profile.bgColor,
    tx: profile.textColor,
    ac: profile.accentColor,
    isDefault: profile.isDefault,
  };
}

function resolvePaletteId(currentId, palettes) {
  if (!palettes.length) return FALLBACK_PALETTES[0].id;
  if (palettes.some((palette) => palette.id === currentId)) return currentId;

  const fallback = FALLBACK_PALETTES.find((palette) => palette.id === currentId);
  if (fallback) {
    const byLabel = palettes.find((palette) => palette.label === fallback.label);
    if (byLabel) return byLabel.id;
  }

  return palettes.find((palette) => palette.isDefault)?.id || palettes[0].id;
}

function applyZoom(id) {
  const fontSize = FONT_SIZES.find((item) => item.id === id) || FONT_SIZES[1];
  document.documentElement.style.setProperty('--fs', fontSize.px);
  document.documentElement.style.zoom = fontSize.zoom;
}

function applyPalette(id, palettes) {
  const catalog = palettes?.length ? palettes : FALLBACK_PALETTES;
  const palette = catalog.find((item) => item.id === id) || catalog[0];

  Object.entries(buildPaletteVariables(palette)).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  ['p-bw', 'p-wb', 'p-de', 'p-tr', 'p-ye'].forEach((cls) => document.body.classList.remove(cls));
}

function syncPreferences() {
  const authStore = useAuthStore.getState();
  const prefsStore = usePrefsStore.getState();
  if (!authStore.user?.id) return;

  const textSizeMap = { s: 0, m: 1, l: 2, xl: 3 };
  const hasRemotePalette = prefsStore.PALETTES.some((palette) => palette.id === prefsStore.paletteId);

  authStore.updatePreferences({
    ...(hasRemotePalette ? { color_profile_id: prefsStore.paletteId } : {}),
    tts_enabled: prefsStore.ttsEnabled,
    tts_language: prefsStore.ttsLanguage,
    tts_rate: prefsStore.ttsRate,
    tts_volume: prefsStore.ttsVolume,
    text_size: textSizeMap[prefsStore.fontSizeId] ?? 1,
    list_layouts: prefsStore.listLayouts,
  }).catch(() => {});
}

function hydrateFromPreferences(preferences, currentState) {
  if (!preferences) return currentState;

  const textSizeByValue = ['s', 'm', 'l', 'xl'];

  return {
    ...currentState,
    paletteId: preferences.colorProfileId ?? currentState.paletteId,
    fontSizeId: textSizeByValue[preferences.textSize] || 'm',
    ttsEnabled: preferences.ttsEnabled ?? currentState.ttsEnabled,
    ttsLanguage: preferences.ttsLanguage || currentState.ttsLanguage,
    ttsRate: preferences.ttsRate ?? currentState.ttsRate,
    ttsVolume: preferences.ttsVolume ?? currentState.ttsVolume,
    listLayouts: preferences.listLayouts || {},
  };
}

const usePrefsStore = create(
  persist(
    (set, get) => ({
      paletteId: FALLBACK_PALETTES[0].id,
      fontSizeId: 'm',
      ttsEnabled: true,
      ttsLanguage: 'es-ES',
      ttsRate: 0.9,
      ttsVolume: 1,
      listLayouts: {},
      PALETTES: FALLBACK_PALETTES,
      FONT_SIZES,
      TTS_LANGUAGE_OPTIONS,
      TTS_RATE_OPTIONS,

      setPalette: (id) => {
        const paletteId = resolvePaletteId(id, get().PALETTES);
        applyPalette(paletteId, get().PALETTES);
        set({ paletteId });
        syncPreferences();
      },

      setFontSize: (id) => {
        applyZoom(id);
        set({ fontSizeId: id });
        syncPreferences();
      },

      setTts: (value) => {
        set({ ttsEnabled: value });
        syncPreferences();
      },

      setTtsSettings: (nextSettings) => {
        set((current) => ({
          ttsLanguage: nextSettings.ttsLanguage ?? current.ttsLanguage,
          ttsRate: nextSettings.ttsRate ?? current.ttsRate,
          ttsVolume: nextSettings.ttsVolume ?? current.ttsVolume,
        }));
        syncPreferences();
      },

      loadPalettes: async () => {
        const response = await colorProfilesApi.list();
        const nextPalettes = (response.data.data || []).map(normalizePalette);
        const nextPaletteId = resolvePaletteId(get().paletteId, nextPalettes);
        applyPalette(nextPaletteId, nextPalettes);
        set({ PALETTES: nextPalettes, paletteId: nextPaletteId });
        return nextPalettes;
      },

      replacePalettes: (nextPalettes) => {
        const paletteCatalog = nextPalettes.length ? nextPalettes : FALLBACK_PALETTES;
        const nextPaletteId = resolvePaletteId(get().paletteId, paletteCatalog);
        applyPalette(nextPaletteId, paletteCatalog);
        set({ PALETTES: paletteCatalog, paletteId: nextPaletteId });
      },

      hydrateUserPreferences: (preferences) => {
        const nextState = hydrateFromPreferences(preferences, get());
        applyPalette(resolvePaletteId(nextState.paletteId, nextState.PALETTES), nextState.PALETTES);
        applyZoom(nextState.fontSizeId);
        set({
          paletteId: nextState.paletteId,
          fontSizeId: nextState.fontSizeId,
          ttsEnabled: nextState.ttsEnabled,
          ttsLanguage: nextState.ttsLanguage,
          ttsRate: nextState.ttsRate,
          ttsVolume: nextState.ttsVolume,
          listLayouts: nextState.listLayouts,
        });
      },

      setListLayout: (key, value) => {
        const nextLayouts = { ...get().listLayouts, [key]: value };
        set({ listLayouts: nextLayouts });
        syncPreferences();
      },

      incFont: () => {
        const index = FONT_SIZES.findIndex((fontSize) => fontSize.id === get().fontSizeId);
        if (index < FONT_SIZES.length - 1) get().setFontSize(FONT_SIZES[index + 1].id);
      },

      decFont: () => {
        const index = FONT_SIZES.findIndex((fontSize) => fontSize.id === get().fontSizeId);
        if (index > 0) get().setFontSize(FONT_SIZES[index - 1].id);
      },

      applyAll: () => {
        applyPalette(get().paletteId, get().PALETTES);
        applyZoom(get().fontSizeId);
      },
    }),
    { name: 'gigi-prefs' }
  )
);

export default usePrefsStore;
