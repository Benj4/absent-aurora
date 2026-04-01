import { useState } from 'react';
import { supabase } from '../lib/supabase';
import IndicatorPostsClient from './IndicatorPostsClient';

interface IndicatorPostsLoaderProps {
  indicatorId: string;
}

export default function IndicatorPostsLoader({ indicatorId }: IndicatorPostsLoaderProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('serie_posts')
        .select(`
          id, indicator_id, data_source, url, frequency, status, created_at, updated_at,
          serie_data(id, date, value)
        `)
        .eq('indicator_id', indicatorId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setPosts(data ?? []);
      setLoaded(true);
    } catch (err: any) {
      console.error('Error cargando posts:', err);
      setError(err?.message || 'Error al cargar publicaciones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!loaded && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={loadPosts}
            disabled={loading}
          >
            {loading ? 'Cargando publicaciones...' : 'Mostrar series publicadas'}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {loaded && posts?.length === 0 && (
        <div role="alert" className="alert alert-info">
          <span>No hay publicaciones para este indicador.</span>
        </div>
      )}

      {loaded && posts?.length > 0 && <IndicatorPostsClient posts={posts} />}
    </div>
  );
}
