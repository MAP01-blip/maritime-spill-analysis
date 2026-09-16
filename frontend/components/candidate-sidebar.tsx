import { cn } from "@/lib/utils"
import { MetricBadge, type Metric } from "@/components/metric-badge"
import { ChemicalComposition } from "@/components/chemical-composition"
import { AlertTriangle, CheckCircle2, MinusCircle, ShieldCheck } from "lucide-react"

type RelevanceKey = "high" | "moderate" | "abstained"

interface Candidate {
  id: string
  name: string
  mmsi: string
  relevance: string
  relevanceKey: RelevanceKey
  note?: string
  score: number | null
  accent: string
}

const candidates: Candidate[] = [
  {
    id: "A",
    name: "Vessel A",
    mmsi: "MMSI 636092841",
    relevance: "High Relevance",
    relevanceKey: "high",
    score: 0.91,
    accent: "var(--color-chart-1)",
  },
  {
    id: "B",
    name: "Vessel B",
    mmsi: "MMSI 538007612",
    relevance: "Moderate Relevance",
    relevanceKey: "moderate",
    note: "AIS Gap",
    score: 0.58,
    accent: "var(--color-chart-2)",
  },
  {
    id: "C",
    name: "Vessel C",
    mmsi: "MMSI 244810395",
    relevance: "Abstained",
    relevanceKey: "abstained",
    note: "Insufficient evidence",
    score: null,
    accent: "var(--color-chart-3)",
  },
]

const relevanceMeta: Record<
  RelevanceKey,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  high: {
    className: "border-[oklch(0.7_0.14_145)]/40 bg-[oklch(0.7_0.14_145)]/15 text-[oklch(0.82_0.14_145)]",
    Icon: CheckCircle2,
  },
  moderate: {
    className: "border-[oklch(0.75_0.15_75)]/40 bg-[oklch(0.75_0.15_75)]/15 text-[oklch(0.82_0.15_75)]",
    Icon: AlertTriangle,
  },
  abstained: {
    className: "border-border bg-secondary text-muted-foreground",
    Icon: MinusCircle,
  },
}

// Per-candidate metric breakdown: Spatial, Temporal, Trajectory, AIS Quality
const metricsById: Record<string, Metric[]> = {
  A: [
    { label: "Spatial", value: 94, tone: "good" },
    { label: "Temporal", value: 88, tone: "good" },
    { label: "Trajectory", value: 90, tone: "good" },
    { label: "AIS Quality", value: 96, tone: "good" },
  ],
  B: [
    { label: "Spatial", value: 71, tone: "warn" },
    { label: "Temporal", value: 63, tone: "warn" },
    { label: "Trajectory", value: 55, tone: "warn" },
    { label: "AIS Quality", value: 34, tone: "bad" },
  ],
  C: [
    { label: "Spatial", value: 42, tone: "muted" },
    { label: "Temporal", value: null, tone: "muted" },
    { label: "Trajectory", value: 29, tone: "muted" },
    { label: "AIS Quality", value: null, tone: "muted" },
  ],
}

export function CandidateSidebar({
  onAuditVesselA,
}: {
  onAuditVesselA?: () => void
}) {
  return (
    <aside className="flex w-full flex-col gap-4 lg:w-[380px]">
      <ChemicalComposition />

      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Candidate Ranking</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Attribution confidence for {candidates.length} vessels near the estimated origin
          </p>
        </div>

        <ul className="divide-y divide-border">
          {candidates.map((c, i) => {
            const meta = relevanceMeta[c.relevanceKey]
            return (
              <li key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 items-center justify-center rounded-md bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: c.accent }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold">{c.name}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.mmsi}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        meta.className,
                      )}
                    >
                      <meta.Icon className="size-3" aria-hidden="true" />
                      {c.relevance}
                    </span>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      {c.score === null ? (
                        <span className="text-muted-foreground">n/a</span>
                      ) : (
                        c.score.toFixed(2)
                      )}
                    </p>
                  </div>
                </div>

                {c.note ? (
                  <p className="mt-2 ml-9 inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground">
                    {c.note}
                  </p>
                ) : null}

                <div className="mt-3 ml-9 grid grid-cols-2 gap-2">
                  {metricsById[c.id].map((m) => (
                    <MetricBadge key={m.label} {...m} />
                  ))}
                </div>

                {c.id === "A" ? (
                  <button
                    onClick={onAuditVesselA}
                    className="mt-3 ml-9 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Evidence Audit Trail
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
