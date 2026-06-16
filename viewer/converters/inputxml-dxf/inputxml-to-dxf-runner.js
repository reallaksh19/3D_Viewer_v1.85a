import { extractInputXmlBranches } from './InputXmlBranchExtractor.js';
import { projectToDxfGeometry } from './InputXmlToDxfProjector.js';
import { writeInputXmlDxf } from './InputXmlToDxfWriter.js';

function primaryFile(inputFiles = []) {
  return inputFiles.find((file) => file.role === 'primary') || inputFiles[0] || null;
}

async function readText(file) {
  if (!file) throw new Error('Missing primary Input XML file.');
  if (typeof file.text === 'string') return file.text;
  if (file.bytes instanceof Uint8Array) return new TextDecoder().decode(file.bytes);
  if (file.bytes instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(file.bytes));
  if (file.file && typeof file.file.text === 'function') return file.file.text();
  throw new Error('Unable to read primary Input XML file.');
}

function stem(name = 'inputxml') {
  return String(name || 'inputxml').replace(/\.[^.]+$/, '') || 'inputxml';
}

function branchLogLine(branch) {
  const aliases = Array.isArray(branch.aliases) && branch.aliases.length ? ` aliases=${branch.aliases.join('|')}` : '';
  return `  - ${branch.id} (${branch.label || branch.id}) components=${branch.componentCount || 0}${aliases}`;
}

function pushBranchDiscoveryLogs(stdout, branches, selectedBranchIds) {
  stdout.push(`Available branches (${branches.length}):`);
  if (!branches.length) {
    stdout.push('  - none detected');
  } else {
    for (const branch of branches) stdout.push(branchLogLine(branch));
  }

  if (selectedBranchIds.length) {
    stdout.push(`Selected branch ids: ${selectedBranchIds.join(', ')}`);
  } else {
    stdout.push('Selected branch ids: <all branches; selectedBranches option is empty>');
  }
}

export async function run(ctx = {}) {
  const inputFiles = ctx.inputFiles || [];
  const options = ctx.options || {};
  const setStatus = typeof ctx.setStatus === 'function' ? ctx.setStatus : () => {};
  const stdout = [];
  const stderr = [];

  try {
    const primary = primaryFile(inputFiles);
    setStatus('Reading Input XML…');
    const xmlText = await readText(primary);

    setStatus('Parsing Input XML branches…');
    const extraction = extractInputXmlBranches(xmlText, {
      fileName: primary?.name || '',
      sourceId: 'inputxml-dxf',
    });

    if (!extraction.ok) {
      stderr.push('InputXML→DXF failed: unable to map Input XML into UXML geometry.');
      return { ok: false, outputs: [], logs: { stdout, stderr }, diagnostics: extraction.diagnostics };
    }

    setStatus('Projecting selected branches…');
    const geometry = projectToDxfGeometry(extraction.doc, {
      ...options,
      selectedBranches: options.selectedBranches || '',
    });

    setStatus('Writing DXF…');
    const diagnostics = [...(extraction.diagnostics || []), ...(geometry.diagnostics || [])];
    const writerOptions = {
      ...options,
      showSegmentLabels: options.showSegmentLabels === true || options.exportLengthText === true,
      sourceName: primary?.name || '',
      selectedBranchIds: geometry.selectedBranchIds,
    };
    const { dxf, sidecar } = writeInputXmlDxf({
      segments: geometry.segments,
      supports: geometry.supports,
      branches: extraction.branches,
      diagnostics,
    }, writerOptions);

    const base = stem(primary?.name);
    const outputs = [{ name: `${base}.dxf`, text: dxf, mime: 'application/dxf;charset=utf-8' }];
    if (options.includeSidecarJson !== false) {
      outputs.push({
        name: `${base}-sidecar.json`,
        text: JSON.stringify(sidecar, null, 2),
        mime: 'application/json;charset=utf-8',
      });
    }

    pushBranchDiscoveryLogs(stdout, extraction.branches, geometry.selectedBranchIds || []);
    stdout.push(`Output mode: ${sidecar.outputMode}`);
    stdout.push(`Projection mode: ${sidecar.projectionMode}`);
    stdout.push(`Pipe body mode: ${sidecar.pipeBodyMode}`);
    stdout.push(`Pipe bodies: ${sidecar.pipeBodyCount}`);
    stdout.push(`Support types: ${JSON.stringify(sidecar.supportTypeCounts || {})}`);
    if (options.exportLengthText === true) stdout.push('Length text: enabled');
    if (sidecar.drawing?.sheet) {
      stdout.push(`Drawing sheet: ${sidecar.drawing.sheet.width} x ${sidecar.drawing.sheet.height}, fitScale=${sidecar.drawing.fitScale}`);
    }
    stdout.push(`${geometry.segments.length} line segments, ${geometry.supports.length} support points, ${extraction.branches.length} branches total.`);
    return { ok: true, outputs, logs: { stdout, stderr }, diagnostics };
  } catch (error) {
    stderr.push(`InputXML→DXF failed: ${error?.message || error}`);
    return {
      ok: false,
      outputs: [],
      logs: { stdout, stderr },
      diagnostics: [{ type: 'inputxml-dxf-runner-error', severity: 'ERROR', message: String(error?.message || error) }],
    };
  }
}
