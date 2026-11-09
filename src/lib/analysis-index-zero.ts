import type { AnalisisState, HCSeriesData, RawPoint } from './analysis-types';
import { activeIndicator, monthDiff, prepareChartData, projectGroup } from './analysis-chart';

export function buildIndexZeroSeries(points: RawPoint[], state: AnalisisState): HCSeriesData[] {
  return prepareChartData(points, state).filter(group => group.indicatorId === activeIndicator(state)).flatMap(group => {
    const name = `${group.period.nombre} (${group.period.fechaInicio} – ${group.period.fechaFin})`;
    const project = (date: string) => monthDiff(group.period.fechaInicio, date);
    return [
      ...projectGroup(group, project, group.period.color, name, false, true),
      ...(state.showBase100Line ? projectGroup(group, project, group.period.color, `Base 100 – ${name}`, true, true) : []),
    ];
  });
}
