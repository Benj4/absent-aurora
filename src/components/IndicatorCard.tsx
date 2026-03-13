import React from 'react';
import type { FC } from 'react';
import { normalizeFrequency } from '../lib/frequency';

export interface Indicator {
  id: string;
  slug?: string;
  label?: string;
  sectionId?: string;
  groupId?: string;
  dimensions?: Dimension[];
  unit?: Unit;
  nativeFrequency?: string;
  preferredChart?: PreferredChart;
  style?: {
    bento?: string;
    background?: string;
    [key: string]: any;
  };
  series?: Series;
}

export interface Unit {
  type?: string;
  symbol?: string;
  notes?: string;
}

export interface Dimension {
  id: string;
  label?: string;
  values?: string[];
}

export interface PreferredChart {
  type?: string;
}

type SeriesPoint = {
  year?: number | null;
  value?: number | null;
};

type Series = SeriesPoint[];

function sortedSeries(series: Series = []): Series {
  return [...series].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

function sparklinePath(series: Series = [], width = 160, height = 48, padding = 6) {
  if (!series || series.length === 0) return '';
  const vals = series.map((s) => s?.value ?? 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = (max - min) || 1;
  const step = (width - padding * 2) / (Math.max(vals.length - 1, 1));
  return vals
    .map((v, i) => {
      const x = padding + i * step;
      const y = padding + (1 - (v - min) / range) * (height - padding * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

const IndicatorCard: FC<{ ind: Indicator }> = ({ ind }) => {
  const series = sortedSeries(ind.series || []);
  const path = sparklinePath(series, 160, 48, 6);
  
  return (
    <article
      className="relative overflow-hidden transform-gpu will-change-transform border border-[rgba(0,0,0,0.06)] p-4 rounded-xl bg-linear-to-b from-[rgba(255,255,255,0.9)] to-(--astro-card-bg,#fff) shadow-[0_12px_30px_rgba(2,6,23,0.08),0_6px_12px_rgba(2,6,23,0.04)] hover:-translate-y-1 hover:scale-[1.01] transition-transform duration-200 ease-out hover:shadow-[0_18px_40px_rgba(2,6,23,0.12),0_8px_16px_rgba(2,6,23,0.06)] hover:ring-1 hover:ring-[rgba(70,95,255,0.08)]"
      data-bento={ind.style?.bento || '1x1'}
      aria-labelledby={`lbl-${ind.id}`}>
      <div className="flex justify-between items-center gap-2">
        <div>
          <div id={`lbl-${ind.id}`} className="font-semibold">{ind.label}</div>
          <div className="text-sm text-[#666]">{ind.unit?.symbol ?? ind.unit?.type ?? 'TBD'} · {ind.preferredChart?.type ?? 'chart'}</div>
        </div>
        <div className="text-sm text-[#666]">{ind.nativeFrequency ?? ''}</div>
      </div>

      {Array.isArray(ind.dimensions) && ind.dimensions.length > 0 ? (
        <div className="text-sm text-[#444] mt-1">Dimensions: {ind.dimensions.map(d => d.label ?? d.id).join(', ')}</div>
      ) : null}

      {series.length ? (
        <svg className="w-full h-12 block mt-2" viewBox="0 0 160 48" preserveAspectRatio="none" role="img" aria-label={`Sparkline for ${ind.label}`}>
          <path d={path} fill="none" stroke="var(--astro-accent, #2b6cb0)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <div className="text-[#888] mt-2">Sin informacion</div>
      )}

      {ind.unit?.notes ? <div className="text-sm text-[#666] mt-2">{ind.unit.notes}</div> : null}

      <div className="flex gap-3 mt-2">
        <a href={`/edit/${ind.id}`} className="text-blue-600 hover:text-blue-800 text-sm">Edit</a>
        <a
          href={`/series/${normalizeFrequency(ind.nativeFrequency ?? '')}/${ind.id}`}
          className="text-green-600 hover:text-green-800 text-sm"
        >
          + Add Series
        </a>
        <a href={`/indicators/${ind.id}/data`} className="text-purple-600 hover:text-purple-800 text-sm">View Data</a>
      </div>
    </article>
  );
};

export default IndicatorCard;
