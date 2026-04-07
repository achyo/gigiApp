import React, { useEffect, useRef, useState } from 'react';
import { useTTS } from '../../hooks/useTTS';

const LEVEL_ORDER = ['l1', 'l2', 'l3'];
const LEVEL_META = {
  l1: { label: 'Nivel 1', sub: 'Modelo 3D', icon: '🧊' },
  l2: { label: 'Nivel 2', sub: 'Fotografía', icon: '📷' },
  l3: { label: 'Nivel 3', sub: 'Dibujo', icon: '📝' },
};

function getLevelExercises(levelId) {
  if (levelId === 'l1') return [{ id: 'show', label: 'Mostrar 3D', icon: '🧊' }];

  return [
    { id: 'show', label: 'Mostrar', icon: '👁️' },
    { id: 'recognize', label: 'Reconocer', icon: '🔍' },
    { id: 'relate', label: 'Relacionar', icon: '🔗' },
    { id: 'memorize', label: 'Memorizar', icon: '🧠' },
  ];
}

function getMedia(step, levelId) {
  const media = step?.media;
  if (!media) return null;
  if (levelId === 'l1') return media.l1 ?? null;
  if (levelId === 'l2') return media.l2 ?? null;
  if (levelId === 'l3') return media.l3 ?? null;
  return null;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function MediaDisplay({ step, levelId }) {
  const media = getMedia(step, levelId);

  if (media?.type === '3d' && media.url) {
    return (
      <div className="w-full max-w-xl">
        <div className="relative aspect-video overflow-hidden rounded-[var(--r)] border-2 border-[var(--bd)] bg-black">
          <iframe
            title={step.object_name}
            src={media.url}
            allowFullScreen
            allow="autoplay; fullscreen; xr-spatial-tracking"
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <p className="mt-1 text-right text-xs text-[var(--tx3)]">↻ Arrastra para rotar · rueda para zoom</p>
      </div>
    );
  }

  if (media?.type === 'img' && media.url) {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-[var(--r)] border-2 border-[var(--bd)] bg-white">
        <img src={media.url} alt={step.object_name} className="block max-h-56 w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="gbig">
      <span style={{ fontSize: '2.5rem' }}>{step?.object_emoji || '📦'}</span>
    </div>
  );
}

function ShowExercise({ step, levelId, speak, onNext }) {
  return (
    <div className="gbox animate-in">
      <div className="rounded-full bg-[var(--acb)] px-3.5 py-3 text-xs font-bold text-[var(--act)]">
        {LEVEL_META[levelId].icon} {LEVEL_META[levelId].sub}
      </div>
      <MediaDisplay step={step} levelId={levelId} />
      <div className="gname" onMouseEnter={() => speak(step.object_name)}>{step.object_name}</div>
      <div className="rounded-[var(--r)] bg-[var(--bg2)] px-4 py-3 text-center text-sm text-[var(--tx2)]">
        {levelId === 'l1' && 'Explora el objeto en 3D con el alumno.'}
        {levelId === 'l2' && 'Observa la fotografía real del objeto.'}
        {levelId === 'l3' && 'Fíjate en cómo el dibujo representa el objeto.'}
      </div>
      <button className="rounded-[var(--r)] bg-[var(--ac)] px-5 py-2.5 text-sm font-bold text-white" onClick={onNext}>
        Siguiente
      </button>
    </div>
  );
}

function RecognizeExercise({ step, levelId, allSteps, onAnswer }) {
  const [pool] = useState(() => {
    const others = shuffle(allSteps.filter(candidate => candidate.object_id !== step.object_id)).slice(0, 5);
    return shuffle([step, ...others]);
  });
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState(null);

  const handlePick = (candidate) => {
    if (selectedId) return;

    const ok = candidate.object_id === step.object_id;
    setSelectedId(candidate.object_id);
    setStatus(ok ? 'ok' : 'ko');
    window.setTimeout(() => onAnswer(ok), 350);
  };

  return (
    <div className="flex w-full flex-col items-center gap-3 animate-in">
      <p className="text-center text-base font-bold">¿Cuál es el <strong>{step.object_name}</strong>?</p>
      <div className="rgrid max-w-md">
        {pool.map(candidate => {
          const media = getMedia(candidate, levelId);
          const isSelected = selectedId === candidate.object_id;
          const stateClass = !isSelected
            ? 'border-[var(--bd)] hover:border-[var(--ac)]'
            : status === 'ok'
              ? 'border-[var(--ok)] bg-[var(--okb)]'
              : 'border-[var(--er)] bg-[var(--erb)] shake';

          return (
            <button
              key={candidate.object_id}
              className={`aspect-square overflow-hidden rounded-xl border-[3px] bg-[var(--bg2)] text-4xl ${stateClass}`}
              onClick={() => handlePick(candidate)}
              disabled={Boolean(selectedId)}
            >
              {media?.type === 'img' && media.url
                ? <img src={media.url} alt={candidate.object_name} className="h-full w-full object-cover" />
                : <span>{candidate.object_emoji}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RelateExercise({ step, levelId, allSteps, onAnswer }) {
  const [pool] = useState(() => {
    const distractors = shuffle(allSteps.filter(candidate => candidate.object_id !== step.object_id)).slice(0, 3);
    return shuffle([
      { uid: `${step.object_id}_1`, step, correct: true },
      { uid: `${step.object_id}_2`, step, correct: true },
      { uid: `${step.object_id}_3`, step, correct: true },
      ...distractors.map(candidate => ({ uid: candidate.object_id, step: candidate, correct: false })),
    ]);
  });
  const [selected, setSelected] = useState([]);

  const toggle = (uid) => {
    setSelected(current => {
      if (current.includes(uid)) return current.filter(item => item !== uid);
      return [...current, uid];
    });
  };

  const submit = () => {
    const expected = pool.filter(item => item.correct).map(item => item.uid).sort();
    const current = [...selected].sort();
    const ok = current.length === expected.length && current.every((value, index) => value === expected[index]);
    onAnswer(ok);
  };

  return (
    <div className="flex w-full flex-col items-center gap-3 animate-in">
      <p className="text-center text-base font-bold">Señala todas las imágenes del <strong>{step.object_name}</strong></p>
      <p className="text-xs text-[var(--tx3)]">Selecciona las 3 correctas y pulsa comprobar.</p>
      <div className="rgrid max-w-md">
        {pool.map(item => {
          const media = getMedia(item.step, levelId);
          const active = selected.includes(item.uid);

          return (
            <button
              key={item.uid}
              className={`aspect-square overflow-hidden rounded-xl border-[3px] ${active ? 'border-[var(--ok)] bg-[var(--okb)]' : 'border-[var(--bd)] bg-[var(--bg2)] hover:border-[var(--ac)]'}`}
              onClick={() => toggle(item.uid)}
            >
              {media?.type === 'img' && media.url
                ? <img src={media.url} alt={item.step.object_name} className="h-full w-full object-cover" />
                : <span className="text-4xl">{item.step.object_emoji}</span>}
            </button>
          );
        })}
      </div>
      <button
        className="rounded-[var(--r)] bg-[var(--ac)] px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        onClick={submit}
        disabled={selected.length === 0}
      >
        Comprobar
      </button>
    </div>
  );
}

function MemorizeExercise({ step, levelId, allSteps, onAnswer }) {
  const [cards] = useState(() => {
    const extra = shuffle(allSteps.filter(candidate => candidate.object_id !== step.object_id)).slice(0, 3);
    return shuffle([step, step, ...extra, ...extra]).map((candidate, index) => ({ ...candidate, uid: `${candidate.object_id}_${index}` }));
  });
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);

  const handleFlip = (card) => {
    if (busy || flipped.includes(card.uid) || matched.includes(card.uid)) return;

    const nextFlipped = [...flipped, card.uid];
    setFlipped(nextFlipped);

    if (nextFlipped.length !== 2) return;

    setBusy(true);
    const [first, second] = nextFlipped.map(uid => cards.find(cardItem => cardItem.uid === uid));

    window.setTimeout(() => {
      if (first.object_id === second.object_id) {
        const nextMatched = [...matched, first.uid, second.uid];
        setMatched(nextMatched);

        if (first.object_id === step.object_id) {
          window.setTimeout(() => onAnswer(true), 250);
        }
      }

      setFlipped([]);
      setBusy(false);
    }, 800);
  };

  return (
    <div className="flex w-full flex-col items-center gap-3 animate-in">
      <p className="text-center text-base font-bold">Encuentra la pareja del <strong>{step.object_name}</strong></p>
      <div className="mgrid max-w-md">
        {cards.map(card => {
          const visible = flipped.includes(card.uid) || matched.includes(card.uid);
          const media = getMedia(card, levelId);
          const matchedCard = matched.includes(card.uid);

          return (
            <button
              key={card.uid}
              className={`aspect-square overflow-hidden rounded-xl border-2 ${matchedCard ? 'border-[var(--ok)] bg-[var(--okb)]' : visible ? 'border-[var(--bd)] bg-[var(--sf)]' : 'border-[var(--bd)] bg-[var(--ac)]'}`}
              onClick={() => handleFlip(card)}
            >
              {visible
                ? media?.type === 'img' && media.url
                  ? <img src={media.url} alt={card.object_name} className="h-full w-full object-cover" draggable={false} />
                  : <span className="text-3xl">{card.object_emoji}</span>
                : <span className="text-2xl font-black text-white/70">?</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackPanel({ feedback, currentStep, remainingSteps, onPick, onComplete }) {
  if (!feedback) return null;

  return (
    <div className="fov-inline animate-in">
      <div className="fbox scale-in">
        {feedback === 'ok' && (
          <>
            <div className="mb-3 text-5xl">👏</div>
            <p className="text-xl font-black">¡Muy bien!</p>
          </>
        )}

        {feedback === 'ko' && (
          <>
            <div className="mb-3 text-5xl">😮</div>
            <p className="text-xl font-black">Inténtalo de nuevo</p>
          </>
        )}

        {feedback === 'lvl' && (
          <>
            <div className="mb-3 text-5xl">🏅</div>
            <p className="text-xl font-black">{currentStep?.object_name} superado</p>
            <p className="mt-1 text-sm text-[var(--tx2)]">Pasando al siguiente nivel…</p>
          </>
        )}

        {feedback === 'objdone' && (
          <>
            <div className="mb-3 text-5xl">⭐</div>
            <p className="text-xl font-black">{currentStep?.object_name} completado</p>
            <p className="mt-1 mb-4 text-sm text-[var(--tx2)]">Elige el siguiente objeto pendiente.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {remainingSteps.map(step => (
                <button
                  key={step.object_id}
                  className="rounded-[var(--r)] border-2 border-[var(--bd)] bg-[var(--sf)] px-4 py-4 transition-colors hover:border-[var(--ac)] hover:bg-[var(--acb)]"
                  onClick={() => onPick(step.object_id)}
                >
                  <div className="text-3xl">{step.object_emoji}</div>
                  <div className="mt-1 text-sm font-bold">{step.object_name}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {feedback === 'done' && (
          <>
            <div className="mb-3 text-5xl">🏆</div>
            <p className="text-xl font-black">¡Actividad completada!</p>
            <p className="mt-1 mb-4 text-sm text-[var(--tx2)]">Has completado todos los objetos de la sesión.</p>
            <button className="rounded-[var(--r)] bg-[var(--ac)] px-5 py-2 text-sm font-bold text-white" onClick={onComplete}>
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GameEngine({ session, onResult, onBack, onComplete, onProgressChange }) {
  const { speak } = useTTS();
  const steps = session?.steps || [];
  const [currentObjectId, setCurrentObjectId] = useState(() => session?.progress?.current_object_id || steps[0]?.object_id || null);
  const [currentLevelId, setCurrentLevelId] = useState(() => session?.progress?.current_level || 'l1');
  const [currentExerciseId, setCurrentExerciseId] = useState(() => session?.progress?.current_exercise || 'show');
  const [doneKeys, setDoneKeys] = useState(() => new Set(session?.progress?.completed_keys || []));
  const [feedback, setFeedback] = useState(null);
  const exerciseStartedAt = useRef(Date.now());

  const getFirstPendingState = (objectId, completed = doneKeys) => {
    for (const levelId of LEVEL_ORDER) {
      const exercisesForLevel = getLevelExercises(levelId);
      for (const exercise of exercisesForLevel) {
        const key = `${objectId}_${levelId}_${exercise.id}`;
        if (!completed.has(key)) {
          return { levelId, exerciseId: exercise.id };
        }
      }
    }

    const fallbackLevel = LEVEL_ORDER.at(-1) || 'l1';
    const fallbackExercise = getLevelExercises(fallbackLevel).at(-1)?.id || 'show';
    return { levelId: fallbackLevel, exerciseId: fallbackExercise };
  };

  useEffect(() => {
    const nextDoneKeys = new Set(session?.progress?.completed_keys || []);
    const defaultObjectId = session?.progress?.current_object_id || steps[0]?.object_id || null;
    const nextObjectId = steps.some((step) => step.object_id === defaultObjectId) ? defaultObjectId : steps[0]?.object_id || null;
    const fallbackState = nextObjectId ? getFirstPendingState(nextObjectId, nextDoneKeys) : { levelId: 'l1', exerciseId: 'show' };

    setCurrentObjectId(nextObjectId);
    setCurrentLevelId(session?.progress?.current_level || fallbackState.levelId);
    setCurrentExerciseId(session?.progress?.current_exercise || fallbackState.exerciseId);
    setDoneKeys(nextDoneKeys);
    setFeedback(null);
  }, [session?.assignment_id, steps]);

  const currentStep = steps.find(step => step.object_id === currentObjectId) || steps[0] || null;
  const exercises = getLevelExercises(currentLevelId);
  const currentExercise = exercises.find((exercise) => exercise.id === currentExerciseId) || exercises[0];
  const currentKey = currentStep ? `${currentStep.object_id}_${currentLevelId}_${currentExercise.id}` : '';
  const remainingChoices = steps.filter(step => step.object_id !== currentObjectId && !LEVEL_ORDER.every((levelId) =>
    getLevelExercises(levelId).every((exercise) => doneKeys.has(`${step.object_id}_${levelId}_${exercise.id}`))
  ));
  const totalExercises = steps.length * LEVEL_ORDER.reduce((count, levelId) => count + getLevelExercises(levelId).length, 0);
  const progress = totalExercises ? Math.round((doneKeys.size / totalExercises) * 100) : 0;
  const isObjectComplete = (objectId) => LEVEL_ORDER.every((levelId) =>
    getLevelExercises(levelId).every((exercise) => doneKeys.has(`${objectId}_${levelId}_${exercise.id}`))
  );
  const currentStepPosition = steps.findIndex((step) => step.object_id === currentObjectId) + 1;

  useEffect(() => {
    if (currentStep) {
      speak(currentStep.object_name);
      exerciseStartedAt.current = Date.now();
    }
  }, [currentObjectId, currentLevelId, currentExerciseId, currentStep, speak]);

  useEffect(() => {
    if (!session?.assignment_id || !currentStep || feedback === 'done') return;
    onProgressChange?.({
      assignment_id: session.assignment_id,
      current_object_id: currentStep.object_id,
      current_level: currentLevelId,
      current_exercise: currentExercise.id,
    });
  }, [session?.assignment_id, currentStep, currentLevelId, currentExercise?.id, feedback, onProgressChange]);

  const emitResult = (isCorrect) => {
    if (!currentStep || !currentExercise) return;

    onResult?.({
      assignment_id: session.assignment_id,
      object_id: currentStep.object_id,
      level: currentLevelId,
      exercise: currentExercise.id,
      is_correct: isCorrect,
      time_ms: Date.now() - exerciseStartedAt.current,
    });
  };

  const goToObject = (objectId, options = {}) => {
    const nextObject = steps.find((step) => step.object_id === objectId);
    if (!nextObject) return;

    const targetState = options.keepCurrentStep
      ? {
          levelId: options.levelId || currentLevelId,
          exerciseId: options.exerciseId || currentExercise.id,
        }
      : getFirstPendingState(objectId, options.doneKeys || doneKeys);

    setCurrentObjectId(objectId);
    setCurrentLevelId(targetState.levelId);
    setCurrentExerciseId(targetState.exerciseId);
    setFeedback(null);
  };

  const goToLevel = (levelId) => {
    if (!currentStep) return;
    const nextExercises = getLevelExercises(levelId);
    const nextExercise = nextExercises.find((exercise) => exercise.id === currentExercise.id)?.id || nextExercises[0]?.id || 'show';
    setCurrentLevelId(levelId);
    setCurrentExerciseId(nextExercise);
    setFeedback(null);
  };

  const goToExercise = (exerciseId) => {
    setCurrentExerciseId(exerciseId);
    setFeedback(null);
  };

  const advance = (completedSet) => {
    const exerciseIndex = exercises.findIndex((exercise) => exercise.id === currentExercise.id);
    const levelIndex = LEVEL_ORDER.indexOf(currentLevelId);

    if (exerciseIndex + 1 < exercises.length) {
      setCurrentExerciseId(exercises[exerciseIndex + 1].id);
      return;
    }

    if (levelIndex + 1 < LEVEL_ORDER.length) {
      setFeedback('lvl');
      window.setTimeout(() => {
        setFeedback(null);
        const nextLevelId = LEVEL_ORDER[levelIndex + 1];
        setCurrentLevelId(nextLevelId);
        setCurrentExerciseId(getLevelExercises(nextLevelId)[0]?.id || 'show');
      }, 1400);
      return;
    }

    const pendingObjects = steps.filter((step) => !isObjectComplete(step.object_id, completedSet));
    if (pendingObjects.length > 0) {
      setFeedback('objdone');
      return;
    }

    setFeedback('done');
  };

  const handleAnswer = (ok) => {
    emitResult(ok);
    setFeedback(ok ? 'ok' : 'ko');

    if (ok) {
      const nextDoneKeys = new Set(doneKeys);
      nextDoneKeys.add(currentKey);
      setDoneKeys(nextDoneKeys);
      window.setTimeout(() => {
        setFeedback(null);
        advance(nextDoneKeys);
      }, 1400);
      return;
    }

    window.setTimeout(() => setFeedback(null), 1100);
  };

  const pickNext = (objectId) => {
    goToObject(objectId, { doneKeys });
  };

  if (!currentStep) {
    return <div className="py-20 text-center text-sm text-[var(--tx2)]">No hay datos de actividad.</div>;
  }

  return (
    <div className="gwrap animate-in">
      <div className="ghdr">
        <button onClick={onBack} className="text-sm font-bold text-[var(--tx2)] hover:text-[var(--tx)]">← Volver</button>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--tx3)]">
            <p className="truncate">{session.activity.title}</p>
            <span>Objeto {currentStepPosition} de {steps.length}</span>
          </div>
          <div className="gprog">
            <div className="gpf" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span className="text-xs font-bold text-[var(--tx2)]">{progress}%</span>
      </div>

      <div className="gstrip">
        {steps.map((step) => {
          const isCurrent = step.object_id === currentObjectId;
          const isDone = isObjectComplete(step.object_id) || ((feedback === 'objdone' || feedback === 'done') && step.object_id === currentObjectId);

          return (
            <button
              key={step.object_id}
              type="button"
              className={`ochip ${isCurrent ? 'on' : ''} ${isDone ? 'done' : ''}`}
              title={step.object_name}
              aria-label={step.object_name}
              onMouseEnter={() => speak(step.object_name)}
              onClick={() => goToObject(step.object_id, { doneKeys })}
            >
              <span className="ochip__emoji">{step.object_emoji}</span>
              <span className="ochip__name">{step.object_name}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 rounded-[var(--r)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{currentStep.object_emoji}</span>
          <div className="flex-1">
            <p className="font-bold" onMouseEnter={() => speak(currentStep.object_name)}>{currentStep.object_name}</p>
            <p className="text-xs text-[var(--tx3)]">{session.activity.instructions || 'Sigue las indicaciones del juego paso a paso.'}</p>
          </div>
        </div>

        <div className="lvlprog mt-3">
          {LEVEL_ORDER.map((levelId, index) => (
            <React.Fragment key={levelId}>
              <button
                type="button"
                className={`lpdot ${doneKeys.has(`${currentStep.object_id}_${levelId}_${getLevelExercises(levelId).at(-1)?.id || 'show'}`) ? 'done' : levelId === currentLevelId ? 'curr' : 'lock'}`}
                onClick={() => goToLevel(levelId)}
                title={`${LEVEL_META[levelId].label} · ${LEVEL_META[levelId].sub}`}
              >
                {doneKeys.has(`${currentStep.object_id}_${levelId}_${getLevelExercises(levelId).at(-1)?.id || 'show'}`) ? '✓' : LEVEL_META[levelId].icon}
              </button>
              {index < LEVEL_ORDER.length - 1 && <div className={`lpline ${LEVEL_ORDER.indexOf(currentLevelId) > index ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-1.5">
        {exercises.map((exercise) => {
          const done = doneKeys.has(`${currentStep.object_id}_${currentLevelId}_${exercise.id}`);
          const active = currentExercise.id === exercise.id;
          return (
            <button
              key={exercise.id}
              type="button"
              onClick={() => goToExercise(exercise.id)}
              className={`rounded-[var(--r)] border px-3 py-1 text-xs font-bold ${done ? 'border-[var(--okbd)] bg-[var(--okb)] text-[var(--ok)]' : active ? 'border-[var(--ac)] bg-[var(--ac)] text-white' : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--tx2)]'}`}
            >
              {exercise.icon} {exercise.label}{done ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      <div className="gpanel">
        {feedback ? (
          <FeedbackPanel
            feedback={feedback}
            currentStep={currentStep}
            remainingSteps={remainingChoices}
            onPick={pickNext}
            onComplete={onComplete}
          />
        ) : (
          <>
            {currentExercise.id === 'show' && (
              <ShowExercise
                step={currentStep}
                levelId={currentLevelId}
                speak={speak}
                onNext={() => handleAnswer(true)}
              />
            )}
            {currentExercise.id === 'recognize' && (
              <RecognizeExercise
                step={currentStep}
                levelId={currentLevelId}
                allSteps={steps}
                onAnswer={handleAnswer}
              />
            )}
            {currentExercise.id === 'relate' && (
              <RelateExercise
                step={currentStep}
                levelId={currentLevelId}
                allSteps={steps}
                onAnswer={handleAnswer}
              />
            )}
            {currentExercise.id === 'memorize' && (
              <MemorizeExercise
                step={currentStep}
                levelId={currentLevelId}
                allSteps={steps}
                onAnswer={handleAnswer}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}