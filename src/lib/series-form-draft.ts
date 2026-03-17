interface DataRowDraft {
  date: string;
  value: string;
}

export interface SeriesFormDraft {
  dataSource: string;
  sourceUrl: string;
  notes: string;
  rows: DataRowDraft[];
}

export const getSeriesFormDraftKey = (indicatorId: string, canonicalFreq: string): string => {
  return `series-form-draft:${indicatorId}:${canonicalFreq}`;
};

export const loadSeriesFormDraft = (key: string): SeriesFormDraft | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SeriesFormDraft>;
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows
        .filter((row) => row && typeof row.date === 'string' && typeof row.value === 'string')
        .map((row) => ({ date: row.date, value: row.value }))
      : [];

    return {
      dataSource: typeof parsed.dataSource === 'string' ? parsed.dataSource : '',
      sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      rows,
    };
  } catch {
    return null;
  }
};

export const saveSeriesFormDraft = (key: string, draft: SeriesFormDraft): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Ignore storage errors (quota/private mode).
  }
};

export const clearSeriesFormDraft = (key: string): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
};
