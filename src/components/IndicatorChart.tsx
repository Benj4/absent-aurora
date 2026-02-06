import { useEffect, useRef } from 'preact/hooks';

export type SeriesPoint = { date: string; value: number | string };

export default function IndicatorChart({ series = [], label = 'Serie' }: { series?: SeriesPoint[]; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scriptId = 'highcharts-js';

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const data = (series || []).map((d) => ([new Date(d.date).getTime(), Number(d.value)]));

    function render() {
      // @ts-ignore - Highcharts is loaded on window at runtime
      if (typeof (window as any).Highcharts !== 'undefined') {
        // @ts-ignore
        (window as any).Highcharts.chart(el, {
          chart: { type: 'line' },
          title: { text: label },
          xAxis: { type: 'datetime' },
          yAxis: { title: { text: 'Valor' } },
          series: [{ name: 'Valor', data }],
          credits: { enabled: false },
        });
      }
    }

    // If Highcharts already loaded, just render
    if (typeof (window as any).Highcharts !== 'undefined') {
      render();
      return;
    }

    // Otherwise inject script and render on load
    let s = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://code.highcharts.com/highcharts.js';
      s.async = true;
      s.onload = () => {
        render();
      };
      document.head.appendChild(s);
    } else if (s && (window as any).Highcharts) {
      render();
    } else {
      s.addEventListener('load', render);
    }

    return () => {
      // Try to clean up by removing chart container content
      if (el) el.innerHTML = '';
    };
  }, [series, label]);

  return <div ref={containerRef} className="w-full h-90 rounded border" />;
}
