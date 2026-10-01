"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;   // formatted date label e.g. "12 Jun"
  rating: number; // 1–5
  opponent?: string;
}

interface Props {
  data: DataPoint[];
}

export function RatingChart({ data }: Props) {
  if (data.length < 2) return null; // need at least 2 points for a line

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
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
                {d.opponent && <p className="font-semibold">vs {d.opponent}</p>}
                <p className="text-muted-foreground">{d.date}</p>
                <p className="font-bold mt-0.5">{"★".repeat(d.rating)}{"☆".repeat(5 - d.rating)}</p>
              </div>
            );
          }}
        />
        <ReferenceLine y={3} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.4} />
        <Line
          type="monotone"
          dataKey="rating"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ fill: "var(--color-primary)", r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
