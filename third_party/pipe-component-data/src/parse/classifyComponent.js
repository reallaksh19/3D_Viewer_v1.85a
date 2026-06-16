import { clean, normalizeType } from './normalizers.js';

export function classifyComponent(rowOrText) {
  const type = normalizeType(rowOrText?.type);
  if (type !== 'UNKNOWN') return type;

  const text = clean([
    rowOrText?.subtype,
    rowOrText?.name,
    rowOrText?.description,
    rowOrText?.raw,
    typeof rowOrText === 'string' ? rowOrText : '',
  ].filter(Boolean).join(' '));

  if (/\b(SHOE|GUIDE|REST|LINE\s*STOP|LINESTOP|LIMIT\s*STOP|SUPPORT)\b/.test(text)) return 'SUPPORT';
  if (/\b(WN|WELD\s*NECK|WELDNECK|FLANGE)\b/.test(text)) return 'FLANGE';
  if (/\b(GATE|GLOBE|BALL|CHECK|BUTTERFLY|VALVE|GV|BV|CV)\b/.test(text)) return 'VALVE';
  if (/\b(PIPE|LINE|RUN)\b/.test(text)) return 'PIPE';
  if (/\b(ELBOW|BEND)\b/.test(text)) return 'ELBOW';
  if (/\b(TEE|OLET|WELDOLET|SOCKOLET)\b/.test(text)) return 'TEE';
  if (/\b(REDUCER|CONCENTRIC|ECCENTRIC)\b/.test(text)) return 'REDUCER';
  return 'UNKNOWN';
}
