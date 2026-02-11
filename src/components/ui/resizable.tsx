"use client"

import { GripVerticalIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRef, useCallback, useState, useEffect } from "react"

interface ResizablePanelGroupProps {
  children: React.ReactNode
  className?: string
}

interface ResizableContextType {
  registerPanel: (id: string, defaultSize: number, minSize?: number, maxSize?: number) => void
  sizes: Record<string, number>
  startResize: (separatorIndex: number) => void
}

function ResizablePanelGroup({ children, className }: ResizablePanelGroupProps) {
  return (
    <div className={cn("flex h-full w-full flex-row overflow-hidden", className)}>
      {children}
    </div>
  )
}

interface ResizablePanelProps {
  children: React.ReactNode
  className?: string
  defaultSize: number // percentage 0-100
  minSize?: number
  maxSize?: number
}

function ResizablePanel({
  children,
  className,
  defaultSize,
  minSize = 0,
  maxSize = 100,
}: ResizablePanelProps) {
  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        flex: `${defaultSize} 1 0%`,
        minWidth: `${minSize}%`,
        maxWidth: `${maxSize}%`,
      }}
    >
      {children}
    </div>
  )
}

interface ResizableHandleProps {
  withHandle?: boolean
  className?: string
  onDrag?: (deltaPercent: number) => void
}

function ResizableHandle({ withHandle, className }: ResizableHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX

    const handle = handleRef.current
    if (!handle) return

    const parent = handle.parentElement
    if (!parent) return

    const prevSibling = handle.previousElementSibling as HTMLElement
    const nextSibling = handle.nextElementSibling as HTMLElement
    if (!prevSibling || !nextSibling) return

    const parentWidth = parent.getBoundingClientRect().width
    const prevStartWidth = prevSibling.getBoundingClientRect().width
    const nextStartWidth = nextSibling.getBoundingClientRect().width

    const prevMinWidth = parseFloat(prevSibling.style.minWidth || "0") / 100 * parentWidth
    const prevMaxWidth = parseFloat(prevSibling.style.maxWidth || "100") / 100 * parentWidth
    const nextMinWidth = parseFloat(nextSibling.style.minWidth || "0") / 100 * parentWidth
    const nextMaxWidth = parseFloat(nextSibling.style.maxWidth || "100") / 100 * parentWidth

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return

      const delta = ev.clientX - startX.current
      let newPrevWidth = prevStartWidth + delta
      let newNextWidth = nextStartWidth - delta

      // Apply constraints
      newPrevWidth = Math.max(prevMinWidth, Math.min(prevMaxWidth, newPrevWidth))
      newNextWidth = Math.max(nextMinWidth, Math.min(nextMaxWidth, newNextWidth))

      // Recalculate to respect both constraints
      const totalWidth = prevStartWidth + nextStartWidth
      if (newPrevWidth + newNextWidth > totalWidth) {
        if (delta > 0) newNextWidth = totalWidth - newPrevWidth
        else newPrevWidth = totalWidth - newNextWidth
      }

      const prevFlex = (newPrevWidth / parentWidth) * 100
      const nextFlex = (newNextWidth / parentWidth) * 100

      prevSibling.style.flex = `${prevFlex} 1 0%`
      nextSibling.style.flex = `${nextFlex} 1 0%`
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className={cn(
        "bg-border relative flex w-1.5 shrink-0 items-center justify-center cursor-col-resize hover:bg-primary/20 transition-colors select-none",
        className
      )}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-6 w-3 items-center justify-center rounded-sm border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </div>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
