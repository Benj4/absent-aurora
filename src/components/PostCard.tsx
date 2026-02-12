import type { FC } from 'react';

// NOTE: Use local types compatible with server responses. Prefer importing from `src/lib/supabase` when possible.
interface SerieData {
  id?: number | string;
  date: string;
  value: number;
}

interface Post {
  id: number | string;
  indicator_id: string;
  data_source?: string;
  frequency: string;
  status: string;
  created_at: string;
  updated_at?: string;
  serie_data?: SerieData[];
}

interface Props {
  post: Post;
  maxDataPoints?: number;
  showLinks?: boolean;
}

const statusClass = (status: string) => {
  switch (status) {
    case 'approved':
      return 'bg-green-200 text-green-800';
    case 'pending':
      return 'bg-yellow-200 text-yellow-800';
    case 'rejected':
      return 'bg-red-200 text-red-800';
    case 'disabled':
      return 'bg-gray-200 text-gray-800';
    default:
      return 'bg-gray-200 text-gray-800';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'approved':
      return 'Aprobado';
    case 'pending':
      return 'Pendiente';
    case 'rejected':
      return 'Rechazado';
    case 'disabled':
      return 'Deshabilitado';
    default:
      return status;
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

const PostCard: FC<Props> = ({ post, maxDataPoints = 10, showLinks = true }) => {
  const serie = post.serie_data || [];
  const sorted = [...serie].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const slice = sorted.slice(0, maxDataPoints);

  return (
    <div className="border border-foreground/20 rounded-lg p-4 bg-foreground/5">
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold mb-0">Publicación #{post.id}</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusClass(post.status)}`}>
          {statusLabel(post.status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div><strong>Indicador:</strong> {post.indicator_id}</div>
        <div><strong>Frecuencia:</strong> {post.frequency}</div>
        <div><strong>Fuente:</strong> {post.data_source || 'N/A'}</div>
        <div><strong>Creado:</strong> {formatDate(post.created_at)}</div>
        {post.updated_at && (
          <div className="col-span-2"><strong>Actualizado:</strong> {formatDate(post.updated_at)}</div>
        )}
      </div>

      {serie.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Datos de serie ({serie.length} puntos)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">Fecha</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((data) => (
                  <tr key={data.id ?? `${data.date}-${data.value}`}>
                    <td className="border border-gray-300 px-4 py-2">{data.date}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{data.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {serie.length > maxDataPoints && (
              <p className="text-sm text-gray-600 mt-2 italic">Mostrando {maxDataPoints} de {serie.length} puntos (más recientes)</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 mt-3">
          <p className="text-gray-600 m-0">No hay datos de serie adjuntos a esta publicación.</p>
        </div>
      )}

      {showLinks && (
        <div className="flex gap-3 mt-4">
          <a href={`/post?id=${post.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Revisar y validar</a>
          {/* Future links kept as comments for reference */}
        </div>
      )}
    </div>
  );
};

export default PostCard;
