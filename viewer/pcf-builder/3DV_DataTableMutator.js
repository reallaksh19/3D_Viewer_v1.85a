/**
 * 3DV_DataTableMutator.js
 * Applies parsed ActionDescriptors to a deep-cloned components array.
 * Tracks every edit as an EditRecord for the Smart Actions log and cell highlighting.
 * Doctrine 3: all coordinates explicitly cast to Number() before arithmetic.
 */

import { parseFixingAction } from './3DV_FixingActionParser.js';

/** Deep-clone a single component's points safely */
const cloneComp = (c) => ({
    ...c,
    points: (c.points || []).map(p => ({ ...p })),
    centrePoint: c.centrePoint ? { ...c.centrePoint } : null,
    branch1Point: c.branch1Point ? { ...c.branch1Point } : null,
    coOrds: c.coOrds ? { ...c.coOrds } : null,
    attributes: { ...(c.attributes || {}) },
});

const fmtCoord = (p) => p ? `(${Number(p.x).toFixed(2)}, ${Number(p.y).toFixed(2)}, ${Number(p.z).toFixed(2)})` : '—';

/**
 * Apply all fixingAction mutations. Returns mutated clone + edit records.
 * @param {object[]} components
 * @returns {{ mutated: object[], edits: object[], insertions: object[] }}
 */
export function applyMutations(components) {
    const mutated = components.map(cloneComp);
    const edits = [];
    const seen = new Set(); // de-duplicate INSERT/FILL actions
    const toInsert = [];       // {afterIndex, comp}

    mutated.forEach((comp, idx) => {
        const action = parseFixingAction(comp.fixingAction || '');
        if (!action || action.type === 'REVIEW') return;

        const seq = idx + 1;

        if (action.type === 'TRIM') {
            const ep = comp.points?.[action.epIndex];
            if (!ep) return;
            const before = fmtCoord(ep);
            ep.x = Number(action.coords[0]);
            ep.y = Number(action.coords[1]);
            ep.z = Number(action.coords[2]);
            ep._edited = true;
            edits.push({
                type: 'TRIM', compSeq: seq, compId: comp.id,
                field: `EP${action.epIndex + 1}`, before, after: fmtCoord(ep),
                desc: `Trimmed EP${action.epIndex + 1} to intersection`
            });
        }

        else if (action.type === 'SNAP') {
            action.targets.forEach(tgt => {
                const ep = comp.points?.[tgt.epIndex];
                if (!ep) return;
                const before = fmtCoord(ep);
                ep.x = Number(tgt.coords[0]);
                ep.y = Number(tgt.coords[1]);
                ep.z = Number(tgt.coords[2]);
                ep._edited = true;
                edits.push({
                    type: 'SNAP', compSeq: seq, compId: comp.id,
                    field: `EP${tgt.epIndex + 1}`, before, after: fmtCoord(ep),
                    desc: `Snapped EP${tgt.epIndex + 1} to midpoint`
                });
            });
        }

        else if (action.type === 'EXTEND') {
            action.targets.forEach(tgt => {
                const epA = comp.points?.[0], epB = comp.points?.[1];
                if (!epA || !epB) return;
                const dx = Number(epB.x) - Number(epA.x);
                const dy = Number(epB.y) - Number(epA.y);
                const dz = Number(epB.z) - Number(epA.z);
                const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
                const ep = comp.points[tgt.epIndex];
                const dir = tgt.epIndex === 1 ? 1 : -1;
                const before = fmtCoord(ep);
                ep.x = Number(ep.x) + dir * (dx / len) * Number(tgt.distance);
                ep.y = Number(ep.y) + dir * (dy / len) * Number(tgt.distance);
                ep.z = Number(ep.z) + dir * (dz / len) * Number(tgt.distance);
                ep._edited = true;
                edits.push({
                    type: 'EXTEND', compSeq: seq, compId: comp.id,
                    field: `EP${tgt.epIndex + 1}`, before, after: fmtCoord(ep),
                    desc: `Extended EP${tgt.epIndex + 1} by ${tgt.distance}mm`
                });
            });
        }

        else if (action.type === 'INSERT_PIPE' || action.type === 'FILL_GAP') {
            const key = comp.fixingAction.trim().slice(0, 60);
            if (seen.has(key)) return; // de-duplicate
            seen.add(key);
            const bore = Number(action.bore) || (comp.bore || 0);
            const newComp = {
                id: `3dv-insert-${Date.now()}-${idx}`,
                type: 'PIPE',
                points: [
                    { x: Number(action.ep1[0]), y: Number(action.ep1[1]), z: Number(action.ep1[2]), bore },
                    { x: Number(action.ep2[0]), y: Number(action.ep2[1]), z: Number(action.ep2[2]), bore },
                ],
                centrePoint: null, branch1Point: null, coOrds: null,
                bore, attributes: {}, fixingAction: '', _inserted: true,
            };
            toInsert.push({ afterIndex: idx, comp: newComp });
            edits.push({
                type: action.type, compSeq: seq, compId: comp.id,
                field: 'INSERT', after: `EP1=${fmtCoord(newComp.points[0])} EP2=${fmtCoord(newComp.points[1])}`,
                desc: `New PIPE inserted after Row ${seq}`
            });
        }

        else if (action.type === 'DELETE') {
            comp._deleted = true;
            edits.push({ type: 'DELETE', compSeq: seq, compId: comp.id, desc: `Row ${seq} deleted` });
        }
    });

    // Apply insertions in reverse order so indices remain valid
    toInsert.sort((a, b) => b.afterIndex - a.afterIndex);
    toInsert.forEach(({ afterIndex, comp }) => mutated.splice(afterIndex + 1, 0, comp));

    // Remove deleted rows
    const final = mutated.filter(c => !c._deleted);

    return { mutated: final, edits };
}
