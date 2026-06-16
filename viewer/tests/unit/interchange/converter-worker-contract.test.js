import assert from 'assert/strict';
import {
  buildConverterWorkerRequest,
  buildConverterWorkerResponse,
  validateConverterWorkerRequest,
  validateConverterWorkerResponse,
} from '../../../converters/worker-contract.js';
import { buildInvocation } from '../../../converters/invocation-builder.js';

const primaryBytes = new TextEncoder().encode('sample rev').buffer;
const request = buildConverterWorkerRequest(1, 'rev_to_stp', [
  { role: 'primary', name: 'sample.rev', bytes: primaryBytes },
], {
  coordFactor: 1000,
  supportPathContains: 'RRIMS-PIPESUPP',
  includeGenericSupportGroups: true,
  schemaName: 'CIS2',
});

assert.equal(validateConverterWorkerRequest(request).ok, true, 'Valid request should pass contract validation.');
assert.equal(
  validateConverterWorkerRequest({ type: 'run', converterId: 'rev_to_stp', inputFiles: [] }).ok,
  false,
  'Missing primary input should fail contract validation.',
);

const invocation = buildInvocation(
  'rev_to_stp',
  '/work/job/sample.rev',
  'sample.rev',
  null,
  request.options,
  '/work/job',
);

assert.equal(invocation.scriptPath, '/scripts/rev_to_stp.py');
assert.equal(invocation.outputName, 'sample_rev_to_stp.stp');
assert.ok(invocation.argv.includes('--coord-factor'));
assert.ok(
  invocation.argv.some((arg) => String(arg).startsWith('--support-path-contains=')),
  'support-path-contains should be emitted as --flag=value',
);
assert.ok(
  invocation.argv.some((arg) => String(arg).startsWith('--schema-name=')),
  'schema-name should be emitted as --flag=value',
);
assert.ok(invocation.argv.includes('--include-generic-support-groups'));

const pcfInvocation = buildInvocation(
  'rev_to_pcf',
  '/work/job/sample.rev',
  'sample.rev',
  null,
  {
    coordFactor: 1000,
    topologyMergeTolerance: 0.5,
    pipelineReference: 'P-100',
    projectIdentifier: 'PROJ-1',
    excludeGroupTokens: '-PIPESUPP,RRIMS-PIPESUPP',
  },
  '/work/job',
);
assert.equal(pcfInvocation.scriptPath, '/scripts/rev_to_pcf.py');
assert.ok(
  pcfInvocation.argv.includes('--exclude-group-tokens=-PIPESUPP,RRIMS-PIPESUPP'),
  'exclude-group-tokens should be emitted as --flag=value for dash-prefixed values',
);

const rvmInvocation = buildInvocation(
  'rvm_to_rev',
  '/work/job/sample.rvm',
  'sample.rvm',
  '/work/job/sample.att',
  {},
  '/work/job',
);
assert.equal(rvmInvocation.scriptPath, '/scripts/rvm_to_rev.py');
assert.equal(rvmInvocation.outputName, 'sample_rvm_to_rev.rev');
assert.ok(rvmInvocation.argv.includes('--attributes'));

const responseOk = buildConverterWorkerResponse(
  1,
  true,
  [{ name: 'out.stp', text: 'ISO-10303-21;', mime: 'text/plain' }],
  { stdout: ['ok'], stderr: [] },
  null,
);

assert.equal(validateConverterWorkerResponse(responseOk).ok, true, 'Valid success response should pass contract validation.');

const responseBad = { jobId: 1, ok: true, outputs: [{ name: 'bad', text: 10 }] };
assert.equal(validateConverterWorkerResponse(responseBad).ok, false, 'Output text must be string.');

console.log('✅ converter worker contract tests passed.');
