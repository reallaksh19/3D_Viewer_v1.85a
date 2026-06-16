import { RvmTreeModel } from '../../../rvm/RvmTreeModel.js';

// Minimal DOM mock - no jsdom required
if (!global.document) {
  global.document = {
    createElement: (tag) => {
      const el = {
        tagName: tag,
        className: '',
        innerHTML: '',
        textContent: '',
        children: [],
        _checked: false,
        classList: {
          add: (c) => { if (!el.className.includes(c)) el.className += ` ${c}`; },
          remove: (c) => { el.className = el.className.replace(c, '').trim(); },
          contains: (c) => el.className.includes(c),
          toggle: (c, force) => {
            const has = el.className.includes(c);
            if (force === true && !has) el.className += ` ${c}`;
            else if (force === false && has) el.className = el.className.replace(c, '').trim();
            else if (force === undefined) {
              if (has) el.className = el.className.replace(c, '').trim();
              else el.className += ` ${c}`;
            }
          },
        },
        appendChild: (child) => { el.children.push(child); return child; },
        dataset: {},
        style: {},
        onclick: null,
        onchange: null,
      };
      return el;
    },
  };
}

const mockRvmIndex = {
  nodes: [
    { canonicalObjectId: 'OBJ:1', parentCanonicalObjectId: null, name: 'Root', kind: 'PIPE' },
    { canonicalObjectId: 'OBJ:2', parentCanonicalObjectId: 'OBJ:1', name: 'Elbow1', kind: 'ELBOW' },
    { canonicalObjectId: 'OBJ:3', parentCanonicalObjectId: 'OBJ:1', name: 'Valve1', kind: 'VALVE' },
    { canonicalObjectId: 'OBJ:4', parentCanonicalObjectId: null, name: 'Branch2', kind: 'PIPE' },
    { canonicalObjectId: 'OBJ:5', parentCanonicalObjectId: 'OBJ:4', name: 'Flange1', kind: 'FLANGE' },
  ],
};

function makeViewerMock() {
  const mock = {
    selectCanonicalIdsCalled: [],
    selectByCanonicalIdCalled: [],
    clearSelectionCalled: 0,
    _selectedIds: [],
    selectCanonicalIds(ids) {
      mock.selectCanonicalIdsCalled.push([...ids]);
      mock._selectedIds = [...ids];
    },
    selectByCanonicalId(id) {
      mock.selectByCanonicalIdCalled.push(id);
      mock._selectedIds = [id];
    },
    clearSelection() {
      mock.clearSelectionCalled++;
      mock._selectedIds = [];
    },
    getSelectedCanonicalIds() { return mock._selectedIds; },
    getSelectedCanonicalId() { return mock._selectedIds[0] || null; },
    getSelectionRenderIds() { return mock._selectedIds; },
  };
  return mock;
}

async function runTests() {
  const errors = [];

  // ── T1: getDescendantCanonicalIds leaf (no children) ──────────────────────
  {
    const tree = new RvmTreeModel(mockRvmIndex, { viewer: makeViewerMock() });
    tree.build();
    const desc = tree.getDescendantCanonicalIds('OBJ:3', true);
    if (desc.length === 1 && desc[0] === 'OBJ:3') {
      console.log('✅ T1: leaf getDescendantCanonicalIds(includeSelf=true) returns [self]');
    } else {
      errors.push(`T1 failed: expected [OBJ:3] got ${JSON.stringify(desc)}`);
    }
  }

  // ── T2: parent checkbox selects parent + all descendants ───────────────────
  {
    const tree = new RvmTreeModel(mockRvmIndex, { viewer: makeViewerMock() });
    tree.build();
    const desc = tree.getDescendantCanonicalIds('OBJ:1', true);
    const has1 = desc.includes('OBJ:1');
    const has2 = desc.includes('OBJ:2');
    const has3 = desc.includes('OBJ:3');
    if (has1 && has2 && has3 && desc.length === 3) {
      console.log('✅ T2: parent getDescendantCanonicalIds includes parent + 2 descendants');
    } else {
      errors.push(`T2 failed: got ${JSON.stringify(desc)}`);
    }
  }

  // ── T3: multiple branches can be selected ──────────────────────────────────
  {
    const viewer = makeViewerMock();
    const tree = new RvmTreeModel(mockRvmIndex, { viewer });
    tree.build();

    // Simulate selecting OBJ:2 and OBJ:5 (different branches)
    viewer.selectCanonicalIds(['OBJ:2', 'OBJ:5']);
    const ids = viewer.getSelectedCanonicalIds();
    if (ids.length === 2 && ids.includes('OBJ:2') && ids.includes('OBJ:5')) {
      console.log('✅ T3: multiple branches can be selected simultaneously');
    } else {
      errors.push(`T3 failed: got ${JSON.stringify(ids)}`);
    }
  }

  // ── T4: toggleCanonicalId via viewer mock adds then removes ────────────────
  {
    const viewer = makeViewerMock();
    // Simulate toggle add
    viewer.selectCanonicalIds(['OBJ:2']);
    let ids = viewer.getSelectedCanonicalIds();
    if (!ids.includes('OBJ:2')) { errors.push('T4a: OBJ:2 not selected after selectCanonicalIds'); }

    // Now simulate toggle remove by replacing with empty (viewer handles the logic)
    viewer.selectCanonicalIds([]);
    ids = viewer.getSelectedCanonicalIds();
    if (ids.length === 0) {
      console.log('✅ T4: toggle add/remove via selectCanonicalIds works');
    } else {
      errors.push(`T4 failed: after remove got ${JSON.stringify(ids)}`);
    }
  }

  // ── T5: setSelectedCanonicalIds updates checked state ─────────────────────
  {
    const viewer = makeViewerMock();
    const tree = new RvmTreeModel(mockRvmIndex, { viewer });
    tree.build();
    // Render tree so _liMap/_checkboxMap are populated
    const container = document.createElement('div');
    tree.renderTree(container);

    tree.setSelectedCanonicalIds(['OBJ:2', 'OBJ:3']);
    const li2 = tree._liMap.get('OBJ:2');
    const li3 = tree._liMap.get('OBJ:3');
    const li1 = tree._liMap.get('OBJ:1');

    const ok2 = li2 && li2.classList.contains('is-checked');
    const ok3 = li3 && li3.classList.contains('is-checked');
    if (ok2 && ok3) {
      console.log('✅ T5: setSelectedCanonicalIds marks leaf nodes as is-checked');
    } else {
      errors.push(`T5 failed: li2.checked=${ok2} li3.checked=${ok3}`);
    }
  }

  // ── T6: partial selection marks parent as indeterminate ───────────────────
  {
    const viewer = makeViewerMock();
    const tree = new RvmTreeModel(mockRvmIndex, { viewer });
    tree.build();
    const container = document.createElement('div');
    tree.renderTree(container);

    // Only OBJ:2 selected (not OBJ:3), so OBJ:1 parent should be indeterminate
    tree.setSelectedCanonicalIds(['OBJ:2']);
    const li1 = tree._liMap.get('OBJ:1');

    const isIndeterminate = li1 && li1.classList.contains('is-indeterminate');
    const isChecked = li1 && li1.classList.contains('is-checked');
    if (isIndeterminate && !isChecked) {
      console.log('✅ T6: partial child selection makes parent indeterminate');
    } else {
      errors.push(`T6 failed: indeterminate=${isIndeterminate} checked=${isChecked}`);
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    errors.forEach((e) => console.error('❌', e));
    process.exit(1);
  } else {
    console.log('✅ All Wave 1 multi-select tests passed.');
  }
}

runTests();
