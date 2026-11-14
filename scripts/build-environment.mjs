import { config } from 'dotenv';

export function loadBuildEnvironment(mode) {
  config({
    path: [`.env.${mode}.local`, `.env.${mode}`, '.env.local', '.env'],
    quiet: true,
  });
}

export function validateBuildEnvironment() {
  // This preflight runs in its own process; Astro loads its active mode itself.
  loadBuildEnvironment('production');
  for (const name of ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY']) {
    if (!process.env[name]?.trim()) throw new Error(`Missing build variable: ${name}`);
  }
  const url = new URL(process.env.PUBLIC_SUPABASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid PUBLIC_SUPABASE_URL');
  const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (key.startsWith('sb_secret_')) throw new Error('A secret Supabase key cannot be bundled');
  if (key.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role !== 'anon') throw new Error('PUBLIC_SUPABASE_ANON_KEY must have the anon role');
  } else if (!key.startsWith('sb_publishable_')) {
    throw new Error('PUBLIC_SUPABASE_ANON_KEY must be an anon JWT or publishable key');
  }
  if (process.env.DEPLOY_TARGET === 'cloudflare' &&
      (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Cloudflare builds require a public HTTPS Supabase URL');
  }
}
