import usePrefsStore from '../stores/prefsStore';

export default function useListColumns(layoutKey, fallback = 1) {
  const columnCount = usePrefsStore(state => state.listLayouts?.[layoutKey] ?? fallback);
  const setListLayout = usePrefsStore(state => state.setListLayout);

  return [columnCount, (nextValue) => setListLayout(layoutKey, nextValue)];
}