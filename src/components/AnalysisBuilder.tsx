import type { FC } from 'react';
import type { Analysis } from '../lib/supabase';
import { useState, useCallback, useEffect } from 'react';
import { useAnalisisState } from './analysis-builder/use-analisis-state';
import AnalysisSidebar from './analysis-builder/AnalysisSidebar';
import AnalysisContent from './analysis-builder/AnalysisContent';
import { saveAnalysis, updateAnalysis } from '../lib/analysis';
import { loadAnalysisValidity } from '../lib/analysis-validity';
import { withBase } from '../lib/paths';
import { captureSourceSelections } from './analysis-builder/analysis-builder.utils';

interface AnalysisBuilderProps {
  mode: 'new' | 'edit';
}

const AnalysisBuilder: FC<AnalysisBuilderProps> = ({ mode }) => {
  const analysisId = mode === 'edit' && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id') ?? undefined
    : undefined;
  const {
    state,
    onSetTitulo, onSetDescripcion, onSetStatus, onSetRegion, onSetModo,
    onSetShowBase100Line, onSelectIndexZeroIndicator,
    onToggleIndicator, onAddPeriodo, onUpdatePeriodo, onRemovePeriodo,
    onToggleMacroEvent, onSelectSource, onReset,
    macroEvents, macroEventsLoading, macroEventsSearch, setMacroEventsSearch,
    onMacroEventCreated,
    markerModeByEventId, setMarkerModeByEventId,
    markerColorByEventId, setMarkerColorByEventId,
    loading, dataError, isDraftReady, rawData,
    sourceConflicts, selectedMacroEvents,
    hasData, isConfigured, displayTitle, periodsSummary, tableRows,
  } = useAnalisisState(analysisId);

  const isEditMode = Boolean(analysisId);

  const [validityMessage, setValidityMessage] = useState('');
  useEffect(() => {
    if (!analysisId) return;
    loadAnalysisValidity([analysisId]).then(result => {
      const validity = result[analysisId];
      setValidityMessage(validity.referencesUnverified ? 'No se puede confirmar que este análisis conserve todas sus referencias originales. Guardar o crear una versión no recupera los datos históricos que faltan.' : validity.unknown ? 'No se pudo comprobar la validez de todas las referencias guardadas.' : validity.sources.length || validity.events.length ? 'El análisis guardado contiene fuentes o eventos invalidados. Reemplázalos y guarda los cambios.' : '');
    }).catch(() => setValidityMessage('No se pudo comprobar la validez de las referencias guardadas.'));
  }, [analysisId]);
  const [step, setStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const navigateEditor = (nextStep: number, preview = false) => {
    setStep(nextStep);
    setShowPreview(preview);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!isDraftReady || loading || dataError) {
      setSaveError(dataError ?? 'Espera a que termine la carga de los datos.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    let selections;
    try {
      selections = captureSourceSelections(rawData, state);
    } catch {
      setSaveError('No se pudo identificar la fuente de todos los datos.');
      setIsSaving(false);
      return;
    }
    const savedState = { ...state, sourceSelections: selections };
    const result = isEditMode
      ? await updateAnalysis(analysisId!, savedState)
      : await saveAnalysis(savedState);
    setIsSaving(false);
    if ('error' in result) {
      setSaveError(result.error);
    } else window.location.href = withBase(`/analisis?id=${result.id}`);
  }, [state, isEditMode, analysisId, isDraftReady, loading, dataError, rawData]);
  return (
    <div className="analysis-editor min-h-[calc(100svh-4rem)] bg-base-200">
      <header className="editor-toolbar flex flex-wrap items-center gap-2 px-2 py-2 sm:px-5 lg:px-10">
        <h1 className="sr-only">{isEditMode ? 'Editar análisis' : 'Nuevo análisis'}</h1>
        <nav aria-label="Pasos del análisis" className="flex min-w-max flex-1 items-center gap-1 sm:gap-2">
          {['Datos', 'Períodos', 'Contexto'].map((label, index) => (
            <button key={label} type="button" aria-current={step === index + 1 ? 'step' : undefined}
              className={`editor-step min-h-11 px-2 text-sm sm:px-4 ${step === index + 1 ? 'border-b-2 border-primary-content font-bold' : ''}`}
              onClick={() => navigateEditor(index + 1)}>
              <span aria-hidden="true" className="mr-2 hidden text-xs tabular-nums sm:inline">{index + 1}</span>{label}
            </button>
          ))}
        </nav>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:w-auto">
          <div className="flex min-w-0 items-center gap-1">
          <label className="flex min-w-0 items-center gap-1 text-sm text-primary-content">
            Estado
            <select
              className="select w-28 text-base-content"
              value={state.status}
              onChange={e => onSetStatus(e.target.value as Analysis['status'])}
              aria-label="Cambiar estado del análisis"
              aria-describedby="analysis-status-hint"
              disabled={isSaving}
            >
              <option value="draft">Borrador</option>
              <option value="public">Público</option>
              <option value="hidden">Oculto</option>
            </select>
          </label>
          <details className="dropdown dropdown-end shrink-0">
            <summary className="btn btn-ghost btn-square text-primary-content hover:bg-primary-content/10! focus:bg-primary-content/10!" aria-label="Ayuda sobre el estado del análisis">
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 16.5h.01" />
              </svg>
            </summary>
            <p id="analysis-status-hint" className="dropdown-content z-20 mt-2 w-52 rounded-xl border border-base-300 bg-base-100 p-3 text-sm text-base-content">El estado se aplica al guardar.</p>
          </details>
          </div>
        <button type="button" className="btn btn-outline shrink-0 px-3" onClick={handleSave} disabled={isSaving || !isDraftReady || loading || Boolean(dataError)}
          aria-label={isSaving ? 'Guardando análisis' : isEditMode ? 'Guardar cambios' : state.status === 'draft' ? 'Guardar borrador' : 'Guardar análisis'}>
          {isSaving && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
          <span className="sm:hidden">{isSaving ? 'Guardando…' : 'Guardar'}</span>
          <span className="hidden sm:inline">{isSaving ? 'Guardando…' : isEditMode ? 'Guardar cambios' : state.status === 'draft' ? 'Guardar borrador' : 'Guardar análisis'}</span>
        </button>
        </div>
      </header>
      {saveError && <p className="alert alert-error rounded-none" role="alert">{saveError}</p>}
      <div className="flex gap-2 px-3 pt-2 lg:hidden" aria-label="Vista del editor">
        <button type="button" aria-pressed={!showPreview} className={`btn flex-1 ${!showPreview ? 'btn-soft' : 'btn-ghost'}`} onClick={() => navigateEditor(step)}>Configuración</button>
        <button type="button" aria-pressed={showPreview} className={`btn flex-1 ${showPreview ? 'btn-soft' : 'btn-ghost'}`} onClick={() => navigateEditor(step, true)}>Vista previa</button>
      </div>
        {dataError && <p className="alert alert-error mx-5 mt-3" role="alert">{dataError}</p>}
        {analysisId && <div className="px-5 pt-2 text-sm"><a className="link link-primary" href={withBase(`/analisis?id=${analysisId}`)}>Ver análisis y versiones vinculadas</a>{validityMessage && <p className="text-warning-content" role="alert">{validityMessage}</p>}</div>}
      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[minmax(320px,410px)_minmax(0,1fr)] lg:gap-8 lg:px-10 lg:py-5">
      <div className={`${showPreview ? 'hidden' : 'block'} min-w-0 lg:block`}>
      <AnalysisSidebar
        state={state}
        onSetRegion={onSetRegion}
        onSetModo={onSetModo}
        onSetShowBase100Line={onSetShowBase100Line}
        onToggleIndicator={onToggleIndicator}
        onAddPeriodo={onAddPeriodo}
        onUpdatePeriodo={onUpdatePeriodo}
        onRemovePeriodo={onRemovePeriodo}
        onToggleMacroEvent={onToggleMacroEvent}
        macroEvents={macroEvents}
        macroEventsLoading={macroEventsLoading}
        macroEventsSearch={macroEventsSearch}
        setMacroEventsSearch={setMacroEventsSearch}
        onMacroEventCreated={onMacroEventCreated}
        step={step}
        onSetStep={navigateEditor}
        onPreview={() => navigateEditor(step, true)}
        onReset={onReset}
        isEditMode={isEditMode}
      />

      </div>
      <div className={`${showPreview ? 'flex' : 'hidden'} min-w-0 flex-col lg:flex`}>
      <AnalysisContent
        onSetTitulo={onSetTitulo}
        onSetDescripcion={onSetDescripcion}
        analysisId={analysisId}
        state={state}
        loading={loading}
        sourceConflicts={sourceConflicts}
        rawData={rawData}
        onSelectIndexZeroIndicator={onSelectIndexZeroIndicator}
        selectedMacroEvents={selectedMacroEvents}
        // kpiRows={kpiRows}
        hasData={hasData}
        isConfigured={isConfigured}
        displayTitle={displayTitle}
        periodsSummary={periodsSummary}
        tableRows={tableRows}
        onSelectSource={onSelectSource}
        markerModeByEventId={markerModeByEventId}
        setMarkerModeByEventId={setMarkerModeByEventId}
        markerColorByEventId={markerColorByEventId}
        setMarkerColorByEventId={setMarkerColorByEventId}
      />
      </div>
      </div>
    </div>
  );
};

export default AnalysisBuilder;
