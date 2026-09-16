import { DashboardHeader } from "@/components/dashboard-header"
import { OiltraceWorkspace } from "@/components/oiltrace-workspace"

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
        <DashboardHeader />
        <OiltraceWorkspace />
      </div>
    </main>
  )
}
