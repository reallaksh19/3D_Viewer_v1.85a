import { scoreField, isValidFieldMatch } from '../viewer/converters/xml-cii2019-core/linelist-mapping.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('\n=== lineKey2 requireHeaderMatch fix ===');
{
  // __EMPTY_37 with sample values 'Stress Critical Line', 'No', 'Yes'
  const testKey = '__EMPTY_37';
  const testRows = [
    { '__EMPTY_37': 'Stress Critical Line' },
    { '__EMPTY_37': 'No' },
    { '__EMPTY_37': 'Yes' },
  ];
  const score = scoreField('lineKey2', testKey, testRows);
  console.log(`  Score for '__EMPTY_37' (Stress Critical Line/No/Yes) as lineKey2: ${score}`);
  assert(score < 200, '__EMPTY_37 should NOT score >= 200 for lineKey2 (requireHeaderMatch)');
}

{
  // Proper lineKey2 column with 'Line Number' header
  const testKey2 = 'Line Number';
  const testRows2 = [{ 'Line Number': '123456' }, { 'Line Number': '789012' }];
  const score2 = scoreField('lineKey2', testKey2, testRows2);
  console.log(`  Score for 'Line Number' as lineKey2: ${score2}`);
  assert(score2 >= 200, 'Proper "Line Number" header should score >= 200 for lineKey2');
}

{
  // lineSeqNo should still work  
  const score3 = scoreField('lineSeqNo', 'Line No', []);
  console.log(`  Score for 'Line No' as lineSeqNo: ${score3}`);
  assert(score3 >= 200, '"Line No" should score >= 200 for lineSeqNo');
}

console.log('\n=== rating alias fix ===');
{
  // 'Piping Class' should NOT match rating now (removed 'class' from aliases)
  const ratingScore1 = scoreField('rating', 'Piping Class', []);
  console.log(`  Score for 'Piping Class' as rating: ${ratingScore1}`);
  assert(ratingScore1 < 200, '"Piping Class" should NOT match rating (class removed from aliases)');
}

{
  // 'Rating' should still match
  const ratingScore2 = scoreField('rating', 'Rating', []);
  console.log(`  Score for 'Rating' as rating: ${ratingScore2}`);
  assert(ratingScore2 >= 200, '"Rating" header should still score >= 200');
}

{
  // 'Class Rating' header should match rating since it contains 'rating'
  const ratingScore3 = scoreField('rating', 'Class Rating', []);
  console.log(`  Score for 'Class Rating' as rating: ${ratingScore3}`);
  // 'Class Rating' contains 'rating' so all group matches, but 'line' reject test would fail if 'line' present
  assert(ratingScore3 >= 200, '"Class Rating" (contains "rating") should score >= 200');
}

{
  // 'Pressure Rating' - contains both pressure (rejected) and rating (alias)
  // reject rule has /pressure/i so this should be rejected
  const ratingScore4 = scoreField('rating', 'Pressure Rating', []);
  console.log(`  Score for 'Pressure Rating' as rating: ${ratingScore4}`);
  assert(ratingScore4 < 200, '"Pressure Rating" should be rejected due to /pressure/i reject rule');
}

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
