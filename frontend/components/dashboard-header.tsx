import { Droplets, Radio, Satellite, Database } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <Droplets className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            OilTrace
            <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
              Maritime Spill Intelligence
            </span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Incident SLICK-0417 · North Adriatic · confidence attribution
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip icon={Satellite} label="SAR feed" value="Live" tone="good" />
        <StatusChip icon={Radio} label="AIS" value="1 gap" tone="warn" />
        <StatusChip icon={Database} label="Dataset" value="1,200" tone="good" />
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[oklch(0.75_0.15_75)] opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-[oklch(0.75_0.15_75)]" />
          </span>
          Analyzing
        </span>
      </div>
    </header>
  )
}

function StatusChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Satellite
  label: string
  value: string
  tone: "good" | "warn"
}) {
  const valueColor = tone === "good" ? "text-[oklch(0.8_0.14_145)]" : "text-[oklch(0.82_0.15_75)]"
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </span>
  )
}
