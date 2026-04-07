import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import useAuthStore from '../../stores/authStore';
import { assignmentsApi, gameApi } from '../../api';
import { Spinner, Badge, Button, Empty, Notice, SearchBar, ColumnToggle, Select } from '../../components/ui';
import GameEngine from '../../components/game/GameEngine';

export default function ClientHome() {
  // 🔧 CORREGIDO: vista de cliente adaptada a las tarjetas y estados del mockup.
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [session,     setSession]     = useState(null); // { assignmentId, gameData }
  const [startingId,  setStartingId]  = useState(null);
  const [startError,  setStartError]  = useState('');
  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [columnCount, setColumnCount] = useState(2);
  const playAssignmentId = searchParams.get('play');

  useEffect(() => {
    if (!user) return;
    assignmentsApi.list()
      .then(r => setAssignments(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || !playAssignmentId) {
      setSession(null);
      setStartingId(null);
      return;
    }

    let cancelled = false;

    const loadSession = async () => {
      setStartingId(playAssignmentId);
      setStartError('');
      try {
        const r = await gameApi.session(playAssignmentId);
        if (!cancelled) {
          setSession({ assignmentId: playAssignmentId, gameData: r.data.data });
        }
      } catch (e) {
        if (!cancelled) {
          setSession(null);
          setStartError('No se pudo abrir la actividad. Recarga la página e inténtalo de nuevo.');
          setSearchParams({}, { replace: true });
        }
      } finally {
        if (!cancelled) {
          setStartingId(null);
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [user, playAssignmentId, setSearchParams]);

  const startActivity = (assignmentId) => {
    setSearchParams({ play: assignmentId });
  };

  const handleResult = (result) => {
    gameApi.result(result).catch(console.error);
  };

  const handleProgress = (progressState) => {
    gameApi.progress(progressState).catch(console.error);
  };

  if (session) return (
    <GameEngine
      session={session.gameData}
      onResult={handleResult}
      onProgressChange={handleProgress}
      onBack={() => setSearchParams({}, { replace: true })}
      onComplete={() => {
        assignmentsApi.complete(session.assignmentId).catch(console.error);
        setSearchParams({}, { replace: true });
      }}
    />
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner size={36} /></div>;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch = !normalizedSearch || assignment.activity?.title?.toLowerCase().includes(normalizedSearch);
    const isCompleted = Boolean(assignment.completedAt);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'pending' && !isCompleted)
      || (statusFilter === 'completed' && isCompleted);
    return matchesSearch && matchesStatus;
  });
  const active   = filteredAssignments.filter(a => !a.completedAt);
  const done     = filteredAssignments.filter(a =>  a.completedAt);

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

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="🔍 Buscar actividad por nombre..."
        fieldClassName="search-field"
        inputClassName="search-input"
        extra={(
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="search-filter-select !w-auto text-sm">
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="completed">Completadas</option>
            </Select>
            <Badge className="search-visible-badge" variant="default">{filteredAssignments.length} visibles</Badge>
            <ColumnToggle value={columnCount} onChange={setColumnCount} />
          </div>
        )}
      />

      {filteredAssignments.length === 0 && (
        <Empty
          icon="📋"
          title="Sin actividades"
          subtitle={assignments.length === 0 ? 'Tu especialista aún no te ha asignado ninguna actividad' : 'No hay actividades que coincidan con los filtros actuales'}
        />
      )}

      {active.length > 0 && (
        <div className="cgrid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {active.map(a => <ActivityCard key={a.id} assignment={a} onStart={startActivity} starting={startingId === a.id} />)}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-base font-bold text-[var(--tx2)]">Completadas</h2>
          <div className="cgrid opacity-70" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
            {done.map(a => <ActivityCard key={a.id} assignment={a} onStart={startActivity} done starting={startingId === a.id} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityCard({ assignment, onStart, done, starting }) {
  const act  = assignment.activity;
  const objs = act?.activityObjects || [];
  const progressSummary = assignment.progressSummary;

  const handleStart = () => {
    if (!starting) onStart(assignment.id);
  };

  return (
    <div
      className="ac-card"
      role="button"
      tabIndex={0}
      onClick={handleStart}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleStart();
        }
      }}
    >
      <div className="ac-thumb">{objs.slice(0, 5).map(ao => <span key={ao.id}>{ao.object?.em}</span>)}</div>
      <h3 className="text-base font-black">{act?.title}</h3>
      {act?.instructions && <p className="text-xs text-[var(--tx2)] mb-2">{act.instructions}</p>}
      {progressSummary?.phaseLabel && !done && (
        <p className="mb-2 text-xs text-[var(--tx3)]">Fase actual: {progressSummary.phaseLabel}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default">{objs.length} objeto{objs.length !== 1 ? 's' : ''}</Badge>
        {progressSummary && <Badge variant="default">{progressSummary.completedSteps}/{progressSummary.totalSteps} pasos</Badge>}
        {done
          ? <Badge variant="green">🏆 Completada</Badge>
          : <Badge variant="blue">▶ En curso</Badge>
        }
      </div>
      <Button
        className="w-full justify-center mt-3"
        size="lg"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleStart();
        }}
        disabled={starting}
      >
        {starting ? 'Cargando…' : done ? '↻ Repetir' : progressSummary?.startedAt ? '▶ Continuar' : '▶ Empezar'}
      </Button>
    </div>
  );
}
