// shared types and constants for AnalysisBuilder

type Transformacion = 'nominal' | 'variacion_interanual_pct' | 'acumulado_pct' | 'base_100';
type ModoAlineacion = 'calendario' | 'indice_cero';

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
  modoAlineacion: ModoAlineacion;
  transformacion: Transformacion;
  region: string;
  indicadores: string[];
  periodos: Periodo[];
  sourceSelections?: SourceSelection;
}

type Action =
  | { type: 'SET_TITULO'; value: string }
  | { type: 'SET_DESCRIPCION'; value: string }
  | { type: 'SET_REGION'; value: string }
  | { type: 'SET_MODO'; value: ModoAlineacion }
  | { type: 'SET_TRANSFORMACION'; value: Transformacion }
  | { type: 'TOGGLE_INDICATOR'; id: string }
  | { type: 'ADD_PERIODO' }
  | { type: 'UPDATE_PERIODO'; id: string; field: keyof Periodo; value: string }
  | { type: 'REMOVE_PERIODO'; id: string }
  | { type: 'SET_SOURCE_SELECTION'; key: string; value: string }
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
}

interface KPICell {
  periodId: string;
  periodNombre: string;
  periodColor: string;
  valor: number | null;
  delta: number | null;
}

interface KPIRow {
  indicadorId: string;
  label: string;
  cells: KPICell[];
}

interface SourceConflict {
  indicatorId: string;
  date: string;
  sources: { id: string; label: string; points: RawPoint[] }[];
}

const PERIOD_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
const PERIOD_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_PERIODS = 6;
const MAX_INDICATORS = 5;

const TRANSFORMACIONES: { value: Transformacion; label: string; hint: string }[] = [
  { value: 'nominal', label: 'Nominal', hint: 'Valores originales sin transformar.' },
  { value: 'variacion_interanual_pct', label: 'Variación interanual (%)', hint: 'Cambio respecto al período anterior.' },
  { value: 'acumulado_pct', label: 'Variación acumulada (%)', hint: 'Cambio total desde el inicio del período.' },
  { value: 'base_100', label: 'Índice base 100', hint: 'Primera observación = 100, resto proporcional.' },
];

const ANALISIS_DRAFT_KEY = 'analysis-builder-draft:v1';

export type {
  Transformacion,
  ModoAlineacion,
  Periodo,
  AnalisisState,
  Action,
  RawPoint,
  SourceSelection,
  HCSeriesData,
  KPICell,
  KPIRow,
  SourceConflict,
};

export {
  PERIOD_COLORS,
  PERIOD_LETTERS,
  MAX_PERIODS,
  MAX_INDICATORS,
  TRANSFORMACIONES,
  ANALISIS_DRAFT_KEY,
};
