import React, { useState } from 'react';
import usePrefsStore from '../stores/prefsStore';
import { Button, Card, Input } from '../components/ui';
import { authApi } from '../api';

export default function Settings() {
  const { PALETTES, FONT_SIZES, paletteId, fontSizeId, ttsEnabled,
          setPalette, setFontSize, setTts } = usePrefsStore();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg,  setPwMsg]  = useState(null);

  const changePassword = async e => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ type: 'error', text: 'Las contraseñas no coinciden' }); return; }
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

      <Card>
        <h2 className="font-bold mb-3">🎨 Paleta de accesibilidad</h2>
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

      <Card>
        <h2 className="font-bold mb-3">📏 Tamaño de texto</h2>
        <div className="grid grid-cols-4 gap-3">
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

      <Card>
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

      <Card>
        <h2 className="font-bold mb-3">🔑 Cambiar contraseña</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <Input label="Contraseña actual" type="password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} required />
          <Input label="Nueva contraseña" type="password" value={pwForm.next} onChange={e=>setPwForm({...pwForm,next:e.target.value})} required minLength={8} />
          <Input label="Confirmar nueva contraseña" type="password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} required />
          {pwMsg && <p className={`text-xs p-2 rounded ${pwMsg.type==='ok'?'bg-[var(--okb)] text-[var(--ok)]':'bg-[var(--erb)] text-[var(--er)]'}`}>{pwMsg.text}</p>}
          <Button type="submit">Actualizar contraseña</Button>
        </form>
      </Card>
    </div>
  );
}
