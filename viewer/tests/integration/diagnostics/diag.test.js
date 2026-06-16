import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { notify, clearNotifications, notifications } from '../../../diagnostics/notification-center.js';
import { publishDiagnostic, DiagnosticsHub } from '../../../diagnostics/diagnostics-hub.js';
import { exportDiagnosticsBundle } from '../../../diagnostics/diagnostics-export.js';
import { clearLogs, clearTraceEvents, logs } from '../../../core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runTests() {
  let passed = true;

  clearNotifications();
  clearLogs();
  clearTraceEvents();

  notify({ level: 'error', title: 'Import Failed', message: 'Missing XML file', details: { id: 123 } });

  const bundle = exportDiagnosticsBundle();

  if (!bundle.notifications || bundle.notifications.length === 0) {
      console.log('Failed: No notifications in export bundle');
      passed = false;
  } else if (bundle.notifications[0].title !== 'Import Failed') {
      console.log('Failed: Wrong notification title');
      passed = false;
  }

  if (!bundle.logs || bundle.logs.length === 0) {
      console.log('Failed: Notification did not publish log to bundle. Logs: ', JSON.stringify(bundle.logs));
      passed = false;
  } else if (!bundle.logs[0].message.includes('UI_NOTIFICATION')) {
      console.log('Failed: Missing UI_NOTIFICATION code in logs');
      passed = false;
  }

  const outDir = path.join(__dirname, '../../../../artifacts/A5/diagnostics');
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outDir, 'diag-export.json'), JSON.stringify(bundle, null, 2));

  if (passed) console.log('\u2705 Diagnostics Integration tests passed.');
  else process.exit(1);
}

runTests();
