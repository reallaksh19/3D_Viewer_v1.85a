/**
 * logs-tab.js - Dedicated top-level log tab for 3D interaction traces.
 */

import { state } from '../core/state.js';
import { on } from '../core/event-bus.js';
import { logs, traceEvents, clearLogs, clearTraceEvents, summarizeTraceEvents } from '../core/logger.js';

let _listenersRegistered = false;

export function renderLogs(container) {
  if (!_listenersRegistered) {
    on('trace-added', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'logs' && c) renderLogs(c);
    });
    on('log-added', () => {
      const c = document.getElementById('tab-content');
      if (state.activeTab === 'logs' && c) renderLogs(c);
    });
    _listenersRegistered = true;
  }

  const summary = summarizeTraceEvents();

  container.innerHTML = `
    <div class="report-section" id="section-logs-tab">
      <h3 class="section-heading">Log - 3D Interaction Trace</h3>
      <p class="tab-note">Raw + aggregated event stream for orbit/zoom/selection/section operations.</p>

      <div class="debug-controls" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-secondary" id="logs-clear-trace">Clear Trace</button>
        <button class="btn-secondary" id="logs-clear-diagnostics">Clear Diagnostics</button>
        <span class="badge badge-neutral">Trace events: ${traceEvents.length}</span>
        <span class="badge badge-neutral">Diagnostics: ${logs.length}</span>
      </div>

      <h4 class="sub-heading" style="margin-top:1rem">Aggregated Timeline</h4>
      <div class="table-scroll" style="max-height:220px;">
        <table class="data-table" style="width:100%;">
          <thead><tr><th>Event</th><th>Count</th></tr></thead>
          <tbody>
            ${summary.length
              ? summary.map((row) => `<tr><td class="mono">${_esc(row.key)}</td><td class="mono">${row.count}</td></tr>`).join('')
              : '<tr><td colspan="2" class="center muted">No trace events captured yet</td></tr>'}
          </tbody>
        </table>
      </div>

      <h4 class="sub-heading" style="margin-top:1rem">Raw Trace</h4>
      <div class="log-box" style="max-height:300px;overflow:auto;">
        ${traceEvents.length
          ? [...traceEvents].reverse().map((evt) => `
            <div class="log-entry log-info">
              <span class="log-level">[${new Date(evt.ts).toLocaleTimeString()}]</span>
              <span class="mono">${_esc(evt.category)}:${_esc(evt.type)}</span>
              <span class="log-msg">${_esc(JSON.stringify(evt.payload || {}))}</span>
            </div>
          `).join('')
          : '<div class="log-entry log-info"><span class="log-level">[INFO]</span><span class="log-msg">No raw trace events.</span></div>'}
      </div>
    </div>
  `;

  container.querySelector('#logs-clear-trace')?.addEventListener('click', () => {
    clearTraceEvents();
    renderLogs(container);
  });

  container.querySelector('#logs-clear-diagnostics')?.addEventListener('click', () => {
    clearLogs();
    renderLogs(container);
  });
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
