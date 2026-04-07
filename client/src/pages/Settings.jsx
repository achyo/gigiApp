import React, { useEffect, useMemo, useState } from 'react';
import { authApi, colorProfilesApi } from '../api';
import useAuthStore from '../stores/authStore';
import usePrefsStore from '../stores/prefsStore';
import { ActionIconButton, Badge, Button, Card, ColorPickerField, Confirm, Input, Notice, Select } from '../components/ui';
import { useTTS } from '../hooks/useTTS';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../lib/password';

const PRESET_COLORS = ['#F5F3EF', '#000000', '#FFFFFF', '#FFFF99', '#1A5FD4', '#0077BB', '#CC3300', '#003399'];
const LANGUAGE_LABELS = {
  'es-ES': 'Español (España)',
  'es-MX': 'Español (México)',
  'en-US': 'Inglés (Estados Unidos)',
};

function getVoiceId(voice) {
  return voice.voiceURI || `${voice.lang}::${voice.name}`;
}

function getVoiceLabel(voice) {
  return voice.name;
}

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const {
    PALETTES,
    FONT_SIZES,
    TTS_RATE_OPTIONS,
    paletteId,
    fontSizeId,
    ttsEnabled,
    ttsLanguage,
    ttsVoiceId,
    ttsRate,
    ttsVolume,
    setPalette,
    setFontSize,
    setTts,
    setTtsSettings,
    replacePalettes,
  } = usePrefsStore();

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [paletteForm, setPaletteForm] = useState({ name: '', bg: '#F5F3EF', tx: '#12100E', ac: '#1A5FD4', isDefault: false });
  const [editingPaletteId, setEditingPaletteId] = useState('');
  const [paletteToDelete, setPaletteToDelete] = useState(null);
  const [paletteMsg, setPaletteMsg] = useState(null);
  const [paletteSaving, setPaletteSaving] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const { speak, stop } = useTTS();

  const activePalette = PALETTES.find((palette) => palette.id === paletteId) || PALETTES[0];
  const activeFontSize = FONT_SIZES.find((size) => size.id === fontSizeId) || FONT_SIZES[1];
  const activeVoice = availableVoices.find((voice) => getVoiceId(voice) === ttsVoiceId);
  const activeLanguageLabel = LANGUAGE_LABELS[activeVoice?.lang || ttsLanguage] || activeVoice?.lang || ttsLanguage;
  const activeRate = TTS_RATE_OPTIONS.find((option) => option.id === ttsRate);
  const isAdmin = user?.role === 'admin';
  const hasInstalledVoice = availableVoices.some((voice) => voice.lang === ttsLanguage || voice.lang.startsWith(`${ttsLanguage.split('-')[0]}-`));

  const passwordError = getPasswordStrengthError(pwForm.next, { required: true });
  const passwordConfirmError = pwForm.next && pwForm.next !== pwForm.confirm
    ? 'Las contraseñas no coinciden.'
    : '';

  const paletteChoices = useMemo(() => PALETTES.filter((palette) => Boolean(palette.id)), [PALETTES]);

  useEffect(() => {
    if (!window.speechSynthesis) return undefined;

    const readVoices = () => {
      const voices = window.speechSynthesis.getVoices?.() || [];
      const nextVoices = voices
        .filter((voice) => Boolean(voice.lang && voice.name))
        .sort((left, right) => getVoiceLabel(left).localeCompare(getVoiceLabel(right), 'es'));
      setAvailableVoices(nextVoices);
    };

    readVoices();
    window.speechSynthesis.addEventListener('voiceschanged', readVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', readVoices);
  }, []);

  useEffect(() => {
    if (!availableVoices.length) return;
    if (availableVoices.some((voice) => getVoiceId(voice) === ttsVoiceId)) return;

    const fallbackVoice = availableVoices.find((voice) => voice.lang === ttsLanguage)
      || availableVoices.find((voice) => voice.lang.startsWith(`${ttsLanguage.split('-')[0]}-`))
      || availableVoices[0];

    if (fallbackVoice) {
      setTtsSettings({ ttsLanguage: fallbackVoice.lang, ttsVoiceId: getVoiceId(fallbackVoice) });
    }
  }, [availableVoices, ttsLanguage, ttsVoiceId, setTtsSettings]);

  const resetPaletteForm = (clearMessage = true) => {
    setEditingPaletteId('');
    setPaletteForm({ name: '', bg: '#F5F3EF', tx: '#12100E', ac: '#1A5FD4', isDefault: false });
    if (clearMessage) {
      setPaletteMsg(null);
    }
  };

  const startEditPalette = (palette) => {
    setEditingPaletteId(palette.id);
    setPaletteForm({
      name: palette.label,
      bg: palette.bg,
      tx: palette.tx,
      ac: palette.ac,
      isDefault: Boolean(palette.isDefault),
    });
    setPaletteMsg(null);
  };

  const refreshPalettes = async () => {
    const response = await colorProfilesApi.list();
    const nextPalettes = (response.data.data || []).map((profile) => ({
      id: profile.id,
      label: profile.name,
      bg: profile.bgColor,
      tx: profile.textColor,
      ac: profile.accentColor,
      isDefault: profile.isDefault,
    }));
    replacePalettes(nextPalettes);
    return nextPalettes;
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPwMsg(null);

    if (passwordError) {
      setPwMsg({ type: 'error', text: passwordError });
      return;
    }
    if (passwordConfirmError) {
      setPwMsg({ type: 'error', text: passwordConfirmError });
      return;
    }

    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      setPwMsg({
        type: 'error',
        text: error.response?.data?.error?.code === 'WRONG_PASSWORD'
          ? 'La contraseña actual no es correcta.'
          : 'No se pudo actualizar la contraseña.',
      });
    }
  };

  const savePalette = async () => {
    if (!paletteForm.name.trim()) {
      setPaletteMsg({ type: 'error', text: 'El nombre de la paleta es obligatorio.' });
      return;
    }

    setPaletteSaving(true);
    setPaletteMsg(null);
    try {
      let saved;
      if (editingPaletteId) {
        saved = await colorProfilesApi.update(editingPaletteId, {
          name: paletteForm.name.trim(),
          bg_color: paletteForm.bg,
          text_color: paletteForm.tx,
          accent_color: paletteForm.ac,
        });
      } else {
        saved = await colorProfilesApi.create({
          name: paletteForm.name.trim(),
          bg_color: paletteForm.bg,
          text_color: paletteForm.tx,
          accent_color: paletteForm.ac,
          is_default: paletteForm.isDefault,
        });
      }

      const savedId = saved.data.data.id;
      if (paletteForm.isDefault && editingPaletteId) {
        await colorProfilesApi.setDefault(savedId);
      }

      const nextPalettes = await refreshPalettes();
      if (!editingPaletteId) {
        setPalette(savedId);
      } else if (nextPalettes.some((palette) => palette.id === paletteId)) {
        setPalette(paletteId);
      }
      setPaletteMsg({ type: 'success', text: editingPaletteId ? 'Paleta actualizada.' : 'Paleta creada.' });
      resetPaletteForm(false);
    } catch (error) {
      setPaletteMsg({ type: 'error', text: error.response?.data?.error?.message || 'No se pudo guardar la paleta.' });
    } finally {
      setPaletteSaving(false);
    }
  };

  const deletePalette = async () => {
    if (!paletteToDelete) return;

    setPaletteSaving(true);
    setPaletteMsg(null);
    try {
      await colorProfilesApi.delete(paletteToDelete.id);
      const nextPalettes = await refreshPalettes();
      if (editingPaletteId === paletteToDelete.id) {
        resetPaletteForm(false);
      }
      if (!nextPalettes.some((palette) => palette.id === paletteId) && nextPalettes[0]) {
        setPalette(nextPalettes[0].id);
      }
      setPaletteMsg({ type: 'success', text: 'Paleta eliminada.' });
      setPaletteToDelete(null);
    } catch (error) {
      setPaletteMsg({ type: 'error', text: error.response?.data?.error?.message || 'No se pudo eliminar la paleta.' });
    } finally {
      setPaletteSaving(false);
    }
  };

  const previewTts = () => {
    const voiceName = activeVoice?.name || 'la voz seleccionada';
    const previewByLanguage = {
      'es-ES': `Esta es una prueba de voz con ${voiceName}.`,
      'es-MX': `Esta es una prueba de voz con ${voiceName}.`,
      'en-US': `This is a voice preview using ${voiceName}.`,
    };
    speak(previewByLanguage[ttsLanguage] || previewByLanguage['es-ES'], { force: true });
  };

  return (
    <div className="settings-page animate-in">
      <div className="settings-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black">Configuración</h1>
            <Badge variant="blue" className="settings-role-badge">{user?.role === 'admin' ? 'Admin' : user?.role === 'specialist' ? 'Especialista' : 'Cliente'}</Badge>
          </div>
          <p className="settings-header__subtitle">Ajusta accesibilidad, lectura en voz alta y seguridad de la cuenta desde una misma pantalla compartida por todos los roles.</p>
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
              <span className="settings-summary-item__value">{activeFontSize?.label || 'A'}</span>
            </div>
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Texto a voz</span>
              <Badge variant={ttsEnabled ? 'green' : 'default'}>{ttsEnabled ? 'Activo' : 'Desactivado'}</Badge>
            </div>
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Idioma</span>
              <span className="settings-summary-item__value">{activeVoice ? getVoiceLabel(activeVoice) : activeLanguageLabel}</span>
            </div>
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Velocidad</span>
              <span className="settings-summary-item__value">{activeRate?.label || 'Normal'}</span>
            </div>
            <div className="settings-summary-item">
              <span className="settings-summary-item__label">Volumen</span>
              <span className="settings-summary-item__value">{Math.round(ttsVolume * 100)}%</span>
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
                <p className="settings-section-head__text">Selecciona la paleta que quieres aplicar a toda la interfaz.</p>
              </div>
            </div>
            <div className="settings-palette-grid">
              {paletteChoices.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setPalette(palette.id)}
                  className={`settings-choice-card ${paletteId === palette.id ? 'is-selected' : ''}`}
                >
                  <div className="settings-choice-card__swatches">
                    <span className="settings-swatch settings-swatch--large" style={{ background: palette.bg, borderColor: palette.ac }} />
                    <span className="settings-swatch" style={{ background: palette.tx }} />
                    <span className="settings-swatch" style={{ background: palette.ac }} />
                  </div>
                  <span className="settings-choice-card__label">{palette.label}</span>
                  {palette.isDefault && <Badge variant="default" className="settings-palette-badge">Base</Badge>}
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
                  className={`settings-font-card ${fontSize.id === fontSizeId ? 'is-selected' : ''}`}
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
                  <p className="settings-section-head__text">Controla activación, idioma, velocidad y volumen de la lectura automática.</p>
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

            <div className="settings-tts-grid">
              <div className="settings-slider-card settings-control-card">
                <div className="settings-slider-card__head">
                  <label className="settings-slider-card__label" htmlFor="tts-language">Idioma y voz</label>
                  <Badge variant="blue" className="settings-control-badge">{activeVoice ? getVoiceLabel(activeVoice) : activeLanguageLabel}</Badge>
                </div>
                <Select
                  id="tts-language"
                  value={ttsVoiceId || ''}
                  onChange={(event) => {
                    const selectedVoice = availableVoices.find((voice) => getVoiceId(voice) === event.target.value);
                    if (!selectedVoice) return;
                    setTtsSettings({ ttsLanguage: selectedVoice.lang, ttsVoiceId: getVoiceId(selectedVoice) });
                  }}
                  className="settings-select"
                >
                  {availableVoices.map((voice) => (
                    <option key={getVoiceId(voice)} value={getVoiceId(voice)}>{getVoiceLabel(voice)}</option>
                  ))}
                </Select>
              </div>

              <div className="settings-slider-card settings-control-card">
                <div className="settings-slider-card__head">
                  <label className="settings-slider-card__label" htmlFor="tts-rate">Velocidad</label>
                  <Badge variant="blue" className="settings-control-badge">{ttsRate.toFixed(1)}x</Badge>
                </div>
                <input
                  id="tts-rate"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={ttsRate}
                  onChange={(event) => setTtsSettings({ ttsRate: Number.parseFloat(event.target.value) })}
                  className="settings-slider"
                />
              </div>

              <div className="settings-slider-card settings-control-card">
                <div className="settings-slider-card__head">
                  <label className="settings-slider-card__label" htmlFor="tts-volume">Volumen</label>
                  <Badge variant="blue" className="settings-control-badge">{Math.round(ttsVolume * 100)}%</Badge>
                </div>
                <input
                  id="tts-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={ttsVolume}
                  onChange={(event) => setTtsSettings({ ttsVolume: Number.parseFloat(event.target.value) })}
                  className="settings-slider"
                />
              </div>
            </div>

            <div className="settings-tts-actions">
              <Button type="button" variant="secondary" size="lg" className="settings-tts-preview" onClick={previewTts}>▶ Probar voz</Button>
              <Button type="button" variant="ghost" size="lg" className="settings-tts-stop" onClick={stop}>Detener</Button>
            </div>

            {!hasInstalledVoice && (
              <Notice variant="info">No hay voces TTS instaladas en este navegador. Cuando haya voces disponibles, la lista mostrará solo las opciones reales, incluyendo variantes masculina o femenina si existen.</Notice>
            )}
          </Card>

          <Card className="settings-panel shadow-soft">
            <div className="settings-section-head">
              <div className="settings-section-head__icon">🔑</div>
              <div>
                <p className="settings-section-head__eyebrow">Cuenta</p>
                <h2 className="settings-section-head__title">Cambiar contraseña</h2>
                <p className="settings-section-head__text">Los tres campos y la acción de guardado quedan siempre visibles dentro del mismo bloque.</p>
              </div>
            </div>

            <form onSubmit={changePassword} className="settings-password-form">
              <Input label="Contraseña actual" type="password" value={pwForm.current} onChange={(event) => setPwForm({ ...pwForm, current: event.target.value })} required />
              <Input label="Nueva contraseña" type="password" value={pwForm.next} error={passwordError || undefined} onChange={(event) => setPwForm({ ...pwForm, next: event.target.value })} required />
              <Input label="Confirmar nueva contraseña" type="password" value={pwForm.confirm} error={passwordConfirmError || undefined} onChange={(event) => setPwForm({ ...pwForm, confirm: event.target.value })} required />
              <p className="settings-password-hint">{PASSWORD_RULE_HINT}</p>
              {pwMsg && <Notice variant={pwMsg.type === 'ok' ? 'success' : 'error'}>{pwMsg.text}</Notice>}
              <div className="settings-password-actions">
                <Button type="submit" size="lg" className="settings-password-submit" disabled={!pwForm.current || !pwForm.next || !pwForm.confirm || !!passwordError || !!passwordConfirmError}>Actualizar contraseña</Button>
              </div>
            </form>
          </Card>

          {isAdmin && (
            <Card className="settings-panel shadow-soft">
              <div className="settings-section-head">
                <div className="settings-section-head__icon">🗂</div>
                <div>
                  <p className="settings-section-head__eyebrow">Solo administrador</p>
                  <h2 className="settings-section-head__title">Gestionar paletas de accesibilidad</h2>
                  <p className="settings-section-head__text">Crea nuevas paletas o modifica las existentes. El resto de roles solo puede seleccionarlas.</p>
                </div>
              </div>

              <div className="settings-admin-palette-list">
                {paletteChoices.map((palette) => (
                  <div key={palette.id} className="settings-admin-palette-row">
                    <div className="settings-admin-palette-row__info">
                      <div className="settings-choice-card__swatches">
                        <span className="settings-swatch settings-swatch--large" style={{ background: palette.bg, borderColor: palette.ac }} />
                        <span className="settings-swatch" style={{ background: palette.tx }} />
                        <span className="settings-swatch" style={{ background: palette.ac }} />
                      </div>
                      <div>
                        <p className="settings-admin-palette-row__title">{palette.label}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {palette.isDefault && <Badge variant="blue" className="settings-palette-badge">Predeterminada</Badge>}
                          {palette.id === paletteId && <Badge variant="green" className="settings-palette-badge">Activa ahora</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="settings-admin-palette-row__actions">
                      <ActionIconButton action="edit" onClick={() => startEditPalette(palette)} className="settings-admin-action" />
                      <ActionIconButton action="delete" onClick={() => setPaletteToDelete(palette)} className="settings-admin-action" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="settings-admin-editor">
                <div className="settings-admin-editor__head">
                  <h3 className="text-sm font-black">{editingPaletteId ? 'Editar paleta' : 'Nueva paleta'}</h3>
                  {editingPaletteId && <Button type="button" variant="ghost" onClick={resetPaletteForm}>Cancelar edición</Button>}
                </div>
                <div className="settings-admin-editor__grid">
                  <Input label="Nombre" value={paletteForm.name} onChange={(event) => setPaletteForm({ ...paletteForm, name: event.target.value })} placeholder="Ej: Alto contraste marino" />
                  <label className="settings-checkbox-row">
                    <input type="checkbox" checked={paletteForm.isDefault} onChange={(event) => setPaletteForm({ ...paletteForm, isDefault: event.target.checked })} />
                    <span>Marcar como paleta predeterminada</span>
                  </label>
                </div>
                <div className="settings-admin-editor__colors">
                  <ColorPickerField label="Fondo" colors={PRESET_COLORS} value={paletteForm.bg} onChange={(value) => setPaletteForm({ ...paletteForm, bg: value })} pickerLabel="+ Fondo" />
                  <ColorPickerField label="Texto" colors={PRESET_COLORS} value={paletteForm.tx} onChange={(value) => setPaletteForm({ ...paletteForm, tx: value })} pickerLabel="+ Texto" />
                  <ColorPickerField label="Acento" colors={PRESET_COLORS} value={paletteForm.ac} onChange={(value) => setPaletteForm({ ...paletteForm, ac: value })} pickerLabel="+ Acento" />
                </div>
                {paletteMsg && <Notice variant={paletteMsg.type}>{paletteMsg.text}</Notice>}
                <div className="settings-password-actions">
                  <Button type="button" size="lg" className="settings-admin-submit" onClick={savePalette} disabled={paletteSaving}>{paletteSaving ? 'Guardando…' : editingPaletteId ? 'Actualizar paleta' : 'Crear paleta'}</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Confirm
        open={Boolean(paletteToDelete)}
        message={paletteToDelete ? `Se eliminará la paleta ${paletteToDelete.label}.` : ''}
        onCancel={() => setPaletteToDelete(null)}
        onConfirm={deletePalette}
      />
    </div>
  );
}
