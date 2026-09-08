// shared types and constants for AnalysisBuilder
import type { Analysis } from '../../lib/supabase';

// UI choices are narrower than PostgreSQL text columns in the generated types.
type ModoAlineacion = 'calendario' | 'indice_cero';
type MarkerMode = 'none' | 'start' | 'end' | 'both';

interface Periodo {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  color: string;
}

interface AnalisisState {
  titulo: string;
  descripcion: string;
  status: Analysis['status'];
  modoAlineacion: ModoAlineacion;
  region: string;
  indicadores: string[];
  periodos: Periodo[];
  sourceSelections?: SourceSelection;
  macroEventIds: string[];
  markerModeByEventId?: Record<string, MarkerMode>;
  markerColorByEventId?: Record<string, string>;
  showBase100Line?: boolean;
}

type Action =
  | { type: 'SET_TITULO'; value: string }
  | { type: 'SET_DESCRIPCION'; value: string }
  | { type: 'SET_REGION'; value: string }
  | { type: 'SET_MODO'; value: ModoAlineacion }
  | { type: 'TOGGLE_INDICATOR'; id: string }
  | { type: 'ADD_PERIODO' }
  | { type: 'UPDATE_PERIODO'; id: string; field: keyof Periodo; value: string }
  | { type: 'REMOVE_PERIODO'; id: string }
  | { type: 'SET_SOURCE_SELECTION'; key: string; value: string }
  | { type: 'TOGGLE_MACRO_EVENT'; id: string }
  | { type: 'LOAD_STATE'; payload: AnalisisState };

interface RawPoint {
  indicator_id: string;
  date: string;
  value: number;
  data_source?: string;
  post_id?: string;
}

interface SourceSelection {
  [key: string]: string;
}

interface HCSeriesData {
  name: string;
  color: string;
  dashStyle: 'Solid' | 'ShortDash' | 'Dot' | 'DashDot';
  data: [number, number][];
  isReference?: boolean;
  yAxis?: number;
}

interface HCEventMarker {
  id: string;
  label: string;
  value: number;
  color: string;
}

// interface KPICell {
//   periodId: string;
//   periodNombre: string;
//   periodColor: string;
//   valor: number | null;
//   delta: number | null;
// }

// interface KPIRow {
//   indicadorId: string;
//   label: string;
//   cells: KPICell[];
// }

interface SourceConflict {
  indicatorId: string;
  date: string;
  sources: { id: string; label: string; points: RawPoint[] }[];
}

const PERIOD_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
const PERIOD_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_PERIODS = 6;
const MAX_INDICATORS = 5;

const ANALISIS_DRAFT_KEY = 'analysis-builder-draft:v1';

export type {
  MarkerMode,
  ModoAlineacion,
  Periodo,
  AnalisisState,
  Action,
  RawPoint,
  SourceSelection,
  HCSeriesData,
  HCEventMarker,
  // KPICell,
  // KPIRow,
  SourceConflict,
};

export {
  PERIOD_COLORS,
  PERIOD_LETTERS,
  MAX_PERIODS,
  MAX_INDICATORS,
  ANALISIS_DRAFT_KEY,
};
