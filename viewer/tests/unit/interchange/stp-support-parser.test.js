import assert from 'assert/strict';
import { parseStpSupportMembers } from '../../../parser/stp-support-parser.js';

const STEP_TEXT = `
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('test'),'2;1');
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(0,0,0));
#2=CARTESIAN_POINT('',(100,0,0));
#3=POLYLINE('PL-1',(#1,#2));
#4=DIRECTION('',(0,1,0));
#5=VECTOR('',#4,50);
#6=LINE('LINE-1',#2,#5);
ENDSEC;
END-ISO-10303-21;
`;

const parsed = parseStpSupportMembers(STEP_TEXT);

assert.equal(parsed.members.length, 2, 'Expected one POLYLINE segment and one LINE member.');
assert.equal(parsed.stats.polylineCount, 1);
assert.equal(parsed.stats.lineCount, 1);
assert.equal(parsed.members[0].sourceEntityType, 'POLYLINE');
assert.equal(parsed.members[0].start.x, 0);
assert.equal(parsed.members[0].end.x, 100);
assert.equal(parsed.members[1].sourceEntityType, 'LINE');
assert.equal(parsed.members[1].start.x, 100);
assert.equal(parsed.members[1].end.y, 50);

console.log('✅ stp-support-parser smoke tests passed.');
