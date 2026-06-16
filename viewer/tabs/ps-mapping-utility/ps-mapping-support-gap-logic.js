const GAP_NUMBER = '(-?\\d+(?:\\.\\d+)?)';
const MM_UNIT = '(?:m\\s*m|millimet(?:er|re)s?)';
const GAP_SEP = '(?:=|:|-|\\bis\\b)?';
const SUPPORT_ORDER = Object.freeze(['GUIDE', 'LINE_STOP']);

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function upper(value) {
  return clean(value).toUpperCase();
}

export function normalizeGapSource(value) {
  return String(value ?? '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\[\](){}]/g, ' ')
    .replace(/,/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numeric(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function setGap(out, kind, rawValue) {
  const value = numeric(rawValue);
  if (value == null) return;
  out[kind] = value;
}

export function supportTypesFromText(...values) {
  const source = upper(values.join(' '))
    .replace(/[_-]+/g, ' ')
    .replace(/[\[\](){}:;,|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const out = new Set();
  if (!source) return out;
  if (/\bREST\b|\bPIPE\s+REST\b|\bXRT\b|\bPIPE\s+SHOE\b|\bWEAR\s+PLATE\b|\bSHOE\b/.test(source)) out.add('REST');
  if (/\bGUIDE\b/.test(source)) out.add('GUIDE');
  if (/\bLINE\s*STOP\b|\bLINESTOP\b|\bLIMIT\s*STOP\b|\bPIPE\s+STOP\b|\bDIRECTIONAL\s+ANCHOR\b|\bANCHOR\b|\bSTOP\b/.test(source)) out.add('LINE_STOP');
  return out;
}

function singleGapParent(parentTypes = new Set()) {
  const parents = SUPPORT_ORDER.filter((type) => parentTypes.has(type));
  return parents.length === 1 ? parents[0] : '';
}

function firstMatchValue(source, patterns = []) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractTypedSupportGaps(value, parentTypes = new Set(), { fieldFallback = false } = {}) {
  const source = normalizeGapSource(value).toUpperCase();
  const out = {};
  if (!source) return out;

  const lineStopValue = firstMatchValue(source, [
    new RegExp(`\\b(?:LINE\\s*STOP|LINESTOP|STOP)\\s*GAP\\b\\s*${GAP_SEP}\\s*${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\b`, 'i'),
    new RegExp(`\\b${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\s*(?:LINE\\s*STOP|LINESTOP|STOP)\\s*GAP\\b`, 'i'),
  ]);
  if (lineStopValue != null) setGap(out, 'LINE_STOP', lineStopValue);

  const guideValue = firstMatchValue(source, [
    new RegExp(`\\bGUIDE\\s*GAP\\b\\s*${GAP_SEP}\\s*${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\b`, 'i'),
    new RegExp(`\\b${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\s*GUIDE\\s*GAP\\b`, 'i'),
  ]);
  if (guideValue != null) setGap(out, 'GUIDE', guideValue);

  if (out.GUIDE != null || out.LINE_STOP != null) return out;

  const inferredParent = singleGapParent(parentTypes);
  if (!inferredParent) return out;

  const genericValue = firstMatchValue(source, [
    new RegExp(`\\bGAP\\b\\s*${GAP_SEP}\\s*${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\b`, 'i'),
    new RegExp(`\\b${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\s*GAP\\b`, 'i'),
  ]);
  if (genericValue != null) {
    setGap(out, inferredParent, genericValue);
    return out;
  }

  if (fieldFallback) {
    const fallback = source.match(new RegExp(`^\\s*${GAP_NUMBER}\\s*(?:${MM_UNIT})?\\s*$`, 'i'));
    if (fallback) setGap(out, inferredParent, fallback[1]);
  }

  return out;
}

function supportLabel(type) {
  return type === 'LINE_STOP' ? 'LINE STOP' : type;
}

function gapLabel(type) {
  return `${supportLabel(type)} GAP`;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return clean(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export function evaluateSupportGapComparison({
  table1Text = '',
  table2Text = '',
  table2GapRaw = '',
  tolerance = 0,
  enabled = true,
} = {}) {
  if (enabled === false) return { status: '', detail: '', kind: '', table1GapMm: '', table2GapMm: '' };

  const table1Types = supportTypesFromText(table1Text);
  const table2Types = supportTypesFromText(table2Text);
  const table1Gaps = extractTypedSupportGaps(table1Text, table1Types, { fieldFallback: false });
  const table2GapFromText = extractTypedSupportGaps(table2Text, table2Types, { fieldFallback: false });
  const table2GapFromField = extractTypedSupportGaps(table2GapRaw, table2Types, { fieldFallback: true });
  const table2Gaps = { ...table2GapFromText, ...table2GapFromField };
  const tol = Number(tolerance || 0);

  for (const kind of SUPPORT_ORDER) {
    if (!table1Types.has(kind) || !table2Types.has(kind)) continue;

    const t1 = table1Gaps[kind];
    const t2 = table2Gaps[kind];
    const label = gapLabel(kind);
    const statusPrefix = `${kind}_GAP`;

    if (t1 != null && t2 != null) {
      if (Math.abs(Number(t2) - Number(t1)) <= tol) {
        return {
          status: `${statusPrefix}_EXACT`,
          detail: `Table-2 ${label} ${formatNumber(t2)} mm matches Table-1C ${label} ${formatNumber(t1)} mm.`,
          kind,
          table1GapMm: t1,
          table2GapMm: t2,
        };
      }
      return {
        status: `${statusPrefix}_CONFLICT`,
        detail: `Support gap conflict: Table-2 ${label} ${formatNumber(t2)} mm differs from Table-1C ${label} ${formatNumber(t1)} mm.`,
        kind,
        table1GapMm: t1,
        table2GapMm: t2,
      };
    }

    if (t1 != null && t2 == null) {
      return {
        status: `${statusPrefix}_MISSING_TABLE2`,
        detail: `Support gap missing in Table-2 for ${supportLabel(kind)}; Table-1C ${label} is ${formatNumber(t1)} mm.`,
        kind,
        table1GapMm: t1,
        table2GapMm: '',
      };
    }

    if (t2 != null && t1 == null) {
      return {
        status: `${statusPrefix}_MISSING_TABLE1`,
        detail: `Support gap ${formatNumber(t2)} mm exists in Table-2 for ${supportLabel(kind)}, but Table-1C ${label} is missing.`,
        kind,
        table1GapMm: '',
        table2GapMm: t2,
      };
    }
  }

  return { status: '', detail: '', kind: '', table1GapMm: '', table2GapMm: '' };
}
