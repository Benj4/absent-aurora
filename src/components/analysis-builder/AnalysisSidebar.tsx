import { useState } from 'react';
import type { FC, Dispatch, SetStateAction } from 'react';
import type { AnalisisState, Periodo, ModoAlineacion } from './analysis-builder.types';
import type { MacroEvent } from '../../lib/macro-events';
import { withBase } from '../../lib/paths';
import SidebarSection from './SidebarSection';
import IndicatorSelector from './IndicatorSelector';
import PeriodRow from './PeriodRow';
import MacroEventForm from '../macro-events/MacroEventForm';

interface AnalysisSidebarProps {
  state: AnalisisState;
  onSetRegion: (value: string) => void;
  onSetModo: (value: ModoAlineacion) => void;
  onSetShowBase100Line: (value: boolean) => void;
  onToggleIndicator: (id: string) => void;
  onAddPeriodo: () => void;
  onUpdatePeriodo: (id: string, field: keyof Periodo, value: string) => void;
  onRemovePeriodo: (id: string) => void;
  onToggleMacroEvent: (id: string) => void;
  macroEvents: MacroEvent[];
  macroEventsLoading: boolean;
  macroEventsSearch: string;
  setMacroEventsSearch: Dispatch<SetStateAction<string>>;
  onMacroEventCreated: (event: MacroEvent) => void;
  onReset: () => void;
  step: number;
  onSetStep: (step: number) => void;
  onPreview: () => void;
  isEditMode: boolean;
}

const AnalysisSidebar: FC<AnalysisSidebarProps> = ({
  state,
  onSetRegion,
  onSetModo,
  onSetShowBase100Line,
  onToggleIndicator,
  onAddPeriodo,
  onUpdatePeriodo,
  onRemovePeriodo,
  onToggleMacroEvent,
  macroEvents,
  macroEventsLoading,
  macroEventsSearch,
  setMacroEventsSearch,
  onMacroEventCreated,
  onReset,
  step,
  onSetStep,
  onPreview,
  isEditMode,
}) => {
  const [isMacroEventFormOpen, setIsMacroEventFormOpen] = useState(false);

  return (
    <>
      <aside
        aria-label="Panel de configuración del análisis"
        className="min-w-0 flex flex-col"
      >
    <div className="mb-6">
      <h2 className="text-xl font-bold">{step === 1 ? 'Selecciona los datos' : step === 2 ? 'Define la comparación' : 'Da contexto al análisis'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral">{step === 1 ? 'Agrega hasta cinco indicadores para construir el gráfico.' : step === 2 ? 'Elige las fechas y cómo quieres comparar los períodos.' : 'Agrega acontecimientos económicos y sociales que ayuden a interpretar los cambios en los datos.'}</p>
    </div>
    <div className="flex-1">
      <div hidden={step !== 1}>
      <SidebarSection title="Datos" summary={state.indicadores.length === 1 ? '1 serie agregada' : `${state.indicadores.length} series agregadas`}>
        <IndicatorSelector selected={state.indicadores} onToggle={onToggleIndicator}
          region={state.region} onSetRegion={onSetRegion} />
      </SidebarSection>

      </div>
      <div hidden={step !== 2}>
      <SidebarSection title="Períodos" summary={state.periodos.length === 1 ? '1 período configurado' : `${state.periodos.length} períodos configurados`}>
        <div aria-live="polite" aria-label="Lista de períodos de análisis" className="space-y-3">
          {state.periodos.map(periodo => (
            <PeriodRow
              key={periodo.id}
              periodo={periodo}
              canRemove={state.periodos.length > 1}
              onChange={(field, value) => onUpdatePeriodo(periodo.id, field, value)}
              onRemove={() => onRemovePeriodo(periodo.id)}
            />
          ))}
        </div>
        {state.periodos.length < 6 ? (
          <button
            type="button"
            className="btn btn-sm btn-outline w-full"
            onClick={onAddPeriodo}
          >+ Crear nuevo periodo</button>
        ) : (
          <p className="text-xs text-neutral text-center">Máximo 6 períodos</p>
        )}
      </SidebarSection>

      <SidebarSection title="Métrica" summary={state.modoAlineacion === 'calendario' ? 'Calendario' : 'Índice 0'}>
        <div>
          <p className="label py-0 pb-1.5">
            <span className="whitespace-normal text-xs font-medium">Modo de alineación</span>
          </p>
          <div className="space-y-2">
            <button
              type="button"
              className={`btn h-auto min-h-12 w-full justify-start whitespace-normal rounded-lg px-4 py-3 text-left ${state.modoAlineacion === 'calendario' ? 'btn-soft btn-accent' : 'btn-outline'}`}
              aria-pressed={state.modoAlineacion === 'calendario'}
              onClick={() => onSetModo('calendario')}
            ><span>Calendario<span className="mt-1 block text-xs font-normal">Valores por fecha real, en su unidad original.</span></span></button>
            <button
              type="button"
              className={`btn h-auto min-h-12 w-full justify-start whitespace-normal rounded-lg px-4 py-3 text-left ${state.modoAlineacion === 'indice_cero' ? 'btn-soft btn-accent' : 'btn-outline'}`}
              aria-pressed={state.modoAlineacion === 'indice_cero'}
              onClick={() => onSetModo('indice_cero')}
            ><span>Índice 0<span className="mt-1 block text-xs font-normal">Compara los períodos alineando sus inicios al mes 0.</span></span></button>
          </div>
          <p className="text-xs text-neutral mt-2 leading-relaxed">
            {state.modoAlineacion === 'calendario'
              ? 'Muestra todos los períodos con fechas reales en el eje X.'
              : 'Alinea el inicio de cada período al mes 0 para comparar ritmos, sin importar cuándo ocurrieron.'}
          </p>
        </div>

        <label htmlFor="sb-show-base100-line" className="flex items-center gap-2.5 cursor-pointer">
          <input
            id="sb-show-base100-line"
            type="checkbox"
            className="checkbox checkbox-xs checkbox-primary"
            checked={state.showBase100Line ?? false}
            onChange={e => onSetShowBase100Line(e.target.checked)}
          />
          <span className="whitespace-normal text-xs font-medium">Mostrar índice base 100</span>
        </label>
      </SidebarSection>

      </div>
      <div hidden={step !== 3}>
      <SidebarSection title="Eventos macro" summary={`${state.macroEventIds.length} eventos seleccionados`}>
        <div className="flex flex-col flex-1 min-h-64">
          <div>
            <label htmlFor="sb-macro-search" className="label py-0 pb-1 sr-only">
              <span className="whitespace-normal text-xs font-medium">Buscar evento</span>
            </label>
            <input
              id="sb-macro-search"
              type="search"
              className="input w-full"
              placeholder="Buscar evento…"
              value={macroEventsSearch}
              onChange={e => setMacroEventsSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="mt-3 flex-1 min-h-0">
            {macroEventsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton h-10 rounded-lg" />
                ))}
              </div>
            ) : macroEvents.length === 0 ? (
              <p className="text-xs text-neutral text-center py-2">No hay eventos registrados.</p>
            ) : (
              <ul
                aria-label="Lista de eventos macro"
                aria-live="polite"
                className="divide-y divide-base-300 overflow-y-auto overscroll-contain rounded-lg border border-base-300 max-h-80"
              >
                {macroEvents
                  .filter(ev =>
                    (ev.status === 'valid' || state.macroEventIds.includes(ev.id)) && (macroEventsSearch.trim() === '' ||
                    ev.name.toLowerCase().includes(macroEventsSearch.toLowerCase()) ||
                    (ev.description ?? '').toLowerCase().includes(macroEventsSearch.toLowerCase()))
                  )
                  .map(ev => {
                    const checked = state.macroEventIds.includes(ev.id);
                    return (
                      <li key={ev.id}>
                        <label
                          className={`flex items-start gap-2.5 px-3 py-3 cursor-pointer transition-colors hover:bg-base-200/60 ${checked ? 'bg-accent/10' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary mt-0.5 shrink-0"
                            checked={checked}
                            onChange={() => onToggleMacroEvent(ev.id)}
                            aria-label={`Seleccionar evento: ${ev.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug" title={ev.name}>{ev.name}</p>
                            <p className="text-xs text-neutral mt-0.5 tabular-nums">
                              {ev.start_date}{ev.end_date ? ` → ${ev.end_date}` : ''}
                              {ev.geo_region && <span className="ml-1.5">· {ev.geo_region}</span>}
                            </p>
                          </div>
                          <span
                            className="badge badge-xs shrink-0 mt-0.5 capitalize"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >{ev.topic}</span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>


        <button
          type="button"
          className="btn btn-sm btn-outline mb-3 w-full gap-1.5"
          onClick={() => setIsMacroEventFormOpen(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
          Crear nuevo evento
        </button>

      </SidebarSection>
      <div className="mt-5 space-y-3 text-sm text-neutral">
        <p>{state.indicadores.length} {state.indicadores.length === 1 ? 'indicador' : 'indicadores'} · {state.periodos.filter(p => p.fechaInicio && p.fechaFin).length} {state.periodos.filter(p => p.fechaInicio && p.fechaFin).length === 1 ? 'período con fechas' : 'períodos con fechas'}</p>
        <p>Revisa el gráfico y sus fuentes en la vista previa antes de guardar.</p>
        <button type="button" className="btn btn-outline w-full lg:hidden" onClick={onPreview}>Revisar vista previa</button>
      </div>
    </div>

      </div>
    <div className="mt-6 space-y-4 border-t border-base-300 pt-5">
      <div className="flex items-center gap-3">
        {step > 1 && <button type="button" className="btn btn-outline" onClick={() => onSetStep(step - 1)}>Anterior</button>}
        {step < 3 && <button type="button" className="btn btn-primary flex-1" onClick={() => onSetStep(step + 1)}>{step === 1 ? 'Definir períodos' : 'Agregar contexto'}</button>}
        {step === 3 && <p className="text-xs leading-relaxed text-neutral">Guarda desde la barra superior cuando termines la revisión.</p>}
      </div>
      {isEditMode ?
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => {
            if (window.confirm('Se perderán los cambios sin guardar. ¿Continuar?')) {
              window.location.href = withBase('/analisis/nuevo');
            }
          }}
        >
          Crear nuevo análisis
        </button>
        :
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => { if (window.confirm('Se perderá la configuración actual. ¿Reiniciar el análisis?')) onReset(); }}
        >
          Reiniciar
        </button>
      }
    </div>
      </aside>

      {isMacroEventFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Agregar evento macro"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-base-content/45 hover:bg-base-content/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            onClick={() => setIsMacroEventFormOpen(false)}
            aria-label="Cerrar formulario"
          />
          <div className="relative z-10 w-full max-w-2xl">
            <MacroEventForm
              isOpen
              onClose={() => setIsMacroEventFormOpen(false)}
              onSaved={event => {
                onMacroEventCreated(event);
                setIsMacroEventFormOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AnalysisSidebar;
