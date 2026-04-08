import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router';
import { clientsApi, activitiesApi, groupsApi, assignmentsApi, objectsApi, categoriesApi, specialistsApi } from '../../api';
import useAuthStore from '../../stores/authStore';
import { Button, Badge, Card, Input, Select, Textarea, SearchBar, ColumnToggle, TabBar, Confirm, Modal, Empty, Spinner, SubBadge, Notice, ActionIconButton, ColorPickerField, IconButton, OnboardingPanel, MetricCard } from '../../components/ui';
import { CategoryManagementView } from '../../components/modals/CategoryManagerModal';
import SubscriptionModal from '../../components/modals/SubscriptionModal';
import ClientActivityModal from '../../components/modals/ClientActivityModal';
import useListColumns from '../../hooks/useListColumns';
import usePersistentViewState from '../../hooks/usePersistentViewState';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../../lib/password';

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.message || fallback;
}

function getSubscriptionState(sub) {
  if (!sub) return 'none';
  const now = new Date();
  const exp = new Date(sub.expires);
  const days = (exp - now) / 864e5;
  if (sub.status === 'trial') return 'trial';
  if (days > 0 && days <= 15) return 'expiring';
  if (days > 0) return 'active';
  if (days > -15) return 'grace';
  return 'expired';
}

const SUBSCRIPTION_STATE_LABELS = {
  all: 'Todas las suscripciones',
  none: 'Sin suscripción',
  trial: 'Prueba 15d',
  active: 'Activa',
  expiring: 'Vence pronto',
  grace: 'Cortesía 15d',
  expired: 'Caducada',
};

const SUBSCRIPTION_STATE_ORDER = {
  none: 0,
  trial: 1,
  active: 2,
  expiring: 3,
  grace: 4,
  expired: 5,
};

function DashboardMetricCard({ value, label, helpText }) {
  return (
    <MetricCard
      value={value}
      label={label}
      helpText={helpText}
      className="sp-dash-metric min-h-[88px] rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)]"
      valueClassName="text-[1.8rem] font-black leading-none text-[var(--ac)]"
      labelClassName="mt-1 text-[.65rem] font-bold uppercase tracking-[0.05em] text-[var(--tx3)]"
    />
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

function formatRelativeDate(value) {
  if (!value) return 'Sin actividad reciente';
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return 'Sin actividad reciente';

  const diffMs = stamp - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  if (Math.abs(diffDays) >= 1) {
    return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(diffDays, 'day');
  }

  const diffHours = Math.round(diffMs / 3600000);
  if (Math.abs(diffHours) >= 1) {
    return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(diffHours, 'hour');
  }

  const diffMinutes = Math.round(diffMs / 60000);
  return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(diffMinutes || 0, 'minute');
}

function formatDurationCompact(value) {
  if (!value) return 'Sin tiempo';
  const totalSeconds = Math.max(1, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

function getToneVariant(tone) {
  if (tone === 'green') return 'green';
  if (tone === 'red') return 'red';
  if (tone === 'amber') return 'amber';
  if (tone === 'blue') return 'blue';
  return 'default';
}

function StudentProgressPanel({ overview, loading, error, onOpenClient }) {
  const summary = overview?.summary;
  const students = overview?.students || [];
  const summaryHelpText = {
    'Con actividad': 'Muestra cuántos alumnos tienen al menos una actividad asignada frente al total de alumnos bajo seguimiento.',
    'Avance medio': 'Resume el porcentaje medio de pasos completados entre todos los alumnos con trabajo asignado.',
    'Precisión media': 'Indica el porcentaje medio de respuestas correctas registradas en las actividades ya realizadas.',
    'Requieren seguimiento': 'Cuenta los alumnos con baja finalización, baja precisión o actividad pendiente reciente para priorizar intervención.',
  };

  return (
    <DashboardPanel icon="📈" title="Progreso por alumno" className="specialist-progress-panel min-h-[312px]">
      {error && <Notice variant="error" className="mb-3">{error}</Notice>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : students.length === 0 ? (
        <Empty icon="🧭" title="Sin progreso todavía" subtitle="Asigna actividades a tus alumnos para empezar a ver su avance aquí." />
      ) : (
        <>
          <div className="specialist-progress-summary">
            {[
              ['Con actividad', `${summary?.studentsWithAssignments || 0}/${summary?.totalStudents || students.length}`],
              ['Avance medio', `${summary?.averageCompletionPercent || 0}%`],
              ['Precisión media', summary?.averageAccuracyPercent !== null && summary?.averageAccuracyPercent !== undefined ? `${summary.averageAccuracyPercent}%` : 'Sin datos'],
              ['Requieren seguimiento', String(summary?.attentionCount || 0)],
            ].map(([label, value]) => (
              <MetricCard
                key={label}
                value={value}
                label={label}
                helpText={summaryHelpText[label]}
                className="specialist-progress-summary__item"
                valueClassName="specialist-progress-summary__value"
                labelClassName="specialist-progress-summary__label"
              />
            ))}
          </div>

          <div className="specialist-progress-list">
            {students.slice(0, 5).map((student) => (
              <div key={student.clientId} className="specialist-progress-row">
                <div className="specialist-progress-row__main">
                  <div className="specialist-progress-row__head">
                    <div>
                      <p className="specialist-progress-row__title">{student.childName}</p>
                      <p className="specialist-progress-row__subtitle">
                        {student.tutorName || 'Sin tutor'}
                        {student.groupNames?.length ? ` · ${student.groupNames.join(', ')}` : ' · Sin grupo'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getToneVariant(student.status?.tone)}>{student.status?.label || 'Sin estado'}</Badge>
                      <Badge variant="blue">{student.stepStats?.percent || 0}% avance</Badge>
                      <Badge
                        variant={
                          student.responseStats?.accuracyPercent === null || student.responseStats?.accuracyPercent === undefined
                            ? 'default'
                            : student.responseStats.accuracyPercent >= 70
                              ? 'green'
                              : student.responseStats.accuracyPercent >= 50
                                ? 'amber'
                                : 'red'
                        }
                      >
                        {student.responseStats?.accuracyPercent === null || student.responseStats?.accuracyPercent === undefined
                          ? 'Sin precisión'
                          : `${student.responseStats.accuracyPercent}% acierto`}
                      </Badge>
                    </div>
                  </div>

                  <div className="specialist-progress-row__metrics">
                    <span>{student.assignmentStats?.completed || 0}/{student.assignmentStats?.total || 0} actividades completadas</span>
                    <span>{student.stepStats?.completed || 0}/{student.stepStats?.total || 0} pasos</span>
                    <span>{student.responseStats?.correct || 0} aciertos · {student.responseStats?.incorrect || 0} errores</span>
                    <span>Tiempo medio {formatDurationCompact(student.responseStats?.averageTimeMs)}</span>
                  </div>

                  <div className="specialist-progress-row__meta">
                    <span>{student.activity?.latestActivityTitle ? `Última actividad: ${student.activity.latestActivityTitle}` : 'Sin actividad iniciada'}</span>
                    <span>{student.activity?.currentPhaseLabel ? `Fase: ${student.activity.currentPhaseLabel}` : 'Sin fase activa'}</span>
                    <span>{formatRelativeDate(student.activity?.lastActivityAt)}</span>
                  </div>
                </div>

                <Button type="button" variant="secondary" onClick={() => onOpenClient({ id: student.clientId, childName: student.childName })}>
                  Ver detalle
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardPanel>
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

function Dashboard() {
  const navigate = useNavigate();
  const [onboardingState, setOnboardingState] = usePersistentViewState('specialist.dashboard.onboarding', {
    dismissed: false,
    snoozedUntil: null,
  });
  const [clients, setClients] = useState([]);
  const [activities, setActivities] = useState([]);
  const [groups, setGroups] = useState([]);
  const [progressOverview, setProgressOverview] = useState({ summary: null, students: [] });
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState('');
  const [progressClient, setProgressClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setProgressLoading(true);
      setProgressError('');

      const [clientsResult, activitiesResult, groupsResult, progressResult] = await Promise.allSettled([
        clientsApi.list(),
        activitiesApi.list(),
        groupsApi.list(),
        specialistsApi.studentProgress(),
      ]);

      if (cancelled) return;

      if (clientsResult.status === 'fulfilled') {
        setClients(clientsResult.value.data.data || []);
      } else {
        setClients([]);
      }

      if (activitiesResult.status === 'fulfilled') {
        setActivities(activitiesResult.value.data.data || []);
      } else {
        setActivities([]);
      }

      if (groupsResult.status === 'fulfilled') {
        setGroups(groupsResult.value.data.data || []);
      } else {
        setGroups([]);
      }

      if (progressResult.status === 'fulfilled') {
        setProgressOverview(progressResult.value.data.data || { summary: null, students: [] });
      } else {
        setProgressOverview({ summary: null, students: [] });
        setProgressError(getApiErrorMessage(progressResult.reason, 'No se pudo cargar el progreso por alumno.'));
      }

      setLoading(false);
      setProgressLoading(false);
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  const activeUsers = clients.filter(client => client.user?.active !== false).length;
  const inactiveUsers = clients.length - activeUsers;
  const latestClients = clients.slice(0, 3);
  const latestActivities = activities.slice(0, 3);
  const latestGroups = groups.slice(0, 3);
  const onboardingSteps = [
    {
      label: 'Crear tu primer alumno',
      description: 'Añade familia y alumno para empezar a asignar trabajo y seguir progreso.',
      done: clients.length > 0,
      onOpen: () => navigate('/specialist/clients'),
    },
    {
      label: 'Preparar una actividad',
      description: 'Crea una actividad con objetos y deja una asignación lista para usar.',
      done: activities.length > 0,
      onOpen: () => navigate('/specialist/activities'),
    },
    {
      label: 'Organizar grupos',
      description: 'Agrupa alumnos para simplificar asignaciones y seguimiento operativo.',
      done: groups.length > 0,
      onOpen: () => navigate('/specialist/groups'),
    },
  ];
  const shouldShowOnboarding = !onboardingState.dismissed
    && (!onboardingState.snoozedUntil || Date.now() > onboardingState.snoozedUntil)
    && onboardingSteps.some((step) => !step.done);

  return (
    <div className="animate-in space-y-5 specialist-dashboard-stack">
      <div>
        <h1 className="text-2xl font-black">Panel del especialista</h1>
      </div>

      {shouldShowOnboarding && (
        <OnboardingPanel
          title="Primeros pasos para especialista"
          subtitle="Este recorrido cubre la configuración mínima para poder trabajar con alumnos sin ayuda externa."
          steps={onboardingSteps}
          onSnooze={() => setOnboardingState({ snoozedUntil: Date.now() + (12 * 60 * 60 * 1000) })}
          onDismiss={() => setOnboardingState({ dismissed: true, snoozedUntil: null })}
        />
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 specialist-dashboard-metrics">
        <DashboardMetricCard value={clients.length} label="Alumnos" />
        <DashboardMetricCard value={activities.length} label="Actividades" />
        <DashboardMetricCard value={groups.length} label="Grupos" />
        <DashboardMetricCard value={activeUsers} label="Usuarios activos" />
      </div>

      <StudentProgressPanel
        overview={progressOverview}
        loading={progressLoading}
        error={progressError}
        onOpenClient={setProgressClient}
      />

      <div className="grid gap-4 xl:grid-cols-2 specialist-dashboard-sections">
        <DashboardPanel icon="👶" title="Alumnos" className="min-h-[248px]">
          {latestClients.length === 0 ? <Empty icon="👶" title="Sin alumnos" subtitle="Crea tu primer cliente para empezar." action={<Button onClick={() => window.location.assign('/specialist/clients')}>Ir a clientes</Button>} /> : (
            <div className="space-y-3">
              {latestClients.map(client => (
                <div key={client.id} className="sp-dash-list-card rounded-[var(--r)] border border-[var(--bd)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{client.childName}</p>
                      <p className="truncate text-xs text-[var(--tx2)]">{client.user?.name || 'Sin tutor'}</p>
                    </div>
                    <Badge variant={client.user?.active !== false ? 'green' : 'red'}>{client.user?.active !== false ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--tx3)]">{client.groups?.length ? client.groups.map(group => group.name).join(', ') : 'Sin grupos'}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel icon="📋" title="Actividades creadas" className="min-h-[248px]">
          {latestActivities.length === 0 ? <Empty icon="📋" title="Sin actividades" subtitle="Las actividades que crees aparecerán aquí." action={<Button onClick={() => window.location.assign('/specialist/activities')}>Crear actividad</Button>} /> : (
            <div className="space-y-3">
              {latestActivities.map(activity => (
                <div key={activity.id} className="sp-dash-list-card rounded-[var(--r)] border border-[var(--bd)]">
                  <p className="text-sm font-bold">{activity.title}</p>
                  <p className="text-xs text-[var(--tx2)]">{activity.activityObjects?.length || 0} objetos</p>
                  <p className="text-[11px] text-[var(--tx3)]">{activity.assignments?.length || 0} clientes asignados</p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel icon="👥" title="Grupos" className="min-h-[248px]">
          {latestGroups.length === 0 ? <Empty icon="👥" title="Sin grupos" subtitle="Usa grupos para asignar actividades a varios alumnos." action={<Button onClick={() => window.location.assign('/specialist/groups')}>Crear grupo</Button>} /> : (
            <div className="space-y-3">
              {latestGroups.map(group => (
                <div key={group.id} className="sp-dash-list-card rounded-[var(--r)] border border-[var(--bd)]" style={{ borderLeftWidth: 4, borderLeftColor: group.color }}>
                  <p className="text-sm font-bold">{group.name}</p>
                  <p className="text-xs text-[var(--tx2)]">{group.clients?.length || 0} alumnos</p>
                  <p className="text-[11px] text-[var(--tx3)]">{group.clients?.length ? group.clients.map(client => client.childName).join(', ') : 'Sin miembros'}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel icon="📈" title="Usuarios activos" className="min-h-[248px]">
          <div className="divide-y divide-[var(--bd)]/80">
            {[
              ['Activos', activeUsers, 'green'],
              ['Inactivos', inactiveUsers, 'red'],
              ['Total alumnos', clients.length, 'blue'],
            ].map(([label, value, variant]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <Badge variant={variant}>{label}</Badge>
                <span className="text-2xl font-black text-[var(--tx)]">{value}</span>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>

      <ClientActivityModal client={progressClient} open={!!progressClient} onClose={() => setProgressClient(null)} />
    </div>
  );
}

/* ── Clients page ──────────────────────────────────────────────────────── */
function Clients() {
  const [clients,  setClients]  = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [viewState, setViewState] = usePersistentViewState('specialist.clients.filters', {
    search: '',
    groupFilter: 'all',
    subscriptionFilter: 'all',
    sortBy: 'name',
    page: 1,
  });
  const [search,   setSearch]   = useState(viewState.search);
  const [columnCount, setColumnCount] = useListColumns('specialist.clients', 1);
  const [groupFilter, setGroupFilter] = useState(viewState.groupFilter);
  const [subscriptionFilter, setSubscriptionFilter] = useState(viewState.subscriptionFilter);
  const [sortBy, setSortBy] = useState(viewState.sortBy);
  const [page, setPage] = useState(viewState.page);
  const [modal,    setModal]    = useState(null); // null | 'new' | client obj
  const [activityClient, setActivityClient] = useState(null);
  const [delId,    setDelId]    = useState(null);
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [subTarget, setSubTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActivityId, setBulkActivityId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pageFeedback, setPageFeedback] = useState(null);
  const passwordError = getPasswordStrengthError(form.password || '', { required: modal === 'new' });
  const passwordConfirmError = (form.password || '') && form.password !== form.confirm_password
    ? 'Las contrasenas no coinciden.'
    : '';

  useEffect(() => {
    Promise.all([clientsApi.list(), groupsApi.list(), activitiesApi.list()])
      .then(([cr, gr, ar]) => {
        setClients(cr.data.data);
        setGroups(gr.data.data);
        setActivities(ar.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setViewState({ search, groupFilter, subscriptionFilter, sortBy, page });
  }, [groupFilter, page, search, setViewState, sortBy, subscriptionFilter]);

  const openNew  = ()  => { setForm({ name:'', email:'', child_name:'', age:'', group_ids:[], password:'', confirm_password:'' }); setFeedback(null); setModal('new'); };
  const openEdit = (c) => { setForm({ name: c.user?.name, email: c.user?.email, child_name: c.childName, diagnosis_notes: c.diagnosisNotes, group_ids: c.groups?.map(group => group.id) || [], password:'', confirm_password:'' }); setFeedback(null); setModal(c); };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (modal === 'new') {
        const r = await clientsApi.create(form);
        setClients(p => [...p, r.data.data]);
        setFeedback({ type: 'success', message: 'Cliente creado correctamente.' });
      } else {
        const r = await clientsApi.update(modal.id, form);
        setClients(p => p.map(c => c.id === modal.id ? r.data.data : c));
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

  const del = async () => {
    await clientsApi.delete(delId);
    setClients(p => p.filter(c => c.id !== delId));
    setSelectedIds(p => p.filter(id => id !== delId));
    setDelId(null);
  };

  const handleToggleClient = (clientId) => {
    setSelectedIds((current) => current.includes(clientId)
      ? current.filter((id) => id !== clientId)
      : [...current, clientId]);
  };

  const handleToggleVisibleClients = () => {
    const visibleIds = visibleClients.map((client) => client.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const handleBulkAssign = async () => {
    if (!bulkActivityId || selectedIds.length === 0) return;

    setBulkBusy(true);
    setPageFeedback(null);
    try {
      await assignmentsApi.bulk({
        activity_id: bulkActivityId,
        client_ids: selectedIds,
        assign_all: false,
      });
      const refreshed = await activitiesApi.list();
      setActivities(refreshed.data.data);
      setSelectedIds([]);
      setBulkActivityId('');
      setPageFeedback({ type: 'success', message: 'Actividad asignada a los clientes seleccionados.' });
    } catch (error) {
      setPageFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo asignar la actividad seleccionada.') });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;

    setBulkBusy(true);
    setPageFeedback(null);
    try {
      await Promise.all(selectedIds.map((id) => clientsApi.delete(id)));
      setClients((current) => current.filter((client) => !selectedIds.includes(client.id)));
      setSelectedIds([]);
      setPageFeedback({ type: 'success', message: 'Clientes desactivados correctamente.' });
    } catch (error) {
      setPageFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudieron desactivar los clientes seleccionados.') });
    } finally {
      setBulkBusy(false);
    }
  };

  const getClientGroupLabel = (client) => {
    const names = (client.groups || []).map(group => group.name).sort((left, right) => left.localeCompare(right, 'es'));
    return names[0] || 'Sin grupo';
  };

  const filtered = [...clients]
    .filter((client) => {
      const matchesSearch = !search || (client.childName + (client.user?.name || '')).toLowerCase().includes(search.toLowerCase());
      const matchesGroup = groupFilter === 'all'
        || (groupFilter === 'none' ? !(client.groups || []).length : (client.groups || []).some(group => group.id === groupFilter));
      const matchesSubscription = subscriptionFilter === 'all' || getSubscriptionState(client.subscription) === subscriptionFilter;
      return matchesSearch && matchesGroup && matchesSubscription;
    })
    .sort((left, right) => {
      if (sortBy === 'group') {
        return getClientGroupLabel(left).localeCompare(getClientGroupLabel(right), 'es');
      }
      if (sortBy === 'subscription') {
        const stateDiff = SUBSCRIPTION_STATE_ORDER[getSubscriptionState(left.subscription)] - SUBSCRIPTION_STATE_ORDER[getSubscriptionState(right.subscription)];
        if (stateDiff !== 0) return stateDiff;
      }
      return (left.childName || '').localeCompare(right.childName || '', 'es');
    });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleClients = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allVisibleSelected = visibleClients.length > 0 && visibleClients.every((client) => selectedIds.includes(client.id));

  useEffect(() => {
    setPage(1);
  }, [search, groupFilter, subscriptionFilter, sortBy]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => clients.some((client) => client.id === id)));
  }, [clients]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const renderClientGroups = (client) => {
    if (!client?.groups?.length) return <p className="text-xs text-[var(--tx3)]">Sin grupos</p>;

    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {client.groups.map(group => (
          <span
            key={group.id}
            className="clients-group-chip inline-flex items-center rounded-full border text-[11px] font-bold"
            style={{ borderColor: group.color, backgroundColor: `${group.color}1A`, color: 'var(--tx2)' }}
          >
            {group.name}
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Mis clientes"
        count={`${filtered.length}/${clients.length}`}
        subtitle="Seguimiento de alumnos, tutor, grupos y estado de acceso."
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
            <Select value={sortBy} onChange={e => setSortBy(e.target.value)} className="search-filter-select clients-filter-select !w-auto text-sm">
              <option value="name">Ordenar: nombre</option>
              <option value="group">Ordenar: grupo</option>
              <option value="subscription">Ordenar: suscripción</option>
            </Select>
            <Select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="search-filter-select clients-filter-select !w-auto text-sm">
              <option value="all">Todos los grupos</option>
              <option value="none">Sin grupo</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </Select>
            <Select value={subscriptionFilter} onChange={e => setSubscriptionFilter(e.target.value)} className="search-filter-select clients-filter-select !w-auto text-sm">
              {Object.entries(SUBSCRIPTION_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Badge className="search-visible-badge clients-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />
      {pageFeedback && <Notice variant={pageFeedback.type} className="mb-3">{pageFeedback.message}</Notice>}
      {filtered.length > 0 && (
        <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--tx2)]">
            <input type="checkbox" checked={allVisibleSelected} onChange={handleToggleVisibleClients} />
            Seleccionar visibles
          </label>
          <Badge className="search-visible-badge clients-visible-badge" variant="blue">{selectedIds.length} seleccionados</Badge>
          <Select aria-label="Asignar actividad a clientes seleccionados" value={bulkActivityId} onChange={e => setBulkActivityId(e.target.value)} className="search-filter-select clients-filter-select !w-auto min-w-[220px] text-sm">
            <option value="">Asignar actividad...</option>
            {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
          </Select>
          <Button size="sm" onClick={handleBulkAssign} disabled={bulkBusy || !bulkActivityId || selectedIds.length === 0}>Asignar a selección</Button>
          <Button size="sm" variant="danger" onClick={handleBulkDeactivate} disabled={bulkBusy || selectedIds.length === 0}>Desactivar selección</Button>
        </Card>
      )}
      {filtered.length === 0 ? <Empty icon="👶" title="Sin clientes" subtitle="Añade tu primer alumno" action={<Button onClick={openNew}>Crear alumno</Button>} /> :
        <ListCollection className="clients-list-shell">
          <ListGrid columns={columnCount}>
          {visibleClients.map(c => (
            <ListRow
              key={c.id}
              className="clients-list-row"
              avatar={<div className="flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleToggleClient(c.id)} aria-label={`Seleccionar ${c.childName || 'cliente'}`} /><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ac)] text-xs font-black text-white">{(c.childName || '?').slice(0, 2).toUpperCase()}</div></div>}
              title={c.childName}
              subtitle={c.user?.name}
              meta={renderClientGroups(c)}
              badges={<span className="cursor-pointer" onClick={() => setSubTarget({ entity: c, type: 'client' })}><SubBadge sub={c.subscription} className="clients-item-badge" /></span>}
              actions={(
                <>
                  <IconButton icon="💳" label="Gestionar suscripción" variant="secondary" className="clients-action-btn" onClick={() => setSubTarget({ entity: c, type: 'client' })} />
                  <IconButton icon="🎯" label="Actividades y progreso" variant="primary" className="clients-action-btn client-activity-launch-btn" onClick={() => setActivityClient(c)} />
                  <ActionIconButton className="clients-action-btn" onClick={() => openEdit(c)} />
                  <ActionIconButton action="delete" className="clients-action-btn" onClick={() => setDelId(c.id)} />
                </>
              )}
            />
          ))}
          </ListGrid>
        </ListCollection>
      }
      {filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--tx3)]">
            Mostrando {filtered.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="clients-action-btn" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Anterior</Button>
            <Badge className="search-visible-badge clients-visible-badge" variant="blue">Página {currentPage} de {totalPages}</Badge>
            <Button size="sm" variant="secondary" className="clients-action-btn" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Siguiente</Button>
          </div>
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo cliente' : 'Editar cliente'} maxWidth={640} className="client-form-modal">
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="client-form-body">
          <div className="client-form-grid grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nombre tutor"   value={form.name||''}        onChange={e=>setForm({...form,name:e.target.value})}       />
            <Input label="Nombre alumno"  value={form.child_name||''}  onChange={e=>setForm({...form,child_name:e.target.value})} />
            <Input label="Email"          value={form.email||''}       onChange={e=>setForm({...form,email:e.target.value})}      />
            <Input
              label={modal === 'new' ? 'Contraseña' : 'Nueva contraseña'}
              type="password"
              value={form.password||''}
              error={passwordError || undefined}
              placeholder={modal === 'new' ? '' : 'Déjala vacía para no cambiarla'}
              onChange={e=>setForm({...form,password:e.target.value})}
            />
            <Input
              label={modal === 'new' ? 'Confirmar contraseña' : 'Confirmar nueva contraseña'}
              type="password"
              value={form.confirm_password||''}
              error={passwordConfirmError || undefined}
              placeholder={modal === 'new' ? '' : 'Repítela solo si vas a cambiarla'}
              onChange={e=>setForm({...form,confirm_password:e.target.value})}
            />
          </div>
          <p className="client-form-hint text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
          <div className="client-form-section"><Textarea label="Notas clínicas" rows={2} value={form.diagnosis_notes||''} onChange={e=>setForm({...form,diagnosis_notes:e.target.value})} /></div>
          <div className="client-form-section">
          <p className="mb-2 text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Grupos</p>
          <div className="client-form-groups max-h-40 overflow-y-auto rounded-[var(--r)] border border-[var(--bd)]">
            {groups.map(group => (
              <label key={group.id} className="client-form-group-row flex cursor-pointer items-center gap-2 border-b border-[var(--bd)] p-2 last:border-0 hover:bg-[var(--acb)]">
                <input
                  type="checkbox"
                  checked={(form.group_ids || []).includes(group.id)}
                  onChange={() => setForm(current => ({
                    ...current,
                    group_ids: (current.group_ids || []).includes(group.id)
                      ? current.group_ids.filter(id => id !== group.id)
                      : [...(current.group_ids || []), group.id],
                  }))}
                />
                <span className="text-sm font-bold">{group.name}</span>
              </label>
            ))}
            {groups.length === 0 && <p className="client-form-group-empty p-3 text-sm text-[var(--tx3)]">No hay grupos disponibles.</p>}
          </div>
          </div>
          <div className="client-form-actions flex gap-2 justify-end mt-4">
            <Button variant="secondary" className="clients-action-btn" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
            <Button className="clients-action-btn" disabled={saving || !form.child_name || !form.email || !!passwordError || !!passwordConfirmError} onClick={save}>{saving ? 'Guardando...' : modal === 'new' ? 'Crear' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el cliente y sus asignaciones." onConfirm={del} onCancel={() => setDelId(null)} />
      <ClientActivityModal client={activityClient} open={!!activityClient} onClose={() => setActivityClient(null)} />
      {subTarget && <SubscriptionModal entity={subTarget.entity} entityType={subTarget.type} onClose={() => setSubTarget(null)} onSave={() => { clientsApi.list().then(r => setClients(r.data.data)); setSubTarget(null); }} />}
    </div>
  );
}

/* ── Activities page ───────────────────────────────────────────────────── */
function Activities() {
  const [acts,     setActs]    = useState([]);
  const [clients,  setClients] = useState([]);
  const [groups,   setGroups]  = useState([]);
  const [objects,  setObjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [viewState, setViewState] = usePersistentViewState('specialist.activities.filters', {
    search: '',
    statusFilter: 'all',
    clientFilter: 'all',
  });
  const [search,   setSearch]  = useState(viewState.search);
  const [columnCount, setColumnCount] = useListColumns('specialist.activities', 1);
  const [statusFilter, setStatusFilter] = useState(viewState.statusFilter);
  const [clientFilter, setClientFilter] = useState(viewState.clientFilter);
  const [modal,    setModal]   = useState(false);
  const [editAct,  setEditAct] = useState(null);
  const [delId,    setDelId]   = useState(null);
  const [cat, setCat] = useState('all');
  const [objectSearch, setObjectSearch] = useState('');
  const [form,     setForm]    = useState({ title:'', instructions:'', selObjs:[], assignMode:'all', selClients:[], selGroups:[] });
  const [saving,   setSaving]  = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pageFeedback, setPageFeedback] = useState(null);

  const getAudience = (activity) => activity?.audience || null;
  const getAssignedClientIds = (activity) => [...new Set((activity.assignments || []).map(assignment => assignment.clientId))];
  const getAssignmentSummary = (activity) => {
    const audience = getAudience(activity);
    if (audience?.mode === 'all') {
      return 'Todos los usuarios';
    }
    if (audience?.mode === 'groups') {
      const matchedGroups = groups.filter(group => (audience.groupIds || []).includes(group.id));
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
    if (assignedClientIds.length && clients.length && assignedClientIds.length === clients.length) {
      return 'Todos los clientes';
    }
    return `${assignedClientIds.length} clientes asignados`;
  };

  const getAssignmentDetail = (activity) => {
    const audience = getAudience(activity);
    if (audience?.mode === 'all') {
      return 'Destino: todos los usuarios';
    }
    if (audience?.mode === 'groups') {
      const matchedGroups = groups.filter(group => (audience.groupIds || []).includes(group.id));
      if (matchedGroups.length) {
        return `Destino: ${matchedGroups.map(group => group.name).join(', ')}`;
      }
      return 'Destino: grupos';
    }
    if (audience?.mode === 'clients') {
      const matchedClients = clients.filter(client => (audience.clientIds || []).includes(client.id));
      if (matchedClients.length) {
        return `Destino: ${matchedClients.slice(0, 3).map(client => client.childName).join(', ')}${matchedClients.length > 3 ? '…' : ''}`;
      }
      return 'Destino: clientes individuales';
    }
    return 'Destino: asignación heredada';
  };

  useEffect(() => {
    Promise.all([activitiesApi.list(), clientsApi.list(), groupsApi.list(), objectsApi.list(), categoriesApi.list()])
      .then(([a,c,g,o,catr]) => {
        setActs(a.data.data);
        setClients(c.data.data);
        setGroups(g.data.data);
        setObjects(o.data.data);
        setCategories(catr.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setViewState({ search, statusFilter, clientFilter });
  }, [clientFilter, search, setViewState, statusFilter]);

  const openNew  = () => {
    setEditAct(null);
    setForm({ title:'', instructions:'', selObjs:[], assignMode:'all', selClients:[], selGroups:[] });
    setCat('all');
    setObjectSearch('');
    setFeedback(null);
    setModal(true);
  };
  const openEdit = a  => {
    const assignedClientIds = getAssignedClientIds(a);
    const audience = getAudience(a);
    const assignMode = audience?.mode || (assignedClientIds.length && clients.length && assignedClientIds.length === clients.length ? 'all' : 'clients');
    setEditAct(a);
    setForm({
      title: a.title,
      instructions: a.instructions || '',
      selObjs: a.activityObjects?.map(ao=>ao.objectId)||[],
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
      const payload = { title: form.title, instructions: form.instructions, objects: form.selObjs.map((id,i)=>({ object_id:id, sort_order:i })) };
      if (editAct) {
        await activitiesApi.update(editAct.id, payload);
        await assignmentsApi.bulk({
          activity_id: editAct.id,
          assign_all: form.assignMode === 'all',
          client_ids: form.assignMode === 'clients' ? form.selClients : [],
          group_ids:  form.assignMode === 'groups'  ? form.selGroups  : [],
          replace_existing: true,
        });
        setFeedback({ type: 'success', message: 'Actividad actualizada y reasignada correctamente.' });
      } else {
        const r = await activitiesApi.create(payload);
        const newAct = r.data.data;
        await assignmentsApi.bulk({
          activity_id: newAct.id,
          assign_all: form.assignMode === 'all',
          client_ids: form.assignMode === 'clients' ? form.selClients : [],
          group_ids:  form.assignMode === 'groups'  ? form.selGroups  : [],
        });
        setFeedback({ type: 'success', message: 'Actividad creada y asignada correctamente.' });
      }
      const refreshed = await activitiesApi.list();
      setActs(refreshed.data.data);
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

  const del = async () => { await activitiesApi.delete(delId); setActs(p=>p.filter(a=>a.id!==delId)); setDelId(null); };
  const normalizedObjectSearch = objectSearch.trim().toLowerCase();
  const hasUncategorizedObjects = objects.some((object) => !object.categoryId);
  const visObjs = objects.filter((object) => {
    const matchesCategory = cat === 'all'
      || (cat === 'uncategorized' ? !object.categoryId : object.categoryId === cat);
    const matchesSearch = !normalizedObjectSearch || object.name.toLowerCase().includes(normalizedObjectSearch);
    return matchesCategory && matchesSearch;
  });
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = acts.filter((activity) => {
    const matchesSearch = !normalizedSearch || activity.title.toLowerCase().includes(normalizedSearch);
    const relevantAssignments = (activity.assignments || []).filter((assignment) => clientFilter === 'all' || assignment.clientId === clientFilter);
    const matchesClient = clientFilter === 'all' || relevantAssignments.length > 0;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'pending' && relevantAssignments.some((assignment) => !assignment.completedAt))
      || (statusFilter === 'completed' && relevantAssignments.some((assignment) => Boolean(assignment.completedAt)));
    return matchesSearch && matchesClient && matchesStatus;
  });

  const handleToggleActivity = (activityId) => {
    setSelectedIds((current) => current.includes(activityId)
      ? current.filter((id) => id !== activityId)
      : [...current, activityId]);
  };

  const handleAssignSelectionToAll = async () => {
    if (selectedIds.length === 0) return;

    setBulkBusy(true);
    setPageFeedback(null);
    try {
      await Promise.all(selectedIds.map((activityId) => assignmentsApi.bulk({
        activity_id: activityId,
        assign_all: true,
        replace_existing: true,
      })));
      const refreshed = await activitiesApi.list();
      setActs(refreshed.data.data);
      setSelectedIds([]);
      setPageFeedback({ type: 'success', message: 'Actividades reasignadas a todos tus clientes.' });
    } catch (error) {
      setPageFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudieron reasignar las actividades seleccionadas.') });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    setBulkBusy(true);
    setPageFeedback(null);
    try {
      await Promise.all(selectedIds.map((activityId) => activitiesApi.delete(activityId)));
      setActs((current) => current.filter((activity) => !selectedIds.includes(activity.id)));
      setSelectedIds([]);
      setPageFeedback({ type: 'success', message: 'Actividades eliminadas correctamente.' });
    } catch (error) {
      setPageFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudieron eliminar las actividades seleccionadas.') });
    } finally {
      setBulkBusy(false);
    }
  };

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => acts.some((activity) => activity.id === id)));
  }, [acts]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Actividades"
        count={`${filtered.length}/${acts.length}`}
        subtitle="Tus actividades, objetos incluidos y destino de asignación activo."
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
            <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option value="all">Todos los clientes</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.childName}</option>)}
            </Select>
            <Badge className="search-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />
      {pageFeedback && <Notice variant={pageFeedback.type} className="mb-3">{pageFeedback.message}</Notice>}
      {filtered.length > 0 && (
        <Card className="mb-3 flex flex-wrap items-center gap-2 p-3">
          <Badge className="search-visible-badge" variant="blue">{selectedIds.length} seleccionadas</Badge>
          <Button size="sm" onClick={handleAssignSelectionToAll} disabled={bulkBusy || selectedIds.length === 0}>Asignar selección a todos</Button>
          <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={bulkBusy || selectedIds.length === 0}>Eliminar selección</Button>
        </Card>
      )}
      {filtered.length === 0 ? <Empty icon="📋" title="Sin actividades" subtitle="Crea tu primera actividad para poder asignarla a tus alumnos." action={<Button onClick={openNew}>Crear actividad</Button>} /> :
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
          {filtered.map(a => (
            <ListRow
              key={a.id}
              className="entity-list-row"
              avatar={<div className="flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => handleToggleActivity(a.id)} aria-label={`Seleccionar ${a.title || 'actividad'}`} /><div className="flex min-h-11 min-w-11 items-center justify-center rounded-[16px] bg-[var(--bg2)] px-2 text-lg">{a.activityObjects?.slice(0, 4).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div></div>}
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
        <Input label="Título" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mb-3" placeholder="Ej: Animales del campo" />
        <div className="mb-4">
          <Textarea label="Instrucciones" rows={2} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Describe la actividad para el alumno y la familia" />
        </div>
        <div className="activity-section mb-4">
          <div className="activity-object-toolbar">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Objetos</p>
              <Badge className="entity-item-badge" variant="blue">{form.selObjs.length} seleccionados</Badge>
            </div>
            <Badge className="entity-item-badge" variant="default">{visObjs.length} visibles</Badge>
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
            {visObjs.length === 0 ? (
              <p className="modal-note text-sm text-[var(--tx3)]">No hay objetos que coincidan con la búsqueda o la categoría seleccionada.</p>
            ) : (
              <div className="activity-object-grid">
                {visObjs.map((object) => {
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
            {[['all','🌐','Todos los usuarios'],['clients','👤','Clientes'],['groups','👥','Grupos']].map(([m,ic,lb])=>(
              <button
                key={m}
                type="button"
                onClick={()=>setForm({...form,assignMode:m})}
                className={`modal-choice activity-assignment-card ${form.assignMode===m?'is-selected':''}`}
              >
                <div className="activity-assignment-card__icon">{ic}</div>
                <div className="activity-assignment-card__label">{lb}</div>
              </button>
            ))}
          </div>
        </div>
        {editAct && <p className="mb-3 text-xs text-[var(--tx3)]">Guardar actualizará también los destinatarios activos de esta actividad.</p>}
        {form.assignMode==='clients' && (
          <div className="modal-list-panel border border-[var(--bd)] rounded-[var(--r)] max-h-40 overflow-y-auto mb-3">
            {clients.map(c=>(
              <label key={c.id} className="modal-list-row flex items-center gap-3 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                <input type="checkbox" checked={form.selClients.includes(c.id)} onChange={()=>setForm(f=>({...f,selClients:f.selClients.includes(c.id)?f.selClients.filter(x=>x!==c.id):[...f.selClients,c.id]}))} />
                <span className="text-sm font-bold">{c.childName}</span>
                <span className="text-xs text-[var(--tx3)]">{c.user?.name}</span>
              </label>
            ))}
            {clients.length === 0 && <p className="modal-list-row text-sm text-[var(--tx3)]">No hay clientes disponibles.</p>}
          </div>
        )}
        {form.assignMode==='groups' && (
          <div className="flex flex-wrap gap-2 mb-3">
            {groups.map(g=>(
              <div key={g.id} onClick={()=>setForm(f=>({...f,selGroups:f.selGroups.includes(g.id)?f.selGroups.filter(x=>x!==g.id):[...f.selGroups,g.id]}))}
                className={`modal-chip rounded-full border-2 cursor-pointer text-xs font-bold ${form.selGroups.includes(g.id)?'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]':'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}>
                {g.name} ({g.clients?.length||0})
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-[var(--tx3)]">No hay grupos disponibles.</p>}
          </div>
        )}
        <div className="modal-actions flex gap-2 justify-end mt-2">
          <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.title || form.selObjs.length === 0 || (form.assignMode === 'clients' && form.selClients.length === 0) || (form.assignMode === 'groups' && form.selGroups.length === 0)} onClick={save}>{saving ? 'Guardando...' : editAct ? 'Guardar y reasignar' : 'Crear y asignar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará la actividad." onConfirm={del} onCancel={() => setDelId(null)} />
    </div>
  );
}

/* ── Objects page ──────────────────────────────────────────────────────── */
function Objects() {
  const currentUser = useAuthStore(state => state.user);
  const [objects,  setObjects]  = useState([]);
  const [cats,     setCats]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [catF,     setCatF]     = useState('Todos');
  const [columnCount, setColumnCount] = useListColumns('specialist.objects', 1);
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
    setSaving(false);
    setFeedback(null);
    setEditObj(null);
    setForm(emptyForm);
    setModal(false);
  };

  const getRepresentation = (object, level) => object.representations?.find(rep => rep.level === level);
  const repDraftKey = (objectId, level) => `${objectId}:${level}`;
  const apiLevelFor = (level) => ({ model_3d: '1', photo: '2', drawing: '3' }[level]);
  const canManageObject = (object) => Boolean(object?.ownerId && object.ownerId === currentUser?.id);
  const isReadOnlyObject = Boolean(editObj && !canManageObject(editObj));

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
    if (!canManageObject(object)) {
      return;
    }

    const model3d = getRepresentation(object, 'model_3d');
    const photo = getRepresentation(object, 'photo');
    const drawing = getRepresentation(object, 'drawing');

    setEditObj(object);
    setFeedback(null);
    setForm({
      name: object.name,
      category_id: object.categoryId,
      em: object.em,
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

  const save = async () => {
    if (editObj && !canManageObject(editObj)) {
      setFeedback({ type: 'error', message: 'Los objetos públicos del catálogo son de solo lectura para especialistas.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        name: form.name,
        category_id: form.category_id,
        em: form.em,
      };

      const response = editObj
        ? await objectsApi.update(editObj.id, payload)
        : await objectsApi.create(payload);

      const objectId = response.data.data.id;

      if (form.model3d.trim()) {
        await objectsApi.setModel3d(objectId, '1', form.model3d.trim());
      }
      if (form.photoFile) {
        const formData = new FormData();
        formData.append('file', form.photoFile);
        formData.append('level', '2');
        await objectsApi.uploadRepresentation(objectId, formData);
      }
      if (form.drawingFile) {
        const formData = new FormData();
        formData.append('file', form.drawingFile);
        formData.append('level', '3');
        await objectsApi.uploadRepresentation(objectId, formData);
      }

      const refreshed = await objectsApi.get(objectId);
      setObjects(prev => {
        const next = prev.filter(object => object.id !== objectId);
        return [refreshed.data.data, ...next];
      });
      closeModal();
    } catch (error) {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'No se pudo guardar el objeto.') });
      setSaving(false);
    }
  };

  const del = async () => { await objectsApi.delete(delId); setObjects(p=>p.filter(o=>o.id!==delId)); setDelId(null); };

  const uploadRep = async (objId, level, file) => {
    const object = objects.find((item) => item.id === objId);
    if (!canManageObject(object)) {
      setFeedback({ type: 'error', message: 'Solo puedes subir archivos en objetos privados creados por ti.' });
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('level', level);
    await objectsApi.uploadRepresentation(objId, fd);
    await refreshObject(objId);
  };

  const saveRepUrl = async (objectId) => {
    const object = objects.find((item) => item.id === objectId);
    if (!canManageObject(object)) {
      setFeedback({ type: 'error', message: 'Solo puedes editar representaciones de objetos privados creados por ti.' });
      return;
    }

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

  const deleteRep = async (objectId, level) => {
    const object = objects.find((item) => item.id === objectId);
    if (!canManageObject(object)) {
      setFeedback({ type: 'error', message: 'Solo puedes eliminar representaciones de objetos privados creados por ti.' });
      return;
    }

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

  const filtered = objects.filter(o =>
    (catF === 'Todos' || o.category?.name === catF) &&
    (!search || o.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Objetos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="entity-action-btn" onClick={openNew}>+ Nuevo objeto</Button>
        </div>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="🔍 Buscar objeto..."
        fieldClassName="entity-search-field"
        inputClassName="entity-search-input"
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={catF} onChange={e=>setCatF(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option>Todos</option>
              {cats.map(c=><option key={c.id}>{c.name}</option>)}
            </Select>
            <Badge className="search-visible-badge" variant="default">{filtered.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        }
      />
      {filtered.length === 0 ? <Empty icon="📦" title="Sin objetos" subtitle="Añade tu primer objeto" action={<Button onClick={openNew}>Crear objeto</Button>} /> : <ListCollection className="entity-list-shell"><ListGrid columns={columnCount}>
        {filtered.map(o => {
          const reps = o.representations || [];
          const has3d = reps.some(r=>r.level==='model_3d');
          const hasPhoto = reps.some(r=>r.level==='photo');
          const hasDraw  = reps.some(r=>r.level==='drawing');
          const canManage = canManageObject(o);
          return (
            <div key={o.id} className={`bg-[var(--sf)] border-2 rounded-[var(--rl)] overflow-hidden transition-colors ${expanded===o.id?'border-[var(--ac)]':'border-[var(--bd)]'}`}>
              <div className="object-card entity-list-row cursor-pointer" onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
                <div className="object-card__row object-card__row--top">
                  <div className="object-card__title">
                    <span className="object-card__emoji text-2xl">{o.em}</span>
                    <div className="object-card__title-copy">
                      <p className="font-bold text-sm">{o.name}</p>
                    </div>
                  </div>
                  <div className="object-card__badges">
                    <Badge className="entity-item-badge" variant={has3d?'green':'amber'}>🧊 {has3d?'✓':'✗'}</Badge>
                    <Badge className="entity-item-badge" variant={hasPhoto?'green':'amber'}>📷 {hasPhoto?'✓':'✗'}</Badge>
                    <Badge className="entity-item-badge" variant={hasDraw?'green':'amber'}>📝 {hasDraw?'✓':'✗'}</Badge>
                  </div>
                </div>

                <div className="object-card__row object-card__row--meta">
                  <div className="object-card__meta-main">
                    {renderCategoryChip(o.category)}
                    <Badge className="entity-item-badge" variant={o.ownerId ? 'default' : 'green'}>{o.ownerId ? 'Privado' : 'Público'}</Badge>
                  </div>
                  <div className="object-card__actions">
                    {canManage ? (
                      <>
                        <ActionIconButton className="entity-action-btn" onClick={e=>{e.stopPropagation();openEdit(o);}} />
                        <ActionIconButton action="delete" className="entity-action-btn" onClick={e=>{e.stopPropagation();setDelId(o.id);}} />
                      </>
                    ) : (
                      <Badge className="entity-item-badge" variant="blue">Solo lectura</Badge>
                    )}
                  </div>
                </div>
              </div>
              {expanded===o.id && (
                <div className="border-t border-[var(--bd)] p-4 grid gap-4 xl:grid-cols-3">
                  {[['model_3d','🧊 Nivel 1','1'],['photo','📷 Nivel 2','2'],['drawing','📝 Nivel 3','3']].map(([lvl,label,n])=>{
                    const rep = reps.find(r=>r.level===lvl);
                    const draftKey = repDraftKey(o.id, lvl);
                    const isBusy = repActionKey === draftKey;
                    const draftValue = repDrafts[draftKey] ?? rep?.model3dUrl ?? '';
                    return (
                      <div key={lvl} className="rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3 space-y-2">
                        <p className="text-[.65rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">{label}</p>
                        {rep ? (
                          <>
                            {rep.mediaType==='model_3d_url'
                              ? (
                                <>
                                  <div className="relative aspect-video overflow-hidden rounded-[var(--r)] border border-[var(--bd)] bg-black/5"><iframe src={rep.model3dUrl} className="absolute inset-0 w-full h-full" allowFullScreen title={`${o.name} 3D`} /></div>
                                  {canManage ? (
                                    <>
                                      <Input value={draftValue} onChange={e => setRepDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))} placeholder="https://sketchfab.com/models/.../embed" />
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={() => saveRepUrl(o.id)} disabled={isBusy || !draftValue.trim()}>{isBusy ? 'Guardando...' : 'Guardar URL'}</Button>
                                        <ActionIconButton action="delete" onClick={() => deleteRep(o.id, lvl)} disabled={isBusy} />
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-xs text-[var(--tx3)]">Representación pública del catálogo. Crea un objeto privado si necesitas modificarla.</p>
                                  )}
                                </>
                              )
                              : (
                                <>
                                  <img src={rep.fileUrl} alt="" className="w-full h-32 rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
                                  {canManage ? (
                                    <div className="flex gap-2">
                                      <label className="inline-flex items-center gap-1.5 font-bold rounded-[var(--r)] border transition-all cursor-pointer whitespace-nowrap px-2.5 py-1 text-xs bg-[var(--sf)] text-[var(--tx)] border-[var(--bd)] hover:bg-[var(--bg2)]">
                                        Reemplazar
                                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadRep(o.id, n, e.target.files[0])} />
                                      </label>
                                      <ActionIconButton action="delete" onClick={() => deleteRep(o.id, lvl)} disabled={isBusy} />
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[var(--tx3)]">Representación pública del catálogo. Crea un objeto privado si necesitas modificarla.</p>
                                  )}
                                </>
                              )
                            }
                          </>
                        ) : (
                          <div className="border-2 border-dashed border-[var(--bd)] rounded-lg p-4 text-center bg-white">
                            {lvl === 'model_3d'
                              ? (canManage
                                ? (
                                  <>
                                    <Input value={draftValue} onChange={e => setRepDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))} placeholder="https://sketchfab.com/models/.../embed" />
                                    <Button size="sm" onClick={() => saveRepUrl(o.id)} disabled={isBusy || !draftValue.trim()}>{isBusy ? 'Guardando...' : 'Guardar URL'}</Button>
                                  </>
                                )
                                : <p className="text-[var(--tx3)] text-xs">Sin representación disponible en este objeto público.</p>)
                              : (canManage
                                ? (
                                  <>
                                    <p className="text-[var(--tx3)] text-xs mb-1">Sin archivo</p>
                                    <label className="text-xs text-[var(--ac)] font-bold cursor-pointer">
                                      📁 Subir
                                      <input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files[0]&&uploadRep(o.id,n,e.target.files[0])} />
                                    </label>
                                  </>
                                )
                                : <p className="text-[var(--tx3)] text-xs">Sin archivo disponible en este objeto público.</p>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </ListGrid></ListCollection>}
      <Modal open={modal} onClose={closeModal} title={editObj?'Editar objeto':'Nuevo objeto'} maxWidth={860}>
        <div className="space-y-3">
          {feedback && <Notice variant={feedback.type}>{feedback.message}</Notice>}
          {isReadOnlyObject && <Notice variant="info">Los objetos públicos del catálogo son de solo lectura para especialistas.</Notice>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nombre" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} disabled={isReadOnlyObject} />
            <Input label="Emoji"  value={form.em}   onChange={e=>setForm({...form,em:e.target.value})} disabled={isReadOnlyObject} />
            <Select label="Categoría" value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} disabled={isReadOnlyObject}>
            <option value="">Selecciona...</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input label="URL del fichero 3D" value={form.model3d} onChange={e=>setForm({...form,model3d:e.target.value})} placeholder="https://sketchfab.com/models/.../embed" disabled={isReadOnlyObject} />
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
              {isReadOnlyObject ? (
                <div className="modal-upload flex items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white text-sm font-bold text-[var(--tx3)]">Solo lectura</div>
              ) : (
                <label className="modal-upload flex cursor-pointer items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white text-sm font-bold text-[var(--ac)]">
                  Subir foto
                  <input type="file" accept="image/*" className="hidden" onChange={e => setFilePreview('photoFile', 'photoPreview', e.target.files?.[0] || null)} />
                </label>
              )}
              {form.photoPreview ? (
                <img src={form.photoPreview} alt="Previsualización de foto" className="h-40 w-full rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
              ) : (
                <p className="text-sm text-[var(--tx3)]">Sin foto cargada</p>
              )}
            </div>
            <div className="modal-panel space-y-2 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
              <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Dibujo</p>
              {isReadOnlyObject ? (
                <div className="modal-upload flex items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white text-sm font-bold text-[var(--tx3)]">Solo lectura</div>
              ) : (
                <label className="modal-upload flex cursor-pointer items-center justify-center rounded-[var(--r)] border border-dashed border-[var(--bd)] bg-white text-sm font-bold text-[var(--ac)]">
                  Subir dibujo
                  <input type="file" accept="image/*" className="hidden" onChange={e => setFilePreview('drawingFile', 'drawingPreview', e.target.files?.[0] || null)} />
                </label>
              )}
              {form.drawingPreview ? (
                <img src={form.drawingPreview} alt="Previsualización de dibujo" className="h-40 w-full rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
              ) : (
                <p className="text-sm text-[var(--tx3)]">Sin dibujo cargado</p>
              )}
            </div>
          </div>
        </div>
        <div className="modal-actions flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || isReadOnlyObject || !form.name || !form.category_id} onClick={save}>{saving ? 'Guardando...' : editObj?'Guardar':'Crear'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el objeto y sus representaciones." onConfirm={del} onCancel={()=>setDelId(null)} />
    </div>
  );
}

/* ── Groups page ───────────────────────────────────────────────────────── */
function Groups() {
  const [groups,  setGroups]  = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editGrp, setEditGrp] = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [columnCount, setColumnCount] = useListColumns('specialist.groups', 1);
  const [form,    setForm]    = useState({ name:'', color:'#1A5FD4', client_ids:[] });
  const COLORS = ['#1A5FD4','#1A7A3C','#C0392B','#B05000','#7B2D8B','#0077BB','#CC3300'];

  useEffect(() => {
    Promise.all([groupsApi.list(), clientsApi.list()])
      .then(([gr, cr]) => { setGroups(gr.data.data); setClients(cr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew  = () => { setEditGrp(null); setForm({ name:'', color:'#1A5FD4', client_ids:[] }); setModal(true); };
  const openEdit = g  => { setEditGrp(g); setForm({ name:g.name, color:g.color, client_ids: g.clients?.map(c=>c.id)||[] }); setModal(true); };
  const save = async () => {
    if (editGrp) { const r = await groupsApi.update(editGrp.id, form); setGroups(p=>p.map(g=>g.id===editGrp.id?r.data.data:g)); }
    else { const r = await groupsApi.create(form); setGroups(p=>[...p, r.data.data]); }
    setModal(false);
  };
  const del = async () => { await groupsApi.delete(delId); setGroups(p=>p.filter(g=>g.id!==delId)); setDelId(null); };
  const toggleClient = id => setForm(f=>({ ...f, client_ids: f.client_ids.includes(id)?f.client_ids.filter(x=>x!==id):[...f.client_ids,id] }));

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;
  const filtered = groups.filter(g=>!search||g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-in">
      <ListPageHeader
        title="Grupos"
        count={`${filtered.length}/${groups.length}`}
        subtitle="Conjuntos de alumnos para asignaciones rápidas y seguimiento."
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
      {filtered.length === 0 ? <Empty icon="👥" title="Sin grupos" subtitle="Los grupos permiten asignar actividades a varios clientes a la vez" action={<Button onClick={openNew}>Crear grupo</Button>} /> :
        <ListCollection className="entity-list-shell">
          <ListGrid columns={columnCount}>
          {filtered.map(g=>(
            <ListRow
              key={g.id}
              className="entity-list-row"
              accentColor={g.color}
              avatar={<div className="flex h-11 w-11 px-11 py-14 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: g.color }}>{g.clients?.length || 0}</div>}
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
      <Modal open={modal} onClose={()=>setModal(false)} title={editGrp?'Editar grupo':'Nuevo grupo'} maxWidth={480}>
        <Input label="Nombre del grupo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mb-3" />
        <ColorPickerField label="Color" colors={COLORS} value={form.color} onChange={(color) => setForm({ ...form, color })} className="mb-3" />
        <div>
          <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Miembros</p>
          <div className="modal-list-panel border border-[var(--bd)] rounded-[var(--r)] max-h-40 overflow-y-auto">
            {clients.map(c=>(
              <label key={c.id} className="modal-list-row flex items-center gap-3 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={()=>toggleClient(c.id)} />
                <span className="text-sm font-bold">{c.childName}</span>
                <span className="text-xs text-[var(--tx3)]">{c.user?.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={()=>setModal(false)}>Cancelar</Button>
          <Button disabled={!form.name} onClick={save}>{editGrp?'Guardar':'Crear grupo'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el grupo. Los clientes no se verán afectados." onConfirm={del} onCancel={()=>setDelId(null)} />
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

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <CategoryManagementView
      title="Categorías"
      subtitle="Gestiona colores, privacidad y solicitudes de publicación de tus categorías."
      categories={categories}
      onRefresh={loadData}
      role="specialist"
    />
  );
}

/* ── Specialist Home (router) ──────────────────────────────────────────── */
export default function SpecialistHome() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="panel"      element={<Dashboard />} />
      <Route path="clients"    element={<Clients />} />
      <Route path="activities" element={<Activities />} />
      <Route path="objects"    element={<Objects />} />
      <Route path="categories" element={<Categories />} />
      <Route path="groups"     element={<Groups />} />
    </Routes>
  );
}
