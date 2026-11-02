import { supabase } from './supabase';
import type { RawPoint, SourceSelection } from '../components/analysis-builder/analysis-builder.types';

/** Load only the original posts and observations recorded in the analysis. */
export async function loadSavedPoints(selections: SourceSelection): Promise<{ data: RawPoint[]; error: string | null }> {
  const ids = [...new Set(Object.values(selections))];
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await supabase.from('serie_posts')
    .select('id, indicator_id, data_source, status, serie_data(date, value)')
    .in('id', ids);
  if (error || !data) return { data: [], error: 'No se pudieron cargar las fuentes originales del análisis.' };
  const points: RawPoint[] = data.flatMap(post => post.serie_data.map(point => ({
    indicator_id: post.indicator_id, date: point.date, value: point.value,
    data_source: post.data_source, post_id: post.id, status: post.status,
  }))).filter(point => selections[`${point.indicator_id}:${point.date}`] === point.post_id);
  const found = new Set(points.map(point => `${point.indicator_id}:${point.date}`));
  return {
    data: points,
    error: Object.keys(selections).some(key => !found.has(key))
      ? 'No se pudieron recuperar algunos datos originales del análisis. Su estado de validez es desconocido.' : null,
  };
}
