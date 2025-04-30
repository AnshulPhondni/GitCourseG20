export interface FirewallStatus {
  active: boolean
  type: "ufw" | "iptables" | "unknown"
  version?: string
  defaultPolicy?: "allow" | "deny"
  loggingEnabled?: boolean
}

export interface FirewallRule {
  id: string
  action: "ALLOW" | "BLOCK"
  sourceIP?: string
  destinationIP?: string
  port?: string
  protocol?: string
  priority: number
  enabled: boolean
  description?: string
}

export interface FirewallLog {
  timestamp: string
  action: "ALLOW" | "BLOCK"
  sourceIP: string
  destinationIP: string
  port?: string
  protocol?: string
  ruleId?: string
  interface?: string
  message?: string
}
