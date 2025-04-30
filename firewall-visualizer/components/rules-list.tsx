"use client"

import { useState } from "react"
import type { FirewallRule } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, MoreVertical, Plus, Edit, Trash, Power, PowerOff, Download } from "lucide-react"
import { toggleRule, deleteRule, addRule } from "@/lib/firewall-service"
import { useToast } from "@/components/ui/use-toast"
import RuleForm from "@/components/rule-form"

interface RulesListProps {
  rules: FirewallRule[]
  loading: boolean
}

export default function RulesList({ rules, loading }: RulesListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<FirewallRule | null>(null)
  const { toast } = useToast()

  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      rule.id.toString().includes(searchTerm) ||
      (rule.sourceIP && rule.sourceIP.includes(searchTerm)) ||
      (rule.destinationIP && rule.destinationIP.includes(searchTerm)) ||
      (rule.port && rule.port.toString().includes(searchTerm)) ||
      (rule.description && rule.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesFilter =
      filterAction === "all" ||
      (filterAction === "allow" && rule.action === "ALLOW") ||
      (filterAction === "block" && rule.action === "BLOCK") ||
      (filterAction === "enabled" && rule.enabled) ||
      (filterAction === "disabled" && !rule.enabled)

    return matchesSearch && matchesFilter
  })

  const handleToggleRule = async (ruleId: string) => {
    try {
      await toggleRule(ruleId)
      toast({
        title: "Rule Updated",
        description: `Rule ${ruleId} has been toggled.`,
      })
    } catch (error) {
      console.error("Error toggling rule:", error)
      toast({
        title: "Error",
        description: "Failed to update rule. Please check your permissions.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteRule(ruleId)
      toast({
        title: "Rule Deleted",
        description: `Rule ${ruleId} has been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting rule:", error)
      toast({
        title: "Error",
        description: "Failed to delete rule. Please check your permissions.",
        variant: "destructive",
      })
    }
  }

  const handleEditRule = (rule: FirewallRule) => {
    setSelectedRule(rule)
    setIsEditDialogOpen(true)
  }

  const handleExportRules = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rules, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "firewall_rules.json")
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search rules..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rules</SelectItem>
              <SelectItem value="allow">Allow Rules</SelectItem>
              <SelectItem value="block">Block Rules</SelectItem>
              <SelectItem value="enabled">Enabled Only</SelectItem>
              <SelectItem value="disabled">Disabled Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleExportRules}>
            <Download className="h-4 w-4" />
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Firewall Rule</DialogTitle>
                <DialogDescription>Create a new firewall rule to allow or block traffic.</DialogDescription>
              </DialogHeader>
              <RuleForm
                onSubmit={(newRule) => {
                  addRule(newRule)
                  setIsAddDialogOpen(false)
                  toast({
                    title: "Rule Added",
                    description: "New firewall rule has been added successfully.",
                  })
                }}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead className="text-right">Options</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRules.length > 0 ? (
              filteredRules.map((rule) => (
                <TableRow key={rule.id} className={!rule.enabled ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{rule.id}</TableCell>
                  <TableCell>
                    <Badge variant={rule.action === "ALLOW" ? "success" : "destructive"}>{rule.action}</Badge>
                  </TableCell>
                  <TableCell>{rule.sourceIP || "Any"}</TableCell>
                  <TableCell>{rule.destinationIP || "Any"}</TableCell>
                  <TableCell>{rule.port || "Any"}</TableCell>
                  <TableCell>{rule.protocol || "Any"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Rule Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleRule(rule.id)}>
                          {rule.enabled ? (
                            <>
                              <PowerOff className="mr-2 h-4 w-4" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Power className="mr-2 h-4 w-4" />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No rules found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Firewall Rule</DialogTitle>
            <DialogDescription>Modify the existing firewall rule.</DialogDescription>
          </DialogHeader>
          {selectedRule && (
            <RuleForm
              rule={selectedRule}
              onSubmit={(updatedRule) => {
                // Update rule logic would go here
                setIsEditDialogOpen(false)
                toast({
                  title: "Rule Updated",
                  description: "Firewall rule has been updated successfully.",
                })
              }}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
