"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { MetricBadge, type Metric } from "@/components/metric-badge"
import { OilCharacterisation } from "@/components/oil-characterisation"
import { SarPreview } from "@/components/sar-preview"
import { getSpillLocationLabel, type Sample } from "@/components/dataset-explorer"
import {
  VesselAttributionBox,
  defaultVesselCandidates,
  getVesselCandidatesForSample,
  type VesselAttributionData,
} from "@/components/vessel-attribution-box"
import {
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  ShieldCheck,
  MapPin,
  Wind,
  Calendar,
  Target,
  Ship,
  Ruler,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react"

type RelevanceKey = "high" | "moderate" | "abstained"

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

export function CandidateSidebar({
  sample,
  onAuditVesselA,
  selectedCandidateRank = 1,
  onSelectCandidateRank,
}: {
  sample?: Sample | null
  onAuditVesselA?: () => void
  selectedCandidateRank?: number
  onSelectCandidateRank?: (rank: number) => void
}) {
  if (sample) {
    return (
      <SelectedSpillPanel
        sample={sample}
        onAuditVesselA={onAuditVesselA}
        selectedCandidateRank={selectedCandidateRank}
        onSelectCandidateRank={onSelectCandidateRank}
      />
    )
  }

  const activeCandidate =
    defaultVesselCandidates.find((c) => c.ranking === selectedCandidateRank) ||
    defaultVesselCandidates[0]

  return (
    <aside className="flex min-h-0 w-full flex-col gap-4 overflow-y-auto pr-0.5 lg:w-[380px]">
      {/* 1. Primary Vessel Attribution Box (Contains all 8 requested attributes) */}
      <VesselAttributionBox
        data={{
          ...activeCandidate,
          onAuditClick: activeCandidate.id === "A" ? onAuditVesselA : undefined,
        }}
        candidates={defaultVesselCandidates}
        onSelectCandidate={(cand) => onSelectCandidateRank?.(cand.ranking)}
        title="Candidate Vessel Dossier"
        isCollapsible={false}
      />

      {/* 2. Candidate Fleet Ranking Selector */}
      <div className="shrink-0 rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Candidate Fleet Ranking
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              {defaultVesselCandidates.length} vessels tracked
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ranked by multi-factor hindcast attribution confidence
          </p>
        </div>

        <ul className="divide-y divide-border">
          {defaultVesselCandidates.map((c, i) => {
            const isSelected = c.ranking === selectedCandidateRank
            const relKey: RelevanceKey =
              c.ranking === 1 ? "high" : c.ranking === 2 ? "moderate" : "abstained"
            const meta = relevanceMeta[relKey]

            return (
              <li
                key={c.id}
                onClick={() => onSelectCandidateRank?.(c.ranking)}
                className={cn(
                  "cursor-pointer p-3.5 transition-all duration-200 hover:bg-secondary/40",
                  isSelected && "bg-secondary/60 ring-1 ring-inset ring-primary/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md font-mono text-xs font-bold",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: c.accentColor }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-bold text-foreground">
                          {c.name}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        MMSI {c.mmsi} · IMO {c.imo}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        meta.className
                      )}
                    >
                      <meta.Icon className="size-3" aria-hidden="true" />
                      {c.rankingLabel}
                    </span>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {(c.confidenceScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Sub-summary: Oil cargo & distance from corridor */}
                <div className="mt-2.5 ml-8.5 grid grid-cols-1 gap-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Cargo:</span>
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {c.oilType.split("(")[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Corridor distance:</span>
                    <span className="font-mono font-medium text-foreground">
                      {c.corridorDistance.split("(")[0]}
                    </span>
                  </div>
                </div>

                {/* Metric pills preview */}
                <div className="mt-2.5 ml-8.5 grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">Spatial</span>
                    <span className="font-bold text-foreground">
                      {c.factors.spatial.score}%
                    </span>
                  </div>
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">Temporal</span>
                    <span className="font-bold text-foreground">
                      {c.factors.temporal.score}%
                    </span>
                  </div>
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">AIS Q.</span>
                    <span className="font-bold text-foreground">
                      {c.factors.aisQuality.score}%
                    </span>
                  </div>
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">Traj.</span>
                    <span className="font-bold text-foreground">
                      {c.factors.trajectory.score}%
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <OilCharacterisation />
    </aside>
  )
}

function SelectedSpillPanel({
  sample,
  onAuditVesselA,
  selectedCandidateRank = 1,
  onSelectCandidateRank,
}: {
  sample: Sample
  onAuditVesselA?: () => void
  selectedCandidateRank?: number
  onSelectCandidateRank?: (rank: number) => void
}) {
  const radiusKm = Math.max(
    Math.sqrt((sample.area_km2 * 1_000_000) / Math.PI) / 1000,
    0.3
  )

  const candidates = useMemo(() => getVesselCandidatesForSample(sample), [sample])
  const activeVessel =
    candidates.find((c) => c.ranking === selectedCandidateRank) || candidates[0]

  return (
    <aside className="flex min-h-0 w-full flex-col gap-4 overflow-y-auto pr-0.5 lg:w-[380px]">
      {/* 1. Complete Vessel Attribution Box for Selected Spill Sample with fleet switcher */}
      <VesselAttributionBox
        data={{
          ...activeVessel,
          onAuditClick: onAuditVesselA,
        }}
        candidates={candidates}
        onSelectCandidate={(cand) => onSelectCandidateRank?.(cand.ranking)}
        title="Attributed Suspect Dossier"
        isCollapsible={false}
      />

      {/* 2. Candidate Fleet Ranking for this specific spill */}
      <div className="shrink-0 rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Candidate Fleet Ranking
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              {candidates.length} vessels tracked
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ranked by multi-factor hindcast attribution confidence
          </p>
        </div>

        <ul className="divide-y divide-border">
          {candidates.map((c, i) => {
            const isSelected = c.ranking === selectedCandidateRank
            const relKey: RelevanceKey =
              c.ranking === 1 ? "high" : c.ranking === 2 ? "moderate" : "abstained"
            const meta = relevanceMeta[relKey]

            return (
              <li
                key={c.mmsi}
                onClick={() => onSelectCandidateRank?.(c.ranking)}
                className={cn(
                  "cursor-pointer p-3.5 transition-all duration-200 hover:bg-secondary/40",
                  isSelected && "bg-secondary/60 ring-1 ring-inset ring-primary/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md font-mono text-xs font-bold",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: c.accentColor }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-bold text-foreground">
                          {c.name}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        MMSI {c.mmsi} · IMO {c.imo}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        meta.className
                      )}
                    >
                      <meta.Icon className="size-3" aria-hidden="true" />
                      {c.rankingLabel}
                    </span>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {(c.confidenceScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 ml-8.5 grid grid-cols-1 gap-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Cargo:</span>
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {c.oilType.split("(")[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Corridor distance:</span>
                    <span className="font-mono font-medium text-foreground">
                      {c.corridorDistance.split("(")[0]}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 ml-8.5 grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">Spatial</span>
                    <span className="font-bold text-foreground">
                      {c.factors.spatial.score}%
                    </span>
                  </div>
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">Temporal</span>
                    <span className="font-bold text-foreground">
                      {c.factors.temporal.score}%
                    </span>
                  </div>
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">AIS Q.</span>
                    <span className="font-bold text-foreground">
                      {c.factors.aisQuality.score}%
                    </span>
                  </div>
                  <div className="rounded bg-secondary/50 p-1">
                    <span className="text-muted-foreground text-[9px] block">Traj.</span>
                    <span className="font-bold text-foreground">
                      {c.factors.trajectory.score}%
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 3. Spill Mask & Physics Analysis Card */}
      <div className="shrink-0 rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Selected Spill Analysis
          </h2>
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
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                SAR Detection confidence
              </p>
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
            <SpillMetric
              icon={<Target className="size-3" />}
              label="Area"
              value={`${sample.area_km2.toFixed(1)} km²`}
            />
            <SpillMetric
              icon={<Ruler className="size-3" />}
              label="Radius"
              value={`${radiusKm.toFixed(2)} km`}
            />
            <SpillMetric
              icon={<MapPin className="size-3" />}
              label="Coordinates"
              value={`${sample.location.lat.toFixed(2)}°, ${sample.location.lon.toFixed(2)}°`}
            />
            <SpillMetric
              icon={<MapPin className="size-3" />}
              label="Location"
              value={getSpillLocationLabel(sample.spillLocationClass)}
            />
            <SpillMetric
              icon={<Calendar className="size-3" />}
              label="Acquired"
              value={sample.acquisitionDate}
            />
            <SpillMetric
              icon={<Wind className="size-3" />}
              label="Wind / sea"
              value={`${sample.windSpeed} m/s · state ${sample.seaState}`}
            />
            <SpillMetric
              icon={<AlertTriangle className="size-3" />}
              label="Look-alike"
              value={`${Math.round(sample.lookAlikeProb * 100)}%`}
            />
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
