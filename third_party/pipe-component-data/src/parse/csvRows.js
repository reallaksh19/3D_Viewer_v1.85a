export function parseCsvRows(csvText) {
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (!rows.length) return [];
  const headers = rows[0].map((cell) => normalizeHeader(cell));
  return rows.slice(1).map((cells, index) => toObject(headers, cells, index + 2));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < String(text || '').length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function toObject(headers, cells, sourceLine) {
  const row = { __line: sourceLine };
  for (let i = 0; i < headers.length; i += 1) {
    row[headers[i]] = (cells[i] ?? '').trim();
  }
  return row;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
