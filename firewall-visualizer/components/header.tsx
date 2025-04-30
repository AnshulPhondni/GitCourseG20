import { ModeToggle } from "@/components/mode-toggle"
import { Shield } from "lucide-react"
import Link from "next/link"

export default function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Firewall Rule Visualizer</h1>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex">
            <ul className="flex items-center gap-6">
              <li>
                <Link href="/" className="text-sm font-medium hover:underline">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/rules" className="text-sm font-medium hover:underline">
                  Rules
                </Link>
              </li>
              <li>
                <Link href="/logs" className="text-sm font-medium hover:underline">
                  Logs
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-sm font-medium hover:underline">
                  Settings
                </Link>
              </li>
            </ul>
          </nav>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
