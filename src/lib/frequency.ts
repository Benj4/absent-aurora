export type CanonicalFrequency = 'annual' | 'quarterly' | 'monthly' | 'daily';

/**
 * Resolves compound nativeFrequency values (e.g. "monthly_or_quarterly") to the
 * least-granular canonical frequency. Check order: annual > quarterly > monthly > daily.
 */
export function normalizeFrequency(nativeFrequency: string): CanonicalFrequency {
  const f = (nativeFrequency ?? '').toLowerCase();
  if (f.includes('annual')) return 'annual';
  if (f.includes('quarterly')) return 'quarterly';
  if (f.includes('monthly')) return 'monthly';
  if (f.includes('daily')) return 'daily';
  return 'annual';
}

/** Spanish hint shown above the data entry table. */
export function getDateHint(freq: CanonicalFrequency): string {
  switch (freq) {
    case 'annual':    return 'Usa el 1 de enero del año (ej. 2025-01-01)';
    case 'quarterly': return 'Primer día del trimestre (T1: 01-01, T2: 04-01, T3: 07-01, T4: 10-01)';
    case 'monthly':   return 'Primer día del mes (ej. 2025-03-01)';
    case 'daily':     return 'Cualquier fecha válida (YYYY-MM-DD)';
  }
}

/** Returns a Spanish error message if `date` is invalid for `freq`, or null if valid. */
export function validateDate(date: string, freq: CanonicalFrequency): string | null {
  if (!date) return 'La fecha es requerida.';
  const parts = date.split('-');
  if (parts.length !== 3) return 'Formato de fecha inválido (usa YYYY-MM-DD).';
  const [, mm, dd] = parts;

  switch (freq) {
    case 'annual':
      if (mm !== '01' || dd !== '01')
        return 'Para datos anuales, usa el 1 de enero (ej. 2025-01-01).';
      break;
    case 'quarterly':
      if (!['01', '04', '07', '10'].includes(mm) || dd !== '01')
        return 'Para datos trimestrales, usa el primer día del trimestre (ej. 2025-01-01, 2025-04-01, 2025-07-01, 2025-10-01).';
      break;
    case 'monthly':
      if (dd !== '01')
        return 'Para datos mensuales, usa el primer día del mes (ej. 2025-03-01).';
      break;
    case 'daily':
      break;
  }
  return null;
}
