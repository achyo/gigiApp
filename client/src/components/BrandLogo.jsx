import React, { useEffect, useMemo } from 'react';
import usePrefsStore from '../stores/prefsStore';
import lightLogo from '../../logo-light.svg';
import darkLogo from '../../logo-dark.svg';
import lightFavicon from '../../fav-light.svg';
import darkFavicon from '../../fav-dark.svg';

function hexToRgb(hex) {
  const normalized = (hex || '').replace('#', '').trim();
  const expanded = normalized.length === 3
    ? normalized.split('').map((chunk) => `${chunk}${chunk}`).join('')
    : normalized;
  const intValue = Number.parseInt(expanded, 16);

  if (Number.isNaN(intValue)) {
    return { r: 245, g: 243, b: 239 };
  }

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function updateFavicon(href) {
  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.setAttribute('rel', 'icon');
    document.head.appendChild(favicon);
  }
  favicon.setAttribute('type', 'image/svg+xml');
  favicon.setAttribute('href', href);
}

export default function BrandLogo({ className = '', imageClassName = '', alt = 'Percibo', syncFavicon = false }) {
  const PALETTES = usePrefsStore((state) => state.PALETTES);
  const paletteId = usePrefsStore((state) => state.paletteId);

  const isDarkMode = useMemo(() => {
    const activePalette = PALETTES.find((palette) => palette.id === paletteId) || PALETTES[0];
    return luminance(activePalette?.bg) < 0.4;
  }, [PALETTES, paletteId]);

  const logoSrc = isDarkMode ? darkLogo : lightLogo;
  const faviconSrc = isDarkMode ? darkFavicon : lightFavicon;

  useEffect(() => {
    if (!syncFavicon) return;
    updateFavicon(faviconSrc);
  }, [faviconSrc, syncFavicon]);

  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img src={logoSrc} alt={alt} className={`brand-logo__image ${imageClassName}`.trim()} />
    </span>
  );
}