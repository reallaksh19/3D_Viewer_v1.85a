import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function read(file) {
  return fs.readFileSync(path.resolve(file), 'utf8');
}

describe('Viewer3D UXML topobuilder toggle wiring', () => {
  it('keeps toggle default disabled in viewer defaults', () => {
    const defaults = read('viewer/viewer-3d-defaults.js');
    expect(defaults).toContain('intakeRouting');
    expect(defaults).toContain('useUxmlTopoBuilder: false');
  });

  it('wires viewer3d tab intake bridge imports and helper', () => {
    const tab = read('viewer/tabs/viewer3d-tab.js');
    expect(tab).toContain("from '../uxml/UxmlSourceIntakeBridge.js'");
    expect(tab).toContain("from '../converters/BrowserConverterExecutor.js'");
    expect(tab).toContain('function _isUxmlTopoBuilderEnabled()');
    expect(tab).toContain('async function _buildUxmlIntakeDirectData(file, explicitSourceType = \'AUTO\')');
  });

  it('renders checkbox and syncs config state', () => {
    const tab = read('viewer/tabs/viewer3d-tab.js');
    expect(tab).toContain('id="viewer3d-top-use-uxml-topobuilder"');
    expect(tab).toContain("syncCheck('viewer3d-top-use-uxml-topobuilder'");
    expect(tab).toContain("reason: 'use-uxml-topobuilder-toggled'");
  });

  it('routes PCF and raw import via UXML intake only when toggle is enabled', () => {
    const tab = read('viewer/tabs/viewer3d-tab.js');
    expect(tab).toContain("if (_isUxmlTopoBuilderEnabled()) {");
    expect(tab).toContain("_buildUxmlIntakeDirectData(file, 'PCF')");
    expect(tab).toContain("_buildUxmlIntakeDirectData(file, 'AUTO')");
    expect(tab).toContain("const result = await importFromRawFile(file, state, log);");
  });

  it('accepts staged JSON on raw import control', () => {
    const tab = read('viewer/tabs/viewer3d-tab.js');
    expect(tab).toContain('accept=".accdb,.mdb,.xml,.pdf,.json"');
  });
});

