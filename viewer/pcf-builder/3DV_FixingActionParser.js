/**
 * 3DV_FixingActionParser.js
 * Parses "Fixing Action" column text → structured ActionDescriptor objects.
 * Contract: input text must follow the canonical syntax defined in implementation_plan.md
 */

/** @typedef {{ type: string, epIndex?: number, coords?: number[], ep1?: number[], ep2?: number[], bore?: number, distance?: number }} ActionDescriptor */

const V3 = (s) => s.split(',').map(v => Number(v.trim()));
const RC = (text, re) => { const m = text.match(re); return m ? m[1] : null; };

/**
 * Parse a fixingAction text string into a structured descriptor.
 * @param {string} text
 * @returns {ActionDescriptor | null}
 */
export function parseFixingAction(text) {
    if (!text || !text.trim()) return null;
    const t = text.trim();

    if (t.startsWith('TRIM')) return _parseTrim(t);
    if (t.startsWith('SNAP: Merge')) return _parseSnap(t);
    if (t.startsWith('SNAP: Close')) return _parseExtend(t);
    if (t.startsWith('INSERT PIPE')) return _parseInsertPipe(t);
    if (t.startsWith('FILL GAP')) return _parseFillGap(t);
    if (t.startsWith('DELETE ROW')) return { type: 'DELETE' };
    if (t.startsWith('REVIEW REQUIRED')) return { type: 'REVIEW' };
    return null;
}

function _parseTrim(t) {
    const epRaw = RC(t, /Endpoint\s+(\d+):/);
    const coordRaw = RC(t, /New coord:\s*\(([^)]+)\)/);
    if (!epRaw || !coordRaw) return null;
    return { type: 'TRIM', epIndex: Number(epRaw) - 1, coords: V3(coordRaw) };
}

function _parseSnap(t) {
    const targets = [];
    const re = /EP(\d):\s*Move\s*[\d.]+mm\s*→\s*\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
        targets.push({ epIndex: Number(m[1]) - 1, coords: V3(m[2]) });
    }
    return targets.length ? { type: 'SNAP', targets } : null;
}

function _parseExtend(t) {
    const targets = [];
    const re = /EP(\d):\s*Extend\s*([\d.]+)mm/g;
    let m;
    while ((m = re.exec(t)) !== null) {
        targets.push({ epIndex: Number(m[1]) - 1, distance: Number(m[2]) });
    }
    return targets.length ? { type: 'EXTEND', targets } : null;
}

function _parseInsertPipe(t) {
    const ep1Raw = RC(t, /EP1:\s*\(([^)]+)\)/);
    const ep2Raw = RC(t, /EP2:\s*\(([^)]+)\)/);
    const boreRaw = RC(t, /Bore:\s*([\d.]+)mm/);
    if (!ep1Raw || !ep2Raw) return null;
    return { type: 'INSERT_PIPE', ep1: V3(ep1Raw), ep2: V3(ep2Raw), bore: boreRaw ? Number(boreRaw) : 0 };
}

function _parseFillGap(t) {
    const fromRaw = RC(t, /From:\s*\(([^)]+)\)/);
    const toRaw = RC(t, /To:\s*\(([^)]+)\)/);
    if (!fromRaw || !toRaw) return null;
    return { type: 'FILL_GAP', ep1: V3(fromRaw), ep2: V3(toRaw), bore: 0 };
}
