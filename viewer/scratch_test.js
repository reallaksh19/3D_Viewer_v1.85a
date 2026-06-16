import fs from 'fs';

// Mock localStorage for Node
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

import { parse } from './parser/caesar-parser.js';
import { buildUniversalCSV, normalizeToPCFWithContinuity, buildPcfFromContinuity } from './utils/accdb-to-pcf.js';
import { pcfxDocumentFromPcfText } from './pcfx/Pcfx_PcfAdapter.js';
import { viewerComponentFromCanonicalItem } from './pcfx/Pcfx_GlbAdapter.js';
import { buildXmlSupportComponents } from './parser/xml-support-builder.js';

const text = fs.readFileSync('D:/tmp/CRF-4-1/XML/STEAM INJECTION P-45-2-I (ID-28684)_INPUT.XML', 'utf8');
const parsed = parse(text, 'mock-xml.xml');

const csvRows = buildUniversalCSV(parsed, { supportMappings: [] });
const segments = normalizeToPCFWithContinuity(csvRows, { method: 'ContEngineMethod', sourceName: 'mock' });
const pcfText = buildPcfFromContinuity(segments, { decimals: 4, sourceName: 'mock' });
const pcfxDoc = pcfxDocumentFromPcfText(pcfText, 'mock', {}, null);
const canonicalItems = pcfxDoc.canonical.items;

const components = canonicalItems
    .filter(item => {
        const t = String(item.type || '').toUpperCase();
        return t !== 'MESSAGE-CIRCLE' && t !== 'MESSAGE-SQUARE';
    })
    .map(item => viewerComponentFromCanonicalItem(item))
    .filter(Boolean);

console.log("Restraints length:", parsed?.restraints?.length);
console.log("Nodes length:", parsed?.nodes ? Object.keys(parsed.nodes).length : 0);

if (parsed?.restraints?.length && parsed?.nodes) {
    const xmlSupports = buildXmlSupportComponents(parsed, {
        verticalAxis: 'Y',
        worldNorth: parsed?.north || { x: 0, y: 0, z: -1 },
        defaultBore: 100,
    });
    
    console.log("Synthesized xmlSupports:", xmlSupports.length);
    
    // Wipe generic supports
    for (let i = components.length - 1; i >= 0; i--) {
        if (String(components[i]?.type || '').toUpperCase() === 'SUPPORT') {
            components.splice(i, 1);
        }
    }
    
    components.push(...xmlSupports);
}

const supports = components.filter(c => String(c.type || '').toUpperCase() === 'SUPPORT');
console.log(JSON.stringify(supports, null, 2));
