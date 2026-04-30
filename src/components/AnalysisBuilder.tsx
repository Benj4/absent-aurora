import type { FC } from 'react';
import { useState, useCallback } from 'react';
import { useAnalisisState } from './analysis-builder/use-analisis-state';
import AnalysisSidebar from './analysis-builder/AnalysisSidebar';
import AnalysisContent from './analysis-builder/AnalysisContent';
import { saveAnalysis, updateAnalysis } from '../lib/analysis';

interface AnalysisBuilderProps {
  mode: 'new' | 'edit';
}

const AnalysisBuilder: FC<AnalysisBuilderProps> = ({ mode }) => {
  const analysisId = mode === 'edit' && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id') ?? undefined
    : undefined;
  const {
    state,
    onSetTitulo, onSetDescripcion, onSetRegion, onSetModo,
    onSetShowBase100Line,
    onToggleIndicator, onAddPeriodo, onUpdatePeriodo, onRemovePeriodo,
    onToggleMacroEvent, onSelectSource, onReset,
    macroEvents, macroEventsLoading, macroEventsSearch, setMacroEventsSearch,
    markerModeByEventId, setMarkerModeByEventId,
    markerColorByEventId, setMarkerColorByEventId,
    loading, copied, handleShare,
    sourceConflicts, chartSeries, selectedMacroEvents, chartMarkers,
    hasData, isConfigured, displayTitle, periodsSummary, tableRows,
  } = useAnalisisState(analysisId);

  const isEditMode = Boolean(analysisId);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    const result = isEditMode
      ? await updateAnalysis(analysisId!, state)
      : await saveAnalysis(state);
    setIsSaving(false);
    if ('error' in result) {
      setSaveError(result.error);
    }
  }, [state, isEditMode, analysisId]);

  return (
    <div className="flex bg-base-200/20" style={{ height: 'calc(100svh - 7rem)', overflow: 'hidden' }}>
      <AnalysisSidebar
        state={state}
        onSetTitulo={onSetTitulo}
        onSetDescripcion={onSetDescripcion}
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
        onReset={onReset}
        onSave={handleSave}
        isSaving={isSaving}
        saveError={saveError}
        isEditMode={isEditMode}
      />

      <AnalysisContent
        state={state}
        loading={loading}
        copied={copied}
        handleShare={handleShare}
        sourceConflicts={sourceConflicts}
        chartSeries={chartSeries}
        selectedMacroEvents={selectedMacroEvents}
        chartMarkers={chartMarkers}
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
  );
};

export default AnalysisBuilder;


