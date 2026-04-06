import indicatorsRaw from '../../data/indicators.json';

export interface IndicatorEntry { id: string; label: string; sectionId?: string }

export const ALL_INDICATORS: IndicatorEntry[] = (indicatorsRaw as any).indicators.map((ind: any) => ({
  id: ind.id as string,
  label: ind.label as string,
  sectionId: ind.sectionId,
}));

export const INDICATOR_MAP = new Map<string, string>(ALL_INDICATORS.map(i => [i.id, i.label]));
