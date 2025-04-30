"use client"

import type React from "react"

import { useState } from "react"
import type { FirewallRule } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DialogFooter } from "@/components/ui/dialog"

interface RuleFormProps {
  rule?: FirewallRule
  onSubmit: (rule: FirewallRule) => void
  onCancel: () => void
}

export default function RuleForm({ rule, onSubmit, onCancel }: RuleFormProps) {
  const [formData, setFormData] = useState<Partial<FirewallRule>>(
    rule || {
      action: "ALLOW",
      sourceIP: "",
      destinationIP: "",
      port: "",
      protocol: "TCP",
      priority: 0,
      enabled: true,
      description: "",
    },
  )

  const handleChange = (field: keyof FirewallRule, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData as FirewallRule)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="action" className="text-right">
            Action
          </Label>
          <Select value={formData.action} onValueChange={(value) => handleChange("action", value)}>
            <SelectTrigger id="action" className="col-span-3">
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALLOW">Allow</SelectItem>
              <SelectItem value="BLOCK">Block</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="sourceIP" className="text-right">
            Source IP
          </Label>
          <Input
            id="sourceIP"
            placeholder="Any (leave blank)"
            className="col-span-3"
            value={formData.sourceIP || ""}
            onChange={(e) => handleChange("sourceIP", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="destinationIP" className="text-right">
            Destination IP
          </Label>
          <Input
            id="destinationIP"
            placeholder="Any (leave blank)"
            className="col-span-3"
            value={formData.destinationIP || ""}
            onChange={(e) => handleChange("destinationIP", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="port" className="text-right">
            Port
          </Label>
          <Input
            id="port"
            placeholder="Any (leave blank)"
            className="col-span-3"
            value={formData.port || ""}
            onChange={(e) => handleChange("port", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="protocol" className="text-right">
            Protocol
          </Label>
          <Select value={formData.protocol || ""} onValueChange={(value) => handleChange("protocol", value)}>
            <SelectTrigger id="protocol" className="col-span-3">
              <SelectValue placeholder="Select protocol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TCP">TCP</SelectItem>
              <SelectItem value="UDP">UDP</SelectItem>
              <SelectItem value="ICMP">ICMP</SelectItem>
              <SelectItem value="ANY">Any</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="priority" className="text-right">
            Priority
          </Label>
          <Input
            id="priority"
            type="number"
            className="col-span-3"
            value={formData.priority || 0}
            onChange={(e) => handleChange("priority", Number.parseInt(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="enabled" className="text-right">
            Enabled
          </Label>
          <div className="col-span-3 flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => handleChange("enabled", checked)}
            />
            <Label htmlFor="enabled">{formData.enabled ? "Active" : "Inactive"}</Label>
          </div>
        </div>
        <div className="grid grid-cols-4 items-start gap-4">
          <Label htmlFor="description" className="text-right pt-2">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Rule description"
            className="col-span-3"
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
