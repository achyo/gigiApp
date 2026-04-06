import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router';
import {
  adminApi, specialistsApi, clientsApi, activitiesApi, assignmentsApi,
  objectsApi, categoriesApi, groupsApi, subscriptionsApi, usersApi,
} from '../../api';
import {
  Button, Badge, Card, Input, Select, Textarea,
  SearchBar, Confirm, Modal, Empty, Spinner, SubBadge, Divider, Notice,
} from '../../components/ui';
import SubscriptionModal from '../../components/modals/SubscriptionModal';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../../lib/password';

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.message || fallback;
}

function DashboardMetricCard({ value, label }) {
  return (
    <div className="rounded-[20px] border border-[var(--bd)] bg-[var(--sf)] px-5 py-4">
      <p className="text-[2.25rem] font-black leading-none text-[var(--ac)]">{value ?? '0'}</p>
      <p className="mt-2 text-[.7rem] font-black uppercase tracking-[0.08em] text-[var(--tx2)]">{label}</p>
    </div>
  );
}

function DashboardPanel({ icon, title, children, className = '' }) {
  return (
    <Card className={`rounded-[24px] px-5 py-5 shadow-soft ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <h2 className="text-[1.05rem] font-black">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function ListPageHeader({ title, count, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black">{title}</h1>
          <Badge variant="blue">{count}</Badge>
        </div>
        {subtitle && <p className="text-sm text-[var(--tx3)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ListCollection({ children }) {
  return <Card className="rounded-[24px] px-3 py-3 shadow-soft">{children}</Card>;
}

function ListRow({ avatar, title, subtitle, meta, badges, actions, accentColor }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[20px] border border-[var(--bd)] bg-[var(--sf)] px-4 py-3 sm:flex-row sm:items-center"
      style={accentColor ? { borderLeft: `4px solid ${accentColor}` } : undefined}
    >
      {avatar && <div className="flex-shrink-0">{avatar}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-[var(--tx)]">{title}</p>
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--tx2)]">{subtitle}</p>}
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────── */
function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [pending, setPending] = useState({ objects: [], categories: [] });
  const [specialists, setSpecialists] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.pendingApprovals(), specialistsApi.list(), clientsApi.list()])
      .then(([sr, pr, specRes, clientRes]) => {
        setStats(sr.data.data);
        setPending(pr.data.data);
        setSpecialists(specRes.data.data);
        setClients(clientRes.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const approve = async (type, id) => {
    await adminApi.approve(type, id);
    setPending(p => ({ ...p, [type + 's']: p[type + 's'].filter(x => x.id !== id) }));
  };
  const reject = async (type, id) => {
    await adminApi.reject(type, id, 'Rechazado por el administrador');
    setPending(p => ({ ...p, [type + 's']: p[type + 's'].filter(x => x.id !== id) }));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  const statItems = [
    ['Especialistas', stats?.specialists, '🧑‍⚕️'],
    ['Clientes',      stats?.clients,      '👶'],
    ['Actividades',   stats?.activities,   '📋'],
    ['Objetos',       stats?.objects,      '📦'],
    ['Categorías',    stats?.categories,   '🗂'],
    ['Asignaciones',  stats?.assignments,  '🔗'],
  ];

  const allPending = [
    ...pending.objects.map(x => ({ ...x, _type: 'object' })),
    ...pending.categories.map(x => ({ ...x, _type: 'category' })),
  ];

  const allSubscriptions = [
    ...specialists.map(item => item.subscription).filter(Boolean),
    ...clients.map(item => item.subscription).filter(Boolean),
  ];

  const getSubState = (sub) => {
    if (!sub) return 'none';
    const diffDays = (new Date(sub.expires) - new Date()) / 864e5;
    if (sub.status === 'trial') return 'trial';
    if (diffDays > 15) return 'active';
    if (diffDays > 0) return 'expiring';
    if (diffDays > -15) return 'grace';
    return 'expired';
  };

  const expiringSoon = allSubscriptions.filter(sub => {
    const diffDays = Math.ceil((new Date(sub.expires) - new Date()) / 864e5);
    return diffDays >= 0 && diffDays <= 15;
  }).length;

  const activeSpecialists = specialists.filter(item => item.user?.active).length;
  const activeClients = clients.filter(item => item.user?.active).length;

  const expiringEntries = [
    ...specialists
      .filter(item => item.subscription)
      .map(item => ({
        id: item.id,
        kind: 'Especialista',
        name: item.user?.name || 'Sin nombre',
        expires: item.subscription?.expires,
        daysLeft: Math.ceil((new Date(item.subscription?.expires) - new Date()) / 864e5),
      })),
    ...clients
      .filter(item => item.subscription)
      .map(item => ({
        id: item.id,
        kind: 'Cliente',
        name: item.childName || item.user?.name || 'Sin nombre',
        expires: item.subscription?.expires,
        daysLeft: Math.ceil((new Date(item.subscription?.expires) - new Date()) / 864e5),
      })),
  ]
    .filter(item => item.daysLeft >= 0 && item.daysLeft <= 15)
    .sort((left, right) => left.daysLeft - right.daysLeft)
    .slice(0, 6);

  const subCounts = allSubscriptions.reduce((acc, sub) => {
    const key = getSubState(sub);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { active: 0, trial: 0, grace: 0, expired: 0, expiring: 0 });

  return (
    <div className="animate-in space-y-5">
      <div>
        <h1 className="text-2xl font-black">Panel global</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <DashboardMetricCard value={stats?.specialists} label="Especialistas" />
        <DashboardMetricCard value={stats?.clients} label="Clientes" />
        <DashboardMetricCard value={stats?.activities} label="Actividades" />
        <DashboardMetricCard value={stats?.objects} label="Objetos" />
        <DashboardMetricCard value={activeSpecialists} label="Esp. activos" />
        <DashboardMetricCard value={activeClients} label="Cli. activos" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <DashboardPanel icon="⏳" title="Próximos a vencer (15d)" className="min-h-[236px]">
          {expiringEntries.length === 0 ? (
            <div className="flex min-h-[150px] items-center justify-center text-sm text-[var(--tx3)]">
              Sin vencimientos próximos.
            </div>
          ) : (
            <div className="space-y-2">
              {expiringEntries.map(item => (
                <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 rounded-[var(--r)] border border-[var(--bd)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-[var(--tx3)]">{item.kind} · vence {item.expires}</p>
                  </div>
                  <Badge variant="amber">{item.daysLeft}d</Badge>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel icon="📊" title="Estado suscripciones" className="min-h-[236px]">
          <div className="divide-y divide-[var(--bd)]/80">
            {[
              ['Activa', subCounts.active || 0, 'green'],
              ['Prueba 15d', subCounts.trial || 0, 'blue'],
              ['Gracia 15d', subCounts.grace || 0, 'amber'],
              ['Caducada', subCounts.expired || 0, 'red'],
            ].map(([label, value, variant]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <Badge variant={variant}>{label}</Badge>
                <span className="text-2xl font-black text-[var(--tx)]">{value}</span>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel icon="🧾" title={`Aprobaciones pendientes (${allPending.length})`}>
        {allPending.length === 0
          ? <p className="text-sm text-[var(--tx3)]">Sin pendientes ✓</p>
          : allPending.map(x => (
            <div key={x.id} className="flex items-center gap-3 py-2 border-b border-[var(--bg3)] last:border-0">
              <Badge variant="gold">{x._type === 'object' ? '📦 Objeto' : '🗂 Categoría'}</Badge>
              <span className="flex-1 font-bold text-sm">{x.name}</span>
              <span className="text-xs text-[var(--tx3)]">por {x.owner?.name}</span>
              <Button size="sm" onClick={() => approve(x._type, x.id)}>✓ Aprobar</Button>
              <Button size="sm" variant="danger" onClick={() => reject(x._type, x.id)}>✗ Rechazar</Button>
            </div>
          ))
        }
      </DashboardPanel>
    </div>
  );
}

/* ── Specialists page ──────────────────────────────────────────────────── */
function Specialists() {
  const [specialists, setSpecialists] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [modal,       setModal]       = useState(null);
  const [delId,       setDelId]       = useState(null);
  const [subTarget,   setSubTarget]   = useState(null);
  const [form,        setForm]        = useState({ name: '', email: '', bio: '', password: '', confirm_password: '' });
  const [saving,      setSaving]      = useState(false);
  const [feedback,    setFeedback]    = useState(null);
  const passwordError = getPasswordStrengthError(form.password, { required: modal === 'new' });
  const passwordConfirmError = form.password && form.password !== form.confirm_password
    ? 'Las contrasenas no coinciden.'
    : '';

  useEffect(() => {
    specialistsApi.list()
      .then(r => setSpecialists(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const openNew  = ()  => { setModal('new'); setFeedback(null); setForm({ name:'',email:'',bio:'',password:'',confirm_password:'' }); };
  const openEdit = (s) => { setModal(s); setFeedback(null); setForm({ name:s.user?.name||'', email:s.user?.email||'', bio:s.bio||'', password:'', confirm_password:'' }); };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (modal === 'new') {
        await usersApi.create({ ...form, role: 'specialist' });
        const spec = await specialistsApi.list();
        setSpecialists(spec.data.data);
        setFeedback({ type: 'success', message: 'Especialista creado correctamente.' });
      } else {
        const response = await specialistsApi.update(modal.id, {
          name: form.name,
          email: form.email,
          bio: form.bio,
          ...(form.password ? { password: form.password } : {}),
        });
        setSpecialists(prev => prev.map(spec => spec.id === modal.id ? response.data.data : spec));
        setFeedback({ type: 'success', message: form.password ? 'Especialista y contraseña actualizados.' : 'Especialista actualizado correctamente.' });
      }

      window.setTimeout(() => {
        setModal(null);
        setFeedback(null);
        setForm({ name:'',email:'',bio:'',password:'',confirm_password:'' });
      }, 800);
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar el especialista.') });
    } finally {
      setSaving(false);
    }
  };

  const filtered = specialists.filter(s =>
    !search || (s.user?.name + s.user?.email).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Especialistas"
        count={`${filtered.length}/${specialists.length}`}
        subtitle="Gestión de profesionales, estado de acceso y suscripción."
        action={<Button onClick={openNew}>+ Nuevo</Button>}
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar especialista..." extra={<Badge variant="default">{filtered.length} visibles</Badge>} />
      {filtered.length === 0 ? <Empty icon="🧑‍⚕️" title="Sin especialistas" /> :
        <ListCollection>
          <div className="space-y-2">
          {filtered.map(s => (
            <ListRow
              key={s.id}
              avatar={
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ac)] text-xs font-black text-white">
                  {(s.user?.name || '?').split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              }
              title={s.user?.name}
              subtitle={s.user?.email}
              meta={s.bio ? <p className="truncate text-xs text-[var(--tx3)]">{s.bio}</p> : null}
              badges={(
                <>
                  <Badge variant={s.user?.active ? 'green' : 'default'}>{s.user?.active ? 'Activo' : 'Inactivo'}</Badge>
                  <span className="cursor-pointer" onClick={() => setSubTarget({ entity: s, type: 'specialist' })}>
                    <SubBadge sub={s.subscription} />
                  </span>
                </>
              )}
              actions={(
                <>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => setDelId(s.id)}>Eliminar</Button>
                </>
              )}
            />
          ))}
          </div>
        </ListCollection>
      }
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo especialista' : 'Editar especialista'} maxWidth={480}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="space-y-3">
          <Input label="Nombre completo" value={form.name}  onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Email"           value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input
            label={modal === 'new' ? 'Contraseña' : 'Nueva contraseña'}
            type="password"
            value={form.password}
            error={passwordError || undefined}
            placeholder={modal === 'new' ? '' : 'Déjala vacía para no cambiarla'}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          <Input
            label={modal === 'new' ? 'Confirmar contraseña' : 'Confirmar nueva contraseña'}
            type="password"
            value={form.confirm_password}
            error={passwordConfirmError || undefined}
            placeholder={modal === 'new' ? '' : 'Repítela solo si vas a cambiarla'}
            onChange={e => setForm({ ...form, confirm_password: e.target.value })}
          />
          <p className="text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
          <Textarea label="Bio / especialidad" rows={2} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.name || !form.email || !!passwordError || !!passwordConfirmError} onClick={save}>{saving ? 'Guardando...' : modal === 'new' ? 'Crear' : 'Guardar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se desactivará el especialista." onConfirm={async () => { await usersApi.delete(delId); setSpecialists(p => p.filter(s => s.id !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
      {subTarget && <SubscriptionModal entity={subTarget.entity} entityType={subTarget.type} onClose={() => setSubTarget(null)} onSave={() => { specialistsApi.list().then(r => setSpecialists(r.data.data)); setSubTarget(null); }} />}
    </div>
  );
}

/* ── Clients page (admin) ──────────────────────────────────────────────── */
function Clients() {
  const [clients, setClients] = useState([]);
  const [specs,   setSpecs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(null);
  const [sub,     setSub]     = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);
  const [feedback, setFeedback] = useState(null);
  const passwordError = getPasswordStrengthError(form.password || '', { required: modal === 'new' });
  const passwordConfirmError = (form.password || '') && form.password !== form.confirm_password
    ? 'Las contrasenas no coinciden.'
    : '';

  useEffect(() => {
    Promise.all([clientsApi.list(), specialistsApi.list()])
      .then(([cr, sr]) => { setClients(cr.data.data); setSpecs(sr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setForm({ name: '', email: '', password: '', confirm_password: '', child_name: '', diagnosis_notes: '', specialist_id: '' });
    setFeedback(null);
    setModal('new');
  };

  const openEdit = (client) => {
    setForm({
      name: client.user?.name || '',
      email: client.user?.email || '',
      child_name: client.childName || '',
      diagnosis_notes: client.diagnosisNotes || '',
      specialist_id: client.specialistId || '',
      password: '',
      confirm_password: '',
    });
    setFeedback(null);
    setModal(client);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (modal === 'new') {
        const response = await clientsApi.create(form);
        setClients(prev => [response.data.data, ...prev]);
        setFeedback({ type: 'success', message: 'Cliente creado correctamente.' });
      } else {
        const response = await clientsApi.update(modal.id, form);
        setClients(prev => prev.map(client => client.id === modal.id ? response.data.data : client));
        setFeedback({ type: 'success', message: form.password ? 'Cliente y contraseña actualizados.' : 'Cliente actualizado correctamente.' });
      }
      window.setTimeout(() => {
        setModal(null);
        setFeedback(null);
      }, 800);
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar el cliente.') });
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter(c =>
    !search || (c.childName + (c.user?.name || '')).toLowerCase().includes(search.toLowerCase())
  );

  const renderClientGroups = (client) => {
    if (!client?.groups?.length) {
      return <p className="text-xs text-[var(--tx3)]">Sin grupos</p>;
    }

    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {client.groups.map(group => (
          <span
            key={group.id}
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold"
            style={{
              borderColor: group.color,
              backgroundColor: `${group.color}1A`,
              color: 'var(--tx2)',
            }}
          >
            {group.name}
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Todos los clientes"
        count={`${filtered.length}/${clients.length}`}
        subtitle="Vista operativa de alumnos, tutores, especialista responsable y grupos."
        action={<Button onClick={openNew}>+ Nuevo</Button>}
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar alumno o tutor..." extra={<Badge variant="default">{filtered.length} visibles</Badge>} />
      {filtered.length === 0 ? <Empty icon="👶" title="Sin clientes" /> :
        <ListCollection>
          <div className="space-y-2">
          {filtered.map(c => {
            const spec = specs.find(s => s.id === c.specialistId);
            return (
              <ListRow
                key={c.id}
                avatar={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ac)] text-xs font-black text-white">{(c.childName || '?').slice(0, 2).toUpperCase()}</div>}
                title={c.childName}
                subtitle={`${c.user?.name || 'Sin tutor'} · Esp: ${spec?.user?.name || '—'}`}
                meta={renderClientGroups(c)}
                badges={<span className="cursor-pointer" onClick={() => setSub({ entity: c, type: 'client' })}><SubBadge sub={c.subscription} /></span>}
                actions={(
                  <>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>Editar</Button>
                    <Button size="sm" variant="danger" onClick={() => setDelId(c.id)}>Eliminar</Button>
                  </>
                )}
              />
            );
          })}
          </div>
        </ListCollection>
      }
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo cliente' : 'Editar cliente'} maxWidth={640}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nombre tutor" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Nombre alumno" value={form.child_name || ''} onChange={e => setForm({ ...form, child_name: e.target.value })} />
          <Input label="Email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input
            label={modal === 'new' ? 'Contraseña' : 'Nueva contraseña'}
            type="password"
            value={form.password || ''}
            error={passwordError || undefined}
            placeholder={modal === 'new' ? '' : 'Déjala vacía para no cambiarla'}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          <Input
            label={modal === 'new' ? 'Confirmar contraseña' : 'Confirmar nueva contraseña'}
            type="password"
            value={form.confirm_password || ''}
            error={passwordConfirmError || undefined}
            placeholder={modal === 'new' ? '' : 'Repítela solo si vas a cambiarla'}
            onChange={e => setForm({ ...form, confirm_password: e.target.value })}
          />
          <Select label="Especialista" value={form.specialist_id || ''} onChange={e => setForm({ ...form, specialist_id: e.target.value })} className="sm:col-span-2">
            <option value="">Selecciona…</option>
            {specs.map(spec => <option key={spec.id} value={spec.id}>{spec.user?.name || 'Sin nombre'}</option>)}
          </Select>
        </div>
        <p className="mt-2 text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
        <div className="mt-3">
          <Textarea label="Notas clínicas" rows={3} value={form.diagnosis_notes || ''} onChange={e => setForm({ ...form, diagnosis_notes: e.target.value })} />
        </div>
        {modal !== 'new' && (
          <div className="mt-3">
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Grupos</p>
            {renderClientGroups(modal)}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.child_name || !form.email || !form.specialist_id || !!passwordError || !!passwordConfirmError} onClick={save}>{saving ? 'Guardando...' : modal === 'new' ? 'Crear' : 'Guardar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se desactivará el cliente." onConfirm={async () => { await clientsApi.delete(delId); setClients(p => p.filter(c => c.id !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
      {sub && <SubscriptionModal entity={sub.entity} entityType={sub.type} onClose={() => setSub(null)} onSave={() => { clientsApi.list().then(r => setClients(r.data.data)); setSub(null); }} />}
    </div>
  );
}

/* ── Activities page (admin) ───────────────────────────────────────────── */
function Activities() {
  const [acts,    setActs]    = useState([]);
  const [clients, setClients] = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [objects, setObjects] = useState([]);
  const [specs,   setSpecs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(false);
  const [editAct, setEditAct] = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [cat,     setCat]     = useState('Todos');
  const [form,    setForm]    = useState({ title:'', specialist_id:'', selObjs:[], assignMode:'all', selClients:[], selGroups:[] });
  const [saving,  setSaving]  = useState(false);
  const [feedback, setFeedback] = useState(null);

  const getAudience = (activity) => activity?.audience || null;
  const getVisibleClientsForSpecialist = (specialistId) => clients.filter(client => !specialistId || client.specialistId === specialistId);
  const getVisibleGroupsForSpecialist = (specialistId) => groups.filter(group => !specialistId || group.specId === specialistId);

  const visibleClients = clients.filter(client => !form.specialist_id || client.specialistId === form.specialist_id);
  const visibleGroups = groups.filter(group => !form.specialist_id || group.specId === form.specialist_id);
  const getAssignedClientIds = (activity) => [...new Set((activity.assignments || []).map(assignment => assignment.clientId))];
  const getAssignmentSummary = (activity) => {
    const audience = getAudience(activity);
    if (audience?.mode === 'all') {
      return 'Todos los usuarios';
    }
    if (audience?.mode === 'groups') {
      const matchedGroups = getVisibleGroupsForSpecialist(activity.specialistId).filter(group => (audience.groupIds || []).includes(group.id));
      if (matchedGroups.length === 1) {
        return `Grupo: ${matchedGroups[0].name}`;
      }
      if (matchedGroups.length > 1) {
        return `Grupos: ${matchedGroups.slice(0, 2).map(group => group.name).join(', ')}${matchedGroups.length > 2 ? '…' : ''}`;
      }
      return `${(audience.groupIds || []).length} grupos`;
    }
    if (audience?.mode === 'clients') {
      return `${(audience.clientIds || []).length} clientes individuales`;
    }

    const assignedClientIds = getAssignedClientIds(activity);
    const scopedClients = getVisibleClientsForSpecialist(activity.specialistId);
    if (assignedClientIds.length && scopedClients.length && assignedClientIds.length === scopedClients.length) {
      return 'Todos los clientes';
    }
    return `${assignedClientIds.length} clientes asignados`;
  };

  const getAssignmentDetail = (activity) => {
    const audience = getAudience(activity);
    if (audience?.mode === 'all') {
      return 'Destino: todos los usuarios del especialista';
    }
    if (audience?.mode === 'groups') {
      const matchedGroups = getVisibleGroupsForSpecialist(activity.specialistId).filter(group => (audience.groupIds || []).includes(group.id));
      if (matchedGroups.length) {
        return `Destino: ${matchedGroups.map(group => group.name).join(', ')}`;
      }
      return 'Destino: grupos';
    }
    if (audience?.mode === 'clients') {
      const matchedClients = getVisibleClientsForSpecialist(activity.specialistId).filter(client => (audience.clientIds || []).includes(client.id));
      if (matchedClients.length) {
        return `Destino: ${matchedClients.slice(0, 3).map(client => client.childName).join(', ')}${matchedClients.length > 3 ? '…' : ''}`;
      }
      return 'Destino: clientes individuales';
    }
    return 'Destino: asignación heredada';
  };

  useEffect(() => {
    Promise.all([activitiesApi.list(), clientsApi.list(), groupsApi.list(), objectsApi.list(), specialistsApi.list()])
      .then(([ar, cr, gr, or, sr]) => {
        setActs(ar.data.data);
        setClients(cr.data.data);
        setGroups(gr.data.data);
        setObjects(or.data.data);
        setSpecs(sr.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setForm(current => {
      if (!current.specialist_id) return current;
      const allowedClientIds = new Set(clients.filter(client => client.specialistId === current.specialist_id).map(client => client.id));
      const allowedGroupIds = new Set(groups.filter(group => group.specId === current.specialist_id).map(group => group.id));
      const nextSelClients = current.selClients.filter(id => allowedClientIds.has(id));
      const nextSelGroups = current.selGroups.filter(id => allowedGroupIds.has(id));
      if (nextSelClients.length === current.selClients.length && nextSelGroups.length === current.selGroups.length) {
        return current;
      }
      return { ...current, selClients: nextSelClients, selGroups: nextSelGroups };
    });
  }, [clients, groups, form.specialist_id]);

  const openNew = () => {
    setEditAct(null);
    setForm({ title:'', specialist_id:'', selObjs:[], assignMode:'all', selClients:[], selGroups:[] });
    setCat('Todos');
    setFeedback(null);
    setModal(true);
  };

  const openEdit = (activity) => {
    const assignedClientIds = getAssignedClientIds(activity);
    const scopedClients = getVisibleClientsForSpecialist(activity.specialistId);
    const audience = getAudience(activity);
    const assignMode = audience?.mode || (assignedClientIds.length && scopedClients.length && assignedClientIds.length === scopedClients.length
      ? 'all'
      : 'clients');
    setEditAct(activity);
    setForm({
      title: activity.title,
      specialist_id: activity.specialistId || '',
      selObjs: activity.activityObjects?.map(activityObject => activityObject.objectId) || [],
      assignMode,
      selClients: audience?.mode === 'clients' ? (audience.clientIds || []) : assignedClientIds,
      selGroups: audience?.mode === 'groups' ? (audience.groupIds || []) : [],
    });
    setCat('Todos');
    setFeedback(null);
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        title: form.title,
        specialist_id: form.specialist_id,
        objects: form.selObjs.map((id, index) => ({ object_id: id, sort_order: index })),
      };

      if (editAct) {
        const response = await activitiesApi.update(editAct.id, payload);
        await assignmentsApi.bulk({
          activity_id: editAct.id,
          specialist_id: form.specialist_id,
          assign_all: form.assignMode === 'all',
          client_ids: form.assignMode === 'clients' ? form.selClients : [],
          group_ids: form.assignMode === 'groups' ? form.selGroups : [],
          replace_existing: true,
        });
        const refreshed = await activitiesApi.list();
        setActs(refreshed.data.data);
        setFeedback({ type: 'success', message: 'Actividad actualizada y reasignada correctamente.' });
      } else {
        const response = await activitiesApi.create(payload);
        const newActivity = response.data.data;
        await assignmentsApi.bulk({
          activity_id: newActivity.id,
          specialist_id: form.specialist_id,
          assign_all: form.assignMode === 'all',
          client_ids: form.assignMode === 'clients' ? form.selClients : [],
          group_ids: form.assignMode === 'groups' ? form.selGroups : [],
        });
        const refreshed = await activitiesApi.list();
        setActs(refreshed.data.data);
        setFeedback({ type: 'success', message: 'Actividad creada y asignada correctamente.' });
      }

      window.setTimeout(() => {
        setModal(false);
        setFeedback(null);
      }, 800);
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar la actividad.') });
    } finally {
      setSaving(false);
    }
  };

  const filtered = acts.filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()));
  const cats = [...new Set(objects.map(object => object.category?.name || 'Sin categoría'))];
  const visibleObjects = objects.filter(object => cat === 'Todos' || object.category?.name === cat);
  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Todas las actividades"
        count={`${filtered.length}/${acts.length}`}
        subtitle="Actividades creadas, objetos incluidos y destino actual de asignación."
        action={<Button onClick={openNew}>+ Nueva</Button>}
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar actividad..." extra={<Badge variant="default">{filtered.length} visibles</Badge>} />
      {filtered.length === 0 ? <Empty icon="📋" title="Sin actividades" /> :
        <ListCollection>
          <div className="space-y-2">
          {filtered.map(a => (
            <ListRow
              key={a.id}
              avatar={<div className="flex min-h-11 min-w-11 items-center justify-center rounded-[16px] bg-[var(--bg2)] px-2 text-lg">{a.activityObjects?.slice(0, 4).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div>}
              title={a.title}
              subtitle={`${a.activityObjects?.length || 0} objetos · ${getAssignmentSummary(a)}`}
              meta={<p className="text-[11px] text-[var(--tx3)]">{getAssignmentDetail(a)}</p>}
              actions={(
                <>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => setDelId(a.id)}>Eliminar</Button>
                </>
              )}
            />
          ))}
          </div>
        </ListCollection>
      }
      <Modal open={modal} onClose={() => setModal(false)} title={editAct ? 'Editar actividad' : 'Nueva actividad'} maxWidth={860}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Input label="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Select label="Especialista" value={form.specialist_id} onChange={e => setForm({ ...form, specialist_id: e.target.value })}>
            <option value="">Selecciona…</option>
            {specs.map(spec => <option key={spec.id} value={spec.id}>{spec.user?.name || 'Sin nombre'}</option>)}
          </Select>
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Objetos</div>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {['Todos', ...cats].map(category => (
            <button key={category} onClick={() => setCat(category)} className={`px-2 py-0.5 rounded text-xs font-bold border ${cat === category ? 'bg-[var(--ac)] text-white border-[var(--ac)]' : 'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}>
              {category}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4 max-h-56 overflow-y-auto p-1">
          {visibleObjects.map(object => (
            <div
              key={object.id}
              onClick={() => setForm(current => ({
                ...current,
                selObjs: current.selObjs.includes(object.id)
                  ? current.selObjs.filter(id => id !== object.id)
                  : [...current.selObjs, object.id],
              }))}
              className={`flex flex-col items-center gap-1 p-2 border-2 rounded-lg cursor-pointer transition-all text-center ${form.selObjs.includes(object.id) ? 'border-[var(--ac)] bg-[var(--acb)]' : 'border-[var(--bd)] hover:border-[var(--ac)]'}`}
            >
              <span className="text-xl">{object.em}</span>
              <span className="text-[.65rem] font-bold text-[var(--tx2)] leading-tight">{object.name}</span>
            </div>
          ))}
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Asignar a</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {[['all','🌐','Todos los usuarios'],['clients','👤','Clientes'],['groups','👥','Grupos']].map(([mode, icon, label]) => (
            <div
              key={mode}
              onClick={() => setForm({ ...form, assignMode: mode })}
              className={`p-2 border-2 rounded-[var(--r)] cursor-pointer text-center text-xs font-bold ${form.assignMode === mode ? 'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}
            >
              <div className="text-lg">{icon}</div>{label}
            </div>
          ))}
        </div>
        {editAct && <p className="mb-3 text-xs text-[var(--tx3)]">Guardar actualizará también los destinatarios activos de esta actividad.</p>}
        {form.assignMode === 'clients' && (
          <div className="border border-[var(--bd)] rounded-[var(--r)] max-h-40 overflow-y-auto mb-3">
            {visibleClients.map(client => (
              <label key={client.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                <input type="checkbox" checked={form.selClients.includes(client.id)} onChange={() => setForm(current => ({ ...current, selClients: current.selClients.includes(client.id) ? current.selClients.filter(id => id !== client.id) : [...current.selClients, client.id] }))} />
                <span className="text-sm font-bold">{client.childName}</span>
                <span className="text-xs text-[var(--tx3)]">{client.user?.name}</span>
              </label>
            ))}
            {visibleClients.length === 0 && <p className="p-3 text-sm text-[var(--tx3)]">No hay clientes disponibles para el especialista seleccionado.</p>}
          </div>
        )}
        {form.assignMode === 'groups' && (
          <div className="flex flex-wrap gap-2 mb-3">
            {visibleGroups.map(group => (
              <div
                key={group.id}
                onClick={() => setForm(current => ({ ...current, selGroups: current.selGroups.includes(group.id) ? current.selGroups.filter(id => id !== group.id) : [...current.selGroups, group.id] }))}
                className={`px-3 py-1.5 rounded-full border-2 cursor-pointer text-xs font-bold ${form.selGroups.includes(group.id) ? 'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}
              >
                {group.name} ({group.clients?.length || 0})
              </div>
            ))}
            {visibleGroups.length === 0 && <p className="text-sm text-[var(--tx3)]">No hay grupos disponibles para el especialista seleccionado.</p>}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.title || !form.specialist_id || form.selObjs.length === 0 || (form.assignMode === 'clients' && form.selClients.length === 0) || (form.assignMode === 'groups' && form.selGroups.length === 0)} onClick={save}>{saving ? 'Guardando...' : editAct ? 'Guardar y reasignar' : 'Crear y asignar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará la actividad." onConfirm={async () => { await activitiesApi.delete(delId); setActs(p => p.filter(a => a.id !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
    </div>
  );
}

/* ── Objects page (admin) ──────────────────────────────────────────────── */
function Objects() {
  const [objects,  setObjects]  = useState([]);
  const [cats,     setCats]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [catF,     setCatF]     = useState('Todos');
  const [expanded, setExpanded] = useState(null);
  const [modal,    setModal]    = useState(false);
  const [editObj,  setEditObj]  = useState(null);
  const [delId,    setDelId]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [repActionKey, setRepActionKey] = useState('');
  const [repDrafts, setRepDrafts] = useState({});
  const emptyForm = {
    name: '',
    category_id: '',
    em: '📦',
    is_public: true,
    model3d: '',
    photoFile: null,
    photoPreview: '',
    drawingFile: null,
    drawingPreview: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    Promise.all([objectsApi.list(), categoriesApi.list()])
      .then(([or, cr]) => { setObjects(or.data.data); setCats(cr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const revokePreview = (url) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const closeModal = () => {
    revokePreview(form.photoPreview);
    revokePreview(form.drawingPreview);
    setFeedback(null);
    setSaving(false);
    setEditObj(null);
    setForm(emptyForm);
    setModal(false);
  };

  const getRepresentation = (object, level) => object.representations?.find(rep => rep.level === level);
  const repDraftKey = (objectId, level) => `${objectId}:${level}`;
  const apiLevelFor = (level) => ({ model_3d: '1', photo: '2', drawing: '3' }[level]);

  const refreshObject = async (objectId) => {
    const refreshed = await objectsApi.get(objectId);
    setObjects(prev => prev.map(object => object.id === objectId ? refreshed.data.data : object));
  };

  const openNew = () => {
    setEditObj(null);
    setFeedback(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (object) => {
    const model3d = getRepresentation(object, 'model_3d');
    const photo = getRepresentation(object, 'photo');
    const drawing = getRepresentation(object, 'drawing');

    setEditObj(object);
    setFeedback(null);
    setForm({
      name: object.name,
      category_id: object.categoryId,
      em: object.em,
      is_public: !object.ownerId,
      model3d: model3d?.model3dUrl || '',
      photoFile: null,
      photoPreview: photo?.fileUrl || '',
      drawingFile: null,
      drawingPreview: drawing?.fileUrl || '',
    });
    setModal(true);
  };

  const setFilePreview = (fileKey, previewKey, file) => {
    setForm(prev => {
      revokePreview(prev[previewKey]);
      return {
        ...prev,
        [fileKey]: file,
        [previewKey]: file ? URL.createObjectURL(file) : '',
      };
    });
  };

  const uploadRepresentation = async (objectId, level, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);
    await objectsApi.uploadRepresentation(objectId, formData);
  };

  const saveRepUrl = async (objectId) => {
    const key = repDraftKey(objectId, 'model_3d');
    const value = (repDrafts[key] || '').trim();
    if (!value) return;

    setRepActionKey(key);
    try {
      await objectsApi.setModel3d(objectId, '1', value);
      await refreshObject(objectId);
      setRepDrafts(prev => ({ ...prev, [key]: value }));
    } finally {
      setRepActionKey('');
    }
  };

  const replaceRep = async (objectId, level, file) => {
    const key = repDraftKey(objectId, level);
    setRepActionKey(key);
    try {
      await uploadRepresentation(objectId, apiLevelFor(level), file);
      await refreshObject(objectId);
    } finally {
      setRepActionKey('');
    }
  };

  const deleteRep = async (objectId, level) => {
    const key = repDraftKey(objectId, level);
    setRepActionKey(key);
    try {
      await objectsApi.deleteRepresentation(objectId, apiLevelFor(level));
      setRepDrafts(prev => ({ ...prev, [key]: '' }));
      await refreshObject(objectId);
    } finally {
      setRepActionKey('');
    }
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        name: form.name,
        category_id: form.category_id,
        em: form.em,
        is_public: form.is_public,
      };

      const response = editObj
        ? await objectsApi.update(editObj.id, payload)
        : await objectsApi.create(payload);

      const objectId = response.data.data.id;

      if (form.model3d.trim()) {
        await objectsApi.setModel3d(objectId, '1', form.model3d.trim());
      }
      if (form.photoFile) {
        await uploadRepresentation(objectId, '2', form.photoFile);
      }
      if (form.drawingFile) {
        await uploadRepresentation(objectId, '3', form.drawingFile);
      }

      const refreshed = await objectsApi.get(objectId);
      setObjects(prev => {
        const next = prev.filter(object => object.id !== objectId);
        return editObj ? [refreshed.data.data, ...next] : [refreshed.data.data, ...prev];
      });
      closeModal();
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar el objeto.') });
      setSaving(false);
    }
  };
  const del = async () => { await objectsApi.delete(delId); setObjects(p => p.filter(o => o.id !== delId)); setDelId(null); };

  const filtered = objects.filter(o =>
    (catF === 'Todos' || o.category?.name === catF) &&
    (!search || o.name.toLowerCase().includes(search.toLowerCase()))
  );
  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Objetos públicos</h1>
        <Button onClick={openNew}>+ Nuevo</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar objeto..."
        extra={
          <Select value={catF} onChange={e => setCatF(e.target.value)} className="!w-auto text-sm">
            <option>Todos</option>
            {cats.map(c => <option key={c.id}>{c.name}</option>)}
          </Select>
        }
      />
      {filtered.length === 0 ? <Empty icon="📦" title="Sin objetos" /> :
        <div className="space-y-2">
          {filtered.map(o => {
            const reps = o.representations || [];
            const has3d = reps.some(rep => rep.level === 'model_3d');
            const hasPhoto = reps.some(rep => rep.level === 'photo');
            const hasDrawing = reps.some(rep => rep.level === 'drawing');

            return (
              <div key={o.id} className={`bg-[var(--sf)] border-2 rounded-[var(--rl)] overflow-hidden transition-colors ${expanded === o.id ? 'border-[var(--ac)]' : 'border-[var(--bd)]'}`}>
                <div className="flex flex-wrap items-center gap-2 md:gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                  <span className="text-2xl">{o.em}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{o.name}</p>
                    <p className="text-xs text-[var(--tx3)]">{o.category?.name}</p>
                  </div>
                  <Badge variant={has3d ? 'green' : 'amber'}>🧊 {has3d ? '✓' : '✗'}</Badge>
                  <Badge variant={hasPhoto ? 'green' : 'amber'}>📷 {hasPhoto ? '✓' : '✗'}</Badge>
                  <Badge variant={hasDrawing ? 'green' : 'amber'}>✏️ {hasDrawing ? '✓' : '✗'}</Badge>
                  <Badge variant={o.ownerId ? 'default' : 'green'}>{o.ownerId ? 'Privado' : 'Público'}</Badge>
                  <Badge variant={o.status === 'approved' ? 'green' : o.status === 'pending' ? 'amber' : 'default'}>{o.status}</Badge>
                  <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); openEdit(o); }}>✏️</Button>
                  <Button size="sm" variant="danger" onClick={(event) => { event.stopPropagation(); setDelId(o.id); }}>🗑</Button>
                </div>
                {expanded === o.id && (
                  <div className="border-t border-[var(--bd)] p-4 grid gap-4 xl:grid-cols-3">
                    {[
                      ['model_3d', 'URL 3D', reps.find(rep => rep.level === 'model_3d')],
                      ['photo', 'Foto', reps.find(rep => rep.level === 'photo')],
                      ['drawing', 'Dibujo', reps.find(rep => rep.level === 'drawing')],
                    ].map(([level, label, rep]) => {
                      const draftKey = repDraftKey(o.id, level);
                      const isBusy = repActionKey === draftKey;
                      const draftValue = repDrafts[draftKey] ?? rep?.model3dUrl ?? '';
                      return (
                      <div key={level} className="rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3 space-y-2">
                        <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">{label}</p>
                        {!rep && <p className="text-sm text-[var(--tx3)]">Sin contenido</p>}
                        {rep?.mediaType === 'model_3d_url' && rep.model3dUrl && (
                          <div className="space-y-2">
                            <div className="relative aspect-video overflow-hidden rounded-[var(--r)] border border-[var(--bd)] bg-black/5">
                              <iframe src={rep.model3dUrl} title={`${o.name} 3D`} className="absolute inset-0 h-full w-full" allowFullScreen />
                            </div>
                            <Input value={draftValue} onChange={e => setRepDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))} placeholder="https://sketchfab.com/models/.../embed" />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveRepUrl(o.id)} disabled={isBusy || !draftValue.trim()}>{isBusy ? 'Guardando...' : 'Guardar URL'}</Button>
                              <Button size="sm" variant="danger" onClick={() => deleteRep(o.id, level)} disabled={isBusy}>Eliminar</Button>
                            </div>
                            <a href={rep.model3dUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[var(--ac)] break-all">{rep.model3dUrl}</a>
                          </div>
                        )}
                        {rep?.mediaType !== 'model_3d_url' && rep?.fileUrl && (
                          <>
                            <img src={rep.fileUrl} alt={label} className="h-32 w-full rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
                            <div className="flex gap-2">
                              <label className="inline-flex items-center gap-1.5 font-bold rounded-[var(--r)] border transition-all cursor-pointer whitespace-nowrap px-2.5 py-1 text-xs bg-[var(--sf)] text-[var(--tx)] border-[var(--bd)] hover:bg-[var(--bg2)]">
                                Reemplazar
                                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && replaceRep(o.id, level, e.target.files[0])} />
                              </label>
                              <Button size="sm" variant="danger" onClick={() => deleteRep(o.id, level)} disabled={isBusy}>Eliminar</Button>
                            </div>
                          </>
                        )}
                        {!rep && level === 'model_3d' && (
                          <>
                            <Input value={draftValue} onChange={e => setRepDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))} placeholder="https://sketchfab.com/models/.../embed" />
                            <Button size="sm" onClick={() => saveRepUrl(o.id)} disabled={isBusy || !draftValue.trim()}>{isBusy ? 'Guardando...' : 'Guardar URL'}</Button>
                          </>
                        )}
                        {!rep && level !== 'model_3d' && (
                          <label className="inline-flex w-full items-center justify-center gap-1.5 font-bold rounded-[var(--r)] border transition-all cursor-pointer whitespace-nowrap px-2.5 py-2 text-xs bg-[var(--sf)] text-[var(--tx)] border-[var(--bd)] hover:bg-[var(--bg2)]">
                            Subir archivo
                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && replaceRep(o.id, level, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    );})}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
      <Modal open={modal} onClose={closeModal} title={editObj ? 'Editar objeto' : 'Nuevo objeto (público)'} maxWidth={860}>
        <div className="space-y-3">
          {feedback && <Notice variant={feedback.type}>{feedback.message}</Notice>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="Emoji"  value={form.em}   onChange={e => setForm({ ...form, em: e.target.value })} />
            <Select label="Categoría" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Selecciona…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input
            label="URL del fichero 3D"
            value={form.model3d}
            onChange={e => setForm({ ...form, model3d: e.target.value })}
            placeholder="https://sketchfab.com/models/.../embed"
          />
          {form.model3d && (
            <div className="space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Previsualización 3D</p>
              <div className="relative aspect-video overflow-hidden rounded-[var(--r)] border border-[var(--bd)] bg-black/5">
                <iframe src={form.model3d} title="Vista previa 3D" className="absolute inset-0 h-full w-full" allowFullScreen />
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Foto</p>
              <label className="flex cursor-pointer items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white px-3 py-2 text-sm font-bold text-[var(--ac)]">
                Subir foto
                <input type="file" accept="image/*" className="hidden" onChange={e => setFilePreview('photoFile', 'photoPreview', e.target.files?.[0] || null)} />
              </label>
              {form.photoPreview ? (
                <img src={form.photoPreview} alt="Previsualización de foto" className="h-40 w-full rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
              ) : (
                <p className="text-sm text-[var(--tx3)]">Sin foto cargada</p>
              )}
            </div>
            <div className="space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Dibujo</p>
              <label className="flex cursor-pointer items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white px-3 py-2 text-sm font-bold text-[var(--ac)]">
                Subir dibujo
                <input type="file" accept="image/*" className="hidden" onChange={e => setFilePreview('drawingFile', 'drawingPreview', e.target.files?.[0] || null)} />
              </label>
              {form.drawingPreview ? (
                <img src={form.drawingPreview} alt="Previsualización de dibujo" className="h-40 w-full rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
              ) : (
                <p className="text-sm text-[var(--tx3)]">Sin dibujo cargado</p>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
            Publicar (visible para todos los especialistas)
          </label>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.name || !form.category_id} onClick={save}>{saving ? 'Guardando...' : editObj ? 'Guardar' : 'Crear'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el objeto y todas sus representaciones." onConfirm={del} onCancel={() => setDelId(null)} />
    </div>
  );
}

/* ── Groups page (admin) ───────────────────────────────────────────────── */
function Groups() {
  const [groups,  setGroups]  = useState([]);
  const [clients, setClients] = useState([]);
  const [specs,   setSpecs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(false);
  const [editGrp, setEditGrp] = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [form,    setForm]    = useState({ name: '', color: '#1A5FD4', specialist_id: '', client_ids: [] });
  const [saving,  setSaving]  = useState(false);
  const [feedback, setFeedback] = useState(null);
  const COLORS = ['#1A5FD4','#1A7A3C','#C0392B','#B05000','#7B2D8B','#0077BB','#CC3300'];

  useEffect(() => {
    Promise.all([groupsApi.list(), clientsApi.list(), specialistsApi.list()])
      .then(([gr, cr, sr]) => { setGroups(gr.data.data); setClients(cr.data.data); setSpecs(sr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew  = () => {
    setEditGrp(null);
    setFeedback(null);
    setForm({ name:'', color:'#1A5FD4', specialist_id:'', client_ids:[] });
    setModal(true);
  };
  const openEdit = g  => {
    setEditGrp(g);
    setFeedback(null);
    setForm({ name:g.name, color:g.color, specialist_id: g.specId || '', client_ids: g.clients?.map(c=>c.id)||[] });
    setModal(true);
  };
  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (editGrp) {
        const r = await groupsApi.update(editGrp.id, form);
        setGroups(p=>p.map(g=>g.id===editGrp.id?r.data.data:g));
        setFeedback({ type: 'success', message: 'Grupo actualizado correctamente.' });
      }
      else {
        const r = await groupsApi.create(form);
        setGroups(p=>[...p, r.data.data]);
        setFeedback({ type: 'success', message: 'Grupo creado correctamente.' });
      }
      window.setTimeout(() => {
        setModal(false);
        setFeedback(null);
      }, 800);
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar el grupo.') });
    } finally {
      setSaving(false);
    }
  };
  const del = async () => { await groupsApi.delete(delId); setGroups(p=>p.filter(g=>g.id!==delId)); setDelId(null); };
  const filtered = groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));
  const selectableClients = clients.filter(c => !form.specialist_id || c.specialistId === form.specialist_id);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="max-h-dvh">
      <ListPageHeader
        title="Grupos"
        count={`${filtered.length}/${groups.length}`}
        subtitle="Agrupaciones operativas para asignar actividades a varios alumnos."
        action={<Button onClick={openNew}>+ Nuevo grupo</Button>}
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar grupo..." extra={<Badge variant="default">{filtered.length} visibles</Badge>} />
      {filtered.length === 0 ? <Empty icon="👥" title="Sin grupos" /> :
        <ListCollection>
          <div className="space-y-2">
          {filtered.map(g => (
            <ListRow
              key={g.id}
              accentColor={g.color}
              avatar={<div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: g.color }}>{g.clients?.length || 0}</div>}
              title={g.name}
              subtitle={`${g.clients?.length || 0} miembros`}
              meta={<p className="text-xs text-[var(--tx3)]">{g.clients?.map(c => c.childName).join(', ') || 'Sin miembros'}</p>}
              actions={(
                <>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(g)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => setDelId(g.id)}>Eliminar</Button>
                </>
              )}
            />
          ))}
          </div>
        </ListCollection>
      }
      <Modal open={modal} onClose={() => setModal(false)} title={editGrp ? 'Editar grupo' : 'Nuevo grupo'} maxWidth={480}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Select
            label="Especialista"
            value={form.specialist_id}
            onChange={e => setForm(current => ({
              ...current,
              specialist_id: e.target.value,
              client_ids: current.client_ids.filter(clientId => clients.some(client => client.id === clientId && client.specialistId === e.target.value)),
            }))}
          >
            <option value="">Selecciona…</option>
            {specs.map(spec => <option key={spec.id} value={spec.id}>{spec.user?.name || 'Sin nombre'}</option>)}
          </Select>
          <div>
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Color</p>
            <div className="flex gap-2">{COLORS.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-8 h-8 rounded-full hover:scale-110 transition-transform" style={{ background: c, outline: form.color === c ? `3px solid ${c}` : undefined, outlineOffset: 2 }} />)}</div>
          </div>
          <div>
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Miembros</p>
            <div className="border border-[var(--bd)] rounded-[var(--r)] max-h-36 overflow-y-auto">
              {selectableClients.map(c => (
                <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                  <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={() => setForm(f => ({ ...f, client_ids: f.client_ids.includes(c.id) ? f.client_ids.filter(x => x !== c.id) : [...f.client_ids, c.id] }))} />
                  <span className="text-sm font-bold">{c.childName}</span>
                </label>
              ))}
              {form.specialist_id && selectableClients.length === 0 && (
                <p className="p-3 text-sm text-[var(--tx3)]">No hay clientes para el especialista seleccionado.</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.name || !form.specialist_id} onClick={save}>{saving ? 'Guardando...' : editGrp ? 'Guardar' : 'Crear'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el grupo. Los clientes no se verán afectados." onConfirm={del} onCancel={() => setDelId(null)} />
    </div>
  );
}

/* ── Subscriptions page ────────────────────────────────────────────────── */
function Subscriptions() {
  const [specialists, setSpecialists] = useState([]);
  const [clients,     setClients]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('all');
  const [subTarget,   setSubTarget]   = useState(null);

  useEffect(() => {
    Promise.all([specialistsApi.list(), clientsApi.list()])
      .then(([sr, cr]) => { setSpecialists(sr.data.data); setClients(cr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const subStatus = (sub) => {
    if (!sub) return 'none';
    const days = (new Date(sub.expires) - new Date()) / 864e5;
    if (sub.status === 'trial') return 'trial';
    if (days > 0 && days <= 15) return 'expiring';
    if (days > 0) return 'active';
    if (days > -15) return 'grace';
    return 'expired';
  };

  const filterMap = { trial: 'Prueba', active: 'Activa', expiring: 'Por vencer', grace: 'Cortesía', expired: 'Caducada', none: 'Sin suscripción' };

  const allEntities = [
    ...specialists.map(s => ({ ...s, _type: 'specialist', _name: s.user?.name, _sub: s.subscription })),
    ...clients.map(c => ({ ...c, _type: 'client', _name: c.childName, _sub: c.subscription })),
  ].filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e._name?.toLowerCase().includes(q);
    const matchF = filter === 'all' || subStatus(e._sub) === filter;
    return matchQ && matchF;
  });

  const refresh = () => {
    Promise.all([specialistsApi.list(), clientsApi.list()])
      .then(([sr, cr]) => { setSpecialists(sr.data.data); setClients(cr.data.data); });
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <h1 className="text-xl font-black mb-4">Gestión de suscripciones</h1>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar..."
        extra={
          <Select value={filter} onChange={e => setFilter(e.target.value)} className="!w-auto text-sm">
            <option value="all">Todos</option>
            {Object.entries(filterMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        }
      />
      <div className="space-y-2">
        {allEntities.map(e => (
          <div key={e.id + e._type} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
            <Badge variant={e._type === 'specialist' ? 'blue' : 'default'}>{e._type === 'specialist' ? '🧑‍⚕️' : '👶'}</Badge>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{e._name}</p>
              <p className="text-xs text-[var(--tx3)]">
                {e._sub ? `${e._sub.plan} · ${e._sub.billing === 'month' ? 'Mensual' : 'Anual'} · vence ${e._sub.expires}` : 'Sin suscripción'}
              </p>
            </div>
            <SubBadge sub={e._sub} />
            <Button size="sm" onClick={() => setSubTarget({ entity: e, type: e._type })}>💳 Gestionar</Button>
          </div>
        ))}
        {allEntities.length === 0 && <Empty icon="💳" title="Sin resultados" />}
      </div>
      {subTarget && (
        <SubscriptionModal
          entity={subTarget.entity} entityType={subTarget.type}
          onClose={() => setSubTarget(null)}
          onSave={() => { refresh(); setSubTarget(null); }}
        />
      )}
    </div>
  );
}

/* ── Admin Home (router) ────────────────────────────────────────────────── */
export default function AdminHome() {
  return (
    <Routes>
      <Route index              element={<Dashboard />} />
      <Route path="specialists" element={<Specialists />} />
      <Route path="clients"     element={<Clients />} />
      <Route path="activities"  element={<Activities />} />
      <Route path="objects"     element={<Objects />} />
      <Route path="groups"      element={<Groups />} />
      <Route path="subscriptions" element={<Subscriptions />} />
    </Routes>
  );
}
