"use client"

import { cn } from "@/lib/utils"
import type { ReactNode, ButtonHTMLAttributes } from "react"

interface GoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
}

export function GoldButton({ children, className, ...props }: GoldButtonProps) {
  return (
    <button
      className={cn(
        "bg-gradient-to-br from-accent via-[#F9E498] to-primary border-none py-4 px-6 rounded-[25px] text-foreground font-bold cursor-pointer w-full mt-3 shadow-md uppercase flex items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
