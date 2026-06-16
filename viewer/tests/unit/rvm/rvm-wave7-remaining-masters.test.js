import { RvmRemainingMastersMapper } from '../../../rvm-pcf-extract/RvmRemainingMastersMapper.js';

function makeRow(overrides = {}) {
  return {
    type: 'PIPE',
    include: true,
    attributes: {},
    ca: {},
    diagnostics: [],
    ep1: null,
    ep2: null,
    cp: null,
    bp: null,
    convertedBore: 100,
    pipingClass: null,
    ...overrides,
  };
}

async function runTests() {
  const mapper = new RvmRemainingMastersMapper({});
  const errors = [];

  // T1: PIPE → skey=null
  {
    const row = makeRow({ type: 'PIPE' });
    mapper.mapRow(row);
    if (row.skey === null) console.log('✅ T1: PIPE skey=null');
    else errors.push(`T1 failed: got ${row.skey}`);
  }

  // T2: BEND → skey='ELBW'
  {
    const row = makeRow({ type: 'BEND' });
    mapper.mapRow(row);
    if (row.skey === 'ELBW') console.log('✅ T2: BEND skey=ELBW');
    else errors.push(`T2 failed: got ${row.skey}`);
  }

  // T3: TEE → skey='TEBW'
  {
    const row = makeRow({ type: 'TEE' });
    mapper.mapRow(row);
    if (row.skey === 'TEBW') console.log('✅ T3: TEE skey=TEBW');
    else errors.push(`T3 failed: got ${row.skey}`);
  }

  // T4: FLANGE → skey='FLWN'
  {
    const row = makeRow({ type: 'FLANGE' });
    mapper.mapRow(row);
    if (row.skey === 'FLWN') console.log('✅ T4: FLANGE skey=FLWN');
    else errors.push(`T4 failed: got ${row.skey}`);
  }

  // T5: VALVE → skey='VVBW'
  {
    const row = makeRow({ type: 'VALVE' });
    mapper.mapRow(row);
    if (row.skey === 'VVBW') console.log('✅ T5: VALVE skey=VVBW');
    else errors.push(`T5 failed: got ${row.skey}`);
  }

  // T6: GASK → include=false preserved
  {
    const row = makeRow({ type: 'GASK', include: false });
    mapper.mapRow(row);
    if (row.include === false) console.log('✅ T6: GASK include=false preserved');
    else errors.push(`T6 failed: include=${row.include}`);
  }

  // T7: TEE with BRLEN attr=150 → brlen=150
  {
    const row = makeRow({ type: 'TEE', attributes: { BRLEN: 150 } });
    mapper.mapRow(row);
    if (row.brlen === 150) console.log('✅ T7: TEE BRLEN from attribute');
    else errors.push(`T7 failed: brlen=${row.brlen}`);
  }

  // T8: TEE with cp and bp → brlen = distance
  {
    const row = makeRow({
      type: 'TEE',
      cp: { x: 0, y: 0, z: 0 },
      bp: { x: 0, y: 0, z: 100 },
    });
    mapper.mapRow(row);
    if (Math.abs(row.brlen - 100) < 0.01) console.log('✅ T8: TEE BRLEN from cp-bp distance');
    else errors.push(`T8 failed: brlen=${row.brlen}`);
  }

  // T9: TEE with no BRLEN/geometry → BRLEN-UNRESOLVED
  {
    const row = makeRow({ type: 'TEE' });
    mapper.mapRow(row);
    if (row.diagnostics.includes('BRLEN-UNRESOLVED')) console.log('✅ T9: TEE BRLEN-UNRESOLVED diagnostic');
    else errors.push(`T9 failed: diagnostics=${JSON.stringify(row.diagnostics)}`);
  }

  // T10: SUPPORT row gets supportName from SUPPORT_NAME attr
  {
    const row = makeRow({ type: 'SUPPORT', attributes: { SUPPORT_NAME: 'CA200' } });
    mapper.mapRow(row);
    if (row.supportName === 'CA200') console.log('✅ T10: SUPPORT supportName from attr');
    else errors.push(`T10 failed: supportName=${row.supportName}`);
  }

  // T11: SUPPORT GUID → 'UCI:' prefix
  {
    const row = makeRow({ type: 'SUPPORT', attributes: { SUPPORT_GUID: 'GUID-001' } });
    mapper.mapRow(row);
    if (row.supportGuid === 'UCI:GUID-001') console.log('✅ T11: SUPPORT_GUID prefixed with UCI:');
    else errors.push(`T11 failed: supportGuid=${row.supportGuid}`);
  }

  // T12: SUPPORT row → ca={}
  {
    const row = makeRow({ type: 'SUPPORT', ca: { '1': 'X' } });
    mapper.mapRow(row);
    if (Object.keys(row.ca).length === 0) console.log('✅ T12: SUPPORT ca cleared');
    else errors.push(`T12 failed: ca=${JSON.stringify(row.ca)}`);
  }

  // T13: VALVE with ca['8'] already set → preserved
  {
    const row = makeRow({ type: 'VALVE', ca: { '8': '45.0 kg' }, attributes: { CA8: 99 } });
    mapper.mapRow(row);
    if (row.ca['8'] === '45.0 kg') console.log('✅ T13: VALVE ca[8] preserved from Wave 6');
    else errors.push(`T13 failed: ca[8]=${row.ca['8']}`);
  }

  // T14: PIPE row → ca['8'] not set (CA8 skipped for pipes)
  {
    const row = makeRow({ type: 'PIPE', attributes: { CA8: 99 } });
    mapper.mapRow(row);
    if (row.ca['8'] == null) console.log('✅ T14: PIPE ca[8] not set (skipped)');
    else errors.push(`T14 failed: ca[8]=${row.ca['8']}`);
  }

  if (errors.length > 0) {
    errors.forEach((e) => console.error('❌', e));
    process.exit(1);
  } else {
    console.log('✅ All Wave 7 remaining masters tests passed.');
  }
}

runTests();
