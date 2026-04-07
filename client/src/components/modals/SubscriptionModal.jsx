import React, { useEffect, useState } from 'react';
import { subscriptionsApi } from '../../api';
import { Modal, Button, Input, Notice } from '../ui';

const PLANS = {
  basic:   { label: 'Básico',   month: '4,99 €/mes',  year: '49 €/año',  features: 'Hasta 5 clientes · 50 objetos' },
  premium: { label: 'Premium',  month: '9,99 €/mes',  year: '99 €/año',  features: 'Ilimitado · Contenido público' },
};

function buildDefaultExpiry(billing) {
  const expires = new Date();
  expires.setMonth(expires.getMonth() + (billing === 'year' ? 12 : 1));
  return expires.toISOString().split('T')[0];
}

function buildTrialExpiry() {
  const expires = new Date();
  expires.setDate(expires.getDate() + 15);
  return expires.toISOString().split('T')[0];
}

export default function SubscriptionModal({ entity, entityType, onClose, onSave }) {
  const [plan,    setPlan]    = useState(entity.subscription?.plan || 'basic');
  const [billing, setBilling] = useState(entity.subscription?.billing || 'month');
  const [method,  setMethod]  = useState('card');
  const [subscriptionStatus, setSubscriptionStatus] = useState(entity.subscription?.status || 'inactive');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [email,   setEmail]   = useState('');
  const [expires, setExpires] = useState(entity.subscription?.expires || buildDefaultExpiry(entity.subscription?.billing || 'month'));
  const [expiryTouched, setExpiryTouched] = useState(Boolean(entity.subscription?.expires));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const entityId = entity.id;
  const entityName = entity.user?.name || entity.childName || entity._name || '—';
  const isTrial = subscriptionStatus === 'trial';
  const isActive = subscriptionStatus === 'active';

  useEffect(() => {
    if (expiryTouched) return;
    setExpires(isTrial ? buildTrialExpiry() : buildDefaultExpiry(billing));
  }, [billing, expiryTouched, isTrial]);

  const getSubscriptionErrorMessage = (error) => {
    const code = error?.response?.data?.error?.code;
    if (code === 'INVALID_EXPIRY_DATE') return 'La fecha de vencimiento no es válida.';
    if (code === 'INVALID_SUBSCRIPTION_REQUEST') {
      return isTrial
        ? 'El servidor todavía no admite la prueba gratuita. Reinicia el backend para aplicar el cambio.'
        : 'Los datos de la suscripción no son válidos.';
    }
    if (code === 'INVALID_SUBSCRIPTION_STATUS') return 'El estado de la suscripción no es válido.';
    if (code === 'INVALID_ENTITY_TYPE') return 'No se pudo identificar el tipo de suscripción.';
    if (code === 'FORBIDDEN') return 'No tienes permisos para gestionar esta suscripción.';
    if (code === 'NOT_FOUND') return 'No se encontró el usuario asociado a la suscripción.';
    return error?.response?.data?.error?.message || 'Error al procesar la suscripción.';
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await subscriptionsApi.activate({
        entity_id: entityId,
        entity_type: entityType,
        plan,
        billing,
        method: isTrial ? 'trial' : method,
        expires,
        status: subscriptionStatus,
      });
      setDone(true);
      setTimeout(() => { onSave?.(); onClose(); }, 1800);
    } catch (e) {
      setError(getSubscriptionErrorMessage(e));
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={'💳 Suscripción — ' + entityName} maxWidth={560}>
      {done ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-black text-lg text-[var(--ok)]">¡Suscripción guardada!</p>
          <p className="text-sm text-[var(--tx2)] mt-2">El estado y la fecha de vencimiento se han actualizado correctamente.</p>
        </div>
      ) : (
        <div className="modal-stack">
          {entity.subscription?.expires && (
            <Notice variant="info">Vencimiento actual: {entity.subscription.expires}</Notice>
          )}

          <div className="modal-section">
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Estado de la suscripción</p>
            <div className="flex flex-wrap gap-2">
              {[['inactive', 'Desactivada'], ['active', 'Activa'], ['trial', 'Prueba gratuita 15d']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSubscriptionStatus(key);
                    if (!expiryTouched) {
                      setExpires(key === 'trial' ? buildTrialExpiry() : buildDefaultExpiry(billing));
                    }
                  }}
                  className={`modal-choice rounded-[var(--r)] text-sm font-bold border transition-all ${subscriptionStatus === key ? 'bg-[var(--ac)] text-white border-[var(--ac)]' : 'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isTrial && (
            <Notice variant="info" className="subscription-trial-notice px-5 py-4 text-xs font-semibold leading-relaxed">
              La prueba gratuita crea una suscripción de 15 días sin método de pago.
            </Notice>
          )}

          {/* Plan selector */}
          <div className="modal-grid grid grid-cols-2 gap-3">
            {Object.entries(PLANS).map(([k, p]) => (
              <div key={k} onClick={() => setPlan(k)}
                className={`modal-choice border-2 rounded-[var(--r)] p-4 cursor-pointer transition-all ${plan === k ? 'border-[var(--ac)] bg-[var(--acb)]' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}>
                <p className="font-bold text-sm">{plan === k ? '✓ ' : ''}{p.label}</p>
                <p className="font-black text-base text-[var(--ac)] my-1">{billing === 'month' ? p.month : p.year}</p>
                <p className="text-xs text-[var(--tx3)]">{p.features}</p>
              </div>
            ))}
          </div>

          {/* Billing period */}
          <div className="flex flex-wrap gap-2">
            {[['month','Mensual'],['year','Anual (20% dto.)']].map(([k, l]) => (
              <button key={k} onClick={() => { setBilling(k); if (!expiryTouched && !isTrial) setExpires(buildDefaultExpiry(k)); }}
                className={`modal-choice rounded-[var(--r)] text-sm font-bold border transition-all ${billing === k ? 'bg-[var(--ac)] text-white border-[var(--ac)]' : 'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="modal-section">
            <Input
              label="Fecha de vencimiento"
              type="date"
              value={expires}
              onChange={e => { setExpires(e.target.value); setExpiryTouched(true); }}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-[var(--tx3)]">{isTrial ? 'La prueba gratuita propone un vencimiento a 15 días.' : 'Puedes revisar o ajustar manualmente la fecha de vencimiento antes de guardar.'}</p>
          </div>

          {/* Payment method */}
          {!isTrial && (
            <div className="modal-section">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Método de pago</p>
              <div className="flex flex-wrap gap-2">
                {[['card','💳 Tarjeta'],['paypal','🅿️ PayPal'],['bizum','📱 Bizum']].map(([k, l]) => (
                  <button key={k} onClick={() => setMethod(k)}
                    className={`modal-choice rounded-[var(--r)] text-sm font-bold border transition-all ${method === k ? 'bg-[var(--ac)] text-white border-[var(--ac)]' : 'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isTrial && method === 'card' && (
            <div className="modal-section">
              <Input label="Número de tarjeta" value={cardNum} onChange={e => setCardNum(e.target.value)} placeholder="1234 5678 9012 3456" maxLength={19} />
              <div className="modal-grid grid grid-cols-2 gap-3">
                <Input label="Caducidad" value={cardExp} onChange={e => setCardExp(e.target.value)} placeholder="MM/AA" maxLength={5} />
                <Input label="CVC"       value={cardCvc} onChange={e => setCardCvc(e.target.value)} placeholder="123" maxLength={3} />
              </div>
            </div>
          )}
          {!isTrial && method === 'paypal' && (
            <div className="modal-section">
              <Input label="Email PayPal" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@paypal.com" />
              <p className="text-xs text-[var(--tx3)] mt-1">Se abrirá PayPal para completar el pago</p>
            </div>
          )}
          {!isTrial && method === 'bizum' && (
            <div className="modal-panel bg-[var(--acb)] rounded-[var(--r)] px-4 py-4">
              <p className="font-bold text-sm mb-1">📱 Pagar por Bizum</p>
              <p className="text-sm text-[var(--tx2)]">Envía <strong>{billing === 'month' ? PLANS[plan].month : PLANS[plan].year}</strong> al:</p>
              <p className="font-black text-2xl tracking-widest my-2 text-[var(--ac)]">+34 600 000 000</p>
              <p className="text-xs text-[var(--tx3)]">Concepto: GIGI-{entityType.toUpperCase().slice(0,4)}-{entityId.slice(0,8)}</p>
            </div>
          )}

          <div className="modal-panel bg-[var(--wab)] border border-[var(--wa)] rounded-[var(--r)] px-4 py-3 text-xs text-[var(--tx2)]">
            ⚠️ Solo las suscripciones activas enviarán aviso 15 días antes del vencimiento. Las pruebas gratuitas duran 15 días y después seguirán el mismo ciclo de expiración.
          </div>

          {error && <Notice variant="error">{error}</Notice>}

          <div className="modal-actions flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button disabled={loading || !expires} onClick={submit}>{loading ? 'Procesando…' : 'Guardar suscripción'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
