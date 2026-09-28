"use client"

import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { SarPreview } from "@/components/sar-preview"
import { DatasetStats } from "@/components/dataset-stats"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Target,
  Wind,
  Calendar,
  Eye,
  EyeOff,
  X,
  Download,
  Filter,
  Loader2,
  AlertTriangle,
  Ship,
  Ruler,
  Radio,
} from "lucide-react"

export interface Location {
  lat: number
  lon: number
  region: string
}

export interface Sample {
  id: string
  filename: string
  mask: string
  dimensions: string
  format: string
  polarization: string
  location: Location
  spillLocationClass?: string
  confidence: number
  area_km2: number
  windSpeed: number
  acquisitionDate: string
  seaState: number
  lookAlikeProb: number
  vesselAttribution: { mmsi: string; distance: number; status: string }
  sarProcessing: string
}

export function getSpillLocationLabel(spillLocationClass?: string): string {
  if (!spillLocationClass) return "Spill is on open water"
  const normalized = spillLocationClass.toLowerCase().trim()
  if (normalized === "water" || normalized === "sea" || normalized === "ocean") return "Spill is on open water"
  if (normalized === "coastal" || normalized === "coast") return "Spill is in coastal water"
  if (normalized === "bay" || normalized === "estuary") return "Spill is in bay / gulf"
  if (normalized === "offshore" || normalized === "rig") return "Spill is at offshore area"
  if (normalized === "land") return "Spill is on land"
  if (normalized.startsWith("spill is")) return spillLocationClass
  return `Spill is on ${spillLocationClass}`
}

interface DatasetData {
  total: number
  page: number
  pageSize: number
  totalPages: number
  source: {
    doi: string
    url: string
    title: string
    authors: string
    license: string
    parts: { label: string; doi: string }[]
  }
  stats: {
    totalImages: number
    totalMasks: number
    avgConfidence: number
    avgArea: number
    formatDetails: string
    resolution: string
    polarizations: string[]
  }
  samples: Sample[]
}

const REGIONS = [
  "Mediterranean Sea",
  "Persian Gulf",
  "Malacca Strait",
  "Gulf of Mexico",
  "North Sea",
  "Java Sea",
  "South China Sea",
  "Baltic Sea",
  "Strait of Gibraltar",
  "Gulf of Finland",
  "Rotterdam Marine Approach",
  "Singapore Marine Strait",
]

export function DatasetExplorer({
  selectedSample,
  onSelectSample,
}: {
  selectedSample?: Sample | null
  onSelectSample?: (sample: Sample | null) => void
} = {}) {
  const [data, setData] = useState<DatasetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState("")
  const [locationClass, setLocationClass] = useState("")
  const [minConfidence, setMinConfidence] = useState(0)
  const [showMasks, setShowMasks] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "12",
      })
      if (search) params.set("search", search)
      if (region) params.set("region", region)
      if (locationClass) params.set("locationClass", locationClass)
      if (minConfidence > 0) params.set("minConfidence", String(minConfidence))

      const res = await fetch(`/api/dataset?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      console.error("Failed to fetch dataset")
    } finally {
      setLoading(false)
    }
  }, [page, search, region, locationClass, minConfidence])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
    onSelectSample?.(null)
  }, [search, region, locationClass, minConfidence, onSelectSample])

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      {/* Main panel — sample gallery */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                SAR Sample Gallery
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {data ? (
                  <>
                    {data.total.toLocaleString()} samples ·{" "}
                    <span className="text-primary">Sentinel-1 SAR</span> ·
                    Sigma0 (dB)
                  </>
                ) : (
                  "Loading..."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-36 rounded-md border border-border bg-secondary/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  showFilters
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <Filter className="size-3" />
                Filters
              </button>
              {/* Mask toggle */}
              <button
                onClick={() => setShowMasks((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  showMasks
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {showMasks ? (
                  <Eye className="size-3" />
                ) : (
                  <EyeOff className="size-3" />
                )}
                Masks
              </button>
            </div>
          </div>

          {/* Filter bar */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/20 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Location Type
                </label>
                <select
                  value={locationClass}
                  onChange={(e) => setLocationClass(e.target.value)}
                  className="h-7 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All environment types</option>
                  <option value="water">Spill on Water</option>
                  <option value="land">Spill on Land</option>
                  <option value="coastal">Spill in Coastal Zone</option>
                  <option value="river">Spill on River</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All regions</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Min Confidence
                </label>
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.05}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-24 accent-primary"
                />
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {minConfidence > 0 ? `≥ ${minConfidence.toFixed(2)}` : "Any"}
                </span>
              </div>
              {(region || locationClass || minConfidence > 0) && (
                <button
                  onClick={() => {
                    setRegion("")
                    setLocationClass("")
                    setMinConfidence(0)
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/20"
                >
                  <X className="size-2.5" />
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Sample grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : data && data.samples.length > 0 ? (
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
              {data.samples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => onSelectSample?.(sample)}
                  className={cn(
                    "group relative flex flex-col bg-card p-2.5 text-left transition-colors hover:bg-secondary/40",
                    selectedSample?.id === sample.id && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                  )}
                >
                  <SarPreview
                    sampleId={parseInt(sample.id)}
                    showMask={showMasks}
                    width={180}
                    height={130}
                    className="w-full rounded-md"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      #{sample.id}
                    </span>
                    <ConfidencePill confidence={sample.confidence} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="size-2.5" />
                    {sample.location.region}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-sky-400/90">
                    {getSpillLocationLabel(sample.spillLocationClass)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {sample.area_km2} km² · {sample.acquisitionDate}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <Search className="size-8 opacity-40" />
              <p className="text-sm">No samples match your filters</p>
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-[11px] text-muted-foreground">
                Page {data.page} of {data.totalPages} ·{" "}
                {data.total.toLocaleString()} results
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {/* Page number pills */}
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                  let pageNum: number
                  if (data.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= data.totalPages - 2) {
                    pageNum = data.totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                        pageNum === page
                          ? "border border-primary/40 bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(data.totalPages, p + 1))
                  }
                  disabled={page >= data.totalPages}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected sample detail */}
        {selectedSample && (
          <div className="mt-4 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">
                  Sample #{selectedSample.id} — Detail View
                </h3>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {selectedSample.filename}
                </p>
              </div>
              <button
                onClick={() => onSelectSample?.(null)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4 sm:flex-row">
              {/* Side-by-side previews */}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <div className="flex flex-col items-center gap-1">
                  <SarPreview
                    sampleId={parseInt(selectedSample.id)}
                    showMask={false}
                    width={220}
                    height={180}
                    className="rounded-lg"
                  />
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    SAR Image (VV+VH)
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <SarPreview
                    sampleId={parseInt(selectedSample.id)}
                    showMask={true}
                    width={220}
                    height={180}
                    className="rounded-lg"
                  />
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    With Segmentation Mask
                  </span>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex-1 space-y-2.5">
                <DetailRow
                  icon={<Target className="size-3" />}
                  label="Confidence"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold tabular-nums">
                        {selectedSample.confidence.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          "h-1.5 w-16 overflow-hidden rounded-full bg-border"
                        )}
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            selectedSample.confidence >= 0.85
                              ? "bg-[oklch(0.7_0.14_145)]"
                              : selectedSample.confidence >= 0.7
                                ? "bg-[oklch(0.75_0.15_75)]"
                                : "bg-destructive"
                          )}
                          style={{
                            width: `${selectedSample.confidence * 100}%`,
                          }}
                        />
                      </span>
                    </span>
                  }
                />
                <DetailRow
                  icon={<MapPin className="size-3" />}
                  label="Location"
                  value={`${selectedSample.location.lat}°, ${selectedSample.location.lon}° · ${selectedSample.location.region}`}
                />
                <DetailRow
                  icon={<MapPin className="size-3" />}
                  label="Spill Location"
                  value={
                    <span className="font-semibold text-primary">
                      {getSpillLocationLabel(selectedSample.spillLocationClass)}
                    </span>
                  }
                />
                <DetailRow
                  icon={<Wind className="size-3" />}
                  label="Wind Speed"
                  value={`${selectedSample.windSpeed} m/s`}
                />
                <DetailRow
                  icon={<Calendar className="size-3" />}
                  label="Acquired"
                  value={selectedSample.acquisitionDate}
                />
                <DetailRow
                  icon={<Target className="size-3" />}
                  label="Spill Area"
                  value={`${selectedSample.area_km2} km²`}
                />
                <DetailRow
                  icon={<Wind className="size-3" />}
                  label="Sea State"
                  value={`Level ${selectedSample.seaState}`}
                />
                <DetailRow
                  icon={<AlertTriangle className="size-3" />}
                  label="Look-alike Prob."
                  value={`${Math.round(selectedSample.lookAlikeProb * 100)}%`}
                />

                <div className="mt-4 border-t border-border pt-4 space-y-2.5">
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vessel Attribution (Simulated)</h4>
                  <DetailRow
                    icon={<Ship className="size-3" />}
                    label="Vessel MMSI"
                    value={selectedSample.vesselAttribution.mmsi}
                  />
                  <DetailRow
                    icon={<Ruler className="size-3" />}
                    label="Distance"
                    value={`${selectedSample.vesselAttribution.distance} km`}
                  />
                  <DetailRow
                    icon={<Radio className="size-3" />}
                    label="AIS Status"
                    value={
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        selectedSample.vesselAttribution.status === "Active"
                          ? "bg-[oklch(0.7_0.14_145)]/15 text-[oklch(0.82_0.14_145)]"
                          : "bg-destructive/15 text-destructive"
                      )}>
                        {selectedSample.vesselAttribution.status}
                      </span>
                    }
                  />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-secondary/20 p-3 font-mono text-[10px]">
                  <div className="col-span-2 mb-1 flex justify-between border-b border-border/50 pb-1">
                    <dt className="text-muted-foreground">SAR Processing</dt>
                    <dd className="text-foreground">{selectedSample.sarProcessing}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd className="text-foreground">{selectedSample.format}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Size</dt>
                    <dd className="text-foreground">{selectedSample.dimensions}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Channels</dt>
                    <dd className="text-foreground">{selectedSample.polarization}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Mask</dt>
                    <dd className="text-foreground">{selectedSample.mask}</dd>
                  </div>
                </dl>

                <a
                  href="https://doi.org/10.5281/zenodo.8346860"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <Download className="size-3.5" />
                  Download Full Dataset from Zenodo
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar — Dataset Stats */}
      {data && (
        <aside className="flex w-full flex-col gap-4 lg:w-[380px]">
          <DatasetStats stats={data.stats} source={data.source} />
        </aside>
      )}
    </div>
  )
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 0.85
      ? "border-[oklch(0.7_0.14_145)]/40 bg-[oklch(0.7_0.14_145)]/15 text-[oklch(0.82_0.14_145)]"
      : confidence >= 0.7
        ? "border-[oklch(0.75_0.15_75)]/40 bg-[oklch(0.75_0.15_75)]/15 text-[oklch(0.82_0.15_75)]"
        : "border-border bg-secondary text-muted-foreground"
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums",
        tone
      )}
    >
      {confidence.toFixed(2)}
    </span>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-5 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  )
}
