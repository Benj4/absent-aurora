import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import PostCard from '../PostCard';


const UserPosts = () => {
  const [posts, setPosts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const idFromUrl = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('userId');
    setUserId(idFromUrl);
  }, []);

  useEffect(() => {

    if (!userId) {
      return;
    }

    let mounted = true;
    (async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('serie_posts')
        .select('id, indicator_id, data_source, url, frequency, status, created_at, updated_at, serie_data(id, date, value)')
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false });

      if (!mounted) return;

      if (error) {
        setError(error.message);
      } else {
        setPosts(data ?? []);
      }

      setLoading(false);
    })();

    return () => { mounted = false };
  }, [userId]);

  if (loading) return <p>Cargando publicaciones…</p>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Error: {error}</div>;
  if (!posts || posts.length === 0) return <p className="text-gray-600">No se encontraron publicaciones para este usuario.</p>;

  return (
    <div className="space-y-6">
      <p className="text-gray-600">Total: <strong>{posts.length}</strong></p>
      <div className="grid gap-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

export default UserPosts;