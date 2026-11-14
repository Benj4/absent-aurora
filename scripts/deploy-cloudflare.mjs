import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Fail closed outside the production Workers Builds trigger, including local/staging runs.
if (process.env.WORKERS_CI_BRANCH !== 'master' || !process.env.WORKERS_CI_COMMIT_SHA) {
  throw new Error('Production deployment requires a Workers Builds master trigger');
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const revision = JSON.parse(readFileSync('.cloudflare/output/revision.json', 'utf8'));
if (commit !== process.env.WORKERS_CI_COMMIT_SHA || revision.commit !== commit) {
  throw new Error('Build output does not match the Workers Builds commit');
}
const latest = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8' }).trim().split(/\s+/)[0];
if (latest !== commit) throw new Error('A newer master revision exists; refusing stale deployment');
const result = spawnSync('cf', ['deploy', '--prebuilt', '--tag', commit], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
