import { createSvgShell, drawDimension, svgDefs } from './svg-shell.js';

export function generateNemaSvg(inputs) {
  const { fx, fy, fz, mx, my, mz, de } = inputs;
  const f_res = Math.sqrt(fx*fx + fy*fy + fz*fz).toFixed(0);
  const m_res = Math.sqrt(mx*mx + my*my + mz*mz).toFixed(0);

  const svg = `
    ${createSvgShell("0 0 300 300")}
    ${svgDefs}

    <!-- Equipment Nozzle -->
    <rect x="50" y="200" width="200" height="80" fill="#ccc" stroke="#333" stroke-width="2"/>
    <rect x="110" y="150" width="80" height="50" fill="#ddd" stroke="#333" stroke-width="2"/>

    <!-- Flange -->
    <rect x="100" y="130" width="100" height="20" fill="#aaa" stroke="#333" stroke-width="2"/>

    <!-- Piping load -->
    <line x1="150" y1="50" x2="150" y2="130" stroke="red" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="160" y="90" fill="red" font-size="14" font-weight="bold">F_res = ${f_res}</text>
    <text x="160" y="110" fill="red" font-size="14" font-weight="bold">M_res = ${m_res}</text>

    <!-- Dimensions -->
    ${drawDimension(110, 150, 190, 150, `De = ${de}"`, -20)}

    <text x="150" y="250" text-anchor="middle" font-size="14">NEMA Equipment</text>
    </svg>
  `;
  return svg;
}
