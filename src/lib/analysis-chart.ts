import type {
  AnalisisState,
  Action,
  Periodo,
  RawPoint,
  SourceSelection,
  SourceConflict,
  ModoAlineacion,
  HCSeriesData,
  HCEventMarker
} from './analysis-types';
import {
  PERIOD_COLORS,
  PERIOD_LETTERS,
  MAX_INDICATORS,
  MAX_PERIODS,
} from './analysis-types';
import { INDICATOR_MAP } from './analysis-indicators';

export function makeInitialState(): AnalisisState {
  return {
    titulo: '',
    descripcion: '',
    status: 'draft',
    modoAlineacion: 'calendario',
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
    macroEventIds: [],
    markerModeByEventId: {},
    markerColorByEventId: {},
    showBase100Line: false,
  };
}

export function isModoAlineacion(value: unknown): value is ModoAlineacion {
  return value === 'calendario' || value === 'indice_cero';
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
    status: typeof raw.status === 'string' && raw.status.length > 0 ? raw.status : fallback.status,
    modoAlineacion: isModoAlineacion(raw.modoAlineacion) ? raw.modoAlineacion : fallback.modoAlineacion,
    region: typeof raw.region === 'string' ? raw.region : '',
    indicadores: Array.isArray(raw.indicadores)
      ? raw.indicadores.filter((id): id is string => typeof id === 'string')
      : [],
    periodos: periodos.length > 0 ? periodos : fallback.periodos,
    sourceSelections: typeof raw.sourceSelections === 'object' && raw.sourceSelections !== null
      ? (raw.sourceSelections as SourceSelection)
      : {},
    macroEventIds: Array.isArray(raw.macroEventIds)
      ? raw.macroEventIds.filter((id): id is string => typeof id === 'string')
      : [],
    markerModeByEventId: typeof raw.markerModeByEventId === 'object' && raw.markerModeByEventId !== null
      ? Object.fromEntries(
        Object.entries(raw.markerModeByEventId).filter((entry): entry is [string, 'none' | 'start' | 'end' | 'both'] => {
          const [key, value] = entry;
          return typeof key === 'string' && (value === 'none' || value === 'start' || value === 'end' || value === 'both');
        })
      )
      : {},
    markerColorByEventId: typeof raw.markerColorByEventId === 'object' && raw.markerColorByEventId !== null
      ? Object.fromEntries(
        Object.entries(raw.markerColorByEventId).filter((entry): entry is [string, string] => {
          const [key, value] = entry;
          return typeof key === 'string' && typeof value === 'string';
        })
      )
      : {},
    showBase100Line: typeof raw.showBase100Line === 'boolean' ? raw.showBase100Line : false,
    indexZeroIndicatorId: typeof raw.indexZeroIndicatorId === 'string' ? raw.indexZeroIndicatorId : undefined,
    indicatorColors: raw.indicatorColors && typeof raw.indicatorColors === 'object'
      ? Object.fromEntries(Object.entries(raw.indicatorColors).filter(([, value]) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))) : {},
  };
}

export function reducer(state: AnalisisState, action: Action): AnalisisState {
  switch (action.type) {
    case 'SET_TITULO': return { ...state, titulo: action.value };
    case 'SET_DESCRIPCION': return { ...state, descripcion: action.value };
    case 'SET_REGION': return { ...state, region: action.value };
    case 'SET_MODO': return { ...state, modoAlineacion: action.value };

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

    case 'TOGGLE_MACRO_EVENT':
      return {
        ...state,
        macroEventIds: state.macroEventIds.includes(action.id)
          ? state.macroEventIds.filter(id => id !== action.id)
          : [...state.macroEventIds, action.id],
      };

    case 'LOAD_STATE':
      return action.payload;

    default:
      return state;
  }
}

export function applyBase100(data: RawPoint[]): RawPoint[] {
  if (data.length === 0) return [];
  const base = data[0].value;
  if (base === 0) return data;
  return data.map(d => ({ ...d, value: (d.value / base) * 100 }));
}

export function fmt(v: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);
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
    const selection = selections[dateKey];
    // An explicit reference must never fall back to another source.
    if (selection && selection !== point.post_id && selection !== point.data_source) return;
    if (!filtered.has(dateKey)) filtered.set(dateKey, point);
  });

  return Array.from(filtered.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Capture exactly the points displayed in the configured periods, including
// points for which the catalog currently offers only one source.
export function captureSourceSelections(data: RawPoint[], state: AnalisisState): SourceSelection {
  const selections: SourceSelection = {};
  for (const period of state.periodos) {
    for (const indicator of state.indicadores) {
      for (const point of filterByPeriod(data, indicator, period, state.sourceSelections)) {
        if (!point.post_id) throw new Error('No se pudo identificar la fuente de todos los datos.');
        selections[getSourceKey(indicator, point.date)] = point.post_id;
      }
    }
  }
  for (const key of Object.keys(state.sourceSelections ?? {})) {
    const separator = key.indexOf(':');
    const indicator = key.slice(0, separator);
    const date = key.slice(separator + 1);
    if (state.indicadores.includes(indicator)
      && state.periodos.some(period => date >= period.fechaInicio && date <= period.fechaFin)
      && !selections[key]) {
      throw new Error('No se pudo recuperar una fuente seleccionada.');
    }
  }
  return selections;
}

export function filterSavedPoints(data: RawPoint[], selections: SourceSelection): RawPoint[] {
  return data.filter(point => point.post_id != null && selections[getSourceKey(point.indicator_id, point.date)] === point.post_id);
}

export function filterByPeriod(data: RawPoint[], indicId: string, periodo: Periodo, selections: SourceSelection = {}): RawPoint[] {
  if (!periodo.fechaInicio || !periodo.fechaFin) return [];
  const resolved = resolveSources(data, selections);
  return resolved
    .filter(d => d.indicator_id === indicId && d.date >= periodo.fechaInicio && d.date <= periodo.fechaFin)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Resolve a removed or legacy selection without mutating configured indicators. */
export function activeIndicator(state: AnalisisState): string | undefined {
  return state.indicadores.includes(state.indexZeroIndicatorId ?? '')
    ? state.indexZeroIndicatorId : state.indicadores[0];
}

// An ID-derived default stays stable even when indicators are reordered or removed.
export function indicatorColor(id: string, colors: Record<string, string> = {}): string {
  if (colors[id]) return colors[id];
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const hue = (hash >>> 0) % 3600 / 10;
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return Math.round((0.44 - 0.31 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function assignIndicatorColors(state: AnalisisState): Record<string, string> {
  const colors = { ...state.indicatorColors };
  for (const id of [...state.indicadores].sort()) {
    if (colors[id]) continue;
    let candidate = indicatorColor(id);
    let attempt = 0;
    while (Object.values(colors).includes(candidate)) candidate = indicatorColor(`${id}:${++attempt}`);
    colors[id] = candidate;
  }
  return colors;
}

export interface DatedChartGroup {
  indicatorId: string;
  indicator: string;
  period: Periodo;
  points: RawPoint[];
  color: string;
}

export function prepareChartData(rawData: RawPoint[], state: AnalisisState): DatedChartGroup[] {
  return state.periodos.flatMap(period => state.indicadores.map(indicatorId => ({
    indicatorId, indicator: INDICATOR_MAP.get(indicatorId) ?? indicatorId, period,
    points: filterByPeriod(rawData, indicatorId, period, state.sourceSelections),
    color: indicatorColor(indicatorId, assignIndicatorColors(state)),
  })));
}

export function projectGroup(group: DatedChartGroup, project: (date: string) => number, color: string, name: string, reference = false, elapsed = false): HCSeriesData[] {
  const points = reference ? applyBase100(group.points) : group.points;
  if (!points.length) return [];
  const data = points.map(point => ({
    x: project(point.date), y: point.value,
    custom: { indicator: group.indicator, date: point.date, source: point.data_source ?? 'Sin fuente',
      period: group.period.nombre, ...(elapsed ? { elapsed: project(point.date) } : {}) },
  }));
  const result: HCSeriesData[] = [{ name, color, dashStyle: reference ? 'ShortDash' : 'Solid', data,
    isReference: reference, yAxis: reference ? 1 : 0 }];
  if (!reference) {
    const invalid = data.filter((_, i) => points[i].status != null && points[i].status !== 'approved');
    if (invalid.length) result.push({ name: `Datos sin aprobación – ${name}`, color, dashStyle: 'Solid', data: invalid, isInvalid: true, showInLegend: false });
  }
  return result;
}

export function buildDataRows(rawData: RawPoint[], state: AnalisisState) {
  const seen = new Set<string>();
  return prepareChartData(rawData, state)
    .filter(group => state.modoAlineacion === 'calendario' || group.indicatorId === activeIndicator(state))
    .flatMap(group => group.points.flatMap(point => {
      const key = `${group.indicatorId}:${point.date}:${point.post_id ?? point.data_source}`;
      if (state.modoAlineacion === 'calendario' && seen.has(key)) return [];
      seen.add(key);
      const periods = state.periodos.filter(p => point.date >= p.fechaInicio && point.date <= p.fechaFin);
      return [{ date: point.date, indicator: group.indicator,
        period: state.modoAlineacion === 'calendario' ? periods.map(p => p.nombre).join(' · ') : group.period.nombre,
        color: state.modoAlineacion === 'calendario' ? group.color : group.period.color,
        value: point.value, postId: point.post_id ?? '', sourceName: point.data_source ?? 'Fuente', status: point.status ?? 'approved' }];
    }));
}

// Calendar month offsets preserve missing observations and mixed frequencies.
export function monthDiff(startDate: string, targetDate: string): number {
  const start = new Date(startDate);
  const target = new Date(targetDate);

  return ((target.getUTCFullYear() - start.getUTCFullYear()) * 12)
    + (target.getUTCMonth() - start.getUTCMonth());
}

const MACRO_EVENT_COLORS = ['#0ea5e9', '#f43f5e', '#8b5cf6', '#14b8a6', '#f59e0b', '#22c55e', '#ef4444', '#6366f1'];

function markerColor(index: number): string {
  return PERIOD_COLORS[index % PERIOD_COLORS.length];
}

export function getDefaultMacroEventColor(eventId: string, fallbackIndex = 0): string {
  const hash = Array.from(eventId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return MACRO_EVENT_COLORS[(hash + fallbackIndex) % MACRO_EVENT_COLORS.length];
}

export function buildMacroEventMarkers(
  macroEvents: Array<{ id: string; name: string; start_date: string; end_date: string | null; status?: string }> ,
  state: AnalisisState,
  markerModeByEventId: Record<string, 'none' | 'start' | 'end' | 'both'> = {},
  markerColorByEventId: Record<string, string> = {},
): HCEventMarker[] {
  if (macroEvents.length === 0) return [];

  const markers: HCEventMarker[] = [];

  if (state.modoAlineacion === 'calendario') {
    macroEvents.forEach((event, eventIndex) => {
      const markerMode = markerModeByEventId[event.id] ?? 'both';
      const eventColor = markerColorByEventId[event.id] ?? getDefaultMacroEventColor(event.id, eventIndex);
      if (markerMode === 'none') return;

      if (markerMode === 'start' || markerMode === 'both') {
        markers.push({
          id: `${event.id}:start`,
          label: `${event.name}${event.status === 'invalid' ? ' ⚠ invalidado' : ''} · inicio`,
          value: new Date(event.start_date).getTime(),
          color: eventColor,
        });
      }

      if (
        (markerMode === 'end' || markerMode === 'both')
        && event.end_date
        && event.end_date !== event.start_date
      ) {
        markers.push({
          id: `${event.id}:end`,
          label: `${event.name}${event.status === 'invalid' ? ' ⚠ invalidado' : ''} · fin`,
          value: new Date(event.end_date).getTime(),
          color: eventColor,
        });
      }
    });

    return markers.sort((a, b) => a.value - b.value);
  }

  state.periodos.forEach((periodo, periodoIndex) => {
    if (!periodo.fechaInicio || !periodo.fechaFin) return;

    macroEvents.forEach((event, eventIndex) => {
      const markerMode = markerModeByEventId[event.id] ?? 'both';
      const eventColor = markerColorByEventId[event.id] ?? getDefaultMacroEventColor(event.id, eventIndex);
      if (markerMode === 'none') return;

      if (
        (markerMode === 'start' || markerMode === 'both')
        && event.start_date >= periodo.fechaInicio
        && event.start_date <= periodo.fechaFin
      ) {
        markers.push({
          id: `${periodo.id}:${event.id}:start`,
          label: `${event.name}${event.status === 'invalid' ? ' ⚠ invalidado' : ''} · ${periodo.nombre}`,
          value: monthDiff(periodo.fechaInicio, event.start_date),
          color: eventColor || periodo.color || markerColor(periodoIndex),
        });
      }

      if (
        (markerMode === 'end' || markerMode === 'both')
        &&
        event.end_date
        && event.end_date !== event.start_date
        && event.end_date >= periodo.fechaInicio
        && event.end_date <= periodo.fechaFin
      ) {
        markers.push({
          id: `${periodo.id}:${event.id}:end`,
          label: `${event.name}${event.status === 'invalid' ? ' ⚠ invalidado' : ''} · ${periodo.nombre} fin`,
          value: monthDiff(periodo.fechaInicio, event.end_date),
          color: eventColor || periodo.color || markerColor(periodoIndex),
        });
      }
    });
  });

  return markers.sort((a, b) => a.value - b.value);
}
