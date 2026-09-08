import { useState } from 'react';
import type { FC, Dispatch, SetStateAction } from 'react';
import type { AnalisisState, Periodo, ModoAlineacion } from './analysis-builder.types';
import type { MacroEvent } from '../../lib/macro-events';
import SidebarSection from './SidebarSection';
import IndicatorSelector from './IndicatorSelector';
import PeriodRow from './PeriodRow';
import MacroEventForm from '../macro-events/MacroEventForm';

interface AnalysisSidebarProps {
  state: AnalisisState;
  onSetTitulo: (value: string) => void;
  onSetDescripcion: (value: string) => void;
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
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  isEditMode: boolean;
}

const AnalysisSidebar: FC<AnalysisSidebarProps> = ({
  state,
  onSetTitulo,
  onSetDescripcion,
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
  onSave,
  isSaving,
  saveError,
  isEditMode,
}) => {
  const [isMacroEventFormOpen, setIsMacroEventFormOpen] = useState(false);

  return (
    <>
      <aside
        aria-label="Panel de configuración del analisis"
        className="w-72 lg:w-80 shrink-0 flex flex-col border-r border-base-200 bg-base-100 overflow-hidden"
      >
    {/* <div className="sticky top-0 z-10 bg-base-100 border-b border-base-200 px-4 py-3.5 shrink-0">
      <h2 className="text-xs font-bold uppercase tracking-widest text-base-content/40">Constructor de Escenarios</h2>
    </div> */}

    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <SidebarSection title="Contexto">
        <div>
          <label htmlFor="sb-titulo" className="label py-0 pb-1">
            <span className="label-text text-xs font-medium">Título del análisis</span>
          </label>
          <input
            id="sb-titulo"
            type="text"
            className="input input-sm w-full"
            placeholder="Ej. Comparativa inflación 2010-2020…"
            value={state.titulo}
            onChange={e => onSetTitulo(e.target.value)}
            maxLength={120}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="sb-descripcion" className="label py-0 pb-1">
            <span className="label-text text-xs font-medium">Notas / hipótesis</span>
          </label>
          <textarea
            id="sb-descripcion"
            className="textarea textarea-sm w-full resize-none"
            placeholder="Contexto, hipótesis, fuentes adicionales…"
            rows={3}
            value={state.descripcion}
            onChange={e => onSetDescripcion(e.target.value)}
            maxLength={500}
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Datos">
        <div>
          <p className="label py-0 pb-1">
            <span className="label-text text-xs font-medium">
              Indicadores <span className="text-base-content/40 font-normal">({state.indicadores.length}/5)</span>
            </span>
          </p>
          <IndicatorSelector selected={state.indicadores} onToggle={onToggleIndicator} />
        </div>
        <div>
          <label htmlFor="sb-region" className="label py-0 pb-1">
            <span className="label-text text-xs font-medium">País / Región</span>
          </label>
          <input
            id="sb-region"
            type="text"
            className="input input-sm w-full"
            placeholder="Chile"
            value={state.region}
            onChange={e => onSetRegion(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Períodos">
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
            className="btn btn-sm btn-outline btn-primary w-full"
            onClick={onAddPeriodo}
          >+ Añadir período</button>
        ) : (
          <p className="text-xs text-base-content/40 text-center">Máximo 6 períodos</p>
        )}
      </SidebarSection>

      <SidebarSection title="Matemática">
        <div>
          <p className="label py-0 pb-1.5">
            <span className="label-text text-xs font-medium">Modo de alineación</span>
          </p>
          <div className="join w-full">
            <button
              type="button"
              className={`join-item btn btn-sm flex-1 ${state.modoAlineacion === 'calendario' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              onClick={() => onSetModo('calendario')}
            >Calendario</button>
            <button
              type="button"
              className={`join-item btn btn-sm flex-1 ${state.modoAlineacion === 'indice_cero' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              onClick={() => onSetModo('indice_cero')}
            >Índice 0</button>
          </div>
          <p className="text-xs text-base-content/40 mt-2 leading-relaxed">
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
            checked={state.showBase100Line ?? true}
            onChange={e => onSetShowBase100Line(e.target.checked)}
          />
          <span className="label-text text-xs font-medium">Mostrar índice base 100</span>
        </label>
      </SidebarSection>

      <SidebarSection title="Eventos macro" defaultOpen={true} className="flex flex-col flex-1 min-h-80">
        <div className="flex flex-col flex-1 min-h-64">
          <button
            type="button"
            className="btn btn-sm btn-outline btn-primary mb-3 w-full gap-1.5"
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
            Agregar evento
          </button>
          <div>
            <label htmlFor="sb-macro-search" className="label py-0 pb-1 sr-only">
              <span className="label-text text-xs font-medium">Buscar evento</span>
            </label>
            <input
              id="sb-macro-search"
              type="search"
              className="input input-sm w-full"
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
              <p className="text-xs text-base-content/40 text-center py-2">No hay eventos registrados.</p>
            ) : (
              <ul
                aria-label="Lista de eventos macro"
                aria-live="polite"
                className="space-y-1 overflow-y-auto overscroll-contain pr-0.5 h-full"
              >
                {macroEvents
                  .filter(ev =>
                    macroEventsSearch.trim() === '' ||
                    ev.name.toLowerCase().includes(macroEventsSearch.toLowerCase()) ||
                    (ev.description ?? '').toLowerCase().includes(macroEventsSearch.toLowerCase())
                  )
                  .map(ev => {
                    const checked = state.macroEventIds.includes(ev.id);
                    return (
                      <li key={ev.id}>
                        <label
                          className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors hover:bg-base-200/60 ${checked ? 'bg-primary/8' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary mt-0.5 shrink-0"
                            checked={checked}
                            onChange={() => onToggleMacroEvent(ev.id)}
                            aria-label={`Seleccionar evento: ${ev.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium leading-snug truncate" title={ev.name}>{ev.name}</p>
                            <p className="text-xs text-base-content/40 mt-0.5 tabular-nums">
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
        {state.macroEventIds.length > 0 && (
          <p className="text-xs text-primary font-medium">
            {state.macroEventIds.length} evento{state.macroEventIds.length !== 1 ? 's' : ''} seleccionado{state.macroEventIds.length !== 1 ? 's' : ''}
          </p>
        )}
      </SidebarSection>
    </div>

    <div className="shrink-0 border-t border-base-200 bg-base-100 px-4 pb-4 pt-3 space-y-2">
      <button
        type="button"
        className="btn btn-sm btn-primary w-full"
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? <span className="loading loading-spinner loading-xs" /> : null}
        {isSaving ? 'Guardando…' : isEditMode ? 'Actualizar análisis' : 'Guardar análisis'}
      </button>
      {saveError && (
        <p className="text-xs text-error leading-snug" role="alert">{saveError}</p>
      )}
      {isEditMode ?
        <button
          type="button"
          className="btn btn-sm btn-outline btn-error w-full"
          onClick={() => {
            if (window.confirm('Se perderan los cambios sin guardar. ¿Continuar?')) {
              window.location.href = '/analisis/nuevo';
            }
          }}
        >
          Crear nuevo análisis
        </button>
        :
        <button
          type="button"
          className="btn btn-sm btn-outline btn-error w-full"
          onClick={onReset}
        >
          Reiniciar formulario
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
