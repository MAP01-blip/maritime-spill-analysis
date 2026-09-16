import { cn } from "@/lib/utils"

type Tone = "good" | "warn" | "bad" | "muted"

const toneStyles: Record<Tone, { dot: string; bar: string; value: string }> = {
  good: { dot: "bg-[oklch(0.7_0.14_145)]", bar: "bg-[oklch(0.7_0.14_145)]", value: "text-[oklch(0.78_0.14_145)]" },
  warn: { dot: "bg-[oklch(0.75_0.15_75)]", bar: "bg-[oklch(0.75_0.15_75)]", value: "text-[oklch(0.8_0.15_75)]" },
  bad: { dot: "bg-destructive", bar: "bg-destructive", value: "text-destructive" },
  muted: { dot: "bg-muted-foreground", bar: "bg-muted-foreground", value: "text-muted-foreground" },
}

export interface Metric {
  label: string
  value: number | null // 0-100, null = abstained / no score
  tone: Tone
}

export function MetricBadge({ label, value, tone }: Metric) {
  const styles = toneStyles[tone]
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", styles.dot)} />
          {label}
        </span>
        <span className={cn("font-mono text-sm font-semibold tabular-nums", value === null ? "text-muted-foreground" : styles.value)}>
          {value === null ? "—" : value}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full transition-all", value === null ? "bg-muted-foreground/40" : styles.bar)}
          style={{ width: `${value ?? 6}%` }}
        />
      </div>
    </div>
  )
}
