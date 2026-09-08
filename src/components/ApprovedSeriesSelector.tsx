import { useEffect, useMemo, useState } from 'react';
import IndicatorChart, { type SeriesPoint } from './IndicatorChart';
import type { Tables } from '../lib/supabase';

type RawPoint = Pick<Tables<'approved_series_view'>, 'post_id' | 'data_source' | 'date' | 'value'>;

interface ApprovedSeriesSelectorProps {
  series?: RawPoint[];
  label?: string;
}

interface SourcePoint {
  key: string;
  date: string;
  source: string;
  value: number;
  rawValue: string | number;
}

function parseNumericValue(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Groups points by date across all approved entries. */
function groupByDate(points: RawPoint[]): { date: string; points: SourcePoint[] }[] {
  const grouped = new Map<string, SourcePoint[]>();

  points.forEach((point, index) => {
    if (point.date === null || point.value === null) return;
    const bucket = grouped.get(point.date) ?? [];
    const source = point.data_source ?? 'Sin fuente';
    bucket.push({
      key: `${point.date}-${point.post_id ?? 'no-post'}-${index}`,
      date: point.date,
      source,
      value: parseNumericValue(point.value),
      rawValue: point.value,
    });
    grouped.set(point.date, bucket);
  });

  return Array.from(grouped.entries())
    .map(([date, pts]) => ({ date, points: pts }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function ApprovedSeriesSelector({ series = [], label = 'Serie' }: ApprovedSeriesSelectorProps) {
  // Collect unique sources preserving first-seen order
  const sources = useMemo<string[]>(() => {
    const seen = new Set<string>();
    series.forEach((p) => {
      const src = p.data_source ?? 'Sin fuente';
      if (!seen.has(src)) seen.add(src);
    });
    return Array.from(seen);
  }, [series]);

  const [selectedSource, setSelectedSource] = useState<string>(() => sources[0] ?? '');

  useEffect(() => {
    if (!sources.length) {
      setSelectedSource('');
      return;
    }

    if (!sources.includes(selectedSource)) {
      setSelectedSource(sources[0]);
    }
  }, [sources, selectedSource]);

  // Keep all available dates visible, regardless of selected source.
  const groupedByDate = useMemo(() => groupByDate(series), [series]);

  const selectedPointByDate = useMemo<Record<string, SourcePoint>>(() => {
    return groupedByDate.reduce<Record<string, SourcePoint>>((acc, { date, points }) => {
      const point = points.find((p) => p.source === selectedSource) ?? points[0];
      if (point) {
        acc[date] = point;
      }
      return acc;
    }, {});
  }, [groupedByDate, selectedSource]);

  const resolvedSeries = useMemo<SeriesPoint[]>(() => {
    return groupedByDate.reduce<SeriesPoint[]>((acc, { date }) => {
      const point = selectedPointByDate[date];
      if (point) acc.push({ date, value: point.value });
      return acc;
    }, []);
  }, [groupedByDate, selectedPointByDate]);

  if (!series.length) return null;

  return (
    <section className="space-y-4">
      {/* Chart */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Gráfico (datos aprobados)</h2>
        <IndicatorChart series={resolvedSeries} label={label} />
      </div>

      {/* Data table */}
      <div className="rounded border border-base-200 overflow-hidden">
        <div className="px-4 py-3 bg-base-200/60 border-b border-base-200 space-y-2">
          <h3 className="text-base font-semibold m-0">Datos usados en el gráfico</h3>
          <div className="flex flex-col gap-1">
            <div role="tablist" className="tabs tabs-box w-fit flex-wrap">
              {sources.map((src) => (
                <button
                  key={src}
                  role="tab"
                  type="button"
                  className={`tab${selectedSource === src ? ' tab-active' : ''}`}
                  onClick={() => setSelectedSource(src)}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-base-200 text-base-content">
              <tr>
                <th className="text-left px-4 py-2">Fecha</th>
                {sources.map((source) => (
                  <th
                    key={source}
                    className={`text-left px-4 py-2${selectedSource === source ? ' bg-base-300/50' : ''}`}
                  >
                    {source}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedByDate.map(({ date, points }) => {
                return (
                  <tr key={date} className="border-t border-base-200">
                    <td className="px-4 py-2 whitespace-nowrap">{date}</td>
                    {sources.map((source) => {
                      const pointsFromSource = points.filter((p) => p.source === source);

                      return (
                        <td
                          key={`${date}-${source}`}
                          className={`px-4 py-2${selectedSource === source ? ' bg-base-300/20 font-semibold' : ''}`}
                        >
                          {pointsFromSource.length === 0 ? (
                            <span className="text-base-content/50">—</span>
                          ) : pointsFromSource.length === 1 ? (
                            <span className={selectedPointByDate[date]?.key === pointsFromSource[0].key ? 'font-bold' : ''}>
                              {pointsFromSource[0].rawValue}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {pointsFromSource.map((point) => (
                                <span key={point.key} className={selectedPointByDate[date]?.key === point.key ? 'font-bold' : ''}>
                                  {point.rawValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
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
