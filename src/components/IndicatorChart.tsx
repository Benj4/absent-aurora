import Highcharts from 'highcharts';
import { useEffect, useRef } from 'react';

export type SeriesPoint = { date: string; value: number | string };

export default function IndicatorChart({ series = [], label = 'Serie' }: { series?: SeriesPoint[]; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const data = (series || []).map((d) => [new Date(d.date).getTime(), Number(d.value)]);

    if (chartRef.current) {
      chartRef.current.series[0].setData(data);
      chartRef.current.setTitle({ text: label });
    } else {
      chartRef.current = Highcharts.chart(containerRef.current, {
        chart: { type: 'line' },
        title: { text: label },
        xAxis: { type: 'datetime' },
        yAxis: { title: { text: 'Valor' } },
        series: [{ type: 'line', name: 'Valor', data }],
        credits: { enabled: false },
      });
    }

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [series, label]);

  return <div ref={containerRef} className="w-full h-90 rounded border" />;
}
