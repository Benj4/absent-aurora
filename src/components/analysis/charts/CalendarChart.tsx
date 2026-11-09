import Highcharts from 'highcharts';
import { buildCalendarSeries } from '../../../lib/analysis-calendar';
import { buildMacroEventMarkers } from '../../../lib/analysis-chart';
import type { ChartInput } from './chart-input';
import { chartOptions } from './chart-options';
import HighchartsAdapter from './HighchartsAdapter';

export default function CalendarChart({ configuration, points, events }: ChartInput) {
  const state = { ...configuration, modoAlineacion: 'calendario' as const };
  const series = buildCalendarSeries(points, state);
  const periods = state.periodos.filter(p => p.fechaInicio && p.fechaFin);
  const options = chartOptions(series, buildMacroEventMarkers(events, state, state.markerModeByEventId, state.markerColorByEventId), {
    type: 'datetime', crosshair: true,
    labels: { style: { color: 'var(--color-base-content)' } },
    plotBands: periods.map(p => ({
      from: new Date(p.fechaInicio).getTime(), to: new Date(p.fechaFin).getTime(),
      color: Highcharts.color(p.color).setOpacity(0.055).get(), zIndex: 0,
    })),
    plotLines: periods.flatMap(p => [p.fechaInicio, p.fechaFin].map(date => ({
      value: new Date(date).getTime(), color: p.color, width: 1, zIndex: 1,
    }))),
  });
  return <>
    <p className="mb-2 text-xs text-base-content/70">Líneas: indicadores. Fondos y límites continuos: períodos. Límites discontinuos: eventos macro. Base 100 usa líneas discontinuas y el eje derecho.</p>
    <ul className="mb-3 space-y-1 text-xs" aria-label="Períodos del calendario">
      {periods.map(p => <li key={p.id}><span style={{ borderLeft: `4px solid ${p.color}` }} className="pl-2">{p.nombre}: {p.fechaInicio} – {p.fechaFin}</span></li>)}
    </ul>
    {!series.length && <p role="status">No hay observaciones utilizables en los períodos configurados.</p>}
    <HighchartsAdapter options={options} hasSeries={series.length > 0} />
  </>;
}
