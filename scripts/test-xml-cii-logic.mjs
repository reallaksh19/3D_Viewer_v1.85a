import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('Running XML->CII Core Logic Unit Tests...');

  const coreDir = path.join(__dirname, '../viewer/converters/xml-cii2019-core');

  // 1. Regex Line Key Test
  const regexModule = await import(new URL(`file://${path.join(coreDir, 'regex-line-key.js').replace(/\\/g, '/')}`).href);
  const { tokenizeBranchName, deriveLineKeyFromBranchName } = regexModule;

  console.log('Testing regex-line-key...');
  const tokens1 = tokenizeBranchName('/ASIM-1885-10"-S8810101-91261M7-HC/B1');
  assert.deepStrictEqual(tokens1, ['ASIM', '1885', '10"', 'S8810101', '91261M7', 'HC']);

  const key1 = deriveLineKeyFromBranchName('/ASIM-1885-10"-S8810101-91261M7-HC/B1', {
    linelist: { lineKeyTokenPositions: [4], tokenDelimiter: '-', lineKeyJoiner: '' }
  });
  assert.strictEqual(key1, 'S8810101', 'Failed to derive line key for ASIM-1885-10"');

  const key2 = deriveLineKeyFromBranchName('/ASIM-1885-2"-D8810386-91261M7-PP/B1', {
    linelist: { lineKeyTokenPositions: [4], tokenDelimiter: '-', lineKeyJoiner: '' }
  });
  assert.strictEqual(key2, 'D8810386', 'Failed to derive line key for ASIM-1885-2"');

  // 2. Linelist Mapping Test
  const mappingModule = await import(new URL(`file://${path.join(coreDir, 'linelist-mapping.js').replace(/\\/g, '/')}`).href);
  const { detectLineListFieldMap } = mappingModule;

  console.log('Testing linelist-mapping...');
  const sampleHeaders = [
    'Service',
    'Line number',
    'Piping Class',
    'Construction Class',
    'Temp Max ºC',
    'Temp. ºC',
    'Temp Min ºC',
    'Test Pressure',
    'Design Pressure',
    'Insulation Thickness [mm]',
    'Insulation Type',
    'Mixed kg/m³',
    'Gas kg/m³',
    'Liquid kg/m³',
    'Fluid'
  ];
  // build some dummy rows to evaluate semantic mapping
  const dummyRows = [
    {
      'Mixed kg/m³': 'Density',
      'Gas kg/m³': 'Density',
      'Liquid kg/m³': 'Density'
    },
    Object.fromEntries(sampleHeaders.map(h => [h, '100']))
  ];

  const fieldMap = detectLineListFieldMap(dummyRows);
  console.log('Auto-detected field map:', fieldMap);

  // Assertions for positive mapping
  assert.strictEqual(fieldMap.pipingClass, 'Piping Class');
  assert.strictEqual(fieldMap.t1, 'Temp Max ºC');
  assert.strictEqual(fieldMap.t2, 'Temp. ºC');
  assert.strictEqual(fieldMap.t3, 'Temp Min ºC');
  assert.strictEqual(fieldMap.hydroPressure, 'Test Pressure');
  assert.strictEqual(fieldMap.insThk, 'Insulation Thickness [mm]');
  assert.strictEqual(fieldMap.densityMixed, 'Mixed kg/m³');
  assert.strictEqual(fieldMap.densityGas, 'Gas kg/m³');
  assert.strictEqual(fieldMap.densityLiquid, 'Liquid kg/m³');
  assert.strictEqual(fieldMap.phase, 'Fluid');

  // Negative assertions
  assert.notStrictEqual(fieldMap.pipingClass, 'Construction Class', 'Piping Class must not map to Construction Class');
  assert.notStrictEqual(fieldMap.p1, 'Test Pressure', 'P1 must not map to Test Pressure');
  assert.strictEqual(fieldMap.p1, 'Design Pressure', 'P1 should map to Design Pressure');
  assert.notStrictEqual(fieldMap.hydroPressure, 'Design Pressure', 'Hydro must not map to Design Pressure');
  assert.notStrictEqual(fieldMap.insThk, 'Insulation Type', 'InsThk must not map to Insulation Type');
  assert.notStrictEqual(fieldMap.densityMixed, 'Gas kg/m³', 'Mixed density must not map to Gas density');

  // 3. Element Length policy test
  const lengthModule = await import(new URL(`file://${path.join(coreDir, 'element-length.js').replace(/\\/g, '/')}`).href);
  const { computeElementLengthFromCiiVector } = lengthModule;

  console.log('Testing element-length...');
  const dx = 109.000, dy = -0.550, dz = 0.000;
  const len = computeElementLengthFromCiiVector(dx, dy, dz);
  assert(Math.abs(len - 109.001) < 0.01, `ElementLengthMm must be 109.001, got ${len}`);

  // 4. Config parsing test
  console.log('Testing config...');
  const configModule = await import(new URL(`file://${path.join(coreDir, 'config.js').replace(/\\/g, '/')}`).href);
  const { parseXmlCiiEnrichmentConfig } = configModule;
  const parsedCfg = parseXmlCiiEnrichmentConfig('{}');
  assert.strictEqual(parsedCfg.duplicateSupportPolicy, 'prefer_datum');
  assert.strictEqual(parsedCfg.supportKindToXmlType.REST, '+Y');
  assert.strictEqual(parsedCfg.disableCiiSupportTagPopulation, false, 'disableCiiSupportTagPopulation should default to false');

  const parsedCfgTrue = parseXmlCiiEnrichmentConfig(JSON.stringify({ disableCiiSupportTagPopulation: true }));
  assert.strictEqual(parsedCfgTrue.disableCiiSupportTagPopulation, true, 'disableCiiSupportTagPopulation should be true when set');

  const parsedCfgFalse = parseXmlCiiEnrichmentConfig(JSON.stringify({ disableCiiSupportTagPopulation: false }));
  assert.strictEqual(parsedCfgFalse.disableCiiSupportTagPopulation, false, 'disableCiiSupportTagPopulation should be false when set');

  // 5. DTXR resolver test
  console.log('Testing dtxr-resolver...');
  const dtxrModule = await import(new URL(`file://${path.join(coreDir, 'dtxr-resolver.js').replace(/\\/g, '/')}`).href);
  const { buildStagedDtxrPositionIndex } = dtxrModule;
  const dummyStagedJson = JSON.stringify([
    {
      type: 'ATTA',
      attributes: {
        NAME: 'PS-1234',
        POSI: '100.0 200.0 300.0',
        DTXR_POS: 'VALVE_DTXR_TEST'
      }
    }
  ]);
  const dummyConfig = parseXmlCiiEnrichmentConfig(JSON.stringify({
    dtxrPositionOffset: { enabled: false, tolerance: 0.5 }
  }));
  const stagedDtxrIdx = buildStagedDtxrPositionIndex(dummyStagedJson, dummyConfig);
  assert.strictEqual(stagedDtxrIdx.count, 1);
  assert.strictEqual(stagedDtxrIdx.entries[0].dtxr, 'VALVE_DTXR_TEST');

  // 6. Weight Match Model test
  console.log('Testing weight-match-model...');
  const weightModule = await import(new URL(`file://${path.join(coreDir, 'weight-match-model.js').replace(/\\/g, '/')}`).href);
  const { findAllWeightCandidates } = weightModule;
  const weightConfig = parseXmlCiiEnrichmentConfig(JSON.stringify({
    weight: {
      masterRows: [
        { boreMm: 100, lengthMm: 250, weight: 15, ratingClass: '150' },
        { boreMm: 100, lengthMm: 300, weight: 20, ratingClass: '150' }
      ],
      lengthToleranceMm: 5
    }
  }));
  const candidates = findAllWeightCandidates({ boreMm: 100, rating: '150', lengthMm: 248 }, weightConfig);
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].weight, 15);

  // 7. Support Mapping test
  console.log('Testing support-mapping...');
  const supportModule = await import(new URL(`file://${path.join(coreDir, 'support-mapping.js').replace(/\\/g, '/')}`).href);
  const { resolveXmlCiiSupportKind, xmlCiiTypeEntriesFromSupportKind } = supportModule;
  const kind = resolveXmlCiiSupportKind({ CMPSUPTYPE: 'PG-GUIDE' });
  assert.strictEqual(kind, 'GUIDE');
  const types = xmlCiiTypeEntriesFromSupportKind('GUIDE', dummyConfig);
  assert.deepStrictEqual(types, ['GUI']);

  // 8. Output Normalizer test (Integration test via golden baselines)
  console.log('Testing output-normalizer...');
  const normalizerModule = await import(new URL(`file://${path.join(coreDir, 'output-normalizer.js').replace(/\\/g, '/')}`).href);
  const { parseCiiElements, parseCiiRestraints, parseEnrichedXmlNodes } = normalizerModule;
  
  const expectedDir = path.join(__dirname, '../viewer/tabs/model-converters/tests/expected');
  const fs = await import('fs');
  const expectedCiiText = fs.readFileSync(path.join(expectedDir, 'xml-cii-basic.cii'), 'utf8');
  const expectedXmlText = fs.readFileSync(path.join(expectedDir, 'xml-cii-basic_enriched.xml'), 'utf8');

  const parsedElements = parseCiiElements(expectedCiiText);
  const parsedRestraints = parseCiiRestraints(expectedCiiText);
  const parsedNodes = parseEnrichedXmlNodes(expectedXmlText);

  assert(parsedElements.length > 0, 'Parsed elements array should not be empty');
  assert(parsedRestraints.length > 0, 'Parsed restraints array should not be empty');
  assert(parsedNodes.length > 0, 'Parsed XML nodes array should not be empty');

  // Verify specific data points in golden baseline
  const restraintPlusY = parsedRestraints.find(r => r.type === 14);
  assert(restraintPlusY, 'Should find at least one +Y restraint (code 14)');

  // 9. Scored Piping Class and Unified Resolvers tests
  console.log('Testing scored piping class and unified resolvers...');
  const pcResolverModule = await import(new URL(`file://${path.join(coreDir, 'piping-class-resolver.js').replace(/\\/g, '/')}`).href);
  const { buildPipingClassIndex, findBestPipingClassRow } = pcResolverModule;

  const branchProcessModule = await import(new URL(`file://${path.join(coreDir, 'branch-process-resolver.js').replace(/\\/g, '/')}`).href);
  const { resolveBranchProcessData } = branchProcessModule;

  // Mock piping class master rows
  const pcRows = [
    { pipingClass: 'CLASS-A', convertedBore: 100, componentType: 'PIPE', wallThickness: 6.0, corrosion: 1.5, materialName: 'CS-A', rating: '150' },
    { pipingClass: 'CLASS-A', convertedBore: 100, componentType: 'VALVE', wallThickness: 8.0, corrosion: 2.0, materialName: 'CS-A', rating: '150' },
    { pipingClass: 'CLASS-A', convertedBore: 50, componentType: 'PIPE', wallThickness: 4.0, corrosion: 1.0, materialName: 'CS-B', rating: '300' }
  ];
  const pcIndex = buildPipingClassIndex(pcRows);

  // Score exact component match
  const bestVal = findBestPipingClassRow({
    pipingClass: 'CLASS-A',
    boreMm: 100,
    componentType: 'VALVE',
    rating: '150',
    pipingClassIndex: pcIndex
  });
  assert.strictEqual(bestVal.row.componentType, 'VALVE');
  assert.strictEqual(bestVal.needsReview, false);

  // Missing bore triggers review
  const missingBoreVal = findBestPipingClassRow({
    pipingClass: 'CLASS-A',
    boreMm: null,
    componentType: 'PIPE',
    rating: '150',
    pipingClassIndex: pcIndex
  });
  assert.strictEqual(missingBoreVal.needsReview, true);

  // Resolve Material / Corrosion Priorities
  const materialMap = [
    { code: 'M100', material: 'CS-A' },
    { code: 'M200', material: 'CS-B' },
    { code: 'M300', material: 'LINE-MAT' }
  ];

  // Case A: lineRow material wins
  const lineRowA = { pipingClass: 'CLASS-A', rating: '150', material: 'LINE-MAT' };
  const resA = resolveBranchProcessData({
    branchName: 'TEST-BRANCH',
    lineKey: 'LK-01',
    lineRow: lineRowA,
    boreMm: 100,
    componentType: 'PIPE',
    rating: '150',
    materialMap,
    pipingClassIndex: pcIndex
  });
  assert.strictEqual(resA.materialCode, 'M300'); // line-list material 'LINE-MAT' maps to M300
  assert.strictEqual(resA.corrosionAllowanceMm, 1.5); // matches CLASS-A 100mm PIPE corrosion

  // Case B: class material fallback
  const lineRowB = { pipingClass: 'CLASS-A', rating: '150', material: '' };
  const resB = resolveBranchProcessData({
    branchName: 'TEST-BRANCH',
    lineKey: 'LK-02',
    lineRow: lineRowB,
    boreMm: 50,
    componentType: 'PIPE',
    rating: '300',
    materialMap,
    pipingClassIndex: pcIndex
  });
  assert.strictEqual(resB.materialCode, 'M200'); // CS-B mapped code

  // Case C: Corrosion fallback to XML
  const lineRowC = { pipingClass: 'CLASS-UNKNOWN', rating: '150' };
  const xmlNodeC = { corrosionAllowance: 3.5 };
  const resC = resolveBranchProcessData({
    branchName: 'TEST-BRANCH',
    lineKey: 'LK-03',
    lineRow: lineRowC,
    boreMm: 100,
    componentType: 'PIPE',
    rating: '150',
    materialMap,
    pipingClassIndex: pcIndex,
    xmlNode: xmlNodeC
  });
  assert.strictEqual(resC.corrosionAllowanceMm, 3.5);

  // 10. DTXR normalization and coordination matching tests
  console.log('Testing DTXR normalization and coordinate matching...');
  const { buildStagedDtxrIndex, resolveXmlCiiNodeDtxr } = dtxrModule;
  
  // Normalization: / is replaced with +
  const stagedDtxrJson = JSON.stringify([
    {
      type: 'ATTA',
      attributes: {
        ComponentRefNo: '=REF123',
        POSI: '10.0 20.0 30.0',
        DTXR_POS: 'VALVE / A / B'
      }
    }
  ]);
  const stagedDtxrIdx2 = buildStagedDtxrIndex(stagedDtxrJson, {});
  const resolvedDtxr = resolveXmlCiiNodeDtxr(
    { ComponentRefNo: 'REF123', Position: '10.0 20.0 30.0' },
    stagedDtxrIdx2,
    {}
  );
  assert.strictEqual(resolvedDtxr.value, 'VALVE + A + B');
  assert.strictEqual(resolvedDtxr.source, 'staged-component-refno');

  console.log('✅ All XML->CII Core Logic Unit Tests passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ XML->CII Core Logic Unit Tests failed:', err);
  process.exit(1);
});
