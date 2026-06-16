const AXES = ['x', 'y', 'z'];
const PS_AXES = ['e', 'u', 's'];
const SIGN_SETS = [
  { e: 1, u: 1, s: 1 },
  { e: 1, u: 1, s: -1 },
  { e: 1, u: -1, s: 1 },
  { e: 1, u: -1, s: -1 },
  { e: -1, u: 1, s: 1 },
  { e: -1, u: 1, s: -1 },
  { e: -1, u: -1, s: 1 },
  { e: -1, u: -1, s: -1 },
];

export function psnmNumber(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}
export function psnmText(value) { return String(value ?? '').trim(); }
export function psnmHtml(value) { return psnmText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function psnmFixed(value, decimals = 3) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(decimals) : '-'; }

export function psnmParsePsPositionAny(value) {
  const text = psnmText(value).replace(/,/g, ' ');
  const out = { e: NaN, u: NaN, s: NaN };
  for (const match of text.matchAll(/\b([EWSNUD])\s*(-?\d+(?:\.\d+)?)\s*(?:mm)?\b/gi)) {
    const axis = match[1].toUpperCase();
    const n = Number(match[2]);
    if (axis === 'E') out.e = n;
    else if (axis === 'W') out.e = -n;
    else if (axis === 'U') out.u = n;
    else if (axis === 'D') out.u = -n;
    else if (axis === 'S' || axis === 'N') out.s = n;
  }
  return out;
}
export function psnmAxisPermutations() {
  return [
    ['x', 'y', 'z'], ['x', 'z', 'y'], ['y', 'x', 'z'],
    ['y', 'z', 'x'], ['z', 'x', 'y'], ['z', 'y', 'x'],
  ];
}
export function psnmMakeAxisTransform(ps, node, axisOrder, signs) {
  const axes = { e: axisOrder[0], u: axisOrder[1], s: axisOrder[2] };
  const offsets = {
    e: ps.e - signs.e * Number(node[axes.e]),
    u: ps.u - signs.u * Number(node[axes.u]),
    s: ps.s - signs.s * Number(node[axes.s]),
  };
  return {
    axisMode: true,
    axes,
    signs,
    offsets,
    datumE: offsets.e,
    datumU: offsets.u,
    datumS: offsets.s,
    axisFormula: `E=${signs.e < 0 ? '-' : ''}${axes.e.toUpperCase()}+${psnmFixed(offsets.e)}, U=${signs.u < 0 ? '-' : ''}${axes.u.toUpperCase()}+${psnmFixed(offsets.u)}, S=${signs.s < 0 ? '-' : ''}${axes.s.toUpperCase()}+${psnmFixed(offsets.s)}`,
    formula: {
      nodeToPs: `E=${signs.e < 0 ? '-' : ''}${axes.e.toUpperCase()}+datumE, U=${signs.u < 0 ? '-' : ''}${axes.u.toUpperCase()}+datumU, S=${signs.s < 0 ? '-' : ''}${axes.s.toUpperCase()}+datumS`,
      psToNode: 'axis-permuted inverse transform',
    },
  };
}
export function psnmTransformNodeToPs(node, transform) {
  if (!transform?.axisMode) {
    return {
      e: Number(node.x) + Number(transform?.datumE || 0),
      u: Number(node.y) + Number(transform?.datumU || 0),
      s: Number(node.z) + Number(transform?.datumS || 0),
    };
  }
  return {
    e: transform.signs.e * Number(node[transform.axes.e]) + Number(transform.offsets.e),
    u: transform.signs.u * Number(node[transform.axes.u]) + Number(transform.offsets.u),
    s: transform.signs.s * Number(node[transform.axes.s]) + Number(transform.offsets.s),
  };
}
export function psnmTransformPsToNode(ps, transform) {
  if (!transform?.axisMode) {
    return {
      x: Number(ps.e) - Number(transform?.datumE || 0),
      y: Number(ps.u) - Number(transform?.datumU || 0),
      z: Number(ps.s) - Number(transform?.datumS || 0),
    };
  }
  const out = { x: NaN, y: NaN, z: NaN };
  for (const psAxis of PS_AXES) {
    const nodeAxis = transform.axes[psAxis];
    out[nodeAxis] = (Number(ps[psAxis]) - Number(transform.offsets[psAxis])) / Number(transform.signs[psAxis]);
  }
  return out;
}
export function psnmDelta(ps, nodePs) {
  const de = Number(nodePs.e) - Number(ps.e);
  const du = Number(nodePs.u) - Number(ps.u);
  const ds = Number(nodePs.s) - Number(ps.s);
  return { de, du, ds, maxAbs: Math.max(Math.abs(de), Math.abs(du), Math.abs(ds)) };
}
export function psnmSignSets() { return SIGN_SETS; }
