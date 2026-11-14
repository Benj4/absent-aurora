import type { AnalisisState, RawPoint } from '../../../lib/analysis-types';
import type { MacroEvent } from '../../../lib/macro-events';

export interface ChartInput {
  configuration: AnalisisState;
  points: RawPoint[];
  events: MacroEvent[];
}
