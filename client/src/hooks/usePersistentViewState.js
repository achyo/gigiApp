import { useMemo } from 'react';
import usePrefsStore from '../stores/prefsStore';

function cloneDefaults(defaults) {
  return JSON.parse(JSON.stringify(defaults));
}

function areStatesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function usePersistentViewState(viewKey, defaults) {
  const storageKey = `view:${viewKey}`;
  const rawValue = usePrefsStore((state) => state.listLayouts?.[storageKey]);
  const setListLayout = usePrefsStore((state) => state.setListLayout);

  const state = useMemo(() => {
    const base = cloneDefaults(defaults);
    return rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
      ? { ...base, ...rawValue }
      : base;
  }, [defaults, rawValue]);

  const updateState = (nextValue) => {
    const resolved = typeof nextValue === 'function'
      ? nextValue(state)
      : { ...state, ...nextValue };

    if (areStatesEqual(resolved, rawValue || {})) {
      return;
    }

    setListLayout(storageKey, resolved);
  };

  const resetState = () => {
    const nextState = cloneDefaults(defaults);
    if (areStatesEqual(nextState, rawValue || {})) {
      return;
    }
    setListLayout(storageKey, nextState);
  };

  return [state, updateState, resetState];
}