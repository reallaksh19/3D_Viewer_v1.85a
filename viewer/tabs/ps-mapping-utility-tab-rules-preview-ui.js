import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-header-map-ui.js?v=20260611-psmap-header-map-1';

const STYLE_ID = 'psmap-rules-preview-style';

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
  if (raw.toLowerCase() === 'space') return /\s+/;
  if (raw.toLowerCase() === 'tab') return /\t+/;
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
  const positions = parsePositionExpression(expression || '3+4');
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

function editDistance(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  const dp = Array.from({ length: x.length + 1 }, () => Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= y.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= x.length; i += 1) {
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[x.length][y.length];
}

function readValue(host, selector, fallback = '') {
  return host.querySelector(selector)?.value ?? fallback;
}

function sidePrefix(side) {
  return side === 'table1' ? 'table1' : 'table2';
}

function sideTitle(side) {
  return side === 'table1' ? 'Table-1 Line No' : 'Table-2 pipe / line';
}

function renderSide(host, side) {
  const prefix = sidePrefix(side);
  const sampleDefault = side === 'table1'
    ? '/ASIM-1885-10"-S8810111-91261M7-HC'
    : 'ASIM-1885-10"-S8810111-91261M7-HC';
  const sample = readValue(host, `[data-psmap-line-family-sample="${side}"]`, sampleDefault);
  const mode = readValue(host, `[data-psmap-setup="${prefix}LineFamilyExtractionMode"]`, 'inherit');
  const delimiter = readValue(host, `[data-psmap-setup="${prefix}LineFamilyDelimiter"]`, '-');
  const expression = readValue(host, `[data-psmap-setup="${prefix}LineFamilyTokenExpression"]`, '3+4');
  const joiner = readValue(host, `[data-psmap-setup="${prefix}LineFamilyTokenJoiner"]`, '-');
  const pattern = readValue(host, `[data-psmap-setup="${prefix}LineFamilyRegex"]`, '');
  const group = readValue(host, `[data-psmap-setup="${prefix}LineFamilyRegexGroup"]`, '1');

  const builtIn = builtInLineFamily(sample);
  const positional = positionLineFamily(sample, delimiter, expression, joiner);
  const regex = regexLineFamily(sample, pattern, group);
  const finalValue = String(mode).toLowerCase() === 'positions'
    ? positional.value
    : String(mode).toLowerCase() === 'regex'
      ? regex.value
      : String(mode).toLowerCase() === 'builtin'
        ? builtIn
        : '(inherits shared/global rule)';

  const result = host.querySelector(`[data-psmap-line-family-result="${side}"]`);
  if (result) {
    result.textContent = `${sideTitle(side)} sample: ${sample}\nBuilt-in result: ${builtIn || '-'}\nTokens (${delimiter || 'auto'}):\n${positional.tokens.map((token, index) => `  ${index + 1}: ${token}`).join('\n') || '  -'}\nPosition expression: ${expression || '-'}\nPicked tokens: ${positional.picked.join(' + ') || '-'}\nPosition result: ${positional.value || '-'}\nRegex result: ${regex.error ? `ERROR: ${regex.error}` : (regex.value || '-')}\nFinal selected (${mode}): ${finalValue || '-'}`;
  }
  return { finalValue };
}

function numericSetup(name, fallback) {
  const input = document.querySelector(`[data-psmap-setup="${name}"]`);
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function renderLineFamilyPlayground(host) {
  const t1 = renderSide(host, 'table1');
  const t2 = renderSide(host, 'table2');
  const compare = host.querySelector('[data-psmap-line-family-compare]');
  if (!compare) return;

  const t1Value = String(t1.finalValue || '');
  const t2Value = String(t2.finalValue || '');
  const comparable = t1Value && t2Value && !t1Value.includes('inherits') && !t2Value.includes('inherits');

  if (comparable) {
    const distance = editDistance(t1Value, t2Value);
    const minStem = numericSetup('nearLineMinStemLength', 6);
    const maxDistance = numericSetup('nearLineMaxEditDistance', 1);
    const minLen = Math.min(t1Value.length, t2Value.length);
    const near = t1Value !== t2Value && minLen >= minStem && distance <= maxDistance;
    compare.textContent = `Comparison: ${t1Value === t2Value ? 'MATCH' : near ? 'NEAR REVIEW' : 'REVIEW'} — Table-1=${t1Value || '-'}; Table-2=${t2Value || '-'}; edit distance=${distance}; near threshold=${maxDistance}`;
  } else {
    compare.textContent = 'Comparison: set both sides to Built-in / Token positions / Custom regex to compare here. Inherit uses the shared/global rule.';
  }
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psmap-rules-note{border:1px solid rgba(34,197,94,.32);background:rgba(20,83,45,.18);border-radius:12px;padding:9px 11px;margin:8px 0;color:#d1fae5;font-size:12px}.psmap-rules-note b{color:#bbf7d0}.psmap-legacy-control{opacity:.62}.psmap-legacy-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;background:rgba(148,163,184,.16);color:#cbd5e1;font-size:10px;font-weight:800}.psmap-line-family-playground{border:1px solid rgba(34,197,94,.34);background:rgba(15,23,42,.64);border-radius:12px;padding:12px;margin-top:10px}.psmap-line-family-playground h4{margin:0 0 8px;color:#dcfce7}.psmap-line-family-note{font-size:12px;color:#fef3c7;margin:0 0 10px}.psmap-line-family-sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.psmap-line-family-side{border:1px solid rgba(148,163,184,.24);border-radius:10px;padding:9px;background:rgba(2,6,23,.42)}.psmap-line-family-side h5{margin:0 0 7px;color:#bfdbfe}.psmap-line-family-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.psmap-line-family-grid label{display:grid;gap:4px;font-size:12px;color:#cbd5e1}.psmap-line-family-grid input,.psmap-line-family-grid select{box-sizing:border-box;width:100%;border:1px solid rgba(143,197,255,.25);border-radius:8px;background:#020617;color:#e5edf7;padding:6px 8px;font:12px ui-monospace,Consolas,monospace}.psmap-line-family-result{margin-top:8px;border-radius:10px;padding:9px;background:rgba(2,6,23,.68);color:#d1fae5;font:12px ui-monospace,Consolas,monospace;white-space:pre-wrap}.psmap-line-family-compare{margin-top:9px;border-radius:10px;padding:8px;background:rgba(30,41,59,.72);color:#e0f2fe;font:12px ui-monospace,Consolas,monospace}.psmap-line-family-help{margin-top:7px;color:#cbd5e1;font-size:12px}`;
  document.head.appendChild(style);
}

function patchLegacyControls(panel) {
  const oldToggle = panel.querySelector('[data-psmap-setup="useBuiltInSupportKeywordLogic"]');
  if (oldToggle) {
    oldToggle.checked = true;
    oldToggle.disabled = true;
    const label = oldToggle.closest('label');
    if (label && !label.querySelector('[data-psmap-legacy-badge]')) {
      label.classList.add('psmap-legacy-control');
      label.insertAdjacentHTML('beforeend', '<span class="psmap-legacy-badge" data-psmap-legacy-badge>legacy - rules table always active</span>');
    }
  }
  const anchorToggle = panel.querySelector('[data-psmap-setup="treatAnchorAsLineStop"]');
  if (anchorToggle) {
    anchorToggle.checked = true;
    anchorToggle.disabled = true;
  }
}

function ensureRulesNotice(panel) {
  const supportCard = panel.querySelector('[data-psmap-support-config]');
  if (!supportCard || supportCard.querySelector('[data-psmap-rules-source-note]')) return;
  const note = document.createElement('div');
  note.className = 'psmap-rules-note';
  note.setAttribute('data-psmap-rules-source-note', '1');
  note.innerHTML = '<b>Active support logic:</b> Support Keyword Rules: Pattern -&gt; Canonical is the source of truth for Table-1C ISONOTE and Table-2 DTXR. Table-1D Master Keyword Searcher is legacy/optional and should only be used as a manual reference.';
  supportCard.querySelector('.psmap-card-body')?.prepend(note);
}

function sideHtml(side, sample, expression, regex) {
  const prefix = sidePrefix(side);
  return `<section class="psmap-line-family-side">
    <h5>${h(sideTitle(side))}</h5>
    <div class="psmap-line-family-grid">
      <label>Sample<input data-psmap-line-family-sample="${h(side)}" value="${h(sample)}"></label>
      <label>Extraction mode<select data-psmap-setup="${h(prefix)}LineFamilyExtractionMode"><option value="inherit">Inherit shared/global</option><option value="builtIn">Built-in regex</option><option value="positions">Token positions</option><option value="regex">Custom regex</option></select></label>
      <label>Delimiter<input data-psmap-setup="${h(prefix)}LineFamilyDelimiter" value="-" placeholder="-, _, /, auto, space, tab"></label>
      <label>Token expression<input data-psmap-setup="${h(prefix)}LineFamilyTokenExpression" value="${h(expression)}" placeholder="Example: 3+4 or 4+5"></label>
      <label>Token joiner<input data-psmap-setup="${h(prefix)}LineFamilyTokenJoiner" value="-" placeholder="- or blank"></label>
      <label>Regex group<input data-psmap-setup="${h(prefix)}LineFamilyRegexGroup" type="number" value="1" min="0"></label>
      <label style="grid-column:1/-1">Custom regex<input data-psmap-setup="${h(prefix)}LineFamilyRegex" value="${h(regex)}" placeholder="Capture group should return line family"></label>
    </div>
    <pre data-psmap-line-family-result="${h(side)}" class="psmap-line-family-result"></pre>
  </section>`;
}

function ensureLineFamilyPlayground(panel) {
  if (panel.querySelector('[data-psmap-line-family-playground-v2]')) return;
  panel.querySelector('[data-psmap-near-preview]')?.remove();
  panel.querySelector('[data-psmap-table-line-family-playground]')?.remove();

  const host = document.createElement('div');
  host.className = 'psmap-line-family-playground';
  host.setAttribute('data-psmap-line-family-playground-v2', '1');
  host.innerHTML = `<h4>Line Family Playground — Table-1 and Table-2</h4>
    <p class="psmap-line-family-note"><b>This replaces the old Near Line No. sandbox.</b> Configure how line family is picked for each table. Table-1 and Table-2 may use different token positions or regex.</p>
    <div class="psmap-line-family-sides">
      ${sideHtml('table1', '/ASIM-1885-10&quot;-S8810111-91261M7-HC', '3+4', '(\\d+(?:\\.\\d+)?[&quot;\']?-[A-Z]\\d{4,})')}
      ${sideHtml('table2', 'ASIM-1885-10&quot;-S8810111-91261M7-HC', '3+4', '(\\d+(?:\\.\\d+)?[&quot;\']?-[A-Z]\\d{4,})')}
    </div>
    <div data-psmap-line-family-compare class="psmap-line-family-compare"></div>
    <div class="psmap-line-family-help">Examples: delimiter <code>-</code>, expression <code>3+4</code> gives <code>10&quot;-S8810111</code>. If the project format requires 4th+5th token, enter <code>4+5</code>. For different formats, set Table-1 and Table-2 to different regex patterns.</div>`;

  const supportCard = panel.querySelector('[data-psmap-support-config]');
  const target = supportCard?.querySelector('.psmap-card-body') || panel.querySelector('.psmap-card-body') || panel;
  target.appendChild(host);

  const update = () => renderLineFamilyPlayground(host);
  host.addEventListener('input', update);
  host.addEventListener('change', update);
  update();
}

function patchConfig() {
  const panel = document.querySelector('[data-psmap-panel="config"]');
  if (!panel) return;
  installStyle();
  patchLegacyControls(panel);
  ensureRulesNotice(panel);
  ensureLineFamilyPlayground(panel);
}

function installRulesPreview() {
  installStyle();
  const observer = new MutationObserver(patchConfig);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', patchConfig, true);
  document.addEventListener('change', patchConfig, true);
  patchConfig();
  return () => {
    observer.disconnect();
    document.removeEventListener('input', patchConfig, true);
    document.removeEventListener('change', patchConfig, true);
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyPreview = installRulesPreview();
  return () => {
    try { destroyPreview?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
