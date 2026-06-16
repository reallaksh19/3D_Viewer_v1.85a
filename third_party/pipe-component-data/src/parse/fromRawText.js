import { buildGraphFromRows } from './buildGraphFromRows.js';

export function fromRawText(text, options = {}) {
  const rows = String(text || '')
    .split(/\r?\n/)
    .map((line, index) => parseRawLine(line, index + 1))
    .filter(Boolean);
  return buildGraphFromRows(rows, { ...options, idNamespace: options.idNamespace || 'RAW' });
}

function parseRawLine(line, sourceLine) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const row = { __line: sourceLine, raw: trimmed };
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts[0] && !parts[0].includes('=')) row.type = parts.shift();
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (!rest.length) continue;
    row[normalizeKey(key)] = rest.join('=').trim();
  }
  return row;
}

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
