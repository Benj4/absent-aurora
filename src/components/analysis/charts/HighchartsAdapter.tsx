import { useEffect, useRef } from 'react';
import Highcharts from 'highcharts';

export default function HighchartsAdapter({ options, hasSeries }: { options: Highcharts.Options; hasSeries: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !hasSeries) return;
    const chart = Highcharts.chart(container.current, options);
    return () => chart.destroy();
  }, [options, hasSeries]);
  return <div ref={container} style={{ height: 360 }} />;
}
