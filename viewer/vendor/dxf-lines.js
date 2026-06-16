function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? String(Number(n.toFixed(6))) : '0';
}

function handle(id) {
  let hash = 0;
  for (const char of String(id || '0')) hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(16).toUpperCase().slice(0, 8) || '1';
}

function cleanText(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

export function lineEntity(id, start, end, layer = 'PIPECOMPONENTDATA') {
  return [
    '0', 'LINE', '5', handle(id), '8', layer,
    '10', num(start?.x), '20', num(start?.y), '30', num(start?.z),
    '11', num(end?.x), '21', num(end?.y), '31', num(end?.z),
  ];
}

export function pointEntity(id, point, layer = 'SUPPORTS') {
  return [
    '0', 'POINT', '5', handle(id), '8', layer,
    '10', num(point?.x), '20', num(point?.y), '30', num(point?.z),
  ];
}

export function textEntity(id, point, text, layer = 'LABELS', height = 2.5) {
  return [
    '0', 'TEXT', '5', handle(id), '8', layer,
    '10', num(point?.x), '20', num(point?.y), '30', num(point?.z),
    '40', num(height),
    '1', cleanText(text),
  ];
}

export function dxfHeader({ layers = [] } = {}) {
  const uniqueLayers = [...new Set(['PIPING', 'VALVES', 'FLANGES', 'SUPPORTS', 'LABELS', ...layers].filter(Boolean))];
  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS',
    '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', String(uniqueLayers.length),
    ...uniqueLayers.flatMap((layer) => ['0', 'LAYER', '2', layer, '70', '0', '62', '7', '6', 'CONTINUOUS']),
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
  ];
}

export function dxfFooter() {
  return ['0', 'ENDSEC', '0', 'EOF'];
}

export function createDxfDocument({ layers = [], entities = [] } = {}) {
  return [...dxfHeader({ layers }), ...entities.flat(), ...dxfFooter()].join('\n');
}

export function parseEntityCount(dxf, entityName) {
  const tokens = String(dxf || '').split(/\r?\n/);
  let count = 0;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (tokens[i] === '0' && tokens[i + 1] === entityName) count += 1;
  }
  return count;
}
