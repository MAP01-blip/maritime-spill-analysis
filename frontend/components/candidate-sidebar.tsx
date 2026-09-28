import { cn } from "@/lib/utils"
import { MetricBadge, type Metric } from "@/components/metric-badge"
import { OilCharacterisation } from "@/components/oil-characterisation"
import { SarPreview } from "@/components/sar-preview"
import { getSpillLocationLabel, type Sample } from "@/components/dataset-explorer"
import { AlertTriangle, CheckCircle2, MinusCircle, ShieldCheck, MapPin, Wind, Calendar, Target, Ship, Ruler } from "lucide-react"

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
  sample,
  onAuditVesselA,
}: {
  sample?: Sample | null
  onAuditVesselA?: () => void
}) {
  if (sample) {
    return <SelectedSpillPanel sample={sample} />
  }

  return (
    <aside className="flex min-h-0 w-full flex-col gap-4 overflow-y-auto pr-0.5 lg:w-[380px]">
      <OilCharacterisation />

      <div className="shrink-0 rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">Candidate Ranking</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Attribution confidence for {candidates.length} vessels near estimated origin
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

function SelectedSpillPanel({ sample }: { sample: Sample }) {
  const radiusKm = Math.max(
    Math.sqrt((sample.area_km2 * 1_000_000) / Math.PI) / 1000,
    0.3
  )

  return (
    <aside className="flex min-h-0 w-full flex-col gap-4 overflow-y-auto pr-0.5 lg:w-[380px]">
      <div className="shrink-0 rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">Selected Spill Analysis</h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            Sample #{sample.id} · {sample.location.region}
          </p>
        </div>

        <div className="p-4">
          <div className="overflow-hidden rounded-lg border border-border bg-slate-950">
            <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-3 py-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                Segmentation mask shape
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">1:1</span>
            </div>
            <SarPreview
              sampleId={parseInt(sample.id)}
              showMask
              maskOnly
              width={320}
              height={220}
              className="h-auto w-full rounded-none"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Detection confidence</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                {(sample.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              {sample.confidence >= 0.85 ? "High confidence" : "Review required"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width]"
              style={{ width: `${sample.confidence * 100}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SpillMetric icon={<Target className="size-3" />} label="Area" value={`${sample.area_km2.toFixed(1)} km²`} />
            <SpillMetric icon={<Ruler className="size-3" />} label="Radius" value={`${radiusKm.toFixed(2)} km`} />
            <SpillMetric icon={<MapPin className="size-3" />} label="Coordinates" value={`${sample.location.lat.toFixed(2)}°, ${sample.location.lon.toFixed(2)}°`} />
            <SpillMetric icon={<MapPin className="size-3" />} label="Location" value={getSpillLocationLabel(sample.spillLocationClass)} />
            <SpillMetric icon={<Calendar className="size-3" />} label="Acquired" value={sample.acquisitionDate} />
            <SpillMetric icon={<Wind className="size-3" />} label="Wind / sea" value={`${sample.windSpeed} m/s · state ${sample.seaState}`} />
            <SpillMetric icon={<AlertTriangle className="size-3" />} label="Look-alike" value={`${Math.round(sample.lookAlikeProb * 100)}%`} />
          </div>

          <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nearby vessel attribution</p>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Ship className="size-3" /> MMSI</span>
              <span className="font-mono text-foreground">{sample.vesselAttribution.mmsi}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Distance</span>
              <span className="font-mono text-foreground">{sample.vesselAttribution.distance} km · {sample.vesselAttribution.status}</span>
            </div>
          </div>
        </div>
      </div>

      <OilCharacterisation incidentId={`Sample #${sample.id}`} />
    </aside>
  )
}

function SpillMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2">
      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate font-mono text-[11px] text-foreground">{value}</p>
    </div>
  )
}
