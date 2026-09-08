import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Delegate introspection to the official CLI; preserve the last output on failure.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../src/types/database.types.ts', import.meta.url);
const source = process.argv.slice(2);
const types = execFileSync('supabase', [
  'gen', 'types', 'typescript', '--schema', 'public',
  ...(source.length ? source : ['--linked']),
], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024 });

if (!types.includes('export type Database') && !types.includes('export interface Database')) {
  throw new Error('Supabase CLI did not return Database types; the existing file was preserved.');
}
mkdirSync(new URL('../src/types/', import.meta.url), { recursive: true });
const temporary = fileURLToPath(output) + '.tmp';
writeFileSync(temporary, types);
renameSync(temporary, output);
console.log('Generated src/types/database.types.ts using Supabase CLI.');
