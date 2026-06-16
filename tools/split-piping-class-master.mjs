#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Deterministically split docs/Masters/Piping_class_master.json into one JSON shard per piping class/spec.
const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'docs', 'Masters', 'Piping_class_master.json');
const outDir = path.join(repoRoot, 'docs', 'Masters', 'SpecwisePipingClass');
const indexPath = path.join(outDir, 'index.json');

function clean(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function specKeyForRow(row) {
  return clean(row?.['Piping Class'] ?? row?.PIPING_CLASS ?? row?.pipingClass ?? row?.Spec ?? row?.SPEC ?? row?.Class);
}

function safeFileStem(specKey) {
  const safe = clean(specKey)
    .replace(/^['"]|['"]$/g, '')
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'UNKNOWN';
}

function uniqueSorted(values, numeric = false) {
  const unique = Array.from(new Set(values.map(clean).filter(Boolean)));
  return unique.sort((a, b) => {
    if (numeric) return (Number(a) || 0) - (Number(b) || 0);
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function fileHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseMaster(rawText) {
  const parsed = JSON.parse(rawText);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of ['rows', 'masterRows', 'data', 'items']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
  }
  throw new Error('Piping_class_master.json must be an array or an object containing rows/masterRows/data/items.');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${path.relative(repoRoot, sourcePath)}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const raw = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
  const sourceSha256 = fileHash(raw);
  const rows = parseMaster(raw);
  const grouped = new Map();

  rows.forEach((row, index) => {
    const specKey = specKeyForRow(row) || 'UNKNOWN';
    if (!grouped.has(specKey)) grouped.set(specKey, []);
    grouped.get(specKey).push({ ...row, _sourceRowIndex: index + 1 });
  });

  const usedFiles = new Set();
  const classes = {};

  for (const [specKey, specRows] of Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))) {
    let stem = safeFileStem(specKey);
    let file = `${stem}.json`;
    let suffix = 2;
    while (usedFiles.has(file.toLowerCase())) {
      file = `${stem}_${suffix}.json`;
      suffix += 1;
    }
    usedFiles.add(file.toLowerCase());

    const convertedBores = uniqueSorted(specRows.map((row) => row.convertedBore ?? row['Converted Bore'] ?? row.DN ?? row.NB ?? row.Bore), true);
    const sizes = uniqueSorted(specRows.map((row) => row.Size ?? row.NPS ?? row.size), true);
    const ratings = uniqueSorted(specRows.map((row) => row.Rating ?? row.RATING ?? row.Class));
    const schedules = uniqueSorted(specRows.map((row) => row.SCH ?? row.Schedule ?? row.SCHEDULE));
    const materials = uniqueSorted(specRows.map((row) => row.Material_Name ?? row.Material ?? row.MATERIAL)).slice(0, 25);

    const shard = {
      schemaVersion: 1,
      specKey,
      rowCount: specRows.length,
      generatedAt: new Date().toISOString(),
      source: '../Piping_class_master.json',
      rows: specRows,
    };
    writeJson(path.join(outDir, file), shard);

    classes[specKey] = {
      file,
      rowCount: specRows.length,
      matchTokens: [specKey],
      convertedBores,
      sizes,
      ratings,
      schedules,
      materialSamples: materials,
    };
  }

  const index = {
    schemaVersion: 1,
    source: '../Piping_class_master.json',
    sourceSha256,
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    classCount: Object.keys(classes).length,
    shardBase: 'docs/Masters/SpecwisePipingClass/',
    matching: {
      mode: 'simple-contains',
      description: 'Normalize branch names and class keys, then load a shard when branchName.includes(classKey). No regex is used for class matching.',
    },
    classes,
  };
  writeJson(indexPath, index);

  console.log(`Split ${rows.length} piping-class rows into ${Object.keys(classes).length} shard file(s).`);
  console.log(`Wrote ${path.relative(repoRoot, indexPath)}`);
}

main();
