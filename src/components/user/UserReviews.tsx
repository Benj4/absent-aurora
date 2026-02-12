import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';


export default function UserReviews() {
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const idFromUrl = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('userId');
    setUserId(idFromUrl);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('serie_validations')
        .select('id, post_id, validation_status, validation_notes, validated_at, serie_posts(id, indicator_id)')
        .eq('validated_by', userId)
        .order('validated_at', { ascending: false });

      if (!mounted) return;

      if (error) setError(error.message);
      else setReviews(data ?? []);

      setLoading(false);
    })();

    return () => { mounted = false };
  }, [userId]);

  if (loading) return <p>Cargando validaciones…</p>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Error: {error}</div>;
  if (!reviews || reviews.length === 0) return <p className="text-gray-600">No se encontraron validaciones realizadas por este usuario.</p>;

  return (
    <div className="space-y-4">
      <p className="text-gray-600">Total de validaciones: <strong>{reviews.length}</strong></p>
      <div className="space-y-3">
        {reviews.map((r) => (
          <article key={r.id} className="p-3 border rounded">
            <div className="flex justify-between">
              <div>
                <strong>Post:</strong> {r.post_id} {r.serie_posts?.indicator_id ? `• Indicador: ${r.serie_posts.indicator_id}` : ''}
              </div>
              <div className="text-sm text-gray-600">{new Date(r.validated_at).toLocaleString('es-ES')}</div>
            </div>

            <div className="mt-2 text-sm">
              <strong>Resultado:</strong> {r.validation_status}
              {r.validation_notes && <p className="mt-2 text-gray-700">Notas: {r.validation_notes}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
