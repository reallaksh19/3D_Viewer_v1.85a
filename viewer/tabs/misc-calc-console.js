import { subscribeSession } from '../calc/core/calc-session.js';

export function renderMiscCalcConsole(container) {
  container.innerHTML = `
    <div id="calc-console" class="calc-console-panel" style="position: sticky; bottom: 0; background: #1e1e1e; color: #d4d4d4; padding: 10px; font-family: monospace; font-size: 12px; max-height: 250px; overflow-y: auto; border-top: 2px solid #007acc; margin-top: 20px;">
      <div style="font-weight: bold; margin-bottom: 5px; color: #569cd6;">Calculations Console >_</div>
      <div id="calc-console-output">Ready. Select a calculation to begin.</div>
    </div>
  `;

  const output = container.querySelector('#calc-console-output');

  if (container._unsubscribe) {
      container._unsubscribe();
  }

  container._unsubscribe = subscribeSession((session) => {
    if (!session) {
      output.innerHTML = 'Ready. Select a calculation to begin.';
      return;
    }

    let html = `<div style="color: #4ec9b0;">[Session Start] ${new Date().toLocaleTimeString()}</div>`;
    html += `<div><strong>Calculator:</strong> ${session.metadata.name} | <strong>Method:</strong> ${session.metadata.method} | <strong>Mode:</strong> ${session.metadata.unitMode}</div>`;

    if (session.inputResolution) {
        html += `<div style="margin-top: 5px; color: #ce9178;">[Input Resolution]</div>`;
        html += `<pre style="margin: 0; color: #9cdcfe;">${JSON.stringify(session.inputResolution, null, 2)}</pre>`;
    } else {
        html += `<div style="margin-top: 5px; color: #ce9178;">[Inputs]</div>`;
        html += `<pre style="margin: 0; color: #9cdcfe;">${JSON.stringify(session.inputs, null, 2)}</pre>`;
    }

    if (session.steps && session.steps.length) {
      html += `<div style="margin-top: 5px; color: #ce9178;">[Formula Steps]</div>`;
      session.steps.forEach((s, i) => {
        html += `<div>  ${i+1}. ${s}</div>`;
      });
    }

    if (session.intermediateValues && Object.keys(session.intermediateValues).length) {
       html += `<div style="margin-top: 5px; color: #ce9178;">[Intermediate Values]</div>`;
       html += `<pre style="margin: 0; color: #9cdcfe;">${JSON.stringify(session.intermediateValues, null, 2)}</pre>`;
    }

    html += `<div style="margin-top: 5px; color: #ce9178;">[Outputs]</div>`;
    html += `<pre style="margin: 0; color: #9cdcfe;">${JSON.stringify(session.outputs, null, 2)}</pre>`;

    if (session.benchmark) {
      html += `<div style="margin-top: 5px; color: #ce9178;">[Benchmark Placeholder]</div>`;
      html += `<pre style="margin: 0; color: #9cdcfe;">${JSON.stringify(session.benchmark, null, 2)}</pre>`;
    }

    if (session.sourceSnapshot) {
      html += `<div style="margin-top: 5px; color: #ce9178;">[Source Snapshot]</div>`;
      html += `<pre style="margin: 0; color: #9cdcfe;">${JSON.stringify(session.sourceSnapshot, null, 2)}</pre>`;
    }

    if (session.warnings && session.warnings.length) {
      html += `<div style="margin-top: 5px; color: #d7ba7d;">[Warnings / Assumptions]</div>`;
      session.warnings.forEach(w => {
         html += `<div>⚠️ ${w}</div>`;
      });
    }

    if (session.errors && session.errors.length) {
      html += `<div style="margin-top: 5px; color: #f44747;">[Errors]</div>`;
      session.errors.forEach(e => {
         html += `<div>❌ ${e}</div>`;
      });
    }

    html += `<div style="margin-top: 5px; color: ${session.pass ? '#4ec9b0' : '#f44747'};">[Result] ${session.pass ? 'PASS' : 'FAIL'}</div>`;

    output.innerHTML = html;

    // Auto-scroll to bottom
    const consolePanel = container.querySelector('#calc-console');
    if (consolePanel) {
      consolePanel.scrollTop = consolePanel.scrollHeight;
    }
  });
}
