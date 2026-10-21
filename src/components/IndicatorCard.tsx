import React from 'react';
import type { FC } from 'react';
import { normalizeFrequency } from '../lib/frequency';
import { withBase } from '../lib/paths';

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
      className="card border border-base-300 bg-base-100 p-4 shadow-sm transition-shadow hover:shadow-md"
      data-bento={ind.style?.bento || '1x1'}
      aria-labelledby={`lbl-${ind.id}`}>
      <div className="flex justify-between items-center gap-2">
        <div>
          <div id={`lbl-${ind.id}`} className="font-semibold">{ind.label}</div>
          <div className="text-sm text-base-content/70">{ind.unit?.symbol ?? ind.unit?.type ?? 'Sin unidad'} · {ind.preferredChart?.type ?? 'gráfico'}</div>
        </div>
        <div className="text-sm text-base-content/70">{ind.nativeFrequency ?? ''}</div>
      </div>

      {Array.isArray(ind.dimensions) && ind.dimensions.length > 0 ? (
        <div className="text-sm text-base-content/80 mt-1">Dimensiones: {ind.dimensions.map(d => d.label ?? d.id).join(', ')}</div>
      ) : null}

      {series.length ? (
        <svg className="w-full h-12 block mt-2" viewBox="0 0 160 48" preserveAspectRatio="none" role="img" aria-label={`Tendencia de ${ind.label}`}>
          <path d={path} fill="none" className="text-primary" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <div className="text-base-content/60 mt-2">Sin información</div>
      )}

      {ind.unit?.notes ? <div className="text-sm text-base-content/70 mt-2">{ind.unit.notes}</div> : null}

      <div className="flex flex-wrap gap-3 mt-2">
        <a href={withBase(`/edit/${ind.id}`)} className="link link-primary text-sm">Editar</a>
        <a
          href={withBase(`/series/${normalizeFrequency(ind.nativeFrequency ?? '')}/${ind.id}`)}
          className="link link-primary text-sm"
        >
          + Añadir serie
        </a>
        <a href={withBase(`/indicators/${ind.id}/data`)} className="link link-primary text-sm">Ver datos</a>
      </div>
    </article>
  );
};

export default IndicatorCard;
