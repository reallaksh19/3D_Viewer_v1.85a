import assert from 'assert/strict';
import {
  resolveKindPure,
  resolveKindFromText,
  resolveKindFromDirection,
  resolveKindDescriptor,
  DEFAULT_RULES,
  DEFAULT_KIND_MAP,
  splitRuleTerms,
  normalizeMapperFieldName,
  collectMapperFieldValues,
  SUPPORT_KINDS,
  MATCH_TYPES,
} from '../../../support/SupportKindResolver.js';

function run() {
  console.log('--- support-kind-resolver.test.js ---');

  // ── resolveKindFromText ──────────────────────────────────────────────────────
  assert.equal(resolveKindFromText('CA150'),         '',          'CA150 is not a keyword — text heuristic returns empty');
  assert.equal(resolveKindFromText('CA100'),         '',          'CA100 is not a keyword — text heuristic returns empty');
  assert.equal(resolveKindFromText('GUIDE SUPPORT'), 'GUIDE',     'GUIDE keyword');
  assert.equal(resolveKindFromText('GDE-100'),       'GUIDE',     'GDE alias');
  assert.equal(resolveKindFromText('SLIDE SUPP'),    'GUIDE',     'SLIDE alias');
  assert.equal(resolveKindFromText('LINESTOP'),      'LINESTOP',  'LINESTOP keyword');
  assert.equal(resolveKindFromText('LINE STOP'),     'LINESTOP',  'LINE STOP with space');
  assert.equal(resolveKindFromText('STOPPER'),       'LINESTOP',  'STOPPER alias');
  assert.equal(resolveKindFromText('STOP BLOCK'),    'LINESTOP',  'generic STOP keyword');
  assert.equal(resolveKindFromText('LIMIT STOP'),    'LIMIT',     'LIMIT STOP → LIMIT (LIMIT_STOP rule fires before generic STOP)');
  assert.equal(resolveKindFromText('LIMIT'),         'LIMIT',     'LIMIT keyword');
  assert.equal(resolveKindFromText('RESTING PAD'),   'REST',      'RESTING alias');
  assert.equal(resolveKindFromText('RST SHOE'),      'REST',      'RST alias');
  assert.equal(resolveKindFromText('+Y SUPPORT'),    'REST',      '+Y axis means REST');
  assert.equal(resolveKindFromText('BASE PLATE'),    'REST',      'BASE PLATE alias');
  assert.equal(resolveKindFromText('ANCHOR PLT'),    'ANCHOR',    'ANCHOR keyword');
  assert.equal(resolveKindFromText('FIXED PT'),      'ANCHOR',    'FIXED keyword');
  assert.equal(resolveKindFromText('SPRING HGR'),    'SPRING',    'SPRING keyword');
  assert.equal(resolveKindFromText('HANGER'),        'SPRING',    'HANGER alias');
  // ANCHOR beats REST when both could match
  assert.equal(resolveKindFromText('ANCHOR REST'),   'ANCHOR',    'ANCHOR wins over REST when both present');
  assert.equal(resolveKindFromText('LATERAL SUPP'),  'GUIDE',     'LATERAL alias → GUIDE');
  assert.equal(resolveKindFromText('LATERAL STOP'),  'GUIDE',     'LATERAL beats STOP');
  assert.equal(resolveKindFromText('ANCI'),          'REST',      'ANCI alias → REST');
  assert.equal(resolveKindFromText('WEAR PAD'),      'REST',      'WEAR PAD alias → REST');
  assert.equal(resolveKindFromText('BEARING PLATE'), 'REST',      'BEARING PLATE alias → REST');
  assert.equal(resolveKindFromText(''),              '',          'empty → empty');
  assert.equal(resolveKindFromText(null),            '',          'null → empty');

  // ── resolveKindFromDirection ─────────────────────────────────────────────────
  assert.equal(resolveKindFromDirection('UP'),        'REST',  'UP → REST');
  assert.equal(resolveKindFromDirection('DOWN'),      'REST',  'DOWN → REST');
  assert.equal(resolveKindFromDirection('NORTH'),     '',      'NORTH without pipe axis is unresolved');
  assert.equal(resolveKindFromDirection('EAST', { pipeAxis: { x: 1, y: 0, z: 0 } }), 'LINESTOP', 'EAST parallel to pipe axis -> LINESTOP');
  assert.equal(resolveKindFromDirection('NORTH', { pipeAxis: { x: 1, y: 0, z: 0 } }), 'GUIDE', 'NORTH perpendicular to pipe axis -> GUIDE');
  assert.equal(resolveKindFromDirection('WEST', { pipeAxis: '1,0,0' }), 'LINESTOP', 'WEST antiparallel to pipe axis -> LINESTOP');
  assert.equal(resolveKindFromDirection('NE', { pipeAxis: { x: 0, y: 0, z: -1 } }), '', 'diagonal direction at 45 degrees remains unresolved');
  assert.equal(resolveKindFromDirection(''),          '',      'empty → empty');
  assert.equal(resolveKindFromDirection('DIAGONAL'),  '',      'unknown direction → empty');

  // resolveKindPure tier 6: cardinal direction requires pipe axis.
  assert.equal(
    resolveKindPure({ 'SUPPORT-DIRECTION': 'UP' }, { userRules: [], kindMap: {}, defaultRules: [] }),
    'REST',
    'SUPPORT-DIRECTION UP resolves to REST'
  );
  assert.equal(
    resolveKindPure({ 'SUPPORT-DIRECTION': 'NORTH' }, { userRules: [], kindMap: {}, defaultRules: [] }),
    '',
    'SUPPORT-DIRECTION NORTH without pipe axis remains unresolved'
  );
  assert.equal(
    resolveKindPure({ 'SUPPORT-DIRECTION': 'EAST', PIPE_AXIS_COSINES: '1,0,0' }, { userRules: [], kindMap: {}, defaultRules: [] }),
    'LINESTOP',
    'SUPPORT-DIRECTION EAST parallel to pipe axis resolves to LINESTOP'
  );
  assert.equal(
    resolveKindPure({ 'SUPPORT-DIRECTION': 'NORTH', PIPE_AXIS_COSINES: '1,0,0' }, { userRules: [], kindMap: {}, defaultRules: [] }),
    'GUIDE',
    'SUPPORT-DIRECTION NORTH perpendicular to pipe axis resolves to GUIDE'
  );

  // ── CA catalog codes via SKEY rules ─────────────────────────────────────────
  assert.equal(resolveKindPure({ SKEY: 'CA150' }),  'REST',   'CA150 → REST via default rule');
  assert.equal(resolveKindPure({ SKEY: 'CA250' }),  'REST',   'CA250 → REST via default rule');
  assert.equal(resolveKindPure({ SKEY: 'CA100' }),  'GUIDE',  'CA100 → GUIDE via default rule');

  // ── CMPSUPTYPE / MDSSUPPTYPE prefix rules ────────────────────────────────────
  assert.equal(resolveKindPure({ CMPSUPTYPE: 'GT573' }), 'REST',     'GT5* → REST (beats generic GT* GUIDE)');
  assert.equal(resolveKindPure({ MDSSUPPTYPE: 'GT573' }),'REST',     'MDSSUPPTYPE GT5* → REST');
  assert.equal(resolveKindPure({ MDSSUPPTYPE: 'GT3' }),  'GUIDE',    'GT3* → GUIDE (GT prefix, not GT5)');
  assert.equal(resolveKindPure({ CMPSUPTYPE: 'LS-12' }), 'LINESTOP', 'LS-* → LINESTOP');
  assert.equal(resolveKindPure({ CMPSUPTYPE: 'WP-3' }),  'REST',     'WP-* → REST');
  assert.equal(resolveKindPure({ CMPSUPTYPE: 'PG-5' }),  'GUIDE',    'PG-* → GUIDE');
  assert.equal(resolveKindPure({ CMPSUPTYPE: 'BP-2' }),  'REST',     'BP-* → REST');
  assert.equal(resolveKindPure({ MDSSUPPTYPE: 'AN-01' }), 'ANCHOR',  'AN* → ANCHOR');
  assert.equal(resolveKindPure({ MDSSUPPTYPE: 'BT-10' }), 'REST',    'BT* → REST');
  assert.equal(resolveKindPure({ MDSSUPPTYPE: 'PIPE-REST' }), 'REST', 'PIPE-REST → REST');
  assert.equal(
    resolveKindPure({
      CMPSUPTYPE: 'PG-B1-4',
      MDSSUPPTYPE: 'GT574',
      DTXR: 'PIPE GUIDE FOR BARE PIPE CS',
    }),
    'GUIDE',
    'CMPSUPTYPE PG-* guide intent wins over MDSSUPPTYPE GT5* subtype'
  );

  // ── Tier 1: explicit attribute wins over everything ───────────────────────────
  assert.equal(
    resolveKindPure({ 'SUPPORT-KIND': 'ANCHOR', SKEY: 'CA100' }),
    'ANCHOR',
    'explicit SUPPORT-KIND wins over SKEY rule'
  );
  assert.equal(
    resolveKindPure({ SUPPORT_KIND: 'SPRING', CMPSUPTYPE: 'GT573' }),
    'SPRING',
    'explicit SUPPORT_KIND wins over default rule'
  );
  assert.equal(
    resolveKindPure({ SUPPORT_MAPPER_KIND: 'LINESTOP', SKEY: 'CA150' }),
    'LINESTOP',
    'SUPPORT_MAPPER_KIND explicit attribute wins'
  );

  // ── Tier 2: user rules beat kindMap ──────────────────────────────────────────
  const userOverrideRules = [
    { id: 'u1', field: 'SKEY', pattern: 'CA100', match: 'equals', kind: 'REST' },
  ];
  assert.equal(
    resolveKindPure({ SKEY: 'CA100' }, { userRules: userOverrideRules }),
    'REST',
    'user rule (CA100→REST) beats DEFAULT_KIND_MAP (CA100→GUIDE)'
  );

  // ── Tier 3: kindMap beats defaultRules ───────────────────────────────────────
  assert.equal(
    resolveKindPure({ SKEY: 'CA100' }, { userRules: [], kindMap: { CA100: 'ANCHOR' } }),
    'ANCHOR',
    'injected kindMap overrides defaultRules'
  );

  // ── Tier 3: empty kindMap lets defaultRules handle CA codes ──────────────────
  assert.equal(
    resolveKindPure({ SKEY: 'CA150' }, { userRules: [], kindMap: {}, defaultRules: DEFAULT_RULES }),
    'REST',
    'empty kindMap — CA150 resolved by defaultRules builtin-ca150'
  );

  // ── Tier 5: text heuristic fires when no rules match ─────────────────────────
  assert.equal(
    resolveKindPure({ NAME: 'GUIDE BRACKET' }, { userRules: [], kindMap: {}, defaultRules: [] }),
    'GUIDE',
    'text heuristic fires when rules exhausted'
  );
  assert.equal(
    resolveKindPure({ NAME: 'STOPPER ASSY' }, { userRules: [], kindMap: {}, defaultRules: [] }),
    'LINESTOP',
    'STOPPER via text heuristic'
  );

  // ── defaultKind ───────────────────────────────────────────────────────────────
  assert.equal(
    resolveKindPure({}, { userRules: [], kindMap: {}, defaultRules: [], defaultKind: 'REST' }),
    'REST',
    'defaultKind returned when nothing matches'
  );
  assert.equal(
    resolveKindPure({}, { userRules: [], kindMap: {}, defaultRules: [] }),
    '',
    'empty string when defaultKind not set and nothing matches'
  );

  // ── Nested attributes (RVM userData shape) ────────────────────────────────────
  assert.equal(
    resolveKindPure({ attributes: { CMPSUPTYPE: 'LS-5' } }),
    'LINESTOP',
    'resolves from nested attributes bag'
  );
  assert.equal(
    resolveKindPure({ userData: { SKEY: 'CA150' } }),
    'REST',
    'resolves from nested userData bag'
  );
  assert.equal(
    resolveKindPure({ attributes: { SUPPORT_KIND: 'ANCHOR' }, SKEY: 'CA100' }),
    'ANCHOR',
    'nested explicit SUPPORT_KIND wins over top-level SKEY'
  );

  // ── SUPPORT_KINDS / MATCH_TYPES exports ───────────────────────────────────────
  assert.ok(SUPPORT_KINDS.includes('REST'),     'SUPPORT_KINDS includes REST');
  assert.ok(SUPPORT_KINDS.includes('GUIDE'),    'SUPPORT_KINDS includes GUIDE');
  assert.ok(SUPPORT_KINDS.includes('LINESTOP'), 'SUPPORT_KINDS includes LINESTOP');
  assert.ok(SUPPORT_KINDS.includes('ANCHOR'),   'SUPPORT_KINDS includes ANCHOR');
  assert.ok(SUPPORT_KINDS.includes('SPRING'),   'SUPPORT_KINDS includes SPRING');
  assert.ok(MATCH_TYPES.includes('equals'),     'MATCH_TYPES includes equals');

  // ── splitRuleTerms ─────────────────────────────────────────────────────────────
  assert.deepEqual(splitRuleTerms('A, B; C\nD'), ['A', 'B', 'C', 'D'], 'splitRuleTerms multi-separator');
  assert.deepEqual(splitRuleTerms(''),           [],                    'splitRuleTerms empty');

  // ── normalizeMapperFieldName ───────────────────────────────────────────────────
  assert.equal(normalizeMapperFieldName('*'),         '*',          'wildcard preserved');
  assert.equal(normalizeMapperFieldName('<SKEY>'),    'SKEY',       'angle brackets stripped');
  assert.equal(normalizeMapperFieldName('cmpsuptype'),'CMPSUPTYPE', 'uppercased');

  // ── collectMapperFieldValues ───────────────────────────────────────────────────
  const vals = collectMapperFieldValues(
    { CMPSUPTYPE: 'GT5-A', NAME: 'FOO' },
    { field: 'CMPSUPTYPE', pattern: 'GT5', match: 'startsWith', kind: 'REST' }
  );
  assert.ok(vals.includes('GT5-A'), 'collectMapperFieldValues returns matching field value');

  // DEFAULT_RULES ordering: support intent before subtype, GT5 before GT
  const pgIdx     = DEFAULT_RULES.findIndex(r => r.id === 'builtin-pg');
  const gt5MdsIdx = DEFAULT_RULES.findIndex(r => r.id === 'builtin-gt5-mds');
  const gtIdx     = DEFAULT_RULES.findIndex(r => r.id === 'builtin-gt-mds');
  assert.ok(pgIdx < gt5MdsIdx, 'builtin-pg must precede builtin-gt5-mds so guide intent wins');
  assert.ok(gt5MdsIdx < gtIdx, 'builtin-gt5-mds must precede builtin-gt-mds in DEFAULT_RULES');

  // ── DEFAULT_RULES contains CA built-ins ───────────────────────────────────────
  const ids = DEFAULT_RULES.map(r => r.id);
  assert.ok(ids.includes('builtin-ca150'), 'DEFAULT_RULES has builtin-ca150');
  assert.ok(ids.includes('builtin-ca250'), 'DEFAULT_RULES has builtin-ca250');
  assert.ok(ids.includes('builtin-ca100'), 'DEFAULT_RULES has builtin-ca100');

  // ── Phase 7: resolveKindDescriptor ───────────────────────────────────────────
  // Single-kind — standard supports
  const dRest = resolveKindDescriptor({ SKEY: 'CA150' });
  assert.equal(dRest.primaryKind,     'REST',   'CA150 descriptor: primaryKind=REST');
  assert.deepEqual(dRest.kinds,       ['REST'],  'CA150 descriptor: kinds=[REST]');
  assert.equal(dRest.dofs.Fy,         true,      'CA150 descriptor: dofs.Fy');

  const dGuide = resolveKindDescriptor({ CMPSUPTYPE: 'PG-5' });
  assert.equal(dGuide.primaryKind,    'GUIDE',   'PG-5 descriptor: primaryKind=GUIDE');
  assert.deepEqual(dGuide.kinds,      ['GUIDE'],  'PG-5 descriptor: kinds=[GUIDE]');
  assert.equal(dGuide.dofs.Fx,        true,       'PG-5 descriptor: dofs.Fx');

  const dLS = resolveKindDescriptor({ CMPSUPTYPE: 'LS-10' });
  assert.equal(dLS.primaryKind,       'LINESTOP', 'LS-10 descriptor: primaryKind=LINESTOP');
  assert.equal(dLS.dofs.Fz,           true,       'LS-10 descriptor: dofs.Fz');

  const dAnchor = resolveKindDescriptor({ SKEY: 'CA150' }, { userRules: [{ id: 'u1', field: 'SKEY', pattern: 'CA150', match: 'equals', kind: 'ANCHOR' }] });
  assert.equal(dAnchor.primaryKind,   'ANCHOR',   'user-rule override reflected in descriptor');
  assert.equal(dAnchor.dofs.Mx,       true,       'ANCHOR descriptor has moment DOFs');

  // Composite — CA100 = REST + GUIDE
  const dCA100 = resolveKindDescriptor({ SKEY: 'CA100' });
  assert.equal(dCA100.primaryKind,    'REST',              'CA100 composite: primaryKind=REST');
  assert.deepEqual(dCA100.kinds,      ['REST', 'GUIDE'],   'CA100 composite: kinds=[REST,GUIDE]');
  assert.equal(dCA100.dofs.Fy,        true,                'CA100 composite dofs: Fy (REST)');
  assert.equal(dCA100.dofs.Fx,        true,                'CA100 composite dofs: Fx (GUIDE)');
  assert.equal(dCA100.dofs.Fz,        true,                'CA100 composite dofs: Fz (GUIDE)');

  // Empty attrs → empty descriptor
  const dEmpty = resolveKindDescriptor({}, { userRules: [], kindMap: {}, defaultRules: [] });
  assert.equal(dEmpty.primaryKind,    '',   'empty attrs: empty primaryKind');
  assert.deepEqual(dEmpty.kinds,      [],   'empty attrs: empty kinds');
  assert.deepEqual(dEmpty.dofs,       {},   'empty attrs: empty dofs');

  // SUPPORT_KINDS includes LINESTOP and LIMIT
  assert.ok(SUPPORT_KINDS.includes('LINESTOP'), 'SUPPORT_KINDS includes LINESTOP');
  assert.ok(SUPPORT_KINDS.includes('LIMIT'),    'SUPPORT_KINDS includes LIMIT');

  console.log('[PASS] support-kind-resolver all assertions passed.');
}

try { run(); }
catch (e) { console.error('[FAIL]', e.message, '\n', e.stack); process.exit(1); }

