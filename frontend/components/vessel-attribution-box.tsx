"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Ship,
  Radio,
  Target,
  Ruler,
  Clock,
  Compass,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from "lucide-react"

export interface FactorDetail {
  score: number | null // 0 - 100 or null if abstained
  label: string
  description: string
  weight?: number // e.g. 0.3
  status?: "good" | "warn" | "bad" | "muted"
}

export interface VesselAttributionData {
  id?: string
  name: string
  mmsi: string
  imo?: string
  ranking: number
  totalRanked?: number
  rankingLabel?: string // e.g. "Primary Suspect"
  evidenceFactor: string | number // e.g. "0.94 (Multi-Source Attestation)"
  oilType: string // The kind of oil the ship was carrying
  oilCategory?: string // e.g. "Crude Oil" | "Fuel Oil" | "Distillate"
  corridorDistance: string // Distance from approx source corridor
  corridorOffsetKm?: number // e.g. 0.38
  corridorStatus?: "core" | "margin" | "outside"
  confidenceScore: number // 0.0 - 1.0 or 0 - 100
  factors: {
    spatial: FactorDetail
    temporal: FactorDetail
    aisQuality: FactorDetail
    trajectory: FactorDetail
  }
  status?: string // "Active" | "AIS Gap"
  accentColor?: string
  lastSeenTime?: string
  speedKnots?: number
  headingDeg?: number
  onAuditClick?: () => void
}

interface VesselAttributionBoxProps {
  data: VesselAttributionData
  candidates?: VesselAttributionData[]
  onSelectCandidate?: (candidate: VesselAttributionData) => void
  title?: string
  variant?: "full" | "compact" | "card" | "map-overlay"
  className?: string
  isCollapsible?: boolean
  defaultExpanded?: boolean
  onAuditClick?: () => void
}

export function VesselAttributionBox({
  data,
  candidates,
  onSelectCandidate,
  title = "Vessel Attribution & Forensic Dossier",
  variant = "full",
  className,
  isCollapsible = false,
  defaultExpanded = true,
  onAuditClick,
}: VesselAttributionBoxProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showFactorDetails, setShowFactorDetails] = useState(true)

  // Normalize confidence score to 0 - 100 percentage
  const confPercent =
    data.confidenceScore <= 1
      ? Math.round(data.confidenceScore * 100)
      : Math.round(data.confidenceScore)

  // Tone color styling helper
  const getFactorBadge = (status?: string, val?: number | null) => {
    if (val === null || val === undefined) {
      return {
        badge: "border-border bg-secondary text-muted-foreground",
        bar: "bg-muted-foreground/30",
        label: "Abstained",
      }
    }
    if (status === "good" || (!status && val >= 80)) {
      return {
        badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        bar: "bg-emerald-400",
        label: "High Match",
      }
    }
    if (status === "warn" || (!status && val >= 50)) {
      return {
        badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        bar: "bg-amber-400",
        label: "Moderate",
      }
    }
    return {
      badge: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      bar: "bg-rose-500",
      label: "Discrepancy",
    }
  }

  // Ranking tone
  const getRankingBadge = (rank: number) => {
    if (rank === 1) {
      return {
        className:
          "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
        badgeText: `RANK #1 · ${data.rankingLabel || "PRIMARY SUSPECT"}`,
        accent: "text-cyan-400",
      }
    }
    if (rank === 2) {
      return {
        className:
          "border-amber-500/40 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
        badgeText: `RANK #2 · ${data.rankingLabel || "PERSON OF INTEREST"}`,
        accent: "text-amber-400",
      }
    }
    return {
      className:
        "border-border bg-secondary/80 text-muted-foreground ring-1 ring-border",
      badgeText: `RANK #${rank} · ${data.rankingLabel || "ABSTAINED"}`,
      accent: "text-muted-foreground",
    }
  }

  const rankMeta = getRankingBadge(data.ranking)
  const handleAudit = onAuditClick || data.onAuditClick

  return (
    <div
      id={`vessel-attribution-box-${data.mmsi.replace(/\D/g, "") || "default"}`}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/95 text-card-foreground shadow-lg backdrop-blur-md transition-all duration-300",
        variant === "map-overlay" &&
          "max-w-md border-cyan-800/60 bg-slate-950/92 shadow-2xl ring-1 ring-cyan-500/20",
        className
      )}
    >
      {/* Top Header / Bar */}
      <div className="flex items-center justify-between border-b border-border/80 bg-secondary/30 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Ship className="size-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>{title}</span>
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <div className="flex items-center gap-2 truncate">
              <h3 className="truncate text-sm font-bold tracking-tight text-foreground transition-colors duration-200">
                {data.name}
              </h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-all duration-200",
              rankMeta.className
            )}
          >
            {rankMeta.badgeText}
          </span>
          {isCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse dossier box" : "Expand dossier box"}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-300 ease-in-out",
                  expanded && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Candidate Fleet Ranking Switcher (Shown if multiple candidate vessels are provided) */}
      {candidates && candidates.length > 1 && (
        <div className="border-b border-border/70 bg-secondary/30 px-3 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3 text-primary" />
              Candidate Fleet Ranking ({candidates.length} Vessels)
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">Select candidate</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {candidates.map((cand) => {
              const isSelected = cand.ranking === data.ranking || cand.mmsi === data.mmsi
              const candMeta = getRankingBadge(cand.ranking)

              return (
                <button
                  key={cand.mmsi}
                  type="button"
                  onClick={() => onSelectCandidate?.(cand)}
                  className={cn(
                    "flex flex-col rounded-md border p-1.5 text-left transition-all duration-200 cursor-pointer outline-none",
                    isSelected
                      ? "border-cyan-500/70 bg-cyan-950/40 ring-1 ring-cyan-500/50 shadow-xs"
                      : "border-border/60 bg-secondary/40 hover:bg-secondary/80 hover:border-border"
                  )}
                >
                  <div className="flex w-full items-center justify-between text-[10px]">
                    <span
                      className={cn(
                        "font-mono font-bold px-1 rounded text-[9px]",
                        cand.ranking === 1
                          ? "bg-cyan-500/25 text-cyan-300"
                          : cand.ranking === 2
                          ? "bg-amber-500/25 text-amber-300"
                          : "bg-slate-700/40 text-slate-300"
                      )}
                    >
                      #{cand.ranking}
                    </span>
                    <span className="font-mono font-bold text-[10px] tabular-nums text-foreground">
                      {(cand.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="truncate w-full font-bold text-[11px] text-foreground mt-1">
                    {cand.name}
                  </span>
                  <span className="truncate w-full text-[9px] text-muted-foreground font-mono">
                    {cand.mmsi.startsWith("MMSI") ? cand.mmsi : `MMSI ${cand.mmsi}`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Smooth Collapsible Content Container */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          !isCollapsible || expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-3.5 space-y-3.5">
            {/* Main Key Indicators Grid: Confidence Score & Evidence Factor */}
            <div className="grid grid-cols-2 gap-2">
              {/* Confidence Score Block */}
              <div className="relative overflow-hidden rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900/40 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-cyan-400" />
                    Confidence Score
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase transition-all duration-300",
                      confPercent >= 80
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : confPercent >= 50
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-700/40 text-slate-300 border border-slate-600/40"
                    )}
                  >
                    {confPercent >= 80 ? "High" : confPercent >= 50 ? "Moderate" : "Low"}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-black tracking-tight text-cyan-100 tabular-nums transition-all duration-300">
                    {confPercent}%
                  </span>
                  <span className="font-mono text-[11px] text-cyan-400/70">
                    ({(confPercent / 100).toFixed(2)})
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 ease-out"
                    style={{ width: `${confPercent}%` }}
                  />
                </div>
              </div>

              {/* Evidence Factor Block */}
              <div className="relative overflow-hidden rounded-lg border border-border bg-secondary/30 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  Evidence Factor
                </span>
                <div className="mt-1">
                  <span className="font-mono text-base font-bold text-foreground transition-all duration-300">
                    {typeof data.evidenceFactor === "number"
                      ? data.evidenceFactor.toFixed(2)
                      : data.evidenceFactor}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">
                  Corroborated by reverse-drift & AIS history
                </p>
              </div>
            </div>

            {/* Core Identification & Corridor Distance Info */}
            <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/20 p-2.5 text-xs">
              {/* AIS ID & IMO */}
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                  <Radio className="size-3.5 text-primary" />
                  AIS Identifier
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {data.mmsi.startsWith("MMSI") ? data.mmsi : `MMSI ${data.mmsi}`}
                  {data.imo ? ` · IMO ${data.imo}` : ""}
                </span>
              </div>

              {/* The Kind of Oil the Ship Was Carrying */}
              <div className="border-b border-border/40 pb-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Droplets className="size-3.5 text-amber-400" />
                    Oil Cargo Carried
                  </span>
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-300 border border-amber-500/30">
                    {data.oilCategory || "Verified Manifest"}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-amber-200/90 text-xs pl-5 transition-colors duration-200">
                  {data.oilType}
                </p>
              </div>

              {/* Distance from Approx Source Corridor */}
              <div className="pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Ruler className="size-3.5 text-cyan-400" />
                    Source Corridor Distance
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase border transition-all duration-300",
                      data.corridorStatus === "core" ||
                        (data.corridorOffsetKm !== undefined && data.corridorOffsetKm < 1)
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : data.corridorStatus === "margin" ||
                          (data.corridorOffsetKm !== undefined && data.corridorOffsetKm < 3)
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                  >
                    {data.corridorStatus === "core" ||
                    (data.corridorOffsetKm !== undefined && data.corridorOffsetKm < 1)
                      ? "In Core Corridor"
                      : data.corridorStatus === "margin"
                      ? "Corridor Margin"
                      : "Outer Envelope"}
                  </span>
                </div>
                <p className="mt-1 font-mono font-bold text-foreground text-xs pl-5 transition-colors duration-200">
                  {data.corridorDistance}
                </p>
              </div>
            </div>

            {/* All 4 Attribution Factors (Spatial, Temporal, AIS Quality, Trajectory) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3 text-primary" />
                  Forensic Attribution Factors (4-Factor Model)
                </h4>
                <button
                  type="button"
                  onClick={() => setShowFactorDetails(!showFactorDetails)}
                  className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  {showFactorDetails ? "Hide descriptions" : "Show descriptions"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Factor 1: Spatial */}
                <FactorCard
                  icon={<MapPin className="size-3.5 text-cyan-400" />}
                  title="Spatial Alignment"
                  detail={data.factors.spatial}
                  showDetails={showFactorDetails}
                  badgeHelper={getFactorBadge}
                />

                {/* Factor 2: Temporal */}
                <FactorCard
                  icon={<Clock className="size-3.5 text-blue-400" />}
                  title="Temporal Alignment"
                  detail={data.factors.temporal}
                  showDetails={showFactorDetails}
                  badgeHelper={getFactorBadge}
                />

                {/* Factor 3: AIS Quality */}
                <FactorCard
                  icon={<Radio className="size-3.5 text-amber-400" />}
                  title="AIS Quality & Continuity"
                  detail={data.factors.aisQuality}
                  showDetails={showFactorDetails}
                  badgeHelper={getFactorBadge}
                />

                {/* Factor 4: Trajectory */}
                <FactorCard
                  icon={<Compass className="size-3.5 text-emerald-400" />}
                  title="Trajectory Match"
                  detail={data.factors.trajectory}
                  showDetails={showFactorDetails}
                  badgeHelper={getFactorBadge}
                />
              </div>
            </div>

            {/* Footer Actions */}
            {handleAudit && (
              <div className="pt-1 border-t border-border/50 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Attestation: deterministic SHA-256
                </span>
                <button
                  id={`audit-btn-${data.mmsi.replace(/\D/g, "") || "default"}`}
                  onClick={handleAudit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary active:scale-95 shadow-xs"
                >
                  <ShieldCheck className="size-3.5" />
                  Audit Evidence Trail
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FactorCard({
  icon,
  title,
  detail,
  showDetails,
  badgeHelper,
}: {
  icon: React.ReactNode
  title: string
  detail: FactorDetail
  showDetails: boolean
  badgeHelper: (status?: string, val?: number | null) => {
    badge: string
    bar: string
    label: string
  }
}) {
  const meta = badgeHelper(detail.status, detail.score)

  return (
    <div className="rounded-lg border border-border/80 bg-secondary/30 p-2 transition-colors duration-200 hover:border-primary/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-semibold text-foreground truncate">{title}</span>
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.2 font-mono text-[10px] font-bold tabular-nums border transition-all duration-300",
            meta.badge
          )}
        >
          {detail.score !== null ? `${detail.score}%` : "N/A"}
        </span>
      </div>

      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/80">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", meta.bar)}
          style={{ width: `${detail.score ?? 0}%` }}
        />
      </div>

      {/* Smooth Description Collapsible */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          showDetails ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
            {detail.description}
          </p>
        </div>
      </div>
    </div>
  )
}

// Default forensic candidate fleet (Vessel A, Vessel B, Vessel C)
export const defaultVesselCandidates: VesselAttributionData[] = [
  {
    id: "A",
    name: "MT Horizon Star",
    mmsi: "636092841",
    imo: "9412836",
    ranking: 1,
    totalRanked: 3,
    rankingLabel: "Primary Suspect",
    evidenceFactor: "0.94 (Multi-Source Attestation)",
    oilType: "Heavy Crude Oil (Arabian Light 27.4° API, High Sulfur)",
    oilCategory: "Crude Oil Cargo",
    corridorDistance: "0.38 km from Corridor S (Core Intersect)",
    corridorOffsetKm: 0.38,
    corridorStatus: "core",
    confidenceScore: 0.91,
    accentColor: "var(--color-chart-1)",
    status: "Active",
    speedKnots: 12.4,
    headingDeg: 94.2,
    factors: {
      spatial: {
        score: 94,
        label: "Spatial Proximity",
        description: "Hausdorff distance 0.38 km; direct 94% slick boundary intercept",
        weight: 0.3,
        status: "good",
      },
      temporal: {
        score: 88,
        label: "Temporal Window",
        description: "Transited within -18m of hindcast release window (03:54 UTC)",
        weight: 0.25,
        status: "good",
      },
      aisQuality: {
        score: 96,
        label: "AIS Data Quality",
        description: "Continuous Class-A broadcast, zero dropped packets, valid kinematic telemetry",
        weight: 0.2,
        status: "good",
      },
      trajectory: {
        score: 90,
        label: "Trajectory Match",
        description: "Course over ground (94.2°) coincides with backward-drift dispersion plume",
        weight: 0.25,
        status: "good",
      },
    },
  },
  {
    id: "B",
    name: "Stena Progress",
    mmsi: "538007612",
    imo: "9387413",
    ranking: 2,
    totalRanked: 3,
    rankingLabel: "Person of Interest",
    evidenceFactor: "0.62 (Corroborated with Gap)",
    oilType: "Bunker C / Heavy Fuel Oil (IFO 380, Viscous Residue)",
    oilCategory: "Heavy Fuel Oil",
    corridorDistance: "1.82 km from Corridor S (Corridor Margin)",
    corridorOffsetKm: 1.82,
    corridorStatus: "margin",
    confidenceScore: 0.58,
    accentColor: "var(--color-chart-2)",
    status: "AIS Gap",
    speedKnots: 14.1,
    headingDeg: 112.0,
    factors: {
      spatial: {
        score: 71,
        label: "Spatial Proximity",
        description: "Corridor edge intercept at boundary margin (1.82 km offset)",
        weight: 0.3,
        status: "warn",
      },
      temporal: {
        score: 63,
        label: "Temporal Window",
        description: "Estimated transit overlap during 42-minute transponder blackout",
        weight: 0.25,
        status: "warn",
      },
      aisQuality: {
        score: 34,
        label: "AIS Data Quality",
        description: "Intentional/abrupt AIS transponder silence for 42 minutes near spill origin",
        weight: 0.2,
        status: "bad",
      },
      trajectory: {
        score: 55,
        label: "Trajectory Match",
        description: "Course deviation of 28° observed immediately prior to signal loss",
        weight: 0.25,
        status: "warn",
      },
    },
  },
  {
    id: "C",
    name: "Nordic Apollo",
    mmsi: "244810395",
    imo: "9276541",
    ranking: 3,
    totalRanked: 3,
    rankingLabel: "Abstained / Exonerated",
    evidenceFactor: "0.22 (Low Correlation)",
    oilType: "Marine Gas Oil (MGO / Low Sulfur Distillate)",
    oilCategory: "Refined Distillate",
    corridorDistance: "14.6 km from Corridor S (Outside Envelope)",
    corridorOffsetKm: 14.6,
    corridorStatus: "outside",
    confidenceScore: 0.18,
    accentColor: "var(--color-chart-3)",
    status: "Active",
    speedKnots: 16.8,
    headingDeg: 278.4,
    factors: {
      spatial: {
        score: 42,
        label: "Spatial Proximity",
        description: "Transited 14.6 km north of 3σ source corridor dispersion zone",
        weight: 0.3,
        status: "muted",
      },
      temporal: {
        score: 15,
        label: "Temporal Window",
        description: "Time of passage occurred 4.2 hours prior to estimated release window",
        weight: 0.25,
        status: "muted",
      },
      aisQuality: {
        score: 89,
        label: "AIS Data Quality",
        description: "Standard Class-A transponder telemetry, no gaps, no kinematic anomalies",
        weight: 0.2,
        status: "good",
      },
      trajectory: {
        score: 29,
        label: "Trajectory Match",
        description: "Heading 278.4° diverges 88° from backward-drift flow vectors",
        weight: 0.25,
        status: "muted",
      },
    },
  },
]

// Generate complete ranked candidate fleet for any sample
export function getVesselCandidatesForSample(sample: {
  id: string
  confidence: number
  area_km2: number
  lookAlikeProb: number
  vesselAttribution: { mmsi: string; distance: number; status: string }
  location?: { lat: number; lon: number; region: string }
}): VesselAttributionData[] {
  const numId = parseInt(sample.id) || 1

  const TANKER_NAMES = [
    "Pacific Voyager",
    "MT Aegean Pride",
    "MT Horizon Star",
    "Nordic Star",
    "DHT Scandinavia",
    "Front Altair",
    "Ocean Pioneer",
    "Maran Pegasus",
    "BW Harrier",
    "Olympic Leader",
    "Valle di Cordoba",
    "Stena Polaris",
    "MT Ocean Glory",
    "Nordic Runner",
    "Sea Princess",
  ]

  const OIL_PROFILES = [
    { type: "Light Sweet Crude (Bonny Light 35.3° API)", cat: "Light Crude" },
    { type: "Heavy Crude Oil (Arabian Light 27.4° API)", cat: "Heavy Crude" },
    { type: "Bunker C / Heavy Fuel Oil (IFO 380, Viscous)", cat: "Heavy Fuel Oil" },
    { type: "Condensate / Light Petroleum Distillate", cat: "Distillate" },
    { type: "Marine Gas Oil (MGO / DMA Class)", cat: "Distillate Fuel" },
    { type: "Bitumen Blend / Heavy Fuel Residue", cat: "Residual Pitch" },
  ]

  const rawDist = sample.vesselAttribution.distance
  const corridorOffsetKm = Math.round(Math.max(0.2, rawDist * 0.42) * 100) / 100
  const isGap = sample.vesselAttribution.status === "AIS Gap"

  const spatialScore1 = Math.max(35, Math.min(99, Math.round(98 - corridorOffsetKm * 6)))
  const temporalScore1 = Math.max(40, Math.min(96, Math.round(92 + (numId % 6) - (isGap ? 12 : 2))))
  const aisScore1 = isGap ? 38 : Math.max(78, Math.min(98, 93 + (numId % 6)))
  const trajectoryScore1 = Math.max(45, Math.min(96, Math.round(94 - sample.lookAlikeProb * 35)))

  const evidenceFactorNum1 = Math.round((sample.confidence * 0.94) * 100) / 100

  // Candidate #1: Primary Suspect
  const c1: VesselAttributionData = {
    id: `${sample.id}-1`,
    name: TANKER_NAMES[numId % TANKER_NAMES.length],
    mmsi: sample.vesselAttribution.mmsi,
    imo: `9${(100000 + (numId * 1741) % 899999)}`,
    ranking: 1,
    totalRanked: 3,
    rankingLabel: "Primary Suspect",
    evidenceFactor: `${evidenceFactorNum1} (Multi-Source Attestation)`,
    oilType: OIL_PROFILES[numId % OIL_PROFILES.length].type,
    oilCategory: OIL_PROFILES[numId % OIL_PROFILES.length].cat,
    corridorDistance: `${corridorOffsetKm} km from Corridor S (${
      corridorOffsetKm <= 0.8 ? "Core Intersect" : corridorOffsetKm <= 2.5 ? "Corridor Margin" : "Outer Zone"
    })`,
    corridorOffsetKm,
    corridorStatus: corridorOffsetKm <= 0.8 ? "core" : corridorOffsetKm <= 2.5 ? "margin" : "outside",
    confidenceScore: sample.confidence,
    status: sample.vesselAttribution.status,
    speedKnots: Math.round((11 + (numId % 6) * 0.8) * 10) / 10,
    headingDeg: Math.round(((numId * 37) % 360) * 10) / 10,
    accentColor: "oklch(0.72 0.15 195)",
    factors: {
      spatial: {
        score: spatialScore1,
        label: "Spatial Proximity",
        description: `Corridor offset ${corridorOffsetKm} km; direct polygon intercept with hindcast drift`,
        status: spatialScore1 >= 80 ? "good" : spatialScore1 >= 55 ? "warn" : "bad",
      },
      temporal: {
        score: temporalScore1,
        label: "Temporal Window",
        description: `Time of passage closely aligns with SAR acquisition time window (±${15 + (numId % 18)} min)`,
        status: temporalScore1 >= 80 ? "good" : temporalScore1 >= 55 ? "warn" : "bad",
      },
      aisQuality: {
        score: aisScore1,
        label: "AIS Data Quality",
        description: isGap
          ? "Unregistered transponder silence observed during corridor transit window"
          : "Class-A continuous AIS broadcast, verified maritime call sign",
        status: aisScore1 >= 80 ? "good" : aisScore1 >= 50 ? "warn" : "bad",
      },
      trajectory: {
        score: trajectoryScore1,
        label: "Trajectory Match",
        description: "Hydrodynamic backward-drift alignment vector matches vessel course",
        status: trajectoryScore1 >= 80 ? "good" : trajectoryScore1 >= 55 ? "warn" : "bad",
      },
    },
  }

  // Candidate #2: Person of Interest
  const offset2 = Math.round((corridorOffsetKm + 1.6) * 100) / 100
  const conf2 = Math.max(0.42, Math.min(0.68, Math.round(sample.confidence * 0.62 * 100) / 100))
  const c2: VesselAttributionData = {
    id: `${sample.id}-2`,
    name: TANKER_NAMES[(numId + 4) % TANKER_NAMES.length],
    mmsi: String(538000000 + ((numId * 3817) % 99999)),
    imo: `9${(100000 + ((numId + 2) * 1923) % 899999)}`,
    ranking: 2,
    totalRanked: 3,
    rankingLabel: "Person of Interest",
    evidenceFactor: `${(sample.confidence * 0.62).toFixed(2)} (Corroborated with AIS Gap)`,
    oilType: OIL_PROFILES[(numId + 2) % OIL_PROFILES.length].type,
    oilCategory: OIL_PROFILES[(numId + 2) % OIL_PROFILES.length].cat,
    corridorDistance: `${offset2} km from Corridor S (Corridor Margin)`,
    corridorOffsetKm: offset2,
    corridorStatus: "margin",
    confidenceScore: conf2,
    status: "AIS Gap",
    speedKnots: Math.round((13 + (numId % 4) * 0.7) * 10) / 10,
    headingDeg: Math.round(((numId * 53 + 45) % 360) * 10) / 10,
    accentColor: "oklch(0.74 0.16 60)",
    factors: {
      spatial: {
        score: Math.round(spatialScore1 * 0.74),
        label: "Spatial Proximity",
        description: `Corridor boundary margin intercept with ${offset2} km lateral offset`,
        status: "warn",
      },
      temporal: {
        score: Math.round(temporalScore1 * 0.7),
        label: "Temporal Window",
        description: "Estimated transit overlap during 38-minute transponder blackout window",
        status: "warn",
      },
      aisQuality: {
        score: 36,
        label: "AIS Data Quality",
        description: "Transponder gap flagged during corridor transit window",
        status: "bad",
      },
      trajectory: {
        score: Math.round(trajectoryScore1 * 0.65),
        label: "Trajectory Match",
        description: "Course altered 26° near estimated hindcast corridor vertex",
        status: "warn",
      },
    },
  }

  // Candidate #3: Abstained / Exonerated
  const offset3 = Math.round((corridorOffsetKm + 12.4) * 100) / 100
  const c3: VesselAttributionData = {
    id: `${sample.id}-3`,
    name: TANKER_NAMES[(numId + 8) % TANKER_NAMES.length],
    mmsi: String(244800000 + ((numId * 5431) % 99999)),
    imo: `9${(100000 + ((numId + 5) * 1237) % 899999)}`,
    ranking: 3,
    totalRanked: 3,
    rankingLabel: "Abstained / Exonerated",
    evidenceFactor: "0.21 (Low Correlation / Control)",
    oilType: OIL_PROFILES[(numId + 4) % OIL_PROFILES.length].type,
    oilCategory: OIL_PROFILES[(numId + 4) % OIL_PROFILES.length].cat,
    corridorDistance: `${offset3} km from Corridor S (Outside Envelope)`,
    corridorOffsetKm: offset3,
    corridorStatus: "outside",
    confidenceScore: 0.18,
    status: "Active",
    speedKnots: 15.6,
    headingDeg: Math.round(((numId * 71 + 180) % 360) * 10) / 10,
    accentColor: "oklch(0.7 0.15 300)",
    factors: {
      spatial: {
        score: 41,
        label: "Spatial Proximity",
        description: "Transited outside 3σ source corridor dispersion zone",
        status: "muted",
      },
      temporal: {
        score: 16,
        label: "Temporal Window",
        description: "Time of passage occurred 4.1 hours prior to release window",
        status: "muted",
      },
      aisQuality: {
        score: 92,
        label: "AIS Data Quality",
        description: "Continuous Class-A broadcast, no anomalies or gaps recorded",
        status: "good",
      },
      trajectory: {
        score: 26,
        label: "Trajectory Match",
        description: "Divergent heading >85° from reverse Lagrangian plume",
        status: "muted",
      },
    },
  }

  return [c1, c2, c3]
}

// Convert any dataset sample into full VesselAttributionData (Rank #1 by default)
export function getVesselAttributionForSample(sample: {
  id: string
  confidence: number
  area_km2: number
  lookAlikeProb: number
  vesselAttribution: { mmsi: string; distance: number; status: string }
  location?: { lat: number; lon: number; region: string }
}): VesselAttributionData {
  return getVesselCandidatesForSample(sample)[0]
}
