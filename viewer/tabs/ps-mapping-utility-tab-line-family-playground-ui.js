import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-support-prefix-ui.js?v=20260614-support-prefix-ui-1';

const STYLE_ID = 'psmap-line-family-playground-style';

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
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
  const raw = String(delimiter ?? '-').trim();
  if (!raw || raw.toLowerCase() === 'auto') return /[-_/]+/;
  if (raw === 'space') return /\s+/;
  if (raw === 'tab') return /\t+/;
  return new RegExp(`[${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+`);
}

function splitTokens(value, delimiter) {
  return String(value ?? '')
    .replace(/^\/+/, '')
    .trim()
    .split(delimiterRegex(delimiter))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositionExpression(expression) {
  return String(expression ?? '')
    .split('+')
    .map((item) => Number(String(item).trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function positionLineFamily(value, delimiter, expression, joiner = '-') {
  const tokens = splitTokens(value, delimiter);
  const positions = parsePositionExpression(expression || '4+5');
  const picked = positions.map((position) => tokens[position - 1] || '').filter(Boolean);
  return {
    tokens,
    positions,
    picked,
    value: picked.join(joiner || '-').toUpperCase(),
  };
}

function regexLineFamily(value, pattern, groupText) {
  const text = String(value ?? '');
  const group = Number(groupText || 1);
  if (!String(pattern || '').trim()) return { value: '', error: '' };
  try {
    const re = new RegExp(pattern, 'i');
    const match = text.match(re);
    return { value: match ? clean(match[group] ?? match[0]).toUpperCase() : '', error: '' };
  } catch (error) {
    return { value: '', error: error?.message || String(error) };
  }
}

function readValue(host, selector, fallback = '') {
  return host.querySelector(selector)?.value ?? fallback;
}

function renderPlayground(host) {
  const sample = readValue(host, '[data-psmap-line-family-sample]', 'ASIM-1885-10"-S8810101-91261M7-HC');
  const mode = readValue(host, '[data-psmap-setup="lineFamilyExtractionMode"]', 'builtIn');
  const delimiter = readValue(host, '[data-psmap-setup="lineFamilyDelimiter"]', '-');
  const expression = readValue(host, '[data-psmap-setup="lineFamilyTokenExpression"]', '3+4');
  const joiner = readValue(host, '[data-psmap-setup="lineFamilyTokenJoiner"]', '-');
  const pattern = readValue(host, '[data-psmap-setup="lineFamilyRegex"]', '');
  const group = readValue(host, '[data-psmap-setup="lineFamilyRegexGroup"]', '1');

  const builtIn = builtInLineFamily(sample);
  const positional = positionLineFamily(sample, delimiter, expression, joiner);
  const regex = regexLineFamily(sample, pattern, group);
  const finalValue = mode === 'positions'
    ? positional.value
    : mode === 'regex'
      ? regex.value
      : builtIn;

  const result = host.querySelector('[data-psmap-line-family-result]');
  if (!result) return;
  result.innerHTML = `Sample: ${h(sample)}\nBuilt-in result: ${h(builtIn || '-')}\nTokens (${h(delimiter || 'auto')}):\n${positional.tokens.map((token, index) => `  ${index + 1}: ${token}`).join('\n') || '  -'}\nPosition expression: ${h(expression || '-')}\nPicked tokens: ${h(positional.picked.join(' + ') || '-')}\nPosition result: ${h(positional.value || '-')}\nRegex result: ${h(regex.error ? `ERROR: ${regex.error}` : (regex.value || '-'))}\nFinal selected (${h(mode)}): ${h(finalValue || '-')}`;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psmap-line-family-playground{border:1px solid rgba(96,165,250,.32);background:rgba(15,23,42,.62);border-radius:12px;padding:12px;margin-top:10px}.psmap-line-family-playground h4{margin:0 0 8px;color:#dbeafe}.psmap-line-family-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.psmap-line-family-grid label{display:grid;gap:4px;font-size:12px;color:#cbd5e1}.psmap-line-family-grid input,.psmap-line-family-grid select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.25);border-radius:8px;background:#020617;color:#e5edf7;padding:6px 8px;font:12px ui-monospace,Consolas,monospace}.psmap-line-family-result{margin-top:8px;border-radius:10px;padding:9px;background:rgba(2,6,23,.68);color:#d1fae5;font:12px ui-monospace,Consolas,monospace;white-space:pre-wrap}.psmap-line-family-help{margin-top:7px;color:#fef3c7;font-size:12px}`;
  document.head.appendChild(style);
}

function ensureLineFamilyPlayground() {
  const panel = document.querySelector('[data-psmap-panel="config"]');
  if (!panel || panel.querySelector('[data-psmap-line-family-playground]')) return;
  installStyle();
  const host = document.createElement('div');
  host.className = 'psmap-line-family-playground';
  host.setAttribute('data-psmap-line-family-playground', '1');
  host.innerHTML = `<h4>Line Family Playground</h4>
    <div class="psmap-line-family-grid">
      <label>Sample Line No / Pipe<input data-psmap-line-family-sample value="/ASIM-1885-10&quot;-S8810101-91261M7-HC"></label>
      <label>Extraction mode<select data-psmap-setup="lineFamilyExtractionMode"><option value="builtIn">Built-in regex</option><option value="positions">Token positions</option><option value="regex">Custom regex</option></select></label>
      <label>Delimiter<input data-psmap-setup="lineFamilyDelimiter" value="-" placeholder="-, _, /, auto, space, tab"></label>
      <label>Token expression<input data-psmap-setup="lineFamilyTokenExpression" value="3+4" placeholder="Example: 3+4 or 4+5"></label>
      <label>Token joiner<input data-psmap-setup="lineFamilyTokenJoiner" value="-" placeholder="- or blank"></label>
      <label>Regex group<input data-psmap-setup="lineFamilyRegexGroup" type="number" value="1" min="0"></label>
      <label style="grid-column:1/-1">Custom regex<input data-psmap-setup="lineFamilyRegex" value="(\\d+(?:\\.\\d+)?[&quot;']?-[A-Z]\\d{4,})" placeholder="Capture group should return line family"></label>
    </div>
    <pre data-psmap-line-family-result class="psmap-line-family-result"></pre>
    <div class="psmap-line-family-help">Use token positions when client line formats vary. Example: for <code>ASIM-1885-10&quot;-S8810101-91261M7-HC</code>, delimiter <code>-</code> and expression <code>3+4</code> gives <code>10&quot;-S8810101</code>. If your format requires 4th+5th tokens, enter <code>4+5</code>.</div>`;
  (panel.querySelector('.psmap-card-body') || panel).appendChild(host);
  const update = () => renderPlayground(host);
  host.addEventListener('input', update);
  host.addEventListener('change', update);
  update();
}

function installLineFamilyPlayground() {
  installStyle();
  const observer = new MutationObserver(ensureLineFamilyPlayground);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', ensureLineFamilyPlayground, true);
  document.addEventListener('change', ensureLineFamilyPlayground, true);
  ensureLineFamilyPlayground();
  return () => {
    observer.disconnect();
    document.removeEventListener('input', ensureLineFamilyPlayground, true);
    document.removeEventListener('change', ensureLineFamilyPlayground, true);
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyPlayground = installLineFamilyPlayground();
  return () => {
    try { destroyPlayground?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
