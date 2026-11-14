import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/supabase';
import ApprovedSeriesSelector from './ApprovedSeriesSelector';

type Point = Pick<Tables<'approved_series_view'>, 'post_id' | 'data_source' | 'date' | 'value'>;

export default function ApprovedSeriesLoader({ indicatorId, label }: { indicatorId: string; label?: string }) {
  const [series, setSeries] = useState<Point[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    setError(false);
    void (async () => {
      const result = await supabase.from('approved_series_view')
        .select('post_id, data_source, date, value')
        .eq('indicator_id', indicatorId).order('date', { ascending: true });
      if (cancelled) return;
      if (result.error) setError(true);
      else setSeries(result.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [indicatorId]);

  if (error) return <div role="alert" className="alert alert-error">No se pudieron cargar los datos aprobados.</div>;
  if (!series) return <p>Cargando datos aprobados…</p>;
  if (!series.length) return <div role="alert" className="alert alert-warning">No hay datos aprobados para graficar esta serie.</div>;
  return <ApprovedSeriesSelector series={series} label={label} />;
}
