import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { clientsApi, activitiesApi, groupsApi, assignmentsApi, objectsApi, categoriesApi } from '../../api';
import useAuthStore from '../../stores/authStore';
import { Button, Badge, Card, Input, Select, Textarea, SearchBar, TabBar, Confirm, Modal, Empty, Spinner, SubBadge, Notice } from '../../components/ui';
import { getPasswordStrengthError, PASSWORD_RULE_HINT } from '../../lib/password';

function getApiErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.message || fallback;
}

/* ── Clients page ──────────────────────────────────────────────────────── */
function Clients() {
  const [clients,  setClients]  = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(null); // null | 'new' | client obj
  const [delId,    setDelId]    = useState(null);
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState(null);
  const passwordError = getPasswordStrengthError(form.password || '', { required: modal === 'new' });
  const passwordConfirmError = (form.password || '') && form.password !== form.confirm_password
    ? 'Las contrasenas no coinciden.'
    : '';

  useEffect(() => {
    Promise.all([clientsApi.list(), groupsApi.list()])
      .then(([cr, gr]) => { setClients(cr.data.data); setGroups(gr.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew  = ()  => { setForm({ name:'', email:'', child_name:'', age:'', groupIds:[], password:'', confirm_password:'' }); setFeedback(null); setModal('new'); };
  const openEdit = (c) => { setForm({ name: c.user?.name, email: c.user?.email, child_name: c.childName, diagnosisNotes: c.diagnosisNotes, groupIds: [], password:'', confirm_password:'' }); setFeedback(null); setModal(c); };

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
    setDelId(null);
  };

  const filtered = clients.filter(c => !search ||
    (c.childName + (c.user?.name||'')).toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Mis clientes</h1>
        <Button onClick={openNew}>+ Nuevo cliente</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar alumno o tutor..." />
      {filtered.length === 0 ? <Empty icon="👶" title="Sin clientes" subtitle="Añade tu primer alumno" /> :
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
              <div className="w-9 h-9 rounded-full bg-[var(--ac)] text-white flex items-center justify-center font-black text-xs flex-shrink-0">
                {(c.childName||'?').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{c.childName}</p>
                <p className="text-xs text-[var(--tx2)] truncate">{c.user?.name}</p>
              </div>
              <SubBadge sub={c.subscription} />
              <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>✏️</Button>
              <Button size="sm" variant="danger"    onClick={() => setDelId(c.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo cliente' : 'Editar cliente'} maxWidth={480}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <div className="grid grid-cols-2 gap-3">
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
        <p className="mt-2 text-xs text-[var(--tx3)]">{PASSWORD_RULE_HINT}</p>
        <div className="mt-3"><Textarea label="Notas clínicas" rows={2} value={form.diagnosisNotes||''} onChange={e=>setForm({...form,diagnosisNotes:e.target.value})} /></div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.child_name || !form.email || !!passwordError || !!passwordConfirmError} onClick={save}>{saving ? 'Guardando...' : modal === 'new' ? 'Crear' : 'Guardar'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el cliente y sus asignaciones." onConfirm={del} onCancel={() => setDelId(null)} />
    </div>
  );
}

/* ── Activities page ───────────────────────────────────────────────────── */
function Activities() {
  const [acts,     setActs]    = useState([]);
  const [clients,  setClients] = useState([]);
  const [groups,   setGroups]  = useState([]);
  const [objects,  setObjects] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [modal,    setModal]   = useState(false);
  const [editAct,  setEditAct] = useState(null);
  const [delId,    setDelId]   = useState(null);
  const [form,     setForm]    = useState({ title:'', selObjs:[], assignMode:'all', selClients:[], selGroups:[] });
  const [saving,   setSaving]  = useState(false);
  const [feedback, setFeedback] = useState(null);

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
    Promise.all([activitiesApi.list(), clientsApi.list(), groupsApi.list(), objectsApi.list()])
      .then(([a,c,g,o]) => { setActs(a.data.data); setClients(c.data.data); setGroups(g.data.data); setObjects(o.data.data); })
      .finally(() => setLoading(false));
  }, []);

  const openNew  = () => {
    setEditAct(null);
    setForm({ title:'', selObjs:[], assignMode:'all', selClients:[], selGroups:[] });
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
      selObjs: a.activityObjects?.map(ao=>ao.objectId)||[],
      assignMode,
      selClients: audience?.mode === 'clients' ? (audience.clientIds || []) : assignedClientIds,
      selGroups: audience?.mode === 'groups' ? (audience.groupIds || []) : [],
    });
    setFeedback(null);
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = { title: form.title, objects: form.selObjs.map((id,i)=>({ object_id:id, sort_order:i })) };
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
  const cats = [...new Set(objects.map(o=>o.category?.name||'Sin categoría'))];
  const [cat, setCat] = useState('Todos');
  const visObjs = objects.filter(o=>cat==='Todos'||o.category?.name===cat);
  const filtered = acts.filter(a=>!search||a.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Actividades</h1>
        <Button onClick={openNew}>+ Nueva</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar actividad..." />
      {filtered.length === 0 ? <Empty icon="📋" title="Sin actividades" /> :
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]">
              <div className="flex gap-0.5 text-lg">{a.activityObjects?.slice(0,4).map(ao=><span key={ao.id}>{ao.object?.em}</span>)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{a.title}</p>
                <p className="text-xs text-[var(--tx3)]">{a.activityObjects?.length||0} objetos · {getAssignmentSummary(a)}</p>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">{getAssignmentDetail(a)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>✏️</Button>
              <Button size="sm" variant="danger"    onClick={() => setDelId(a.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
      <Modal open={modal} onClose={() => setModal(false)} title={editAct ? 'Editar actividad' : 'Nueva actividad'} maxWidth={720}>
        {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
        <Input label="Título" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mb-3" placeholder="Ej: Animales del campo" />
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Objetos</div>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {['Todos',...cats].map(c=>(
            <button key={c} onClick={()=>setCat(c)} className={`px-2 py-0.5 rounded text-xs font-bold border ${cat===c?'bg-[var(--ac)] text-white border-[var(--ac)]':'border-[var(--bd)] text-[var(--tx2)] hover:bg-[var(--bg2)]'}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4 max-h-48 overflow-y-auto p-1">
          {visObjs.map(o=>(
            <div key={o.id} onClick={()=>setForm(f=>({...f,selObjs:f.selObjs.includes(o.id)?f.selObjs.filter(x=>x!==o.id):[...f.selObjs,o.id]}))}
              className={`flex flex-col items-center gap-1 p-2 border-2 rounded-lg cursor-pointer transition-all text-center ${form.selObjs.includes(o.id)?'border-[var(--ac)] bg-[var(--acb)]':'border-[var(--bd)] hover:border-[var(--ac)]'}`}>
              <span className="text-xl">{o.em}</span>
              <span className="text-[.65rem] font-bold text-[var(--tx2)] leading-tight">{o.name}</span>
            </div>
          ))}
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tx3)]">Asignar a</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[['all','🌐','Todos los usuarios'],['clients','👤','Clientes'],['groups','👥','Grupos']].map(([m,ic,lb])=>(
            <div key={m} onClick={()=>setForm({...form,assignMode:m})}
              className={`p-2 border-2 rounded-[var(--r)] cursor-pointer text-center text-xs font-bold ${form.assignMode===m?'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]':'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}>
              <div className="text-lg">{ic}</div>{lb}
            </div>
          ))}
        </div>
        {editAct && <p className="mb-3 text-xs text-[var(--tx3)]">Guardar actualizará también los destinatarios activos de esta actividad.</p>}
        {form.assignMode==='clients' && (
          <div className="border border-[var(--bd)] rounded-[var(--r)] max-h-40 overflow-y-auto mb-3">
            {clients.map(c=>(
              <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                <input type="checkbox" checked={form.selClients.includes(c.id)} onChange={()=>setForm(f=>({...f,selClients:f.selClients.includes(c.id)?f.selClients.filter(x=>x!==c.id):[...f.selClients,c.id]}))} />
                <span className="text-sm font-bold">{c.childName}</span>
                <span className="text-xs text-[var(--tx3)]">{c.user?.name}</span>
              </label>
            ))}
            {clients.length === 0 && <p className="p-3 text-sm text-[var(--tx3)]">No hay clientes disponibles.</p>}
          </div>
        )}
        {form.assignMode==='groups' && (
          <div className="flex flex-wrap gap-2 mb-3">
            {groups.map(g=>(
              <div key={g.id} onClick={()=>setForm(f=>({...f,selGroups:f.selGroups.includes(g.id)?f.selGroups.filter(x=>x!==g.id):[...f.selGroups,g.id]}))}
                className={`px-3 py-1.5 rounded-full border-2 cursor-pointer text-xs font-bold ${form.selGroups.includes(g.id)?'border-[var(--ac)] bg-[var(--acb)] text-[var(--act)]':'border-[var(--bd)] hover:bg-[var(--bg2)]'}`}>
                {g.name} ({g.clients?.length||0})
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-[var(--tx3)]">No hay grupos disponibles.</p>}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-2">
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
    setSaving(false);
    setFeedback(null);
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
    const fd = new FormData();
    fd.append('file', file);
    fd.append('level', level);
    await objectsApi.uploadRepresentation(objId, fd);
    await refreshObject(objId);
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

  const filtered = objects.filter(o =>
    (catF === 'Todos' || o.category?.name === catF) &&
    (!search || o.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32}/></div>;

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Objetos</h1>
        <Button onClick={openNew}>+ Nuevo</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar objeto..."
        extra={
          <Select value={catF} onChange={e=>setCatF(e.target.value)} className="!w-auto text-sm">
            <option>Todos</option>
            {cats.map(c=><option key={c.id}>{c.name}</option>)}
          </Select>
        }
      />
      {filtered.length === 0 ? <Empty icon="📦" title="Sin objetos" subtitle="Añade tu primer objeto" /> : <div className="space-y-2">
        {filtered.map(o => {
          const reps = o.representations || [];
          const has3d = reps.some(r=>r.level==='model_3d');
          const hasPhoto = reps.some(r=>r.level==='photo');
          const hasDraw  = reps.some(r=>r.level==='drawing');
          return (
            <div key={o.id} className={`bg-[var(--sf)] border-2 rounded-[var(--rl)] overflow-hidden transition-colors ${expanded===o.id?'border-[var(--ac)]':'border-[var(--bd)]'}`}>
              <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
                <span className="text-2xl">{o.em}</span>
                <div className="flex-1"><p className="font-bold text-sm">{o.name}</p><p className="text-xs text-[var(--tx3)]">{o.category?.name}</p></div>
                <Badge variant={has3d?'green':'amber'}>🧊{has3d?'✓':'✗'}</Badge>
                <Badge variant={hasPhoto?'green':'amber'}>📷{hasPhoto?'✓':'✗'}</Badge>
                <Badge variant={hasDraw?'green':'amber'}>📝{hasDraw?'✓':'✗'}</Badge>
                <Button size="sm" variant="secondary" onClick={e=>{e.stopPropagation();openEdit(o);}}>✏️</Button>
                <Button size="sm" variant="danger"    onClick={e=>{e.stopPropagation();setDelId(o.id);}}>🗑</Button>
                <span className="text-[var(--tx3)]">{expanded===o.id?'▲':'▼'}</span>
              </div>
              {expanded===o.id && (
                <div className="border-t border-[var(--bd)] p-4 grid gap-4 md:grid-cols-3">
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
                                  <Input value={draftValue} onChange={e => setRepDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))} placeholder="https://sketchfab.com/models/.../embed" />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => saveRepUrl(o.id)} disabled={isBusy || !draftValue.trim()}>{isBusy ? 'Guardando...' : 'Guardar URL'}</Button>
                                    <Button size="sm" variant="danger" onClick={() => deleteRep(o.id, lvl)} disabled={isBusy}>Eliminar</Button>
                                  </div>
                                </>
                              )
                              : (
                                <>
                                  <img src={rep.fileUrl} alt="" className="w-full h-32 rounded-[var(--r)] border border-[var(--bd)] object-cover bg-white" />
                                  <div className="flex gap-2">
                                    <label className="inline-flex items-center gap-1.5 font-bold rounded-[var(--r)] border transition-all cursor-pointer whitespace-nowrap px-2.5 py-1 text-xs bg-[var(--sf)] text-[var(--tx)] border-[var(--bd)] hover:bg-[var(--bg2)]">
                                      Reemplazar
                                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadRep(o.id, n, e.target.files[0])} />
                                    </label>
                                    <Button size="sm" variant="danger" onClick={() => deleteRep(o.id, lvl)} disabled={isBusy}>Eliminar</Button>
                                  </div>
                                </>
                              )
                            }
                          </>
                        ) : (
                          <div className="border-2 border-dashed border-[var(--bd)] rounded-lg p-4 text-center bg-white">
                            {lvl==='model_3d' ? (
                              <>
                                <Input value={draftValue} onChange={e => setRepDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))} placeholder="https://sketchfab.com/models/.../embed" />
                                <Button size="sm" onClick={() => saveRepUrl(o.id)} disabled={isBusy || !draftValue.trim()}>{isBusy ? 'Guardando...' : 'Guardar URL'}</Button>
                              </>
                            ) : (
                              <>
                                <p className="text-[var(--tx3)] text-xs mb-1">Sin archivo</p>
                                <label className="text-xs text-[var(--ac)] font-bold cursor-pointer">
                                  📁 Subir
                                  <input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files[0]&&uploadRep(o.id,n,e.target.files[0])} />
                                </label>
                              </>
                            )}
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
      </div>}
      <Modal open={modal} onClose={closeModal} title={editObj?'Editar objeto':'Nuevo objeto'} maxWidth={720}>
        <div className="space-y-3">
          {feedback && <Notice variant={feedback.type}>{feedback.message}</Notice>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            <Input label="Emoji"  value={form.em}   onChange={e=>setForm({...form,em:e.target.value})} />
            <Select label="Categoría" value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>
            <option value="">Selecciona...</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input label="URL del fichero 3D" value={form.model3d} onChange={e=>setForm({...form,model3d:e.target.value})} placeholder="https://sketchfab.com/models/.../embed" />
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
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.name || !form.category_id} onClick={save}>{saving ? 'Guardando...' : editObj?'Guardar':'Crear'}</Button>
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-black">Grupos</h1>
        <Button onClick={openNew}>+ Nuevo grupo</Button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar grupo..." />
      {filtered.length === 0 ? <Empty icon="👥" title="Sin grupos" subtitle="Los grupos permiten asignar actividades a varios clientes a la vez" /> :
        <div className="space-y-2">
          {filtered.map(g=>(
            <div key={g.id} className="flex items-center gap-3 p-3 bg-[var(--sf)] border border-[var(--bd)] rounded-[var(--r)]" style={{borderLeft:`4px solid ${g.color}`}}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{background:g.color}}>{g.clients?.length||0}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{g.name}</p>
                <p className="text-xs text-[var(--tx3)]">{g.clients?.map(c=>c.childName).join(', ')||'Sin miembros'}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={()=>openEdit(g)}>✏️ Editar</Button>
              <Button size="sm" variant="danger"    onClick={()=>setDelId(g.id)}>🗑</Button>
            </div>
          ))}
        </div>
      }
      <Modal open={modal} onClose={()=>setModal(false)} title={editGrp?'Editar grupo':'Nuevo grupo'} maxWidth={480}>
        <Input label="Nombre del grupo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mb-3" />
        <div className="mb-3">
          <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Color</p>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c=>(
              <button key={c} onClick={()=>setForm({...form,color:c})}
                className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                style={{background:c, outline: form.color===c?`3px solid ${c}`:undefined, outlineOffset:2}}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Miembros</p>
          <div className="border border-[var(--bd)] rounded-[var(--r)] max-h-40 overflow-y-auto">
            {clients.map(c=>(
              <label key={c.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[var(--acb)] border-b border-[var(--bd)] last:border-0">
                <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={()=>toggleClient(c.id)} />
                <span className="text-sm font-bold">{c.childName}</span>
                <span className="text-xs text-[var(--tx3)]">{c.user?.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={()=>setModal(false)}>Cancelar</Button>
          <Button disabled={!form.name} onClick={save}>{editGrp?'Guardar':'Crear grupo'}</Button>
        </div>
      </Modal>
      <Confirm open={!!delId} message="Se eliminará el grupo. Los clientes no se verán afectados." onConfirm={del} onCancel={()=>setDelId(null)} />
    </div>
  );
}

/* ── Specialist Home (router) ──────────────────────────────────────────── */
export default function SpecialistHome() {
  return (
    <Routes>
      <Route path="clients"    element={<Clients />} />
      <Route path="activities" element={<Activities />} />
      <Route path="objects"    element={<Objects />} />
      <Route path="groups"     element={<Groups />} />
      <Route index element={<Clients />} />
    </Routes>
  );
}
