/**
 * Supabase Test Client Utilities
 * Provides helper functions for testing with different authentication contexts
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

/**
 * Admin client with service role - bypasses RLS
 * Use this ONLY for test setup/teardown
 */
export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Anonymous client - respects RLS policies
 * Use this to test unauthenticated access
 */
export function getAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Authenticated client - respects RLS policies as a specific user
 * @param email - User email
 * @param password - User password
 */
export async function getAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to authenticate user ${email}: ${error.message}`);
  }

  return client;
}

/**
 * Create a test user
 * @param email - User email
 * @param password - User password
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<string> {
  const adminClient = getAdminClient();

  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find((u) => u.email === email);

  if (existingUser) {
    return existingUser.id;
  }

  // Create new user
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user ${email}: ${error.message}`);
  }

  return data.user.id;
}

/**
 * Delete a test user
 * @param userId - User ID to delete
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const adminClient = getAdminClient();

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete test user ${userId}: ${error.message}`);
  }
}

/**
 * Clean up all test data from tables
 */
export async function cleanupTestData(): Promise<void> {
  const adminClient = getAdminClient();

  // Delete in order to respect foreign key constraints
  await adminClient.from('serie_data').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('serie_validations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('serie_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
