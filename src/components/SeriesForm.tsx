import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeFrequency, getDateHint, validateDate } from '../lib/frequency';
import { getDomainFromUrl, isValidHttpUrl } from '../lib/url-title';
import { withBase } from '../lib/paths';
import {
  clearSeriesFormDraft,
  getSeriesFormDraftKey,
  loadSeriesFormDraft,
  saveSeriesFormDraft,
} from '../lib/series-form-draft';
import { useAuthSession } from '../lib/use-auth-session';

interface Indicator {
  id: string;
  label: string;
  nativeFrequency: string;
  unit?: {
    symbol?: string;
    type?: string;
  };
}

interface DataRow {
  date: string;
  value: string;
}

interface Props {
  indicator: Indicator;
}

type StatusType = 'idle' | 'loading' | 'success' | 'error';

const INITIAL_ROWS: DataRow[] = [
  { date: '', value: '' },
  { date: '', value: '' },
  { date: '', value: '' },
  { date: '', value: '' },
];

const MIN_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, index) => String(CURRENT_YEAR - index));
const MONTH_OPTIONS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const SeriesForm: FC<Props> = ({ indicator }) => {
  const [dataSource, setDataSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DataRow[]>(INITIAL_ROWS);
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const { user, ready: isAuthReady } = useAuthSession();
  const isAuthenticated = Boolean(user);

  const canonicalFreq = normalizeFrequency(indicator.nativeFrequency ?? '');
  const dateHint = getDateHint(canonicalFreq);

  const addRow = () => {
    setRows([...rows, { date: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index: number, field: 'date' | 'value', value: string) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  /** Convert native HTML input value to ISO date string YYYY-MM-DD */
  const updateDateRow = (index: number, rawInputValue: string) => {
    const updated = [...rows];
    if (!rawInputValue) {
      updated[index].date = '';
    } else {
      switch (canonicalFreq) {
        case 'annual': {
          const year = parseInt(rawInputValue, 10);
          updated[index].date = isNaN(year) ? '' : `${year}-01-01`;
          break;
        }
        case 'quarterly': {
          const [y, m] = rawInputValue.split('-').map(Number);
          const quarterStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
          updated[index].date = `${y}-${String(quarterStartMonth).padStart(2, '0')}-01`;
          break;
        }
        case 'monthly':
          updated[index].date = `${rawInputValue}-01`;
          break;
        case 'daily':
          updated[index].date = rawInputValue;
          break;
        default:
          updated[index].date = rawInputValue;
      }
    }
    setRows(updated);
  };

  /** Convert stored ISO date string back to native HTML input value */
  const getInputValue = (date: string): string => {
    if (!date) return '';
    switch (canonicalFreq) {
      case 'annual': return date.slice(0, 4);
      case 'monthly': return date.slice(0, 7);
      case 'quarterly': return date.slice(0, 7);
      case 'daily': return date;
      default: return date;
    }
  };

  const createMonthlyRows = (year: number, rows: DataRow[]): DataRow[] => {
    return MONTH_OPTIONS.map((m, i) => (i === 0 || !rows[i]?.date ?
      { ...rows[i], date: `${year}-${m.value}-01` }
      :
      rows[i]));
  };

  const updateYearMonthRow = (index: number, field: 'year' | 'month', value: string) => {
    const current = getInputValue(rows[index].date);
    const [currentYear = '', currentMonth = '01'] = current.split('-');

    const year = field === 'year' ? value : currentYear;
    const month = field === 'month' ? value : currentMonth;

    if (!year || !month) {
      updateRow(index, 'date', '');
      return;
    }

    updateDateRow(index, `${year}-${month}`);
  };

  const prevFirstDateRef = useRef<string>('');
  const isDraftHydratedRef = useRef(false);
  const draftStorageKey = getSeriesFormDraftKey(indicator.id, canonicalFreq);

  useEffect(() => {
    const firstDate = rows[0]?.date ?? '';

    if (firstDate === prevFirstDateRef.current) return;
    prevFirstDateRef.current = firstDate;
    if (!firstDate) return;

    if (canonicalFreq === 'annual') {
      const year = parseInt(firstDate.slice(0, 4), 10);
      if (isNaN(year)) return;
      setRows(prev =>
        prev.map((row, i) => (i === 0 || !row.date ? { ...row, date: `${year - i}-01-01` } : row))
      );
    } else if (canonicalFreq === 'monthly') {
      const year = parseInt(firstDate.slice(0, 4), 10);
      if (isNaN(year)) return;
      setRows(createMonthlyRows(year, rows));
    }
  }, [rows[0]?.date, rows[1]?.date, canonicalFreq]);

  useEffect(() => {
    const draft = loadSeriesFormDraft(draftStorageKey);
    if (draft) {
      setDataSource(draft.dataSource);
      setSourceUrl(draft.sourceUrl);
      setNotes(draft.notes);
      if (draft.rows.length > 0) {
        setRows(draft.rows);
      }
    }

    isDraftHydratedRef.current = true;
  }, [draftStorageKey]);

  useEffect(() => {
    console.log('isDraftHydratedRef.current :>> ', isDraftHydratedRef.current);
    if (!isDraftHydratedRef.current) return;

    const timeoutId = window.setTimeout(() => {
      saveSeriesFormDraft(draftStorageKey, {
        dataSource,
        sourceUrl,
        notes,
        rows,
      });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftStorageKey, dataSource, sourceUrl, notes, rows]);

  useEffect(() => {
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl || dataSource.trim() !== '' || !isValidHttpUrl(trimmedUrl)) {
      return;
    }

    const domain = getDomainFromUrl(trimmedUrl);
    if (domain) {
      setDataSource(domain);
    }
  }, [sourceUrl]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMessage('');

    try {
      if (!user) {
        throw new Error('Debes iniciar sesión para enviar datos. Por favor, inicia sesión primero.');
      }

      if (!dataSource || dataSource.trim() === '') {
        throw new Error('Por favor, completa todos los campos requeridos.');
      }

      const trimmedUrl = sourceUrl.trim();
      if (trimmedUrl) {
        try {
          new URL(trimmedUrl);
        } catch {
          throw new Error('La URL de la fuente no es valida. Usa un formato como https://sitio.com.');
        }
      }

      const validRows = rows.filter(row => row.date?.trim() && row.value?.trim());
      if (validRows.length < 1) {
        throw new Error('Por favor, proporciona al menos 1 punto de datos.');
      }
      const dates = validRows.map((row) => row.date);
      const hasDuplicates = dates.some((date, idx) => dates.indexOf(date) !== idx);
      if (hasDuplicates) {
        throw new Error('Hay fechas duplicadas. Por favor corrige las filas repetidas.');
      }
      for (const row of validRows) {
        const dateError = validateDate(row.date, canonicalFreq);
        if (dateError) throw new Error(dateError);
      }

      const validData = validRows.map(row => ({
        date: row.date,
        value: parseFloat(row.value),
      }));

      const invalidValues = validData.filter(item => isNaN(item.value));
      if (invalidValues.length > 0) {
        throw new Error('Por favor, ingresa valores numéricos válidos.');
      }

      const { data: postData, error: postError } = await supabase
        .from('serie_posts')
        .insert({
          indicator_id: indicator.id,
          data_source: dataSource,
          url: trimmedUrl || null,
          frequency: indicator.nativeFrequency,
          status: 'pending',
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (postError) throw postError;

      const dataPoints = validData.map(item => ({
        post_id: postData.id,
        date: item.date,
        value: item.value,
      }));

      console.log('dataPoints :>> ', dataPoints);

      const { error: dataError } = await supabase.from('serie_data').insert(dataPoints);
      if (dataError) throw dataError;

      clearSeriesFormDraft(draftStorageKey);
      setStatus('success');
      setStatusMessage(`✓ ¡Datos enviados exitosamente! ${validData.length} puntos de datos agregados.`);
      setSavedPostId(postData.id);
      setDataSource('');
      setSourceUrl('');
      setNotes('');
      setRows(INITIAL_ROWS);
    } catch (error: any) {
      console.error('Error en el envío:', error);
      setStatus('error');
      setStatusMessage(`✗ Error: ${error.message || 'Error al enviar los datos'}`);
    }
  };

  const handleRefreshForm = () => {
    clearSeriesFormDraft(draftStorageKey);
    window.location.reload();
  };

  const unitSymbol = indicator.unit?.symbol || indicator.unit?.type || '';

  return (
    <div className="mx-auto w-full max-w-4xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex justify-end">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleRefreshForm}>
            Limpiar formulario
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control md:col-span-1">
            <div className="label py-0">
              <span className="label-text font-semibold">Fuente de Datos <span className="text-error">*</span></span>
            </div>
            <input
              type="text"
              className="input input-bordered w-full"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              placeholder="ej., Banco Central, INE"
              required
            />
          </label>

          <label className="form-control md:col-span-1">
            <div className="label py-0">
              <span className="label-text font-semibold">URL de la Fuente <span className="text-base-content/50">(opcional)</span></span>
            </div>
            <input
              type="url"
              className="input input-bordered w-full"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://ejemplo.cl/dataset"
            />
          </label>

          <label className="form-control md:col-span-2">
            <div className="label py-0">
              <span className="label-text font-semibold">Notas <span className="text-base-content/50">(opcional)</span></span>
            </div>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comentarios adicionales sobre este ingreso de datos..."
            />
          </label>
        </div>

        <div className="space-y-3">
          <p className="font-semibold text-sm">Valores de la Serie <span className="text-error">*</span> <span className="font-normal text-base-content/50">(mínimo 1 fila)</span></p>
          <p className="text-sm text-base-content/60">{dateHint}</p>

          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>
                    Valor
                    {unitSymbol && <span className="font-normal text-base-content/50 ml-1">({unitSymbol})</span>}
                  </th>
                  <th className="w-16 text-center">—</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (!row ? 'nana' :
                  <tr key={index}>
                    <td>
                      {/* [{row.date}] */}
                      {canonicalFreq === 'annual' && (
                        <select
                          className="select select-sm select-bordered w-full"
                          value={getInputValue(row.date)}
                          onChange={(e) => updateDateRow(index, e.target.value)}
                        >
                          <option value="">Selecciona un año</option>
                          {YEAR_OPTIONS.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      )}

                      {(canonicalFreq === 'monthly' || canonicalFreq === 'quarterly') && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="select select-sm select-bordered w-full"
                            value={getInputValue(row.date).split('-')[0] ?? ''}
                            onChange={(e) => updateYearMonthRow(index, 'year', e.target.value)}
                          >
                            <option value="">Anio</option>
                            {YEAR_OPTIONS.map((year) => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>

                          <select
                            className="select select-sm select-bordered w-full"
                            value={getInputValue(row.date).split('-')[1] ?? ''}
                            onChange={(e) => updateYearMonthRow(index, 'month', e.target.value)}
                          >
                            <option value="">Mes</option>
                            {MONTH_OPTIONS.map((month) => (
                              <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {canonicalFreq === 'daily' && (
                        <input
                          type="date"
                          className="input input-sm input-bordered w-full"
                          value={getInputValue(row.date)}
                          onChange={(e) => updateDateRow(index, e.target.value)}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        className="input input-sm input-bordered w-full"
                        value={row.value}
                        onChange={(e) => updateRow(index, 'value', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removeRow(index)}
                        disabled={rows.length <= 1}
                        aria-label="Eliminar fila"
                      >
                        {/* Trash icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn btn-dashed btn-sm mt-1 gap-2" onClick={addRow}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Agregar Fila
          </button>
        </div>

        {!isAuthReady && (
          <div role="alert" className="alert alert-info">
            <span>...</span>
          </div>
        )}

        {isAuthReady && !isAuthenticated && (
          <div role="alert" className="alert alert-warning">
            <span>Debes iniciar sesión para enviar datos.</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isAuthenticated || status === 'loading'}
            >
              {status === 'loading' && <span className="loading loading-spinner loading-sm" />}
              Enviar Datos de Series
            </button>
          </div>

          {statusMessage && (
            <div role="alert" className={`alert ${status === 'success' ? 'alert-success' : status === 'error' ? 'alert-error' : 'alert-info'}`}>
              <span>{statusMessage}</span>
            </div>
          )}

          {status === 'success' && savedPostId && (
            <div className="mt-2">
              <a
                href={withBase(`/post?id=${savedPostId}`)}
                className="link link-primary"
              >
                Ver publicación
              </a>
            </div>
          )}

        </div>
      </form>
    </div>
  );
};

export default SeriesForm;
