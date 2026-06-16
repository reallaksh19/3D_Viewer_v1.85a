const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.github') continue;

    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else {
      if (filePath.endsWith('.js')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const rootDir = path.resolve(__dirname, '../../');
const jsFiles = walk(rootDir);

let passed = true;

const emitLiteralRegex = /emit\(['"](.*?)['"]\)/g;
const onLiteralRegex = /on\(['"](.*?)['"]\)/g;

const ALLOWED_LITERAL_EMITS_IN_FILES = ['event-bus.js'];

let literalEventCount = 0;

jsFiles.forEach(file => {
  const relPath = file.replace(rootDir, '');
  const code = fs.readFileSync(file, 'utf8');
  const fileName = path.basename(file);

  if (!ALLOWED_LITERAL_EMITS_IN_FILES.includes(fileName)) {
    let match;
    while ((match = emitLiteralRegex.exec(code)) !== null) {
      if (!file.includes('tests/contract') && !file.includes('tests/ci')) {
          console.error(`\u274c FAILED: Literal event emission found in ${relPath}: emit('${match[1]}')`);
          passed = false;
          literalEventCount++;
      }
    }
    while ((match = onLiteralRegex.exec(code)) !== null) {
      if (!file.includes('tests/contract') && !file.includes('tests/ci')) {
          console.error(`\u274c FAILED: Literal event listener found in ${relPath}: on('${match[1]}')`);
          passed = false;
          literalEventCount++;
      }
    }
  }
});

console.log('--- Contract Scan Report ---');
if (passed) {
  console.log('\u2705 All static contract checks passed. No hardcoded literal events detected.');
} else {
  console.log(`\u274c Static contract checks failed with ${literalEventCount} literal event violations.`);
  process.exit(1);
}
