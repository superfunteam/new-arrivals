import * as React from "react"
import { cn } from "../../lib/utils"

export function Tooltip({ children, content }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
      </div>
    </div>
  )
}
