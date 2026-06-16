/**
 * pcf-parser.js — Parse PCF text into structured component objects
 * Ported from 3Dmodelgeneratorforpcf_Parser.js (React) to vanilla JS.
 *
 * Exports:
 *   parsePcf(rawText) → Component[]
 */

const COMP_TYPES = new Set([
    'PIPE', 'ELBOW', 'TEE', 'FLANGE', 'VALVE',
    'SUPPORT', 'BEND', 'REDUCER', 'CAP', 'GASKET', 'BOLT',
    'REDUCER-CONCENTRIC', 'REDUCER-ECCENTRIC', 'OLET',
    'INSTRUMENT', 'WELD', 'COUPLING', 'CROSS', 'STRAINER',
    'BLIND-FLANGE', 'UNION', 'TRAP', 'FILTER',
    'MESSAGE-SQUARE', // Added to prevent it being absorbed by previous component
    'MESSAGE-CIRCLE', // Node number annotation — CO-ORDS + TEXT + UNDIMENSIONED
]);

// _parseSession increments each call; _seqInSession resets per call.
// Combined they guarantee unique IDs across multiple parsePcf() calls for merged models.
let _parseSession = 0;
let _seqInSession = 0;
const _uid = () => `comp-${_parseSession}-${++_seqInSession}-${Date.now().toString(36)}`;

/**
 * Parse raw PCF text into an array of component objects.
 * Each component has: id, type, points[], centrePoint, branch1Point, coOrds, bore, attributes{}.
 * @param {string} rawText
 * @returns {object[]}
 */
export const parsePcf = (rawText) => {
    _parseSession++;  // Never reset — ensures cross-call ID uniqueness
    _seqInSession = 0;
    const components = [];
    const lines = rawText.split('\n').map(l => l.trim());

    let currentComp = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Component start — keyword on its own line
        if (COMP_TYPES.has(line)) {
            if (currentComp) components.push(currentComp);
            currentComp = {
                id: _uid(),
                type: line,
                points: [],
                centrePoint: null,
                branch1Point: null,
                coOrds: null,
                bore: 0,
                attributes: {},
                rawLines: [],  // Store original lines for regeneration
            };
            continue;
        }

        if (!currentComp) continue;

        if (line.startsWith('END-POINT')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const pt = {
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2]),
                    z: parseFloat(parts[3]),
                    bore: parts.length >= 5 ? parseFloat(parts[4]) : 0,
                };
                currentComp.points.push(pt);
                // Use bore from first END-POINT as component bore if not set
                if (currentComp.bore === 0) currentComp.bore = pt.bore;
            }
            currentComp.rawLines.push(line);
        } else if (line.startsWith('CENTRE-POINT')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const pt = {
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2]),
                    z: parseFloat(parts[3]),
                    bore: parts.length >= 5 ? parseFloat(parts[4]) : 0,
                };
                currentComp.centrePoint = pt;
                if (currentComp.bore === 0) currentComp.bore = pt.bore;
            }
            currentComp.rawLines.push(line);
        } else if (line.startsWith('BRANCH1-POINT')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const pt = {
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2]),
                    z: parseFloat(parts[3]),
                    bore: parts.length >= 5 ? parseFloat(parts[4]) : 0,
                };
                currentComp.branch1Point = pt;
                if (currentComp.bore === 0) currentComp.bore = pt.bore;
            }
            currentComp.rawLines.push(line);
        } else if (line.startsWith('CO-ORDS')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                currentComp.coOrds = {
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2]),
                    z: parseFloat(parts[3]),
                    bore: parts.length >= 5 ? parseFloat(parts[4]) : 0,
                };
            }
            currentComp.rawLines.push(line);
        } else {
            // Capture ALL attribute-like lines (COMPONENT-ATTRIBUTE, PIPELINE-REFERENCE, PIPING-CLASS, SKEY, etc.)
            const parts = line.split(/\s+/);
            if (parts.length > 1) {
                const key = parts[0];
                const val = parts.slice(1).join(' ');
                currentComp.attributes[key] = val;
            } else if (parts.length === 1 && !COMP_TYPES.has(line)) {
                // Single-value attributes
                currentComp.attributes[line] = '';
            }
            // Store raw line for regeneration fidelity
            currentComp.rawLines.push(line);
        }
    }

    if (currentComp) components.push(currentComp);

    return components;
};
