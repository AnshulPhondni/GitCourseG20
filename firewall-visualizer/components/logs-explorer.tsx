"use client"

import { useState, useEffect } from "react"
import type { FirewallLog } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Download, RefreshCw, Clock, ArrowUpDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface LogsExplorerProps {
  logs: FirewallLog[]
  loading: boolean
}

export default function LogsExplorer({ logs, loading }: LogsExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("24h")
  const [chartData, setChartData] = useState<any[]>([])
  const [topIPs, setTopIPs] = useState<{ ip: string; count: number }[]>([])
  const [topPorts, setTopPorts] = useState<{ port: string; count: number }[]>([])

  useEffect(() => {
    // Process logs for charts and statistics
    processLogsData()
  }, [logs, timeRange])

  const processLogsData = () => {
    // Filter logs based on time range
    const now = new Date()
    const filteredLogs = logs.filter((log) => {
      const logDate = new Date(log.timestamp)
      const hoursDiff = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60)

      switch (timeRange) {
        case "1h":
          return hoursDiff <= 1
        case "6h":
          return hoursDiff <= 6
        case "24h":
          return hoursDiff <= 24
        case "7d":
          return hoursDiff <= 168 // 7 * 24
        case "30d":
          return hoursDiff <= 720 // 30 * 24
        default:
          return true
      }
    })

    // Prepare chart data
    const hourlyData: Record<string, { time: string; ALLOW: number; BLOCK: number }> = {}

    filteredLogs.forEach((log) => {
      const date = new Date(log.timestamp)
      const hourKey = date.toISOString().slice(0, 13) // Group by hour

      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = {
          time: date.toLocaleTimeString([], { hour: "2-digit", hour12: false }),
          ALLOW: 0,
          BLOCK: 0,
        }
      }

      if (log.action === "ALLOW") {
        hourlyData[hourKey].ALLOW += 1
      } else if (log.action === "BLOCK") {
        hourlyData[hourKey].BLOCK += 1
      }
    })

    // Convert to array and sort by time
    const chartDataArray = Object.values(hourlyData).sort((a, b) => a.time.localeCompare(b.time))

    setChartData(chartDataArray)

    // Calculate top IPs
    const ipCounts: Record<string, number> = {}
    filteredLogs.forEach((log) => {
      const ip = log.sourceIP
      if (ip) {
        ipCounts[ip] = (ipCounts[ip] || 0) + 1
      }
    })

    const sortedIPs = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    setTopIPs(sortedIPs)

    // Calculate top ports
    const portCounts: Record<string, number> = {}
    filteredLogs.forEach((log) => {
      const port = log.port || "unknown"
      portCounts[port] = (portCounts[port] || 0) + 1
    })

    const sortedPorts = Object.entries(portCounts)
      .map(([port, count]) => ({ port, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    setTopPorts(sortedPorts)
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.sourceIP && log.sourceIP.includes(searchTerm)) ||
      (log.destinationIP && log.destinationIP.includes(searchTerm)) ||
      (log.port && log.port.toString().includes(searchTerm)) ||
      (log.protocol && log.protocol.includes(searchTerm))

    const matchesFilter =
      filterAction === "all" ||
      (filterAction === "allow" && log.action === "ALLOW") ||
      (filterAction === "block" && log.action === "BLOCK")

    return matchesSearch && matchesFilter
  })

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "firewall_logs.json")
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search logs..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="allow">Allowed Only</SelectItem>
              <SelectItem value="block">Blocked Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Time Range" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleExportLogs}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={processLogsData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Traffic Over Time</CardTitle>
            <CardDescription>Allowed vs. blocked traffic</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ALLOW" fill="#22c55e" name="Allowed" />
                  <Bar dataKey="BLOCK" fill="#ef4444" name="Blocked" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No data available for the selected time range</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Statistics</CardTitle>
            <CardDescription>Most active IPs and ports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Top Source IPs</h4>
                <ul className="space-y-2">
                  {topIPs.length > 0 ? (
                    topIPs.map((item, index) => (
                      <li key={index} className="flex justify-between items-center text-sm">
                        <span>{item.ip}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground text-sm">No data available</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Top Ports</h4>
                <ul className="space-y-2">
                  {topPorts.length > 0 ? (
                    topPorts.map((item, index) => (
                      <li key={index} className="flex justify-between items-center text-sm">
                        <span>Port {item.port}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground text-sm">No data available</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Log Entries</CardTitle>
          <CardDescription>
            Showing {Math.min(filteredLogs.length, 100)} of {filteredLogs.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {filteredLogs.length > 0 ? (
              filteredLogs.slice(0, 100).map((log, index) => (
                <div key={index} className="p-3 border rounded-md text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <Badge variant={log.action === "ALLOW" ? "success" : "destructive"}>{log.action}</Badge>
                    <span className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{log.sourceIP}</span>
                    <ArrowUpDown className="h-4 w-4 mx-2" />
                    <span>{log.destinationIP}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Port: {log.port || "N/A"} | Protocol: {log.protocol || "N/A"} | Rule: {log.ruleId || "N/A"}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No log entries match your criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
