import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRepoFile(relativePath) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readRepoFile(relativePath));
}

function assertFile(relativePath) {
  assert(existsSync(path.resolve(process.cwd(), relativePath)), `${relativePath} must exist.`);
}

function assertAny(fileText, needles, message) {
  assert(needles.some((needle) => fileText.includes(needle)), message || `Expected one of: ${needles.join(', ')}`);
}

const files = {
  runner: 'viewer/tabs/model-converters/converters/xmltocii2019_runner.js',
  previewUi: 'viewer/tabs/model-converters/xml-cii-matched-preview-ui.js',
  sideloadUi: 'viewer/tabs/model-converters/xml-cii-sideload-ui.js',
  jsonConfigUi: 'viewer/tabs/model-converters/xml-cii-sideload-json-config-tools.js',
  jsonConfigCore: 'viewer/converters/xml-cii2019-core/sideload-json-config.js',
  resolverCore: 'viewer/converters/xml-cii2019-core/sideload-resolver.js',
  ledgerCore: 'viewer/converters/xml-cii2019-core/sideload-ledger.js',
  restraintsCore: 'viewer/converters/xml-cii2019-core/sideload-restraints.js',
  applyCore: 'viewer/converters/xml-cii2019-core/sideload-apply.js',
  benchmarkXml: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.input.xml',
  benchmarkSourceJson: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.source-like.json',
  benchmarkJsonConfig: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.json-config.json',
  benchmarkSideload: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.sideload-restraints.txt',
};

for (const relativePath of Object.values(files)) assertFile(relativePath);

const runner = readRepoFile(files.runner);
const previewUi = readRepoFile(files.previewUi);
const sideloadUi = readRepoFile(files.sideloadUi);
const jsonConfigUi = readRepoFile(files.jsonConfigUi);
const jsonConfigCore = readRepoFile(files.jsonConfigCore);
const resolverCore = readRepoFile(files.resolverCore);
const ledgerCore = readRepoFile(files.ledgerCore);
const restraintsCore = readRepoFile(files.restraintsCore);
const applyCore = readRepoFile(files.applyCore);

const eventName = 'xml-cii-matched-preview:diagnostics';
const storageKey = 'xmlCii2019.matchedPreview.lastDiagnostics.v1';

assert(runner.includes(eventName), 'Runner must publish the Matched Preview diagnostics event.');
assert(previewUi.includes(eventName), 'Matched Preview UI must listen to the same diagnostics event.');
assert(runner.includes(storageKey), 'Runner must write the latest-run diagnostics storage key.');
assert(previewUi.includes(storageKey), 'Matched Preview UI must read the latest-run diagnostics storage key.');
assert(runner.includes('matchedFacts') && runner.includes('rejectedFacts'), 'Runner diagnostics payload must include matched/rejected fact arrays.');
assert(previewUi.includes('MATCHED') && previewUi.includes('Rejected hidden'), 'Matched Preview must remain matched-only and hide rejected rows.');

for (const label of ['Resolver Index', 'JSON Config', 'JSON Resolved Data', 'PS → Node', 'POS → Node', 'Restraints', 'Diagnostics']) {
  assert(sideloadUi.includes(label), `Sideload UI must expose ${label} sub-tab.`);
}

for (const label of ['Import Config', 'Export Config', 'Save Advanced Fields']) {
  assert(jsonConfigUi.includes(label), `JSON Config tools must expose ${label}.`);
}

for (const itemType of ['RESTRAINT', 'DTXR_PS', 'DTXR_POS', 'WEIGHT', 'RATING', 'RESTRAINT_META']) {
  assert(jsonConfigCore.includes(itemType), `Default JSON Config must include ${itemType}.`);
}
for (const alias of ['SUPPORT_TAG', 'CMPSTRESSN', 'CMPSUPREFN', 'POS', 'APOS', 'LPOS', 'POSI', 'ABOP', 'LBOP']) {
  assert(jsonConfigCore.includes(alias), `Default JSON Config must include alias ${alias}.`);
}

for (const exportName of ['buildXmlCiiNodeResolverIndex', 'resolveXmlCiiPsToNode', 'resolveXmlCiiPositionToNode', 'normalizePsKey', 'parseXmlCiiPosition']) {
  assert(resolverCore.includes(exportName), `Resolver core must expose ${exportName}.`);
}
for (const exportName of ['makeXmlCiiMatchedFact', 'makeXmlCiiRejectedFact', 'mergeXmlCiiMatchedFacts', 'matchedFactsFromEnrichmentDiagnostics']) {
  assert(ledgerCore.includes(exportName), `Ledger core must expose ${exportName}.`);
}
for (const exportName of ['parseXmlCiiManualRestraintRows', 'resolveManualRestraintRows', 'normalizeXmlCiiManualRestraint']) {
  assert(restraintsCore.includes(exportName), `Manual restraints core must expose ${exportName}.`);
}

assert(applyCore.includes('MANUAL_SIDELOAD'), 'Manual apply must tag/use MANUAL_SIDELOAD.');
assert(applyCore.includes('RESTRAINT'), 'Manual apply must limit itself to restraint facts.');
assert(applyCore.includes('MATCHED'), 'Manual apply must use matched facts only.');
assertAny(applyCore, ['setAttribute', 'appendText'], 'Manual apply must write restraint XML fields.');

const benchmarkSource = readJson(files.benchmarkSourceJson);
const benchmarkConfig = readJson(files.benchmarkJsonConfig);
const sideloadText = readRepoFile(files.benchmarkSideload);
const benchmarkXml = readRepoFile(files.benchmarkXml);
const sourceChildren = benchmarkSource.reduce((sum, branch) => sum + (Array.isArray(branch.children) ? branch.children.length : 0), 0);

assert(Array.isArray(benchmarkSource) && benchmarkSource.length === 3, 'Source-like benchmark JSON must contain 3 branches.');
assert(sourceChildren >= 14, 'Source-like benchmark must contain the representative 14+ staged JSON child items.');
assert(benchmarkConfig?.basisResolvers?.PS?.fieldAliases?.includes('SUPPORT_TAG'), 'Benchmark JSON Config must map PS from SUPPORT_TAG.');
assert(benchmarkConfig?.basisResolvers?.POS?.objectFieldAliases?.includes('POS'), 'Benchmark JSON Config must map POS object fields.');
assert(benchmarkConfig?.basisResolvers?.POS?.textFieldAliases?.includes('POSI'), 'Benchmark JSON Config must map POSI text coordinates.');
assert(benchmarkConfig?.itemExtractors?.RESTRAINT?.sourceFieldAliases?.includes('SUPPORT_KIND'), 'Benchmark JSON Config must map restraint kind aliases.');
assert(sideloadText.includes('Node|PSNo.|POS|Restraint'), 'Sideload benchmark must include tabular header.');
assert(sideloadText.includes('PS-Z-999'), 'Sideload benchmark must include unresolved PS diagnostic row.');
assert(sideloadText.includes('FooBar'), 'Sideload benchmark must include invalid restraint diagnostic row.');
assert(benchmarkXml.includes('<NodeNumber>60</NodeNumber>'), 'Benchmark XML must include Node 60 for ANCI/component regression.');
assert(benchmarkXml.includes('<ComponentType>ANCI</ComponentType>'), 'Benchmark XML must include ANCI component regression case.');

console.log('✅ XML CII sideload, diagnostics, and Matched Preview static chain passed', {
  branches: benchmarkSource.length,
  stagedChildren: sourceChildren,
  workflowEvent: eventName,
});
