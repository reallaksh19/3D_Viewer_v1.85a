import { RvmSearchIndex } from '../../../rvm/RvmSearchIndex.js';
import { RvmMetadataIndex } from '../../../rvm/RvmMetadataIndex.js';
import { RvmTreeModel } from '../../../rvm/RvmTreeModel.js';

// Setup Mock DOM
if (!global.document) {
    global.document = {
        createElement: (tag) => {
            const el = {
                tagName: tag,
                className: '',
                innerHTML: '',
                textContent: '',
                children: [],
                classList: {
                    add: (c) => el.className += ` ${c}`,
                    contains: (c) => el.className.includes(c),
                    toggle: (c) => {
                        if (el.className.includes(c)) el.className = el.className.replace(c, '').trim();
                        else el.className += ` ${c}`;
                    }
                },
                appendChild: (child) => el.children.push(child),
                dataset: {},
                style: {}
            };
            return el;
        }
    };
}

async function runTests() {
    let success = true;
    const errors = [];


    // Mock Data
    const mockIdentityMap = {
        renderIdsFromCanonical: (id) => [id + '_render'],
        canonicalFromRender: (id) => id.replace('_render', '')
    };

    const mockRvmIndex = {
        nodes: [
            { canonicalObjectId: 'OBJ:1', parentCanonicalObjectId: null, name: 'Root Pipe', kind: 'PIPE', attributes: { ZONE: 'Area1', color: 'red' } },
            { canonicalObjectId: 'OBJ:2', parentCanonicalObjectId: 'OBJ:1', name: 'Elbow 1', kind: 'ELBOW', attributes: { SPEC: 'A105', npd: 100 } },
            { canonicalObjectId: 'OBJ:3', parentCanonicalObjectId: 'OBJ:1', name: 'Valve 1', kind: 'VALVE', attributes: { PIPE_NAME: 'P-101', type: 'gate' } }
        ]
    };

    // 1. Metadata Tests
    const metaIndex = new RvmMetadataIndex(mockRvmIndex, mockIdentityMap);


    // ✅ click in scene (renderObjectId) → correct attributes returned for that mesh
    const attrs = metaIndex.getAttributesByRenderId('OBJ:2_render');
    if (attrs && attrs.SPEC === 'A105') {
        console.log('✅ click in scene (renderObjectId) → correct attributes returned for that mesh');
    } else {
        errors.push('Failed to get correct attributes by render ID.');
    }

    // ✅ attribute panel renders ZONE field with highlight class
    const dummyEl = document.createElement('div');
    metaIndex.renderAttributesPanel(dummyEl, metaIndex.getNodeByCanonicalId('OBJ:1'));
    if (dummyEl.children[0].tagName === 'table' && dummyEl.children[0].children[0].children[0].className.includes('rvm-attr-highlight')) {
        console.log('✅ attribute panel renders ZONE field with highlight class');
    } else {
        errors.push('Failed to highlight ZONE attribute.');
    }


    // 2. Search Tests
    const searchIndex = new RvmSearchIndex(mockRvmIndex, mockIdentityMap);


    // Need to await build since we use setTimeout(0)
    await searchIndex.build();

    // ✅ build index from 3-node RvmIndex → 3 entries
    if (searchIndex._searchableEntries.length === 3) {
        console.log('✅ build index from 3-node RvmIndex → 3 entries');
    } else {
         errors.push(`Failed to build index with 3 entries, got ${searchIndex._searchableEntries.length}`);
    }

    // ✅ query "pipe" matches nodes whose attributes contain "pipe" (case-insensitive)
    let res = searchIndex.search('pipe');
    if (res.length === 2) { // Root Pipe, Valve 1 (has PIPE_NAME attribute)
        console.log('✅ query "pipe" matches nodes whose attributes contain "pipe" (case-insensitive)');
    } else {
        errors.push(`Query "pipe" returned ${res.length} expected 2`);
    }

    // ✅ query "" returns empty array (not all nodes)
    res = searchIndex.search('');
    if (res.length === 0) {
        console.log('✅ query "" returns empty array');
    } else {
         errors.push('Query "" should return empty array');
    }

    // ✅ query for unknown term returns []
    res = searchIndex.search('xyz123');
    if (res.length === 0) {
        console.log('✅ query for unknown term returns []');
    } else {
         errors.push('Query for unknown term should return empty array');
    }

    // ✅ renderObjectIds[] from search result matches identity map
    res = searchIndex.search('gate'); // Valve 1
    if (res.length === 1 && res[0].renderObjectIds[0] === 'OBJ:3_render') {
         console.log('✅ renderObjectIds[] from search result matches identity map');
    } else {
         errors.push('Search result renderObjectIds[] did not match identity map');
    }

    // 3. Tree Tests
    let selectCalledWith = null;
    const mockViewerCtx = {
        viewer: {
            selectByCanonicalId: (id) => selectCalledWith = id,
            fitSelection: () => {}
        }
    };

    const treeModel = new RvmTreeModel(mockRvmIndex, mockViewerCtx);
    treeModel.build();
    const treeEl = document.createElement('div');
    treeModel.renderTree(treeEl);

    // ✅ click in tree → selectByCanonicalId called with correct id
    // Simulate click on Root Pipe's label Div
    const rootNodeLi = treeEl.children[0].children[0];
    const labelDiv = rootNodeLi.children[0];


    // Simulate the e.stopPropagation() mock event
    labelDiv.onclick({ stopPropagation: () => {} });

    if (selectCalledWith === 'OBJ:1') {
         console.log('✅ click in tree → selectByCanonicalId called with correct id');
    } else {
         errors.push('Click in tree did not call selectByCanonicalId correctly');
    }

    if (errors.length > 0) {
        errors.forEach(e => console.error('❌', e));
        process.exit(1);
    } else {
        console.log('✅ All rvm-search unit tests passed.');
    }
}

runTests();
