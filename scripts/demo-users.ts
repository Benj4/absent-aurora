import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Database } from '../src/types/database.types';

if (!existsSync('.env.demo.local')) throw new Error('Create .env.demo.local from .env.demo.example first.');
const environment = config({ path: '.env.demo.local', quiet: true }).parsed;
const url = environment?.SUPABASE_URL;
const anonKey = environment?.SUPABASE_ANON_KEY;
const serviceKey = environment?.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error('Complete .env.demo.local with the local URL, anon key and service-role key.');
const localAnonKey = anonKey;
const target = new URL(url);
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('Only a local HTTP Supabase URL is supported.');
}
const actors = [
  ['author-a', 'user'], ['reviewer-b', 'user'], ['reviewer-c', 'user'],
  ['editor', 'editor'], ['admin', 'admin'], ['no-role', null],
] as const;
type Alias = typeof actors[number][0];
type Manifest = { version: 1; target: string; marker: string; ids: Partial<Record<Alias, string>> };
type Credentials = Record<Alias, string>;
const dir = '.demo-users';
const manifestPath = `${dir}/manifest.json`;
const credentialsPath = `${dir}/credentials.json`;
const fingerprint = createHash('sha256').update(`${target.origin}\n${serviceKey}`).digest('hex');
const admin = createClient<Database>(target.origin, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = (alias: Alias) => `aa-demo-${alias}@example.test`;
const save = (path: string, value: unknown) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
};
const must = (error: { message: string } | null, stage: string) => {
  if (error) throw new Error(`${stage}: ${error.message}`);
};

async function main() {
  // Check Auth and the role table before creating any identities.
  const initial = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  must(initial.error, 'Auth preflight');
  const roles = await admin.from('user_roles').select('user_id,role').limit(1);
  must(roles.error, 'Role table preflight');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  if (existsSync(manifestPath) !== existsSync(credentialsPath)) {
    throw new Error('Manifest and credentials must both exist or both be absent; preserve them and investigate.');
  }
  let manifest: Manifest;
  let credentials: Credentials;
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    if (manifest.version !== 1 || manifest.target !== fingerprint || !manifest.marker || !manifest.ids || actors.some(([alias]) => typeof credentials[alias] !== 'string')) {
      throw new Error('Invalid manifest, credentials, or different Supabase target.');
    }
  } else {
    manifest = { version: 1, target: fingerprint, marker: randomUUID(), ids: {} };
    credentials = Object.fromEntries(actors.map(([alias]) => [alias, randomBytes(24).toString('base64url')])) as Credentials;
    save(credentialsPath, credentials);
    save(manifestPath, manifest);
  }
  const allUsers = [];
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    must(result.error, `List users page ${page}`);
    allUsers.push(...result.data.users);
    if (result.data.users.length < 100) break;
  }
  // Refuse every collision before creating or changing any account.
  for (const [alias] of actors) {
    const found = allUsers.filter(user => user.email?.toLowerCase() === email(alias));
    if (found.length > 1 || (found[0] && (found[0].user_metadata?.demo_marker !== manifest.marker || (manifest.ids[alias] && manifest.ids[alias] !== found[0].id))) || (manifest.ids[alias] && !found[0])) {
      throw new Error(`Account collision or missing managed account: ${email(alias)}; no account changes made.`);
    }
  }
  for (const [alias, role] of actors) {
    const address = email(alias);
    let user = allUsers.find(item => item.email?.toLowerCase() === address);
    if (!user) {
      const result = await admin.auth.admin.createUser({ email: address, password: credentials[alias], email_confirm: true, user_metadata: { demo_marker: manifest.marker } });
      must(result.error, `Create ${address}`);
      user = result.data.user!;
    }
    manifest.ids[alias] = user.id;
    save(manifestPath, manifest);
    const existing = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    must(existing.error, `Read role ${address}`);
    if (role && existing.data?.role !== role) {
      const result = await admin.from('user_roles').upsert({ user_id: user.id, role });
      must(result.error, `Assign role ${address}`);
    } else if (!role && existing.data) {
      const result = await admin.from('user_roles').delete().eq('user_id', user.id);
      must(result.error, `Remove role ${address}`);
    }
    const client = createClient<Database>(target.origin, localAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await client.auth.signInWithPassword({ email: address, password: credentials[alias] });
    must(session.error, `Sign in ${address}`);
    if (session.data.user?.id !== user.id || (role === null ? 'role' in session.data.user.app_metadata : session.data.user.app_metadata.role !== role)) {
      throw new Error(`Unexpected session identity or role: ${address}`);
    }
    await client.auth.signOut();
    console.log(`${address}\t${role ?? 'no role'}\t${user.id}`);
  }
  console.log(`Credentials: ${credentialsPath} (owner only); manifest: ${manifestPath}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Provisioning failed'); process.exitCode = 1; });
