import type { FC } from 'react';
import { useAnalisisState } from './analysis-builder/use-analisis-state';
import AnalysisSidebar from './analysis-builder/AnalysisSidebar';
import AnalysisContent from './analysis-builder/AnalysisContent';

const AnalysisBuilder: FC = () => {
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
    kpiRows, hasData, isConfigured, displayTitle, periodsSummary, tableRows,
  } = useAnalisisState();

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
        kpiRows={kpiRows}
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


