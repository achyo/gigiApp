import React, { useMemo, useState } from 'react';
import useAuthStore from '../../stores/authStore';
import { categoriesApi } from '../../api';
import { Badge, Button, Card, Empty, Input, Modal, Notice, SearchBar, Textarea, ActionIconButton, ColorPickerField, Confirm, ColumnToggle } from '../ui';
import useListColumns from '../../hooks/useListColumns';

const CATEGORY_COLORS = ['#1A5FD4', '#2E8B57', '#D96C06', '#C0392B', '#6B5B95', '#008B8B', '#D4A017', '#334155'];

const emptyForm = {
  name: '',
  description: '',
  color: '#1A5FD4',
  is_public: false,
};

function getInitialForm(role) {
  return { ...emptyForm, is_public: role === 'admin' };
}

function getCategoryState(category) {
  if (category.ownerId === null && category.status === 'approved') {
    return { label: 'Pública', variant: 'green', note: 'Compartida en toda la plataforma' };
  }
  if (category.status === 'pending') {
    return { label: 'Pendiente', variant: 'amber', note: 'Esperando aprobación del administrador' };
  }
  if (category.status === 'rejected') {
    return { label: 'Rechazada', variant: 'red', note: category.rejectedNote || 'Necesita revisión' };
  }
  return { label: 'Privada', variant: 'default', note: 'Solo visible para su creador' };
}

function canManageCategory(role, userId, category) {
  return role === 'admin' || category.ownerId === userId;
}

export function CategoryManagerPanel({ categories, onRefresh, role, onClose, showCloseButton = true }) {
  const user = useAuthStore(state => state.user);
  const [form, setForm] = useState(getInitialForm(role));
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name, 'es')),
    [categories],
  );

  const resetForm = () => {
    setEditing(null);
    setForm(getInitialForm(role));
  };

  const close = () => {
    setFeedback(null);
    resetForm();
    onClose?.();
  };

  const openEdit = (category) => {
    if (!canManageCategory(role, user?.id, category)) {
      setFeedback({ type: 'info', message: 'Las categorías públicas son de solo lectura para especialistas.' });
      return;
    }

    setFeedback(null);
    setEditing(category);
    setForm({
      name: category.name || '',
      description: category.description || '',
      color: category.color || '#1A5FD4',
      is_public: category.ownerId === null || category.status === 'pending',
    });
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        is_public: role === 'admin' ? true : form.is_public,
      };

      if (editing) {
        await categoriesApi.update(editing.id, payload);
      } else {
        await categoriesApi.create(payload);
      }

      await onRefresh();
      setFeedback({ type: 'success', message: editing ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.' });
      resetForm();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.error?.message || error?.message || 'No se pudo guardar la categoría.',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async () => {
    if (!deleteTarget) return;
    if (!canManageCategory(role, user?.id, deleteTarget)) {
      setDeleteTarget(null);
      setFeedback({ type: 'info', message: 'Las categorías públicas son de solo lectura para especialistas.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await categoriesApi.delete(deleteTarget.id);
      await onRefresh();
      if (editing?.id === deleteTarget.id) resetForm();
      setFeedback({ type: 'success', message: 'Categoría eliminada correctamente.' });
      setDeleteTarget(null);
    } catch (error) {
      const code = error?.response?.data?.error?.code;
      setFeedback({
        type: 'error',
        message: code === 'CATEGORY_IN_USE'
          ? 'No se puede eliminar porque hay objetos usando esta categoría.'
          : error?.response?.data?.error?.message || error?.message || 'No se pudo eliminar la categoría.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}
      <div className="modal-grid grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="modal-panel space-y-3 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black">Categorías disponibles</p>
              <p className="text-xs text-[var(--tx3)]">Admin crea categorías públicas. Especialista puede dejarlas privadas o solicitar publicación.</p>
            </div>
            <Button type="button" variant="secondary" onClick={resetForm}>+ Nueva categoría</Button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {sortedCategories.map((category) => {
              const canManage = canManageCategory(role, user?.id, category);
              const state = getCategoryState(category);
              return (
                <div key={category.id} className="rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: category.color || '#1A5FD4' }} />
                        <p className="text-sm font-black">{category.name}</p>
                        <Badge variant={state.variant}>{state.label}</Badge>
                        <Badge variant="blue" className="category-object-count-badge">{category._count?.objects || 0} objetos</Badge>
                      </div>
                      {category.description && <p className="mt-1 text-xs text-[var(--tx2)]">{category.description}</p>}
                      <p className="mt-1 text-[11px] text-[var(--tx3)]">{state.note}</p>
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionIconButton onClick={() => openEdit(category)} />
                        <ActionIconButton action="delete" onClick={() => setDeleteTarget(category)} disabled={saving} />
                      </div>
                    ) : (
                      <Badge variant="blue">Solo lectura</Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {sortedCategories.length === 0 && <p className="text-sm text-[var(--tx3)]">Todavía no hay categorías.</p>}
          </div>
        </div>

        <div className="modal-panel space-y-3 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <div>
            <p className="text-sm font-black">{editing ? 'Editar categoría' : 'Nueva categoría'}</p>
            <p className="text-xs text-[var(--tx3)]">El color se mostrará en cada objeto para identificarla rápidamente.</p>
          </div>

          <Input label="Nombre" value={form.name} onChange={(event) => setForm(current => ({ ...current, name: event.target.value }))} />
          <Textarea label="Descripción" rows={3} value={form.description} onChange={(event) => setForm(current => ({ ...current, description: event.target.value }))} />

          <ColorPickerField label="Color" colors={CATEGORY_COLORS} value={form.color} onChange={(color) => setForm(current => ({ ...current, color }))} />

          {role === 'specialist' ? (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.is_public} onChange={(event) => setForm(current => ({ ...current, is_public: event.target.checked }))} />
              Solicitar publicación para compartirla con otros especialistas
            </label>
          ) : (
            <div className="rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] px-3 py-2 text-sm text-[var(--tx2)]">
              Las categorías creadas por administración quedan públicas automáticamente.
            </div>
          )}

          <div className="modal-actions flex gap-2 justify-end">
            {editing && <Button type="button" variant="secondary" onClick={resetForm}>Limpiar</Button>}
            {showCloseButton && <Button type="button" variant="secondary" onClick={close}>Cerrar</Button>}
            <Button type="button" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : editing ? 'Guardar categoría' : 'Crear categoría'}</Button>
          </div>
        </div>
      </div>
      <Confirm
        open={!!deleteTarget}
        message={deleteTarget ? `Se eliminará la categoría "${deleteTarget.name}".` : ''}
        onConfirm={removeCategory}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

export function CategoryManagementView({ title, subtitle, categories, onRefresh, role }) {
  const user = useAuthStore(state => state.user);
  const [search, setSearch] = useState('');
  const [columnCount, setColumnCount] = useListColumns(`categories.${role}`, 1);
  const [form, setForm] = useState(getInitialForm(role));
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name, 'es')),
    [categories],
  );

  const filteredCategories = sortedCategories.filter((category) => {
    const text = `${category.name || ''} ${category.description || ''}`.toLowerCase();
    return !search.trim() || text.includes(search.trim().toLowerCase());
  });

  const resetForm = () => {
    setEditing(null);
    setForm(getInitialForm(role));
  };

  const closeModal = () => {
    resetForm();
    setOpen(false);
  };

  const openCreate = () => {
    setFeedback(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (category) => {
    if (!canManageCategory(role, user?.id, category)) {
      setFeedback({ type: 'info', message: 'Las categorías públicas son de solo lectura para especialistas.' });
      return;
    }

    setFeedback(null);
    setEditing(category);
    setForm({
      name: category.name || '',
      description: category.description || '',
      color: category.color || '#1A5FD4',
      is_public: category.ownerId === null || category.status === 'pending',
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        is_public: role === 'admin' ? true : form.is_public,
      };

      if (editing) {
        await categoriesApi.update(editing.id, payload);
      } else {
        await categoriesApi.create(payload);
      }

      await onRefresh();
      setFeedback({ type: 'success', message: editing ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.' });
      closeModal();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.error?.message || error?.message || 'No se pudo guardar la categoría.',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async () => {
    if (!deleteTarget) return;
    if (!canManageCategory(role, user?.id, deleteTarget)) {
      setDeleteTarget(null);
      setFeedback({ type: 'info', message: 'Las categorías públicas son de solo lectura para especialistas.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await categoriesApi.delete(deleteTarget.id);
      await onRefresh();
      if (editing?.id === deleteTarget.id) closeModal();
      setDeleteTarget(null);
      setFeedback({ type: 'success', message: 'Categoría eliminada correctamente.' });
    } catch (error) {
      const code = error?.response?.data?.error?.code;
      setFeedback({
        type: 'error',
        message: code === 'CATEGORY_IN_USE'
          ? 'No se puede eliminar porque hay objetos usando esta categoría.'
          : error?.response?.data?.error?.message || error?.message || 'No se pudo eliminar la categoría.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black">{title}</h1>
            <Badge variant="blue" className="management-count-badge">{categories.length}</Badge>
          </div>
          {subtitle && <p className="text-sm text-[var(--tx3)]">{subtitle}</p>}
        </div>
        <Button className="entity-action-btn" onClick={openCreate}>+ Nueva categoría</Button>
      </div>

      {feedback && <Notice variant={feedback.type} className="mb-3">{feedback.message}</Notice>}

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="🔍 Buscar categoría..."
        fieldClassName="entity-search-field"
        inputClassName="entity-search-input"
        extra={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="search-visible-badge entity-item-badge" variant="default">{filteredCategories.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />

      <Card className="entity-list-shell">
        {filteredCategories.length === 0 ? (
          <Empty icon="🗂" title="Sin categorías" subtitle="Crea tu primera categoría para organizar los objetos" />
        ) : (
          <div className="grid items-start gap-2" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
            {filteredCategories.map((category) => {
              const canManage = canManageCategory(role, user?.id, category);
              const state = getCategoryState(category);

              return (
                <div key={category.id} className="entity-list-row flex flex-col gap-2.5 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] px-[14px] py-[11px] sm:flex-row sm:items-center">
                  <div className="flex-shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10" style={{ background: `${category.color || '#1A5FD4'}20` }}>
                      <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: category.color || '#1A5FD4' }} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-[var(--tx)]">{category.name}</p>
                      <Badge variant={state.variant}>{state.label}</Badge>
                      <Badge variant="blue" className="category-object-count-badge">{category._count?.objects || 0} objetos</Badge>
                    </div>
                    {category.description && <p className="mt-0.5 text-xs text-[var(--tx2)]">{category.description}</p>}
                    <p className="mt-1 text-[11px] text-[var(--tx3)]">{state.note}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2.5 sm:ml-auto">
                    {canManage ? (
                      <>
                        <ActionIconButton className="entity-action-btn" onClick={() => openEdit(category)} />
                        <ActionIconButton action="delete" className="entity-action-btn" onClick={() => setDeleteTarget(category)} disabled={saving} />
                      </>
                    ) : (
                      <Badge variant="blue">Solo lectura</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar categoría' : 'Nueva categoría'} maxWidth={640}>
        {feedback?.type === 'error' && <Notice variant="error" className="mb-3">{feedback.message}</Notice>}
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={(event) => setForm(current => ({ ...current, name: event.target.value }))} />
          <Textarea label="Descripción" rows={3} value={form.description} onChange={(event) => setForm(current => ({ ...current, description: event.target.value }))} />
          <ColorPickerField label="Color" colors={CATEGORY_COLORS} value={form.color} onChange={(color) => setForm(current => ({ ...current, color }))} />

          {role === 'specialist' ? (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.is_public} onChange={(event) => setForm(current => ({ ...current, is_public: event.target.checked }))} />
              Solicitar publicación para compartirla con otros especialistas
            </label>
          ) : (
            <div className="rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] px-3 py-2 text-sm text-[var(--tx2)]">
              Las categorías creadas por administración quedan públicas automáticamente.
            </div>
          )}
        </div>
        <div className="modal-actions mt-4 flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : editing ? 'Guardar categoría' : 'Crear categoría'}</Button>
        </div>
      </Modal>

      <Confirm
        open={!!deleteTarget}
        message={deleteTarget ? `Se eliminará la categoría "${deleteTarget.name}".` : ''}
        onConfirm={removeCategory}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function CategoryManagerModal({ open, onClose, categories, onRefresh, role }) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Categorías de objetos" maxWidth={880}>
      <CategoryManagerPanel categories={categories} onRefresh={onRefresh} role={role} onClose={onClose} />
    </Modal>
  );
}