/**
 * Test Setup - Vitest Configuration
 * Loads environment variables and configures the test environment
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(__dirname, '../.env.test') });

// Verify required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

if (process.env.ALLOW_SUPABASE_INTEGRATION_TESTS !== 'true') {
  throw new Error(
    'Supabase integration tests are disabled. Set ALLOW_SUPABASE_INTEGRATION_TESTS=true only for an isolated test project.'
  );
}

const supabaseUrl = new URL(process.env.SUPABASE_URL!);
const isLocalSupabase = ['localhost', '127.0.0.1'].includes(supabaseUrl.hostname);

if (!isLocalSupabase) {
  const expectedProjectRef = process.env.SUPABASE_TEST_PROJECT_REF;

  if (!expectedProjectRef) {
    throw new Error(
      'SUPABASE_TEST_PROJECT_REF is required when integration tests target a remote Supabase project.'
    );
  }

  if (supabaseUrl.hostname !== `${expectedProjectRef}.supabase.co`) {
    throw new Error(
      `SUPABASE_URL does not match SUPABASE_TEST_PROJECT_REF (${expectedProjectRef}).`
    );
  }
}

console.log('✅ Test environment configured');
