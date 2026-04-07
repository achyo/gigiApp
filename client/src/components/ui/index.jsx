import React from 'react';

/* ── Button ──────────────────────────────────────────────────────────────── */
export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base = 'inline-flex items-center gap-1.5 font-bold rounded-[var(--r)] border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { sm: 'px-2.5 py-1 text-[0.8em]', md: 'px-[15px] py-2 text-[.88em]', lg: 'px-[15px] py-2 text-[.88em]' };
  const variants = {
    primary: 'bg-[var(--ac)] text-white border-[var(--ac)] hover:brightness-110',
    secondary: 'bg-[var(--sf)] text-[var(--tx)] border-[var(--bd)] hover:bg-[var(--bg2)]',
    ghost: 'bg-transparent text-[var(--tx2)] border-transparent hover:bg-[var(--bg2)]',
    danger: 'bg-[var(--erb)] text-[var(--er)] border-[var(--erbd)] hover:brightness-95',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'secondary', className = '', ...props }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={`action-icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
  );
}

export function ActionIconButton({ action = 'edit', className = '', ...props }) {
  const config = action === 'delete'
    ? { icon: '🗑', label: 'Eliminar', variant: 'danger' }
    : { icon: '✏️', label: 'Editar', variant: 'secondary' };

  return (
    <IconButton icon={config.icon} label={config.label} variant={config.variant} className={className} {...props} />
  );
}

/* ── Badge ───────────────────────────────────────────────────────────────── */
export function Badge({ variant = 'default', children, className = '' }) {
  const variants = {
    default: 'bg-[var(--bg3)] text-[var(--tx2)]',
    blue:    'bg-[var(--acb)] text-[var(--act)]',
    green:   'bg-[var(--okb)] text-[var(--ok)]',
    red:     'bg-[var(--erb)] text-[var(--er)]',
    amber:   'bg-[var(--wab)] text-[var(--wa)]',
    gold:    'bg-[var(--gob)] text-[var(--go)]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

/* ── Notice ──────────────────────────────────────────────────────────────── */
export function Notice({ variant = 'info', children, className = '' }) {
  const variants = {
    info: 'bg-[var(--acb)] text-[var(--act)] border-[color:var(--ac)]/20',
    success: 'bg-[var(--okb)] text-[var(--ok)] border-[color:var(--ok)]/20',
    error: 'bg-[var(--erb)] text-[var(--er)] border-[color:var(--er)]/20',
  };

  return (
    <div className={`rounded-[var(--r)] border px-3 py-2 text-sm font-bold ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */
export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--rl)] px-[18px] py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

/* ── Input ───────────────────────────────────────────────────────────────── */
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">{label}</label>}
      <input
        className={`w-full px-3.5 py-2.5 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] text-[var(--tx)] text-sm outline-none focus:border-[var(--ac)] focus:bg-[var(--sf)] transition-colors ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[var(--er)]">{error}</span>}
    </div>
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */
export function Select({ label, className = '', children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">{label}</label>}
      <select
        className={`w-full px-3.5 py-2.5 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] text-[var(--tx)] text-sm outline-none focus:border-[var(--ac)] appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

/* ── Textarea ────────────────────────────────────────────────────────────── */
export function Textarea({ label, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">{label}</label>}
      <textarea
        className={`w-full px-3.5 py-2.5 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] text-[var(--tx)] text-sm outline-none focus:border-[var(--ac)] focus:bg-[var(--sf)] transition-colors resize-y ${className}`}
        {...props}
      />
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, maxWidth = 640, className = '' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`app-modal bg-[var(--sf)] rounded-[var(--rl)] px-[26px] py-[22px] w-full scale-in ${className}`}
        style={{ maxWidth }}
      >
        {title && (
          <div className="app-modal-header flex items-center justify-between mb-4">
            <h2 className="app-modal-title font-black text-base">{title}</h2>
            <button onClick={onClose} className="app-modal-close text-[var(--tx3)] hover:text-[var(--tx)] text-xl leading-none">&times;</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Confirm ─────────────────────────────────────────────────────────────── */
export function Confirm({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="confirm-dialog bg-[var(--sf)] rounded-[var(--rl)] p-6 max-w-xs w-full text-center scale-in">
        <div className="confirm-dialog__icon">🗑</div>
        <p className="font-bold mb-1">¿Eliminar?</p>
        <p className="text-sm text-[var(--tx2)] mb-5">{message}</p>
        <div className="flex gap-3 justify-center">
          <IconButton icon="↩" label="Cancelar" variant="secondary" onClick={onCancel} className="confirm-dialog__action" />
          <ActionIconButton action="delete" onClick={onConfirm} className="confirm-dialog__action" />
        </div>
      </div>
    </div>
  );
}

/* ── SearchBar ───────────────────────────────────────────────────────────── */
export function SearchBar({ value, onChange, placeholder = '🔍 Buscar...', extra, className = '', fieldClassName = '', inputClassName = '' }) {
  return (
    <div className={`srch2 ${className}`}>
      <div className={`srch flex-1 min-w-[160px] ${fieldClassName}`}>
        <input
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-7 pr-3 py-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] text-[var(--tx)] text-[.9em] outline-none focus:border-[var(--ac)] ${inputClassName}`}
        />
      </div>
      {extra}
    </div>
  );
}

export function ColumnToggle({ value = 1, onChange, className = '' }) {
  return (
    <div className={`search-layout-group inline-flex items-center gap-1 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] p-1 ${className}`}>
      {[1, 2, 3].map((count) => (
        <Button
          key={count}
          type="button"
          variant={value === count ? 'primary' : 'secondary'}
          className="search-layout-btn"
          onClick={() => onChange(count)}
        >
          {count} col
        </Button>
      ))}
    </div>
  );
}

export function ColorPickerField({ label, colors = [], value, onChange, className = '', pickerLabel = '+ Colores' }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const colorInputRef = React.useRef(null);

  React.useEffect(() => {
    if (!pickerOpen) return undefined;

    const handleWindowFocus = () => {
      window.setTimeout(() => setPickerOpen(false), 0);
    };

    window.addEventListener('focus', handleWindowFocus, true);
    return () => window.removeEventListener('focus', handleWindowFocus, true);
  }, [pickerOpen]);

  const togglePicker = () => {
    const input = colorInputRef.current;
    if (!input) return;

    if (pickerOpen) {
      setPickerOpen(false);
      input.blur();
      return;
    }

    setPickerOpen(true);
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">{label}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="color-swatch"
            style={{ backgroundColor: color, outline: value === color ? `3px solid ${color}` : undefined, outlineOffset: 2 }}
            aria-label={`Usar color ${color}`}
            title={color}
          />
        ))}
        <Button type="button" variant="secondary" size="sm" className="color-picker-btn" onClick={togglePicker}>
          {pickerLabel}
        </Button>
        <input
          ref={colorInputRef}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setPickerOpen(false)}
          className="color-picker-input"
          aria-label="Selector de color personalizado"
        />
        <span className="color-picker-value">
          <span className="color-picker-value__dot" style={{ backgroundColor: value }} />
          {value.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/* ── TabBar ──────────────────────────────────────────────────────────────── */
export function TabBar({ tabs, active, onChange, actions }) {
  return (
    <div className="tabrow">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--r)] text-[.82em] font-bold border transition-all
            ${active === t.id
              ? 'bg-[var(--ac)] text-white border-[var(--ac)]'
              : 'bg-[var(--sf)] text-[var(--tx2)] border-[var(--bd)] hover:bg-[var(--bg2)]'
            }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin text-[var(--ac)]">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── SubStatus badge ─────────────────────────────────────────────────────── */
export function SubBadge({ sub, className = '' }) {
  if (!sub) return <Badge variant="default" className={className}>Sin suscripción</Badge>;
  const now  = new Date();
  const exp  = new Date(sub.expires);
  const days = (exp - now) / 864e5;
  if (sub.status === 'trial')           return <Badge variant="blue" className={className}>Prueba 15d</Badge>;
  if (days > 0  && days <= 15)          return <Badge variant="amber" className={className}>Vence pronto</Badge>;
  if (days > 0)                         return <Badge variant="green" className={className}>Activa</Badge>;
  if (days > -15)                       return <Badge variant="amber" className={className}>Cortesía 15d</Badge>;
  return <Badge variant="red" className={className}>Caducada</Badge>;
}

/* ── Divider ─────────────────────────────────────────────────────────────── */
export function Divider() {
  return <hr className="border-[var(--bd)] my-3" />;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
export function Empty({ icon = '📭', title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <span className="text-4xl">{icon}</span>
      {title && <p className="font-bold text-[var(--tx2)]">{title}</p>}
      {subtitle && <p className="text-sm text-[var(--tx3)]">{subtitle}</p>}
    </div>
  );
}
