"use client"

import type { FirewallRule, FirewallLog, FirewallStatus } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, AlertTriangle, Activity, Server } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface StatisticsPanelProps {
  status: FirewallStatus | null
  rules: FirewallRule[]
  logs: FirewallLog[]
  loading: boolean
}

export default function StatisticsPanel({ status, rules, logs, loading }: StatisticsPanelProps) {
  // Calculate statistics
  const activeRules = rules.filter((rule) => rule.enabled).length
  const blockedAttempts = logs.filter((log) => log.action === "BLOCK").length
  const recentLogs = logs.slice(0, 100) // Last 100 logs
  const uniqueIPs = new Set(recentLogs.map((log) => log.sourceIP)).size

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Shield className="h-10 w-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Firewall Status</p>
              <h3 className="text-2xl font-bold">{status?.active ? "Active" : "Inactive"}</h3>
              <p className="text-xs text-muted-foreground">{status?.type || "Unknown"} firewall</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Server className="h-10 w-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Active Rules</p>
              <h3 className="text-2xl font-bold">{activeRules}</h3>
              <p className="text-xs text-muted-foreground">Out of {rules.length} total rules</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Blocked Attempts</p>
              <h3 className="text-2xl font-bold">{blockedAttempts}</h3>
              <p className="text-xs text-muted-foreground">In the last {logs.length} events</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Activity className="h-10 w-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Unique IPs</p>
              <h3 className="text-2xl font-bold">{uniqueIPs}</h3>
              <p className="text-xs text-muted-foreground">In recent traffic</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
