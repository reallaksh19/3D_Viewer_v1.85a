export function createSvgShell(viewBox = "0 0 400 400") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" style="max-height: 100%;">`;
}

export function drawDimension(x1, y1, x2, y2, label, offset = 10) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const nx = dy / len;
  const ny = -dx / len;

  const lineX1 = x1 + nx * offset;
  const lineY1 = y1 + ny * offset;
  const lineX2 = x2 + nx * offset;
  const lineY2 = y2 + ny * offset;

  const midX = (lineX1 + lineX2) / 2;
  const midY = (lineY1 + lineY2) / 2;

  return `
    <line x1="${lineX1}" y1="${lineY1}" x2="${lineX2}" y2="${lineY2}" stroke="#1a5fa3" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${midX}" y="${midY - 5}" font-family="sans-serif" font-size="12" fill="#1a5fa3" text-anchor="middle">${label}</text>
  `;
}

export const svgDefs = `
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#1a5fa3" />
    </marker>
  </defs>
`;
