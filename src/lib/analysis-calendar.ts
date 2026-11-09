import type { AnalisisState, HCSeriesData, RawPoint } from './analysis-types';
import { prepareChartData, projectGroup } from './analysis-chart';

export function buildCalendarSeries(points: RawPoint[], state: AnalisisState): HCSeriesData[] {
  const groups = prepareChartData(points, state);
  return state.indicadores.flatMap(id => {
    const matching = groups.filter(group => group.indicatorId === id);
    const first = matching[0];
    if (!first) return [];
    const unique = new Map(matching.flatMap(group => group.points).map(point => [point.date, point]));
    const merged = { ...first, points: [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)) };
    const series = projectGroup(merged, date => new Date(date).getTime(), first.color, first.indicator);
    series.forEach(item => item.data.forEach(point => {
      point.custom.period = matching.filter(group => group.points.some(p => p.date === point.custom.date)).map(group => group.period.nombre).join(' · ');
    }));
    const overlayPoints = new Set<string>();
    // Calendar overlays retain each period's independent baseline; hide repeated legend items.
    if (state.showBase100Line) matching.forEach(group => {
      series.push(...projectGroup(group, date => new Date(date).getTime(), first.color,
        `Base 100 – ${first.indicator} – ${group.period.nombre}`, true).map(item => ({ ...item, showInLegend: false,
          data: item.data.filter(point => {
            const key = `${point.custom.date}:${point.y}`;
            if (overlayPoints.has(key)) return false;
            overlayPoints.add(key);
            return true;
          }),
        })).filter(item => item.data.length > 0));
    });
    return series;
  });
}
