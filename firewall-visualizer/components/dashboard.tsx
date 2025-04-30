"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FirewallGraph from "@/components/firewall-graph"
import RulesList from "@/components/rules-list"
import LogsExplorer from "@/components/logs-explorer"
import StatisticsPanel from "@/components/statistics-panel"
import { useToast } from "@/components/ui/use-toast"
import { getFirewallStatus, getFirewallRules, getFirewallLogs } from "@/lib/firewall-service"
import { setupWebSocket } from "@/lib/websocket"
import type { FirewallRule, FirewallLog, FirewallStatus } from "@/lib/types"

export default function Dashboard() {
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [logs, setLogs] = useState<FirewallLog[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const statusData = await getFirewallStatus()
        const rulesData = await getFirewallRules()
        const logsData = await getFirewallLogs()

        setStatus(statusData)
        setRules(rulesData)
        setLogs(logsData)
      } catch (error) {
        console.error("Error fetching firewall data:", error)
        toast({
          title: "Error",
          description: "Failed to fetch firewall data. Please check your connection and permissions.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Set up WebSocket for real-time updates
    const ws = setupWebSocket({
      onStatusUpdate: (newStatus) => setStatus(newStatus),
      onRulesUpdate: (newRules) => setRules(newRules),
      onLogsUpdate: (newLogs) => {
        setLogs((prevLogs) => [...newLogs, ...prevLogs].slice(0, 1000)) // Keep last 1000 logs
      },
      onError: (error) => {
        console.error("WebSocket error:", error)
        toast({
          title: "Connection Error",
          description: "Real-time updates interrupted. Trying to reconnect...",
          variant: "destructive",
        })
      },
    })

    return () => {
      ws.close()
    }
  }, [toast])

  return (
    <div className="container py-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Firewall Status</CardTitle>
            <CardDescription>Current firewall status and configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <StatisticsPanel status={status} rules={rules} logs={logs} loading={loading} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="visualization" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="visualization" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Firewall Rules Visualization</CardTitle>
              <CardDescription>Interactive visualization of your firewall rules and connections</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <FirewallGraph rules={rules} logs={logs} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Firewall Rules</CardTitle>
              <CardDescription>Manage and inspect your firewall rules</CardDescription>
            </CardHeader>
            <CardContent>
              <RulesList rules={rules} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Firewall Logs</CardTitle>
              <CardDescription>Explore and analyze firewall logs</CardDescription>
            </CardHeader>
            <CardContent>
              <LogsExplorer logs={logs} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
