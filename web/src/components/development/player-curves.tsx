"use client";

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import type { Curves, CurvePoint } from "@/lib/curves";

type Pick = "rating" | "attendancePct" | "milestones";

function Mini({ title, points, field, domain, unit }: Readonly<{
  title: string; points: CurvePoint[]; field: Pick; domain: [number, number | "auto"]; unit: string;
}>) {
  const data = points.map((p) => ({ label: p.label, value: p[field] }));
  // A milestone count is 0, never missing, so "nothing yet" means all zeros.
  const has = field === "milestones"
    ? (data.some((d) => (d.value ?? 0) > 0) ? data.length : 0)
    : data.filter((d) => d.value !== null).length;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      {has < 2 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Not enough yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -28 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis domain={domain} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip formatter={(v) => [`${v}${unit}`, title]} contentStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-primary)" }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/**
 * Six months at a glance for one child: ratings, attendance, milestones, with a
 * plain sentence under each line that has enough to say. For coaches only.
 */
export function PlayerCurves({ curves }: Readonly<{ curves: Curves }>) {
  const sentences = [curves.reading.rating, curves.reading.attendance, curves.reading.milestones].filter((s): s is string => s !== null);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Progress over six months">
      <h2 className="text-base font-semibold">Last six months</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Mini title="Match rating" points={curves.points} field="rating" domain={[1, 5]} unit="" />
        <Mini title="Training attendance" points={curves.points} field="attendancePct" domain={[0, 100]} unit="%" />
        <Mini title="Milestones" points={curves.points} field="milestones" domain={[0, "auto"]} unit="" />
      </div>
      {sentences.length > 0 && (
        <ul className="space-y-1 text-sm">
          {sentences.map((s) => <li key={s}>{s}</li>)}
        </ul>
      )}
    </section>
  );
}
