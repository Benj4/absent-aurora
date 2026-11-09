import type Highcharts from 'highcharts';
import type { HCSeriesData, HCEventMarker } from '../../../lib/analysis-types';

export function chartOptions(series: HCSeriesData[], markers: HCEventMarker[], xAxis: Highcharts.XAxisOptions): Highcharts.Options {
  const hasOverlay = series.some(s => s.yAxis === 1);
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
    xAxis: { ...xAxis, plotLines: [...(xAxis.plotLines ?? []), ...plotLines] },
    yAxis: hasOverlay
      ? [
          {
            title: { text: '' },
            gridLineDashStyle: 'Dash' as const,
            gridLineColor: 'rgba(128,128,128,0.15)',
            labels: { style: { color: 'var(--color-base-content)' } },
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
            labels: { style: { color: 'var(--color-base-content)' } },
        },
    legend: {
      enabled: true,
      itemStyle: { color: 'var(--color-base-content)', fontWeight: '500', fontSize: '12px' },
    },
    tooltip: {
      shared: false,
      formatter() {
        const point = this.options as Highcharts.PointOptionsObject & { custom?: HCSeriesData['data'][number]['custom'] };
        const meta = point.custom;
        if (!meta) return false;
        const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
        return `<b>${escape(meta.indicator)}</b><br/>${meta.period ? `Período: ${escape(meta.period)}<br/>` : ''}Fecha original: ${escape(meta.date)}<br/>${meta.elapsed != null ? `Posición: M${meta.elapsed}<br/>` : ''}${this.series.options.yAxis === 1 ? 'Base 100' : 'Valor'}: ${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(this.y ?? 0)}<br/>Fuente: ${escape(meta.source)}`;
      },
    },
    series: series.map(s => ({
      type: 'line' as const,
      name: s.name,
      color: s.color,
      dashStyle: s.dashStyle,
      data: s.data,
      showInLegend: s.showInLegend,
      yAxis: s.yAxis ?? 0,
      marker: s.isInvalid
        ? { enabled: true, radius: 6, symbol: 'diamond' as const, lineWidth: 2, lineColor: '#dc2626' }
        : s.isReference
        ? { enabled: false }
        : { enabled: s.data.length <= 30, radius: 3, symbol: 'circle' as const },
      lineWidth: s.isInvalid ? 0 : s.isReference ? 1 : 2,
      opacity: s.isReference ? 0.6 : 1,
    })),
    credits: { enabled: false },
    plotOptions: {
      series: { states: { hover: { lineWidthPlus: 1 } } },
    },
  };

  return options;
}
