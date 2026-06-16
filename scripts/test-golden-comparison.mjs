import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parses a CII elements block into an array of numeric arrays
function parseCiiElements(text) {
  const lines = text.split('\n').map(l => l.trimEnd());
  const elementsIdx = lines.findIndex(l => l.includes('CII-ELEMENTS-PAYLOAD') || l.includes('ELEMENTS'));
  if (elementsIdx === -1) return [];

  // Parse lines following the header
  const elementBlocks = [];
  let currentBlock = [];
  
  // Elements are in blocks of 14 lines or until end of section
  for (let i = elementsIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[A-Z_]+$/.test(line) && line !== 'ELEMENTS') {
      // Reached next section
      break;
    }
    if (line === '') continue;
    currentBlock.push(line);
    if (currentBlock.length === 14) {
      elementBlocks.push(currentBlock);
      currentBlock = [];
    }
  }
  
  return elementBlocks.map(block => {
    // Parse all numbers from the 14 lines
    const numbers = [];
    block.forEach((line, idx) => {
      // Line 11 is element line label (non-numeric)
      if (idx === 10) return;
      const matches = line.match(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/gi) || [];
      numbers.push(...matches.map(Number));
    });
    return numbers;
  });
}

function parseCiiRestraints(text) {
  const lines = text.split('\n').map(l => l.trimEnd());
  const idx = lines.findIndex(l => l.includes('RESTRANT'));
  if (idx === -1) return [];

  const restraints = [];
  // Restraints are written in blocks of 4 lines:
  // Line 1: node, type, stiffness, gap, friction, cnode
  // Line 2: direction cosines (cx, cy, cz)
  // Line 3 & 4: tag and description/zeros
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[A-Z_]+$/.test(line) && line !== 'RESTRANT') break;
    if (line === '') continue;
    
    const parts1 = lines[i].match(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/gi) || [];
    const parts2 = lines[i+1]?.match(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/gi) || [];
    
    if (parts1.length >= 5) {
      restraints.push({
        node: Number(parts1[0]),
        type: Number(parts1[1]),
        stiffness: Number(parts1[2]),
        gap: Number(parts1[3]),
        friction: Number(parts1[4]),
        cx: parts2[0] ? Number(parts2[0]) : 0,
        cy: parts2[1] ? Number(parts2[1]) : 0,
        cz: parts2[2] ? Number(parts2[2]) : 0
      });
    }
    i += 3; // skip to next block
  }
  return restraints;
}

function parseEnrichedXmlNodes(xmlText) {
  const nodes = [];
  const matches = xmlText.matchAll(/<Node>([\s\S]*?)<\/Node>/g);
  for (const m of matches) {
    const nt = m[1];
    const nodeNumber = nt.match(/<NodeNumber>(.*?)<\/NodeNumber>/)?.[1];
    const type = nt.match(/<ComponentType>(.*?)<\/ComponentType>/)?.[1];
    const elLen = nt.match(/<ElementLengthMm>(.*?)<\/ElementLengthMm>/)?.[1];
    const pos = nt.match(/<Position>(.*?)<\/Position>/)?.[1];
    if (nodeNumber) {
      nodes.push({
        nodeNumber: Number(nodeNumber.trim()),
        componentType: type ? type.trim() : '',
        elementLengthMm: elLen ? Number(elLen.trim()) : null,
        position: pos ? pos.trim() : ''
      });
    }
  }
  return nodes;
}

async function runTest() {
  console.log('Running Model Converters golden output comparisons...');

  const expectedDir = path.join(__dirname, '../viewer/tabs/model-converters/tests/expected');
  const fixturesDir = path.join(__dirname, '../viewer/tabs/model-converters/tests/fixtures');
  
  // Read expected outputs (Phase 0 snapshots)
  const expectedCiiText = fs.readFileSync(path.join(expectedDir, 'xml-cii-basic.cii'), 'utf8');
  const expectedXmlText = fs.readFileSync(path.join(expectedDir, 'xml-cii-basic_enriched.xml'), 'utf8');

  const expectedElements = parseCiiElements(expectedCiiText);
  const expectedRestraints = parseCiiRestraints(expectedCiiText);
  const expectedNodes = parseEnrichedXmlNodes(expectedXmlText);

  console.log(`Parsed expected expected elements: ${expectedElements.length}`);
  console.log(`Parsed expected expected restraints: ${expectedRestraints.length}`);
  console.log(`Parsed expected expected XML nodes: ${expectedNodes.length}`);

  // Perform basic validations on the baseline
  assert(expectedElements.length > 0, 'Should have element blocks');
  
  // Assertions mapping verification
  // CII element item checks for element 0:
  // Item 10 = T1, Item 11 = T2, Item 12 = T3
  // Item 31 = insulation density, Item 32 = fluid density
  // Item 36 = hydro pressure
  const firstElem = expectedElements[0];
  console.log('Sample Element 0 values:', {
    T1: firstElem[9],
    T2: firstElem[10],
    T3: firstElem[11],
    insDensity: firstElem[30],
    fluidDensity: firstElem[31],
    hydro: firstElem[35]
  });

  // Verify node-wise restraints mapping
  const restraintPlusY = expectedRestraints.find(r => r.type === 14);
  assert(restraintPlusY, 'Should find at least one +Y restraint (code 14)');

  // Run the actual python converter to generate output
  const inputXml = path.join(fixturesDir, 'xml-cii-basic.xml');
  const stagedJson = path.join(fixturesDir, 'staged.json');
  const tempOutputCii = path.join(__dirname, '../temp_output.cii');
  const pythonScript = path.join(__dirname, '../viewer/converters/scripts/xml_to_cii2019_patched.py');

  console.log('Executing Python conversion...');
  execSync(`python "${pythonScript}" --input "${inputXml}" --output "${tempOutputCii}" --staged-json "${stagedJson}" --split-condensed-valve-flange`);

  const generatedCiiText = fs.readFileSync(tempOutputCii, 'utf8');
  assert.strictEqual(generatedCiiText, expectedCiiText, 'Generated CII file should match the golden expected baseline');
  console.log('✅ Generated CII file matches golden baseline exactly!');

  const tempXml = path.join(os.tmpdir(), 'xml-cii-basic_dtxr_enriched_final_enriched.xml');
  const generatedXmlText = fs.readFileSync(tempXml, 'utf8');
  assert.strictEqual(generatedXmlText, expectedXmlText, 'Generated enriched XML file should match the golden expected baseline');
  console.log('✅ Generated enriched XML matches golden baseline exactly!');

  // Clean up
  try {
    fs.unlinkSync(tempOutputCii);
  } catch (e) {}
  try {
    fs.unlinkSync(tempXml);
  } catch (e) {}

  console.log('✅ Golden comparison setup verified!');
}

runTest().catch((err) => {
  console.error('❌ Golden comparison test failed:', err);
  process.exit(1);
});
