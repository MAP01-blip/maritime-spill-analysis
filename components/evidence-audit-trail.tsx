"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ShieldCheck, Hash, Fingerprint, Clock, Check } from "lucide-react"

interface Dimension {
  key: string
  desc: string
  weight: number
  raw: number
  digest: string
}

const dimensions: Dimension[] = [
  {
    key: "Spatial",
    desc: "Slick–vessel proximity & polygon overlap (Hausdorff distance)",
    weight: 0.3,
    raw: 0.94,
    digest: "9f2a1c7e4b0d8a35",
  },
  {
    key: "Temporal",
    desc: "Time-of-passage vs. SAR acquisition window",
    weight: 0.25,
    raw: 0.88,
    digest: "3c6b9d02f7e1a4c8",
  },
  {
    key: "Trajectory",
    desc: "Course alignment with backward-drift corridor S",
    weight: 0.25,
    raw: 0.9,
    digest: "e81047af2d6c9b13",
  },
  {
    key: "AIS Quality",
    desc: "Message integrity, continuity & spoof checks",
    weight: 0.2,
    raw: 0.96,
    digest: "b5d3e9014c7a2f68",
  },
]

const composite = dimensions.reduce((s, d) => s + d.weight * d.raw, 0)

const MERKLE_ROOT =
  "0x7b1e9f4a2c8d05e63a1f74b9c0d2e8a5f39b6c1704ad8e2f5b93c6a0d417e8f2"
const SIGNATURE =
  "ed25519:3045022100c4f1...a9e2 0220118b7d...f60c4e9a2b8815d3"
const KEY_ID = "oiltrace-attest-key-2026-03 · SHA-256/Ed25519"
const ANCHOR = "att:5f3c...9b04 · block #4,812,663"

interface EvidenceAuditTrailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EvidenceAuditTrail({
  open,
  onOpenChange,
}: EvidenceAuditTrailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden border-border bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Evidence Audit Trail — Vessel A
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            MMSI 636092841 · deterministic score attestation
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          {/* Composite score */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Composite relevance score
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Σ (weightᵢ × scoreᵢ)
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                {composite.toFixed(2)}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-[oklch(0.7_0.14_145)]/40 bg-[oklch(0.7_0.14_145)]/15 px-2 py-0.5 text-[11px] font-medium text-[oklch(0.82_0.14_145)]">
                <Check className="size-3" aria-hidden="true" />
                High Relevance
              </span>
            </div>
          </div>

          {/* Dimension breakdown */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Weighted dimension breakdown
            </h3>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Dimension</th>
                    <th className="px-3 py-2 text-right font-medium">Weight</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Contribution
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dimensions.map((d) => {
                    const contribution = d.weight * d.raw
                    return (
                      <tr key={d.key} className="align-top">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-foreground">{d.key}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                            {d.desc}
                          </p>
                          <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80">
                            <Hash className="size-2.5" aria-hidden="true" />
                            {d.digest}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                          {d.weight.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                          {d.raw.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono tabular-nums text-foreground">
                            {contribution.toFixed(3)}
                          </span>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(contribution / composite) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-secondary/40 font-semibold">
                    <td className="px-3 py-2.5" colSpan={3}>
                      Composite
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {composite.toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cryptographic attestation */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cryptographic attestation
            </h3>
            <dl className="space-y-2.5 rounded-lg border border-border bg-secondary/20 p-4">
              <CryptoRow
                icon={<Hash className="size-3.5" aria-hidden="true" />}
                label="Merkle root"
                value={MERKLE_ROOT}
              />
              <CryptoRow
                icon={<Fingerprint className="size-3.5" aria-hidden="true" />}
                label="Signature"
                value={SIGNATURE}
              />
              <CryptoRow
                icon={<ShieldCheck className="size-3.5" aria-hidden="true" />}
                label="Signing key"
                value={KEY_ID}
              />
              <CryptoRow
                icon={<Clock className="size-3.5" aria-hidden="true" />}
                label="Anchored"
                value={`2026-09-15 04:18:07Z · ${ANCHOR}`}
              />
            </dl>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[oklch(0.7_0.14_145)]/40 bg-[oklch(0.7_0.14_145)]/10 px-4 py-3">
            <ShieldCheck
              className="size-5 shrink-0 text-[oklch(0.82_0.14_145)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-[oklch(0.86_0.14_145)]">
                Integrity verified
              </p>
              <p className="text-[11px] text-muted-foreground">
                All four dimension digests hash to the anchored Merkle root; the
                signature is valid and unmodified since attestation.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CryptoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="flex w-32 shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 break-all font-mono text-[11px] text-foreground">
        {value}
      </dd>
    </div>
  )
}
