// src/hooks/useTTS.js
import { useCallback } from 'react';
import usePrefsStore from '../stores/prefsStore';

export function useTTS() {
  const enabled = usePrefsStore(s => s.ttsEnabled);
  const speak = useCallback((text) => {
    if (!enabled || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, [enabled]);
  return { speak, enabled };
}
