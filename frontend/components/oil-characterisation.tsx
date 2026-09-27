"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Activity } from "lucide-react"
import defaultData from "@/public/data/oil_characterisation.json"

export interface Characteristic {
  label: string
  value: number // 0–1 decimal
}

export interface OilCharacterisationData {
  incident: string
  sensor: string
  reference: string
  status: string
  confidence: number
  characteristics: Characteristic[]
}

interface OilCharacterisationProps {
  incidentId?: string
}

export function OilCharacterisation({ incidentId }: OilCharacterisationProps) {
  const [data, setData] = useState<OilCharacterisationData>(defaultData as OilCharacterisationData)

  useEffect(() => {
    // Dynamically load from JSON data source
    fetch("/data/oil_characterisation.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch characterisation data")
        return res.json()
      })
      .then((json: OilCharacterisationData) => {
        setData(json)
      })
      .catch((err) => {
        console.warn("Using bundled oil characterisation data:", err)
      })
  }, [])

  const displayIncident = incidentId || data.incident

  // Confidence mapping based on value
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return {
        label: "HIGH",
        className: "border-[oklch(0.7_0.14_145)]/40 bg-[oklch(0.7_0.14_145)]/15 text-[oklch(0.82_0.14_145)]",
      }
    }
    if (confidence >= 0.6) {
      return {
        label: "MEDIUM",
        className: "border-[oklch(0.75_0.15_75)]/40 bg-[oklch(0.75_0.15_75)]/15 text-[oklch(0.82_0.15_75)]",
      }
    }
    return {
      label: "LOW",
      className: "border-destructive/40 bg-destructive/15 text-destructive",
    }
  }

  const confMeta = getConfidenceBadge(data.confidence)

  return (
    <div className="shrink-0 rounded-xl border border-border bg-card shadow-xs">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              OIL CHARACTERISATION
            </h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              ESTIMATED SPECTRAL PROFILE
            </p>
          </div>
        </div>
        <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
          {displayIncident}
        </span>
      </div>

      {/* Progress Bars for Characteristics */}
      <div className="flex flex-col gap-3.5 p-4">
        {data.characteristics.map((item, idx) => {
          const percent = Math.round(item.value * 100)
          return (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                  {percent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    idx === 0
                      ? "bg-primary"
                      : idx === 1
                      ? "bg-primary/80"
                      : "bg-primary/60"
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary & Spectral Metadata */}
      <div className="border-t border-border px-4 py-3">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spectral Match</span>
            <span className="font-mono font-semibold text-foreground">
              {Math.round(data.confidence * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Confidence</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase",
                confMeta.className
              )}
            >
              {confMeta.label}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sensor</span>
            <span className="font-mono text-foreground">{data.sensor}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-mono text-foreground">{data.reference}</span>
          </div>
        </div>
      </div>

      {/* Scientific Disclaimer */}
      <div className="border-t border-border bg-secondary/30 px-4 py-2.5">
        <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
          Estimated from spectral reference data · Not laboratory analysis
        </p>
      </div>
    </div>
  )
}
