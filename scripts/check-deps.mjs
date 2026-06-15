#!/usr/bin/env node
/**
 * Dependency drift checker.
 * Compares package.json dependencies against node_modules on disk.
 * Exits 1 if any declared dependency is missing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('/app/package.json', 'utf8'));
const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const names = Object.keys(all);

const missing = names.filter((d) => !existsSync(join('/app/node_modules', d)));

if (missing.length > 0) {
  process.stderr.write(`\nERROR: ${missing.length} package(s) in package.json are missing from Docker node_modules:\n`);
  for (const m of missing) {
    process.stderr.write(`  - ${m}\n`);
  }
  process.stderr.write('\nThe Docker image node_modules is out of sync with the mounted package.json.\n');
  process.stderr.write('Run: make rebuild\n\n');
  process.exit(1);
}

process.stdout.write(`Scanned ${names.length} declared packages...\n`);
process.stdout.write(`All ${names.length} declared packages present in node_modules.\n`);
