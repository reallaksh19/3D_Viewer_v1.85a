import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');
const coreDir = path.join(repoRoot, 'viewer/converters/xml-cii2019-core');
const benchDir = path.join(repoRoot, 'Benchmarks/XML-CII-2019/sideload');

const {
  DEFAULT_XML_CII_SIDELOAD_JSON_CONFIG,
  normalizeXmlCiiSideloadJsonConfig,
  parseXmlCiiSideloadJsonConfig,
  getConfiguredPositions,
  getConfiguredPsKeys,
  getConfiguredAttribute,
  classifyConfiguredRestraint,
} = await import(new URL(`file://${path.join(coreDir, 'sideload-json-config.js').replace(/\\/g, '/')}`).href);

const config = parseXmlCiiSideloadJsonConfig(fs.readFileSync(path.join(benchDir, 'bm_3branches_20nodes.json-config.json'), 'utf8'));
const sourceJson = JSON.parse(fs.readFileSync(path.join(benchDir, 'bm_3branches_20nodes.source-like.json'), 'utf8'));

assert.ok(DEFAULT_XML_CII_SIDELOAD_JSON_CONFIG.itemExtractors.RESTRAINT_META.sourceFieldAliases.includes('NODEFRICTION'));
assert.ok(DEFAULT_XML_CII_SIDELOAD_JSON_CONFIG.itemExtractors.RATING.sourceFieldAliases.includes('DTXR'));
assert.ok(config.basisResolvers.POS.objectFieldAliases.includes('APOS'));
assert.ok(config.basisResolvers.POS.textFieldAliases.includes('POSI'));
assert.ok(config.itemExtractors.WEIGHT.sourceFieldAliases.includes('PSIWEIGHT'));
assert.ok(config.itemExtractors.RESTRAINT_META.sourceFieldAliases.includes('NODEGAP'));

const branch = sourceJson.find((row) => row.name?.includes('/B2'));
const supportRest = branch.children.find((child) => child.attributes?.SUPPORT_TAG === 'PS-12244');
const supportGuide = branch.children.find((child) => child.attributes?.SUPPORT_TAG === 'PS-12246.2');
const supportLineStop = branch.children.find((child) => child.attributes?.SUPPORT_TAG === 'PS-12248.5');
const flange = branch.children.find((child) => child.type === 'FLAN');

assert.ok(getConfiguredPsKeys(supportRest.attributes, config.basisResolvers.PS).some((row) => row.value === 'PS-12244'));
assert.ok(getConfiguredPositions(supportRest.attributes, config.basisResolvers.POS).some((row) => row.alias === 'POS'));
assert.ok(getConfiguredPositions(supportRest.attributes, config.basisResolvers.POS).some((row) => row.alias === 'POSI'));
assert.strictEqual(classifyConfiguredRestraint(supportRest.attributes, config.itemExtractors.RESTRAINT).kind, 'REST');
assert.strictEqual(classifyConfiguredRestraint(supportGuide.attributes, config.itemExtractors.RESTRAINT).kind, 'GUIDE');
assert.strictEqual(classifyConfiguredRestraint(supportLineStop.attributes, config.itemExtractors.RESTRAINT).kind, 'LINESTOP');
assert.strictEqual(getConfiguredAttribute(supportLineStop.attributes, config.itemExtractors.RESTRAINT_META.sourceFieldAliases), '0');
assert.ok(String(getConfiguredAttribute(flange.attributes, config.itemExtractors.RATING.sourceFieldAliases)).includes('900'));

const custom = normalizeXmlCiiSideloadJsonConfig({
  basisResolvers: {
    PS: { fieldAliases: ['CUSTOM_PS'] },
    POS: { objectFieldAliases: ['CUSTOM_POS'], textFieldAliases: ['CUSTOM_POS_TEXT'] },
  },
  itemExtractors: {
    RESTRAINT: { sourceFieldAliases: ['CUSTOM_KIND'] },
    WEIGHT: { sourceFieldAliases: ['CUSTOM_WEIGHT'] },
  },
});
assert.deepStrictEqual(custom.basisResolvers.PS.fieldAliases, ['CUSTOM_PS']);
assert.deepStrictEqual(custom.basisResolvers.POS.objectFieldAliases, ['CUSTOM_POS']);
assert.deepStrictEqual(custom.itemExtractors.RESTRAINT.sourceFieldAliases, ['CUSTOM_KIND']);
assert.deepStrictEqual(custom.itemExtractors.WEIGHT.sourceFieldAliases, ['CUSTOM_WEIGHT']);
assert.ok(custom.itemExtractors.RATING.sourceFieldAliases.includes('DTXR'), 'Unspecified sections must keep defaults');

console.log('✅ XML CII JSON config alias tests passed', {
  psAliases: config.basisResolvers.PS.fieldAliases.length,
  posObjectAliases: config.basisResolvers.POS.objectFieldAliases.length,
  restraintAliases: config.itemExtractors.RESTRAINT.sourceFieldAliases.length,
});
