import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  adminApi, specialistsApi, clientsApi, activitiesApi,
  objectsApi, categoriesApi, groupsApi, subscriptionsApi,
} from '../../api';
import {
  Button, Badge, Card, Input, Select, Textarea,
  SearchBar, Confirm, Modal, Empty, Spinner, SubBadge, Divider,
} from '../../components/ui';
import SubscriptionModal from '../../components/modals/SubscriptionModal';

/* ── Dashboard ─────────────────────────────────────────────────────────── */
function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [pending, setPending] = useState({ objects: [], categories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.pendingApprovals()])
      .then(([sr, pr]) => { setStats(sr.data.data); setPending(pr.data.data); })
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

  return (
    <div className="animate-in space-y-6">
      <h1 className="text-2xl font-black">Panel global</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statItems.map(([label, val, ic]) => (
          <Card key={label} className="flex items-center gap-3 py-3">
            <span className="text-2xl">{ic}</span>
            <div>
              <p className="text-2xl font-black leading-none">{val ?? '—'}</p>
              <p className="text-xs text-[var(--tx3)] font-bold uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-bold mb-3">⏳ Aprobaciones pendientes ({allPending.length})</h2>
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
      </Card>
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
  const [form,        setForm]        = useState({ name: '', email: '', bio: '', password: '' });

  useEffect(() => {
    specialistsApi.list()
      .then(r => setSpecialists(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const openNew  = ()  => { setModal('new'); setForm({ name:'',email:'',bio:'',password:'' }); };
  const openEdit = (s) => { setModal(s.id);  setForm({ name:s.user?.name||'', email:s.user?.email||'', bio:s.bio||'' }); };

  const save = async () => {
    // Create user via /users then specialist profile is auto-created
    const { default: api } = await import('../../api');
    if (modal === 'new') {
      const r = await api.default.post('/users', { ...form, role: 'specialist' });
      const spec = await specialistsApi.list();
      setSpecialists(spec.data.data);
    } else {
      await api.default.patch(`/users/${modal}`, { name: form.name, bio: form.bio });
      setSpecialists(p => p.map(s => s.userId === modal ? { ...s, user: { ...s.user, name: form.name }, bio: form.bio } : s));
    }
    setModal(null);
  };

  const filtered = specialists.filter(s =>
    !search || (s.user?.name + s.user?.email).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Especialistas</h1>
        <Button onClick={openNew}>+ Nuevo</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar especialista..." />
      {filtered.length === 0 ? <Empty icon="🧑‍⚕️" title="Sin especialistas" /> :
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
              <div className="w-9 h-9 rounded-full bg-[var(--ac)] text-white flex items-center justify-center font-black text-xs flex-shrink-0">
                {(s.user?.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{s.user?.name}</p>
                <p className="text-xs text-[var(--tx2)] truncate">{s.user?.email}</p>
                {s.bio && <p className="text-xs text-[var(--tx3)] truncate">{s.bio}</p>}
              </div>
              <Badge variant={s.user?.active ? 'green' : 'default'}>{s.user?.active ? 'Activo' : 'Inactivo'}</Badge>
              <span className="cursor-pointer" onClick={() => setSubTarget({ entity: s, type: 'specialist' })}>
                <SubBadge sub={s.subscription} />
              </span>
              <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>✏️</Button>
              <Button size="sm" variant="danger"    onClick={() => setDelId(s.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo especialista' : 'Editar especialista'} maxWidth={480}>
        <div className="space-y-3">
          <Input label="Nombre completo" value={form.name}  onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Email"           value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          {modal === 'new' && <Input label="Contraseña" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}
          <Textarea label="Bio / especialidad" rows={2} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
          <Button disabled={!form.name || !form.email} onClick={save}>{modal === 'new' ? 'Crear' : 'Guardar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se desactivará el especialista." onConfirm={async () => { await import('../../api').then(m => m.default.delete(`/users/${delId}`)); setSpecialists(p => p.filter(s => s.id !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
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
  const [sub,     setSub]     = useState(null);
  const [delId,   setDelId]   = useState(null);

  useEffect(() => {
    Promise.all([clientsApi.list(), specialistsApi.list()])
      .then(([cr, sr]) => { setClients(cr.data.data); setSpecs(sr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    !search || (c.childName + (c.user?.name || '')).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black">Todos los clientes</h1>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar alumno o tutor..." />
      {filtered.length === 0 ? <Empty icon="👶" title="Sin clientes" /> :
        <div className="space-y-2">
          {filtered.map(c => {
            const spec = specs.find(s => s.id === c.specialistId);
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
                <div className="w-9 h-9 rounded-full bg-[var(--ac)] text-white flex items-center justify-center font-black text-xs flex-shrink-0">
                  {(c.childName||'?').slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{c.childName}</p>
                  <p className="text-xs text-[var(--tx2)]">{c.user?.name} · Esp: {spec?.user?.name || '—'}</p>
                </div>
                <span className="cursor-pointer" onClick={() => setSub({ entity: c, type: 'client' })}>
                  <SubBadge sub={c.subscription} />
                </span>
                <Button size="sm" variant="danger" onClick={() => setDelId(c.id)}>🗑</Button>
              </div>
            );
          })}
        </div>
      }
      <Confirm open={!!delId} message="Se desactivará el cliente." onConfirm={async () => { await clientsApi.delete(delId); setClients(p => p.filter(c => c.id !== delId)); setDelId(null); }} onCancel={() => setDelId(null)} />
      {sub && <SubscriptionModal entity={sub.entity} entityType={sub.type} onClose={() => setSub(null)} onSave={() => { clientsApi.list().then(r => setClients(r.data.data)); setSub(null); }} />}
    </div>
  );
}

/* ── Activities page (admin, read-only with delete) ────────────────────── */
function Activities() {
  const [acts,    setActs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [delId,   setDelId]   = useState(null);

  useEffect(() => {
    activitiesApi.list().then(r => setActs(r.data.data)).finally(() => setLoading(false));
  }, []);

  const filtered = acts.filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <h1 className="text-xl font-black mb-4">Todas las actividades</h1>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar actividad..." />
      {filtered.length === 0 ? <Empty icon="📋" title="Sin actividades" /> :
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
              <div className="flex gap-0.5 text-lg">{a.activityObjects?.slice(0,4).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{a.title}</p>
                <p className="text-xs text-[var(--tx3)]">{a.activityObjects?.length || 0} objetos</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setDelId(a.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
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
  const [modal,    setModal]    = useState(false);
  const [editObj,  setEditObj]  = useState(null);
  const [delId,    setDelId]    = useState(null);
  const [form,     setForm]     = useState({ name:'', category_id:'', em:'📦', is_public: true });

  useEffect(() => {
    Promise.all([objectsApi.list(), categoriesApi.list()])
      .then(([or, cr]) => { setObjects(or.data.data); setCats(cr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew  = () => { setEditObj(null); setForm({ name:'', category_id:'', em:'📦', is_public:true }); setModal(true); };
  const openEdit = o  => { setEditObj(o); setForm({ name:o.name, category_id:o.categoryId, em:o.em, is_public: !o.ownerId }); setModal(true); };

  const save = async () => {
    if (editObj) { const r = await objectsApi.update(editObj.id, form); setObjects(p => p.map(o => o.id === editObj.id ? r.data.data : o)); }
    else { const r = await objectsApi.create(form); setObjects(p => [...p, r.data.data]); }
    setModal(false);
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
          {filtered.map(o => (
            <div key={o.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
              <span className="text-2xl">{o.em}</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{o.name}</p>
                <p className="text-xs text-[var(--tx3)]">{o.category?.name}</p>
              </div>
              <Badge variant={o.ownerId ? 'default' : 'green'}>{o.ownerId ? 'Privado' : 'Público'}</Badge>
              <Badge variant={o.status === 'approved' ? 'green' : o.status === 'pending' ? 'amber' : 'default'}>{o.status}</Badge>
              <Button size="sm" variant="secondary" onClick={() => openEdit(o)}>✏️</Button>
              <Button size="sm" variant="danger"    onClick={() => setDelId(o.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
      <Modal open={modal} onClose={() => setModal(false)} title={editObj ? 'Editar objeto' : 'Nuevo objeto (público)'} maxWidth={480}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="Emoji"  value={form.em}   onChange={e => setForm({ ...form, em: e.target.value })} />
            <Select label="Categoría" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Selecciona…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
            Publicar (visible para todos los especialistas)
          </label>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button disabled={!form.name || !form.category_id} onClick={save}>{editObj ? 'Guardar' : 'Crear'}</Button>
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
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(false);
  const [editGrp, setEditGrp] = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [form,    setForm]    = useState({ name: '', color: '#1A5FD4', client_ids: [] });
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
    else         { const r = await groupsApi.create(form);             setGroups(p=>[...p, r.data.data]); }
    setModal(false);
  };
  const del = async () => { await groupsApi.delete(delId); setGroups(p=>p.filter(g=>g.id!==delId)); setDelId(null); };
  const filtered = groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Grupos</h1>
        <Button onClick={openNew}>+ Nuevo grupo</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar grupo..." />
      {filtered.length === 0 ? <Empty icon="👥" title="Sin grupos" /> :
        <div className="space-y-2">
          {filtered.map(g => (
            <div key={g.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]" style={{ borderLeft: `4px solid ${g.color}` }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ background: g.color }}>{g.clients?.length || 0}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{g.name}</p>
                <p className="text-xs text-[var(--tx3)]">{g.clients?.map(c=>c.childName).join(', ') || 'Sin miembros'}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => openEdit(g)}>✏️</Button>
              <Button size="sm" variant="danger"    onClick={() => setDelId(g.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
      <Modal open={modal} onClose={() => setModal(false)} title={editGrp ? 'Editar grupo' : 'Nuevo grupo'} maxWidth={480}>
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div>
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Color</p>
            <div className="flex gap-2">{COLORS.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-8 h-8 rounded-full hover:scale-110 transition-transform" style={{ background: c, outline: form.color === c ? `3px solid ${c}` : undefined, outlineOffset: 2 }} />)}</div>
          </div>
          <div>
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Miembros</p>
            <div className="border border-[var(--bd)] rounded-[var(--r)] max-h-36 overflow-y-auto">
              {clients.map(c => (
                <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                  <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={() => setForm(f => ({ ...f, client_ids: f.client_ids.includes(c.id) ? f.client_ids.filter(x => x !== c.id) : [...f.client_ids, c.id] }))} />
                  <span className="text-sm font-bold">{c.childName}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button disabled={!form.name} onClick={save}>{editGrp ? 'Guardar' : 'Crear'}</Button>
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
