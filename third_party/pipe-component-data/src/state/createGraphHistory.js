export function createGraphHistory(initialGraph) {
  return {
    past: [],
    present: initialGraph,
    future: [],
  };
}

export function commitGraph(history, nextGraph) {
  if (history.present === nextGraph) return history;
  return {
    past: [...history.past, history.present],
    present: nextGraph,
    future: [],
  };
}

export function undoGraph(history) {
  if (!history.past.length) return history;
  const past = history.past.slice(0, -1);
  const present = history.past.at(-1);
  return {
    past,
    present,
    future: [history.present, ...history.future],
  };
}

export function redoGraph(history) {
  if (!history.future.length) return history;
  const [present, ...future] = history.future;
  return {
    past: [...history.past, history.present],
    present,
    future,
  };
}
