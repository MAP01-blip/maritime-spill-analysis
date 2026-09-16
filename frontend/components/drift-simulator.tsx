"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Pause, Play, RotateCcw, Navigation2, Wind, Waves } from "lucide-react"

type Mode = "backward" | "forward"

// Normalized scene geometry (0..1) mapped onto the canvas each frame.
const SLICK = { x: 0.56, y: 0.3 }
const CORRIDOR = { x0: 0.08, y0: 0.6, x1: 0.32, y1: 0.84 }
const CORRIDOR_CENTER = {
  x: (CORRIDOR.x0 + CORRIDOR.x1) / 2,
  y: (CORRIDOR.y0 + CORRIDOR.y1) / 2,
}
const SLICK_POLY: [number, number][] = [
  [0.5, 0.19],
  [0.62, 0.17],
  [0.7, 0.25],
  [0.72, 0.35],
  [0.64, 0.43],
  [0.52, 0.45],
  [0.44, 0.37],
  [0.43, 0.26],
]

function unit(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}
const BACKWARD_DIR = unit(CORRIDOR_CENTER.x - SLICK.x, CORRIDOR_CENTER.y - SLICK.y)
const FORWARD_DIR = { x: -BACKWARD_DIR.x, y: -BACKWARD_DIR.y }

const PARTICLE_COUNT = 190

interface Particle {
  x: number
  y: number
  life: number
  max: number
  spread: number
  seed: number
}

function seedParticle(p: Particle, jitter = 0.06) {
  p.x = SLICK.x + (Math.random() - 0.5) * jitter
  p.y = SLICK.y + (Math.random() - 0.5) * jitter
  p.life = Math.random() * 0.6
  p.max = 3.2 + Math.random() * 2.4
  p.spread = 0
  p.seed = Math.random()
}

// Distribute a particle along the drift path so the very first frame
// (including a paused or reduced-motion frame) already shows a plume.
function seedAlongPath(p: Particle, mode: Mode) {
  const dir = mode === "backward" ? BACKWARD_DIR : FORWARD_DIR
  const perp = { x: -dir.y, y: dir.x }
  const t = Math.random()
  const dist = t * (mode === "backward" ? 0.55 : 0.5)
  const perpMag = (Math.random() - 0.5) * (0.04 + t * 0.14)
  p.x = SLICK.x + dir.x * dist + perp.x * perpMag
  p.y = SLICK.y + dir.y * dist + perp.y * perpMag
  p.max = 3.2 + Math.random() * 2.4
  p.life = t * p.max
  p.spread = 0
  p.seed = Math.random()
}

interface DriftSimulatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DriftSimulator({ open, onOpenChange }: DriftSimulatorProps) {
  const [mode, setMode] = useState<Mode>("backward")
  const [playing, setPlaying] = useState(true)
  const [horizon, setHorizon] = useState(6) // hours

  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number>(0)
  const modeRef = useRef<Mode>(mode)
  const playingRef = useRef<boolean>(playing)
  const horizonRef = useRef<number>(horizon)

  modeRef.current = mode
  playingRef.current = playing
  horizonRef.current = horizon

  const reduced = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // (Re)seed particles when the panel opens or the mode changes.
  useEffect(() => {
    if (!open) return
    const arr: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const p: Particle = { x: 0, y: 0, life: 0, max: 0, spread: 0, seed: 0 }
      seedAlongPath(p, mode) // fill the path so the first frame is meaningful
      return p
    })
    particlesRef.current = arr
  }, [open, mode])

  useEffect(() => {
    const canvas = canvasEl
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Measure the canvas each frame. This is more robust than a
    // ResizeObserver inside an animated Radix portal, which may not deliver
    // its initial callback before the first paint.
    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      const cw = Math.round(w * dpr)
      const ch = Math.round(h * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (dt: number) => {
      if (w === 0 || h === 0) return
      const m = modeRef.current
      const dir = m === "backward" ? BACKWARD_DIR : FORWARD_DIR
      const perp = { x: -dir.y, y: dir.x }
      const T = horizonRef.current
      const speed = 0.05 + T * 0.006
      const diffusion = 0.05 + T * 0.006

      // Background
      ctx.clearRect(0, 0, w, h)
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, "#0a1622")
      bg.addColorStop(1, "#0c1c2b")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Grid
      ctx.strokeStyle = "rgba(120,160,190,0.08)"
      ctx.lineWidth = 1
      for (let gx = 0; gx <= w; gx += 40) {
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, h)
        ctx.stroke()
      }
      for (let gy = 0; gy <= h; gy += 40) {
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(w, gy)
        ctx.stroke()
      }

      const accent = m === "backward" ? "56,189,248" : "251,146,60"

      // Forward uncertainty cone
      if (m === "forward") {
        const sx = SLICK.x * w
        const sy = SLICK.y * h
        const len = 0.28 + T * 0.03
        const ex = (SLICK.x + dir.x * len) * w
        const ey = (SLICK.y + dir.y * len) * h
        const spread = (0.05 + T * 0.012) * w
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex + perp.x * spread, ey + perp.y * spread)
        ctx.lineTo(ex - perp.x * spread, ey - perp.y * spread)
        ctx.closePath()
        const cone = ctx.createLinearGradient(sx, sy, ex, ey)
        cone.addColorStop(0, `rgba(${accent},0.22)`)
        cone.addColorStop(1, `rgba(${accent},0.02)`)
        ctx.fillStyle = cone
        ctx.fill()
      }

      // Source corridor S (backward target)
      const cx0 = CORRIDOR.x0 * w
      const cy0 = CORRIDOR.y0 * h
      const cw = (CORRIDOR.x1 - CORRIDOR.x0) * w
      const ch = (CORRIDOR.y1 - CORRIDOR.y0) * h
      ctx.setLineDash([6, 5])
      ctx.strokeStyle =
        m === "backward" ? `rgba(${accent},0.7)` : "rgba(120,160,190,0.35)"
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx0, cy0, cw, ch)
      ctx.setLineDash([])
      ctx.fillStyle =
        m === "backward" ? `rgba(${accent},0.08)` : "rgba(120,160,190,0.04)"
      ctx.fillRect(cx0, cy0, cw, ch)

      // Slick polygon
      ctx.beginPath()
      SLICK_POLY.forEach(([px, py], i) => {
        const X = px * w
        const Y = py * h
        if (i === 0) ctx.moveTo(X, Y)
        else ctx.lineTo(X, Y)
      })
      ctx.closePath()
      ctx.fillStyle = "rgba(234,164,74,0.16)"
      ctx.strokeStyle = "rgba(245,180,90,0.8)"
      ctx.lineWidth = 1.5
      ctx.fill()
      ctx.stroke()

      // Particles
      const advancing = playingRef.current && !reduced
      for (const p of particlesRef.current) {
        if (advancing) {
          p.life += dt
          const growth = 0.3 + p.life / p.max
          p.spread += (Math.random() - 0.5) * diffusion * dt * growth
          p.x += dir.x * speed * dt + perp.x * p.spread * dt * 4
          p.y += dir.y * speed * dt + perp.y * p.spread * dt * 4

          const reachedCorridor =
            m === "backward" &&
            Math.hypot(p.x - CORRIDOR_CENTER.x, p.y - CORRIDOR_CENTER.y) < 0.05
          const offscreen =
            p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1
          if (p.life > p.max || reachedCorridor || offscreen) {
            seedParticle(p)
          }
        }

        const t = p.life / p.max
        const alpha = Math.max(0, 0.9 * (1 - t))
        const r = 1.4 + p.seed * 1.8
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${accent},${alpha})`
        ctx.fill()
      }

      // Slick origin marker
      ctx.beginPath()
      ctx.arc(SLICK.x * w, SLICK.y * h, 4, 0, Math.PI * 2)
      ctx.fillStyle = "rgb(245,180,90)"
      ctx.fill()
    }

    const loop = (ts: number) => {
      measure()
      const last = lastRef.current || ts
      const dt = Math.min(0.05, (ts - last) / 1000)
      lastRef.current = ts
      draw(dt)
      rafRef.current = requestAnimationFrame(loop)
    }

    // Always render through the loop; it measures the canvas each frame and
    // self-recovers once a non-zero size is available. Particle advancement is
    // gated separately by `advancing` (respecting play/pause and
    // prefers-reduced-motion), so a reduced-motion or paused canvas still shows
    // the seeded plume.
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
    }
  }, [canvasEl, reduced, mode])

  const cfg =
    mode === "backward"
      ? {
          title: "Backward Hindcast",
          sub: "Source Corridor S · window T−" + horizon + "h",
          accentClass: "text-sky-400",
        }
      : {
          title: "Forward Drift Forecast",
          sub: "Uncertainty band · T+" + horizon + "h",
          accentClass: "text-orange-400",
        }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-border bg-card p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Navigation2 className="size-4 text-primary" aria-hidden="true" />
            Drift Simulation &amp; Trajectory Inspector
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            SLICK-0417 · OpenDrift Lagrangian particle model
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {/* Mode toggle */}
          <div
            role="tablist"
            aria-label="Simulation direction"
            className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/40 p-1"
          >
            {(["backward", "forward"] as Mode[]).map((mVal) => {
              const active = mode === mVal
              return (
                <button
                  key={mVal}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(mVal)}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    active
                      ? mVal === "backward"
                        ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40"
                        : "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/40"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mVal === "backward"
                    ? "Backward Hindcast"
                    : "Forward Drift Forecast"}
                </button>
              )
            })}
          </div>

          <div>
            <p className={cn("text-sm font-semibold", cfg.accentClass)}>
              {cfg.title}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {cfg.sub}
            </p>
          </div>

          {/* Simulation canvas */}
          <div className="relative overflow-hidden rounded-xl border border-border">
            <canvas
              ref={setCanvasEl}
              className="block h-[300px] w-full"
              role="img"
              aria-label={`${cfg.title}: animated particle drift between the oil slick and source corridor S.`}
            />
            <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-sm">
              SLICK-0417
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-sm">
              Corridor S
            </div>
            <div className="absolute right-3 top-3 flex gap-1.5">
              <Button
                size="icon"
                variant="secondary"
                className="size-8"
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? "Pause simulation" : "Play simulation"}
              >
                {playing ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="size-8"
                onClick={() => {
                  particlesRef.current.forEach((p) => seedParticle(p, 0.06))
                }}
                aria-label="Reset simulation"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Time horizon */}
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="horizon"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Time horizon (T)
              </label>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {mode === "backward" ? "−" : "+"}
                {horizon}h
              </span>
            </div>
            <input
              id="horizon"
              type="range"
              min={1}
              max={24}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </div>

          {/* Forcing parameters */}
          <div className="grid grid-cols-2 gap-3">
            <ForcingCard
              icon={<Wind className="size-3.5" aria-hidden="true" />}
              source="ERA5 reanalysis"
              label="Wind vector"
              value="225° SW"
              detail="6.2 m/s"
            />
            <ForcingCard
              icon={<Waves className="size-3.5" aria-hidden="true" />}
              source="CMEMS GLORYS"
              label="Surface current"
              value="210°"
              detail="0.42 kn"
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-secondary/20 p-3 font-mono text-[11px]">
            <Param k="Model" v="OpenDrift 1.11" />
            <Param k="Scheme" v="Runge–Kutta 4" />
            <Param k="Particles" v={String(PARTICLE_COUNT)} />
            <Param k="Diffusion" v="0.12 m²/s" />
            <Param k="Stokes drift" v="enabled" />
            <Param k="Timestep" v="600 s" />
          </dl>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ForcingCard({
  icon,
  source,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  source: string
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-sm font-semibold text-foreground">
        {value} <span className="text-muted-foreground">· {detail}</span>
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {source}
      </p>
    </div>
  )
}

function Param({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  )
}
