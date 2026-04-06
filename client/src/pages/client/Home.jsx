import React, { useState, useEffect } from 'react';
import useAuthStore from '../../stores/authStore';
import { assignmentsApi, gameApi } from '../../api';
import { Spinner, Badge, Button, Empty, Notice } from '../../components/ui';
import GameEngine from '../../components/game/GameEngine';

export default function ClientHome() {
  // 🔧 CORREGIDO: vista de cliente adaptada a las tarjetas y estados del mockup.
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [session,     setSession]     = useState(null); // { assignmentId, gameData }
  const [startingId,  setStartingId]  = useState(null);
  const [startError,  setStartError]  = useState('');

  useEffect(() => {
    if (!user) return;
    assignmentsApi.list()
      .then(r => setAssignments(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const startActivity = async (assignmentId) => {
    setStartingId(assignmentId);
    setStartError('');
    try {
      const r = await gameApi.session(assignmentId);
      setSession({ assignmentId, gameData: r.data.data });
    } catch(e) {
      setStartError('No se pudo abrir la actividad. Recarga la página e inténtalo de nuevo.');
    } finally {
      setStartingId(null);
    }
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
    <div className="mx-auto max-w-4xl animate-in">
      <div className="ph">
        <div>
          <h1 className="pt">Mis actividades</h1>
          <p className="ps">{active.length} en curso · {done.length} completadas</p>
        </div>
        <Badge variant="blue">👶 Modo cliente</Badge>
      </div>

      {startError && <Notice variant="error" className="mb-4">{startError}</Notice>}

      {active.length === 0 && done.length === 0 && (
        <Empty icon="📋" title="Sin actividades" subtitle="Tu especialista aún no te ha asignado ninguna actividad" />
      )}

      <div className="cgrid">
        {active.map(a => <ActivityCard key={a.id} assignment={a} onStart={startActivity} starting={startingId === a.id} />)}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-base font-bold text-[var(--tx2)]">Completadas</h2>
          <div className="cgrid opacity-70">
            {done.map(a => <ActivityCard key={a.id} assignment={a} onStart={startActivity} done />)}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityCard({ assignment, onStart, done, starting }) {
  const act  = assignment.activity;
  const objs = act?.activityObjects || [];

  const handleStart = () => {
    if (!done && !starting) onStart(assignment.id);
  };

  return (
    <div
      className="ac-card"
      role={done ? undefined : 'button'}
      tabIndex={done ? -1 : 0}
      onClick={handleStart}
      onKeyDown={(event) => {
        if (done) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleStart();
        }
      }}
    >
      <div className="ac-thumb">{objs.slice(0, 5).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div>
      <h3 className="text-base font-black">{act?.title}</h3>
      {act?.instructions && <p className="text-xs text-[var(--tx2)] mb-2">{act.instructions}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default">{objs.length} objeto{objs.length !== 1 ? 's' : ''}</Badge>
        {done
          ? <Badge variant="green">🏆 Completada</Badge>
          : <Badge variant="blue">▶ En curso</Badge>
        }
      </div>
      {!done && (
        <Button className="w-full justify-center mt-3" size="lg" type="button" onClick={handleStart} disabled={starting}>
          {starting ? 'Cargando…' : '▶ Empezar'}
        </Button>
      )}
    </div>
  );
}
