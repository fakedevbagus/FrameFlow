export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  maxEntries: number;
}

export function createHistoryState<T>(present: T, maxEntries = 100): HistoryState<T> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("History max entries must be a positive integer.");
  }

  return {
    past: [],
    present,
    future: [],
    maxEntries,
  };
}

export function commitHistory<T>(
  state: HistoryState<T>,
  next: T,
): HistoryState<T> {
  if (Object.is(state.present, next)) {
    return state;
  }

  return {
    ...state,
    past: [...state.past, state.present].slice(-state.maxEntries),
    present: next,
    future: [],
  };
}

export function undoHistory<T>(
  state: HistoryState<T>,
): HistoryState<T> {
  const previous = state.past[state.past.length - 1];

  if (previous === undefined) {
    return state;
  }

  return {
    ...state,
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, state.maxEntries),
  };
}

export function redoHistory<T>(
  state: HistoryState<T>,
): HistoryState<T> {
  const next = state.future[0];

  if (next === undefined) {
    return state;
  }

  return {
    ...state,
    past: [...state.past, state.present].slice(-state.maxEntries),
    present: next,
    future: state.future.slice(1),
  };
}

export function resetHistory<T>(
  present: T,
  maxEntries = 100,
): HistoryState<T> {
  return createHistoryState(present, maxEntries);
}
