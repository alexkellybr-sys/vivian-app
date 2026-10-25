"use client"

import { useEffect, useRef, useState } from "react"
import { Home, Trash2 } from "lucide-react"
import { useGps } from "./gps-monitor"

function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    ;[660, 880].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.25)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.4)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.25)
      o.stop(ctx.currentTime + i * 0.25 + 0.45)
    })
  } catch {}
}

// PC: quando um celular dá alta, aparece o aviso para arquivar e apagar os dados da pulseira
export function AltaNotices({ onOpen, current }: { onOpen: (nfc: string) => void; current?: string | null }) {
  const { state } = useGps()
  const [later, setLater] = useState<Record<string, number>>({})
  const seen = useRef<Set<string> | null>(null)
  const altas = (state?.pulseiras || []).filter((p) => p.alta)
  // o bebê que já está aberto na tela não precisa do aviso (a enfermeira já está nele)
  const visible = altas.filter((p) => !(later[p.nfc] > Date.now()) && p.nfc !== current)

  useEffect(() => {
    if (!state) return
    const keys = new Set(altas.map((p) => `${p.nfc}|${p.alta}`))
    if (seen.current && [...keys].some((k) => !seen.current!.has(k))) chime()
    seen.current = keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (!visible.length) return null
  return (
    <div role="region" aria-label="Avisos de alta" className="fixed bottom-4 right-4 z-[90] w-[400px] space-y-2 max-h-[60dvh] overflow-y-auto">
      {visible.map((p) => (
        <div key={p.nfc} className="rounded-[18px] bg-green-700 text-white p-4 shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
          <p className="font-bold flex items-center gap-2">
            <Home className="w-5 h-5" /> ALTA · {p.bebe || "Sem nome"}
          </p>
          <p className="text-sm mt-1">
            Pulseira {p.nfc}
            {p.mae ? ` · Mãe: ${p.mae}` : ""} · {p.alta}
          </p>
          <p className="text-xs opacity-90 mt-1">Arquive e apague os dados para liberar a pulseira para outro bebê.</p>
          <div className="mt-3 flex gap-2">
            <button className="flex-1 rounded-full bg-white text-green-800 font-bold py-2 text-sm flex items-center justify-center gap-1" onClick={() => onOpen(p.nfc)}>
              <Trash2 className="w-4 h-4" /> Abrir para apagar
            </button>
            <button className="rounded-full border-2 border-white font-bold py-2 px-4 text-sm" onClick={() => setLater((c) => ({ ...c, [p.nfc]: Date.now() + 30 * 60000 }))}>
              Depois
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
