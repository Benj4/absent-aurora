import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';

// TODO: actualmente este es el formulario anual, cada fila reprecenta un año
// pero la intencion es que este sea un formulario generico para cualquier frecuencia, y que cada fila represente una fecha completa (ej. 2025-03-01) y el sistema se encargue de validar que la fecha corresponda a la frecuencia del indicador (ej. si es anual, validar que la fecha sea 2025-01-01, si es mensual validar que sea 2025-03-01, etc). Esto permitiria usar el mismo formulario para indicadores anuales, mensuales, trimestrales, etc.
// el campo que determina la frecuencia del indicador es indicator.nativeFrequency

interface Indicator {
  id: string;
  label: string;
  nativeFrequency: string;
  unit?: {
    symbol?: string;
    type?: string;
  };
}

interface YearlyValue {
  year: string;
  value: string;
}

interface Props {
  indicator: Indicator;
}

type StatusType = 'idle' | 'loading' | 'success' | 'error';

const SeriesAnnualForm: FC<Props> = ({ indicator }) => {
  const [dataSource, setDataSource] = useState('');
  const [yearlyValues, setYearlyValues] = useState<YearlyValue[]>([
    { year: '', value: '' },
    { year: '', value: '' },
    { year: '', value: '' },
    { year: '', value: '' },
  ]);
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    setIsAuthenticated(!error && !!user);
    if (error || !user) {
      console.log('No authenticated user');
    }
  };

  const addRow = () => {
    setYearlyValues([...yearlyValues, { year: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    if (yearlyValues.length > 1) {
      setYearlyValues(yearlyValues.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index: number, field: 'year' | 'value', value: string) => {
    const updated = [...yearlyValues];
    updated[index][field] = value;
    setYearlyValues(updated);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    setStatus('loading');
    setStatusMessage('');

    try {
      // Check authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Debes iniciar sesión para enviar datos. Por favor, inicia sesión primero.');
      }

      // Validate data source
      if (!dataSource || dataSource.trim() === '') {
        throw new Error('Por favor, completa todos los campos requeridos.');
      }

      // Collect valid year-value pairs
      const validData = yearlyValues.filter(
        item => item.year.trim() !== '' && item.value.trim() !== ''
      ).map(item => ({
        year: parseInt(item.year),
        value: parseFloat(item.value)
      }));

      // Validate minimum data points
      if (validData.length < 1) {
        throw new Error('Por favor, proporciona al menos 1 punto de datos.');
      }

      // Validate years are numbers
      const invalidYears = validData.filter(item => isNaN(item.year) || item.year < 0 || item.year > 9999);
      if (invalidYears.length > 0) {
        throw new Error('Por favor, ingresa años válidos (0-9999).');
      }

      // Validate values are numbers
      const invalidValues = validData.filter(item => isNaN(item.value));
      if (invalidValues.length > 0) {
        throw new Error('Por favor, ingresa valores numéricos válidos.');
      }

      // Step 1: Insert serie_posts record
      const { data: postData, error: postError } = await supabase
        .from('serie_posts')
        .insert({
          indicator_id: indicator.id,
          data_source: dataSource,
          frequency: indicator.nativeFrequency,
          status: 'pending'
        })
        .select()
        .single();

      if (postError) throw postError;

      // Step 2: Insert serie_data records
      const dataPoints = validData.map(item => ({
        post_id: postData.id,
        date: `${item.year}-01-01`, // Store as YYYY-01-01 for annual data
        value: item.value
      }));

      const { error: dataError } = await supabase
        .from('serie_data')
        .insert(dataPoints);

      if (dataError) throw dataError;

      // Success
      setStatus('success');
      setStatusMessage(`✓ ¡Datos enviados exitosamente! ${validData.length} puntos de datos agregados.`);
      
      // Reset form
      setDataSource('');
      setYearlyValues([
        { year: '', value: '' },
        { year: '', value: '' },
        { year: '', value: '' },
        { year: '', value: '' },
      ]);

    } catch (error: any) {
      console.error('Error en el envío:', error);
      setStatus('error');
      setStatusMessage(`✗ Error: ${error.message || 'Error al enviar los datos'}`);
    }
  };

  const unitSymbol = indicator.unit?.symbol || indicator.unit?.type || '';

  return (
    <div className="flex justify-center">
      {JSON.stringify(indicator)}
      <form onSubmit={handleSubmit} className="mx-auto text-left max-w-150">
        <div className="mb-4">
          <label htmlFor="data-source" className="block mb-2 font-semibold">
            Fuente de Datos:
          </label>
          <input
            className="w-full"
            type="text"
            id="data-source"
            name="data-source"
            value={dataSource}
            onInput={(e) => setDataSource((e.target as HTMLInputElement).value)}
            placeholder="ej., Banco Central, INE"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-semibold">
            Valores Anuales (mínimo 1 fila):
          </label>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-foreground/5">
                  <th className="border border-foreground/30 p-2 text-left">Año</th>
                  <th className="border border-foreground/30 p-2 text-left">Valor</th>
                  <th className="border border-foreground/30 p-2 text-left w-20">Acción</th>
                </tr>
              </thead>
              <tbody>
                {yearlyValues.map((row, index) => (
                  <tr key={index}>
                    <td className="border border-foreground/30 p-2">
                      <input
                        className="w-full bg-transparent border-0 p-1"
                        type="number"
                        min="0"
                        max="9999"
                        value={row.year}
                        onInput={(e) => updateRow(index, 'year', (e.target as HTMLInputElement).value)}
                        placeholder="ej., 2025"
                      />
                    </td>
                    <td className="border border-foreground/30 p-2">
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 bg-transparent border-0 p-1"
                          type="number"
                          step="any"
                          value={row.value}
                          onInput={(e) => updateRow(index, 'value', (e.target as HTMLInputElement).value)}
                          placeholder="0.00"
                        />
                        {unitSymbol && (
                          <span className="text-sm text-foreground/60">{unitSymbol}</span>
                        )}
                      </div>
                    </td>
                    <td className="border border-foreground/30 p-2 text-center">
                      {yearlyValues.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                          title="Eliminar fila"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="mt-2 text-sm hover:underline"
          >
            + Agregar Fila
          </button>
        </div>

        {!isAuthenticated && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
            ⚠ Debes iniciar sesión para enviar datos.
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            disabled={status === 'loading' || !isAuthenticated}
            className={status === 'loading' || !isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {status === 'loading' ? 'Enviando...' : 'Enviar Datos Anuales'}
          </button>
          
          {statusMessage && (
            <p
              className={`mt-2 text-sm ${
                status === 'success' ? 'text-green-600' :
                status === 'error' ? 'text-red-600' :
                ''
              }`}
            >
              {statusMessage}
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default SeriesAnnualForm;
