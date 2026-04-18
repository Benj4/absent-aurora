import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import Highcharts from 'highcharts';
import type { HCEventMarker, HCSeriesData, ModoAlineacion } from './analysis-builder.types';

const AnalysisChart: FC<{ series: HCSeriesData[]; mode: ModoAlineacion; markers?: HCEventMarker[] }> = ({
  series,
  mode,
  markers = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current || series.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    const hasOverlay = series.some(s => s.yAxis === 1);
    const maxLen = Math.max(...series.map(s => s.data.length));
    const indexCategories = Array.from({ length: maxLen }, (_, i) => `M${i}`);
    const plotLines = markers.map(marker => ({
      value: marker.value,
      color: marker.color,
      width: 1,
      dashStyle: 'ShortDash' as const,
      zIndex: 3,
      label: {
        text: marker.label,
        rotation: 0,
        y: 14,
        x: 4,
        align: 'left' as const,
        style: {
          color: marker.color,
          fontSize: '10px',
          fontWeight: '500',
          textOutline: 'none',
        },
      },
    }));

    const options: Highcharts.Options = {
      chart: {
        type: 'line',
        animation: { duration: 250 },
        style: { fontFamily: 'inherit' },
        backgroundColor: 'transparent',
        marginTop: 8,
      },
      title: { text: undefined },
      xAxis: mode === 'calendario'
        ? {
          type: 'datetime',
          crosshair: true,
          lineColor: 'transparent',
          tickColor: 'transparent',
          plotLines,
        }
        : {
          categories: indexCategories,
          crosshair: true,
          title: { text: 'Posición relativa (meses)', style: { fontSize: '11px' } },
          plotLines,
        },
      yAxis: hasOverlay
        ? [
            {
              title: { text: '' },
              gridLineDashStyle: 'Dash' as const,
              gridLineColor: 'rgba(128,128,128,0.15)',
            },
            {
              title: { text: 'Base 100', style: { fontSize: '11px', color: 'rgba(128,128,128,0.7)' } },
              opposite: true,
              gridLineWidth: 0,
              labels: { style: { fontSize: '11px', color: 'rgba(128,128,128,0.6)' } },
            },
          ]
        : {
            title: { text: '' },
            gridLineDashStyle: 'Dash' as const,
            gridLineColor: 'rgba(128,128,128,0.15)',
          },
      legend: {
        enabled: series.length > 1,
        itemStyle: { fontWeight: '500', fontSize: '12px' },
      },
      tooltip: { shared: true, valueDecimals: 2 },
      series: series.map(s => ({
        type: 'line' as const,
        name: s.name,
        color: s.color,
        dashStyle: s.dashStyle,
        data: s.data,
        yAxis: s.yAxis ?? 0,
        marker: s.isReference
          ? { enabled: false }
          : { enabled: s.data.length <= 30, radius: 3, symbol: 'circle' as const },
        lineWidth: s.isReference ? 1 : 2,
        opacity: s.isReference ? 0.6 : 1,
      })),
      credits: { enabled: false },
      plotOptions: {
        series: { states: { hover: { lineWidthPlus: 1 } } },
      },
    };

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    chartRef.current = Highcharts.chart(containerRef.current, options);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [markers, mode, series]);

  return <div ref={containerRef} style={{ height: 360 }} />;
};

export default AnalysisChart;
