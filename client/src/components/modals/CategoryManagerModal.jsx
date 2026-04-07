import React, { useMemo, useState } from 'react';
import useAuthStore from '../../stores/authStore';
import { categoriesApi } from '../../api';
import { Badge, Button, Input, Modal, Notice, Textarea, ActionIconButton } from '../ui';

const CATEGORY_COLORS = ['#1A5FD4', '#2E8B57', '#D96C06', '#C0392B', '#6B5B95', '#008B8B', '#D4A017', '#334155'];

const emptyForm = {
  name: '',
  description: '',
  color: '#1A5FD4',
  is_public: false,
};

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

export default function CategoryManagerModal({ open, onClose, categories, onRefresh, role }) {
  const user = useAuthStore(state => state.user);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name, 'es')),
    [categories],
  );

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptyForm, is_public: role === 'admin' });
  };

  const close = () => {
    setFeedback(null);
    resetForm();
    onClose();
  };

  const openEdit = (category) => {
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

  const removeCategory = async (category) => {
    if (!window.confirm(`Se eliminará la categoría "${category.name}".`)) return;

    setSaving(true);
    setFeedback(null);
    try {
      await categoriesApi.delete(category.id);
      await onRefresh();
      if (editing?.id === category.id) resetForm();
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
    <Modal open={open} onClose={close} title="Categorías de objetos" maxWidth={880}>
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
              const canManage = role === 'admin' || category.ownerId === user?.id;
              const state = getCategoryState(category);
              return (
                <div key={category.id} className="rounded-[var(--r)] border border-[var(--bd)] bg-[var(--sf)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: category.color || '#1A5FD4' }} />
                        <p className="text-sm font-black">{category.name}</p>
                        <Badge variant={state.variant}>{state.label}</Badge>
                        <Badge variant="blue">{category._count?.objects || 0} objetos</Badge>
                      </div>
                      {category.description && <p className="mt-1 text-xs text-[var(--tx2)]">{category.description}</p>}
                      <p className="mt-1 text-[11px] text-[var(--tx3)]">{state.note}</p>
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionIconButton onClick={() => openEdit(category)} />
                        <ActionIconButton action="delete" onClick={() => removeCategory(category)} disabled={saving} />
                      </div>
                    ) : (
                      <Badge variant="default">Compartida</Badge>
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

          <div className="modal-section">
            <p className="text-[.68rem] font-bold uppercase tracking-wider text-[var(--tx3)]">Color</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(current => ({ ...current, color }))}
                  className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: color, borderColor: form.color === color ? 'var(--tx)' : 'transparent' }}
                />
              ))}
            </div>
          </div>

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
            <Button type="button" variant="secondary" onClick={close}>Cerrar</Button>
            <Button type="button" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : editing ? 'Guardar categoría' : 'Crear categoría'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}