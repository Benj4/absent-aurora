import { buildIndexZeroSeries } from '../../../lib/analysis-index-zero';
import { activeIndicator, buildMacroEventMarkers, filterByPeriod } from '../../../lib/analysis-chart';
import type { ChartInput } from './chart-input';
import { chartOptions } from './chart-options';
import HighchartsAdapter from './HighchartsAdapter';

export default function IndexZeroChart({ configuration, points, events }: ChartInput) {
  const state = { ...configuration, modoAlineacion: 'indice_cero' as const };
  const series = buildIndexZeroSeries(points, state);
  const selected = activeIndicator(state);
  const emptyPeriods = state.periodos.filter(p => !selected || !filterByPeriod(points, selected, p, state.sourceSelections).length);
  const options = chartOptions(series, buildMacroEventMarkers(events, state, state.markerModeByEventId, state.markerColorByEventId), {
    type: 'linear', allowDecimals: false, min: 0, crosshair: true,
    labels: { format: 'M{value}', style: { color: 'var(--color-base-content)' } },
    title: { text: 'Meses desde el inicio del período' },
  });
  return <>
    <p className="mb-2 text-xs text-base-content/70">Color de línea: período. M0 corresponde al mes de inicio del período; los valores originales no se normalizan. Base 100, si está activa, usa líneas discontinuas y el eje derecho.</p>
    {emptyPeriods.length > 0 && <p role="status" className="mb-3 text-sm">Sin datos utilizables del indicador seleccionado: {emptyPeriods.map(p => p.nombre).join(', ')}.</p>}
    <HighchartsAdapter options={options} hasSeries={series.length > 0} />
  </>;
}
