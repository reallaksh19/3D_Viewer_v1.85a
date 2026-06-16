import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreDir = path.join(__dirname, '../viewer/converters/xml-cii2019-core');

const configModule = await import(new URL(`file://${path.join(coreDir, 'config.js').replace(/\\/g, '/')}`).href);
const mappingModule = await import(new URL(`file://${path.join(coreDir, 'support-mapping-config.js').replace(/\\/g, '/')}`).href);

const {
  parseXmlCiiEnrichmentConfig,
  migrateXmlCiiSupportConfigJson,
} = configModule;

const {
  migrateSupportMappingConfig,
  normalizeXmlTypes,
  supportKindToXmlTypeFromMapping,
  supportRulesFromMapping,
} = mappingModule;

const defaults = parseXmlCiiEnrichmentConfig('');
assert.strictEqual(defaults.supportMapping.version, 2);
assert.strictEqual(defaults.supportMapping.useJsonForRestraints, true);
assert.strictEqual(defaults.supportKindToXmlType.REST, '+Y');
assert.strictEqual(defaults.supportKindToXmlType.GUIDE, 'GUI');
assert.strictEqual(defaults.supportKindToXmlType.LINESTOP, 'LIM');
assert.strictEqual(defaults.supportMapping.kindProfiles.REST.xmlTypes[0], '+Y');
assert.strictEqual(defaults.supportMapping.kindProfiles.GUIDE.xmlTypes[0], 'GUI');
assert.strictEqual(defaults.supportMapping.kindProfiles.LINESTOP.xmlTypes[0], 'LIM');
assert.ok(supportRulesFromMapping(defaults.supportMapping).some((rule) => rule.kind === 'REST' && /REST|SHOE|BP/.test(rule.pattern)));
assert.ok(supportRulesFromMapping(defaults.supportMapping).some((rule) => rule.kind === 'GUIDE' && /PG-/.test(rule.pattern)));
assert.ok(supportRulesFromMapping(defaults.supportMapping).some((rule) => rule.kind === 'LINESTOP' && /LS-/.test(rule.pattern)));

const legacy = parseXmlCiiEnrichmentConfig(JSON.stringify({
  useRestraintTypeBasedOnJson: false,
  supportKindToXmlType: {
    GUIDE: 'X',
    LINESTOP: 'Z',
    REST: '+Y',
  },
}));
assert.strictEqual(legacy.supportMapping.useJsonForRestraints, false);
assert.strictEqual(legacy.supportKindToXmlType.GUIDE, 'GUI');
assert.strictEqual(legacy.supportKindToXmlType.LINESTOP, 'LIM');
assert.strictEqual(legacy.supportKindToXmlType.REST, '+Y');

const migratedText = migrateXmlCiiSupportConfigJson(JSON.stringify({
  supportKindToXmlType: {
    GUIDE: 'GUIDE',
    LIMIT: 'LIMIT',
    LINESTOP: 'LINESTOP',
  },
}));
const migrated = JSON.parse(migratedText);
assert.strictEqual(migrated.supportMapping.version, 2);
assert.strictEqual(migrated.supportKindToXmlType.GUIDE, 'GUI');
assert.strictEqual(migrated.supportKindToXmlType.LIMIT, 'LIM');
assert.strictEqual(migrated.supportKindToXmlType.LINESTOP, 'LIM');

const existingV2 = migrateSupportMappingConfig({
  supportMapping: {
    version: 2,
    useJsonForRestraints: true,
    rules: [
      { id: 'x', enabled: true, priority: 5, field: 'CMPSUPTYPE', match: 'startsWith', pattern: 'PG-', kind: 'GUIDE' },
    ],
    kindProfiles: {
      REST: { xmlTypes: '+Y' },
      GUIDE: { xmlTypes: 'GUI' },
      LINESTOP: { xmlTypes: 'LIM' },
      LIMIT: { xmlTypes: 'LIM' },
      ANCHOR: { xmlTypes: 'A' },
      SPRING: { xmlTypes: 'Y' },
    },
  },
});
assert.strictEqual(existingV2.rules.length, 1);
assert.strictEqual(supportKindToXmlTypeFromMapping(existingV2).GUIDE, 'GUI');

assert.deepStrictEqual(normalizeXmlTypes('+Y'), ['+Y']);
assert.deepStrictEqual(normalizeXmlTypes('GUI+LIM'), ['GUI', 'LIM']);
assert.deepStrictEqual(normalizeXmlTypes('+Y+GUI'), ['+Y', 'GUI']);
assert.deepStrictEqual(normalizeXmlTypes(['+Y', 'GUI']), ['+Y', 'GUI']);

console.log('✅ support mapping config migration regression tests passed');
