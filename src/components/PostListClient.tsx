import { useEffect, useState } from 'react';
import PostListFilters from './PostListFilters';
import PostCard from './PostCard';
import { supabase } from '../lib/supabase';

type Filters = {
  status: string;
  q: string;
  sort: string;
  from: string;
  to: string;
};

export default function PostListClient({ initialPosts = [] as any[], initialFilters }: { initialPosts?: any[]; initialFilters?: Filters }) {
  const [posts, setPosts] = useState<any[]>(initialPosts || []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(f: Filters) {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('serie_posts')
        .select(`id, indicator_id, data_source, frequency, status, created_at, updated_at, serie_data(id, date, value)`)
        .limit(50);

      if (f.status && f.status !== 'all') q = q.eq('status', f.status);

      if (f.q && f.q.trim() !== '') {
        const term = `%${f.q.trim()}%`;
        // Search in indicator_id and data_source
        q = q.or(`indicator_id.ilike.${term},data_source.ilike.${term}`);
      }

      if (f.from) {
        q = q.gte('created_at', f.from);
      }
      if (f.to) {
        q = q.lte('created_at', f.to);
      }

      q = q.order('created_at', { ascending: f.sort === 'oldest' });

      const { data, error } = await q;
      if (error) {
        setError(error.message);
        setPosts([]);
      } else {
        setPosts(data || []);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }


  function handleSearch(f: Filters) {
    runSearch(f);
  }

  return (
    <div>
      <PostListFilters onSearch={handleSearch} />


      {loading && (
        <div className="text-sm text-gray-600">Cargando publicaciones...</div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">Error: {error}</div>
      )}

      {!loading && posts.length === 0 && (
        <p className="text-gray-500">No se encontraron publicaciones.</p>
      )}

      {!loading && posts.length > 0 && (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
