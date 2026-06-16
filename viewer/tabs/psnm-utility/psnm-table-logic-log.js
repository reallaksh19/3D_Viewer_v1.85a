function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^-{3,}$/.test(line));
}

function splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((cell) => cell.trim());
  return raw.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function norm(value) {
  return String(value || '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectDelimiter(firstLine) {
  if (String(firstLine || '').includes('\t')) return 'TAB';
  if (String(firstLine || '').includes(',')) return 'COMMA_OR_POSITION_TEXT';
  return 'MULTI_SPACE_OR_SINGLE_FIELD';
}

function firstHeaderInfo(text, synonyms = []) {
  const lines = splitLines(text);
  const first = lines[0] || '';
  const cells = splitCells(first);
  const headers = cells.map(norm);
  const matched = [];
  for (const [field, names] of synonyms) {
    const hit = headers.find((header) => names.includes(header));
    if (hit) matched.push(`${field}<=${hit}`);
  }
  return {
    lines,
    first,
    cells,
    headers,
    delimiter: detectDelimiter(first),
    headerDetected: matched.length > 0,
    matched,
  };
}

function log(logger, table, item, reason, suggestedAction, data = {}) {
  logger?.user?.('INFO', 'Table Logic', table, item, reason, suggestedAction, data);
}

function warn(logger, table, item, reason, suggestedAction, data = {}) {
  logger?.user?.('WARNING', 'Table Logic', table, item, reason, suggestedAction, data);
}

export function PSNM_logPsTableLogic({ logger, table1Text, table1Rows = [], table4AText, table4ARows = [] }) {
  const table1 = firstHeaderInfo(table1Text, [
    ['PS Name', ['ps name', 'psname', 'ps no', 'ps number', 'ps', 'name', 'support name', 'support point']],
    ['Position', ['position', 'ps position', 'position raw', 'coordinates', 'coord', 'coordinate']],
    ['p1bore', ['p1bore', 'p1 bore', 'bore', 'nb', 'dn', 'bore mm', 'bore(mm)']],
    ['Mandatory', ['mandatory', 'required', 'req', 'm']],
  ]);
  if (!table1.lines.length) {
    warn(logger, 'Table 1', 'No input', 'Table 1 is empty; Master PS No cannot be built.', 'Paste PS source rows before resolving.', {});
  } else if (table1.headerDetected) {
    log(logger, 'Table 1', 'Header-based parser', `Header row detected. Columns derived by synonym matching: ${table1.matched.join(', ') || 'none'}.`, 'Header order may change if synonyms are recognized.', {
      mode: 'HEADERED_FLEXIBLE',
      delimiter: table1.delimiter,
      headerCells: table1.cells,
      matchedColumns: table1.matched,
      parsedRows: table1Rows.length,
    });
  } else {
    const canonical = table1.cells.length >= 3 && /^PS[-_/A-Z0-9.]+(?:\/DATUM)?$/i.test(table1.cells[0] || '') && /\b[ESNUWD]\b/i.test(table1.cells.join(' '));
    log(logger, 'Table 1', canonical ? 'Headerless canonical parser' : 'Fallback pattern parser', canonical
      ? 'No header row detected. Logic derived as Column 1=PS Name, Column 2=Position, Column 3=p1bore when the last numeric non-position cell is present.'
      : 'No header row detected. Logic derived by pattern extraction: PS-* token for name, E/S/U tokens for position, numeric non-position token for bore if available.',
      'For reordered columns, provide a header row so the parser can map fields by name.', {
        mode: canonical ? 'HEADERLESS_CANONICAL' : 'HEADERLESS_PATTERN',
        delimiter: table1.delimiter,
        firstRowCells: table1.cells,
        assumedOrder: canonical ? ['PS Name', 'Position', 'p1bore'] : [],
        parsedRows: table1Rows.length,
      });
  }

  const table4A = firstHeaderInfo(table4AText, [
    ['PS Name', ['ps name', 'psname', 'mandatory ps name', 'ps', 'ps no', 'ps number']],
    ['Mandatory', ['mandatory', 'required', 'req', 'm']],
    ['p1bore override', ['p1bore', 'p1 bore', 'bore', 'nb', 'dn', 'bore override']],
    ['Position override', ['position', 'position override', 'ps position']],
  ]);
  if (!table4A.lines.length) {
    log(logger, 'Table 4A', 'Empty optional table', 'No mandatory/override PS rows supplied.', 'Only Table 1 PS rows will be used unless Table 4A is pasted.', { mode: 'EMPTY_OPTIONAL' });
  } else if (table4A.headerDetected) {
    log(logger, 'Table 4A', 'Header-based override parser', `Header row detected. Columns derived by synonym matching: ${table4A.matched.join(', ') || 'none'}.`, 'Header order may change if synonyms are recognized.', {
      mode: 'HEADERED_FLEXIBLE',
      delimiter: table4A.delimiter,
      headerCells: table4A.cells,
      matchedColumns: table4A.matched,
      parsedRows: table4ARows.length,
    });
  } else {
    log(logger, 'Table 4A', 'Headerless mandatory list parser', 'No header row detected. Logic derived as one PS name per row; each row is treated as mandatory.', 'Use a header row only when adding bore/position override columns.', {
      mode: 'HEADERLESS_LIST',
      delimiter: table4A.delimiter,
      firstRowCells: table4A.cells,
      parsedRows: table4ARows.length,
    });
  }
}

export function PSNM_logNodeTableLogic({ logger, table2Text, table2Rows = [], table3Text, table3Rows = [], table4BText, table4BRows = [] }) {
  const table2 = firstHeaderInfo(table2Text, [
    ['Node', ['node', 'node no', 'node number']],
    ['X', ['x', 'raw x', 'node x', 'coord x']],
    ['Y', ['y', 'raw y', 'node y', 'coord y']],
    ['Z', ['z', 'raw z', 'node z', 'coord z']],
    ['Position', ['position', 'position(x,y,z)', 'position(x,y,z) transformed', 'transformed position']],
    ['Bore', ['bore', 'nb', 'dn', 'nominal bore', 'bore mm', 'bore(mm)']],
    ['Mandatory', ['mandatory', 'required', 'req', 'm']],
  ]);
  if (!table2.lines.length) {
    warn(logger, 'Table 2', 'No input', 'Table 2 is empty; Master Node cannot be built.', 'Paste Node XYZ rows before resolving.', {});
  } else if (table2.headerDetected) {
    log(logger, 'Table 2', 'Header-based parser', `Header row detected. Columns derived by synonym matching: ${table2.matched.join(', ') || 'none'}.`, 'Header order may change if synonyms are recognized.', {
      mode: 'HEADERED_FLEXIBLE',
      delimiter: table2.delimiter,
      headerCells: table2.cells,
      matchedColumns: table2.matched,
      parsedRows: table2Rows.length,
    });
  } else {
    const canonical = table2.cells.length >= 4;
    log(logger, 'Table 2', canonical ? 'Headerless canonical parser' : 'Fallback parser', canonical
      ? 'No header row detected. Logic should be Column 1=Node, Column 2=X, Column 3=Y, Column 4=Z, Column 5=Bore optional, Column 6=Mandatory optional.'
      : 'No header row detected and fewer than four columns found; parser can only recover rows with recognizable Node and X/Y/Z or Position pattern.',
      'For reordered columns, provide a header row so the parser can map fields by name.', {
        mode: canonical ? 'HEADERLESS_CANONICAL_EXPECTED' : 'HEADERLESS_PATTERN_EXPECTED',
        delimiter: table2.delimiter,
        firstRowCells: table2.cells,
        assumedOrder: canonical ? ['Node', 'X', 'Y', 'Z', 'Bore?', 'Mandatory?'] : [],
        parsedRows: table2Rows.length,
      });
  }

  const table3 = firstHeaderInfo(table3Text, [
    ['Node', ['node', 'node no', 'node number']],
    ['Dia/OD', ['dia(mm)', 'dia mm', 'dia', 'od', 'od mm', 'outside dia', 'outside diameter']],
  ]);
  if (!table3.lines.length) {
    log(logger, 'Table 3', 'Empty optional table', 'No OD/Dia rows supplied; derived bore will be unavailable unless Table 2 bore or Table 4B override exists.', 'Paste Node/Dia rows when Table 2 bore is blank.', { mode: 'EMPTY_OPTIONAL' });
  } else if (table3.headerDetected) {
    log(logger, 'Table 3', 'Header-based parser', `Header row detected. Columns derived by synonym matching: ${table3.matched.join(', ') || 'none'}.`, 'Header order may change if synonyms are recognized.', {
      mode: 'HEADERED_FLEXIBLE',
      delimiter: table3.delimiter,
      headerCells: table3.cells,
      matchedColumns: table3.matched,
      parsedRows: table3Rows.length,
    });
  } else {
    log(logger, 'Table 3', 'Headerless two-column parser', 'No header row detected. Logic derived as Column 1=Node and Column 2=Dia/OD(mm).', 'For reordered columns, provide a header row.', {
      mode: 'HEADERLESS_CANONICAL',
      delimiter: table3.delimiter,
      firstRowCells: table3.cells,
      assumedOrder: ['Node', 'Dia/OD(mm)'],
      parsedRows: table3Rows.length,
    });
  }

  const table4B = firstHeaderInfo(table4BText, [
    ['Node', ['node', 'node no', 'node number', 'mandatory node no', 'mandatory node']],
    ['Mandatory', ['mandatory', 'required', 'req', 'm']],
    ['Bore override', ['bore', 'nb', 'dn', 'bore override']],
    ['Occurrence', ['occurrence', 'occurrence id']],
  ]);
  if (!table4B.lines.length) {
    log(logger, 'Table 4B', 'Empty optional table', 'No mandatory/override node rows supplied.', 'Only Table 2/Table 3 node rows will be used unless Table 4B is pasted.', { mode: 'EMPTY_OPTIONAL' });
  } else if (table4B.headerDetected) {
    log(logger, 'Table 4B', 'Header-based override parser', `Header row detected. Columns derived by synonym matching: ${table4B.matched.join(', ') || 'none'}.`, 'Header order may change if synonyms are recognized.', {
      mode: 'HEADERED_FLEXIBLE',
      delimiter: table4B.delimiter,
      headerCells: table4B.cells,
      matchedColumns: table4B.matched,
      parsedRows: table4BRows.length,
    });
  } else {
    log(logger, 'Table 4B', 'Headerless mandatory list parser', 'No header row detected. Logic derived as one Node number per row; each row is treated as mandatory.', 'Use a header row only when adding bore/occurrence override columns.', {
      mode: 'HEADERLESS_LIST',
      delimiter: table4B.delimiter,
      firstRowCells: table4B.cells,
      parsedRows: table4BRows.length,
    });
  }
}
