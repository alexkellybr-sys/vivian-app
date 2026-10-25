"use client"

import { useEffect, useState } from "react"
import { Nfc, Siren, Users, X } from "lucide-react"
import { getNurse } from "@/lib/client"
import { turnoOf } from "@/lib/summary"
import { useNfcOpen } from "./bracelets-screen"
import { useGps } from "./gps-monitor"

// Tela inicial do celular: só a leitura da pulseira. A lista de bebês fica no botão "Pacientes".
export function HomeScreen({ onOpen, onNotFound, onPatients }: { onOpen: (nfc: string) => void; onNotFound: (nfc: string) => void; onPatients: () => void }) {
  const nfc = useNfcOpen(onOpen, onNotFound)
  const { alarms, onOpenBracelet } = useGps()
  const [webNfc, setWebNfc] = useState(true)
  useEffect(() => setWebNfc("NDEFReader" in window), [])

  return (
    <div className="px-5 pt-5 pb-6 flex flex-col items-center text-center">
      <p className="text-sm text-muted-foreground">
        {getNurse() ? `${getNurse()} · ` : ""}turno da {turnoOf(new Date()).toLowerCase()}
      </p>

      {alarms.length > 0 && (
        <button onClick={() => onOpenBracelet?.(alarms[0].nfc)} className="mt-3 w-full rounded-[15px] bg-red-600 text-white font-bold p-3 flex items-center justify-center gap-2">
          <Siren className="w-5 h-5" /> {alarms.length} pulseira(s) fora da área
        </button>
      )}

      <button
        onClick={nfc.read}
        aria-label="Ler pulseira"
        className={`mt-8 w-56 h-56 rounded-full bg-gradient-to-br from-accent via-[#F9E498] to-primary shadow-[0_12px_30px_rgba(184,134,11,0.45)] flex flex-col items-center justify-center gap-2 border-4 border-white active:scale-95 transition ${nfc.reading ? "animate-pulse" : ""}`}
      >
        <Nfc className="w-16 h-16" />
        <span className="font-bold text-lg uppercase leading-tight whitespace-pre-line">{nfc.reading ? "Aproxime a\npulseira" : "Ler\npulseira"}</span>
      </button>

      <p className="mt-5 text-sm max-w-[300px]">
        {webNfc
          ? "Toque no botão e encoste a pulseira na parte de trás do celular. O bebê abre direto."
          : "No iPhone: com o app fechado, encoste o celular na pulseira e toque na notificação. O bebê abre direto."}
      </p>

      {nfc.status && (
        <div role="status" className="mt-4 w-full flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-left">
          <span className="flex-1">{nfc.status}</span>
          <button type="button" aria-label="Fechar mensagem" onClick={() => nfc.setStatus(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <button onClick={onPatients} className="mt-8 w-full rounded-[25px] border-2 border-primary bg-white/70 py-4 font-bold uppercase flex items-center justify-center gap-2">
        <Users className="w-5 h-5" /> Pacientes
      </button>
    </div>
  )
}
