import { Suspense } from "react"
import Dashboard from "@/components/dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  )
}
