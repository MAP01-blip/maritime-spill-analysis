"use client"

import { useCallback, useState } from "react"
import { SpillMap } from "@/components/spill-map"
import { CandidateSidebar } from "@/components/candidate-sidebar"
import { DriftSimulator } from "@/components/drift-simulator"
import { EvidenceAuditTrail } from "@/components/evidence-audit-trail"
import { DatasetExplorer } from "@/components/dataset-explorer"
import type { Sample } from "@/components/dataset-explorer"
import { cn } from "@/lib/utils"
import { Layers, Database } from "lucide-react"

type Tab = "detection" | "dataset"

export function OiltraceWorkspace() {
  const [driftOpen, setDriftOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("detection")
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null)

  const handleSelectSample = useCallback((sample: Sample | null) => {
    setSelectedSample(sample)
    if (sample) setActiveTab("detection")
  }, [])

  return (
    <>
      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Workspace view"
        className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/40 p-1 sm:w-fit sm:grid-cols-2"
      >
        <button
          role="tab"
          aria-selected={activeTab === "detection"}
          onClick={() => setActiveTab("detection")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors",
            activeTab === "detection"
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="size-3.5" />
          Detection Map
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "dataset"}
          onClick={() => setActiveTab("dataset")}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors",
            activeTab === "dataset"
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Database className="size-3.5" />
          Dataset Explorer
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "detection" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <SpillMap
              sample={selectedSample}
              onInspectSlick={() => setDriftOpen(true)}
            />
          </div>
          <CandidateSidebar
            sample={selectedSample}
            onAuditVesselA={() => setAuditOpen(true)}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DatasetExplorer
            selectedSample={selectedSample}
            onSelectSample={handleSelectSample}
          />
        </div>
      )}

      <DriftSimulator open={driftOpen} onOpenChange={setDriftOpen} />
      <EvidenceAuditTrail open={auditOpen} onOpenChange={setAuditOpen} />
    </>
  )
}
