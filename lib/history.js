export function createHistory(initialState) {
  return {
    entries: [structuredClone(initialState)],
    index: 0,
  };
}

export function pushState(history, newState) {
  const entries = history.entries.slice(0, history.index + 1);
  entries.push(structuredClone(newState));
  return { entries, index: entries.length - 1 };
}

export function undo(history) {
  if (history.index <= 0) return history;
  return { ...history, index: history.index - 1 };
}

export function redo(history) {
  if (history.index >= history.entries.length - 1) return history;
  return { ...history, index: history.index + 1 };
}

export function currentState(history) {
  return history.entries[history.index];
}

export function canUndo(history) {
  return history.index > 0;
}

export function canRedo(history) {
  return history.index < history.entries.length - 1;
}
