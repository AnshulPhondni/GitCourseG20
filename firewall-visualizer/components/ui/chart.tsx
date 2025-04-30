"use client"

import type * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ChartContainerProps {
  children: React.ReactNode
}

export function ChartContainer({ children }: ChartContainerProps) {
  return <div className="rounded-md border p-4">{children}</div>
}

interface ChartBarsProps {
  data: { label: string; value: number }[]
}

export function ChartBars({ data }: ChartBarsProps) {
  return (
    <div className="flex items-center gap-2">
      {data.map((item) => (
        <TooltipProvider key={item.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center">
                <div className="h-5 w-2 rounded-md bg-primary" style={{ height: `${item.value}%` }} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {item.label}: {item.value}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  )
}

interface ChartTooltipProps {
  children: React.ReactNode
}

export function ChartTooltip({ children }: ChartTooltipProps) {
  return <TooltipContent>{children}</TooltipContent>
}
