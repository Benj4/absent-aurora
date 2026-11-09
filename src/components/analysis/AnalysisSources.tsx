import { withBase } from '../../lib/paths';
import type { buildDataRows } from '../../lib/analysis-chart';
import type { ModoAlineacion } from '../../lib/analysis-types';

export default function AnalysisSources({ rows, mode }: { rows: ReturnType<typeof buildDataRows>; mode: ModoAlineacion }) {
  if (!rows.length) return null;
  const key = (row: typeof rows[number]) => JSON.stringify([row.indicator, row.postId, mode === 'indice_cero' ? row.period : '']);
  const sources = [...new Map(rows.map(row => [key(row), row])).values()];
  return <section aria-label="Datos y fuentes">
    <h2 className="mb-3 text-base font-bold">Datos y fuentes</h2>
    <p className="mb-2 text-xs text-base-content/70">{mode === 'calendario' ? 'Color: indicador.' : 'Color: período del indicador seleccionado.'}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map(row => <a key={key(row)} href={withBase(`/post?id=${encodeURIComponent(row.postId)}`)} className="card card-border flex-row overflow-hidden rounded-xl bg-base-100 transition-shadow hover:shadow-md">
        <span className="w-1.5 shrink-0" style={{ backgroundColor: row.color }} aria-hidden="true" />
        <div className="card-body min-w-0 gap-1 p-3">
          <h3 className="text-sm font-semibold break-words">{row.indicator}</h3>
          <p className="text-xs text-base-content/65">Fuente: {row.sourceName}</p>
          {mode === 'indice_cero' && <p className="text-xs">{row.period}</p>}
        </div>
      </a>)}
    </div>
  </section>;
}
