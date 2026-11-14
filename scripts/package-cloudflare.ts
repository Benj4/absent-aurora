import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveAndParseConfig } from '@cloudflare/config';
import {
  cleanBuildOutputDir, readBuildOutput, writeAssets, writeRootConfig, writeWorkerConfig,
} from '@cloudflare/build-output-utils';
import config from '../cloudflare.config';

// Keep Astro fully static: package dist using the same format consumed by cf --prebuilt.
const root = process.cwd();
const context = { isPreview: false, mode: undefined };
const parsed = await resolveAndParseConfig(config, context);
if (!parsed.success) throw parsed.error;
const { worker, accountId, complianceRegion } = parsed.data;
if (!worker) throw new Error('Cloudflare Worker configuration is required');
await cleanBuildOutputDir(root);
await writeAssets({ root, sourceDirectory: resolve(root, 'dist') });
await writeWorkerConfig({ root, config: worker });
await writeRootConfig(root, { accountId, complianceRegion }, context);
await readBuildOutput(root);
await writeFile(resolve(root, '.cloudflare/output/revision.json'), JSON.stringify({
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
}));
console.log('Packaged static assets for Cloudflare; nothing uploaded.');
