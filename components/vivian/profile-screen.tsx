"use client"

import { useState } from "react"
import { LogOut, Monitor, Volume2 } from "lucide-react"
import { getNurse, setNurse } from "@/lib/client"
import { GoldButton } from "./gold-button"
import { useGps } from "./gps-monitor"

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [name, setName] = useState(() => getNurse())
  const [saved, setSaved] = useState(false)
  const { soundReady, enableSound } = useGps()
  const painel = typeof window !== "undefined" ? `${window.location.origin}/painel` : "/painel"

  return (
    <div className="px-4 pt-4 pb-6 space-y-3">
      <div className="bg-card p-4 rounded-[22px] border-2 border-primary">
        <label className="block mb-2">
          <span className="block text-[13px] mb-1 font-bold">Meu nome (vai no histórico da planilha)</span>
          <input className="w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
        </label>
        <GoldButton onClick={() => { setNurse(name || "Enfermagem"); setSaved(true) }}>Salvar</GoldButton>
        {saved && <p role="status" className="text-xs mt-2 text-green-700">Salvo neste aparelho ✔</p>}
      </div>

      <button onClick={enableSound} className="w-full bg-white rounded-[15px] border-2 border-primary p-3 text-sm font-bold flex items-center justify-center gap-2">
        <Volume2 className="w-4 h-4" /> {soundReady ? "Som do alarme ativado ✔" : "Ativar som do alarme"}
      </button>

      <div className="bg-white rounded-[15px] border-2 border-primary p-3 text-sm">
        <p className="font-bold flex items-center gap-2"><Monitor className="w-4 h-4" /> Painel para computador</p>
        <p className="text-xs mt-1 break-all">Abra no PC: <a className="underline" href="/painel">{painel}</a></p>
      </div>

      <button onClick={onLogout} className="w-full rounded-[15px] border-2 border-red-500 text-red-600 p-3 text-sm font-bold flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Sair
      </button>
    </div>
  )
}
