import { DashboardHeader } from "@/components/dashboard-header"
import { OiltraceWorkspace } from "@/components/oiltrace-workspace"

export default function Page() {
  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-5 overflow-hidden p-4 sm:p-6">
        <DashboardHeader />
        <OiltraceWorkspace />
      </div>
    </main>
  )
}
