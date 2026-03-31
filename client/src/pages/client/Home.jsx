import React, { useState, useEffect } from 'react';
import useAuthStore from '../../stores/authStore';
import { assignmentsApi, gameApi } from '../../api';
import { Spinner, Badge, Button, Empty } from '../../components/ui';
import GameEngine from '../../components/game/GameEngine';

export default function ClientHome() {
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [session,     setSession]     = useState(null); // { assignmentId, gameData }

  useEffect(() => {
    if (!user) return;
    assignmentsApi.forClient(user.clientProfile?.id || user.id)
      .then(r => setAssignments(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const startActivity = async (assignmentId) => {
    try {
      const r = await gameApi.session(assignmentId);
      setSession({ assignmentId, gameData: r.data.data });
    } catch(e) { alert('Error al cargar la actividad'); }
  };

  const handleResult = (result) => {
    gameApi.result(result).catch(console.error);
  };

  if (session) return (
    <GameEngine
      session={session.gameData}
      onResult={handleResult}
      onBack={() => setSession(null)}
      onComplete={() => {
        assignmentsApi.complete(session.assignmentId).catch(console.error);
        setSession(null);
      }}
    />
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={36} /></div>;

  const active   = assignments.filter(a => !a.completedAt);
  const done     = assignments.filter(a =>  a.completedAt);

  return (
    <div className="max-w-2xl mx-auto animate-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Mis actividades</h1>
        <p className="text-sm text-[var(--tx2)] mt-1">{active.length} en curso · {done.length} completadas</p>
      </div>

      {active.length === 0 && done.length === 0 && (
        <Empty icon="📋" title="Sin actividades" subtitle="Tu especialista aún no te ha asignado ninguna actividad" />
      )}

      <div className="space-y-3">
        {active.map(a => <ActivityCard key={a.id} assignment={a} onStart={startActivity} />)}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="text-base font-bold mt-8 mb-3 text-[var(--tx2)]">Completadas</h2>
          <div className="space-y-3 opacity-70">
            {done.map(a => <ActivityCard key={a.id} assignment={a} onStart={startActivity} done />)}
          </div>
        </>
      )}
    </div>
  );
}

// dev-trigger: updated component to test hot-reload
function ActivityCard({ assignment, onStart, done }) {
  const act  = assignment.activity;
  const objs = act?.activityObjects || [];
  return (
    <div className="bg-[var(--sf)] border-2 border-[var(--bd)] rounded-[var(--rl)] p-4 hover:border-[var(--ac)] transition-all cursor-pointer"
      onClick={() => !done && onStart(assignment.id)}>
      {/* Thumbnail strip */}
      <div className="flex gap-1 mb-3 text-2xl">{objs.slice(0,5).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div>
      <h3 className="font-black text-base mb-1">{act?.title}</h3>
      {act?.instructions && <p className="text-xs text-[var(--tx2)] mb-2">{act.instructions}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default">{objs.length} objeto{objs.length !== 1 ? 's' : ''}</Badge>
        {done
          ? <Badge variant="green">🏆 Completada</Badge>
          : <Badge variant="blue">▶ En curso</Badge>
        }
      </div>
      {!done && (
        <Button className="w-full justify-center mt-3" size="lg">
          ▶ Empezar
        </Button>
      )}
    </div>
  );
}
