import { useId } from 'react';
import { activeIndicator } from '../../lib/analysis-chart';
import { INDICATOR_MAP } from '../analysis-builder/analysis-builder.data';
import type { ChartInput } from './charts/chart-input';
import CalendarChart from './charts/CalendarChart';
import IndexZeroChart from './charts/IndexZeroChart';

// Controlled composition: the editor/viewer retains the authoritative configuration.
export default function AnalysisContainer({ configuration, points, events, onSelectIndicator }: ChartInput & { onSelectIndicator: (id: string) => void }) {
  const selectId = useId();
  if (configuration.modoAlineacion === 'calendario') return <CalendarChart configuration={configuration} points={points} events={events} />;
  const selected = activeIndicator(configuration);
  return <>
    {configuration.indicadores.length > 1 && <div className="mb-3 flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium">Indicador a comparar</label>
      <select id={selectId} className="select w-full max-w-full" value={selected ?? ''} onChange={event => onSelectIndicator(event.target.value)}>
        {configuration.indicadores.map(id => <option key={id} value={id}>{INDICATOR_MAP.get(id) ?? id}</option>)}
      </select>
    </div>}
    {selected ? <>
      <h3 className="mb-2 text-sm font-semibold break-words">{INDICATOR_MAP.get(selected) ?? selected}</h3>
      <IndexZeroChart configuration={configuration} points={points} events={events} />
    </> : <p role="status">No hay indicadores disponibles. Agrega un indicador para comparar períodos.</p>}
  </>;
}
