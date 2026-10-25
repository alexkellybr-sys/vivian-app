"use client"

import { asset } from "@/lib/config"
import { useEffect } from "react"
import type { ScreenId } from "@/lib/screens"

interface SplashScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function SplashScreen({ onNavigate }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onNavigate("login")
    }, 3000)
    return () => clearTimeout(timer)
  }, [onNavigate])

  return (
    <div 
      className="flex flex-col items-center justify-center h-full px-8 cursor-pointer"
      onClick={() => onNavigate("login")}
    >
      <div className="relative w-72 h-72 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/images/vivian-splash.jpg")} alt="Mãe segurando bebê" className="absolute inset-0 w-full h-full object-contain rounded-3xl" />
      </div>
      
      <h1 className="text-4xl font-bold text-foreground tracking-wide mb-2">
        Vivian
      </h1>
      
      <p className="text-sm text-foreground/70 text-center">
        Programa para o controle Neonatal
      </p>
      
      <div className="mt-12 flex items-center gap-2 text-xs text-foreground/50">
        <span>Toque para continuar</span>
      </div>
    </div>
  )
}
