"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import * as d3 from "d3"
import type { FirewallRule, FirewallLog } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ZoomIn, ZoomOut, Play, Pause, HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RuleTooltip } from "@/components/rule-tooltip"

interface FirewallGraphProps {
  rules: FirewallRule[]
  logs: FirewallLog[]
  loading: boolean
}

export default function FirewallGraph({ rules, logs, loading }: FirewallGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { theme } = useTheme()
  const [selectedRule, setSelectedRule] = useState<FirewallRule | null>(null)
  const [simulationRunning, setSimulationRunning] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [showHelp, setShowHelp] = useState(false)
  const [viewMode, setViewMode] = useState<"network" | "rules">("network")

  useEffect(() => {
    if (loading || !svgRef.current || rules.length === 0) return

    const width = svgRef.current.clientWidth
    const height = 600

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove()

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;")

    // Create a group for zoom/pan
    const g = svg.append("g")

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom as any)

    // Set initial zoom level
    svg.call((zoom as any).transform, d3.zoomIdentity.scale(zoomLevel))

    // Prepare data for visualization
    const nodes: any[] = []
    const links: any[] = []

    // Add firewall as central node
    nodes.push({
      id: "firewall",
      name: "Firewall",
      type: "firewall",
      radius: 30,
    })

    // Add nodes for unique IPs in rules
    const uniqueIPs = new Set<string>()

    rules.forEach((rule) => {
      if (rule.sourceIP && rule.sourceIP !== "any") uniqueIPs.add(rule.sourceIP)
      if (rule.destinationIP && rule.destinationIP !== "any") uniqueIPs.add(rule.destinationIP)
    })

    // Add recent IPs from logs
    logs.slice(0, 50).forEach((log) => {
      if (log.sourceIP) uniqueIPs.add(log.sourceIP)
      if (log.destinationIP) uniqueIPs.add(log.destinationIP)
    })

    // Create nodes for IPs
    uniqueIPs.forEach((ip) => {
      nodes.push({
        id: ip,
        name: ip,
        type: "ip",
        radius: 15,
      })
    })

    // Create links for rules
    rules.forEach((rule, index) => {
      const sourceId = rule.sourceIP && rule.sourceIP !== "any" ? rule.sourceIP : "any_source_" + index
      const targetId = rule.destinationIP && rule.destinationIP !== "any" ? rule.destinationIP : "any_dest_" + index

      // Add "any" nodes if needed
      if (sourceId.startsWith("any_source_")) {
        nodes.push({
          id: sourceId,
          name: "Any",
          type: "any",
          radius: 10,
        })
      }

      if (targetId.startsWith("any_dest_")) {
        nodes.push({
          id: targetId,
          name: "Any",
          type: "any",
          radius: 10,
        })
      }

      // Create link
      links.push({
        source: sourceId,
        target: "firewall",
        rule: rule,
        value: 1,
      })

      links.push({
        source: "firewall",
        target: targetId,
        rule: rule,
        value: 1,
      })
    })

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => d.radius + 10),
      )

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => Math.sqrt(d.value) * 2)
      .attr("stroke", (d: any) => {
        if (!d.rule) return theme === "dark" ? "#555" : "#ddd"
        return d.rule.action === "ALLOW" ? "#22c55e" : "#ef4444"
      })
      .attr("stroke-dasharray", (d: any) => {
        return d.rule && !d.rule.enabled ? "5,5" : null
      })

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", (d: any) => {
        if (d.type === "firewall") return "#7c3aed"
        if (d.type === "any") return "#94a3b8"

        // Check if this IP appears in logs
        const ipInLogs = logs.some((log) => log.sourceIP === d.id || log.destinationIP === d.id)

        return ipInLogs ? "#f97316" : "#3b82f6"
      })
      .attr("stroke", theme === "dark" ? "#fff" : "#000")
      .attr("stroke-width", 1.5)
      .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any)

    // Add labels
    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text((d: any) => d.name)
      .attr("font-size", (d: any) => (d.type === "firewall" ? "14px" : "10px"))
      .attr("fill", theme === "dark" ? "#fff" : "#000")
      .attr("pointer-events", "none")

    // Add tooltips for nodes
    node.append("title").text((d: any) => {
      if (d.type === "firewall") return "Firewall"
      if (d.type === "any") return "Any IP Address"
      return `IP: ${d.id}`
    })

    // Add click event to nodes
    node.on("click", (event: any, d: any) => {
      if (d.type === "ip") {
        // Find rules related to this IP
        const relatedRules = rules.filter((rule) => rule.sourceIP === d.id || rule.destinationIP === d.id)

        if (relatedRules.length > 0) {
          setSelectedRule(relatedRules[0])
        }
      }
    })

    // Add click event to links
    link.on("click", (event: any, d: any) => {
      if (d.rule) {
        setSelectedRule(d.rule)
      }
    })

    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)

      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
    })

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    // Control simulation
    if (!simulationRunning) {
      simulation.stop()
    }

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [rules, logs, loading, theme, zoomLevel, simulationRunning, viewMode])

  if (loading) {
    return <Skeleton className="h-[600px] w-full" />
  }

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-10 flex space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setZoomLevel(Math.min(zoomLevel + 0.5, 5))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom In</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setZoomLevel(Math.max(zoomLevel - 0.5, 0.5))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom Out</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setSimulationRunning(!simulationRunning)}>
                {simulationRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{simulationRunning ? "Pause Simulation" : "Resume Simulation"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setShowHelp(!showHelp)}>
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show Help</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "network" | "rules")} className="mb-4">
        <TabsList>
          <TabsTrigger value="network">Network View</TabsTrigger>
          <TabsTrigger value="rules">Rules View</TabsTrigger>
        </TabsList>
      </Tabs>

      {showHelp && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-2">Visualization Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-1">Node Types</h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#7c3aed] mr-2"></span>
                    <span>Firewall (central node)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#3b82f6] mr-2"></span>
                    <span>IP Address</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#f97316] mr-2"></span>
                    <span>Active IP (appears in logs)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-[#94a3b8] mr-2"></span>
                    <span>"Any" Address</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">Connection Types</h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <span className="inline-block w-6 h-1 bg-[#22c55e] mr-2"></span>
                    <span>Allowed Traffic</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-6 h-1 bg-[#ef4444] mr-2"></span>
                    <span>Blocked Traffic</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-6 h-1 border-t border-dashed border-gray-500 mr-2"></span>
                    <span>Disabled Rule</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-sm mt-2">
              <strong>Tip:</strong> Click on nodes or connections to see details. Drag nodes to reposition them.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <svg ref={svgRef} className="w-full h-[600px] bg-background"></svg>
      </div>

      {selectedRule && (
        <RuleTooltip
          rule={selectedRule}
          onClose={() => setSelectedRule(null)}
          relatedLogs={logs.filter(
            (log) =>
              (log.sourceIP === selectedRule.sourceIP || selectedRule.sourceIP === "any") &&
              (log.destinationIP === selectedRule.destinationIP || selectedRule.destinationIP === "any") &&
              (log.port === selectedRule.port || selectedRule.port === "any"),
          )}
        />
      )}
    </div>
  )
}
