'use client'

/**
 * Performance charts (D11 / M09). All colours are theme tokens, so every chart is
 * right in dark and light without a second code path. Each chart measures its own
 * width and draws in real pixels, so type never scales with the box.
 *
 *   <JkSparkline values={[…]} color="var(--bar-2)" label="Offer rate by month" />
 *   <JkGauge value={5.3} previous={3.1} previousLabel="OCT" />
 *   <JkSankey data={stats.sankey} />
 *   <JkWeeklyChart weeks={stats.weeks} average={stats.weeklyAverage} showInterviews />
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SankeyData, WeekPoint } from "@/lib/performance/stats";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Monotone cubic through points (no overshoot below the baseline). */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = (i: number) => pts[i + 1][0] - pts[i][0];
  const s = Array.from({ length: n - 1 }, (_, i) => (pts[i + 1][1] - pts[i][1]) / dx(i));
  const m = pts.map((_, i) => {
    if (i === 0) return s[0];
    if (i === n - 1) return s[n - 2];
    if (s[i - 1] * s[i] <= 0) return 0;
    return (s[i - 1] + s[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx(i) / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/* ─── Sparkline: 150×26 line, gold dot on the latest value ─────────────────── */

export function JkSparkline({
  values, color, label, className,
}: { values: (number | null)[]; color: string; label: string; className?: string }) {
  const W = 150, H = 26, pad = 3;
  const nums = values.map((v) => (v === null ? 0 : v));
  const max = Math.max(...nums, 0);
  if (values.every((v) => !v)) {
    return <div className={cn("h-[26px] w-[150px] max-w-full border-b border-dashed border-border", className)} role="img" aria-label={`${label}: nothing yet`} />;
  }
  const pts = nums.map((v, i) => [pad + (i * (W - pad * 2)) / (nums.length - 1), H - pad - (max ? (v / max) * (H - pad * 2) : 0)] as [number, number]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-[26px] w-[150px] max-w-full overflow-visible", className)} role="img" aria-label={`${label}: ${values.map((v) => (v === null ? "none" : Math.round(v * 10) / 10)).join(", ")}`}>
      <path d={smoothPath(pts)} fill="none" style={{ stroke: color }} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} style={{ fill: "var(--plan)" }} />
    </svg>
  );
}

/* ─── Gauge: half dial, this month's needle, last month's cyan tick ────────── */

export function JkGauge({
  value, previous, previousLabel, max: maxIn, className,
}: { value: number | null; previous: number | null; previousLabel: string; max?: number; className?: string }) {
  const max = maxIn ?? Math.max(10, Math.ceil((Math.max(value ?? 0, previous ?? 0) * 1.2) / 10) * 10);
  const cx = 79, cy = 95, r = 57.5;
  const ang = (v: number) => Math.PI - (Math.min(Math.max(v, 0), max) / max) * Math.PI;
  const pt = (a: number, rr: number) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(ang(from), r);
    const [x1, y1] = pt(ang(to), r);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  const v = value ?? 0;
  const [nx, ny] = pt(ang(v), 46);
  return (
    <svg viewBox="0 0 158 118" className={cn("h-[118px] w-[158px] overflow-visible", className)} role="img"
      aria-label={`Interview rate ${value === null ? "unknown" : `${value.toFixed(1)}%`} on a 0 to ${max}% dial${previous !== null ? `, ${previousLabel} ${previous.toFixed(1)}%` : ""}`}>
      <path d={arc(0, max)} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={9} strokeLinecap="round" />
      {v > 0 && <path d={arc(0, v)} fill="none" style={{ stroke: "var(--plan)" }} strokeWidth={9} strokeLinecap="round" />}
      {ticks.map((i) => {
        const a = Math.PI - (i / 10) * Math.PI;
        const major = i === 0 || i === 5 || i === 10;
        const [x0, y0] = pt(a, major ? 66 : 69);
        const [x1, y1] = pt(a, 74);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={1.5} style={{ stroke: major ? "var(--muted-foreground)" : "var(--border-strong)" }} />;
      })}
      <text x={cx} y={8} textAnchor="middle" className="font-mono text-[9px]" style={{ fill: "var(--subtle-foreground)" }}>{max / 2}%</text>
      <text x={cx - 62} y={114} textAnchor="middle" className="font-mono text-[9px]" style={{ fill: "var(--subtle-foreground)" }}>0</text>
      <text x={cx + 62} y={114} textAnchor="middle" className="font-mono text-[9px]" style={{ fill: "var(--subtle-foreground)" }}>{max}%</text>
      {previous !== null && (() => {
        const a = ang(previous);
        const [x0, y0] = pt(a, 51);
        const [x1, y1] = pt(a, 66);
        const [lx, ly] = pt(a, 38);
        return (
          <g>
            <line x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={2.5} strokeLinecap="round" style={{ stroke: "var(--bar-4-ink)" }} />
            <text x={lx} y={ly + 3} textAnchor="middle" className="font-mono text-[8.5px] font-medium" style={{ fill: "var(--bar-4-ink)" }}>{previousLabel}</text>
          </g>
        );
      })()}
      {value !== null && <line x1={cx} y1={cy} x2={nx} y2={ny} strokeWidth={2} strokeLinecap="round" style={{ stroke: "var(--foreground)" }} />}
      <circle cx={cx} cy={cy} r={5} style={{ fill: "var(--foreground)" }} />
      <circle cx={cx} cy={cy} r={2} style={{ fill: "var(--background)" }} />
    </svg>
  );
}

/* ─── Sankey: saved → applied / not applied → outcome ─────────────────────── */

const OUTCOME_COLOR: Record<SankeyData["outcomes"][number]["key"], string> = {
  offered: "var(--ok)",
  interviewing: "var(--bar-2)",
  waiting: "var(--warn)",
  rejected: "var(--destructive)",
  ghosted: "var(--subtle-foreground)",
};

function ribbon(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number) {
  const mx = (x0 + x1) / 2;
  return `M${x0},${y0a} C${mx},${y0a} ${mx},${y1a} ${x1},${y1a} L${x1},${y1b} C${mx},${y1b} ${mx},${y0b} ${x0},${y0b} Z`;
}

export function JkSankey({ data, height = 256, className }: { data: SankeyData; height?: number; className?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const NODE = 10, GAP = 14;
  const narrow = W > 0 && W < 480;

  const layout = useMemo(() => {
    if (!W || data.saved === 0) return null;
    const c1 = Math.round(W * (narrow ? 0.31 : 0.39));
    const c2 = Math.round(W * (narrow ? 0.56 : 0.72));
    const hasSplit = data.applied > 0 && data.notApplied > 0;
    const k = (height - (hasSplit ? GAP : 0)) / data.saved;
    const savedH = data.saved * k;
    const appliedH = data.applied * k;
    const notY = appliedH + (hasSplit ? GAP : 0);
    const notH = data.notApplied * k;
    // Outcome rows: each gets at least a label's height so names never collide.
    const rows = data.outcomes.filter((o) => o.count > 0);
    const ROW = 22;
    let y = 0;
    let srcY = 0;
    const outs = rows.map((o) => {
      const h = Math.max(o.count * k, 5);
      const slot = Math.max(h, ROW);
      const node = { ...o, y: y + (slot - h) / 2, h, cy: y + slot / 2, srcY, srcH: o.count * k };
      y += slot + 8;
      srcY += o.count * k;
      return node;
    });
    const off = Math.max(0, (appliedH - (y - 8)) / 2);
    outs.forEach((o) => { o.y += off; o.cy += off; });
    return { c1, c2, savedH, appliedH, notY, notH, outs, total: Math.max(height, y - 8, notY + notH) };
  }, [W, data, height, narrow]);

  const label = `Where ${data.saved} jobs ended up: ${data.applied} applied, ${data.notApplied} not applied yet; ${data.outcomes.map((o) => `${o.label} ${o.count}`).join(", ")}.`;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {data.saved === 0 ? (
        <p className="py-16 text-center text-[13.5px] text-muted-foreground">Nothing saved in this period yet.</p>
      ) : layout && (
        <div className="relative" style={{ height: layout.total }}>
          <svg width={W} height={layout.total} className="absolute inset-0 overflow-visible" role="img" aria-label={label}>
            <defs>
              <linearGradient id={`${uid}-a`} x1="0" x2="1">
                <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.5 }} />
                <stop offset="1" style={{ stopColor: "var(--warn)", stopOpacity: 0.4 }} />
              </linearGradient>
              <linearGradient id={`${uid}-n`} x1="0" x2="1">
                <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.5 }} />
                <stop offset="1" style={{ stopColor: "var(--bar-3)", stopOpacity: 0.55 }} />
              </linearGradient>
              {layout.outs.map((o) => (
                <linearGradient key={o.key} id={`${uid}-${o.key}`} x1="0" x2="1">
                  <stop offset="0" style={{ stopColor: "var(--warn)", stopOpacity: 0.35 }} />
                  <stop offset="1" style={{ stopColor: OUTCOME_COLOR[o.key], stopOpacity: 0.55 }} />
                </linearGradient>
              ))}
            </defs>
            {data.applied > 0 && <path d={ribbon(NODE, 0, layout.appliedH, layout.c1, 0, layout.appliedH)} fill={`url(#${uid}-a)`} />}
            {data.notApplied > 0 && <path d={ribbon(NODE, layout.appliedH, layout.savedH, layout.c1, layout.notY, layout.notY + layout.notH)} fill={`url(#${uid}-n)`} />}
            {layout.outs.map((o) => (
              <path key={o.key} d={ribbon(layout.c1 + NODE, o.srcY, o.srcY + o.srcH, layout.c2, o.y, o.y + o.h)} fill={`url(#${uid}-${o.key})`} />
            ))}
            <rect x={0} y={0} width={NODE} height={layout.savedH} rx={3} style={{ fill: "var(--primary)" }} />
            {data.applied > 0 && <rect x={layout.c1} y={0} width={NODE} height={layout.appliedH} rx={3} style={{ fill: "var(--warn)" }} />}
            {data.notApplied > 0 && <rect x={layout.c1} y={layout.notY} width={NODE} height={layout.notH} rx={3} style={{ fill: "var(--bar-3)" }} />}
            {layout.outs.map((o) => (
              <rect key={o.key} x={layout.c2} y={o.y} width={NODE} height={o.h} rx={2.5} style={{ fill: OUTCOME_COLOR[o.key] }} />
            ))}
          </svg>

          <SankeyNodeLabel x={22} y={layout.savedH / 2 + (data.notApplied > 0 ? 18 : -14)} value={data.saved} label="Saved" big />
          {data.applied > 0 && <SankeyNodeLabel x={layout.c1 + 22} y={Math.min(layout.appliedH / 2, layout.appliedH - 44) - 4} value={data.applied} label="Applied" />}
          {data.notApplied > 0 && <SankeyNodeLabel x={layout.c1 + 22} y={layout.notY + layout.notH / 2} value={data.notApplied} label="Not applied yet" />}
          {layout.outs.map((o) => (
            <div key={o.key} className="absolute flex items-center justify-between gap-3 text-[13.5px] leading-4" style={{ left: layout.c2 + 24, right: 0, top: o.cy - 8 }}>
              <span className="truncate text-foreground">{o.label}</span>
              <span className="font-mono text-[13px] font-medium text-foreground">{o.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SankeyNodeLabel({ x, y, value, label, big }: { x: number; y: number; value: number; label: string; big?: boolean }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: x, top: y - 14 }}>
      <p className={cn("font-medium text-foreground", big ? "text-[26px] leading-[31px] tracking-[-0.6px]" : "text-[20px] leading-6 tracking-[-0.4px]")}>{value}</p>
      <p className="mt-0.5 whitespace-nowrap font-mono text-[9.5px] font-medium uppercase tracking-[1.2px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ─── Applications per week: 12 weeks, average line, interview markers ────── */

const shortDate = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric" }).toUpperCase();

export function JkWeeklyChart({
  weeks, average, showInterviews, height = 222, className,
}: { weeks: WeekPoint[]; average: number; showInterviews: boolean; height?: number; className?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? weeks.length - 1;

  const AXIS = 26, TOP = 6, BOTTOM = 30;
  const plotW = Math.max(W - AXIS - 6, 0);
  const plotH = height - TOP - BOTTOM;
  const peak = Math.max(...weeks.map((w) => w.applied), average, 1);
  const yMax = Math.max(2, Math.ceil(peak / 2) * 2);
  const step = yMax <= 8 ? 2 : Math.ceil(yMax / 4 / 5) * 5;
  const top = Math.ceil(yMax / step) * step;
  const xs = (i: number) => AXIS + (i * plotW) / (weeks.length - 1);
  const ys = (v: number) => TOP + plotH - (v / top) * plotH;
  const pts = weeks.map((w, i) => [xs(i), ys(w.applied)] as [number, number]);
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${xs(weeks.length - 1)},${ys(0)} L${xs(0)},${ys(0)} Z` : "";
  const gridVals = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const labelIdx = [0, 4, 8, weeks.length - 1];
  const total = weeks.reduce((a, w) => a + w.applied, 0);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = Math.round(((x) / r.width) * (weeks.length - 1));
    setHover(Math.min(Math.max(i, 0), weeks.length - 1));
  };

  const w = weeks[active];
  const tipLeft = W ? Math.min(Math.max(xs(active) - 150, 0), W - 150) : 0;
  const tipRight = xs(active) < 170;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {W > 0 && (
        <>
          <svg width={W} height={height} className="block overflow-visible" role="img"
            aria-label={`Applications per week, last 12 weeks: ${weeks.map((x) => `${shortDate(x.start)} ${x.applied}`).join(", ")}. Average ${average.toFixed(1)}.`}>
            <defs>
              <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--bar-4-ink)", stopOpacity: 0.32 }} />
                <stop offset="1" style={{ stopColor: "var(--bar-4-ink)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {gridVals.map((g) => (
              <g key={g}>
                <line x1={AXIS} x2={W - 6} y1={ys(g)} y2={ys(g)} strokeDasharray={g === 0 ? undefined : "2 4"} style={{ stroke: "var(--border)" }} />
                <text x={0} y={ys(g) + 3} className="font-mono text-[9.5px]" style={{ fill: "var(--subtle-foreground)" }}>{g}</text>
              </g>
            ))}
            {total > 0 && <path d={area} fill={`url(#${uid}-fill)`} />}
            {total > 0 && (
              <g>
                <line x1={AXIS} x2={W - 6} y1={ys(average)} y2={ys(average)} strokeDasharray="5 4" style={{ stroke: "var(--subtle-foreground)" }} />
                <rect x={AXIS + 6} y={ys(average) - 20} width={58} height={15} rx={4} style={{ fill: "var(--background)" }} />
                <text x={AXIS + 10} y={ys(average) - 9} className="font-mono text-[9px] tracking-[0.6px]" style={{ fill: "var(--muted-foreground)" }}>AVG {average.toFixed(1)}</text>
              </g>
            )}
            <path d={line} fill="none" strokeWidth={2.5} strokeLinejoin="round" style={{ stroke: "var(--bar-4-ink)" }} />
            <line x1={xs(active)} x2={xs(active)} y1={TOP} y2={ys(0)} style={{ stroke: hover !== null ? "var(--border-strong)" : "transparent" }} />
            {weeks.map((wk, i) => {
              const [x, y] = pts[i];
              if (showInterviews && wk.interviews > 0) {
                return (
                  <g key={i}>
                    <line x1={x} x2={x} y1={y} y2={ys(0)} style={{ stroke: "var(--plan)" }} />
                    <circle cx={x} cy={y} r={9} style={{ fill: "var(--plan)", fillOpacity: 0.22 }} />
                    <circle cx={x} cy={y} r={7} style={{ fill: "var(--plan)" }} />
                  </g>
                );
              }
              if (i === active) {
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={9} fill="none" style={{ stroke: "var(--bar-4-ink)" }} />
                    <circle cx={x} cy={y} r={5} style={{ fill: "var(--bar-4-ink)" }} />
                  </g>
                );
              }
              return <circle key={i} cx={x} cy={y} r={3} strokeWidth={1.6} style={{ fill: "var(--background)", stroke: "var(--bar-4-ink)" }} />;
            })}
            {labelIdx.map((i) => (
              <text key={i} x={xs(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === weeks.length - 1 ? "end" : "middle"}
                className="font-mono text-[9.5px] tracking-[0.6px]" style={{ fill: "var(--subtle-foreground)" }}>{shortDate(weeks[i].start)}</text>
            ))}
            <rect x={AXIS - 8} y={0} width={plotW + 16} height={height - BOTTOM} fill="transparent"
              onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove} />
          </svg>
          {w && (
            <div
              className="pointer-events-none absolute rounded-xl border border-border-strong bg-popover px-3 py-2"
              style={{ left: tipRight ? Math.min(xs(active) + 14, W - 150) : tipLeft, top: Math.min(ys(w.applied) + 16, height - BOTTOM - 62), width: 142 }}
            >
              <p className="font-mono text-[8.5px] font-medium tracking-[0.8px] text-subtle-foreground">WEEK OF {shortDate(w.start)}</p>
              <p className="mt-1 text-[14px] font-medium text-foreground">
                {w.applied} applied {w.current && <span className="text-[12px] font-normal text-muted-foreground">so far</span>}
              </p>
              {showInterviews && w.interviews > 0 && (
                <p className="text-[12px] text-muted-foreground">{w.interviews} interview{w.interviews === 1 ? "" : "s"} booked</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
