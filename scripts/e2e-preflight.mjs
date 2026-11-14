import './e2e-env.mjs';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import puppeteer from 'puppeteer';

const astroHelp = 'Ejecuta pnpm run dev, o pnpm run build seguido de pnpm run preview. Comprueba E2E_BASE_URL (incluye el base path si existe).';
const supabaseHelp = 'Ejecuta pnpm run supabase:start y pnpm run supabase:status. Comprueba que Docker esté disponible.';
export class E2EError extends Error {}

export function localUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error();
    return url;
  } catch { throw new E2EError('E2E requiere URLs locales válidas, sin credenciales.'); }
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!response.ok) throw new Error();
  return response;
}

export async function preflight(target = process.env.E2E_BASE_URL || 'http://localhost:4321/') {
  if (process.env.CI) throw new E2EError('E2E solo se ejecuta manualmente fuera de CI.');
  const base = localUrl(target);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  base.search = '';
  base.hash = '';
  let metadata;
  try {
    await request(base);
    metadata = await (await request(new URL('e2e-environment.json', base))).json();
    if (metadata.application !== 'absent-aurora') throw new Error();
  } catch { throw new E2EError(`Astro no responde o no sirve la configuración E2E actual. ${astroHelp}`); }
  let configured;
  try { configured = localUrl(metadata.supabaseUrl); }
  catch {
    throw new E2EError('La aplicación no apunta a Supabase local. Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en .env.local con los valores de pnpm run supabase:status. Reinicia Astro o vuelve a ejecutar pnpm run build para preview.');
  }
  try {
    const jwksUrl = new URL(`${configured.pathname.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`, configured);
    const jwks = await (await request(jwksUrl)).json();
    // An empty key set is valid for local projects using legacy symmetric JWT keys.
    if (!jwks || !Array.isArray(jwks.keys)) throw new Error();
  } catch {
    throw new E2EError(`Supabase local no responde con un JWKS válido en /auth/v1/.well-known/jwks.json. ${supabaseHelp} Revisa PUBLIC_SUPABASE_URL y reinicia Astro o reconstruye preview si cambiaste su configuración.`);
  }

  try {
    const executable = await puppeteer.executablePath();
    console.log(`Ejecutable de Chrome: ${executable}`);
    await access(executable, constants.X_OK);
  }
  catch { throw new E2EError('Chrome no está instalado o no es ejecutable. Ejecuta pnpm run e2e:install. Revisa PUPPETEER_EXECUTABLE_PATH si lo configuraste.'); }
  console.log('Astro, Supabase local y el ejecutable de Chrome están disponibles.');
  return base;
}
