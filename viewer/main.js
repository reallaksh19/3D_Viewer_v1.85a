import { init } from './core/app.js?v=20260612-psnm-candidate-hang-fix-1';

function reportStartupError(error) {
  console.error('3D Viewer failed to start', error);

  const label = document.getElementById('app-loading-label');
  if (label) {
    label.textContent = 'Failed to start viewer. Check the browser console for details.';
  }

  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.innerHTML = `
      <div style="padding:24px;color:#fca5a5;background:#111827;min-height:100vh;font-family:system-ui,sans-serif;">
        <h1 style="margin-top:0;color:#fecaca;">3D Viewer failed to start</h1>
        <p>Please check the browser console for the full error.</p>
        <pre style="white-space:pre-wrap;background:#0f172a;border:1px solid #7f1d1d;border-radius:8px;padding:12px;color:#fee2e2;">${String(error?.stack || error?.message || error)}</pre>
      </div>
    `;
  }
}

window.addEventListener('error', (event) => {
  reportStartupError(event.error || event.message || event);
});

window.addEventListener('unhandledrejection', (event) => {
  reportStartupError(event.reason || event);
});

try {
  init();
} catch (error) {
  reportStartupError(error);
}
