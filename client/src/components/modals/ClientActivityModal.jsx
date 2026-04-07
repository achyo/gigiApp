import React, { useEffect, useMemo, useState } from 'react';
import { assignmentsApi, gameApi } from '../../api';
import GameEngine from '../game/GameEngine';
import { Badge, Button, Empty, Modal, Notice, Spinner, Textarea } from '../ui';

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(value) {
  if (!value) return 'Sin tiempo';
  const totalSeconds = Math.max(1, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

function getStatusBadge(assignment) {
  if (assignment.progressSummary?.completedAt) return { variant: 'green', label: 'Completada' };
  if (assignment.progressSummary?.startedAt) return { variant: 'blue', label: 'En curso' };
  return { variant: 'default', label: 'Pendiente' };
}

export default function ClientActivityModal({ client, open, onClose }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [savingCommentId, setSavingCommentId] = useState('');

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId],
  );

  const loadAssignments = async (preferredAssignmentId = null) => {
    if (!client?.id) return;
    setLoading(true);
    setError('');
    try {
      const response = await assignmentsApi.forClient(client.id);
      const nextAssignments = response.data.data || [];
      setAssignments(nextAssignments);
      const nextSelectedId = preferredAssignmentId
        || nextAssignments.find((assignment) => assignment.id === selectedAssignmentId)?.id
        || nextAssignments[0]?.id
        || null;
      setSelectedAssignmentId(nextSelectedId);
    } catch (loadError) {
      setAssignments([]);
      setSelectedAssignmentId(null);
      setError(loadError?.response?.data?.error?.message || 'No se pudieron cargar las actividades del cliente.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (assignmentId) => {
    if (!assignmentId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setError('');
    try {
      const response = await assignmentsApi.progress(assignmentId);
      setDetail(response.data.data);
      setCommentDrafts((current) => {
        const next = { ...current };
        (response.data.data.history || []).forEach((entry) => {
          if (!(entry.id in next)) {
            next[entry.id] = entry.comment || '';
          }
        });
        return next;
      });
    } catch (loadError) {
      setDetail(null);
      setError(loadError?.response?.data?.error?.message || 'No se pudo cargar el detalle de progreso.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !client?.id) return undefined;
    setSession(null);
    setDetail(null);
    setCommentDrafts({});
    loadAssignments();
    return undefined;
  }, [open, client?.id]);

  useEffect(() => {
    if (!open || !selectedAssignmentId || session) return undefined;
    loadDetail(selectedAssignmentId);
    return undefined;
  }, [open, selectedAssignmentId, session]);

  const startAssignment = async (assignmentId) => {
    setStartingId(assignmentId);
    setError('');
    try {
      const response = await gameApi.session(assignmentId);
      setSession({ assignmentId, gameData: response.data.data });
    } catch (startError) {
      setError(startError?.response?.data?.error?.message || 'No se pudo iniciar la actividad.');
    } finally {
      setStartingId(null);
    }
  };

  const refreshAfterSession = async (assignmentId) => {
    await loadAssignments(assignmentId);
    await loadDetail(assignmentId);
  };

  const saveComment = async (entryId) => {
    setSavingCommentId(entryId);
    setError('');
    try {
      await gameApi.updateStepComment(entryId, commentDrafts[entryId] || '');
      if (selectedAssignmentId) {
        await loadDetail(selectedAssignmentId);
      }
    } catch (saveError) {
      setError(saveError?.response?.data?.error?.message || 'No se pudo guardar el comentario.');
    } finally {
      setSavingCommentId('');
    }
  };

  if (!open) return null;

  if (session) {
    return (
      <Modal open={open} onClose={onClose} fullScreen>
        <GameEngine
          session={session.gameData}
          onResult={(result) => gameApi.result(result).catch(console.error)}
          onProgressChange={(progressState) => gameApi.progress(progressState).catch(console.error)}
          onBack={async () => {
            const assignmentId = session.assignmentId;
            setSession(null);
            await refreshAfterSession(assignmentId);
          }}
          onComplete={async () => {
            const assignmentId = session.assignmentId;
            await assignmentsApi.complete(assignmentId).catch(console.error);
            setSession(null);
            await refreshAfterSession(assignmentId);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Actividades de ${client?.childName || 'cliente'}`} maxWidth={1160}>
      {error && <Notice variant="error" className="mb-3">{error}</Notice>}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : assignments.length === 0 ? (
        <Empty icon="📋" title="Sin actividades asignadas" subtitle="Este cliente no tiene actividades activas en este momento." />
      ) : (
        <div className="client-activity-workspace">
          <div className="client-activity-sidebar">
            {assignments.map((assignment) => {
              const status = getStatusBadge(assignment);
              const isSelected = assignment.id === selectedAssignmentId;
              return (
                <div
                  key={assignment.id}
                  role="button"
                  tabIndex={0}
                  className={`client-activity-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedAssignmentId(assignment.id);
                    }
                  }}
                >
                  <div className="client-activity-card__header">
                    <p className="client-activity-card__title">{assignment.activity?.title || 'Actividad'}</p>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="client-activity-card__meta">{assignment.progressSummary?.phaseLabel || 'Pendiente'}</p>
                  <p className="client-activity-card__meta">
                    {assignment.progressSummary?.completedSteps || 0}/{assignment.progressSummary?.totalSteps || 0} pasos completados
                  </p>
                  <div className="client-activity-card__actions">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full justify-center"
                      onClick={(event) => {
                        event.stopPropagation();
                        startAssignment(assignment.id);
                      }}
                      disabled={startingId === assignment.id}
                    >
                      {startingId === assignment.id ? 'Cargando…' : assignment.progressSummary?.startedAt ? '▶ Reanudar con el alumno' : '▶ Iniciar con el alumno'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="client-activity-detail">
            {detailLoading || !detail ? (
              <div className="flex justify-center py-16"><Spinner size={28} /></div>
            ) : (
              <>
                <div className="client-activity-detail__header">
                  <div>
                    <h3 className="text-lg font-black">{detail.assignment.activity?.title || selectedAssignment?.activity?.title}</h3>
                    <p className="text-sm text-[var(--tx2)]">{detail.assignment.progressSummary?.phaseLabel || 'Pendiente'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="blue">{detail.assignment.progressSummary?.completedSteps || 0}/{detail.assignment.progressSummary?.totalSteps || 0} pasos</Badge>
                    {detail.assignment.progressSummary?.completedAt && <Badge variant="green">Finalizada {formatDateTime(detail.assignment.progressSummary.completedAt)}</Badge>}
                  </div>
                </div>

                <div className="client-activity-object-strip">
                  {detail.assignment.activity?.activityObjects?.map((item) => (
                    <div key={item.id} className="client-activity-object-pill" title={item.object?.name || 'Objeto'}>
                      <span className="text-lg">{item.object?.em || '📦'}</span>
                      <span>{item.object?.name || 'Objeto'}</span>
                    </div>
                  ))}
                </div>

                <div className="client-activity-history">
                  {(detail.history || []).length === 0 ? (
                    <Empty icon="🧭" title="Sin pasos completados" subtitle="Todavía no hay progreso registrado en esta actividad." />
                  ) : (
                    detail.history.map((entry) => (
                      <div key={entry.id} className="client-activity-history__row">
                        <div className="client-activity-history__main">
                          <div className="client-activity-history__title">
                            <span className="text-lg">{entry.objectEmoji}</span>
                            <span>{entry.objectName}</span>
                          </div>
                          <p className="client-activity-history__meta">{entry.levelLabel} · {entry.exerciseLabel}</p>
                          <p className="client-activity-history__meta">Completado el {formatDateTime(entry.completedAt)} · Tiempo {formatDuration(entry.timeMs)}</p>
                        </div>
                        <div className="client-activity-history__comment">
                          <Textarea
                            rows={2}
                            label="Comentario"
                            value={commentDrafts[entry.id] ?? ''}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => saveComment(entry.id)}
                              disabled={savingCommentId === entry.id}
                            >
                              {savingCommentId === entry.id ? 'Guardando…' : 'Guardar comentario'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}