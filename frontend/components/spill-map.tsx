"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Crosshair, Layers, Ruler, ZoomIn, ZoomOut, LocateFixed } from "lucide-react"
import { Sample } from "@/components/dataset-explorer"
import { defaultVesselCandidates } from "@/components/vessel-attribution-box"
import { cn } from "@/lib/utils"

const RealWorldMap = dynamic(
  () => import("@/components/real-world-map").then((module) => module.RealWorldMap),
  { ssr: false }
)

// Tracks converge near the estimated origin (372,404), where the
// backward-drift line traces the slick back to.
const vessels = [
  {
    id: "A",
    label: "Vessel A",
    color: "oklch(0.72 0.15 195)", // cyan
    relevance: "High",
    // passes directly through the estimated origin
    points: "120,486 208,462 288,438 344,420 388,404",
    labelAt: { x: 118, y: 486 },
    labelAnchor: "start" as const,
    dashed: false,
  },
  {
    id: "B",
    label: "Vessel B",
    color: "oklch(0.74 0.16 60)", // amber
    relevance: "Moderate",
    points: "64,286 132,320 196,346 244,364",
    // AIS gap segment (position interpolated) rendered dashed
    gap: "244,364 312,388 372,404",
    labelAt: { x: 58, y: 280 },
    labelAnchor: "start" as const,
    dashed: false,
  },
  {
    id: "C",
    label: "Vessel C",
    color: "oklch(0.7 0.15 300)", // violet
    relevance: "Abstained",
    // stays well clear of the estimated origin
    points: "556,110 540,184 534,270 546,346",
    labelAt: { x: 552, y: 100 },
    labelAnchor: "end" as const,
    dashed: true,
  },
]

export function SpillMap({
  sample,
  onInspectSlick,
  onAuditVesselA,
  selectedCandidateRank = 1,
  onSelectCandidateRank,
}: {
  sample?: Sample | null
  onInspectSlick?: () => void
  onAuditVesselA?: () => void
  selectedCandidateRank?: number
  onSelectCandidateRank?: (rank: number) => void
}) {
  const [zoom, setZoom] = useState(2)

  const activeCandidate =
    defaultVesselCandidates.find((c) => c.ranking === selectedCandidateRank) ||
    defaultVesselCandidates[0]
  const activeVesselId = activeCandidate.id || "A"

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Map toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight">
            {sample ? `Sample #${sample.id}` : "Detection Map"}
          </h2>
          <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {sample ? `Sentinel-1 SAR · ${sample.location.region} · ${sample.acquisitionDate}` : "Sentinel-1 SAR · 2026-09-15 04:12Z"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Ruler className="size-4" aria-hidden="true" />
          <Crosshair className="size-4" aria-hidden="true" />
        </div>
      </div>

      {/* Map canvas */}
      <div className="relative min-h-0 flex-1">
        {sample ? (
          <RealWorldMap
            sample={sample}
            zoom={zoom}
            selectedCandidateRank={selectedCandidateRank}
            onSelectCandidateRank={onSelectCandidateRank}
          />
        ) : (
        <svg
          viewBox="0 0 640 520"
          className="h-full w-full"
          role="img"
          aria-label="Nautical chart showing an oil slick polygon, a dashed backward drift line, and three candidate vessel tracks converging on the estimated origin."
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="slickFill" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="oklch(0.72 0.15 55 / 0.85)" />
              <stop offset="55%" stopColor="oklch(0.6 0.16 40 / 0.55)" />
              <stop offset="100%" stopColor="oklch(0.55 0.14 30 / 0.15)" />
            </radialGradient>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ocean base + grid */}
          <rect width="640" height="520" fill="oklch(0.17 0.035 235)" />
          <rect width="640" height="520" fill="url(#grid)" />

          {/* subtle coastline */}
          <path
            d="M0,470 C90,450 150,486 240,470 C330,454 380,500 470,486 C560,472 610,502 640,492 L640,520 L0,520 Z"
            fill="oklch(0.24 0.04 150 / 0.5)"
            stroke="oklch(0.5 0.08 150 / 0.5)"
            strokeWidth="1.5"
          />

          {/* Default SLICK-0417 Demo View */}
          {/* backward drift line: slick -> estimated origin (dashed) */}
          <polyline
            points="404,244 372,300 356,352 372,404"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            strokeDasharray="2 9"
            strokeLinecap="round"
            opacity="0.9"
          />
          <text
            x="330"
            y="336"
            className="fill-primary font-mono"
            fontSize="11"
            transform="rotate(78 330 336)"
          >
            backward drift
          </text>

          {/* oil slick polygon — click to open the drift inspector */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Inspect SLICK-0417 drift simulation and trajectory"
            onClick={onInspectSlick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onInspectSlick?.()
              }
            }}
            className="cursor-pointer outline-none [&>polygon]:transition-opacity hover:[&>polygon]:opacity-90 focus-visible:[&>.slick-ring]:opacity-100"
          >
            {/* transparent hit area for easier clicking */}
            <polygon
              points="360,180 432,168 486,206 500,268 466,318 396,330 336,300 322,236"
              fill="transparent"
              stroke="var(--color-primary)"
              strokeWidth="6"
              className="slick-ring opacity-0 transition-opacity"
            />
            <polygon
              points="360,180 432,168 486,206 500,268 466,318 396,330 336,300 322,236"
              fill="url(#slickFill)"
              stroke="oklch(0.75 0.16 60)"
              strokeWidth="2"
              filter="url(#glow)"
            />
            <text x="368" y="252" className="fill-foreground/90 font-mono" fontSize="12" fontWeight="600">
              SLICK-0417
            </text>
            <text x="368" y="268" className="fill-foreground/60 font-mono" fontSize="10">
              ~14.2 km²
            </text>
            {/* inline click affordance */}
            <g transform="translate(438,286)">
              <rect x="0" y="0" width="150" height="22" rx="11" fill="var(--color-background)" opacity="0.75" />
              <circle cx="13" cy="11" r="3" className="fill-primary">
                <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <text x="24" y="15" className="fill-primary font-mono" fontSize="10">
                click to inspect drift
              </text>
            </g>
          </g>

          {/* estimated origin marker */}
          <g transform="translate(372,404)">
            <circle r="10" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.5" />
            <circle r="4" fill="var(--color-primary)" />
            <text x="14" y="4" className="fill-primary font-mono" fontSize="10">
              est. origin
            </text>
          </g>

          {/* vessel tracks */}
          {vessels.map((v) => {
            const isSelected = activeVesselId === v.id
            const candRank = v.id === "A" ? 1 : v.id === "B" ? 2 : 3
            const cand = defaultVesselCandidates.find((c) => c.ranking === candRank)

            const pts = (v.gap ?? v.points).trim().split(" ")
            const [hx, hy] = pts[pts.length - 1].split(",").map(Number)

            return (
              <g
                key={v.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${v.label} forensic track`}
                onClick={() => onSelectCandidateRank?.(candRank)}
                className="cursor-pointer transition-all hover:opacity-100 group"
              >
                {/* Distance vector connecting estimated origin to the selected vessel */}
                {isSelected && (
                  <line
                    x1="372"
                    y1="404"
                    x2={hx}
                    y2={hy}
                    stroke={v.color}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                )}

                {/* Wide transparent hit area */}
                <polyline
                  points={v.gap ? `${v.points} ${v.gap}` : v.points}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="24"
                />
                <polyline
                  points={v.points}
                  fill="none"
                  stroke={v.color}
                  strokeWidth={isSelected ? "4.5" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={v.dashed ? "6 6" : undefined}
                  opacity={isSelected ? 1 : v.dashed ? 0.5 : 0.75}
                  filter={isSelected ? "url(#glow)" : undefined}
                />
                {v.gap ? (
                  <polyline
                    points={v.gap}
                    fill="none"
                    stroke={v.color}
                    strokeWidth={isSelected ? "4.5" : "2"}
                    strokeLinecap="round"
                    strokeDasharray="3 7"
                    opacity={isSelected ? 0.8 : 0.4}
                  />
                ) : null}

                {/* vessel head marker at last point */}
                <g transform={`translate(${hx},${hy})`}>
                  {isSelected && (
                    <circle r="18" fill="none" stroke={v.color} strokeWidth="1.5">
                      <animate attributeName="r" values="8;24" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle r={isSelected ? 9 : 6} fill={v.color} />
                  <circle
                    r={isSelected ? 9 : 6}
                    fill="none"
                    stroke="var(--color-background)"
                    strokeWidth="1.5"
                  />
                </g>

                {/* Selected vessel callout badge directly on map */}
                {isSelected && (
                  <g transform={`translate(${hx + (hx > 380 ? -170 : 16)},${hy - 20})`}>
                    <rect
                      x="0"
                      y="0"
                      width="160"
                      height="38"
                      rx="6"
                      fill="oklch(0.14 0.035 235 / 0.95)"
                      stroke={v.color}
                      strokeWidth="1.5"
                    />
                    <text x="8" y="15" fill={v.color} fontSize="10" fontWeight="bold" fontFamily="monospace">
                      TARGET #{candRank}: {cand?.name || v.label}
                    </text>
                    <text x="8" y="29" fill="oklch(0.85 0.04 240)" fontSize="9" fontFamily="monospace">
                      {cand?.corridorDistance?.split("(")[0]} · {cand?.confidenceScore ? `${Math.round(cand.confidenceScore * 100)}%` : ""}
                    </text>
                  </g>
                )}

                {/* label anchored at the vessel's earlier position */}
                <text
                  x={v.labelAt.x}
                  y={v.labelAt.y}
                  textAnchor={v.labelAnchor}
                  className="font-mono select-none"
                  fontSize={isSelected ? "12" : "11"}
                  fontWeight={isSelected ? "bold" : "normal"}
                  fill={v.color}
                  opacity={isSelected ? 1 : 0.75}
                >
                  {v.label}
                </text>
              </g>
            )
          })}
        </svg>
        )}

        {/* Live Map Telemetry & Active Target Info HUD on the Map (Updates dynamically when clicking right panel) */}
        {!sample && (
          <div className="pointer-events-none absolute left-3 top-3 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border/80 bg-card/95 p-3 font-mono text-[11px] text-foreground shadow-lg backdrop-blur-md z-10">
            <div className="flex items-center justify-between border-b border-border/80 pb-1.5 mb-1.5">
              <div className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                FORENSIC MAP TELEMETRY
              </div>
              <span className="font-bold text-primary font-mono">
                28.450°N · 91.200°W
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Gulf of Mexico (Deepwater)</span>
              <span className="font-semibold text-primary">
                Offshore / Open Sea
              </span>
            </div>

            <div className="text-[10px] text-muted-foreground border-b border-border/80 pb-1.5 mb-2">
              Spill: <strong className="text-foreground">14.2 km²</strong> · corridor: <strong className="text-foreground">8.5 km backward drift</strong>
            </div>

            {/* Dynamic target vessel info that immediately updates when clicking right panel */}
            <div className="rounded-md bg-secondary/80 border border-border/80 p-2 font-sans transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-primary animate-pulse" />
                  TARGET #{activeCandidate.ranking} · {activeCandidate.rankingLabel}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase border",
                    activeCandidate.confidenceScore >= 0.7
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : activeCandidate.confidenceScore >= 0.4
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-secondary text-muted-foreground border-border"
                  )}
                >
                  {(activeCandidate.confidenceScore * 100).toFixed(0)}%
                </span>
              </div>

              <div className="font-bold text-foreground text-xs mt-1 truncate">
                {activeCandidate.name}
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground mt-0.5">
                <span>MMSI {activeCandidate.mmsi}</span>
                <span className="font-medium text-foreground">
                  {activeCandidate.corridorDistance.split("(")[0]}
                </span>
              </div>

              <div className="text-[10px] text-amber-400/90 font-medium truncate mt-1 pt-1 border-t border-border/50">
                Cargo: {activeCandidate.oilType}
              </div>
            </div>
          </div>
        )}

        {sample ? (
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-border bg-background/85 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              aria-label="Zoom in on selected spill"
              title="Zoom in"
              onClick={() => setZoom((value) => Math.min(18, value + 1))}
              className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
              disabled={zoom >= 18}
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Reset map to global view"
              title="Global view"
              onClick={() => setZoom(2)}
              className="flex size-9 items-center justify-center border-y border-border text-primary transition-colors hover:bg-secondary"
            >
              <LocateFixed className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom out to global view"
              title="Zoom out"
              onClick={() => setZoom((value) => Math.max(2, value - 1))}
              className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
              disabled={zoom <= 2}
            >
              <ZoomOut className="size-4" />
            </button>
          </div>
        ) : null}

        {/* legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border border-border bg-background/80 p-3 text-[11px] backdrop-blur-sm">
          {sample ? (
            <>
              <LegendRow swatch={<span className="block h-2.5 w-2.5 rounded-sm bg-[oklch(0.72_0.15_195)]" />} label="Projected SAR Dataset Sample" />
              <LegendRow swatch={<span className="block h-0 w-4 border-t-2 border-dashed border-sky-400" />} label="Segmentation Mask Boundary" />
            </>
          ) : (
            <>
              <LegendRow swatch={<span className="block h-2.5 w-2.5 rounded-sm bg-[oklch(0.72_0.15_55)]" />} label="Oil slick polygon" />
              <LegendRow swatch={<span className="block h-0 w-4 border-t-2 border-dashed border-primary" />} label="Backward drift line" />
              <LegendRow swatch={<span className="block h-0 w-4 border-t-2 border-[var(--color-chart-1)]" />} label="Candidate vessel track" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className="flex w-4 items-center justify-center">{swatch}</span>
      <span>{label}</span>
    </div>
  )
}
