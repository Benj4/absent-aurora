import type { FC } from 'react';
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
    <div data-theme="analysis-editor" className="analysis-editor grid min-h-[calc(100svh-7rem)] bg-base-200 lg:grid-cols-[400px_minmax(0,1fr)]">
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
        onReset={onReset}
        onSave={handleSave}
        isSaving={isSaving}
        saveError={saveError}
        isEditMode={isEditMode}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {dataError && <p className="alert alert-error mx-5 mt-3" role="alert">{dataError}</p>}
        {analysisId && <div className="px-5 pt-2 text-sm"><a className="link link-primary" href={withBase(`/analisis?id=${analysisId}`)}>Ver análisis y versiones vinculadas</a>{validityMessage && <p className="text-warning" role="alert">{validityMessage}</p>}</div>}
      <AnalysisContent
        onSetTitulo={onSetTitulo}
        onSetDescripcion={onSetDescripcion}
        analysisId={analysisId}
        state={state}
        loading={loading}
        onSetStatus={onSetStatus}
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
  );
};

export default AnalysisBuilder;
