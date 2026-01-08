/**
 * Row Level Security (RLS) Policy Tests for serie_posts table
 * 
 * Tests the following policies (when uncommented in schema.sql):
 * - Anyone can view approved posts
 * - Users can view their own posts
 * - Users can insert their own posts
 * - Users can update their own posts (only to 'disabled')
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getAdminClient,
  getAnonClient,
  getAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  cleanupTestData,
} from '../utils/supabase-test-client';

describe('RLS Policies - serie_posts', () => {
  let user1Id: string;
  let user2Id: string;
  let user1Email: string;
  let user2Email: string;

  beforeAll(async () => {
    // Create test users
    user1Email = process.env.TEST_USER_1_EMAIL || 'testuser1@example.com';
    user2Email = process.env.TEST_USER_2_EMAIL || 'testuser2@example.com';
    const password = process.env.TEST_USER_1_PASSWORD || 'testpassword123';

    user1Id = await createTestUser(user1Email, password);
    user2Id = await createTestUser(user2Email, password);
  });

  afterAll(async () => {
    // Clean up test users
    await deleteTestUser(user1Id);
    await deleteTestUser(user2Id);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  describe('SELECT policies', () => {
    it('should allow anyone to view all posts', async () => {
      // Setup: Create an all post using admin client
      const adminClient = getAdminClient();
      const { data: insertedPost, error: insertError } = await adminClient
        .from('serie_posts')
        .insert({
          indicator_id: 'E01',
          submitted_by: user1Id,
          data_source: 'Test Source',
          frequency: 'monthly',
          status: 'pending',
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(insertedPost).toBeTruthy();

      // Test: Anonymous user should be able to view all post
      const anonClient = getAnonClient();
      const { data: anonData, error: anonError } = await anonClient
        .from('serie_posts')
        .select('*')
        .eq('id', insertedPost!.id)
        .single();

      expect(anonError).toBeNull();
      expect(anonData).toBeTruthy();
      expect(anonData?.status).toBe('pending');
    });

    // it('should NOT allow anyone to view pending posts unless they own them', async () => {
    //   // Setup: Create a pending post for user1
    //   const adminClient = getAdminClient();
    //   const { data: insertedPost, error: insertError } = await adminClient
    //     .from('serie_posts')
    //     .insert({
    //       indicator_id: 'E02',
    //       submitted_by: user1Id,
    //       data_source: 'Test Source',
    //       frequency: 'monthly',
    //       status: 'pending',
    //     })
    //     .select()
    //     .single();

    //   expect(insertError).toBeNull();

    //   // Test: Anonymous user should NOT see pending post
    //   const anonClient = getAnonClient();
    //   const { data: anonData, error: anonError } = await anonClient
    //     .from('serie_posts')
    //     .select('*')
    //     .eq('id', insertedPost!.id)
    //     .single();

    //   // Should either error or return null
    //   expect(anonData).toBeNull();
    // });

    // it('should allow users to view their own posts (any status)', async () => {
    //   // Setup: Create a pending post for user1
    //   const adminClient = getAdminClient();
    //   const { data: insertedPost, error: insertError } = await adminClient
    //     .from('serie_posts')
    //     .insert({
    //       indicator_id: 'E03',
    //       submitted_by: user1Id,
    //       data_source: 'Test Source',
    //       frequency: 'monthly',
    //       status: 'pending',
    //     })
    //     .select()
    //     .single();

    //   expect(insertError).toBeNull();

    //   // Test: User1 should be able to view their own pending post
    //   const user1Client = await getAuthenticatedClient(
    //     user1Email,
    //     process.env.TEST_USER_1_PASSWORD || 'testpassword123'
    //   );

    //   const { data: userData, error: userError } = await user1Client
    //     .from('serie_posts')
    //     .select('*')
    //     .eq('id', insertedPost!.id)
    //     .single();

    //   expect(userError).toBeNull();
    //   expect(userData).toBeTruthy();
    //   expect(userData?.submitted_by).toBe(user1Id);
    // });

    // it('should NOT allow users to view other users pending posts', async () => {
    //   // Setup: Create a pending post for user1
    //   const adminClient = getAdminClient();
    //   const { data: insertedPost, error: insertError } = await adminClient
    //     .from('serie_posts')
    //     .insert({
    //       indicator_id: 'E04',
    //       submitted_by: user1Id,
    //       data_source: 'Test Source',
    //       frequency: 'monthly',
    //       status: 'pending',
    //     })
    //     .select()
    //     .single();

    //   expect(insertError).toBeNull();

    //   // Test: User2 should NOT be able to view user1's pending post
    //   const user2Client = await getAuthenticatedClient(
    //     user2Email,
    //     process.env.TEST_USER_2_PASSWORD || 'testpassword123'
    //   );

    //   const { data: user2Data, error: user2Error } = await user2Client
    //     .from('serie_posts')
    //     .select('*')
    //     .eq('id', insertedPost!.id)
    //     .single();

    //   // Should either error or return null
    //   expect(user2Data).toBeNull();
    // });
  });

  describe('INSERT policies', () => {
    it('should allow authenticated users to insert their own posts', async () => {
      const user1Client = await getAuthenticatedClient(
        user1Email,
        process.env.TEST_USER_1_PASSWORD || 'testpassword123'
      );

      const { data, error } = await user1Client
        .from('serie_posts')
        .insert({
          indicator_id: 'E05',
          data_source: 'Test Source',
          frequency: 'annual',
          status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.submitted_by).toBe(user1Id);
    });

    it('should NOT allow anonymous users to insert posts', async () => {
      const anonClient = getAnonClient();

      const { data, error } = await anonClient
        .from('serie_posts')
        .insert({
          indicator_id: 'E06',
          submitted_by: user1Id,
          data_source: 'Test Source',
          frequency: 'monthly',
          status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeTruthy(); // Should have an error
      expect(data).toBeNull();
    });
  });

  describe('UPDATE policies', () => {
    it('should allow users to disable their own posts', async () => {
      // Setup: Create a post for user1
      const adminClient = getAdminClient();
      const { data: insertedPost, error: insertError } = await adminClient
        .from('serie_posts')
        .insert({
          indicator_id: 'E07',
          submitted_by: user1Id,
          data_source: 'Test Source',
          frequency: 'monthly',
          status: 'pending',
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Test: User1 should be able to disable their own post
      const user1Client = await getAuthenticatedClient(
        user1Email,
        process.env.TEST_USER_1_PASSWORD || 'testpassword123'
      );

      const { data: updatedPost, error: updateError } = await user1Client
        .from('serie_posts')
        .update({ status: 'disabled' })
        .eq('id', insertedPost!.id)
        .select()
        .single();

      console.log({updateError, updatedPost});

      expect(updateError).toBeNull();
      expect(updatedPost?.status).toBe('disabled');
    });

    it('should NOT allow users to update other users posts', async () => {
      // Setup: Create a post for user1
      const adminClient = getAdminClient();
      const { data: insertedPost, error: insertError } = await adminClient
        .from('serie_posts')
        .insert({
          indicator_id: 'E08',
          submitted_by: user1Id,
          data_source: 'Test Source',
          frequency: 'monthly',
          status: 'pending',
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Test: User2 should NOT be able to update user1's post
      const user2Client = await getAuthenticatedClient(
        user2Email,
        process.env.TEST_USER_2_PASSWORD || 'testpassword123'
      );

      const { data: updatedPost, error: updateError } = await user2Client
        .from('serie_posts')
        .update({ status: 'disabled' })
        .eq('id', insertedPost!.id)
        .select();

      console.log({updateError, updatedPost});

      // Should have an error or return empty array
      expect(updateError !== null || updatedPost?.length === 0).toBe(true);
    });

    // it('should NOT allow users to update posts to status other than disabled', async () => {
    //   // Setup: Create a post for user1
    //   const adminClient = getAdminClient();
    //   const { data: insertedPost, error: insertError } = await adminClient
    //     .from('serie_posts')
    //     .insert({
    //       indicator_id: 'E09',
    //       submitted_by: user1Id,
    //       data_source: 'Test Source',
    //       frequency: 'monthly',
    //       status: 'pending',
    //     })
    //     .select()
    //     .single();

    //   expect(insertError).toBeNull();

    //   // Test: User1 should NOT be able to change status to 'approved'
    //   const user1Client = await getAuthenticatedClient(
    //     user1Email,
    //     process.env.TEST_USER_1_PASSWORD || 'testpassword123'
    //   );

    //   const { data: updatedPost, error: updateError } = await user1Client
    //     .from('serie_posts')
    //     .update({ status: 'approved' })
    //     .eq('id', insertedPost!.id)
    //     .select();

    //   console.log({updateError, updatedPost});

    //   // Should have an error or return empty array
    //   expect(updateError !== null || updatedPost?.length === 0).toBe(true);
    // });

  });
});
