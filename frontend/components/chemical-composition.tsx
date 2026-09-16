import { cn } from "@/lib/utils"
import { FlaskConical } from "lucide-react"

interface Substance {
  label: string
  probability: number // 0-100, sums to ~100 across the set
  tone: "primary" | "muted"
  note?: string
}

// Estimated from SAR backscatter texture + fluorescence/viscosity proxy signature.
const substances: Substance[] = [
  { label: "Diesel / Marine Gas Oil", probability: 62, tone: "primary", note: "Best match" },
  { label: "Crude Oil", probability: 24, tone: "muted" },
  { label: "Petrol / Gasoline", probability: 9, tone: "muted" },
  { label: "Other / Unclassified", probability: 5, tone: "muted" },
]

export function ChemicalComposition() {
  const top = substances[0]

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Chemical Composition</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Estimated substance class for SLICK-0417
            </p>
          </div>
        </div>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          {top.label.split(" / ")[0]} · {top.probability}%
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {substances.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-[11px]">
              <span
                className={cn(
                  "font-medium",
                  s.tone === "primary" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums",
                  s.tone === "primary" ? "text-primary" : "text-muted-foreground",
                )}
              >
                {s.probability}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  s.tone === "primary" ? "bg-primary" : "bg-muted-foreground/50",
                )}
                style={{ width: `${s.probability}%` }}
              />
            </div>
            {s.note ? (
              <p className="mt-1 text-[10px] text-muted-foreground/80">{s.note}</p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="border-t border-border px-4 py-2.5 text-[10px] leading-snug text-muted-foreground">
        Derived from SAR backscatter texture and fluorescence/viscosity proxy signature. Not a
        substitute for physical sampling.
      </p>
    </div>
  )
}
