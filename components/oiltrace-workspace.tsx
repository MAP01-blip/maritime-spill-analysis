"use client"

import { useState } from "react"
import { SpillMap } from "@/components/spill-map"
import { CandidateSidebar } from "@/components/candidate-sidebar"
import { DriftSimulator } from "@/components/drift-simulator"
import { EvidenceAuditTrail } from "@/components/evidence-audit-trail"

export function OiltraceWorkspace() {
  const [driftOpen, setDriftOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SpillMap onInspectSlick={() => setDriftOpen(true)} />
        </div>
        <CandidateSidebar onAuditVesselA={() => setAuditOpen(true)} />
      </div>

      <DriftSimulator open={driftOpen} onOpenChange={setDriftOpen} />
      <EvidenceAuditTrail open={auditOpen} onOpenChange={setAuditOpen} />
    </>
  )
}
