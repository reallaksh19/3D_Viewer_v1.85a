import { createSvgShell, drawDimension, svgDefs } from './svg-shell.js';

export function generateTrunnionSvg(inputs) {
  const { od, wall, fx, fy, fz } = inputs;

  const fShear = Math.sqrt(fy*fy + fz*fz).toFixed(0);

  // Proportional scaling for visual representation
  // Let base OD render as 100 pixels, scale everything else proportionally
  const baseScale = 100 / (od || 100);
  const visualR = (od / 2) * baseScale;
  const visualInnerR = ((od - 2*wall) / 2) * baseScale;

  const svg = `
    ${createSvgShell("0 0 300 300")}
    ${svgDefs}

    <!-- Main Pipe -->
    <circle cx="150" cy="150" r="${visualR}" fill="none" stroke="#333" stroke-width="3"/>
    <circle cx="150" cy="150" r="${visualInnerR}" fill="none" stroke="#333" stroke-width="1" stroke-dasharray="5,5"/>

    <!-- Trunnion Attachment (Top view projection) -->
    <rect x="130" y="${150 - visualR - 20}" width="40" height="20" fill="#ccc" stroke="#333" stroke-width="2"/>

    <!-- Forces -->
    <!-- Fx Axial -->
    <line x1="150" y1="20" x2="150" y2="50" stroke="red" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="160" y="30" fill="red" font-size="12">Fx = ${fx} N</text>

    <!-- FShear -->
    <line x1="100" y1="${150 - visualR - 10}" x2="130" y2="${150 - visualR - 10}" stroke="blue" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="50" y="${150 - visualR - 5}" fill="blue" font-size="12">V = ${fShear} N</text>

    <!-- Dimensions -->
    ${drawDimension(150 - visualR, 150, 150 + visualR, 150, `OD = ${od} mm`, -110)}
    ${drawDimension(150, 150 - visualR, 150, 150 - visualInnerR, `t = ${wall} mm`, 50)}

    </svg>
  `;
  return svg;
}
