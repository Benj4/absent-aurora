import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import Highcharts from 'highcharts';
import type { HCSeriesData, ModoAlineacion } from './analysis-builder.types';

const AnalysisChart: FC<{ series: HCSeriesData[]; mode: ModoAlineacion }> = ({ series, mode }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current || series.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    const maxLen = Math.max(...series.map(s => s.data.length));
    const indexCategories = Array.from({ length: maxLen }, (_, i) => `M${i}`);

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
        ? { type: 'datetime', crosshair: true, lineColor: 'transparent', tickColor: 'transparent' }
        : {
          categories: indexCategories,
          crosshair: true,
          title: { text: 'Posición relativa (meses)', style: { fontSize: '11px' } },
        },
      yAxis: {
        title: { text: '' },
        gridLineDashStyle: 'Dash',
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
        marker: { enabled: s.data.length <= 30, radius: 3, symbol: 'circle' },
        lineWidth: 2,
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
  }, [series, mode]);

  return <div ref={containerRef} style={{ height: 360 }} />;
};

export default AnalysisChart;
