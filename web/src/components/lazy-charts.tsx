"use client";

// The charts (recharts) are about a third of what the heaviest pages download, and
// every one of them measures the screen before it draws, so there is nothing to
// show on the server anyway. Pages import the charts from here: they load after the
// page is usable, behind a placeholder of the chart's own height so nothing jumps.
// (Pages are Server Components, which cannot use `ssr: false` themselves.)

import dynamic from "next/dynamic";

function placeholder(height: number) {
  return function ChartPlaceholder() {
    return <div style={{ height }} className="w-full animate-pulse rounded-lg bg-muted/40" role="status" aria-label="Loading chart" />;
  };
}

export const RatingChart = dynamic(() => import("./rating-chart").then((m) => m.RatingChart), {
  ssr: false,
  loading: placeholder(180),
});
export const PlayerCurves = dynamic(() => import("./development/player-curves").then((m) => m.PlayerCurves), {
  ssr: false,
  loading: placeholder(110),
});
export const PositionPieChart = dynamic(() => import("./analytics/position-pie-chart").then((m) => m.PositionPieChart), {
  ssr: false,
  loading: placeholder(220),
});
export const RatingTrendChart = dynamic(() => import("./analytics/rating-trend-chart").then((m) => m.RatingTrendChart), {
  ssr: false,
  loading: placeholder(200),
});
