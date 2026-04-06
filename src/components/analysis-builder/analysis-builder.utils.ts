import type {
  AnalisisState,
  Action,
  Periodo,
  RawPoint,
  SourceSelection,
  SourceConflict,
  ModoAlineacion,
  Transformacion,
  HCSeriesData,
  KPIRow,
  KPICell,
} from './analysis-builder.types';
import {
  PERIOD_COLORS,
  PERIOD_LETTERS,
  MAX_INDICATORS,
  MAX_PERIODS,
} from './analysis-builder.types';
import { INDICATOR_MAP } from './analysis-builder.data';

export function makeInitialState(): AnalisisState {
  return {
    titulo: '',
    descripcion: '',
    modoAlineacion: 'calendario',
    transformacion: 'nominal',
    region: '',
    indicadores: [],
    periodos: [
      {
        id: crypto.randomUUID(),
        nombre: 'Período A',
        fechaInicio: '',
        fechaFin: '',
        color: PERIOD_COLORS[0],
      },
    ],
    sourceSelections: {},
  };
}

export function isModoAlineacion(value: unknown): value is ModoAlineacion {
  return value === 'calendario' || value === 'indice_cero';
}

export function isTransformacion(value: unknown): value is Transformacion {
  return (
    value === 'nominal' ||
    value === 'variacion_interanual_pct' ||
    value === 'acumulado_pct' ||
    value === 'base_100'
  );
}

export function sanitizeState(input: unknown): AnalisisState | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<AnalisisState>;
  const fallback = makeInitialState();

  const periodos = Array.isArray(raw.periodos)
    ? raw.periodos
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const periodo = p as Partial<Periodo>;
        return {
          id: typeof periodo.id === 'string' && periodo.id.length > 0 ? periodo.id : crypto.randomUUID(),
          nombre: typeof periodo.nombre === 'string' ? periodo.nombre : 'Período',
          fechaInicio: typeof periodo.fechaInicio === 'string' ? periodo.fechaInicio : '',
          fechaFin: typeof periodo.fechaFin === 'string' ? periodo.fechaFin : '',
          color: typeof periodo.color === 'string' ? periodo.color : PERIOD_COLORS[0],
        };
      })
    : [];

  return {
    titulo: typeof raw.titulo === 'string' ? raw.titulo : '',
    descripcion: typeof raw.descripcion === 'string' ? raw.descripcion : '',
    modoAlineacion: isModoAlineacion(raw.modoAlineacion) ? raw.modoAlineacion : fallback.modoAlineacion,
    transformacion: isTransformacion(raw.transformacion) ? raw.transformacion : fallback.transformacion,
    region: typeof raw.region === 'string' ? raw.region : '',
    indicadores: Array.isArray(raw.indicadores)
      ? raw.indicadores.filter((id): id is string => typeof id === 'string')
      : [],
    periodos: periodos.length > 0 ? periodos : fallback.periodos,
    sourceSelections: typeof raw.sourceSelections === 'object' && raw.sourceSelections !== null
      ? (raw.sourceSelections as SourceSelection)
      : {},
  };
}

export function reducer(state: AnalisisState, action: Action): AnalisisState {
  switch (action.type) {
    case 'SET_TITULO': return { ...state, titulo: action.value };
    case 'SET_DESCRIPCION': return { ...state, descripcion: action.value };
    case 'SET_REGION': return { ...state, region: action.value };
    case 'SET_MODO': return { ...state, modoAlineacion: action.value };
    case 'SET_TRANSFORMACION': return { ...state, transformacion: action.value };

    case 'TOGGLE_INDICATOR':
      return {
        ...state,
        indicadores: state.indicadores.includes(action.id)
          ? state.indicadores.filter(id => id !== action.id)
          : state.indicadores.length < MAX_INDICATORS
            ? [...state.indicadores, action.id]
            : state.indicadores,
      };

    case 'ADD_PERIODO': {
      if (state.periodos.length >= MAX_PERIODS) return state;
      const idx = state.periodos.length;
      return {
        ...state,
        periodos: [
          ...state.periodos,
          {
            id: crypto.randomUUID(),
            nombre: `Período ${PERIOD_LETTERS[idx]}`,
            fechaInicio: '',
            fechaFin: '',
            color: PERIOD_COLORS[idx % PERIOD_COLORS.length],
          },
        ],
      };
    }

    case 'UPDATE_PERIODO':
      return {
        ...state,
        periodos: state.periodos.map(p =>
          p.id === action.id ? { ...p, [action.field]: action.value } : p
        ),
      };

    case 'REMOVE_PERIODO':
      if (state.periodos.length <= 1) return state;
      return { ...state, periodos: state.periodos.filter(p => p.id !== action.id) };

    case 'SET_SOURCE_SELECTION':
      return {
        ...state,
        sourceSelections: {
          ...(state.sourceSelections ?? {}),
          [action.key]: action.value,
        },
      };

    case 'LOAD_STATE':
      return action.payload;

    default:
      return state;
  }
}

export function applyTransformation(data: RawPoint[], t: Transformacion): RawPoint[] {
  if (data.length === 0) return [];
  switch (t) {
    case 'nominal': return data;
    case 'acumulado_pct': {
      const base = data[0].value;
      if (base === 0) return data;
      return data.map(d => ({ ...d, value: ((d.value - base) / Math.abs(base)) * 100 }));
    }
    case 'base_100': {
      const base = data[0].value;
      if (base === 0) return data;
      return data.map(d => ({ ...d, value: (d.value / base) * 100 }));
    }
    case 'variacion_interanual_pct':
      return data.slice(1).map((curr, i) => ({
        ...curr,
        value: data[i].value !== 0
          ? ((curr.value - data[i].value) / Math.abs(data[i].value)) * 100
          : 0,
      }));
  }
}

export function isPercent(t: Transformacion): boolean {
  return t !== 'nominal' && t !== 'base_100';
}

export function fmt(v: number, pct = false): string {
  const n = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);
  return pct ? `${n}%` : n;
}

export function getSourceKey(indicId: string, date: string): string {
  return `${indicId}:${date}`;
}

export function findSourceConflicts(data: RawPoint[]): SourceConflict[] {
  const grouped = new Map<string, Map<string, RawPoint[]>>();

  data.forEach(point => {
    const dateKey = `${point.indicator_id}:${point.date}`;
    if (!grouped.has(dateKey)) grouped.set(dateKey, new Map());
    const sourceId = point.post_id ?? point.data_source ?? '__unknown';
    const bucket = grouped.get(dateKey)!;
    if (!bucket.has(sourceId)) bucket.set(sourceId, []);
    bucket.get(sourceId)!.push(point);
  });

  const conflicts: SourceConflict[] = [];
  grouped.forEach((sourceMap, dateKey) => {
    if (sourceMap.size <= 1) return;
    const [indicId, date] = dateKey.split(':');
    conflicts.push({
      indicatorId: indicId,
      date,
      sources: Array.from(sourceMap.entries()).map(([id, points]) => ({
        id,
        label: points[0]?.data_source ?? 'Sin fuente',
        points,
      })),
    });
  });

  return conflicts.sort((a, b) => `${a.indicatorId}${a.date}`.localeCompare(`${b.indicatorId}${b.date}`));
}

export function resolveSources(data: RawPoint[], selections: SourceSelection): RawPoint[] {
  const filtered = new Map<string, RawPoint>();

  data.forEach(point => {
    const dateKey = getSourceKey(point.indicator_id, point.date);
    if (filtered.has(dateKey)) {
      const existing = filtered.get(dateKey)!;
      const selection = selections[dateKey];
      if (selection) {
        const pointId = point.post_id ?? `source:${point.data_source}`;
        const existingId = existing.post_id ?? `source:${existing.data_source}`;
        if (selection === pointId || selection === point.data_source) {
          filtered.set(dateKey, point);
        }
      }
    } else {
      filtered.set(dateKey, point);
    }
  });

  return Array.from(filtered.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function filterByPeriod(data: RawPoint[], indicId: string, periodo: Periodo, selections: SourceSelection = {}): RawPoint[] {
  if (!periodo.fechaInicio || !periodo.fechaFin) return [];
  const resolved = resolveSources(data, selections);
  return resolved
    .filter(d => d.indicator_id === indicId && d.date >= periodo.fechaInicio && d.date <= periodo.fechaFin)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildKPIRows(rawData: RawPoint[], state: AnalisisState): KPIRow[] {
  return state.indicadores.map(indicId => {
    const cells: KPICell[] = state.periodos.map(periodo => {
      const pts = applyTransformation(filterByPeriod(rawData, indicId, periodo, state.sourceSelections), state.transformacion);
      const values = pts.map(d => d.value);
      const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return { periodId: periodo.id, periodNombre: periodo.nombre, periodColor: periodo.color, valor: mean, delta: null };
    });

    const ref = cells.find(c => c.valor !== null);
    if (ref) {
      cells.forEach((cell, i) => {
        if (i === 0 || cell.valor === null || ref.valor === null || ref.valor === 0) return;
        cell.delta = ((cell.valor - ref.valor) / Math.abs(ref.valor)) * 100;
      });
    }

    return { indicadorId: indicId, label: INDICATOR_MAP.get(indicId) ?? indicId, cells };
  });
}

const DASH_STYLES: HCSeriesData['dashStyle'][] = ['Solid', 'ShortDash', 'Dot', 'DashDot'];

export function buildChartSeries(rawData: RawPoint[], state: AnalisisState): HCSeriesData[] {
  const series: HCSeriesData[] = [];

  state.periodos.forEach(periodo => {
    if (!periodo.fechaInicio || !periodo.fechaFin) return;
    state.indicadores.forEach((indicId, indicIdx) => {
      const pts = applyTransformation(filterByPeriod(rawData, indicId, periodo, state.sourceSelections), state.transformacion);
      const data: [number, number][] =
        state.modoAlineacion === 'calendario'
          ? pts.map(d => [new Date(d.date).getTime(), d.value])
          : pts.map((_, i) => [i, _.value]);

      if (data.length === 0) return;

      series.push({
        name: `${INDICATOR_MAP.get(indicId) ?? indicId} – ${periodo.nombre}`,
        color: periodo.color,
        dashStyle: DASH_STYLES[indicIdx % DASH_STYLES.length],
        data,
      });
    });
  });

  return series;
}

