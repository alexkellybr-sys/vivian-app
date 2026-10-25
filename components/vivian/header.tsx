"use client"

import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { asset } from "@/lib/config"

interface HeaderProps {
  title: string
  onBack?: () => void
  rightIcon?: ReactNode
}

export function Header({ title, onBack, rightIcon }: HeaderProps) {
  return (
    <div className="bg-gradient-to-br from-accent via-[#F9E498] to-primary px-5 py-3 text-center font-bold sticky top-0 z-10 flex justify-between items-center">
      <div className="w-10 flex items-center">
        {onBack ? (
          <button aria-label="Voltar" onClick={onBack}>
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset("/images/vivian-splash.jpg")} alt="Vívian" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" />
        )}
      </div>
      <span className="text-foreground uppercase">{title}</span>
      <div className="w-10 flex justify-end">{rightIcon}</div>
    </div>
  )
}
