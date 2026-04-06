import type { FC } from 'react';
import type { KPICell } from './analysis-builder.types';

const fmt = (v: number, pct = false): string => {
  const n = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);
  return pct ? `${n}%` : n;
};

const KPICard: FC<{ label: string; periodNombre: string; periodColor: string; valor: number | null; delta: number | null; pct: boolean }> = ({ label, periodNombre, periodColor, valor, delta, pct }) => (
  <div className="rounded-box border border-base-200 bg-base-100 p-3.5 space-y-1.5 flex flex-col">
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: periodColor }}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold text-base-content/50 truncate">{periodNombre}</span>
    </div>
    <p className="text-xs text-base-content/40 truncate leading-snug" title={label}>{label}</p>
    {valor !== null ? (
      <p
        className="text-2xl font-bold leading-none mt-auto pt-1"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {fmt(valor, pct)}
      </p>
    ) : (
      <p className="text-sm text-base-content/25 italic mt-auto">Sin datos</p>
    )}
    {delta !== null && (
      <p
        className={`text-xs font-bold ${delta >= 0 ? 'text-success' : 'text-error'}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta), true)} vs. A
      </p>
    )}
  </div>
);

export default KPICard;
