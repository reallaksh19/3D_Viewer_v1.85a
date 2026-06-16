import { renderPSNM_UtilityTab as renderCoordinateFirstPSNMUtilityTab } from './psnm-utility-tab-coordinate-first-ui.js?v=20260615-coordinate-first-phase-a-1';

const STYLE_ID = 'psnm-coordinate-occurrence-phase-b-style';

function text(value) {
  return String(value ?? '').trim();
}

function cellValue(cell) {
  const field = cell?.querySelector?.('input,select,textarea');
  return text(field ? field.value : cell?.textContent);
}

function headerIndexes(table) {
  const headers = Array.from(table?.querySelectorAll?.('thead th') || []).map((th) => text(th.textContent));
  const indexOf = (label) => headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());
  return { headers, indexOf };
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-occurrence-cell{font-family:ui-monospace,Consolas,monospace;color:#c4b5fd;font-weight:700}
.psnm-identity-warning-cell{color:#fcd34d;max-width:420px;white-space:normal!important;line-height:1.35}
.psnm-occurrence-note{border:1px solid rgba(196,181,253,.32);background:rgba(88,28,135,.18);border-radius:10px;padding:9px 10px;color:#ede9fe;font-size:12px;line-height:1.45;margin-bottom:8px}
`;
  document.head.appendChild(style);
}

function insertColumnAfter(table, afterIndex, label, className, compute) {
  if (!table || afterIndex < 0) return;
  const { headers } = headerIndexes(table);
  if (headers.includes(label)) return;
  const headerRow = table.querySelector('thead tr');
  const th = document.createElement('th');
  th.textContent = label;
  headerRow?.insertBefore(th, headerRow.children[afterIndex + 1] || null);
  Array.from(table.querySelectorAll('tbody tr')).forEach((row) => {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = compute(row) || '-';
    row.insertBefore(td, row.children[afterIndex + 1] || null);
  });
}

function occurrenceLabel(table, row, psIndex) {
  const ps = cellValue(row.children[psIndex]);
  if (!ps) return '';
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const same = bodyRows.filter((candidate) => cellValue(candidate.children[psIndex]) === ps);
  if (same.length <= 1) return `${ps}#001`;
  return `${ps}#${String(same.indexOf(row) + 1).padStart(3, '0')}`;
}

function identityWarning(table, row, psIndex, coordIndex) {
  const ps = cellValue(row.children[psIndex]);
  const coord = cellValue(row.children[coordIndex]);
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const samePs = bodyRows.filter((candidate) => cellValue(candidate.children[psIndex]) === ps);
  const sameCoord = coord && coord !== '-' ? bodyRows.filter((candidate) => cellValue(candidate.children[coordIndex]) === coord) : [];
  const notes = [];
  if (samePs.length > 1) {
    const distinctCoords = new Set(samePs.map((candidate) => cellValue(candidate.children[coordIndex])));
    notes.push(distinctCoords.size > 1 ? 'Same PS label at different coordinates; retained as separate occurrences.' : 'Duplicate PS label at same coordinate; verify source duplicate.');
  }
  if (sameCoord.length > 1) {
    const labels = Array.from(new Set(sameCoord.map((candidate) => cellValue(candidate.children[psIndex]))));
    if (labels.length > 1) notes.push(`Coordinate shared by multiple PS labels: ${labels.join(', ')}.`);
  }
  return notes.join(' ');
}

function enhanceMasterPsOccurrence(container) {
  const panel = container.querySelector('[data-psnm-panel="master"]');
  const table = Array.from(panel?.querySelectorAll('table.psnm-table') || [])
    .find((candidate) => /PS Name/i.test(candidate.textContent || '') && /Position Raw/i.test(candidate.textContent || ''));
  if (!table) return;

  const wrap = table.closest('.psnm-tablewrap');
  const host = wrap?.parentElement;
  if (host && !host.querySelector('[data-psnm-occurrence-note="phase-b"]')) {
    const note = document.createElement('div');
    note.className = 'psnm-occurrence-note';
    note.dataset.psnmOccurrenceNote = 'phase-b';
    note.innerHTML = '<b>Phase B:</b> Master PS is now coordinate-occurrence aware. Duplicate PS labels are retained when their coordinates differ; PS Name remains a label, not the unique key.';
    host.insertBefore(note, wrap);
  }

  let { indexOf } = headerIndexes(table);
  const psIndex = indexOf('PS Name');
  insertColumnAfter(table, psIndex, 'PS Occurrence', 'psnm-occurrence-cell', (row) => occurrenceLabel(table, row, psIndex));

  ({ indexOf } = headerIndexes(table));
  const occurrenceIndex = indexOf('PS Occurrence');
  const coordIndexBeforeIdentity = indexOf('PS Coord Key');
  const psIndexBeforeIdentity = indexOf('PS Name');
  if (coordIndexBeforeIdentity >= 0) {
    insertColumnAfter(table, occurrenceIndex, 'Identity Warning', 'psnm-identity-warning-cell', (row) => identityWarning(table, row, psIndexBeforeIdentity, coordIndexBeforeIdentity));
  }
}

function enhance(container) {
  enhanceMasterPsOccurrence(container);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  ensureStyle();
  const destroyBase = renderCoordinateFirstPSNMUtilityTab(container, ctx);
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => enhance(container), 0);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(container, { childList: true, subtree: true });
  container.addEventListener('click', schedule, true);
  container.addEventListener('change', schedule, true);
  container.addEventListener('input', schedule, true);
  schedule();
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    container.removeEventListener('click', schedule, true);
    container.removeEventListener('change', schedule, true);
    container.removeEventListener('input', schedule, true);
    destroyBase?.();
  };
}

export default renderPSNM_UtilityTab;
