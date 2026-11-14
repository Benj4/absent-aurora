import type { APIRoute } from 'astro';

// Public build metadata: never include keys, credentials or session state.
export const GET: APIRoute = () => new Response(JSON.stringify({
  application: 'absent-aurora',
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
}), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
