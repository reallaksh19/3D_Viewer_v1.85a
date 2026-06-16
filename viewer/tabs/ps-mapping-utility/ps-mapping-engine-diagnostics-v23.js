import {
  DEFAULT_OPTIONS as BASE_DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeBasePsMappingOptions,
  runPsMappingResolver as runV22PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v22.js';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = Object.freeze({
  ...BASE_DEFAULT_OPTIONS,
  lineFamilyExtractionMode: 'builtIn',
  lineFamilyDelimiter: '-',
  lineFamilyTokenExpression: '3+4',
  lineFamilyTokenJoiner: '-',
  lineFamilyRegex: String.raw`(\d+(?:\.\d+)?["']?-[A-Z]\d{4,})`,
  lineFamilyRegexGroup: 1,
});

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

export function normalizePsMappingOptions(options = {}) {
  const normalized = normalizeBasePsMappingOptions(options);
  return {
    ...normalized,
    lineFamilyExtractionMode: clean(options.lineFamilyExtractionMode ?? normalized.lineFamilyExtractionMode ?? DEFAULT_OPTIONS.lineFamilyExtractionMode) || 'builtIn',
    lineFamilyDelimiter: clean(options.lineFamilyDelimiter ?? normalized.lineFamilyDelimiter ?? DEFAULT_OPTIONS.lineFamilyDelimiter) || '-',
    lineFamilyTokenExpression: clean(options.lineFamilyTokenExpression ?? normalized.lineFamilyTokenExpression ?? DEFAULT_OPTIONS.lineFamilyTokenExpression) || '3+4',
    lineFamilyTokenJoiner: String(options.lineFamilyTokenJoiner ?? normalized.lineFamilyTokenJoiner ?? DEFAULT_OPTIONS.lineFamilyTokenJoiner),
    lineFamilyRegex: String(options.lineFamilyRegex ?? normalized.lineFamilyRegex ?? DEFAULT_OPTIONS.lineFamilyRegex),
    lineFamilyRegexGroup: Number(options.lineFamilyRegexGroup ?? normalized.lineFamilyRegexGroup ?? DEFAULT_OPTIONS.lineFamilyRegexGroup) || 1,
  };
}

function normalizeLineKey(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/^\/+/, '')
    .replace(/-HC\b/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, '')
    .trim();
}

function builtInLineFamily(value) {
  const text = normalizeLineKey(value);
  if (!text) return '';
  const nps = String.raw`(?:\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
  const match = text.match(new RegExp(`(${nps}["']?-[A-Z]\d{4,})`, 'i'));
  if (match) return match[1].toUpperCase();
  const stem = text.match(/\b([A-Z]\d{4,})\b/i);
  return stem ? stem[1].toUpperCase() : '';
}

function delimiterRegex(delimiter) {
  const raw = clean(delimiter || '-');
  if (!raw || raw.toLowerCase() === 'auto') return /[-_/]+/;
  if (raw.toLowerCase() === 'space') return /\s+/;
  if (raw.toLowerCase() === 'tab') return /\t+/;
  return new RegExp(`[${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+`);
}

function parsePositions(expression) {
  return String(expression ?? '')
    .split('+')
    .map((item) => Number(String(item).trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function positionLineFamily(value, options) {
  const tokens = String(value ?? '')
    .replace(/^\/+/, '')
    .trim()
    .split(delimiterRegex(options.lineFamilyDelimiter))
    .map((item) => item.trim())
    .filter(Boolean);
  const picked = parsePositions(options.lineFamilyTokenExpression).map((position) => tokens[position - 1] || '').filter(Boolean);
  return picked.join(options.lineFamilyTokenJoiner ?? '-').toUpperCase();
}

function regexLineFamily(value, options) {
  const pattern = String(options.lineFamilyRegex || '').trim();
  if (!pattern) return '';
  try {
    const re = new RegExp(pattern, 'i');
    const match = String(value ?? '').match(re);
    const group = Number(options.lineFamilyRegexGroup) || 1;
    return match ? clean(match[group] ?? match[0]).toUpperCase() : '';
  } catch {
    return '';
  }
}

function configuredLineFamily(value, options) {
  const mode = upper(options.lineFamilyExtractionMode || 'builtIn');
  if (mode === 'POSITIONS') return positionLineFamily(value, options);
  if (mode === 'REGEX') return regexLineFamily(value, options);
  return builtInLineFamily(value);
}

function firstNonBlank(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

function t1LineSource(row = {}) {
  return firstNonBlank(row.nodeLine, row.table1Line, row.lineNo, row.nodeLineKey, row['Line No']);
}

function t2LineSource(row = {}) {
  return firstNonBlank(row.pipe, row.pipeKey, row.modelPipe, row.rawPipe, row['pipe'], row['Line No']);
}

function patchLineFamily(row = {}, options) {
  if (!row || typeof row !== 'object') return row;
  const mode = upper(options.lineFamilyExtractionMode || 'builtIn');
  if (mode === 'BUILTIN' || mode === 'BUILT-IN') return row;

  const t1Source = t1LineSource(row);
  const t2Source = t2LineSource(row);
  const t1Family = configuredLineFamily(t1Source, options);
  const t2Family = configuredLineFamily(t2Source, options);
  const next = { ...row };

  if (t1Family) {
    next.nodeLineFamily = t1Family;
    next.t1LineFamily = t1Family;
  }
  if (t2Family) {
    next.lineFamily = t2Family;
    next.modelLineFamily = t2Family;
    next.t2LineFamily = t2Family;
  }
  if (t1Family || t2Family) {
    next.lineFamilyExtractionMode = options.lineFamilyExtractionMode;
    next.lineFamilyExtractionConfig = mode === 'POSITIONS'
      ? `positions ${options.lineFamilyTokenExpression} delimiter ${options.lineFamilyDelimiter}`
      : `regex /${options.lineFamilyRegex}/ group ${options.lineFamilyRegexGroup}`;
  }
  if (t1Family && t2Family) {
    next.lineBasis = t1Family === t2Family ? 'LINE_FAMILY_CONFIGURED' : (next.lineBasis || 'LINE_CONFIGURED_REVIEW');
  }
  return next;
}

function patchRows(rows, options) {
  return Array.isArray(rows) ? rows.map((row) => patchLineFamily(row, options)) : rows;
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV22PsMappingResolver({ ...input, options });
  return {
    ...result,
    rows: patchRows(result.rows, options),
    outputRows: patchRows(result.outputRows, options),
    validatorRows: patchRows(result.validatorRows, options),
    candidateRows: patchRows(result.candidateRows, options),
    candidates: patchRows(result.candidates, options),
    consolidatedTable1Rows: patchRows(result.consolidatedTable1Rows, options),
    consolidatedTable2Rows: patchRows(result.consolidatedTable2Rows, options),
    table1SourceRows: patchRows(result.table1SourceRows, options),
    table2SourceRows: patchRows(result.table2SourceRows, options),
    approxConfig: {
      ...(result.approxConfig || {}),
      lineFamilyExtractionMode: options.lineFamilyExtractionMode,
      lineFamilyExtractionConfig: options.lineFamilyExtractionMode === 'positions'
        ? `delimiter=${options.lineFamilyDelimiter}; expression=${options.lineFamilyTokenExpression}; joiner=${options.lineFamilyTokenJoiner}`
        : options.lineFamilyExtractionMode === 'regex'
          ? `regex=${options.lineFamilyRegex}; group=${options.lineFamilyRegexGroup}`
          : 'built-in',
      lineFamilyExtractionNote: 'Config playground values are captured with run/copy options. Non-built-in modes update displayed line-family fields and review basis after resolver execution.',
    },
  };
}
