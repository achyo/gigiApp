import React, { useState } from 'react';
import usePrefsStore from '../stores/prefsStore';
import { Button, Card, Input } from '../components/ui';
import { authApi } from '../api';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../lib/password';

export default function Settings() {
  // 🔧 CORREGIDO: preferencias visuales y de voz alineadas con el panel de configuracion del mockup.
  const { PALETTES, FONT_SIZES, paletteId, fontSizeId, ttsEnabled,
          setPalette, setFontSize, setTts } = usePrefsStore();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg,  setPwMsg]  = useState(null);
  const passwordError = getPasswordStrengthError(pwForm.next, { required: true });
  const passwordConfirmError = pwForm.next && pwForm.next !== pwForm.confirm
    ? 'Las contrasenas no coinciden.'
    : '';

  const changePassword = async e => {
    e.preventDefault();
    setPwMsg(null);
    if (passwordError) { setPwMsg({ type: 'error', text: passwordError }); return; }
    if (passwordConfirmError) { setPwMsg({ type: 'error', text: passwordConfirmError }); return; }
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ type: 'ok', text: 'Contraseña actualizada ✓' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch(e) {
      setPwMsg({ type: 'error', text: e.response?.data?.error?.code === 'WRONG_PASSWORD' ? 'Contraseña actual incorrecta' : 'Error al cambiar la contraseña' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      <h1 className="text-2xl font-black">Configuración</h1>

      <Card className="shadow-soft">
        <h2 className="mb-1 font-bold">🎨 Paleta de accesibilidad</h2>
        <p className="mb-3 text-sm text-[var(--tx2)]">Se aplica a toda la interfaz y mantiene el contraste alto en todas las vistas.</p>
        <div className="space-y-2">
          {PALETTES.map(p => (
            <div key={p.id} onClick={() => setPalette(p.id)}
              className={`flex items-center gap-3 p-3 rounded-[var(--r)] cursor-pointer border-2 transition-all
                ${paletteId === p.id ? 'border-[var(--ac)] bg-[var(--acb)]' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}>
              <div className="w-7 h-7 rounded-full flex-shrink-0 border-2"
                style={{ background: p.bg, borderColor: p.ac }} />
              <span className="font-bold text-sm flex-1">{p.label}</span>
              {paletteId === p.id && <span className="text-[var(--ac)] font-black">✓</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="shadow-soft">
        <h2 className="mb-1 font-bold">📏 Tamaño de texto</h2>
        <p className="mb-3 text-sm text-[var(--tx2)]">El zoom modifica tarjetas, iconos, imagenes y espaciados de toda la aplicacion.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FONT_SIZES.map(f => (
            <div key={f.id} onClick={() => setFontSize(f.id)}
              className={`p-3 rounded-[var(--r)] text-center cursor-pointer border-2 font-black transition-all
                ${fontSizeId === f.id ? 'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}
              style={{ fontSize: f.px }}>
              {f.label}
            </div>
          ))}
        </div>
      </Card>

      <Card className="shadow-soft">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h2 className="font-bold">🔊 Texto a voz (TTS)</h2>
            <p className="text-sm text-[var(--tx2)] mt-0.5">{ttsEnabled ? 'Activo — lee nombres y retroalimentación' : 'Desactivado'}</p>
          </div>
          <button
            onClick={() => setTts(!ttsEnabled)}
            className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0"
            style={{ background: ttsEnabled ? 'var(--ac)' : 'var(--bd)' }}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${ttsEnabled ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </Card>

      <Card className="shadow-soft">
        <h2 className="mb-1 font-bold">🔑 Cambiar contraseña</h2>
        <p className="mb-3 text-sm text-[var(--tx2)]">Se valida la nueva clave antes de enviarla para evitar errores de confirmacion.</p>
        <form onSubmit={changePassword} className="space-y-3">
          <Input label="Contraseña actual" type="password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} required />
          <Input label="Nueva contraseña" type="password" value={pwForm.next} error={passwordError || undefined} onChange={e=>setPwForm({...pwForm,next:e.target.value})} required minLength={8} />
          <Input label="Confirmar nueva contraseña" type="password" value={pwForm.confirm} error={passwordConfirmError || undefined} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} required />
          <p className="text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
          {pwMsg && <p className={`text-xs p-2 rounded ${pwMsg.type==='ok'?'bg-[var(--okb)] text-[var(--ok)]':'bg-[var(--erb)] text-[var(--er)]'}`}>{pwMsg.text}</p>}
          <Button type="submit" disabled={!pwForm.current || !pwForm.next || !pwForm.confirm || !!passwordError || !!passwordConfirmError}>Actualizar contraseña</Button>
        </form>
      </Card>
    </div>
  );
}
