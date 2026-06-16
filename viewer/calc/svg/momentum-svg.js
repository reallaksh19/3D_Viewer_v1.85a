import { createSvgShell, drawDimension, svgDefs } from './svg-shell.js';

export function generateMomentumSvg(inputs) {
  const { v, density } = inputs;

  const svg = `
    ${createSvgShell("0 0 300 300")}
    ${svgDefs}

    <!-- Pipe cross section -->
    <rect x="50" y="100" width="200" height="100" fill="#ccf" stroke="#333" stroke-width="2"/>
    <ellipse cx="250" cy="150" rx="20" ry="50" fill="#aaf" stroke="#333"/>
    <ellipse cx="50" cy="150" rx="20" ry="50" fill="#aaf" stroke="#333" stroke-dasharray="2,2"/>

    <!-- Flow vectors -->
    <line x1="80" y1="130" x2="180" y2="130" stroke="blue" stroke-width="3" marker-end="url(#arrow)"/>
    <line x1="80" y1="170" x2="180" y2="170" stroke="blue" stroke-width="3" marker-end="url(#arrow)"/>

    <text x="130" y="120" fill="blue" font-size="14" font-weight="bold">v = ${v} m/s</text>
    <text x="130" y="195" fill="blue" font-size="14">p = ${density}</text>

    <text x="150" y="250" text-anchor="middle" font-size="14">F = p * A * v²</text>
    </svg>
  `;
  return svg;
}
