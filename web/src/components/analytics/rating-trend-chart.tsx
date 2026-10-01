"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  month: string;
  avg: number;
}

export function RatingTrendChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) return <p className="text-sm text-muted-foreground">Not enough data.</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DataPoint;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-semibold">{d.month}</p>
                <p className="text-muted-foreground">Avg: {d.avg.toFixed(2)}</p>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ fill: "var(--color-primary)", r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
