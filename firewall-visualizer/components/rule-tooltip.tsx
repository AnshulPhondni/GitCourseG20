"use client"

import { useState } from "react"
import type { FirewallRule, FirewallLog } from "@/lib/types"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Info, AlertTriangle, Clock, ArrowUpDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toggleRule } from "@/lib/firewall-service"
import { useToast } from "@/components/ui/use-toast"

interface RuleTooltipProps {
  rule: FirewallRule
  relatedLogs: FirewallLog[]
  onClose: () => void
}

export function RuleTooltip({ rule, relatedLogs, onClose }: RuleTooltipProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleToggleRule = async () => {
    try {
      setLoading(true)
      await toggleRule(rule.id)
      toast({
        title: "Rule Updated",
        description: `Rule ${rule.id} has been ${rule.enabled ? "disabled" : "enabled"}.`,
      })
    } catch (error) {
      console.error("Error toggling rule:", error)
      toast({
        title: "Error",
        description: "Failed to update rule. Please check your permissions.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="absolute bottom-4 right-4 w-96 z-20 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            <Info className="h-5 w-5 mr-2 text-primary" />
            Rule #{rule.id}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="logs">
              Logs
              {relatedLogs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {relatedLogs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={rule.enabled ? "default" : "outline"}>{rule.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Action:</span>
                <Badge variant={rule.action === "ALLOW" ? "success" : "destructive"}>{rule.action}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Source:</span>
                <span className="text-sm">{rule.sourceIP || "Any"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Destination:</span>
                <span className="text-sm">{rule.destinationIP || "Any"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Port:</span>
                <span className="text-sm">{rule.port || "Any"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Protocol:</span>
                <span className="text-sm">{rule.protocol || "Any"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Priority:</span>
                <span className="text-sm">{rule.priority}</span>
              </div>
              {rule.description && (
                <div>
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm mt-1">{rule.description}</p>
                </div>
              )}
            </div>
            <div className="mt-4 p-3 bg-muted rounded-md">
              <h4 className="text-sm font-medium mb-1">Educational Note:</h4>
              <p className="text-xs">
                {rule.action === "ALLOW"
                  ? `This rule allows traffic from ${rule.sourceIP || "any source"} to ${rule.destinationIP || "any destination"} ${rule.port ? `on port ${rule.port}` : "on any port"}. Rules are processed in order of priority.`
                  : `This rule blocks traffic from ${rule.sourceIP || "any source"} to ${rule.destinationIP || "any destination"} ${rule.port ? `on port ${rule.port}` : "on any port"}. Blocked traffic will be logged if logging is enabled.`}
              </p>
            </div>
          </TabsContent>
          <TabsContent value="logs" className="pt-4">
            {relatedLogs.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {relatedLogs.slice(0, 10).map((log, index) => (
                  <div key={index} className="p-2 border rounded-md text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant={log.action === "ALLOW" ? "success" : "destructive"} className="text-[10px]">
                        {log.action}
                      </Badge>
                      <span className="flex items-center text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{log.sourceIP}</span>
                      <ArrowUpDown className="h-3 w-3 mx-1" />
                      <span>{log.destinationIP}</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Port: {log.port || "N/A"} | Protocol: {log.protocol || "N/A"}
                    </div>
                  </div>
                ))}
                {relatedLogs.length > 10 && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    + {relatedLogs.length - 10} more entries
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No matching logs found for this rule.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          variant={rule.enabled ? "outline" : "default"}
          size="sm"
          className="w-full"
          onClick={handleToggleRule}
          disabled={loading}
        >
          {rule.enabled ? "Disable Rule" : "Enable Rule"}
        </Button>
      </CardFooter>
    </Card>
  )
}
