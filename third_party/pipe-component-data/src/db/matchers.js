export function norm(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function same(a, b) {
  return norm(a) === norm(b);
}

export function miss(code, query) {
  return {
    ok: false,
    code,
    message: code,
    query: { ...(query || {}) },
  };
}

export function hit(row, matchKey, provenance) {
  return {
    ok: true,
    row,
    matchKey,
    provenance,
  };
}
