"use client"

import { useEffect, useRef, useMemo } from "react"

// Deterministic PRNG so each sample gets the same visual every render
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface SarPreviewProps {
  sampleId: number
  showMask?: boolean
  className?: string
  width?: number
  height?: number
}

export function SarPreview({
  sampleId,
  showMask = false,
  className = "",
  width = 256,
  height = 256,
}: SarPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const seed = useMemo(() => sampleId * 7919 + 31, [sampleId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const bgRand = mulberry32(seed)
    const fgRand = mulberry32(seed + 12345)

    // --- Draw ocean background with SAR-like speckle noise ---
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    // Base ocean backscatter (darker = calmer ocean in SAR)
    const baseLevel = 25 + bgRand() * 15

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        // Rayleigh-like speckle noise
        const u1 = bgRand()
        const u2 = bgRand()
        const speckle = Math.sqrt(-2 * Math.log(Math.max(u1, 0.001))) * Math.cos(2 * Math.PI * u2)
        const noise = baseLevel + speckle * 12

        // Add subtle horizontal banding (SAR range artifact)
        const banding = Math.sin(y * 0.08 + bgRand() * 0.3) * 3

        const val = Math.max(0, Math.min(255, noise + banding))
        data[idx] = val * 0.7     // R (slight blue-green tint)
        data[idx + 1] = val * 0.75
        data[idx + 2] = val * 0.85
        data[idx + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)

    // --- Draw oil spill patch (dark region — reduced backscatter) ---
    const cx = width * (0.3 + fgRand() * 0.4)
    const cy = height * (0.3 + fgRand() * 0.4)
    const numPoints = 6 + Math.floor(fgRand() * 5)
    const baseRadius = Math.min(width, height) * (0.12 + fgRand() * 0.18)

    const points: [number, number][] = []
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2
      const r = baseRadius * (0.6 + fgRand() * 0.8)
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
    }

    const curves: { cpx: number; cpy: number; x: number; y: number }[] = []
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev[0] + curr[0]) / 2 + (fgRand() - 0.5) * 12
      const cpy = (prev[1] + curr[1]) / 2 + (fgRand() - 0.5) * 12
      curves.push({ cpx, cpy, x: curr[0], y: curr[1] })
    }

    // Draw the spill as a dark patch
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (const c of curves) {
      ctx.quadraticCurveTo(c.cpx, c.cpy, c.x, c.y)
    }
    ctx.closePath()

    // Dark fill to simulate oil dampening radar backscatter
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.2)
    grad.addColorStop(0, "rgba(5, 8, 14, 0.85)")
    grad.addColorStop(0.6, "rgba(8, 12, 20, 0.7)")
    grad.addColorStop(1, "rgba(15, 20, 30, 0.3)")
    ctx.fillStyle = grad
    ctx.fill()

    // Subtle bright edge (oil-water boundary in SAR)
    ctx.strokeStyle = "rgba(90, 100, 120, 0.4)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    // --- Optionally overlay segmentation mask ---
    if (showMask) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (const c of curves) {
        ctx.quadraticCurveTo(c.cpx, c.cpy, c.x, c.y)
      }
      ctx.closePath()
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)"
      ctx.fill()
      ctx.strokeStyle = "rgba(56, 189, 248, 0.8)"
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.restore()

      // Mask label
      ctx.fillStyle = "rgba(56, 189, 248, 0.9)"
      ctx.font = "bold 9px monospace"
      ctx.fillText("MASK", cx - 14, cy + 3)
    }

    // --- Draw grid overlay ---
    ctx.strokeStyle = "rgba(100, 140, 170, 0.08)"
    ctx.lineWidth = 0.5
    ctx.setLineDash([])
    const gridStep = 32
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // --- Corner info overlay ---
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    ctx.fillRect(0, height - 18, width, 18)
    ctx.fillStyle = "rgba(160, 190, 220, 0.9)"
    ctx.font = "9px monospace"
    ctx.fillText(`SAR σ⁰ (dB) · VV+VH · #${String(sampleId).padStart(4, "0")}`, 4, height - 6)
  }, [seed, width, height, showMask, sampleId])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`block rounded-md ${className}`}
      role="img"
      aria-label={`SAR preview for sample ${String(sampleId).padStart(4, "0")}${showMask ? " with segmentation mask overlay" : ""}`}
    />
  )
}
