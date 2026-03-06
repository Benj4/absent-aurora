import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import PostCard from '../PostCard';
import AntdProvider from '../AntdProvider';

interface Props { userId: string }

export default function UserEdit({ userId }: Props) {
  const [posts, setPosts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('serie_posts')
        .select('id, indicator_id, data_source, frequency, status, created_at, updated_at')
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

  if (loading) return <p>Cargando publicaciones para editar…</p>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Error: {error}</div>;
  if (!posts || posts.length === 0) return <p className="text-gray-600">No hay publicaciones para editar.</p>;

  return (
    <AntdProvider>
      <div className="space-y-4">
        <p className="text-gray-600">Haz click en "Editar" para ir a la página de edición de la publicación.</p>
        <div className="grid gap-4">
          {posts.map((post) => (
            <div key={post.id} className="flex items-start gap-4">
              <div className="flex-1"><PostCard post={post} maxDataPoints={0} showLinks={false} /></div>
              <div className="shrink-0">
                <a className="inline-block px-3 py-2 bg-blue-600 text-white rounded" href={`/edit/${post.id}`}>Editar</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AntdProvider>
  );
}
