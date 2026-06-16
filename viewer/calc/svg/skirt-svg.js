import { createSvgShell, drawDimension, svgDefs } from './svg-shell.js';

export function generateSkirtSvg(inputs) {
  const { h, t_wall } = inputs;

  const svg = `
    ${createSvgShell("0 0 300 400")}
    ${svgDefs}

    <!-- Vessel Bottom -->
    <path d="M 50 100 Q 150 150 250 100" fill="none" stroke="#333" stroke-width="3"/>
    <text x="150" y="80" text-anchor="middle" font-size="14" font-weight="bold">Vessel</text>

    <!-- Skirt walls -->
    <rect x="50" y="100" width="${Math.max(2, t_wall * 2)}" height="200" fill="#ccc" stroke="#333"/>
    <rect x="${250 - Math.max(2, t_wall * 2)}" y="100" width="${Math.max(2, t_wall * 2)}" height="200" fill="#ccc" stroke="#333"/>

    <!-- Foundation -->
    <rect x="20" y="300" width="260" height="20" fill="#888" />
    <text x="150" y="340" text-anchor="middle" font-size="12">Foundation</text>

    <!-- Dimensions -->
    ${drawDimension(270, 100, 270, 300, `h = ${h} mm`, 10)}
    ${drawDimension(50, 200, 50 + Math.max(2, t_wall * 2), 200, `t = ${t_wall} mm`, -30)}

    <!-- Temperatures -->
    <text x="150" y="120" fill="red" text-anchor="middle">Top T = ${inputs.t} °C</text>
    <text x="150" y="280" fill="blue" text-anchor="middle">Ambient Ta = ${inputs.ta} °C</text>

    </svg>
  `;
  return svg;
}
