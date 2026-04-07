import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router';
import {
  adminApi, specialistsApi, clientsApi, activitiesApi, assignmentsApi,
  objectsApi, categoriesApi, groupsApi, subscriptionsApi, usersApi,
} from '../../api';
import {
  Button, Badge, Card, Input, Select, Textarea, ActionIconButton, ColorPickerField,
  SearchBar, ColumnToggle, Confirm, Modal, Empty, Spinner, SubBadge, Divider, Notice,
} from '../../components/ui';
import { CategoryManagementView } from '../../components/modals/CategoryManagerModal';
import SubscriptionModal from '../../components/modals/SubscriptionModal';
import useListColumns from '../../hooks/useListColumns';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../../lib/password';

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.message || fallback;
}

function DashboardMetricCard({ value, label }) {
  return (
    <div className="sp-dash-metric min-h-[88px] rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] px-[15px] py-3">
      <p className="text-[1.8rem] font-black leading-none text-[var(--ac)]">{value ?? '0'}</p>
      <p className="mt-1 text-[.65rem] font-bold uppercase tracking-[0.05em] text-[var(--tx3)]">{label}</p>
    </div>
  );
}

function DashboardPanel({ icon, title, children, className = '' }) {
  return (
    <Card className={`sp-dash-panel ${className}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <h2 className="text-base font-black">{title}</h2>
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
          <Badge variant="blue" className="management-count-badge">{count}</Badge>
        </div>
        {subtitle && <p className="text-sm text-[var(--tx3)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ListCollection({ children, className = '' }) {
  return <Card className={className}>{children}</Card>;
}

function ListGrid({ columns = 1, children, className = '' }) {
  return (
    <div className={`grid items-start gap-2 ${className}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

function ListRow({ avatar, title, subtitle, meta, badges, actions, accentColor, className = '' }) {
  return (
    <div
      className={`flex flex-col gap-2.5 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] px-[14px] py-[11px] sm:flex-row sm:items-center ${className}`}
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
      {actions && <div className="flex flex-wrap items-center justify-end gap-2.5 sm:ml-auto">{actions}</div>}
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────── */
function Dashboard() {
  const [stats, setStats] = useState(null);
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
    ['Clientes', stats?.clients, '👶'],
    ['Actividades', stats?.activities, '📋'],
    ['Objetos', stats?.objects, '📦'],
    ['Categorías', stats?.categories, '🗂'],
    ['Asignaciones', stats?.assignments, '🔗'],
  ];

  const allPending = [
    ...pending.objects.map(x => ({ ...x, _type: 'object' })),
    ...pending.categories.map(x => ({ ...x, _type: 'category' })),
  ];

  const normalizeDate = (value) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  const getSubscriptionDaysLeft = (expires) => {
    const today = normalizeDate(new Date());
    const expiry = normalizeDate(expires);
    return Math.round((expiry - today) / 86400000);
  };

  const getSubState = (sub) => {
    if (!sub) return 'none';
    if (sub.status === 'inactive') return 'inactive';
    const diffDays = getSubscriptionDaysLeft(sub.expires);
    if (sub.status === 'trial') return 'trial';
    if (diffDays > 15) return 'active';
    if (diffDays >= 0) return 'expiring';
    if (diffDays > -15) return 'grace';
    return 'expired';
  };

  const activeSpecialists = specialists.filter(item => item.user?.active).length;
  const activeClients = clients.filter(item => item.user?.active).length;

  const expiringEntries = [
    ...specialists.filter(item => item.subscription).map(item => ({
      id: item.id,
      kind: 'Especialista',
      name: item.user?.name || 'Sin nombre',
      expires: item.subscription?.expires,
      daysLeft: getSubscriptionDaysLeft(item.subscription?.expires),
      state: getSubState(item.subscription),
    })),
    ...clients.filter(item => item.subscription).map(item => ({
      id: item.id,
      kind: 'Cliente',
      name: item.childName || item.user?.name || 'Sin nombre',
      expires: item.subscription?.expires,
      daysLeft: getSubscriptionDaysLeft(item.subscription?.expires),
      state: getSubState(item.subscription),
    })),
  ]
    .filter(item => item.state === 'expiring')
    .sort((left, right) => left.daysLeft - right.daysLeft)
    .slice(0, 6);

  const subCounts = [
    ...specialists.map(item => item.subscription).filter(Boolean),
    ...clients.map(item => item.subscription).filter(Boolean),
  ].reduce((acc, sub) => {
    const key = getSubState(sub);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { active: 0, trial: 0, grace: 0, expired: 0, expiring: 0, inactive: 0 });

  return (
    <div className="animate-in space-y-5 admin-dashboard-stack">
      <div>
        <h1 className="text-2xl font-black">Panel global</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 admin-dashboard-metrics">
        <DashboardMetricCard value={stats?.specialists} label="Especialistas" />
        <DashboardMetricCard value={stats?.clients} label="Clientes" />
        <DashboardMetricCard value={stats?.activities} label="Actividades" />
        <DashboardMetricCard value={stats?.objects} label="Objetos" />
        <DashboardMetricCard value={activeSpecialists} label="Esp. activos" />
        <DashboardMetricCard value={activeClients} label="Cli. activos" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr] admin-dashboard-sections">
        <DashboardPanel icon="⏳" title="Próximos a vencer (15d)" className="min-h-[236px]">
          {expiringEntries.length === 0 ? (
            <div className="flex min-h-[150px] items-center justify-center text-sm text-[var(--tx3)]">
              Sin vencimientos próximos.
            </div>
          ) : (
            <div className="space-y-2">
              {expiringEntries.map(item => (
                <div key={`${item.kind}-${item.id}`} className="sp-dash-list-card flex items-center justify-between gap-3 rounded-[var(--r)] border border-[var(--bd)] px-4 py-3">
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

        <DashboardPanel icon="📊" title="Estado suscripciones" className="min-h-[236px] admin-subscription-panel">
          <div className="admin-subscription-list divide-y divide-[var(--bd)]/80">
            {[
              ['Activa', subCounts.active || 0, 'green'],
              ['Prueba 15d', subCounts.trial || 0, 'blue'],
              ['Vence pronto', subCounts.expiring || 0, 'amber'],
              ['Gracia 15d', subCounts.grace || 0, 'amber'],
              ['Caducada', subCounts.expired || 0, 'red'],
            ].map(([label, value, variant]) => (
              <div key={label} className="admin-subscription-row flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
                <Badge variant={variant} className="admin-subscription-badge">{label}</Badge>
                <span className="admin-subscription-count text-2xl font-black text-[var(--tx)]">{value}</span>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel icon="🧾" title={`Aprobaciones pendientes (${allPending.length})`} className="admin-dashboard-approvals">
        {allPending.length === 0
          ? <p className="text-sm text-[var(--tx3)]">Sin pendientes ✓</p>
          : allPending.map(x => (
            <div key={x.id} className="sp-dash-list-card flex items-center gap-3 border-b border-[var(--bg3)] px-3 py-3 last:border-0">
              <Badge className="entity-item-badge" variant="gold">{x._type === 'object' ? '📦 Objeto' : '🗂 Categoría'}</Badge>
              <span className="flex-1 font-bold text-sm">{x.name}</span>
              <span className="text-xs text-[var(--tx3)]">por {x.owner?.name}</span>
              <Button size="sm" className="entity-action-btn" onClick={() => approve(x._type, x.id)}>✓ Aprobar</Button>
              <Button size="sm" variant="danger" className="entity-action-btn" onClick={() => reject(x._type, x.id)}>✗ Rechazar</Button>
            </div>
          ))
        }
      </DashboardPanel>
    </div>
  );
}

/* ── Specialists page ──────────────────────────────────────────────────── */
function Specialists() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [columnCount, setColumnCount] = useListColumns('admin.specialists', 1);
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [subTarget, setSubTarget] = useState(null);
  const [form, setForm] = useState({ role: 'specialist', name: '', email: '', bio: '', password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const passwordError = getPasswordStrengthError(form.password, { required: modal === 'new' });
  const passwordConfirmError = form.password && form.password !== form.confirm_password
    ? 'Las contrasenas no coinciden.'
    : '';

  const loadAccounts = async () => {
    const [specRes, adminRes] = await Promise.all([
      specialistsApi.list(),
      usersApi.list({ role: 'admin', limit: 100 }),
    ]);

    const specialistAccounts = specRes.data.data.map((specialist) => ({
      id: specialist.id,
      userId: specialist.user?.id,
      entityType: 'specialist',
      role: 'specialist',
      name: specialist.user?.name || 'Sin nombre',
      email: specialist.user?.email || '',
      bio: specialist.bio || '',
      active: specialist.user?.active,
      subscription: specialist.subscription,
      counts: specialist._count,
      raw: specialist,
    }));

    const adminAccounts = adminRes.data.data.map((admin) => ({
      id: admin.id,
      userId: admin.id,
      entityType: 'admin',
      role: 'admin',
      name: admin.name || 'Sin nombre',
      email: admin.email || '',
      bio: '',
      active: admin.active,
      subscription: null,
      counts: null,
      raw: admin,
    }));

    setAccounts([...specialistAccounts, ...adminAccounts].sort((left, right) => left.name.localeCompare(right.name, 'es')));
  };

  useEffect(() => {
    loadAccounts()
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => { setModal('new'); setFeedback(null); setForm({ role: 'specialist', name: '', email: '', bio: '', password: '', confirm_password: '' }); };
  const openEdit = (account) => {
    setModal(account);
    setFeedback(null);
    setForm({
      role: account.role,
      name: account.name || '',
      email: account.email || '',
      bio: account.bio || '',
      password: '',
      confirm_password: '',
    });
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (modal === 'new') {
        await usersApi.create({ ...form, role: form.role });
        await loadAccounts();
        setFeedback({ type: 'success', message: form.role === 'admin' ? 'Administrador creado correctamente.' : 'Especialista creado correctamente.' });
      } else {
        if (modal.entityType === 'admin') {
          await usersApi.update(modal.userId, {
            name: form.name,
            email: form.email,
            ...(form.password ? { password: form.password } : {}),
          });
        } else {
          await specialistsApi.update(modal.id, {
            name: form.name,
            email: form.email,
            bio: form.bio,
            ...(form.password ? { password: form.password } : {}),
          });
        }
        await loadAccounts();
        setFeedback({
          type: 'success',
          message: form.password
            ? `${modal.entityType === 'admin' ? 'Administrador' : 'Especialista'} y contraseña actualizados.`
            : `${modal.entityType === 'admin' ? 'Administrador' : 'Especialista'} actualizado correctamente.`,
        });
      }

      window.setTimeout(() => {
        setModal(null);
        setFeedback(null);
        setForm({ role: 'specialist', name: '', email: '', bio: '', password: '', confirm_password: '' });
      }, 800);
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar la cuenta.') });
    } finally {
      setSaving(false);
    }
  };

  const filtered = accounts.filter(account =>
    !search || `${account.name}${account.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Especialistas"
        count={`${filtered.length}/${accounts.length}`}
        subtitle="Gestión de profesionales y cuentas administradoras."
        action={<Button className="entity-action-btn" onClick={openNew}>+ Nueva cuenta</Button>}
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="🔍 Buscar especialista o administrador..."
        fieldClassName="search-field"
        inputClassName="search-input"
        extra={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="search-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />
      {filtered.length === 0 ? <Empty icon="🧑‍⚕️" title="Sin cuentas" /> :
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
            {filtered.map(account => (
              <ListRow
                key={`${account.entityType}-${account.id}`}
                className="entity-list-row"
                avatar={
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ac)] text-xs font-black text-white">
                    {(account.name || '?').split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                }
                title={account.name}
                subtitle={account.email}
                meta={account.entityType === 'admin'
                  ? <p className="truncate text-xs text-[var(--tx3)]">Cuenta administradora con acceso sin caducidad.</p>
                  : (account.bio ? <p className="truncate text-xs text-[var(--tx3)]">{account.bio}</p> : null)}
                badges={(
                  <>
                    <Badge className="entity-item-badge" variant={account.active ? 'green' : 'default'}>{account.active ? 'Activo' : 'Inactivo'}</Badge>
                    <Badge className="entity-item-badge" variant={account.entityType === 'admin' ? 'gold' : 'blue'}>
                      {account.entityType === 'admin' ? 'Administrador' : 'Especialista'}
                    </Badge>
                    {account.entityType === 'admin' ? (
                      <Badge className="entity-item-badge" variant="green">Sin caducidad</Badge>
                    ) : (
                      <span className="cursor-pointer" onClick={() => setSubTarget({ entity: account.raw, type: 'specialist' })}>
                        <SubBadge sub={account.subscription} className="entity-item-badge" />
                      </span>
                    )}
                  </>
                )}
                actions={(
                  <>
                    <ActionIconButton className="entity-action-btn" onClick={() => openEdit(account)} />
                    <ActionIconButton action="delete" className="entity-action-btn" onClick={() => setDelId(account.userId)} />
                  </>
                )}
              />
            ))}
          </ListGrid>
        </ListCollection>
      }
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nueva cuenta' : `Editar ${modal?.entityType === 'admin' ? 'administrador' : 'especialista'}`} maxWidth={480}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="modal-stack">
          {modal === 'new' && (
            <div className="modal-section">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Tipo de cuenta</p>
              <div className="flex flex-wrap gap-2">
                {[['specialist', 'Especialista'], ['admin', 'Administrador']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(current => ({ ...current, role: key, bio: key === 'admin' ? '' : current.bio }))}
                    className={`modal-choice rounded-[var(--r)] text-sm font-bold border transition-all ${form.role === key ? 'bg-[var(--ac)] text-white border-[var(--ac)]' : 'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {modal !== 'new' && modal?.entityType === 'admin' && (
            <Notice variant="info">Esta cuenta es administradora y no tiene caducidad ni suscripción asociada.</Notice>
          )}
          <Input label="Nombre completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input
            label={modal === 'new' ? 'Contraseña' : 'Nueva contraseña'}
            type="password"
            value={form.password}
            error={passwordError || undefined}
            placeholder={modal === 'new' ? '' : 'Déjala vacía para no cambiarla'}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          <p className="modal-hint text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
          <Input
            label={modal === 'new' ? 'Confirmar contraseña' : 'Confirmar nueva contraseña'}
            type="password"
            value={form.confirm_password}
            error={passwordConfirmError || undefined}
            placeholder={modal === 'new' ? '' : 'Repítela solo si vas a cambiarla'}
            onChange={e => setForm({ ...form, confirm_password: e.target.value })}
          />
          {(modal === 'new' ? form.role !== 'admin' : modal?.entityType !== 'admin') && (
            <Textarea label="Bio / especialidad" rows={2} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          )}
        </div>
        <div className="modal-actions flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.name || !form.email || !!passwordError || !!passwordConfirmError} onClick={save}>{saving ? 'Guardando...' : modal === 'new' ? 'Crear' : 'Guardar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se desactivará la cuenta." onConfirm={async () => { await usersApi.delete(delId); setAccounts(current => current.filter(account => account.userId !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
      {subTarget && <SubscriptionModal entity={subTarget.entity} entityType={subTarget.type} onClose={() => setSubTarget(null)} onSave={() => { loadAccounts().then(() => setSubTarget(null)); }} />}
    </div>
  );
}

/* ── Clients page (admin) ──────────────────────────────────────────────── */
function Clients() {
  const [clients, setClients] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [columnCount, setColumnCount] = useListColumns('admin.clients', 1);
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
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
            className="clients-group-chip inline-flex items-center rounded-full border text-[11px] font-bold"
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
        action={<Button className="clients-action-btn" onClick={openNew}>+ Nuevo cliente</Button>}
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="🔍 Buscar alumno o tutor..."
        fieldClassName="clients-search-field"
        inputClassName="clients-search-input"
        extra={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="search-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />
      {filtered.length === 0 ? <Empty icon="👶" title="Sin clientes" /> :
        <ListCollection className="clients-list-shell">
          <ListGrid columns={columnCount}>
            {filtered.map(c => {
              const spec = specs.find(s => s.id === c.specialistId);
              return (
                <ListRow
                  key={c.id}
                  className="clients-list-row"
                  avatar={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ac)] text-xs font-black text-white">{(c.childName || '?').slice(0, 2).toUpperCase()}</div>}
                  title={c.childName}
                  subtitle={`${c.user?.name || 'Sin tutor'} · Esp: ${spec?.user?.name || '—'}`}
                  meta={renderClientGroups(c)}
                  badges={<SubBadge sub={c.subscription} className="clients-item-badge" />}
                  actions={(
                    <>
                      <ActionIconButton className="clients-action-btn" onClick={() => openEdit(c)} />
                      <ActionIconButton action="delete" className="clients-action-btn" onClick={() => setDelId(c.id)} />
                    </>
                  )}
                />
              );
            })}
          </ListGrid>
        </ListCollection>
      }
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo cliente' : 'Editar cliente'} maxWidth={640} className="client-form-modal">
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="client-form-body">
          <div className="client-form-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <p className="client-form-hint text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
          <div className="client-form-section">
            <Textarea label="Notas clínicas" rows={3} value={form.diagnosis_notes || ''} onChange={e => setForm({ ...form, diagnosis_notes: e.target.value })} />
          </div>
          {modal !== 'new' && (
            <div className="client-form-section">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Grupos</p>
              {renderClientGroups(modal)}
            </div>
          )}
          <div className="modal-actions flex gap-2 justify-end mt-4">
            <Button variant="secondary" className="clients-action-btn" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
            <Button className="clients-action-btn" disabled={saving || !form.child_name || !form.email || !form.specialist_id || !!passwordError || !!passwordConfirmError} onClick={save}>{saving ? 'Guardando...' : modal === 'new' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se desactivará el cliente." onConfirm={async () => { await clientsApi.delete(delId); setClients(p => p.filter(c => c.id !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
    </div>
  );
}

/* ── Activities page (admin) ───────────────────────────────────────────── */
function Activities() {
  const [acts, setActs] = useState([]);
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [objects, setObjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [columnCount, setColumnCount] = useListColumns('admin.activities', 1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [specialistFilter, setSpecialistFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [editAct, setEditAct] = useState(null);
  const [delId, setDelId] = useState(null);
  const [cat, setCat] = useState('all');
  const [objectSearch, setObjectSearch] = useState('');
  const [form, setForm] = useState({ title: '', specialist_id: '', selObjs: [], assignMode: 'all', selClients: [], selGroups: [] });
  const [saving, setSaving] = useState(false);
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
    Promise.all([activitiesApi.list(), clientsApi.list(), groupsApi.list(), objectsApi.list(), categoriesApi.list(), specialistsApi.list()])
      .then(([ar, cr, gr, or, catr, sr]) => {
        setActs(ar.data.data);
        setClients(cr.data.data);
        setGroups(gr.data.data);
        setObjects(or.data.data);
        setCategories(catr.data.data);
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

  useEffect(() => {
    if (specialistFilter === 'all') return;
    if (clientFilter === 'all') return;
    const client = clients.find(item => item.id === clientFilter);
    if (client?.specialistId !== specialistFilter) {
      setClientFilter('all');
    }
  }, [clients, specialistFilter, clientFilter]);

  const openNew = () => {
    setEditAct(null);
    setForm({ title: '', specialist_id: '', selObjs: [], assignMode: 'all', selClients: [], selGroups: [] });
    setCat('all');
    setObjectSearch('');
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
    setCat('all');
    setObjectSearch('');
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

  const normalizedSearch = search.trim().toLowerCase();
  const clientOptions = clients.filter(client => specialistFilter === 'all' || client.specialistId === specialistFilter);
  const filtered = acts.filter((activity) => {
    const matchesSearch = !normalizedSearch || activity.title.toLowerCase().includes(normalizedSearch);
    const matchesSpecialist = specialistFilter === 'all' || activity.specialistId === specialistFilter;
    const relevantAssignments = (activity.assignments || []).filter((assignment) => clientFilter === 'all' || assignment.clientId === clientFilter);
    const matchesClient = clientFilter === 'all' || relevantAssignments.length > 0;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'pending' && relevantAssignments.some((assignment) => !assignment.completedAt))
      || (statusFilter === 'completed' && relevantAssignments.some((assignment) => Boolean(assignment.completedAt)));
    return matchesSearch && matchesSpecialist && matchesClient && matchesStatus;
  });
  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  const normalizedObjectSearch = objectSearch.trim().toLowerCase();
  const hasUncategorizedObjects = objects.some((object) => !object.categoryId);
  const visibleObjects = objects.filter((object) => {
    const matchesCategory = cat === 'all'
      || (cat === 'uncategorized' ? !object.categoryId : object.categoryId === cat);
    const matchesSearch = !normalizedObjectSearch || object.name.toLowerCase().includes(normalizedObjectSearch);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Todas las actividades"
        count={`${filtered.length}/${acts.length}`}
        subtitle="Actividades creadas, objetos incluidos y destino actual de asignación."
        action={<Button className="entity-action-btn" onClick={openNew}>+ Nueva actividad</Button>}
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="🔍 Buscar actividad por nombre..."
        fieldClassName="entity-search-field"
        inputClassName="entity-search-input"
        extra={(
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="completed">Completadas</option>
            </Select>
            <Select value={specialistFilter} onChange={e => setSpecialistFilter(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option value="all">Todos los especialistas</option>
              {specs.map(spec => <option key={spec.id} value={spec.id}>{spec.user?.name || 'Sin nombre'}</option>)}
            </Select>
            <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option value="all">Todos los clientes</option>
              {clientOptions.map(client => <option key={client.id} value={client.id}>{client.childName}</option>)}
            </Select>
            <Badge className="search-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />
      {filtered.length === 0 ? <Empty icon="📋" title="Sin actividades" /> :
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
            {filtered.map(a => (
              <ListRow
                key={a.id}
                className="entity-list-row"
                avatar={<div className="flex min-h-11 min-w-11 items-center justify-center rounded-[16px] bg-[var(--bg2)] px-2 text-lg">{a.activityObjects?.slice(0, 4).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div>}
                title={a.title}
                subtitle={`${a.activityObjects?.length || 0} objetos · ${getAssignmentSummary(a)}`}
                meta={<p className="text-[11px] text-[var(--tx3)]">{getAssignmentDetail(a)}</p>}
                actions={(
                  <>
                    <ActionIconButton className="entity-action-btn" onClick={() => openEdit(a)} />
                    <ActionIconButton action="delete" className="entity-action-btn" onClick={() => setDelId(a.id)} />
                  </>
                )}
              />
            ))}
          </ListGrid>
        </ListCollection>
      }
      <Modal open={modal} onClose={() => setModal(false)} title={editAct ? 'Editar actividad' : 'Nueva actividad'} maxWidth={980}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
          <Input label="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Select label="Especialista" value={form.specialist_id} onChange={e => setForm({ ...form, specialist_id: e.target.value })}>
            <option value="">Selecciona…</option>
            {specs.map(spec => <option key={spec.id} value={spec.id}>{spec.user?.name || 'Sin nombre'}</option>)}
          </Select>
        </div>
        <div className="activity-section mb-4">
          <div className="activity-object-toolbar">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Objetos</p>
              <Badge className="entity-item-badge" variant="blue">{form.selObjs.length} seleccionados</Badge>
            </div>
            <Badge className="entity-item-badge" variant="default">{visibleObjects.length} visibles</Badge>
          </div>
          <div className="activity-object-filters">
            <Select label="Categoría" value={cat} onChange={e => setCat(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
              {hasUncategorizedObjects && <option value="uncategorized">Sin categoría</option>}
            </Select>
            <Input
              label="Buscar objeto"
              value={objectSearch}
              onChange={e => setObjectSearch(e.target.value)}
              placeholder="Escribe el nombre del objeto"
            />
          </div>
          <div className="activity-object-panel">
            {visibleObjects.length === 0 ? (
              <p className="modal-note text-sm text-[var(--tx3)]">No hay objetos que coincidan con la búsqueda o la categoría seleccionada.</p>
            ) : (
              <div className="activity-object-grid">
                {visibleObjects.map(object => {
                  const selected = form.selObjs.includes(object.id);
                  return (
                    <button
                      key={object.id}
                      type="button"
                      onClick={() => setForm(current => ({
                        ...current,
                        selObjs: selected
                          ? current.selObjs.filter(id => id !== object.id)
                          : [...current.selObjs, object.id],
                      }))}
                      className={`modal-choice activity-object-card ${selected ? 'is-selected' : ''}`}
                    >
                      <span className="activity-object-card__emoji">{object.em}</span>
                      <span className="activity-object-card__name">{object.name}</span>
                      <span className="activity-object-card__category">{object.category?.name || 'Sin categoría'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="activity-section mb-3">
          <div className="activity-section__header">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Asignar a</p>
          </div>
          <div className="activity-assignment-grid">
            {[['all', '🌐', 'Todos los usuarios'], ['clients', '👤', 'Clientes'], ['groups', '👥', 'Grupos']].map(([mode, icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm({ ...form, assignMode: mode })}
                className={`modal-choice activity-assignment-card ${form.assignMode === mode ? 'is-selected' : ''}`}
              >
                <div className="activity-assignment-card__icon">{icon}</div>
                <div className="activity-assignment-card__label">{label}</div>
              </button>
            ))}
          </div>
        </div>
        {editAct && <p className="mb-3 text-xs text-[var(--tx3)]">Guardar actualizará también los destinatarios activos de esta actividad.</p>}
        {form.assignMode === 'clients' && (
          <div className="modal-list-panel border border-[var(--bd)] rounded-[var(--r)] max-h-40 overflow-y-auto mb-3">
            {visibleClients.map(client => (
              <label key={client.id} className="modal-list-row flex items-center gap-3 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                <input type="checkbox" checked={form.selClients.includes(client.id)} onChange={() => setForm(current => ({ ...current, selClients: current.selClients.includes(client.id) ? current.selClients.filter(id => id !== client.id) : [...current.selClients, client.id] }))} />
                <span className="text-sm font-bold">{client.childName}</span>
                <span className="text-xs text-[var(--tx3)]">{client.user?.name}</span>
              </label>
            ))}
            {visibleClients.length === 0 && <p className="modal-list-row text-sm text-[var(--tx3)]">No hay clientes disponibles para el especialista seleccionado.</p>}
          </div>
        )}
        {form.assignMode === 'groups' && (
          <div className="flex flex-wrap gap-2 mb-3">
            {visibleGroups.map(group => (
              <div
                key={group.id}
                onClick={() => setForm(current => ({ ...current, selGroups: current.selGroups.includes(group.id) ? current.selGroups.filter(id => id !== group.id) : [...current.selGroups, group.id] }))}
                className={`modal-chip rounded-full border-2 cursor-pointer text-xs font-bold ${form.selGroups.includes(group.id) ? 'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]' : 'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}
              >
                {group.name} ({group.clients?.length || 0})
              </div>
            ))}
            {visibleGroups.length === 0 && <p className="text-sm text-[var(--tx3)]">No hay grupos disponibles para el especialista seleccionado.</p>}
          </div>
        )}
        <div className="modal-actions flex gap-2 justify-end mt-2">
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
  const [objects, setObjects] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('Todos');
  const [columnCount, setColumnCount] = useListColumns('admin.objects', 1);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(false);
  const [editObj, setEditObj] = useState(null);
  const [delId, setDelId] = useState(null);
  const [saving, setSaving] = useState(false);
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

  const loadData = async () => {
    const [objectsResponse, categoriesResponse] = await Promise.all([objectsApi.list(), categoriesApi.list()]);
    setObjects(objectsResponse.data.data);
    setCats(categoriesResponse.data.data);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
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

  const renderCategoryChip = (category) => {
    if (!category) return null;
    return (
      <span className="object-category-chip" style={{ backgroundColor: `${category.color || '#1A5FD4'}14` }}>
        <span className="object-category-dot" style={{ backgroundColor: category.color || '#1A5FD4' }} />
        {category.name}
      </span>
    );
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
        <div className="flex flex-wrap items-center gap-2">
          <Button className="entity-action-btn" onClick={openNew}>+ Nuevo objeto</Button>
        </div>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="🔍 Buscar objeto..."
        fieldClassName="entity-search-field"
        inputClassName="entity-search-input"
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={catF} onChange={e => setCatF(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option>Todos</option>
              {cats.map(c => <option key={c.id}>{c.name}</option>)}
            </Select>
            <Badge className="search-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        }
      />
      {filtered.length === 0 ? <Empty icon="📦" title="Sin objetos" /> :
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
            {filtered.map(o => {
              const reps = o.representations || [];
              const has3d = reps.some(rep => rep.level === 'model_3d');
              const hasPhoto = reps.some(rep => rep.level === 'photo');
              const hasDrawing = reps.some(rep => rep.level === 'drawing');

              return (
                <div key={o.id} className={`bg-[var(--sf)] border-2 rounded-[var(--rl)] overflow-hidden transition-colors ${expanded === o.id ? 'border-[var(--ac)]' : 'border-[var(--bd)]'}`}>
                  <div className="object-card object-card--admin entity-list-row cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <div className="object-card__row object-card__row--top">
                      <div className="object-card__title">
                        <span className="object-card__emoji text-2xl">{o.em}</span>
                        <div className="object-card__title-copy">
                          <p className="font-bold text-sm">{o.name}</p>
                        </div>
                      </div>
                      <div className="object-card__badges">
                        <Badge className="entity-item-badge" variant={has3d ? 'green' : 'amber'}>🧊 {has3d ? '✓' : '✗'}</Badge>
                        <Badge className="entity-item-badge" variant={hasPhoto ? 'green' : 'amber'}>📷 {hasPhoto ? '✓' : '✗'}</Badge>
                        <Badge className="entity-item-badge" variant={hasDrawing ? 'green' : 'amber'}>✏️ {hasDrawing ? '✓' : '✗'}</Badge>
                      </div>
                    </div>

                    <div className="object-card__row object-card__row--meta">
                      <div className="object-card__meta-main">
                        {renderCategoryChip(o.category)}
                        <Badge className="entity-item-badge" variant={o.ownerId ? 'default' : 'green'}>{o.ownerId ? 'Privado' : 'Público'}</Badge>
                        <Badge className="entity-item-badge" variant={o.status === 'approved' ? 'green' : o.status === 'pending' ? 'amber' : 'default'}>{o.status}</Badge>
                      </div>
                      <div className="object-card__actions">
                        <ActionIconButton className="entity-action-btn" onClick={(event) => { event.stopPropagation(); openEdit(o); }} />
                        <ActionIconButton action="delete" className="entity-action-btn" onClick={(event) => { event.stopPropagation(); setDelId(o.id); }} />
                      </div>
                    </div>
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
                                  <ActionIconButton action="delete" onClick={() => deleteRep(o.id, level)} disabled={isBusy} />
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
                                  <ActionIconButton action="delete" onClick={() => deleteRep(o.id, level)} disabled={isBusy} />
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </ListGrid>
        </ListCollection>
      }
      <Modal open={modal} onClose={closeModal} title={editObj ? 'Editar objeto' : 'Nuevo objeto (público)'} maxWidth={860}>
        <div className="space-y-3">
          {feedback && <Notice variant={feedback.type}>{feedback.message}</Notice>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="Emoji" value={form.em} onChange={e => setForm({ ...form, em: e.target.value })} />
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
            <div className="modal-panel space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Previsualización 3D</p>
              <div className="relative aspect-video overflow-hidden rounded-[var(--r)] border border-[var(--bd)] bg-black/5">
                <iframe src={form.model3d} title="Vista previa 3D" className="absolute inset-0 h-full w-full" allowFullScreen />
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="modal-panel space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Foto</p>
              <label className="modal-upload flex cursor-pointer items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white text-sm font-bold text-[var(--ac)]">
                Subir foto
                <input type="file" accept="image/*" className="hidden" onChange={e => setFilePreview('photoFile', 'photoPreview', e.target.files?.[0] || null)} />
              </label>
              {form.photoPreview ? (
                <img src={form.photoPreview} alt="Previsualización de foto" className="h-40 w-full rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
              ) : (
                <p className="text-sm text-[var(--tx3)]">Sin foto cargada</p>
              )}
            </div>
            <div className="modal-panel space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Dibujo</p>
              <label className="modal-upload flex cursor-pointer items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white text-sm font-bold text-[var(--ac)]">
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
        <div className="modal-actions flex gap-2 justify-end mt-4">
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
  const [groups, setGroups] = useState([]);
  const [clients, setClients] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [columnCount, setColumnCount] = useListColumns('admin.groups', 1);
  const [memberSearch, setMemberSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editGrp, setEditGrp] = useState(null);
  const [delId, setDelId] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#1A5FD4', specialist_id: '', client_ids: [] });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const COLORS = ['#1A5FD4', '#1A7A3C', '#C0392B', '#B05000', '#7B2D8B', '#0077BB', '#CC3300'];

  useEffect(() => {
    Promise.all([groupsApi.list(), clientsApi.list(), specialistsApi.list()])
      .then(([gr, cr, sr]) => { setGroups(gr.data.data); setClients(cr.data.data); setSpecs(sr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setEditGrp(null);
    setFeedback(null);
    setMemberSearch('');
    setForm({ name: '', color: '#1A5FD4', specialist_id: '', client_ids: [] });
    setModal(true);
  };
  const openEdit = g => {
    setEditGrp(g);
    setFeedback(null);
    setMemberSearch('');
    setForm({ name: g.name, color: g.color, specialist_id: g.specId || '', client_ids: g.clients?.map(c => c.id) || [] });
    setModal(true);
  };
  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (editGrp) {
        const r = await groupsApi.update(editGrp.id, form);
        setGroups(p => p.map(g => g.id === editGrp.id ? r.data.data : g));
        setFeedback({ type: 'success', message: 'Grupo actualizado correctamente.' });
      }
      else {
        const r = await groupsApi.create(form);
        setGroups(p => [...p, r.data.data]);
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
  const del = async () => { await groupsApi.delete(delId); setGroups(p => p.filter(g => g.id !== delId)); setDelId(null); };
  const filtered = groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));
  const selectableClients = clients.filter(c => !form.specialist_id || c.specialistId === form.specialist_id);
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const visibleSelectableClients = selectableClients.filter(client => {
    if (!normalizedMemberSearch) return true;
    return (client.childName || '').toLowerCase().includes(normalizedMemberSearch);
  });

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="max-h-dvh">
      <ListPageHeader
        title="Grupos"
        count={`${filtered.length}/${groups.length}`}
        subtitle="Agrupaciones operativas para asignar actividades a varios alumnos."
        action={<Button className="entity-action-btn" onClick={openNew}>+ Nuevo grupo</Button>}
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="🔍 Buscar grupo..."
        fieldClassName="entity-search-field"
        inputClassName="entity-search-input"
        extra={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="search-visible-badge entity-item-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />
      {filtered.length === 0 ? <Empty icon="👥" title="Sin grupos" /> :
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
            {filtered.map(g => (
              <ListRow
                key={g.id}
                className="entity-list-row"
                accentColor={g.color}
                avatar={<div className="flex p-[11px] h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: g.color }}>{g.clients?.length || 0}</div>}
                title={g.name}
                subtitle={`${g.clients?.length || 0} miembros`}
                meta={<p className="text-xs text-[var(--tx3)]">{g.clients?.map(c => c.childName).join(', ') || 'Sin miembros'}</p>}
                actions={(
                  <>
                    <ActionIconButton className="entity-action-btn" onClick={() => openEdit(g)} />
                    <ActionIconButton action="delete" className="entity-action-btn" onClick={() => setDelId(g.id)} />
                  </>
                )}
              />
            ))}
          </ListGrid>
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
          <ColorPickerField label="Color" colors={COLORS} value={form.color} onChange={(color) => setForm({ ...form, color })} />
          <div className="modal-section">
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Miembros</p>
            <div className="modal-inline-search">
              <Input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Buscar miembro por nombre..." />
            </div>
            <div className="modal-list-panel border border-[var(--bd)] rounded-[var(--r)] max-h-36 overflow-y-auto">
              {visibleSelectableClients.map(c => (
                <label key={c.id} className="modal-list-row flex items-center gap-3 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                  <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={() => setForm(f => ({ ...f, client_ids: f.client_ids.includes(c.id) ? f.client_ids.filter(x => x !== c.id) : [...f.client_ids, c.id] }))} />
                  <span className="text-sm font-bold">{c.childName}</span>
                </label>
              ))}
              {form.specialist_id && selectableClients.length === 0 && (
                <p className="modal-list-row text-sm text-[var(--tx3)]">No hay clientes para el especialista seleccionado.</p>
              )}
              {form.specialist_id && selectableClients.length > 0 && visibleSelectableClients.length === 0 && (
                <p className="modal-list-row text-sm text-[var(--tx3)]">No hay coincidencias para esa búsqueda.</p>
              )}
            </div>
          </div>
        </div>
        <div className="modal-actions flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.name || !form.specialist_id} onClick={save}>{saving ? 'Guardando...' : editGrp ? 'Guardar' : 'Crear'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el grupo. Los clientes no se verán afectados." onConfirm={del} onCancel={() => setDelId(null)} />
    </div>
  );
}

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const response = await categoriesApi.list();
      setCategories(response.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <CategoryManagementView
      title="Categorías"
      subtitle="Gestiona colores, visibilidad y publicación de categorías de objetos."
      categories={categories}
      onRefresh={loadData}
      role="admin"
    />
  );
}

/* ── Subscriptions page ────────────────────────────────────────────────── */
function Subscriptions() {
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [columnCount, setColumnCount] = useListColumns('admin.subscriptions', 1);
  const [filter, setFilter] = useState('all');
  const [subTarget, setSubTarget] = useState(null);

  useEffect(() => {
    specialistsApi.list()
      .then((sr) => { setSpecialists(sr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const subStatus = (sub) => {
    if (!sub) return 'none';
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiry = new Date(sub.expires);
    const startExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const days = Math.round((startExpiry - startToday) / 86400000);
    if (sub.status === 'inactive') return 'inactive';
    if (sub.status === 'trial') return 'trial';
    if (days >= 0 && days <= 15) return 'expiring';
    if (days > 0) return 'active';
    if (days > -15) return 'grace';
    return 'expired';
  };

  const filterMap = { trial: 'Prueba', active: 'Activa', expiring: 'Por vencer', grace: 'Cortesía', expired: 'Caducada', inactive: 'Desactivada', none: 'Sin suscripción' };

  const allEntities = specialists.map(s => ({ ...s, _type: 'specialist', _name: s.user?.name, _sub: s.subscription })).filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e._name?.toLowerCase().includes(q);
    const matchF = filter === 'all' || subStatus(e._sub) === filter;
    return matchQ && matchF;
  });

  const refresh = () => {
    specialistsApi.list()
      .then((sr) => { setSpecialists(sr.data.data); });
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Gestión de suscripciones"
        count={`${allEntities.length}/${specialists.length}`}
        subtitle="Control de estados, vencimientos y acceso a la gestión de cobros de especialistas."
      />
      <SearchBar value={search} onChange={setSearch} placeholder="🔍 Buscar..." fieldClassName="search-field" inputClassName="search-input"
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onChange={e => setFilter(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option value="all">Todos</option>
              {Object.entries(filterMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Badge className="search-visible-badge" variant="default">{allEntities.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        }
      />
      {allEntities.length === 0 ? <Empty icon="💳" title="Sin resultados" /> : (
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
            {allEntities.map(e => (
              <div key={e.id + e._type} className="entity-list-row flex items-center gap-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
                <Badge className="entity-item-badge" variant={e._type === 'specialist' ? 'blue' : 'default'}>{e._type === 'specialist' ? '🧑‍⚕️' : '👶'}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{e._name}</p>
                  <p className="text-xs text-[var(--tx3)]">
                    {e._sub ? `${e._sub.plan} · ${e._sub.billing === 'month' ? 'Mensual' : 'Anual'} · vence ${e._sub.expires}` : 'Sin suscripción'}
                  </p>
                </div>
                <SubBadge sub={e._sub} className="entity-item-badge" />
                <Button size="sm" className="entity-action-btn" onClick={() => setSubTarget({ entity: e, type: e._type })}>💳 Gestionar</Button>
              </div>
            ))}
          </ListGrid>
        </ListCollection>
      )}
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
      <Route index element={<Dashboard />} />
      <Route path="specialists" element={<Specialists />} />
      <Route path="clients" element={<Clients />} />
      <Route path="activities" element={<Activities />} />
      <Route path="objects" element={<Objects />} />
      <Route path="categories" element={<Categories />} />
      <Route path="groups" element={<Groups />} />
      <Route path="subscriptions" element={<Subscriptions />} />
    </Routes>
  );
}
