import React, { useState } from 'react';
import usePrefsStore from '../stores/prefsStore';
import { Badge, Button, Card, Input, Notice } from '../components/ui';
import { authApi } from '../api';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../lib/password';

export default function Settings() {
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

  const activePalette = PALETTES.find((palette) => palette.id === paletteId);
  const activeFontSize = FONT_SIZES.find((size) => size.id === fontSizeId);

  return (
    <div className="settings-page animate-in">
      <div className="settings-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black">Configuración</h1>
            <Badge variant="blue">Preferencias</Badge>
          </div>
          <p className="settings-header__subtitle">Ajusta accesibilidad, lectura en voz alta y seguridad de la cuenta con la misma disposición visual que el resto de la aplicación.</p>
        </div>
      </div>

      <div className="settings-layout">
        <Card className="settings-summary-card shadow-soft">
          <div className="settings-section-head">
            <div className="settings-section-head__icon">⚙️</div>
            <div>
              <p className="settings-section-head__eyebrow">Resumen rápido</p>
              <h2 className="settings-section-head__title">Estado actual</h2>
            </div>
          </div>

          <div className="settings-summary-list">
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Paleta activa</span>
              <div className="settings-summary-item__value">
                <span className="settings-color-dot" style={{ background: activePalette?.bg, borderColor: activePalette?.ac }} />
                {activePalette?.label || 'Sin definir'}
              </div>
            </div>
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Escala de texto</span>
              <span className="settings-summary-item__value">{activeFontSize?.label || 'Normal'}</span>
            </div>
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Texto a voz</span>
              <Badge variant={ttsEnabled ? 'green' : 'default'}>{ttsEnabled ? 'Activo' : 'Desactivado'}</Badge>
            </div>
          </div>
        </Card>

        <div className="settings-stack">
          <Card className="settings-panel shadow-soft">
            <div className="settings-section-head">
              <div className="settings-section-head__icon">🎨</div>
              <div>
                <p className="settings-section-head__eyebrow">Accesibilidad visual</p>
                <h2 className="settings-section-head__title">Paleta de accesibilidad</h2>
                <p className="settings-section-head__text">Se aplica a toda la interfaz y mantiene el contraste alto en todas las vistas.</p>
              </div>
            </div>
            <div className="settings-palette-grid">
              {PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setPalette(palette.id)}
                  className={`settings-choice-card ${paletteId === palette.id ? 'is-selected' : ''}`}
                >
                  <div className="settings-choice-card__swatches">
                    <span className="settings-swatch settings-swatch--large" style={{ background: palette.bg, borderColor: palette.ac }} />
                    <span className="settings-swatch" style={{ background: palette.tx || '#111111' }} />
                    <span className="settings-swatch" style={{ background: palette.ac }} />
                  </div>
                  <span className="settings-choice-card__label">{palette.label}</span>
                  {paletteId === palette.id && <Badge variant="blue">Activa</Badge>}
                </button>
              ))}
            </div>
          </Card>

          <Card className="settings-panel shadow-soft">
            <div className="settings-section-head">
              <div className="settings-section-head__icon">📏</div>
              <div>
                <p className="settings-section-head__eyebrow">Legibilidad</p>
                <h2 className="settings-section-head__title">Tamaño de texto</h2>
                <p className="settings-section-head__text">El zoom modifica tarjetas, iconos, imágenes y espaciados de toda la aplicación.</p>
              </div>
            </div>
            <div className="settings-font-grid">
              {FONT_SIZES.map((fontSize) => (
                <button
                  key={fontSize.id}
                  type="button"
                  onClick={() => setFontSize(fontSize.id)}
                  className={`settings-font-card ${fontSizeId === fontSize.id ? 'is-selected' : ''}`}
                >
                  <span className="settings-font-card__sample" style={{ fontSize: fontSize.px }}>Aa</span>
                  <span className="settings-font-card__label">{fontSize.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="settings-panel shadow-soft">
            <div className="settings-toggle-row">
              <div className="settings-section-head settings-section-head--compact">
                <div className="settings-section-head__icon">🔊</div>
                <div>
                  <p className="settings-section-head__eyebrow">Asistencia auditiva</p>
                  <h2 className="settings-section-head__title">Texto a voz (TTS)</h2>
                  <p className="settings-section-head__text">{ttsEnabled ? 'Activo: lee nombres y retroalimentación durante el uso.' : 'Desactivado: la interfaz no reproducirá nombres ni ayudas por voz.'}</p>
                </div>
              </div>
              <button
                type="button"
                aria-pressed={ttsEnabled}
                onClick={() => setTts(!ttsEnabled)}
                className={`settings-toggle ${ttsEnabled ? 'is-on' : ''}`}
              >
                <span className="settings-toggle__thumb" />
              </button>
            </div>
          </Card>

          <Card className="settings-panel shadow-soft">
            <div className="settings-section-head">
              <div className="settings-section-head__icon">🔑</div>
              <div>
                <p className="settings-section-head__eyebrow">Cuenta</p>
                <h2 className="settings-section-head__title">Cambiar contraseña</h2>
                <p className="settings-section-head__text">Se valida la nueva clave antes de enviarla para evitar errores de confirmación.</p>
              </div>
            </div>

            <form onSubmit={changePassword} className="settings-password-form">
              <div className="settings-password-grid">
                <Input label="Contraseña actual" type="password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} required />
                <Input label="Nueva contraseña" type="password" value={pwForm.next} error={passwordError || undefined} onChange={e=>setPwForm({...pwForm,next:e.target.value})} required minLength={8} />
                <Input label="Confirmar nueva contraseña" type="password" value={pwForm.confirm} error={passwordConfirmError || undefined} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} required />
              </div>
              <p className="settings-password-hint">{PASSWORD_RULE_HINT}</p>
              {pwMsg && <Notice variant={pwMsg.type === 'ok' ? 'success' : 'error'}>{pwMsg.text}</Notice>}
              <div className="settings-password-actions">
                <Button type="submit" disabled={!pwForm.current || !pwForm.next || !pwForm.confirm || !!passwordError || !!passwordConfirmError}>Actualizar contraseña</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
