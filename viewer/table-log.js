/**
 * table-log.js — Render parsed PCF components as an HTML data table
 *
 * RefNo strategy:
 *   For each real component at index i, scan backwards through the original
 *   array collecting MESSAGE-SQUARE attributes until another real component
 *   is reached (stop). Nearest MESSAGE-SQUARE wins for duplicate keys.
 *   This handles any gap / ordering in the PCF file.
 *
 * Column order:
 *   # | CSV Seq No | Pipeline | Component | Ref No | Bore
 *   | EP1 | EP2 | Len1/Ax1 | Len2/Ax2 | Len3/Ax3 | BrLen
 *   | CA1-10 | SKEY | Weight
 */

import { getState, setState } from '../state.js';

// ── Axis config — reads window.__PCF_AXIS_CONFIG__ at render time ─────
const getAxisCfg = () => Object.assign({
  X_POS: 'East', X_NEG: 'West',
  Y_POS: 'North', Y_NEG: 'South',
  Z_POS: 'Up', Z_NEG: 'Down',
}, window.__PCF_AXIS_CONFIG__ || {});

// ── Helpers ───────────────────────────────────────────────────────────
const n = (v) => Number(v) || 0;
const fmtN = (v) => { const num = n(v); return num === 0 ? '' : num.toFixed(1); };
// fmtC handles both pcf-parser format {x,y,z} and group-state format {E,N,U}
const fmtC = (p) => {
  if (!p) return '';
  const e = Number(p.E ?? p.x) || 0;
  const ne = Number(p.N ?? p.y) || 0;
  const u = Number(p.U ?? p.z) || 0;
  return `${e.toFixed(1)}, ${ne.toFixed(1)}, ${u.toFixed(1)}`;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const axDir = (d, pos, neg) => Math.abs(d) < 0.1 ? '' : (d > 0 ? pos : neg);
const dist3 = (a, b) => {
  if (!a || !b) return '';
  const ax = Number(a.E ?? a.x ?? 0), ay = Number(a.N ?? a.y ?? 0), az = Number(a.U ?? a.z ?? 0);
  const bx = Number(b.E ?? b.x ?? 0), by = Number(b.N ?? b.y ?? 0), bz = Number(b.U ?? b.z ?? 0);
  const d = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2);
  return d > 0.1 ? d.toFixed(1) : '';
};

const CA_KEYS = Array.from({ length: 10 }, (_, i) => `COMPONENT-ATTRIBUTE${i + 1}`);
const MSG_T = 'MESSAGE-SQUARE';

const isMsg = (c) => (c?.type || '').toUpperCase() === MSG_T;

// ── Scan attrs for RefNo:= pattern ────────────────────────────────────
const scanRefNo = (attrs) => {
  if (!attrs) return '';
  for (const k of Object.keys(attrs)) {
    const m = String(attrs[k] || '').match(/RefNo:=?\s*([^\s,]+)/i);
    if (m) return m[1];
  }
  // Fallback: explicit traceability attributes (written by ca-builder and support writer)
  return attrs['COMPONENT-ATTRIBUTE99'] || attrs['REFNO'] || '';
};

// ── Scan attrs for SeqNo:= pattern ────────────────────────────────────
const scanSeqNo = (attrs) => {
  if (!attrs) return '';
  for (const k of Object.keys(attrs)) {
    const m = String(attrs[k] || '').match(/SeqNo:=?\s*([^\s,]+)/i);
    if (m) return m[1];
  }
  return '';
};

/**
 * For component at originalIndex, scan backwards through components[]
 * collecting MESSAGE-SQUARE attrs until another real component is found.
 * Returns merged msgAttrs (nearest MSG-SQ values win for duplicate keys).
 */
function getMsgAttrs(components, originalIndex) {
  const merged = {};
  for (let back = 1; back <= 20; back++) {       // look up to 20 positions back
    const idx = originalIndex - back;
    if (idx < 0) break;
    const c = components[idx];
    if (!isMsg(c)) break;                       // hit a real component — stop
    // Nearest MESSAGE-SQUARE wins: only set key if not already set
    for (const [k, v] of Object.entries(c.attributes || {})) {
      if (!(k in merged)) merged[k] = v;
    }
  }
  return merged;
}

// ── CSV Seq No lookup — MESSAGE-SQUARE first, CSV row fallback, N/A last ──
let _csvRowsCache = null;
function getCsvSeqNoFromRows(refNo) {
  // Emergency fallback: scan normalizedRows for matching refNo and return Seq No. field
  if (!refNo) return 'N/A';
  if (_csvRowsCache === null) _csvRowsCache = getState('normalizedRows') || [];
  const needle = String(refNo).trim().toLowerCase();
  for (const row of _csvRowsCache) {
    if (Object.values(row).some(v => String(v ?? '').trim().toLowerCase() === needle)) {
      return row['Seq No.'] || row.Sequence || row.Seq || row.SeqNo || 'N/A';
    }
  }
  return 'N/A';
}

// ── Main render ───────────────────────────────────────────────────────
export const renderTable = (containerEl, components) => {
  if (!containerEl) return;
  _csvRowsCache = null; // reset cache for fresh render
  const AXIS_CONFIG = getAxisCfg(); // honour UI dropdown axis settings

  let seqNo = 0;
  const rows = [];

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    if (isMsg(comp)) continue;          // skip MESSAGE-SQUARE rows

    seqNo++;
    const { type, points, centrePoint, branch1Point, bore, attributes, coOrds } = comp;
    const compType = (type || '').toUpperCase();
    const ownAttrs = attributes || {};

    // Gather MESSAGE-SQUARE attrs by backward scan
    const msgAttrs = getMsgAttrs(components, i);

    // RefNo: CA97 direct attribute first (written by ca-builder), then MSG-SQUARE, then own attrs
    const directRefNo = ownAttrs['COMPONENT-ATTRIBUTE97'] || '';
    const refNo = directRefNo || scanRefNo(msgAttrs) || scanRefNo(ownAttrs) || 'N/A';

    // CSV Seq No: CA98 direct attribute first, then MSG-SQUARE SeqNo:=, then CSV row lookup
    const directSeqNo = ownAttrs['COMPONENT-ATTRIBUTE98'] || '';
    const csvSeq = directSeqNo || scanSeqNo(msgAttrs) || getCsvSeqNoFromRows(refNo === 'N/A' ? '' : refNo);
    // For gap-fill synthetic pipes (no RefNo from any source), label with coordinates
    // For gap-fill synthetic pipes (no RefNo from any source), try to inherit adjacent RefNo + _Gap
    const effectiveRefNo = (refNo && refNo !== 'N/A') ? refNo :
      (() => {
        let nearestRefNo = 'N/A';
        // Scan backwards for a valid RefNo
        for (let j = i - 1; j >= 0; j--) {
          const pRef = scanRefNo(getMsgAttrs(components, j)) || scanRefNo(components[j].attributes);
          if (pRef && pRef !== 'N/A') { nearestRefNo = pRef; break; }
        }
        // Scan forwards if not found
        if (nearestRefNo === 'N/A') {
          for (let j = i + 1; j < components.length; j++) {
            const nRef = scanRefNo(getMsgAttrs(components, j)) || scanRefNo(components[j].attributes);
            if (nRef && nRef !== 'N/A') { nearestRefNo = nRef; break; }
          }
        }

        if (nearestRefNo !== 'N/A') return `${nearestRefNo}_Gap`;

        // Absolute fallback to coordinates
        const ep = (components[i]?.points?.[0]);
        if (!ep) return 'N/A';
        const ex = Math.round(Number(ep.E ?? ep.x ?? 0));
        const en = Math.round(Number(ep.N ?? ep.y ?? 0));
        const eu = Math.round(Number(ep.U ?? ep.z ?? 0));
        return ex || en || eu ? `Gap@${ex},${en},${eu}` : 'N/A';
      })();

    // Pipeline, SKEY, Weight — own attrs win
    const pipeline = esc(ownAttrs['PIPELINE-REFERENCE'] || msgAttrs['PIPELINE-REFERENCE'] || '');
    const skey = esc(ownAttrs['SKEY'] || msgAttrs['SKEY'] || '');
    const weight = esc(ownAttrs['WEIGHT'] || msgAttrs['WEIGHT'] || '');
    const boreVal = bore > 0 ? bore : (ownAttrs['BORE'] || msgAttrs['BORE'] || '');

    // CA 1-10: msg preferred (MESSAGE-SQUARE is the annotation source)
    const caVal = (k) => esc(msgAttrs[k] || ownAttrs[k] || '');

    // Points
    const ep1 = (points && points[0]) || null;
    const ep2 = (points && points[1]) || null;
    const cp = centrePoint || (compType === 'BEND' || compType === 'ELBOW' ? null : null) || null;
    const bp = branch1Point || null;

    // Support COOR — coordinate for SUPPORT/ANCI rows
    const isSupport = compType === 'SUPPORT' || compType === 'ANCI';
    const supportCoorPt = isSupport ? (coOrds || ep1 || null) : null;
    const supportCoorStr = esc(fmtC(supportCoorPt));

    // Fixing Action — validator/fixer action description
    const fixingAction = esc(comp.fixingAction || '');

    // Lengths (raw X/Y/Z deltas) — dual format for both pcf-parser {x,y,z} and group-state {E,N,U}
    const _px = (pt) => Number(pt?.E ?? pt?.x ?? 0);
    const _py = (pt) => Number(pt?.N ?? pt?.y ?? 0);
    const _pz = (pt) => Number(pt?.U ?? pt?.z ?? 0);
    let len1 = '', len2 = '', len3 = '', brLen = '', ax1 = '', ax2 = '', ax3 = '';
    if (ep1 && ep2) {
      const dx = _px(ep2) - _px(ep1), dy = _py(ep2) - _py(ep1), dz = _pz(ep2) - _pz(ep1);
      len1 = fmtN(dx); ax1 = axDir(dx, AXIS_CONFIG.X_POS, AXIS_CONFIG.X_NEG);
      len2 = fmtN(dy); ax2 = axDir(dy, AXIS_CONFIG.Y_POS, AXIS_CONFIG.Y_NEG);
      len3 = fmtN(dz); ax3 = axDir(dz, AXIS_CONFIG.Z_POS, AXIS_CONFIG.Z_NEG);
    } else if (ep1 && cp) {
      const dx = _px(cp) - _px(ep1), dy = _py(cp) - _py(ep1), dz = _pz(cp) - _pz(ep1);
      len1 = fmtN(dx); ax1 = axDir(dx, AXIS_CONFIG.X_POS, AXIS_CONFIG.X_NEG);
      len2 = fmtN(dy); ax2 = axDir(dy, AXIS_CONFIG.Y_POS, AXIS_CONFIG.Y_NEG);
      len3 = fmtN(dz); ax3 = axDir(dz, AXIS_CONFIG.Z_POS, AXIS_CONFIG.Z_NEG);
    }
    if ((compType === 'TEE' || compType.includes('OLET')) && cp && bp) brLen = dist3(cp, bp);

    const id = comp.id || '';
    const clickEvt = `document.dispatchEvent(new CustomEvent('pcf-table-select',{detail:{id:${JSON.stringify(id)},seqNo:${seqNo}}}))`;

    const caHtml = CA_KEYS.map(k => `<td contenteditable="true" data-field="${esc(k)}" data-id="${esc(id)}">${caVal(k)}</td>`).join('');
    const cpStr = esc(fmtC(cp));
    const bpStr = esc(fmtC(bp));

    rows.push(`<tr data-id="${esc(id)}" onclick="document.dispatchEvent(new CustomEvent('pcf-table-select',{detail:{id:${JSON.stringify(id)},seqNo:${seqNo}}}))" ondblclick="document.dispatchEvent(new CustomEvent('pcf-table-matrix',{detail:{id:${JSON.stringify(id)}}}))" style="cursor:pointer">
      <td class="num c-muted">${seqNo}</td>
      <td class="num c-csv" contenteditable="true" data-field="csvSeq" data-id="${esc(id)}">${csvSeq}</td>
      <td contenteditable="true" data-field="pipeline" data-id="${esc(id)}">${pipeline}</td>
      <td class="c-type" contenteditable="true" data-field="type" data-id="${esc(id)}">${esc(type)}</td>
      <td class="c-ref" contenteditable="true" data-field="refNo" data-id="${esc(id)}">${esc(effectiveRefNo)}</td>
      <td class="num" contenteditable="true" data-field="bore" data-id="${esc(id)}">${boreVal}</td>
      <td class="num" contenteditable="true" data-field="ep1" data-id="${esc(id)}">${esc(fmtC(ep1))}</td>
      <td class="num" contenteditable="true" data-field="ep2" data-id="${esc(id)}">${esc(fmtC(ep2))}</td>
      <td class="num" contenteditable="true" data-field="cp" data-id="${esc(id)}">${cpStr}</td>
      <td class="num" contenteditable="true" data-field="bp" data-id="${esc(id)}">${bpStr}</td>
      <td class="num">${len1}</td><td class="ax">${ax1}</td>
      <td class="num">${len2}</td><td class="ax">${ax2}</td>
      <td class="num">${len3}</td><td class="ax">${ax3}</td>
      <td class="num">${brLen}</td>
      ${caHtml}
      <td contenteditable="true" data-field="skey" data-id="${esc(id)}">${skey}</td>
      <td contenteditable="true" data-field="supportCoor" data-id="${esc(id)}">${supportCoorStr}</td>
      <td contenteditable="true" data-field="supportGuid" data-id="${esc(id)}">${esc(isSupport ? (ownAttrs['<SUPPORT_NAME>'] || ownAttrs['<SUPPORT_GUID>'] || '') : '')}</td>
      <td contenteditable="true" data-field="fixingAction" data-id="${esc(id)}" style="color:#fbbf24;font-size:11px;font-family:monospace;white-space:pre-wrap">${fixingAction}</td>
    </tr>`);
  }

  const caHeaders = CA_KEYS.map((_, i) => `<th>CA ${i + 1}</th>`).join('');
  const colCA = CA_KEYS.map(() => '<col style="width:90px">').join('');

  containerEl.innerHTML = `
    <div class="data-table-wrap" style="max-height:100%;overflow:auto;position:relative;">
      <table class="data-table" id="pcf-data-table" style="min-width:2600px;table-layout:fixed;border-collapse:collapse">
        <colgroup>
          <col style="width:34px">
          <col style="width:70px">
          <col style="width:110px">
          <col style="width:110px">
          <col style="width:115px">
          <col style="width:50px">
          <col style="width:160px">
          <col style="width:160px">
          <col style="width:130px">
          <col style="width:130px">
          <col style="width:60px"><col style="width:56px">
          <col style="width:60px"><col style="width:56px">
          <col style="width:60px"><col style="width:56px">
          <col style="width:60px">
          ${colCA}
          <col style="width:70px">
          <col style="width:70px">
          <col style="width:120px">
          <col style="width:250px">
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>CSV Seq No</th>
            <th>Pipeline</th>
            <th>Component</th>
            <th>Ref No.</th>
            <th>Bore</th>
            <th>EP1 Coords</th>
            <th>EP2 Coords</th>
            <th>CP Coords</th>
            <th>BP Coords</th>
            <th>Len 1</th><th>Axis 1</th>
            <th>Len 2</th><th>Axis 2</th>
            <th>Len 3</th><th>Axis 3</th>
            <th>BrLen</th>
            ${caHeaders}
            <th>SKEY</th>
            <th>Support COOR</th>
            <th>Support GUID</th>
            <th style="background:#1e293b;color:#fbbf24">Fixing Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length
      ? rows.join('')
      : '<tr><td colspan="28" style="text-align:center;color:var(--text-muted);padding:2rem">No components to display</td></tr>'}
        </tbody>
      </table>

      <!-- CA Matrix Popup Dialog -->
      <dialog id="ca-matrix-dialog" style="padding:0; border:1px solid #334155; border-radius:8px; background:#0f172a; color:#e2e8f0; max-width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
        <div style="padding:12px 16px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
          <h3 id="ca-matrix-title" style="margin:0; font-size:14px; color:#38bdf8;">Component Attributes</h3>
          <button onclick="document.getElementById('ca-matrix-dialog').close()" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">&times;</button>
        </div>
        <div id="ca-matrix-content" style="padding:16px; display:grid; grid-template-columns:100px 1fr; gap:8px 12px; font-size:12px; max-height:400px; overflow-y:auto;">
          <!-- Populated dynamically via JS -->
        </div>
      </dialog>
    </div>`;

  // Highlight selected row
  document.addEventListener('pcf-table-select', (e) => {
    document.querySelectorAll('#pcf-data-table tr[data-id]').forEach(row => {
      row.style.background = row.dataset.id === String(e.detail?.id)
        ? 'rgba(245,158,11,0.12)' : '';
    });
  });

  // Editable cells: highlight on focus/blur, commit to viewer3dComponents state
  containerEl.addEventListener('focusin', (e) => {
    const td = e.target.closest('[contenteditable]');
    if (td) td.style.background = 'rgba(255,230,80,0.18)';
  });
  containerEl.addEventListener('focusout', (e) => {
    const td = e.target.closest('[contenteditable]');
    if (!td) return;
    td.style.background = td.dataset.edited ? 'rgba(255,220,50,0.12)' : '';
    td.dataset.edited = 'true';
    // Persist edit to viewer3dComponents state
    const id = td.dataset.id;
    const field = td.dataset.field;
    const value = td.textContent.trim();
    if (id && field) {
      const comps = (getState('viewer3dComponents') || []).map(c => {
        if (c.id === id || String(c.uuid) === id) {
          // Handle fixingAction as a top-level property, not a CA attribute
          if (field === 'fixingAction') {
            return {
              ...c,
              fixingAction: value,
              _edits: { ...(c._edits || {}), [field]: value }
            };
          }

          // Other fields: Resolve to the correct CA definition
          const attrs = { ...(c.attributes || {}) };
          attrs[field] = value;

          return {
            ...c,
            attributes: attrs,
            _edits: { ...(c._edits || {}), [field]: value }
          };
        }
        return c;
      });
      setState('viewer3dComponents', comps);
    }
  });
  containerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest('[contenteditable]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
};
