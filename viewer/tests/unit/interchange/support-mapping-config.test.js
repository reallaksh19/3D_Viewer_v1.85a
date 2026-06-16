import {
  cloneDefaultSupportMappingConfig,
  normalizeSupportMappingConfig,
  validateSupportMappingConfig,
} from '../../../interchange/support/support-mapping-config.js';

function runTests() {
  let passed = true;

  const defaults = cloneDefaultSupportMappingConfig();
  const validation = validateSupportMappingConfig(defaults);
  if (!validation.ok) {
    console.error('Test 1 Failed: default support mapping config must validate.');
    passed = false;
  }

  const custom = cloneDefaultSupportMappingConfig();
  custom.formats.REV.rules.push({
    id: 'rev-pipesupp',
    enabled: true,
    priority: 200,
    match: { pathContains: 'PIPESUPP', typeIn: ['SUPPORT'] },
    output: { supportKindTemplate: '{{raw.groupPath || "SUPPORT"}}' },
    anchorPolicy: 'nearest-node',
  });

  const normalized = normalizeSupportMappingConfig(custom);
  if (!normalized.validation.ok) {
    console.error('Test 2 Failed: normalized custom config should validate.');
    passed = false;
  }

  const broken = cloneDefaultSupportMappingConfig();
  broken.formats.XML.tolerances.anchorMm = 0;
  const brokenValidation = validateSupportMappingConfig(broken);
  if (brokenValidation.ok) {
    console.error('Test 3 Failed: invalid tolerance should fail validation.');
    passed = false;
  }

  if (passed) console.log('\u2705 Support mapping config tests passed.');
  else process.exit(1);
}

runTests();
