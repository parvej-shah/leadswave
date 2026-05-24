import * as React from "react";

export function Sparkline({
  data,
  color = "var(--amber)",
  height = 32,
  width = 140,
  showDot = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDot?: boolean;
}) {
  const id = React.useId().replace(/:/g, "");
  if (!data?.length) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points: [number, number][] = data.map((v, i) => {
    const x = i * stepX;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return [x, y];
  });

  const pathD = points.reduce<string>((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const mx = (px + x) / 2;
    return acc + ` Q ${px} ${py}, ${mx} ${(py + y) / 2} T ${x} ${y}`;
  }, "");

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block overflow-visible"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${id})`} />
      <path
        d={pathD}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && last && (
        <>
          <circle cx={last[0]} cy={last[1]} r="3" fill={color} opacity="0.25" />
          <circle cx={last[0]} cy={last[1]} r="1.75" fill={color} />
        </>
      )}
    </svg>
  );
}
