import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeFrequency, getDateHint, validateDate } from '../lib/frequency';
import { withBase } from '../lib/paths';

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

const SeriesForm: FC<Props> = ({ indicator }) => {
  const [dataSource, setDataSource] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DataRow[]>(INITIAL_ROWS);
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const canonicalFreq = normalizeFrequency(indicator.nativeFrequency ?? '');
  const dateHint = getDateHint(canonicalFreq);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    setIsAuthenticated(!error && !!user);
    if (error || !user) console.log('No authenticated user');
  };

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMessage('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Debes iniciar sesión para enviar datos. Por favor, inicia sesión primero.');
      }

      if (!dataSource || dataSource.trim() === '') {
        throw new Error('Por favor, completa todos los campos requeridos.');
      }

      const validRows = rows.filter(row => row.date.trim() !== '' && row.value.trim() !== '');
      if (validRows.length < 1) {
        throw new Error('Por favor, proporciona al menos 1 punto de datos.');
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

      const { error: dataError } = await supabase.from('serie_data').insert(dataPoints);
      if (dataError) throw dataError;

      setStatus('success');
      setStatusMessage(`✓ ¡Datos enviados exitosamente! ${validData.length} puntos de datos agregados.`);
      setDataSource('');
      setNotes('');
      setRows(INITIAL_ROWS);
    } catch (error: any) {
      console.error('Error en el envío:', error);
      setStatus('error');
      setStatusMessage(`✗ Error: ${error.message || 'Error al enviar los datos'}`);
    }
  };

  const unitSymbol = indicator.unit?.symbol || indicator.unit?.type || '';

  const dateInputType = canonicalFreq === 'annual' ? 'number' :
    canonicalFreq === 'monthly' || canonicalFreq === 'quarterly' ? 'month' : 'date';

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4">
        <a href={withBase(`/indicators/${indicator.id}/data`)} className="btn btn-ghost btn-sm gap-2">
          {/* Back arrow */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Volver a datos del indicador
        </a>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="form-control">
          <div className="label py-0">
            <span className="label-text font-semibold">Fuente de Datos <span className="text-error">*</span></span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            placeholder="ej., Banco Central, INE"
            required
          />
        </label>

        <label className="form-control">
          <div className="label py-0">
            <span className="label-text font-semibold">Notas <span className="text-base-content/50">(opcional)</span></span>
          </div>
          <textarea
            className="textarea textarea-bordered"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comentarios adicionales sobre este ingreso de datos..."
          />
        </label>

        <div>
          <p className="font-semibold text-sm mb-1">Valores de la Serie <span className="text-error">*</span> <span className="font-normal text-base-content/50">(mínimo 1 fila)</span></p>
          <p className="text-sm text-base-content/60 mb-3">{dateHint}</p>

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
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type={dateInputType}
                        className="input input-sm input-bordered w-full"
                        value={getInputValue(row.date)}
                        onChange={(e) => updateDateRow(index, e.target.value)}
                        min={canonicalFreq === 'annual' ? 1900 : undefined}
                        max={canonicalFreq === 'annual' ? 2100 : undefined}
                        placeholder={canonicalFreq === 'annual' ? 'ej. 2024' : undefined}
                      />
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

          <button type="button" className="btn btn-dashed btn-sm mt-3 gap-2" onClick={addRow}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Agregar Fila
          </button>
        </div>

        {!isAuthenticated && (
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
        </div>
      </form>
    </div>
  );
};

export default SeriesForm;
