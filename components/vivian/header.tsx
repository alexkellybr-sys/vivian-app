"use client"

import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"

interface HeaderProps {
  title: string
  onBack?: () => void
  rightIcon?: ReactNode
}

export function Header({ title, onBack, rightIcon }: HeaderProps) {
  return (
    <div className="bg-gradient-to-br from-accent via-[#F9E498] to-primary p-5 text-center font-bold sticky top-0 z-10 flex justify-between items-center">
      <div className="w-6">
        {onBack && (
          <ChevronLeft
            className="w-6 h-6 cursor-pointer"
            onClick={onBack}
          />
        )}
      </div>
      <span className="text-foreground uppercase">{title}</span>
      <div className="w-6 flex justify-end">{rightIcon}</div>
    </div>
  )
}
