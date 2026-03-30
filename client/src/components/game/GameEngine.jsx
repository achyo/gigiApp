import React, { useState, useEffect, useCallback } from 'react';
import { useTTS } from '../../hooks/useTTS';

const LEVEL_ORDER = ['l1', 'l2', 'l3'];
const LEVEL_META  = { l1: { label: 'Nivel 1', sub: 'Modelo 3D', icon: '🧊' }, l2: { label: 'Nivel 2', sub: 'Fotografía', icon: '📷' }, l3: { label: 'Nivel 3', sub: 'Dibujo', icon: '📝' } };

function getLevelExercises(lvlId) {
  if (lvlId === 'l1') return [{ id: 'show', label: 'Mostrar 3D', icon: '🧊' }];
  return [
    { id: 'show',      label: 'Mostrar',    icon: '👁️' },
    { id: 'recognize', label: 'Reconocer',  icon: '🔍' },
    { id: 'relate',    label: 'Relacionar', icon: '🔗' },
    { id: 'memorize',  label: 'Memorizar',  icon: '🧠' },
  ];
}

function getMedia(step, lvlId) {
  const m = step?.media;
  if (!m) return null;
  if (lvlId === 'l1') return m.l1;
  if (lvlId === 'l2') return m.l2;
  if (lvlId === 'l3') return m.l3;
  return null;
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - .5); }

/* ── MediaDisplay ──────────────────────────────────────────────────────── */
function MediaDisplay({ step, lvlId }) {
  const media = getMedia(step, lvlId);
  if (!media) return (
    <div className="w-36 h-36 rounded-xl flex flex-col items-center justify-center bg-[var(--bg2)] border-2 border-dashed border-[var(--bd)] text-[var(--tx3)] text-xs gap-1">
      <span className="text-3xl">{step?.object_emoji}</span>
      <span>Sin {lvlId === 'l2' ? 'foto' : lvlId === 'l3' ? 'dibujo' : 'modelo'}</span>
    </div>
  );
  if (media.type === '3d') return (
    <div className="w-full max-w-lg">
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-[var(--bd)] bg-black">
        <iframe title={step.object_name} src={media.url} allowFullScreen allow="autoplay; fullscreen; xr-spatial-tracking"
          className="absolute inset-0 w-full h-full" />
      </div>
      <p className="text-xs text-[var(--tx3)] text-right mt-1">↻ Arrastra · Rueda = zoom</p>
    </div>
  );
  return (
    <div className="w-full max-w-xs rounded-xl overflow-hidden border-2 border-[var(--bd)] bg-black">
      <img src={media.url} alt={step.object_name} className="w-full max-h-48 object-contain block" />
    </div>
  );
}

/* ── ShowExercise ──────────────────────────────────────────────────────── */
function ShowExercise({ step, lvlId, onNext, speak }) {
  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full animate-in">
      <MediaDisplay step={step} lvlId={lvlId} />
      <p className="font-black text-xl" onMouseEnter={() => speak(step.object_name)}>{step.object_name}</p>
      <p className="text-sm text-[var(--tx2)] text-center max-w-xs">
        {lvlId === 'l1' ? '↻ Explora el modelo 3D con el alumno' : lvlId === 'l2' ? '📷 Observa la fotografía real' : '📝 Fíjate en el dibujo'}
      </p>
      <button onClick={onNext} onMouseEnter={() => speak('Siguiente')}
        className="px-6 py-3 bg-[var(--ac)] text-white rounded-[var(--r)] font-bold">
        Siguiente →
      </button>
    </div>
  );
}

/* ── RecognizeExercise ─────────────────────────────────────────────────── */
function RecognizeExercise({ step, lvlId, allSteps, onAnswer, speak }) {
  const POOL_SIZE = 6;
  const [pool] = useState(() => {
    const others = allSteps.filter(s => s.object_id !== step.object_id);
    const picks  = shuffle(others).slice(0, POOL_SIZE - 1);
    return shuffle([step, ...picks]);
  });
  const [result, setResult] = useState({});

  const check = s => {
    if (result[s.object_id]) return;
    const ok = s.object_id === step.object_id;
    setResult({ [s.object_id]: ok ? 'ok' : 'ko' });
    speak(ok ? '¡Muy bien!' : 'Inténtalo de nuevo');
    setTimeout(() => { onAnswer(ok); setResult({}); }, 900);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-in">
      <p className="font-bold text-base text-center" onMouseEnter={() => speak('¿Cuál es el ' + step.object_name + '?')}>
        ¿Cuál es el <strong>{step.object_name}</strong>?
      </p>
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {pool.map(s => {
          const media = getMedia(s, lvlId);
          const cls = result[s.object_id] === 'ok' ? 'border-[var(--ok)] bg-[var(--okb)]'
                    : result[s.object_id] === 'ko' ? 'border-[var(--er)] bg-[var(--erb)] shake'
                    : 'border-[var(--bd)] hover:border-[var(--ac)]';
          return (
            <div key={s.object_id} onClick={() => check(s)}
              className={`aspect-square rounded-xl border-2 cursor-pointer flex items-center justify-center text-3xl overflow-hidden ${cls}`}>
              {media?.type === 'img' && media.url
                ? <img src={media.url} alt={s.object_name} className="w-full h-full object-cover" />
                : <span>{s.object_emoji}</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── RelateExercise ────────────────────────────────────────────────────── */
function RelateExercise({ step, lvlId, allSteps, onAnswer, speak }) {
  const distractors = shuffle(allSteps.filter(s => s.object_id !== step.object_id)).slice(0, 3);
  const [pool] = useState(() => shuffle([
    { uid: step.object_id+'_a', real: true, s: step },
    { uid: step.object_id+'_b', real: true, s: step },
    { uid: step.object_id+'_c', real: true, s: step },
    ...distractors.map(d => ({ uid: d.object_id, real: false, s: d })),
  ]));
  const [sel, setSel] = useState(new Set());
  const toggle = uid => setSel(p => { const n = new Set(p); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  const check = () => {
    const correct = pool.filter(p => p.real).map(p => p.uid);
    const ok = sel.size === 3 && [...sel].every(id => correct.includes(id));
    speak(ok ? '¡Muy bien!' : 'Inténtalo de nuevo');
    onAnswer(ok);
    setSel(new Set());
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-in">
      <p className="font-bold text-base text-center">Señala <strong>todas</strong> las imágenes del <strong>{step.object_name}</strong></p>
      <p className="text-xs text-[var(--tx2)]">Selecciona las 3 correctas</p>
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {pool.map(p => {
          const media = getMedia(p.s, lvlId);
          const on = sel.has(p.uid);
          return (
            <div key={p.uid} onClick={() => toggle(p.uid)}
              className={`aspect-square rounded-xl border-2 cursor-pointer flex items-center justify-center text-3xl overflow-hidden transition-all ${on ? 'border-[var(--ok)] bg-[var(--okb)]' : 'border-[var(--bd)] hover:border-[var(--ac)]'}`}>
              {media?.type === 'img' && media.url && p.real
                ? <img src={media.url} alt={p.s.object_name} className="w-full h-full object-cover" />
                : <span>{p.s.object_emoji}</span>
              }
            </div>
          );
        })}
      </div>
      <button onClick={check} disabled={sel.size === 0}
        className="px-5 py-2 bg-[var(--ac)] text-white rounded-[var(--r)] font-bold text-sm disabled:opacity-40">
        Comprobar
      </button>
    </div>
  );
}

/* ── MemorizeExercise ──────────────────────────────────────────────────── */
function MemorizeExercise({ step, lvlId, allSteps, onAnswer, speak }) {
  const fill = shuffle(allSteps.filter(s => s.object_id !== step.object_id)).slice(0, 3);
  const [cards] = useState(() => shuffle([step, step, ...fill, ...fill]).map((s, i) => ({ ...s, uid: i })));
  const [flipped,  setFlipped]  = useState([]);
  const [matched,  setMatched]  = useState(new Set());
  const [busy,     setBusy]     = useState(false);

  const flip = uid => {
    if (busy || matched.has(uid) || flipped.includes(uid)) return;
    const nf = [...flipped, uid];
    setFlipped(nf);
    if (nf.length === 2) {
      setBusy(true);
      const [a, b] = nf.map(id => cards.find(c => c.uid === id));
      setTimeout(() => {
        if (a.object_id === b.object_id) {
          const nm = new Set([...matched, ...nf]);
          setMatched(nm);
          if (a.object_id === step.object_id) setTimeout(() => onAnswer(true), 300);
        }
        setFlipped([]);
        setBusy(false);
      }, 800);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-in">
      <p className="font-bold text-base text-center">Encuentra la pareja del <strong>{step.object_name}</strong></p>
      <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
        {cards.map(c => {
          const vis = flipped.includes(c.uid) || matched.has(c.uid);
          const mat = matched.has(c.uid);
          const media = getMedia(c, lvlId);
          return (
            <div key={c.uid} onClick={() => flip(c.uid)}
              className={`aspect-square rounded-xl border-2 cursor-pointer flex items-center justify-center text-2xl overflow-hidden transition-all select-none
                ${mat ? 'border-[var(--ok)] bg-[var(--okb)]' : vis ? 'border-[var(--bd)] bg-[var(--sf)]' : 'border-[var(--bd)] bg-[var(--ac)]'}`}>
              {vis ? (
                media?.type === 'img' && media.url
                  ? <img src={media.url} alt={c.object_name} className="w-full h-full object-cover" draggable={false} />
                  : <span>{c.object_emoji}</span>
              ) : (
                <span className="text-white/70 font-black">?</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Feedback overlay ──────────────────────────────────────────────────── */
function Overlay({ fb, step, nextStep, onPick }) {
  if (!fb) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => fb === 'ko' && null}>
      <div className="bg-[var(--sf)] rounded-[var(--rl)] p-6 max-w-sm w-full text-center scale-in">
        {fb === 'ok'     && <><div className="text-4xl mb-3">👏</div><p className="font-black text-xl">¡Muy bien!</p></>}
        {fb === 'ko'     && <><div className="text-4xl mb-3">😮</div><p className="font-black text-xl">¡Inténtalo de nuevo!</p></>}
        {fb === 'lvl'    && <><div className="text-4xl mb-3">🏅</div><p className="font-black text-xl">{step?.object_name} — nivel completado</p><p className="text-sm text-[var(--tx2)] mt-1">Siguiente nivel…</p></>}
        {fb === 'objdone' && (
          <>
            <div className="text-4xl mb-2">⭐</div>
            <p className="font-black text-xl mb-1">{step?.object_name} completado</p>
            <p className="text-sm text-[var(--tx2)] mb-4">Elige el siguiente objeto</p>
            <div className="flex flex-wrap gap-2 justify-center mb-3">
              {nextStep?.remaining?.map(s => (
                <div key={s.object_id} onClick={() => onPick(s.object_id)}
                  className="flex flex-col items-center gap-1 px-4 py-2 border-2 border-[var(--ac)] bg-[var(--acb)] rounded-xl cursor-pointer hover:brightness-95 min-w-[80px]">
                  <span className="text-2xl">{s.object_emoji}</span>
                  <span className="text-xs font-bold text-[var(--act)]">{s.object_name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => onPick(null)}
              className="text-xs text-[var(--tx3)] underline">Terminar actividad</button>
          </>
        )}
        {fb === 'done'   && <><div className="text-4xl mb-3">🏆</div><p className="font-black text-xl">¡Actividad completada!</p><p className="text-sm text-[var(--tx2)] mt-1">Has completado todos los objetos</p></>}
      </div>
    </div>
  );
}

/* ── GameEngine ────────────────────────────────────────────────────────── */
export default function GameEngine({ session, onResult, onBack, onComplete }) {
  const { speak } = useTTS();
  const steps = session?.steps || [];

  const [objIdx,    setObjIdx]    = useState(0);
  const [lvlIdx,    setLvlIdx]    = useState(0);
  const [exIdx,     setExIdx]     = useState(0);
  const [doneKeys,  setDoneKeys]  = useState(new Set());
  const [fb,        setFb]        = useState(null);
  const [remaining, setRemaining] = useState(() => steps.map(s => s.object_id));

  const curStep = steps.find(s => s.object_id === remaining[objIdx]) || steps[objIdx];
  const curLvl  = LEVEL_ORDER[lvlIdx];
  const curLvlM = LEVEL_META[curLvl];
  const exercises = getLevelExercises(curLvl);
  const curEx   = exercises[exIdx];

  useEffect(() => { if (curStep) speak(curStep.object_name); }, [objIdx]);

  const doneKey = `${curStep?.object_id}_${curLvl}_${curEx?.id}`;
  const totalPairs = steps.length * LEVEL_ORDER.length;
  const donePairs  = objIdx * LEVEL_ORDER.length + lvlIdx;
  const pct = Math.round((donePairs / Math.max(totalPairs, 1)) * 100);

  const recordResult = useCallback((isCorrect) => {
    onResult?.({
      assignment_id: session.assignment_id,
      object_id:     curStep?.object_id,
      level:         curLvl,
      exercise:      curEx?.id,
      is_correct:    isCorrect,
    });
  }, [curStep, curLvl, curEx, session]);

  const advance = useCallback(() => {
    setDoneKeys(s => { const n = new Set(s); n.add(doneKey); return n; });
    if (exIdx + 1 < exercises.length) { setExIdx(e => e + 1); return; }
    if (lvlIdx + 1 < LEVEL_ORDER.length) {
      setFb('lvl');
      setTimeout(() => { setFb(null); setLvlIdx(l => l + 1); setExIdx(0); }, 1400);
      return;
    }
    // object done
    const rem = remaining.filter((_, i) => i !== objIdx);
    if (rem.length > 0) {
      setFb('objdone');
    } else {
      setFb('done');
      setTimeout(() => { setFb(null); onComplete?.(); }, 2500);
    }
  }, [exIdx, exercises, lvlIdx, objIdx, remaining, doneKey]);

  const handleAnswer = (ok) => {
    recordResult(ok);
    setFb(ok ? 'ok' : 'ko');
    if (ok)  setTimeout(() => { setFb(null); advance(); }, 1400);
    else     setTimeout(() =>   setFb(null),              1100);
  };

  const pickNext = (objectId) => {
    if (!objectId) { onComplete?.(); return; }
    const newRem = remaining.filter((_, i) => i !== objIdx);
    const newIdx = newRem.indexOf(objectId);
    setRemaining(newRem);
    setObjIdx(newIdx >= 0 ? newIdx : 0);
    setLvlIdx(0); setExIdx(0); setFb(null);
  };

  if (!curStep) return <div className="text-center py-20">Sin datos de actividad</div>;

  return (
    <div className="max-w-lg mx-auto animate-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-sm font-bold text-[var(--tx2)] hover:text-[var(--tx)]">← Volver</button>
        <div className="flex-1">
          <p className="text-xs font-bold text-[var(--tx3)] mb-1">{session.activity.title}</p>
          <div className="h-1.5 bg-[var(--bg3)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--ac)] rounded-full transition-all" style={{ width: pct + '%' }} />
          </div>
        </div>
        <span className="text-xs font-bold text-[var(--tx2)]">{pct}%</span>
      </div>

      {/* Object + level indicator */}
      <div className="flex items-center gap-3 p-3 rounded-[var(--r)] bg-[var(--bg2)] border border-[var(--bd)] mb-4">
        <span className="text-3xl">{curStep.object_emoji}</span>
        <div className="flex-1">
          <p className="font-bold">{curStep.object_name}</p>
          <p className="text-xs text-[var(--tx3)]">Objeto {objIdx + 1} de {remaining.length}</p>
        </div>
        <div className="flex gap-1">
          {LEVEL_ORDER.map((l, i) => (
            <div key={l} className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold border-2 transition-all
              ${i < lvlIdx ? 'bg-[var(--okb)] border-[var(--ok)] text-[var(--ok)]'
              : i === lvlIdx ? 'bg-[var(--acb)] border-[var(--ac)] text-[var(--act)]'
              : 'bg-[var(--bg2)] border-[var(--bd)] text-[var(--tx3)]'}`}>
              {i < lvlIdx ? '✓' : LEVEL_META[l].icon}
            </div>
          ))}
        </div>
      </div>

      {/* Level label */}
      <div className="text-center mb-3">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--acb)] text-[var(--act)] text-sm font-bold border border-[var(--ac)]">
          {curLvlM.icon} {curLvlM.label} — {curLvlM.sub}
        </span>
      </div>

      {/* Exercise tabs (L2/L3 only) */}
      {exercises.length > 1 && (
        <div className="flex flex-wrap gap-1.5 justify-center mb-4">
          {exercises.map((e, i) => {
            const done = doneKeys.has(`${curStep.object_id}_${curLvl}_${e.id}`);
            return (
              <button key={e.id} onClick={() => setExIdx(i)} onMouseEnter={() => speak(e.label)}
                className={`px-3 py-1 rounded-[var(--r)] text-xs font-bold border transition-all
                  ${done ? 'bg-[var(--okb)] border-[var(--okbd)] text-[var(--ok)]'
                  : i === exIdx ? 'bg-[var(--ac)] border-[var(--ac)] text-white'
                  : 'bg-[var(--bg2)] border-[var(--bd)] text-[var(--tx2)] hover:border-[var(--ac)]'}`}>
                {e.icon} {e.label}{done ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Exercise content */}
      <div className="flex flex-col items-center min-h-[260px]">
        {curEx?.id === 'show' && <ShowExercise step={curStep} lvlId={curLvl} onNext={() => handleAnswer(true)} speak={speak} />}
        {curEx?.id === 'recognize' && <RecognizeExercise step={curStep} lvlId={curLvl} allSteps={steps} onAnswer={handleAnswer} speak={speak} />}
        {curEx?.id === 'relate'    && <RelateExercise    step={curStep} lvlId={curLvl} allSteps={steps} onAnswer={handleAnswer} speak={speak} />}
        {curEx?.id === 'memorize'  && <MemorizeExercise  step={curStep} lvlId={curLvl} allSteps={steps} onAnswer={handleAnswer} speak={speak} />}
      </div>

      <Overlay
        fb={fb}
        step={curStep}
        nextStep={{ remaining: steps.filter(s => !remaining.slice(0, objIdx + 1).includes(s.object_id) && s.object_id !== (remaining[objIdx])) }}
        onPick={pickNext}
      />
    </div>
  );
}
