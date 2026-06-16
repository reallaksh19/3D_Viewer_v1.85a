import assert from 'assert/strict';

import {
  autoMapLineListFields,
  buildLineListLookup,
  findLineListMatch,
  getLineListCandidateValues,
  loadLegacyLineListStorage
} from '../../../rvm-pcf-extract/RvmLineListMasterLogic.js';
import { RvmMasterResolutionWorkflow } from '../../../rvm-pcf-extract/RvmMasterResolutionWorkflow.js';

function makeStorage(entries) {
  const map = new Map(Object.entries(entries || {}));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function run() {
  console.log('--- rvm-linelist-master-legacy.test.js ---');

  {
    const map = autoMapLineListFields([
      'Line Number',
      'Design Pressure (kPa)',
      'Design Temperature C',
      'Hydro Test Pressure',
      'Fluid Density',
    ]);

    assert.equal(map.lineNo, 'Line Number');
    assert.equal(map.p1, 'Design Pressure (kPa)');
    assert.equal(map.t1, 'Design Temperature C');
    assert.equal(map.hp, 'Hydro Test Pressure');
    assert.equal(map.densityDirect, 'Fluid Density');
  }

  {
    const map = autoMapLineListFields(['Construction Class']);
    assert.equal(map.pipingClass, '', 'Construction Class must not map to PipingClass via Class alias');
  }

  {
    const rows = [
      { service: 'Steam', lineNo: 'L-100', p1: '1200' },
      { service: 'Water', lineNo: 'L-200', p1: '900' },
    ];
    const lookup = buildLineListLookup(rows, { service: 'service', lineNo: 'lineNo' });
    const composite = findLineListMatch({ lineNo: 'L-100', service: 'Steam' }, lookup);
    const simple = findLineListMatch('L-200', lookup);

    assert.equal(composite.match, rows[0]);
    assert.equal(composite.source, 'LINELIST-COMPOSITE-MATCH');
    assert.equal(simple.match, rows[1]);
    assert.equal(simple.source, 'LINELIST-EXACT-MATCH');
  }

  {
    const rows = [{ lineNo: 'AREA-01 100', p1: '1000' }];
    const lookup = buildLineListLookup(rows, { lineNo: 'lineNo' });
    const match = findLineListMatch('AREA01100', lookup);
    assert.equal(match.match, rows[0]);
    assert.equal(match.source, 'LINELIST-NORMALIZED-MATCH');
  }

  {
    const rows = [{ lineNo: 'ABCDEFGHIJ1234567890', p1: '1000' }];
    const lookup = buildLineListLookup(rows, { lineNo: 'lineNo' });
    const match = findLineListMatch('ABCDEFGHIJ1234567890X', lookup);
    assert.equal(match.match, rows[0]);
    assert.equal(match.source, 'LINELIST-FUZZY-MATCH');
  }

  {
    const row = {
      densityDirect: '850',
      densityGas: '1.1',
      densityLiquid: '900',
      phase: 'Gas',
    };
    const values = getLineListCandidateValues(row, {
      densityDirect: 'densityDirect',
      densityGas: 'densityGas',
      densityLiquid: 'densityLiquid',
      phase: 'phase',
    });
    assert.equal(values.density, '850', 'direct density wins over phase logic');
  }

  {
    const row = {
      densityMixed: '700',
      densityLiquid: '900',
      phase: 'Mixed',
    };
    const fieldMap = {
      densityMixed: 'densityMixed',
      densityLiquid: 'densityLiquid',
      phase: 'phase',
    };
    const liquidPreferred = getLineListCandidateValues(row, fieldMap, { mixedPreference: 'Liquid' });
    const mixedPreferred = getLineListCandidateValues(row, fieldMap, { mixedPreference: 'Mixed' });

    assert.equal(liquidPreferred.density, '900');
    assert.equal(mixedPreferred.density, '700');
  }

  {
    const storage = makeStorage({
      pcf_master_linelist: JSON.stringify([{ 'Line Number': 'L-100', 'P1 kPa': '1200' }]),
      pcf_linelist_config: JSON.stringify({
        headers: ['Line Number', 'P1 kPa'],
        smartMap: { LineRef: 'Line Number', P1: 'P1 kPa' },
        keys: { sequenceCol: 'Line Number' },
      }),
    });
    const loaded = loadLegacyLineListStorage(storage);

    assert.equal(loaded.rows.length, 1);
    assert.equal(loaded.fieldMap.lineNo, 'Line Number');
    assert.equal(loaded.fieldMap.p1, 'P1 kPa');
    assert.equal(loaded.keyConfig.sequenceCol, 'Line Number');
  }

  {
    globalThis.localStorage = makeStorage({});
    const rows = [{
      include: true,
      rowNo: 10,
      type: 'PIPE',
      pipelineRef: 'L100',
      name: 'PIPE-10',
      convertedBore: 100,
      ca: {},
      diagnostics: [],
    }];
    const resolver = new RvmMasterResolutionWorkflow({
      masters: {
        linelist: {
          rows: [{
            lineNo: 'L100',
            p1: '12 bar',
            t1: '80 C',
            densityDirect: '850',
          }],
          linelistFieldMap: {
            lineNo: 'lineNo',
            p1: 'p1',
            t1: 't1',
            densityDirect: 'densityDirect',
          },
        },
      },
    });

    const result = resolver.processRows(rows);
    assert.equal(result.requests.filter(request => request.kind === 'LINELIST').length, 0);
    assert.equal(rows[0].ca['1'], '1200 kPa');
    assert.equal(rows[0].ca['2'], '80 C');
    assert.equal(rows[0].ca['9'], '850 kg/m3');
  }

  console.log('[PASS] Line-list legacy master compatibility tests passed.');
}

try {
  run();
} catch (error) {
  console.error('[FAIL] Line-list legacy master compatibility tests failed.');
  console.error(error);
  process.exit(1);
}
