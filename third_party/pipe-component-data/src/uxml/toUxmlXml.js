import { escapeXml } from './xmlEscapes.js';
import { ARRAY_SECTION_KEYS, SECTION_TAGS } from './sectionNames.js';

export function toUxmlXml(graph) {
  const schemaVersion = escapeXml(graph?.schemaVersion || 'uxml-topology-v1');
  const profile = escapeXml(graph?.profile || 'UXML-TOPOLOGY-FULL');
  const lines = [`<UXML schemaVersion="${schemaVersion}" profile="${profile}">`];
  lines.push(renderObject('Header', graph?.header || {}));
  lines.push(renderObject('Units', graph?.units || {}));
  lines.push(renderObject('Adapter', graph?.adapter || {}));
  for (const key of ARRAY_SECTION_KEYS) {
    lines.push(renderArray(SECTION_TAGS[key], graph?.[key] || []));
  }
  lines.push('</UXML>');
  return lines.join('\n');
}

function renderObject(tag, value) {
  return `  <${tag} data="${escapeXml(JSON.stringify(value || {}))}"/>`;
}

function renderArray(tag, values) {
  const lines = [`  <${tag}>`];
  for (const value of values || []) {
    lines.push(`    <Item data="${escapeXml(JSON.stringify(value))}"/>`);
  }
  lines.push(`  </${tag}>`);
  return lines.join('\n');
}
