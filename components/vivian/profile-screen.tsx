"use client"

import { LogOut, Monitor, Volume2 } from "lucide-react"
import { getNurse } from "@/lib/client"
import { asset } from "@/lib/config"
import { useGps } from "./gps-monitor"

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const { soundReady, enableSound } = useGps()
  const painel = typeof window !== "undefined" ? `${window.location.origin}${asset("/painel/")}` : asset("/painel/")

  return (
    <div className="px-4 pt-4 pb-6 space-y-3">
      <div className="bg-card p-4 rounded-[22px] border-2 border-primary">
        <p className="text-[13px] font-bold">Conectado como</p>
        <p className="text-lg">{getNurse() || "—"}</p>
        <p className="text-xs text-muted-foreground mt-1">Este nome vai no histórico da planilha. Usuários e PINs ficam na aba “Usuários”.</p>
      </div>

      <button onClick={enableSound} className="w-full bg-white rounded-[15px] border-2 border-primary p-3 text-sm font-bold flex items-center justify-center gap-2">
        <Volume2 className="w-4 h-4" /> {soundReady ? "Som do alarme ativado ✔" : "Ativar som do alarme"}
      </button>

      <div className="bg-white rounded-[15px] border-2 border-primary p-3 text-sm">
        <p className="font-bold flex items-center gap-2"><Monitor className="w-4 h-4" /> Painel para computador</p>
        <p className="text-xs mt-1 break-all">Abra no PC: <a className="underline" href={asset("/painel/")}>{painel}</a></p>
      </div>

      <button onClick={onLogout} className="w-full rounded-[15px] border-2 border-red-500 text-red-600 p-3 text-sm font-bold flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Sair
      </button>
    </div>
  )
}
