import type { FC } from 'react';
import type { SourceConflict, SourceSelection } from './analysis-builder.types';
import { getSourceKey } from './analysis-builder.utils';
import { INDICATOR_MAP } from './analysis-builder.data';
import { withBase } from '../../lib/paths';

const SourceConflictResolver: FC<{
  conflicts: SourceConflict[];
  selections: SourceSelection;
  onSelectSource: (key: string, sourceId: string) => void;
}> = ({ conflicts, selections, onSelectSource }) => {
  if (conflicts.length === 0) return null;

  const allSourceLabels = Array.from(
    new Map(conflicts.flatMap(c => c.sources.map(s => [s.id, s.label])))
      .entries()
  );

  const sourceIdToPostId = new Map<string, string>();
  conflicts.forEach(conflict => {
    conflict.sources.forEach(source => {
      if (sourceIdToPostId.has(source.id)) return;
      const postPoint = source.points.find(point => typeof point.post_id === 'string' && point.post_id.length > 0);
      if (postPoint) {
        sourceIdToPostId.set(source.id, postPoint.post_id!);
      }
    });
  });

  return (
    <details
      open
      aria-label="Resolución de conflictos de fuentes"
      className="group rounded-2xl border border-warning/30 bg-warning/5 overflow-hidden"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-2.5 border-b border-warning/20 text-left text-sm font-semibold text-base-content/80 hover:bg-warning/10 transition-colors list-none">
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-warning shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Múltiples fuentes ({conflicts.length} fechas)</span>
        </div>
        <span className="text-xs text-base-content/40">Selecciona una por fila</span>
      </summary>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-warning/20 bg-warning/5">
              <th className="text-left px-3 py-2 font-semibold text-base-content/50 whitespace-nowrap">
                Indicador / Fecha
              </th>
              {allSourceLabels.map(([id, label]) => {
                const postId = sourceIdToPostId.get(id);
                return (
                  <th
                    key={id}
                    className="text-center px-3 py-2 font-semibold whitespace-nowrap"
                  >
                    <div className="inline-flex items-center justify-center gap-2">
                      <button
                        type="button"
                        aria-label={`Seleccionar ${label} para todas las fechas`}
                        className="text-base-content/50 hover:text-primary transition-colors underline-offset-2 hover:underline cursor-pointer"
                        onClick={() => {
                          conflicts
                            .filter(c => c.sources.some(s => s.id === id))
                            .forEach(c => onSelectSource(getSourceKey(c.indicatorId, c.date), id));
                        }}
                      >
                        {label}
                      </button>
                      {postId && (
                        <a
                          href={withBase(`/post?id=${encodeURIComponent(postId)}`)}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`Abrir fuente ${label} en pestaña nueva`}
                          className="text-base-content/40 hover:text-base-content/80"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {conflicts.map((conflict, rowIdx) => {
              const key = getSourceKey(conflict.indicatorId, conflict.date);
              const selectedId = selections[key];
              const effectiveId = selectedId ?? conflict.sources[0]?.id;

              return (
                <tr
                  key={key}
                  className={`border-b border-base-200/60 last:border-b-0 ${rowIdx % 2 === 0 ? '' : 'bg-base-200/20'}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className="block font-medium text-base-content/60 truncate max-w-32"
                      title={INDICATOR_MAP.get(conflict.indicatorId) || conflict.indicatorId}
                    >
                      {INDICATOR_MAP.get(conflict.indicatorId) || conflict.indicatorId}
                    </span>
                    <span className="font-mono text-base-content/40">{conflict.date}</span>
                  </td>

                  {allSourceLabels.map(([sourceId]) => {
                    const source = conflict.sources.find(s => s.id === sourceId);
                    const isActive = effectiveId === sourceId;

                    if (!source) {
                      return (
                        <td key={sourceId} className="px-3 py-2 text-center text-base-content/20">
                          —
                        </td>
                      );
                    }

                    const displayValue = source.points.map(p => p.value).join(', ');

                    return (
                      <td key={sourceId} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          aria-pressed={isActive}
                          aria-label={`Usar ${source.label} para ${conflict.indicatorId} ${conflict.date}`}
                          className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono transition-colors w-full justify-center ${
                            isActive
                              ? 'bg-base-200 font-semibold'
                              : 'hover:bg-base-300 text-base-content/70'
                          }`}
                          onClick={() => onSelectSource(key, sourceId)}
                        >
                          {isActive && (
                            <svg aria-hidden="true" className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                            </svg>
                          )}
                          {displayValue}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default SourceConflictResolver;
