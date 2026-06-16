#!/usr/bin/env node
/**
 * gen-rvm-bundle.js
 *
 * Assembles a model.bundle.json manifest from the artifacts in a directory.
 *
 * Usage:
 *   node tools/gen-rvm-bundle.js <artifacts-dir> [options]
 *
 * Options:
 *   --bundle-id=<id>     Bundle identifier (default: directory basename)
 *   --source-rvm=<file>  Original .rvm filename to reference in source block
 *   --units=<mm|m>       Coordinate units (default: mm)
 *   --up-axis=<Y|Z>      Up axis (default: Y)
 *
 * Expects the directory to contain:
 *   *.glb               → artifacts.glb
 *   *.index.json        → artifacts.index
 *   *.review.xml        → artifacts.tags  (optional)
 */

import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const opts = { bundleId: null, sourceRvm: null, units: 'mm', upAxis: 'Y' };
  const positional = [];
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--bundle-id=')) opts.bundleId = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--source-rvm=')) opts.sourceRvm = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--units=')) opts.units = arg.split('=')[1];
    else if (arg.startsWith('--up-axis=')) opts.upAxis = arg.split('=')[1];
    else positional.push(arg);
  }
  return { opts, positional };
}

function findArtifact(dir, ext, exclude = []) {
  const files = fs.readdirSync(dir).filter(
    (f) => f.endsWith(ext) && !exclude.some((e) => f.endsWith(e)),
  );
  return files.length ? files[0] : null;
}

function main() {
  const { opts, positional } = parseArgs(process.argv);
  const artifactsDir = positional[0];
  if (!artifactsDir) {
    console.error('Usage: node gen-rvm-bundle.js <artifacts-dir> [options]');
    process.exit(1);
  }

  const absDir = path.resolve(artifactsDir);
  if (!fs.existsSync(absDir)) {
    console.error(`Directory not found: ${absDir}`);
    process.exit(1);
  }

  const bundleId = opts.bundleId || path.basename(absDir);

  const glbFile = findArtifact(absDir, '.glb');
  if (!glbFile) {
    console.error('No .glb file found in directory');
    process.exit(1);
  }

  const indexFile = findArtifact(absDir, '.index.json');
  const tagsFile = findArtifact(absDir, '.review.xml');

  const manifest = {
    schemaVersion: 'rvm-bundle/v1',
    bundleId,
    source: {
      format: 'RVM',
      files: opts.sourceRvm
        ? [{ name: path.basename(opts.sourceRvm), sha256: null }]
        : [],
    },
    converter: {
      name: 'rvmparser',
      version: null,
      mode: 'static-preconverted',
      warnings: [],
    },
    runtime: {
      units: opts.units,
      upAxis: opts.upAxis,
      originOffset: [0, 0, 0],
      scale: 1,
    },
    artifacts: {
      glb: glbFile,
      index: indexFile || null,
      tags: tagsFile || null,
    },
    coverage: {
      attributes: !!indexFile,
      tree: !!indexFile,
      supports: false,
      reviewTags: !!tagsFile,
    },
    modelClass: 'single-bundle',
  };

  const outputPath = path.join(absDir, 'model.bundle.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✅ model.bundle.json written → ${outputPath}`);
  console.log(`   glb: ${glbFile}`);
  if (indexFile) console.log(`   index: ${indexFile}`);
  if (tagsFile) console.log(`   tags: ${tagsFile}`);
}

main();
