import { useEffect, useId, useState } from 'react';
import type { FC } from 'react';
import { supabase } from '../../lib/supabase';
import { ALL_INDICATORS, INDICATOR_MAP } from './analysis-builder.data';

const IndicatorSelector: FC<{
  selected: string[];
  onToggle: (id: string) => void;
  region: string;
  onSetRegion: (value: string) => void;
}> = ({ selected, onToggle, region, onSetRegion }) => {
  const id = useId();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState('');
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadSources() {
      const { data, error } = await supabase.from('serie_posts')
        .select('indicator_id, data_source').eq('status', 'approved');
      if (!active) return;
      setLoading(false);
      if (error) {
        setError('No se pudieron cargar las fuentes.');
        return;
      }
      const grouped: Record<string, string[]> = {};
      for (const row of data ?? []) {
        const names = grouped[row.indicator_id] ??= [];
        if (row.data_source && !names.includes(row.data_source)) names.push(row.data_source);
      }
      setSources(grouped);
    }
    void loadSources();
    return () => { active = false; };
  }, []);

  const filtered = ALL_INDICATORS.filter(ind =>
    (ind.label + ' ' + ind.id + ' ' + (sources[ind.id] ?? []).join(' '))
      .toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
  );
  const alreadyAdded = selected.includes(pending);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id + '-search'} className="label mb-1.5">Buscar indicador</label>
        <input id={id + '-search'} type="search" className="input w-full"
          placeholder="Ej. PIB real, inflación, desempleo"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-base-300" aria-label="Indicadores disponibles">
        {filtered.map(ind => (
          <button key={ind.id} type="button" aria-pressed={pending === ind.id}
            className={`block w-full border-b border-base-300 px-3 py-3 text-left text-sm last:border-b-0 hover:bg-base-200 ${pending === ind.id ? 'bg-accent/10' : 'bg-base-100'}`}
            onClick={() => setPending(ind.id)}>
            <span className={pending === ind.id ? 'font-semibold' : ''}>{ind.label}</span>
            <span className="text-neutral"> · {sources[ind.id]?.join(', ') || (loading ? 'Cargando fuentes…' : 'Sin fuentes aprobadas')}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="p-3 text-sm text-neutral">No se encontraron indicadores.</p>}
      </div>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <div>
        <label htmlFor={id + '-country'} className="label mb-1.5">País</label>
        <select id={id + '-country'} className="select w-full" value={region || 'Chile'} onChange={e => onSetRegion(e.target.value)}>
          <option value="Chile">Chile</option>
          {region && region !== 'Chile' && <option value={region}>{region}</option>}
        </select>
      </div>
      <button type="button" className="btn btn-outline btn-accent w-full"
        disabled={!pending || alreadyAdded || selected.length >= 5}
        onClick={() => { if (!region) onSetRegion('Chile'); onToggle(pending); }}>
        {alreadyAdded ? 'Ya agregado al gráfico' : '+ Agregar al gráfico'}
      </button>
      {selected.length >= 5 && <p className="text-xs text-neutral">Máximo 5 indicadores.</p>}

      {selected.length > 0 && <p className="text-xs font-semibold text-neutral">Indicadores agregados</p>}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Indicadores agregados">
          {selected.map(ind => (
            <button key={ind} type="button" className="btn btn-outline h-auto max-w-full gap-2 whitespace-normal py-2 text-left text-xs"
              onClick={() => onToggle(ind)} aria-label={`Quitar ${INDICATOR_MAP.get(ind) ?? ind}`}>
              {INDICATOR_MAP.get(ind) ?? ind} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default IndicatorSelector;
