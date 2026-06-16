import { createSvgShell, drawDimension, svgDefs } from './svg-shell.js';

export function generateSlugSvg(resPayload) {
  if (!resPayload) return `<span style="color:#888;">[Resolver Data Missing]</span>`;

  const { od, wall, runLength, fluidDensity, velocity, slugLength, daf, bendAngle } = resPayload.resolved;
  const isBend = resPayload.basis.bendNode || bendAngle > 0;

  const provDens = resPayload.resolutionLog.fluidDensity.sourceType;
  const provV = resPayload.resolutionLog.velocity.sourceType;

  const svg = `
    ${createSvgShell("0 0 350 350")}
    ${svgDefs}

    <text x="175" y="20" text-anchor="middle" font-weight="bold" font-size="14">Slug Load Diagram</text>

    <!-- Pipe Representation -->
    <rect x="50" y="100" width="250" height="40" fill="#ccf" stroke="#333" stroke-width="2"/>
    <ellipse cx="300" cy="120" rx="10" ry="20" fill="#aaf" stroke="#333"/>
    <ellipse cx="50" cy="120" rx="10" ry="20" fill="#aaf" stroke="#333" stroke-dasharray="2,2"/>

    <!-- Slug Mass Area -->
    <rect x="100" y="100" width="${Math.min(150, (slugLength/runLength || 0.5) * 200)}" height="40" fill="#1a5fa3" stroke="#333" stroke-width="2"/>

    <!-- Flow Vectors -->
    <line x1="80" y1="120" x2="250" y2="120" stroke="white" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="160" y="115" fill="white" font-size="12" font-weight="bold">v = ${velocity} m/s</text>

    ${isBend ? `<path d="M 300 120 Q 320 120 320 140 L 320 180" fill="none" stroke="#ccf" stroke-width="40"/>` : ''}

    <text x="175" y="170" text-anchor="middle" font-size="12" fill="#333">ρ = ${fluidDensity} kg/m³ | DAF = ${daf}</text>

    ${drawDimension(50, 90, 300, 90, `L = ${runLength} mm`, -15)}

    <!-- Provenance Footer -->
    <rect x="0" y="300" width="350" height="50" fill="#f0f0f0" />
    <text x="10" y="320" font-size="10" fill="#555">Line: ${resPayload.basis.lineRef || 'Manual'}</text>
    <text x="10" y="335" font-size="10" fill="#555">Src ρ: ${provDens} | Src v: ${provV} | Mode: ${isBend ? 'Bend' : 'Straight'}</text>
    </svg>
  `;

  return svg;
}
