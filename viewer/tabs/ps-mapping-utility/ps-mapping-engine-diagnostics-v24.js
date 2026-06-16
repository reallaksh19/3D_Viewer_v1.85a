import {
  DEFAULT_OPTIONS as BASE_DEFAULT_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as normalizeBasePsMappingOptions,
  runPsMappingResolver as runV23PsMappingResolver,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v23.js';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = Object.freeze({
  ...BASE_DEFAULT_OPTIONS,
  table1LineFamilyExtractionMode: 'inherit',
  table1LineFamilyDelimiter: '',
  table1LineFamilyTokenExpression: '',
  table1LineFamilyTokenJoiner: '',
  table1LineFamilyRegex: '',
  table1LineFamilyRegexGroup: '',
  table2LineFamilyExtractionMode: 'inherit',
  table2LineFamilyDelimiter: '',
  table2LineFamilyTokenExpression: '',
  table2LineFamilyTokenJoiner: '',
  table2LineFamilyRegex: '',
  table2LineFamilyRegexGroup: '',
});

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

function optionText(options, name, fallback = '') {
  const value = options?.[name];
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizePsMappingOptions(options = {}) {
  const normalized = normalizeBasePsMappingOptions(options);
  return {
    ...normalized,
    table1LineFamilyExtractionMode: optionText(options, 'table1LineFamilyExtractionMode', normalized.table1LineFamilyExtractionMode || 'inherit'),
    table1LineFamilyDelimiter: String(options.table1LineFamilyDelimiter ?? normalized.table1LineFamilyDelimiter ?? ''),
    table1LineFamilyTokenExpression: String(options.table1LineFamilyTokenExpression ?? normalized.table1LineFamilyTokenExpression ?? ''),
    table1LineFamilyTokenJoiner: String(options.table1LineFamilyTokenJoiner ?? normalized.table1LineFamilyTokenJoiner ?? ''),
    table1LineFamilyRegex: String(options.table1LineFamilyRegex ?? normalized.table1LineFamilyRegex ?? ''),
    table1LineFamilyRegexGroup: String(options.table1LineFamilyRegexGroup ?? normalized.table1LineFamilyRegexGroup ?? ''),
    table2LineFamilyExtractionMode: optionText(options, 'table2LineFamilyExtractionMode', normalized.table2LineFamilyExtractionMode || 'inherit'),
    table2LineFamilyDelimiter: String(options.table2LineFamilyDelimiter ?? normalized.table2LineFamilyDelimiter ?? ''),
    table2LineFamilyTokenExpression: String(options.table2LineFamilyTokenExpression ?? normalized.table2LineFamilyTokenExpression ?? ''),
    table2LineFamilyTokenJoiner: String(options.table2LineFamilyTokenJoiner ?? normalized.table2LineFamilyTokenJoiner ?? ''),
    table2LineFamilyRegex: String(options.table2LineFamilyRegex ?? normalized.table2LineFamilyRegex ?? ''),
    table2LineFamilyRegexGroup: String(options.table2LineFamilyRegexGroup ?? normalized.table2LineFamilyRegexGroup ?? ''),
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

function positionLineFamily(value, delimiter, expression, joiner = '-') {
  const tokens = String(value ?? '')
    .replace(/^\/+/, '')
    .trim()
    .split(delimiterRegex(delimiter || '-'))
    .map((item) => item.trim())
    .filter(Boolean);
  const picked = parsePositions(expression || '3+4').map((position) => tokens[position - 1] || '').filter(Boolean);
  return picked.join(joiner || '-').toUpperCase();
}

function regexLineFamily(value, pattern, groupText = 1) {
  const source = String(pattern || '').trim();
  if (!source) return '';
  try {
    const re = new RegExp(source, 'i');
    const match = String(value ?? '').match(re);
    const group = Number(groupText || 1) || 1;
    return match ? clean(match[group] ?? match[0]).toUpperCase() : '';
  } catch {
    return '';
  }
}

function sideConfig(options, side) {
  const prefix = side === 'table1' ? 'table1' : 'table2';
  const mode = upper(options[`${prefix}LineFamilyExtractionMode`] || 'inherit');
  if (!mode || mode === 'INHERIT' || mode === 'SAME_AS_GLOBAL' || mode === 'SAME AS GLOBAL') return null;
  return {
    side,
    mode,
    delimiter: String(options[`${prefix}LineFamilyDelimiter`] || options.lineFamilyDelimiter || '-'),
    tokenExpression: String(options[`${prefix}LineFamilyTokenExpression`] || options.lineFamilyTokenExpression || '3+4'),
    tokenJoiner: String(options[`${prefix}LineFamilyTokenJoiner`] || options.lineFamilyTokenJoiner || '-'),
    regex: String(options[`${prefix}LineFamilyRegex`] || options.lineFamilyRegex || ''),
    regexGroup: String(options[`${prefix}LineFamilyRegexGroup`] || options.lineFamilyRegexGroup || '1'),
  };
}

function configuredLineFamily(value, cfg) {
  if (!cfg) return '';
  if (cfg.mode === 'POSITIONS') return positionLineFamily(value, cfg.delimiter, cfg.tokenExpression, cfg.tokenJoiner);
  if (cfg.mode === 'REGEX') return regexLineFamily(value, cfg.regex, cfg.regexGroup);
  if (cfg.mode === 'BUILTIN' || cfg.mode === 'BUILT-IN') return builtInLineFamily(value);
  return '';
}

function firstNonBlank(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

function t1LineSource(row = {}) {
  return firstNonBlank(row.nodeLine, row.table1Line, row.lineNo, row.nodeLineKey, row['Line No'], row['Table-1 Line No']);
}

function t2LineSource(row = {}) {
  return firstNonBlank(row.pipe, row.pipeKey, row.modelPipe, row.rawPipe, row['pipe'], row['Table-2 pipe'], row['Line No']);
}

function extractionSummary(cfg) {
  if (!cfg) return '';
  if (cfg.mode === 'POSITIONS') return `${cfg.side}: positions ${cfg.tokenExpression} delimiter ${cfg.delimiter} joiner ${cfg.tokenJoiner}`;
  if (cfg.mode === 'REGEX') return `${cfg.side}: regex /${cfg.regex}/ group ${cfg.regexGroup}`;
  return `${cfg.side}: built-in`;
}

function patchLineFamily(row = {}, options) {
  if (!row || typeof row !== 'object') return row;
  const t1Cfg = sideConfig(options, 'table1');
  const t2Cfg = sideConfig(options, 'table2');
  if (!t1Cfg && !t2Cfg) return row;

  const t1Family = configuredLineFamily(t1LineSource(row), t1Cfg);
  const t2Family = configuredLineFamily(t2LineSource(row), t2Cfg);
  const next = { ...row };

  if (t1Family) {
    next.nodeLineFamily = t1Family;
    next.t1LineFamily = t1Family;
    next.table1ConfiguredLineFamily = t1Family;
  }
  if (t2Family) {
    next.lineFamily = t2Family;
    next.modelLineFamily = t2Family;
    next.t2LineFamily = t2Family;
    next.table2ConfiguredLineFamily = t2Family;
  }
  if (t1Family || t2Family) {
    next.lineFamilyExtractionMode = 'side-specific';
    next.lineFamilyExtractionConfig = [extractionSummary(t1Cfg), extractionSummary(t2Cfg)].filter(Boolean).join('; ');
  }
  if (t1Family && t2Family) {
    next.lineBasis = t1Family === t2Family ? 'LINE_FAMILY_CONFIGURED' : 'LINE_CONFIGURED_REVIEW';
  }
  return next;
}

function patchRows(rows, options) {
  return Array.isArray(rows) ? rows.map((row) => patchLineFamily(row, options)) : rows;
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = runV23PsMappingResolver({ ...input, options });
  const t1Cfg = sideConfig(options, 'table1');
  const t2Cfg = sideConfig(options, 'table2');
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
      table1LineFamilyExtractionConfig: extractionSummary(t1Cfg) || 'inherit/global',
      table2LineFamilyExtractionConfig: extractionSummary(t2Cfg) || 'inherit/global',
      lineFamilyExtractionNote: 'Table-1 and Table-2 can use different line-family extraction rules. Side-specific rules override the shared/global playground rule after resolver execution.',
    },
  };
}
