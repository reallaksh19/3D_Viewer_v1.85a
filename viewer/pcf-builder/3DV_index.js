/**
 * 3DV_index.js  — PCF Builder Orchestrator
 * Wires: "Refresh PCF" button → read table state → mutate → serialize → output textarea.
 * Also exposes window.__3DV_PcfBuilder for browser console test runs.
 */

import { applyMutations } from './3DV_DataTableMutator.js';
import { serializeToPCF } from './3DV_PCFSerializer.js';
import { initSmartActionsLog, renderActionsLog, clearActionsLog } from './3DV_SmartActionsLog.js';
import { getState } from '../../state.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read live components from app state (set by viewer-tab.js via setState) */
function _getComponents() {
    return getState('viewer3dComponents') || [];
}

/** Highlight edited cells in the visible data table */
function _highlightEditedCells(edits) {
    edits.forEach(edit => {
        if (!edit.compId || !edit.field) return;
        const fieldMap = { EP1: 'ep1', EP2: 'ep2', INSERT: null };
        const dataField = fieldMap[edit.field] ?? null;
        if (!dataField) return;
        const td = document.querySelector(
            `#pcf-data-table td[data-field="${dataField}"][data-id="${edit.compId}"]`
        );
        if (td) {
            td.style.color = '#f59e0b';   // amber text
            td.style.fontWeight = '700';
            td.style.background = 'rgba(245,158,11,0.10)';
        }
    });
}

/** Show a brief status message in the viewer status bar */
function _setStatus(msg, type = 'ok') {
    const el = document.getElementById('viewer-status');
    if (!el) return;
    const colors = { ok: 'var(--green-ok)', warn: 'var(--yellow-warn)', error: 'var(--red-err)' };
    el.textContent = msg;
    el.style.color = colors[type] || 'var(--text-muted)';
}

// ── Core run function ─────────────────────────────────────────────────────────

export function runPcfBuilder() {
    clearActionsLog();
    const components = _getComponents();

    if (!components || components.length === 0) {
        _setStatus('⚠ No data table loaded. Generate 3D first.', 'warn');
        return;
    }

    const hasFixes = components.some(c => c.fixingAction && c.fixingAction.trim());
    if (!hasFixes) {
        _setStatus('ℹ No Fixing Actions found in table — PCF unchanged.', 'warn');
        return;
    }

    try {
        const { mutated, edits } = applyMutations(components);
        const pcfText = serializeToPCF(mutated);

        // Push to the PCF textarea (left panel)
        const textarea = document.getElementById('viewer-pcf-input');
        if (textarea) textarea.value = pcfText;

        // Highlight changed cells
        _highlightEditedCells(edits);

        // Render Smart Actions log
        renderActionsLog(edits);

        _setStatus(`✓ PCF rebuilt — ${edits.length} action(s) applied.`, 'ok');
        console.info('[3DV_PCFBuilder] Done.', edits.length, 'actions applied.');
    } catch (err) {
        _setStatus(`✗ PCF Builder error: ${err.message}`, 'error');
        console.error('[3DV_PCFBuilder]', err);
    }
}

// ── Init (called once from index.html) ────────────────────────────────────────

export function initPcfBuilder() {
    initSmartActionsLog();

    const btn = document.getElementById('btn-refresh-pcf');
    if (btn) btn.addEventListener('click', runPcfBuilder);

    // Expose to browser console for test runs
    window.__3DV_PcfBuilder = { run: runPcfBuilder, applyMutations, serializeToPCF };
    console.info('[3DV_PCFBuilder] Initialised. Use window.__3DV_PcfBuilder.run() in console.');
}
