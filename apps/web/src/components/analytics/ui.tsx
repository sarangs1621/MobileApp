"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export { formatPaise } from "../fees/ui";

/** A normalized {x-label, y-value} point — every single-series chart consumes this. */
export interface ChartPoint {
  label: string;
  value: number | null;
}

/**
 * Validated categorical palette (dataviz skill `references/palette.md`, light steps,
 * fixed order — never cycled). Used only where identity needs distinct hues (the fee
 * status pie); single-series charts use the theme's primary. ponytail: light steps in
 * both modes for v1 — the dark steps exist in the ref if we tune later.
 */
const CATEGORICAL = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
];

const PRIMARY = "hsl(var(--primary))";
const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  color: "hsl(var(--foreground))",
} as const;

const axisProps = { stroke: AXIS, fontSize: 12, tickLine: false } as const;

/* ─────────────────────────────── layout primitives ────────────────────────────── */

export function Panel({
  title,
  onExport,
  children,
}: {
  title: string;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background"
          >
            Export CSV
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>;
}

/* ─────────────────────────────────── charts ───────────────────────────────────── */

/** Single-series area — change-over-time (attendance %). One hue, no legend. */
export function AreaTrend({ data, unit = "" }: { data: ChartPoint[]; unit?: string }) {
  if (data.length === 0) {
    return <Empty />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} unit={unit} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}${unit}`} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={PRIMARY}
          strokeWidth={2}
          fill={PRIMARY}
          fillOpacity={0.15}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Single-series line — a GPA / exam trend. */
export function LineTrend({ data, unit = "" }: { data: ChartPoint[]; unit?: string }) {
  if (data.length === 0) {
    return <Empty />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} unit={unit} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}${unit}`} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={PRIMARY}
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Single-series bar — magnitude by category (monthly collection, per-section average). */
export function BarSeries({
  data,
  unit = "",
  moneyPaise = false,
}: {
  data: ChartPoint[];
  unit?: string;
  moneyPaise?: boolean;
}) {
  if (data.length === 0) {
    return <Empty />;
  }
  const fmt = (v: unknown) =>
    moneyPaise ? `₹${(Number(v) / 100).toLocaleString("en-IN")}` : `${String(v)}${unit}`;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmt(value)} />
        <Bar dataKey="value" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Categorical breakdown (fee status) — validated palette + a legend so identity is never color-alone. */
export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  const shown = data.filter((d) => d.value > 0);
  if (shown.length === 0) {
    return <Empty />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={shown}
          dataKey="value"
          nameKey="name"
          innerRadius={45}
          outerRadius={80}
          paddingAngle={2}
        >
          {shown.map((d, i) => (
            <Cell key={d.name} fill={CATEGORICAL[i % CATEGORICAL.length] ?? PRIMARY} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
