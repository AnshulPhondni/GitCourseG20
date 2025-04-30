import type { FirewallStatus, FirewallRule, FirewallLog } from "./types"

// Mock data for development
const mockStatus: FirewallStatus = {
  active: true,
  type: "ufw",
  version: "0.36.1",
  defaultPolicy: "deny",
  loggingEnabled: true,
}

const mockRules: FirewallRule[] = [
  {
    id: "1",
    action: "ALLOW",
    sourceIP: "any",
    destinationIP: "any",
    port: "22",
    protocol: "TCP",
    priority: 10,
    enabled: true,
    description: "Allow SSH connections",
  },
  {
    id: "2",
    action: "ALLOW",
    sourceIP: "any",
    destinationIP: "any",
    port: "80",
    protocol: "TCP",
    priority: 20,
    enabled: true,
    description: "Allow HTTP connections",
  },
  {
    id: "3",
    action: "ALLOW",
    sourceIP: "any",
    destinationIP: "any",
    port: "443",
    protocol: "TCP",
    priority: 30,
    enabled: true,
    description: "Allow HTTPS connections",
  },
  {
    id: "4",
    action: "BLOCK",
    sourceIP: "192.168.1.100",
    destinationIP: "any",
    port: "any",
    protocol: "any",
    priority: 40,
    enabled: true,
    description: "Block all traffic from suspicious IP",
  },
  {
    id: "5",
    action: "BLOCK",
    sourceIP: "any",
    destinationIP: "any",
    port: "25",
    protocol: "TCP",
    priority: 50,
    enabled: false,
    description: "Block SMTP (disabled)",
  },
  {
    id: "6",
    action: "ALLOW",
    sourceIP: "10.0.0.0/24",
    destinationIP: "any",
    port: "any",
    protocol: "any",
    priority: 60,
    enabled: true,
    description: "Allow all traffic from internal network",
  },
]

// Generate mock logs
const generateMockLogs = (): FirewallLog[] => {
  const logs: FirewallLog[] = []
  const now = new Date()
  const ips = [
    "192.168.1.100",
    "10.0.0.5",
    "172.16.0.10",
    "8.8.8.8",
    "1.1.1.1",
    "203.0.113.5",
    "198.51.100.23",
    "192.0.2.18",
  ]
  const ports = ["22", "80", "443", "25", "3306", "5432", "8080", "53"]
  const protocols = ["TCP", "UDP", "ICMP"]

  // Generate 1000 random logs over the past 7 days
  for (let i = 0; i < 1000; i++) {
    const randomTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    const sourceIP = ips[Math.floor(Math.random() * ips.length)]
    const destinationIP = ips[Math.floor(Math.random() * ips.length)]
    const port = ports[Math.floor(Math.random() * ports.length)]
    const protocol = protocols[Math.floor(Math.random() * protocols.length)]
    const action = Math.random() > 0.3 ? "ALLOW" : "BLOCK"
    const ruleId = String(Math.floor(Math.random() * 6) + 1)

    logs.push({
      timestamp: randomTime.toISOString(),
      action,
      sourceIP,
      destinationIP,
      port,
      protocol,
      ruleId,
      interface: "eth0",
      message: `${action} ${protocol} packet from ${sourceIP} to ${destinationIP} port ${port}`,
    })
  }

  // Sort logs by timestamp (newest first)
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

const mockLogs = generateMockLogs()

// Simulated API functions
export async function getFirewallStatus(): Promise<FirewallStatus> {
  // In a real app, this would make an API call to the backend
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockStatus), 500)
  })
}

export async function getFirewallRules(): Promise<FirewallRule[]> {
  // In a real app, this would make an API call to the backend
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockRules), 500)
  })
}

export async function getFirewallLogs(): Promise<FirewallLog[]> {
  // In a real app, this would make an API call to the backend
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockLogs), 500)
  })
}

export async function toggleRule(ruleId: string): Promise<void> {
  // In a real app, this would make an API call to the backend
  return new Promise((resolve) => {
    const rule = mockRules.find((r) => r.id === ruleId)
    if (rule) {
      rule.enabled = !rule.enabled
    }
    setTimeout(() => resolve(), 300)
  })
}

export async function deleteRule(ruleId: string): Promise<void> {
  // In a real app, this would make an API call to the backend
  return new Promise((resolve) => {
    const index = mockRules.findIndex((r) => r.id === ruleId)
    if (index !== -1) {
      mockRules.splice(index, 1)
    }
    setTimeout(() => resolve(), 300)
  })
}

export async function addRule(rule: FirewallRule): Promise<void> {
  // In a real app, this would make an API call to the backend
  return new Promise((resolve) => {
    // Generate a new ID
    rule.id = String(Math.max(...mockRules.map((r) => Number.parseInt(r.id))) + 1)
    mockRules.push(rule)
    setTimeout(() => resolve(), 300)
  })
}
