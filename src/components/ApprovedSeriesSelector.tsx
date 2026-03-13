import { useMemo, useState } from 'react';
import IndicatorChart, { type SeriesPoint } from './IndicatorChart';

interface ApprovedSeriesSelectorProps {
  series?: SeriesPoint[];
  label?: string;
}

interface GroupedPoint {
  key: string;
  date: string;
  value: number;
  rawValue: string | number;
}

function parseNumericValue(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ApprovedSeriesSelector({ series = [], label = 'Serie' }: ApprovedSeriesSelectorProps) {
  const groupedByDate = useMemo(() => {
    const grouped = new Map<string, GroupedPoint[]>();

    series.forEach((point, index) => {
      const bucket = grouped.get(point.date) ?? [];
      bucket.push({
        key: `${point.date}-${index}`,
        date: point.date,
        value: parseNumericValue(point.value),
        rawValue: point.value,
      });
      grouped.set(point.date, bucket);
    });

    return Array.from(grouped.entries())
      .map(([date, points]) => ({ date, points }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [series]);

  const [selectedPointByDate, setSelectedPointByDate] = useState<Record<string, string>>(() => {
    const initialSelection: Record<string, string> = {};
    groupedByDate.forEach(({ date, points }) => {
      if (points.length > 0) {
        initialSelection[date] = points[0].key;
      }
    });
    return initialSelection;
  });

  const resolvedSeries = useMemo<SeriesPoint[]>(() => {
    return groupedByDate.reduce<SeriesPoint[]>((accumulator, { date, points }) => {
      const selectedKey = selectedPointByDate[date] ?? points[0]?.key;
      const selectedPoint = points.find((point) => point.key === selectedKey) ?? points[0];

      if (selectedPoint) {
        accumulator.push({
          date,
          value: selectedPoint.value,
        });
      }

      return accumulator;
    }, []);
  }, [groupedByDate, selectedPointByDate]);

  const conflictDatesCount = groupedByDate.filter(({ points }) => {
    const distinctValues = new Set(points.map((point) => point.value));
    return distinctValues.size > 1;
  }).length;

  if (!series.length) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Grafico (datos aprobados)</h2>
        <IndicatorChart series={resolvedSeries} label={label} />
      </div>

      <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold m-0">Datos usados en el grafico</h3>
          {conflictDatesCount > 0 && (
            <>
              <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
                Selecciona manualmente el valor por fecha cuando existan duplicados con valores distintos.
              </p>
              <p className="m-0 mt-1 text-xs text-amber-700 dark:text-amber-300">
                Fechas con conflicto de valores: {conflictDatesCount}
              </p>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <tr>
                <th className="text-left px-4 py-2">Fecha</th>
                <th className="text-left px-4 py-2">Valor a graficar</th>
                <th className="text-left px-4 py-2">Opciones encontradas</th>
              </tr>
            </thead>
            <tbody>
              {groupedByDate.map(({ date, points }) => {
                const distinctValues = Array.from(new Set(points.map((point) => point.value)));
                const hasConflict = distinctValues.length > 1;
                const selectedKey = selectedPointByDate[date] ?? points[0]?.key;
                const selectedPoint = points.find((point) => point.key === selectedKey) ?? points[0];

                return (
                  <tr key={date} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-2 whitespace-nowrap">{date}</td>
                    <td className="px-4 py-2 font-semibold">{selectedPoint?.rawValue ?? '-'}</td>
                    <td className="px-4 py-2">
                      {hasConflict ? (
                        <div className="flex flex-wrap gap-3">
                          {points.map((point) => (
                            <label key={point.key} className="inline-flex items-center gap-1">
                              <input
                                type="radio"
                                name={`date-${date}`}
                                value={point.key}
                                checked={selectedKey === point.key}
                                onChange={() =>
                                  setSelectedPointByDate((prev) => ({
                                    ...prev,
                                    [date]: point.key,
                                  }))
                                }
                              />
                              <span>{point.rawValue}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">{points[0]?.rawValue}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}