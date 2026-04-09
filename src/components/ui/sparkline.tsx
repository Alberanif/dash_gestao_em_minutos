"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
}

export function Sparkline({ data, color, height = 60 }: SparklineProps) {
  if (!data || data.length < 2) return <div style={{ height }} />;

  const points = data.map((v) => ({ v }));
  const gradientId = `spark-${color.replace("#", "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 6, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.22} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
