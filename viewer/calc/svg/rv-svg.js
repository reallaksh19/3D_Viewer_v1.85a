import { createSvgShell, drawDimension, svgDefs } from './svg-shell.js';

export function generateRvSvg(inputs) {
  const { pset, w, ae } = inputs;

  const svg = `
    ${createSvgShell("0 0 300 300")}
    ${svgDefs}

    <!-- Pipe Branch -->
    <rect x="130" y="200" width="40" height="80" fill="#ddd" stroke="#333" stroke-width="2"/>

    <!-- Relief Valve Body -->
    <polygon points="120,200 180,200 180,140 120,140" fill="#ccc" stroke="#333" stroke-width="2"/>
    <polygon points="130,140 170,140 150,100" fill="#aaa" stroke="#333" stroke-width="2"/>

    <!-- Discharge Pipe -->
    <rect x="180" y="150" width="80" height="30" fill="#ddd" stroke="#333" stroke-width="2"/>

    <!-- Discharge Exit Area Arrow -->
    <path d="M 270 155 Q 290 165 270 175" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="275" y="195" font-size="12" fill="#666">Ae = ${ae}</text>

    <!-- Reaction Force Arrow -->
    <line x1="180" y1="165" x2="80" y2="165" stroke="red" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="40" y="160" fill="red" font-size="14" font-weight="bold">Reaction F</text>

    <!-- Inputs text -->
    <text x="150" y="250" text-anchor="middle" font-size="12" fill="blue">Pset = ${pset}</text>
    <text x="150" y="270" text-anchor="middle" font-size="12" fill="blue">W = ${w}</text>

    </svg>
  `;
  return svg;
}
