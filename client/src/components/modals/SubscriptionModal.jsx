import React, { useState } from 'react';
import { subscriptionsApi } from '../../api';
import { Modal, Button, Input } from '../ui';

const PLANS = {
  basic:   { label: 'Básico',   month: '4,99 €/mes',  year: '49 €/año',  features: 'Hasta 5 clientes · 50 objetos' },
  premium: { label: 'Premium',  month: '9,99 €/mes',  year: '99 €/año',  features: 'Ilimitado · Contenido público' },
};

export default function SubscriptionModal({ entity, entityType, onClose, onSave }) {
  const [plan,    setPlan]    = useState(entity.subscription?.plan || 'basic');
  const [billing, setBilling] = useState(entity.subscription?.billing || 'month');
  const [method,  setMethod]  = useState('card');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const entityId = entity.id;
  const entityName = entity.user?.name || entity.childName || entity._name || '—';

  const submit = async () => {
    setLoading(true);
    try {
      await subscriptionsApi.activate({ entity_id: entityId, entity_type: entityType, plan, billing, method });
      setDone(true);
      setTimeout(() => { onSave?.(); onClose(); }, 1800);
    } catch (e) {
      alert('Error al procesar el pago');
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={'💳 Suscripción — ' + entityName} maxWidth={560}>
      {done ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-black text-lg text-[var(--ok)]">¡Suscripción activada!</p>
          <p className="text-sm text-[var(--tx2)] mt-2">Se enviará un email de confirmación</p>
        </div>
      ) : (
        <div className="modal-stack">
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
              <button key={k} onClick={() => setBilling(k)}
                className={`modal-choice rounded-[var(--r)] text-sm font-bold border transition-all ${billing === k ? 'bg-[var(--ac)] text-white border-[var(--ac)]' : 'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Payment method */}
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

          {method === 'card' && (
            <div className="modal-section">
              <Input label="Número de tarjeta" value={cardNum} onChange={e => setCardNum(e.target.value)} placeholder="1234 5678 9012 3456" maxLength={19} />
              <div className="modal-grid grid grid-cols-2 gap-3">
                <Input label="Caducidad" value={cardExp} onChange={e => setCardExp(e.target.value)} placeholder="MM/AA" maxLength={5} />
                <Input label="CVC"       value={cardCvc} onChange={e => setCardCvc(e.target.value)} placeholder="123" maxLength={3} />
              </div>
            </div>
          )}
          {method === 'paypal' && (
            <div className="modal-section">
              <Input label="Email PayPal" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@paypal.com" />
              <p className="text-xs text-[var(--tx3)] mt-1">Se abrirá PayPal para completar el pago</p>
            </div>
          )}
          {method === 'bizum' && (
            <div className="modal-panel bg-[var(--acb)] rounded-[var(--r)] px-4 py-4">
              <p className="font-bold text-sm mb-1">📱 Pagar por Bizum</p>
              <p className="text-sm text-[var(--tx2)]">Envía <strong>{billing === 'month' ? PLANS[plan].month : PLANS[plan].year}</strong> al:</p>
              <p className="font-black text-2xl tracking-widest my-2 text-[var(--ac)]">+34 600 000 000</p>
              <p className="text-xs text-[var(--tx3)]">Concepto: GIGI-{entityType.toUpperCase().slice(0,4)}-{entityId.slice(0,8)}</p>
            </div>
          )}

          <div className="modal-panel bg-[var(--wab)] border border-[var(--wa)] rounded-[var(--r)] px-4 py-3 text-xs text-[var(--tx2)]">
            ⚠️ Recibirás un aviso 15 días antes del vencimiento. Tras caducar, dispones de 15 días de cortesía.
          </div>

          <div className="modal-actions flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button disabled={loading} onClick={submit}>{loading ? 'Procesando…' : 'Activar suscripción'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
