import { withBase } from '../../lib/paths';
import type { buildDataRows } from '../../lib/analysis-chart';
import type { ModoAlineacion } from '../../lib/analysis-types';
import { sourceStatus } from '../../lib/analysis-validity';

export default function AnalysisSources({ rows, mode, layout = 'cards' }: { rows: ReturnType<typeof buildDataRows>; mode: ModoAlineacion; layout?: 'cards' | 'rows' }) {
  if (!rows.length) return null;
  const key = (row: typeof rows[number]) => JSON.stringify([row.indicator, row.postId, mode === 'indice_cero' ? row.period : '']);
  const sources = [...new Map(rows.map(row => [key(row), row])).values()];
  if (layout === 'rows') return <section aria-label="Datos y fuentes">
    <h2 className="text-base font-bold">Datos y fuentes</h2>
    <p className="mt-1 text-sm text-base-content/75">Referencias guardadas de los datos visibles. Consulta cada serie para revisar su procedencia.</p>
    <ul className="mt-4 divide-y divide-base-300">
      {sources.map(row => <li key={key(row)} className="py-3 first:pt-0 last:pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h3 className="flex items-baseline gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
              <span className="break-words">{row.indicator}</span>
            </h3>
            <p className="mt-1 break-words text-sm text-base-content/75">Fuente: {row.sourceName || 'No disponible'}{mode === 'indice_cero' ? ` · ${row.period}` : ''}</p>
            {row.status !== 'approved' && <p className="mt-1 text-sm font-semibold">Sin aprobación: {sourceStatus(row.status) || 'Estado desconocido'}</p>}
          </div>
          {row.postId && <a href={withBase(`/post?id=${encodeURIComponent(row.postId)}`)} className="link shrink-0 py-2 text-sm underline-offset-4" aria-label={`Consultar serie: ${row.indicator}, ${row.sourceName}`}>Consultar serie</a>}
        </div>
      </li>)}
    </ul>
  </section>;
  return <section aria-label="Datos y fuentes">
    <h2 className="mb-3 text-base font-bold">Datos y fuentes</h2>
    <p className="mb-2 text-xs text-base-content/70">{mode === 'calendario' ? 'Color: indicador.' : 'Color: período del indicador seleccionado.'}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map(row => <a key={key(row)} href={withBase(`/post?id=${encodeURIComponent(row.postId)}`)} className="card card-border flex-row overflow-hidden rounded-xl bg-base-100 transition-shadow hover:shadow-md">
        <span className="analysis-source-marker w-1.5 shrink-0" style={{ backgroundColor: row.color }} aria-hidden="true" />
        <div className="card-body min-w-0 gap-1 p-3">
          <h3 className="text-sm font-semibold break-words">{row.indicator}</h3>
          <p className="text-xs text-base-content/65">Fuente: {row.sourceName}</p>
          {mode === 'indice_cero' && <p className="text-xs">{row.period}</p>}
        </div>
      </a>)}
    </div>
  </section>;
}
