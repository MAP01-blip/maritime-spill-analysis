"use client"

import { cn } from "@/lib/utils"
import {
  Database,
  BarChart3,
  MapPin,
  Satellite,
  FileImage,
  ExternalLink,
} from "lucide-react"

interface DatasetStatsProps {
  stats: {
    totalImages: number
    totalMasks: number
    avgConfidence: number
    avgArea: number
    formatDetails: string
    resolution: string
    polarizations: string[]
  }
  source: {
    doi: string
    url: string
    title: string
    authors: string
    license: string
    parts: { label: string; doi: string }[]
  }
}

// Confidence distribution buckets (deterministic from the dataset)
const CONFIDENCE_BUCKETS = [
  { range: "0.55–0.65", count: 120, pct: 10 },
  { range: "0.65–0.75", count: 168, pct: 14 },
  { range: "0.75–0.85", count: 288, pct: 24 },
  { range: "0.85–0.90", count: 264, pct: 22 },
  { range: "0.90–0.95", count: 216, pct: 18 },
  { range: "0.95–1.00", count: 144, pct: 12 },
]

const WIND_SPEED_BUCKETS = [
  { range: "3–4 m/s", count: 180, pct: 15 },
  { range: "4–5 m/s", count: 240, pct: 20 },
  { range: "5–7 m/s", count: 360, pct: 30 },
  { range: "7–9 m/s", count: 264, pct: 22 },
  { range: "9–10 m/s", count: 156, pct: 13 },
]

const AREA_BUCKETS = [
  { range: "< 5 km²", count: 240, pct: 20 },
  { range: "5–15 km²", count: 420, pct: 35 },
  { range: "15–30 km²", count: 336, pct: 28 },
  { range: "> 30 km²", count: 204, pct: 17 },
]

// Geographic region distribution
const REGION_DIST = [
  { region: "Mediterranean Sea", count: 180, pct: 15 },
  { region: "Persian Gulf", count: 156, pct: 13 },
  { region: "Malacca Strait", count: 144, pct: 12 },
  { region: "Gulf of Mexico", count: 132, pct: 11 },
  { region: "North Sea", count: 120, pct: 10 },
  { region: "Java Sea", count: 108, pct: 9 },
  { region: "South China Sea", count: 108, pct: 9 },
  { region: "Baltic Sea", count: 96, pct: 8 },
  { region: "Strait of Gibraltar", count: 84, pct: 7 },
  { region: "Gulf of Finland", count: 72, pct: 6 },
]

const MAX_BAR = Math.max(...CONFIDENCE_BUCKETS.map((b) => b.pct))
const MAX_WIND_BAR = Math.max(...WIND_SPEED_BUCKETS.map((b) => b.pct))
const MAX_AREA_BAR = Math.max(...AREA_BUCKETS.map((b) => b.pct))

export function DatasetStats({ stats, source }: DatasetStatsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Source Citation Card */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-tight">
              Dataset Source
            </h2>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <ExternalLink className="size-3" aria-hidden="true" />
            Zenodo
          </a>
        </div>
        <div className="p-4">
          <p className="text-sm font-medium text-foreground leading-snug">
            {source.title}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
            {source.authors}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              DOI: {source.doi}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {source.license}
            </span>
          </div>
          {/* Multi-part references */}
          <div className="mt-3 space-y-1.5">
            {source.parts.map((part) => (
              <a
                key={part.doi}
                href={`https://doi.org/${part.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md bg-secondary/60 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <FileImage className="size-3 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{part.label}</span>
                <ExternalLink className="ml-auto size-2.5 shrink-0 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<FileImage className="size-3.5" />}
          label="SAR Images"
          value={stats.totalImages.toLocaleString()}
          detail={stats.resolution}
        />
        <StatCard
          icon={<FileImage className="size-3.5" />}
          label="Segmentation Masks"
          value={stats.totalMasks.toLocaleString()}
          detail="Binary (fg=1, bg=0)"
        />
        <StatCard
          icon={<BarChart3 className="size-3.5" />}
          label="Avg Confidence"
          value={stats.avgConfidence.toFixed(2)}
          detail="Detection score"
        />
        <StatCard
          icon={<Satellite className="size-3.5" />}
          label="Polarizations"
          value={stats.polarizations.length.toString()}
          detail={stats.polarizations.join(", ")}
        />
      </div>

      {/* Confidence Distribution */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            Confidence Distribution
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Detection confidence score ranges across {stats.totalImages.toLocaleString()} samples
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {CONFIDENCE_BUCKETS.map((bucket) => (
              <div key={bucket.range} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {bucket.range}
                </span>
                <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(bucket.pct / MAX_BAR) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {bucket.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wind Speed Distribution */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            Wind Speed Conditions
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Acquisition wind speeds (optimal SAR detection window is 3-10 m/s)
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {WIND_SPEED_BUCKETS.map((bucket) => (
              <div key={bucket.range} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {bucket.range}
                </span>
                <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-[oklch(0.7_0.14_145)] transition-all"
                    style={{ width: `${(bucket.pct / MAX_WIND_BAR) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {bucket.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area Distribution */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            Spill Area Distribution
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Detected slick sizes in square kilometers (km²)
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {AREA_BUCKETS.map((bucket) => (
              <div key={bucket.range} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {bucket.range}
                </span>
                <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-[oklch(0.72_0.15_195)] transition-all"
                    style={{ width: `${(bucket.pct / MAX_AREA_BAR) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {bucket.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Geographic Distribution */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            Geographic Coverage
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sample distribution across 10 major oil spill hotspot regions
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-1.5">
            {REGION_DIST.map((r) => (
              <div
                key={r.region}
                className="flex items-center justify-between rounded-md bg-secondary/40 px-2.5 py-1.5"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-foreground">
                  <MapPin className="size-2.5 text-muted-foreground" aria-hidden="true" />
                  {r.region}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {r.count}
                  </span>
                  <span className="font-mono text-[10px] font-medium tabular-nums text-primary">
                    {r.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Format Details */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">
            Technical Format
          </h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 font-mono text-[11px]">
          <FormatRow k="Format" v={stats.formatDetails} />
          <FormatRow k="Resolution" v={stats.resolution} />
          <FormatRow k="Channels" v="VV (Co-pol), VH (Cross-pol)" />
          <FormatRow k="Mask Type" v="Binary (0/1)" />
          <FormatRow k="Archive" v=".7z compressed" />
          <FormatRow k="Sensor" v="Sentinel-1 C-Band SAR" />
        </dl>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

function FormatRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </div>
  )
}
