import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
export type Frame = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  compact: boolean;
};
export function PlotFrame({
  label,
  children,
  viewport,
}: {
  label: string;
  children: (frame: Frame) => ReactNode;
  viewport: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0)
        setWidth(Math.max(120, Math.round(entry.contentRect.width)));
    });
    observer.observe(svg.current!);
    return () => observer.disconnect();
  }, []);
  const compact = width < 250;
  const height = compact ? 210 : 252;
  const frame = {
    width,
    height,
    left: compact ? 34 : 48,
    right: width - 12,
    top: 30,
    bottom: height - 46,
    compact,
  };
  return (
    <svg
      ref={svg}
      className={`density-chart ${compact ? 'compact-chart' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      data-viewport={viewport}
    >
      {children(frame)}
    </svg>
  );
}
export function formatNumber(value: number | null): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(value);
}
export function tick(value: number): string {
  return value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 10000)
    ? value.toExponential(1).replace('e+', 'e')
    : Number(value.toPrecision(3)).toString();
}
