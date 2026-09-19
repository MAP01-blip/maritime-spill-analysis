"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Crosshair, Layers, Ruler, ZoomIn, ZoomOut, LocateFixed } from "lucide-react"
import { Sample } from "@/components/dataset-explorer"
import { SarPreview } from "@/components/sar-preview"

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
}: {
  sample?: Sample | null
  onInspectSlick?: () => void
}) {
  const [zoom, setZoom] = useState(2)
  const spillX = sample ? ((sample.location.lon + 180) / 360) * 640 : 320
  const spillY = sample ? ((90 - sample.location.lat) / 180) * 520 : 260

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
          <RealWorldMap sample={sample} zoom={zoom} />
        ) : (
        <svg
          viewBox="0 0 640 520"
          className="h-full w-full"
          role="img"
          aria-label="Nautical chart showing an oil slick polygon, a dashed backward drift line, and three candidate vessel tracks converging on the estimated origin."
          preserveAspectRatio={sample ? "xMidYMid meet" : "xMidYMid slice"}
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

          {/* If a sample is selected, show the dynamic map projection */}
          {sample ? (
            <>
              {/* Global longitude/latitude projection, zoomed around the selected spill. */}
              <g transform={`translate(320 260) scale(${zoom}) translate(-320 -260)`}>
                <g stroke="oklch(0.7 0.04 220 / 0.2)" strokeWidth="0.8" fill="none">
                  <path d="M0 65H640 M0 130H640 M0 195H640 M0 260H640 M0 325H640 M0 390H640 M0 455H640" />
                  <path d="M80 0V520 M160 0V520 M240 0V520 M320 0V520 M400 0V520 M480 0V520 M560 0V520" />
                </g>
                <g fill="oklch(0.45 0.025 220 / 0.92)" stroke="oklch(0.78 0.025 220 / 0.65)" strokeWidth="1.4" strokeLinejoin="round">
                  <path d="M32 98 54 78 77 74 91 57 119 61 135 75 160 78 177 96 162 111 145 113 133 132 112 126 99 143 79 138 70 157 50 148 57 127 41 119Z" />
                  <path d="M164 205 186 207 202 223 218 229 229 253 220 278 223 301 211 326 205 355 191 381 181 360 184 337 174 313 179 287 163 264 169 239 155 222Z" />
                  <path d="M291 91 307 76 329 72 341 82 361 78 379 91 388 108 379 123 364 128 356 146 342 153 333 178 319 195 305 180 309 159 297 144 303 126 286 112Z" />
                  <path d="M365 186 386 171 411 169 430 177 449 176 468 188 491 193 507 205 531 209 548 222 572 233 591 252 580 269 555 271 539 263 518 271 501 263 481 271 462 287 444 279 425 287 409 277 389 279 379 260 365 249 372 228 358 210Z" />
                  <path d="M485 342 507 331 529 333 544 344 568 349 584 366 578 385 560 397 539 391 523 399 507 388 489 381 495 363 478 355Z" />
                  <path d="M609 95 626 101 638 119 630 141 614 137 606 119Z" />
                </g>
                <g fill="none" stroke="oklch(0.82 0.03 220 / 0.28)" strokeWidth="0.75">
                  <path d="M46 91 81 101 119 91 153 102" />
                  <path d="M174 237 204 248 217 270 198 286 188 318" />
                  <path d="M309 104 338 111 365 104" />
                  <path d="M394 207 430 198 466 211 502 225 541 238 570 255" />
                  <path d="M503 355 532 365 564 369" />
                  <path d="M58 121 90 114 126 119 151 106" />
                </g>
                <g className="fill-muted-foreground/80 font-mono" fontSize="9">
                  <text x="8" y="18">180°W</text>
                  <text x="300" y="18">0°</text>
                  <text x="590" y="18">180°E</text>
                  <text x="8" y="72">60°N</text>
                  <text x="8" y="264">0°</text>
                  <text x="8" y="512">60°S</text>
                </g>
                <g className="fill-foreground/70 font-mono" fontSize="8">
                  <text x="74" y="106">N. AMERICA</text>
                  <text x="190" y="290">S. AMERICA</text>
                  <text x="316" y="112">EUROPE</text>
                  <text x="463" y="236">ASIA</text>
                  <text x="398" y="251">AFRICA</text>
                  <text x="520" y="373">AUSTRALIA</text>
                </g>
                <g fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth="1">
                  <circle cx="347" cy="150" r="2" />
                  <circle cx="380" cy="220" r="2" />
                  <circle cx="466" cy="255" r="2" />
                  <circle cx="484" cy="342" r="2" />
                </g>
                <g transform={`translate(${spillX}, ${spillY})`}>
                  <circle r="14" fill="var(--color-primary)" opacity="0.18">
                    <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r="5" fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth="2" />
                  <text x="10" y="-10" className="fill-primary font-mono" fontSize="10" fontWeight="600">SPILL</text>
                </g>
              </g>

              <g transform="translate(24, 32)">
                <rect width="222" height="42" rx="5" fill="var(--color-background)" opacity="0.9" />
                <text x="10" y="16" className="fill-muted-foreground font-mono" fontSize="9">GLOBAL PROJECTION · ZOOM {zoom.toFixed(1)}×</text>
                <text x="10" y="31" className="fill-foreground font-mono" fontSize="11" fontWeight="600">{sample.location.lat.toFixed(3)}°N · {sample.location.lon.toFixed(3)}°E</text>
              </g>

              {/* Keep the selected dataset image square while the map provides global context. */}
              <foreignObject x="450" y="330" width="160" height="160">
                <div className="h-full w-full overflow-hidden rounded-lg border border-primary/40 bg-background/80 shadow-lg shadow-black/50">
                  <SarPreview sampleId={parseInt(sample.id)} showMask={true} maskOnly={true} width={160} height={160} />
                </div>
              </foreignObject>
            </>
          ) : (
            <>
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
              {vessels.map((v) => (
                <g key={v.id}>
                  <polyline
                    points={v.points}
                    fill="none"
                    stroke={v.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={v.dashed ? "6 6" : undefined}
                    opacity={v.dashed ? 0.7 : 0.95}
                  />
                  {v.gap ? (
                    <polyline
                      points={v.gap}
                      fill="none"
                      stroke={v.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="3 7"
                      opacity="0.55"
                    />
                  ) : null}
                  {/* vessel head marker at last point */}
                  {(() => {
                    const pts = (v.gap ?? v.points).trim().split(" ")
                    const [hx, hy] = pts[pts.length - 1].split(",").map(Number)
                    return (
                      <g transform={`translate(${hx},${hy})`}>
                        <circle r="6" fill={v.color} />
                        <circle r="6" fill="none" stroke="var(--color-background)" strokeWidth="1.5" />
                      </g>
                    )
                  })()}
                  {/* label anchored at the vessel's earlier position, away from the slick */}
                  <text
                    x={v.labelAt.x}
                    y={v.labelAt.y}
                    textAnchor={v.labelAnchor}
                    className="font-mono"
                    fontSize="11"
                    fontWeight="600"
                    fill={v.color}
                  >
                    {v.label}
                  </text>
                </g>
              ))}
            </>
          )}
        </svg>
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
