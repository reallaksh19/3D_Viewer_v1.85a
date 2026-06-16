/**
 * 3DV_SmartActionsLog.js
 * Collapsible "Smart Actions" log panel controller for the 3D Viewer.
 * Renders a color-coded list of mutations applied by the PCF Builder.
 */

const COLORS = {
    TRIM: '#f59e0b',  // amber
    SNAP: '#38bdf8',  // sky blue
    EXTEND: '#34d399',  // emerald
    INSERT_PIPE: '#a78bfa',  // violet
    FILL_GAP: '#fb923c',  // orange
    DELETE: '#f87171',  // red
    REVIEW: '#94a3b8',  // slate (skipped)
};

const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Initialise the Smart Actions panel in the DOM.
 * Must be called once after DOMContentLoaded.
 */
export function initSmartActionsLog() {
    const panel = document.getElementById('smart-actions-panel');
    const header = document.getElementById('smart-actions-header');
    const body = document.getElementById('smart-actions-body');
    if (!header || !body) return;
    header.addEventListener('click', () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        header.querySelector('.sa-chevron').textContent = open ? '▶' : '▼';
    });
    if (panel) panel.style.display = 'none'; // hidden until first run
}

/**
 * Render log entries from the mutation results.
 * @param {Array<{type,compSeq,field,before,after,desc}>} entries
 */
export function renderActionsLog(entries) {
    const panel = document.getElementById('smart-actions-panel');
    const countEl = document.getElementById('smart-actions-count');
    const logEl = document.getElementById('smart-actions-log');
    if (!logEl) return;

    if (!entries || entries.length === 0) {
        if (panel) panel.style.display = 'none';
        return;
    }

    if (panel) panel.style.display = 'block';
    if (countEl) countEl.textContent = `${entries.length} action${entries.length > 1 ? 's' : ''}`;

    logEl.innerHTML = entries.map((e, i) => {
        const color = COLORS[e.type] || '#94a3b8';
        return `<div style="margin-bottom:6px;padding:4px 8px;border-left:3px solid ${color};font-size:0.72rem;font-family:monospace">
            <span style="color:${color};font-weight:700">[${e.type}]</span>
            <span style="color:#94a3b8"> Row ${_esc(e.compSeq)}</span>
            ${e.field ? `<span style="color:#e2e8f0"> · ${_esc(e.field)}</span>` : ''}
            <br>
            ${e.desc ? `<span style="color:#cbd5e1">${_esc(e.desc)}</span>` : ''}
            ${e.before ? `<br><span style="color:#64748b">Before: ${_esc(e.before)}</span>` : ''}
            ${e.after ? `<br><span style="color:#f8fafc">After:  ${_esc(e.after)}</span>` : ''}
        </div>`;
    }).join('');
}

/** Clear log panel */
export function clearActionsLog() {
    const panel = document.getElementById('smart-actions-panel');
    const logEl = document.getElementById('smart-actions-log');
    if (logEl) logEl.innerHTML = '';
    if (panel) panel.style.display = 'none';
}
