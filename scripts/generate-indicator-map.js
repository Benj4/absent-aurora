#!/usr/bin/env node

/**
 * Script: generate-indicator-map.js
 *
 * Reads `src/data/indicators.json`, iterates through the `indicators` array,
 * and produces an object mapping each indicator `id` to an object with:
 *   - `index`: array position (0-based)
 *   - `label`: the indicator's label
 *
 * Usage:
 *   node scripts/generate-indicator-map.js            (prints JSON to stdout)
 *   node scripts/generate-indicator-map.js out.json  (writes JSON to file)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const indicatorsPath = path.join(root, 'src', 'data', 'indicators.json');

async function main() {
  const outPath = process.argv[2];

  const raw = await fs.promises.readFile(indicatorsPath, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data.indicators)) {
    throw new Error('Unexpected indicators.json format: expected an indicators array');
  }

  const map = {};

  data.indicators.forEach((indicator, index) => {
    if (typeof indicator.id !== 'string') return;
    map[indicator.id] = {
      index,
      label: indicator.label ?? null,
    };
  });

  const output = JSON.stringify(map, null, 2);

  if (outPath) {
    const outFile = path.isAbsolute(outPath) ? outPath : path.join(root, outPath);
    await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
    await fs.promises.writeFile(outFile, output + '\n', 'utf-8');
    console.log(`Wrote indicator map to ${outFile}`);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
