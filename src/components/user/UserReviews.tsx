import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { withBase } from '../../lib/paths';


export default function UserReviews() {
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const dateFormatter = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  useEffect(() => {
    const idFromUrl = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('userId');
    setUserId(idFromUrl);
  }, []);

  useEffect(() => {
    if (!userId) {
      setReviews([]);
      setLoading(false);
      return;
    }

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

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-base-content/70" aria-live="polite">
        <span className="loading loading-spinner loading-md" aria-hidden="true"></span>
        <p>Cargando revisiones…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="alert alert-warning" role="status" aria-live="polite">
        <span>No se detecto el usuario. Abra esta vista con el parametro userId en la URL.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" role="alert" aria-live="polite">
        <span>Error al cargar revisiones: {error}. Intente recargar la pagina.</span>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Sin Revisiones</h2>
          <p className="text-base-content/70">No se encontraron revisiones realizadas por este usuario.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* <div className="stats stats-vertical w-full border border-base-300 bg-base-100 shadow-sm sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">Total de revisiones</div>
          <div className="stat-value text-primary">{reviews.length}</div>
          <div className="stat-desc">Historial del usuario actual</div>
        </div>
      </div> */}

      <div className="space-y-3">
        {reviews.map((r) => (
          <article key={r.id} className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-3 p-4 md:p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                  <h3 className="card-title wrap-break-word text-base">Post: {String(r.post_id).slice(-8)}</h3>
                  {r.serie_posts?.indicator_id ? (
                    <p className="text-sm text-base-content/70">
                      Indicador:{' '}
                      <a
                        href={withBase(`/post?id=${r.post_id}`)}
                        className="link link-primary font-medium"
                        aria-label={`Abrir post ${r.post_id} del indicador ${r.serie_posts.indicator_id}`}
                      >
                        {r.serie_posts.indicator_id}
                      </a>
                    </p>
                  ) : null}
                </div>
                <span className={`badge badge-outline whitespace-nowrap ${r.validation_status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                  {r.validation_status === 'approved' ? 'Aprobado' : 'Rechazado'}
                </span>
              </div>

              <p className="text-sm text-base-content/70">
                Fecha: {r.validated_at ? dateFormatter.format(new Date(r.validated_at)) : 'Sin fecha'}
              </p>

              <div className="rounded-box bg-base-200/60 p-3 text-sm">
                {r.validation_notes ? (
                  <p className="mt-2 wrap-break-word text-base-content/80">
                    <span className="font-medium">Notas:</span> {r.validation_notes}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
