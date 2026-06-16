import { RvmPcfEmitter } from '../../../rvm-pcf-extract/RvmPcfEmitter.js';

const mockRows = [
  {
    rowNo: 10,
    type: 'PIPE',
    include: true,
    pipelineRef: 'LINE-001',
    skey: 'ELBW',
    ca: {},
    ep1: { x: 100, y: 0, z: 0 },
    ep2: { x: 1100, y: 0, z: 0 },
    cp: null,
    bp: null,
    supportCoor: null,
  },
  {
    rowNo: 20,
    type: 'BEND',
    include: true,
    pipelineRef: 'LINE-001',
    skey: 'ELBW',
    ca: { '1': 'X1' },
    ep1: { x: 1100, y: 0, z: 0 },
    ep2: { x: 1100, y: 1000, z: 0 },
    cp: { x: 1100, y: 500, z: 0 },
    bp: null,
    supportCoor: null,
  },
  {
    rowNo: 30,
    type: 'TEE',
    include: true,
    pipelineRef: 'LINE-001',
    skey: 'TEBW',
    ca: {},
    ep1: { x: 1100, y: 1000, z: 0 },
    ep2: { x: 2100, y: 1000, z: 0 },
    cp: { x: 1600, y: 1000, z: 0 },
    bp: { x: 1600, y: 1500, z: 0 },
    supportCoor: null,
  },
  {
    rowNo: 40,
    type: 'GASK',
    include: false,
    pipelineRef: 'LINE-001',
    skey: null,
    ca: {},
    ep1: null,
    ep2: null,
    cp: null,
    bp: null,
    supportCoor: null,
  },
  {
    rowNo: 50,
    type: 'SUPPORT',
    include: true,
    pipelineRef: 'LINE-001',
    skey: null,
    ca: {},
    supportName: 'CA150',
    supportGuid: 'UCI:G001',
    ep1: { x: 1500, y: 0, z: 0 },
    ep2: null,
    cp: null,
    bp: null,
    supportCoor: { x: 1500, y: 0, z: 0 },
  },
  {
    rowNo: 60,
    type: 'VALVE',
    include: true,
    pipelineRef: 'LINE-002',
    skey: 'VVBW',
    ca: { '8': 45.0 },
    ep1: { x: 200, y: 0, z: 0 },
    ep2: { x: 500, y: 0, z: 0 },
    cp: null,
    bp: null,
    supportCoor: null,
  },
];

async function runTests() {
  const errors = [];

  // T1: Missing geometry -> error
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: false });
    const badRow = { rowNo: 1, type: 'PIPE', include: true, pipelineRef: 'X', skey: 'ELBW', ca: {}, ep1: null, ep2: null, cp: null, bp: null, supportCoor: null };
    const result = emitter.emit([badRow]);
    if (result.errors.length > 0 && result.errors[0].code === 'MISSING-GEOMETRY') {
      console.log('✅ T1: Missing geometry produces MISSING-GEOMETRY error');
    } else {
      errors.push(`T1 failed: errors=${JSON.stringify(result.errors)}`);
    }
  }

  // T2: allowPartialPcf=false + errors -> no PCF
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: false });
    const badRow = { rowNo: 1, type: 'PIPE', include: true, pipelineRef: 'X', skey: 'ELBW', ca: {}, ep1: null, ep2: null, cp: null, bp: null, supportCoor: null };
    const result = emitter.emit([badRow]);
    if (Object.keys(result.pcfTextByPipelineRef).length === 0) {
      console.log('✅ T2: allowPartialPcf=false + errors -> no PCF generated');
    } else {
      errors.push('T2 failed: PCF was generated despite errors');
    }
  }

  // T3: MESSAGE-SQUARE is emitted
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef.LINE_001 || result.pcfTextByPipelineRef['LINE-001'] || '';
    if (pcf.includes('MESSAGE-SQUARE')) {
      console.log('✅ T3: MESSAGE-SQUARE emitted');
    } else {
      errors.push(`T3 failed: PCF LINE-001=${pcf.slice(0, 200)}`);
    }
  }

  // T4: PIPE block emits END-POINT lines and no pipe SKEY
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef['LINE-001'] || '';
    if (pcf.includes('PIPE') && pcf.includes('END-POINT') && !pcf.includes('PIPE\n    <SKEY>')) {
      console.log('✅ T4: PIPE block emits END-POINT lines and no pipe SKEY');
    } else {
      errors.push(`T4 failed: pipe block invalid in PCF`);
    }
  }

  // T5: BEND block emits CENTRE-POINT
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef['LINE-001'] || '';
    if (pcf.includes('BEND') && pcf.includes('CENTRE-POINT')) {
      console.log('✅ T5: BEND block emits CENTRE-POINT');
    } else {
      errors.push(`T5 failed: no CENTRE-POINT in PCF`);
    }
  }

  // T6: TEE block emits BRANCH1-POINT
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef['LINE-001'] || '';
    if (pcf.includes('TEE') && pcf.includes('BRANCH1-POINT')) {
      console.log('✅ T6: TEE block emits BRANCH1-POINT');
    } else {
      errors.push(`T6 failed: no BRANCH1-POINT in PCF`);
    }
  }

  // T7: include=false rows skipped
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef['LINE-001'] || '';
    if (!pcf.includes('GASK')) {
      console.log('✅ T7: GASK (include=false) not emitted');
    } else {
      errors.push('T7 failed: GASK found in PCF');
    }
  }

  // T8: SUPPORT block emits CO-ORDS, SUPPORT-NAME, SUPPORT-GUID
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef['LINE-001'] || '';
    if (pcf.includes('SUPPORT') && pcf.includes('CO-ORDS') && pcf.includes('<SUPPORT_NAME> CA150') && pcf.includes('<SUPPORT_GUID> UCI:G001')) {
      console.log('✅ T8: SUPPORT block emits CO-ORDS, SUPPORT-NAME, SUPPORT-GUID');
    } else {
      errors.push(`T8 failed: SUPPORT block incorrect in PCF`);
    }
  }

  // T9: Multiple pipeline refs -> separate PCF texts
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const hasL1 = 'LINE-001' in result.pcfTextByPipelineRef;
    const hasL2 = 'LINE-002' in result.pcfTextByPipelineRef;
    if (hasL1 && hasL2) {
      console.log('✅ T9: Multiple pipeline refs produce separate PCF texts');
    } else {
      errors.push(`T9 failed: keys=${Object.keys(result.pcfTextByPipelineRef).join(',')}`);
    }
  }

  // T10: CA attribute emitted as COMPONENT-ATTRIBUTE1 X1
  {
    const emitter = new RvmPcfEmitter({ allowPartialPcf: true });
    const result = emitter.emit(mockRows);
    const pcf = result.pcfTextByPipelineRef['LINE-001'] || '';
    if (pcf.includes('COMPONENT-ATTRIBUTE1 X1')) {
      console.log('✅ T10: CA attribute emitted as COMPONENT-ATTRIBUTE1 X1');
    } else {
      errors.push(`T10 failed: no COMPONENT-ATTRIBUTE1 X1 in PCF`);
    }
  }

  if (errors.length > 0) {
    errors.forEach((e) => console.error('❌', e));
    process.exit(1);
  } else {
    console.log('✅ All Wave 8 PCF emitter tests passed.');
  }
}

runTests();
