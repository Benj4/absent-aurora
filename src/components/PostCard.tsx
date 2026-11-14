import type { FC } from 'react';
import { withBase } from '../lib/paths';
import indicatorsNames from '../data/names.json';
import type { SeriePost, SerieDataPoint } from '../lib/supabase';

/** Projection of SerieDataPoint used for the nested join result (post_id excluded). */
type SerieData = Pick<SerieDataPoint, 'id' | 'date' | 'value'>;

/**
 * Display-oriented subset of SeriePost with an optional nested serie_data join.
 * Fields mirror SeriePost field types to stay anchored to the canonical schema;
 * data_source and updated_at are optional because this component is also used
 * in list contexts where those fields may not be selected.
 */
interface Post {
  id: SeriePost['id'];
  indicator_id: SeriePost['indicator_id'];
  data_source?: SeriePost['data_source'];
  url?: SeriePost['url'];
  frequency: SeriePost['frequency'];
  status: SeriePost['status'];
  created_at: SeriePost['created_at'];
  updated_at?: SeriePost['updated_at'];
  serie_data?: SerieData[];
}

interface Props {
  post: Post;
  maxDataPoints?: number;
  showLinks?: boolean;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved': return 'badge-success';
    case 'pending': return 'badge-warning';
    case 'rejected': return 'badge-error';
    case 'disabled': return 'badge-ghost';
    default: return 'badge-neutral';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'approved': return 'Aprobado';
    case 'pending': return 'Pendiente';
    case 'rejected': return 'Rechazado';
    case 'disabled': return 'Deshabilitado';
    default: return status;
  }
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('es-ES')} a las ${d.toLocaleTimeString('es-ES')}`;
  } catch (e) {
    return iso;
  }
};

const formatSeriesDate = (raw: string, frequency: string) => {
  if (!raw) return raw;
  if (frequency === 'annual') return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-ES');
};

const formatValue = (value: number) => {
  if (!Number.isFinite(value)) return String(value);
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(value);
};

const PostCard: FC<Props> = ({ post, maxDataPoints = 10, showLinks = true }) => {
  const serie = post.serie_data || [];
  const sorted = [...serie].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const slice = sorted.slice(0, maxDataPoints);
  const shouldShowSerie = maxDataPoints > 0;
  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];

  const tableData = slice.map((data, index) => {
    const previous = slice[index + 1];
    const variation = previous ? data.value - previous.value : null;
    return {
      rank: index + 1,
      key: String(data.id ?? `${data.date}-${data.value}`),
      date: formatSeriesDate(data.date, post.frequency),
      rawDate: data.date,
      value: formatValue(data.value),
      rawValue: data.value,
      variation,
    };
  });

  //@ts-ignore
  const indicadorInfo = indicatorsNames[post.indicator_id];

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm w-full">
      <div className="card-body gap-3 p-4">
        {/* Card header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="card-title text-base">
              {post.indicator_id} {' - '}
              {indicadorInfo?.label}
              <p className="text-sm font-light text-base-content/60">#{String(post.id).slice(-8)}</p>
            </h2>
            
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* <span className="badge badge-neutral badge-sm">{post.frequency}</span> */}
            <span className={`badge badge-sm ${statusBadge(post.status)}`}>{statusLabel(post.status)}</span>
          </div>
        </div>

        {/* Metadata */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
          <div><dt className="text-base-content/60 inline">Fuente: </dt><dd className="inline">{post.data_source || 'N/A'}</dd></div>
          {post.url && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-base-content/60 inline">URL fuente: </dt>
              <dd className="inline break-all">
                <a className="link link-primary" href={post.url} target="_blank" rel="noopener noreferrer">{post.url}</a>
              </dd>
            </div>
          )}
          {/* <div><dt className="text-base-content/60 inline">Frecuencia: </dt><dd className="inline">{post.frequency}</dd></div> */}
          <div><dt className="text-base-content/60 inline">Creado: </dt><dd className="inline">{formatDate(post.created_at)}</dd></div>
        </dl>

        {/* Series data table */}
        {shouldShowSerie && serie.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-4 text-sm mb-2">
              <span className="font-semibold">Puntos: {serie.length}</span>
              {oldest && (
                <span className="text-base-content/60">
                  Desde {formatSeriesDate(oldest.date, post.frequency)}
                </span>
              )}
              {latest && (
                <span className="text-base-content/60">
                  hasta {formatSeriesDate(latest.date, post.frequency)} ({formatValue(latest.value)})
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="table table-xs w-full">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Periodo</th>
                    <th>Valor reportado</th>
                    <th>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row) => {
                    const varIsPositive = row.variation !== null && row.variation > 0;
                    const varIsNegative = row.variation !== null && row.variation < 0;
                    return (
                      <tr key={row.key}>
                        <td className="text-center text-base-content/50">{row.rank}</td>
                        <td>{row.date}</td>
                        <td className="font-semibold">{row.value}</td>
                        <td className={`${varIsPositive ? 'text-success' : varIsNegative ? 'text-error' : 'text-base-content/50'}`}>
                          {row.variation === null
                            ? '-'
                            : row.variation === 0
                              ? '0'
                              : `${varIsPositive ? '+' : ''}${formatValue(row.variation)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {serie.length > maxDataPoints && (
              <p className="text-sm text-base-content/60 italic mt-1">
                Mostrando {maxDataPoints} de {serie.length} puntos (más recientes)
              </p>
            )}
          </div>
        )}

        {shouldShowSerie && serie.length === 0 && (
          <div className="py-4 text-center text-base-content/50 text-sm">
            No hay datos de serie adjuntos a esta publicación.
          </div>
        )}

        {showLinks && (
          <div className="card-actions mt-1">
            <a href={withBase(`/post?id=${post.id}`)} className="btn btn-link btn-sm px-0">
              Revisar y validar →
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostCard;
