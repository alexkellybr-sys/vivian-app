"use client"

import { Volume2 } from "lucide-react"
import { useGps } from "./gps-monitor"

export function AlertsScreen({ onOpen }: { onOpen: (nfc: string) => void }) {
  const { alarms, state, error, soundReady, enableSound, trend } = useGps()
  const name = (nfc: string) => state?.pulseiras.find((p) => p.nfc === nfc)?.bebe || ""
  const ok = (state?.posicoes || []).filter((p) => p.situacao !== "FORA")

  return (
    <div className="px-4 pt-3 pb-6">
      {!soundReady && (
        <button onClick={enableSound} className="w-full mb-3 rounded-[15px] bg-white border-2 border-primary p-3 text-sm font-bold flex items-center justify-center gap-2">
          <Volume2 className="w-4 h-4" /> Ativar som do alarme neste aparelho
        </button>
      )}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <h4 className="font-bold text-sm uppercase mb-2 px-1">Alarmes ativos</h4>
      {alarms.length === 0 && <p className="text-sm px-1 mb-3">Nenhuma pulseira fora da área. ✔</p>}
      {alarms.map((a) => (
        <button key={a.nfc} onClick={() => onOpen(a.nfc)} className="w-full text-left bg-white mb-2 p-4 rounded-[15px] border-l-[8px] border-l-red-600">
          <b className="block text-red-700">⚠️ PULSEIRA {a.nfc} FORA DA ÁREA {name(a.nfc) && `· ${name(a.nfc)}`}</b>
          <span className="text-sm">
            Setor {a.setor} · {a.distancia} m da cerca {trend[a.nfc] && trend[a.nfc] !== "parado" ? `· ${trend[a.nfc]}` : ""}
          </span>
          <span className="block text-xs text-muted-foreground">{a.data} · {a.fonte}</span>
        </button>
      ))}
      <h4 className="font-bold text-sm uppercase mt-4 mb-2 px-1">Pulseiras com GPS</h4>
      {ok.length === 0 && <p className="text-sm px-1">Nenhuma outra posição recebida.</p>}
      {ok.map((p) => (
        <button key={p.nfc} onClick={() => onOpen(p.nfc)} className="w-full text-left bg-white mb-2 p-3 rounded-[15px] border-l-[5px] border-l-green-600 text-sm">
          📍 <b>{p.nfc}</b> {name(p.nfc) && `· ${name(p.nfc)}`} · {p.situacao}
          {p.setor ? ` · ${p.setor}` : ""} <span className="text-xs text-muted-foreground">({p.data})</span>
        </button>
      ))}
    </div>
  )
}
