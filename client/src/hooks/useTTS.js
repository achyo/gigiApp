// src/hooks/useTTS.js
import { useCallback } from 'react';
import usePrefsStore from '../stores/prefsStore';

const LOCALE_HINTS = {
  'es-ES': ['es-es', 'spain', 'espana', 'españ', 'castilian'],
  'es-MX': ['es-mx', 'mexico', 'mexican'],
  'en-US': ['en-us', 'united states', 'american'],
};

function rankVoice(voice, language) {
  const voiceLang = (voice.lang || '').toLowerCase();
  const voiceName = (voice.name || '').toLowerCase();
  const target = language.toLowerCase();
  const baseLanguage = target.split('-')[0];
  const hints = LOCALE_HINTS[language] || [];

  let score = 0;
  if (voiceLang === target) score += 100;
  if (voiceLang.startsWith(`${baseLanguage}-`)) score += 45;
  if (voiceLang === baseLanguage) score += 30;
  if (hints.some((hint) => voiceName.includes(hint) || voiceLang.includes(hint))) score += 35;
  if (voice.default) score += 5;
  return score;
}

function resolveVoice(voices, language) {
  return voices
    .map((voice) => ({ voice, score: rankVoice(voice, language) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.voice;
}

function loadVoices() {
  if (!window.speechSynthesis) return Promise.resolve([]);

  const existingVoices = window.speechSynthesis.getVoices?.() || [];
  if (existingVoices.length) return Promise.resolve(existingVoices);

  return new Promise((resolve) => {
    const handleVoicesChanged = () => {
      const loadedVoices = window.speechSynthesis.getVoices?.() || [];
      if (!loadedVoices.length) return;
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(loadedVoices);
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(window.speechSynthesis.getVoices?.() || []);
    }, 350);
  });
}

export function useTTS() {
  const enabled = usePrefsStore(s => s.ttsEnabled);
  const language = usePrefsStore(s => s.ttsLanguage);
  const rate = usePrefsStore(s => s.ttsRate);
  const volume = usePrefsStore(s => s.ttsVolume);
  const speak = useCallback(async (text, options = {}) => {
    const { force = false } = options;
    if ((!enabled && !force) || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    u.rate = rate;
    u.volume = volume;
    const voices = await loadVoices();
    const voice = resolveVoice(voices, language);
    if (voice) {
      u.voice = voice;
    }
    window.speechSynthesis.speak(u);
  }, [enabled, language, rate, volume]);

  const stop = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
  }, []);

  return { speak, stop, enabled };
}
