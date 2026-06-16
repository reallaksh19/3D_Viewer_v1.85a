import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');
const coreDir = path.join(repoRoot, 'viewer/converters/xml-cii2019-core');
const benchDir = path.join(repoRoot, 'Benchmarks/XML-CII-2019/sideload');

const jsonConfigModule = await import(new URL(`file://${path.join(coreDir, 'sideload-json-config.js').replace(/\\/g, '/')}`).href);
const resolverModule = await import(new URL(`file://${path.join(coreDir, 'sideload-resolver.js').replace(/\\/g, '/')}`).href);
const ledgerModule = await import(new URL(`file://${path.join(coreDir, 'sideload-ledger.js').replace(/\\/g, '/')}`).href);
const restraintsModule = await import(new URL(`file://${path.join(coreDir, 'sideload-restraints.js').replace(/\\/g, '/')}`).href);

const {
  parseXmlCiiSideloadJsonConfig,
  getConfiguredPositions,
  getConfiguredPsKeys,
  classifyConfiguredRestraint,
} = jsonConfigModule;
const {
  buildXmlCiiNodeResolverIndex,
  resolveXmlCiiPsToNode,
  resolveXmlCiiPositionToNode,
  normalizePsKey,
} = resolverModule;
const { resolveConfiguredJsonFacts, mergeXmlCiiMatchedFacts } = ledgerModule;
const { resolveManualRestraintRows } = restraintsModule;

const xmlText = fs.readFileSync(path.join(benchDir, 'bm_3branches_20nodes.input.xml'), 'utf8');
const sourceJson = JSON.parse(fs.readFileSync(path.join(benchDir, 'bm_3branches_20nodes.source-like.json'), 'utf8'));
const config = parseXmlCiiSideloadJsonConfig(fs.readFileSync(path.join(benchDir, 'bm_3branches_20nodes.json-config.json'), 'utf8'));
const manualText = fs.readFileSync(path.join(benchDir, 'bm_3branches_20nodes.sideload-restraints.txt'), 'utf8');

assert.ok(config.basisResolvers.POS.objectFieldAliases.includes('POS'));
assert.ok(config.basisResolvers.PS.fieldAliases.includes('SUPPORT_TAG'));
assert.strictEqual(normalizePsKey('/PS-12248.5/DATUM'), 'PS12248.5');
assert.strictEqual(normalizePsKey('PS12248.5'), 'PS12248.5');

const index = buildXmlCiiNodeResolverIndex(xmlText, { exactToleranceMm: 0.001 });
assert.strictEqual(index.stats.nodeCount, 20);
assert.strictEqual(resolveXmlCiiPsToNode(index, 'PS-12248.5').resolvedNodeNumber, '60');
assert.strictEqual(resolveXmlCiiPsToNode(index, 'PS12248.5').resolvedNodeNumber, '60');
assert.strictEqual(resolveXmlCiiPsToNode(index, 'PS-Z-999').status, 'NOT_FOUND');

const posResult = resolveXmlCiiPositionToNode(index, { x: 430800.766, y: -1141125, z: 1184.15 }, { exactToleranceMm: 0.001, nearestToleranceMm: 5 });
assert.strictEqual(posResult.status, 'OK_EXACT');
assert.strictEqual(posResult.resolvedNodeNumber, '60');

const support = sourceJson[0].children.find((child) => child.attributes?.SUPPORT_TAG === 'PS-12248.5');
assert.ok(getConfiguredPsKeys(support.attributes, config.basisResolvers.PS).some((row) => row.value === 'PS-12248.5'));
assert.ok(getConfiguredPositions(support.attributes, config.basisResolvers.POS).some((row) => row.alias === 'POS'));
assert.strictEqual(classifyConfiguredRestraint(support.attributes, config.itemExtractors.RESTRAINT).kind, 'LINESTOP');

const { matchedFacts: jsonMatched, rejectedFacts: jsonRejected } = resolveConfiguredJsonFacts(sourceJson, index, config, { exactToleranceMm: 0.001, nearestToleranceMm: 5 });
assert.ok(jsonMatched.some((fact) => fact.itemType === 'RESTRAINT' && fact.value === 'LINESTOP' && fact.resolvedNodeNumber === '60'));
assert.ok(jsonMatched.some((fact) => fact.itemType === 'RESTRAINT' && fact.value === 'GUIDE' && fact.resolvedNodeNumber === '40'));
assert.ok(jsonMatched.some((fact) => fact.itemType === 'DTXR_PS' && fact.resolvedNodeNumber === '10'));
assert.ok(jsonRejected.length >= 1);

const manual = resolveManualRestraintRows(manualText, index, { exactToleranceMm: 0.001, nearestToleranceMm: 5 });
assert.ok(manual.matchedFacts.some((fact) => fact.source === 'MANUAL_SIDELOAD' && fact.value === 'GUIDE' && fact.resolvedNodeNumber === '70'));
assert.ok(manual.matchedFacts.some((fact) => fact.source === 'MANUAL_SIDELOAD' && fact.value === 'LINESTOP' && fact.resolvedNodeNumber === '60'));
assert.ok(manual.rejectedFacts.some((fact) => fact.status === 'ERROR_UNKNOWN_RESTRAINT'));
assert.ok(manual.rejectedFacts.some((fact) => fact.status === 'NOT_FOUND'));
assert.ok(manual.rejectedFacts.some((fact) => fact.status === 'AMBIGUOUS'));

const merged = mergeXmlCiiMatchedFacts(jsonMatched, manual.matchedFacts, { policy: 'ADD_IF_MISSING' });
assert.ok(merged.rejectedFacts.some((fact) => fact.status === 'DUPLICATE' && fact.value === 'GUIDE' && fact.resolvedNodeNumber === '40'));
assert.ok(merged.matchedFacts.some((fact) => fact.source === 'MANUAL_SIDELOAD' && fact.value === 'GUIDE' && fact.resolvedNodeNumber === '70'));
assert.ok(merged.matchedFacts.every((fact) => fact.status === 'MATCHED'));

console.log('✅ XML CII sideload benchmark tests passed', {
  xmlNodes: index.stats.nodeCount,
  jsonMatched: jsonMatched.length,
  jsonRejected: jsonRejected.length,
  manualMatched: manual.matchedFacts.length,
  manualRejected: manual.rejectedFacts.length,
  mergedMatched: merged.matchedFacts.length,
  mergedRejected: merged.rejectedFacts.length,
});
