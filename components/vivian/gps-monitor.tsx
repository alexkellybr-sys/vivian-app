"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { BellOff, MapPin, Siren } from "lucide-react"
import { api } from "@/lib/client"
import type { GpsState, Position } from "@/lib/types"

type Trend = "afastando" | "aproximando" | "parado" | ""
type Ctx = {
  state: GpsState | null
  error: string | null
  rastreador: boolean
  refresh: () => Promise<void>
  alarms: Position[]
  trend: Record<string, Trend>
  silence: (nfc: string) => void
  soundReady: boolean
  enableSound: () => void
  onOpenBracelet?: (nfc: string) => void
}

const GpsContext = createContext<Ctx | null>(null)
export const useGps = () => {
  const ctx = useContext(GpsContext)
  if (!ctx) throw new Error("useGps fora do GpsProvider")
  return ctx
}

const POLL_MS = 10000

// sirene simples com WebAudio (precisa de um toque do usuário antes para o navegador liberar o som)
class SirenSound {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return false
      this.ctx = new AC()
    }
    void this.ctx.resume()
    return true
  }
  get ready() {
    return !!this.ctx && this.ctx.state === "running"
  }
  start() {
    if (!this.ctx || this.osc) return
    const gain = this.ctx.createGain()
    gain.gain.value = 0.25
    gain.connect(this.ctx.destination)
    this.osc = this.ctx.createOscillator()
    this.osc.type = "square"
    this.osc.connect(gain)
    this.osc.start()
    let high = false
    this.timer = setInterval(() => {
      high = !high
      this.osc?.frequency.setValueAtTime(high ? 1150 : 750, this.ctx!.currentTime)
    }, 450)
  }
  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    try {
      this.osc?.stop()
    } catch {}
    this.osc = null
  }
}

export function GpsProvider({ children, enabled, onOpenBracelet }: { children: ReactNode; enabled: boolean; onOpenBracelet?: (nfc: string) => void }) {
  const [state, setState] = useState<GpsState | null>(null)
  const [rastreador, setRastreador] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [silenced, setSilenced] = useState<Record<string, boolean>>({})
  const [trend, setTrend] = useState<Record<string, Trend>>({})
  const [soundReady, setSoundReady] = useState(false)
  const siren = useRef<SirenSound | null>(null)
  const lastDistance = useRef<Record<string, number>>({})

  const refresh = useCallback(async () => {
    try {
      const data = await api.gps()
      setState({ cercas: data.cercas, posicoes: data.posicoes, pulseiras: data.pulseiras })
      setRastreador(data.rastreador)
      setError(null)
      const t: Record<string, Trend> = {}
      for (const p of data.posicoes) {
        const before = lastDistance.current[p.nfc]
        t[p.nfc] = before === undefined || p.situacao !== "FORA" ? "" : p.distancia > before + 3 ? "afastando" : p.distancia < before - 3 ? "aproximando" : "parado"
        lastDistance.current[p.nfc] = p.distancia
      }
      setTrend(t)
      // voltou para dentro → tira o "silenciar" para o próximo alarme tocar de novo
      setSilenced((current) => {
        const next = { ...current }
        for (const p of data.posicoes) if (p.situacao !== "FORA") delete next[p.nfc]
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no GPS.")
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, refresh])

  // libera o som no primeiro toque em qualquer lugar
  useEffect(() => {
    siren.current = new SirenSound()
    const unlock = () => {
      if (siren.current?.unlock()) setTimeout(() => setSoundReady(!!siren.current?.ready), 50)
    }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
      siren.current?.stop()
    }
  }, [])

  const alarms = (state?.posicoes || []).filter((p) => p.situacao === "FORA")
  const ringing = alarms.filter((p) => !silenced[p.nfc])

  useEffect(() => {
    if (ringing.length) {
      siren.current?.start()
      if ("vibrate" in navigator) navigator.vibrate?.([600, 300, 600, 300, 600])
    } else siren.current?.stop()
  }, [ringing.length])

  const silence = (nfc: string) => setSilenced((c) => ({ ...c, [nfc]: true }))
  const enableSound = () => {
    if (siren.current?.unlock()) setTimeout(() => setSoundReady(!!siren.current?.ready), 50)
  }

  const nameOf = (nfc: string) => state?.pulseiras.find((p) => p.nfc === nfc)?.bebe || ""

  return (
    <GpsContext.Provider value={{ state, error, rastreador, refresh, alarms, trend, silence, soundReady, enableSound, onOpenBracelet }}>
      {children}
      {ringing.length > 0 && (
        <div role="alertdialog" aria-label="Alarme de GPS" className="fixed inset-x-0 top-0 lg:inset-x-auto lg:top-auto lg:bottom-0 lg:right-0 z-[100] p-3 flex justify-center pointer-events-none">
          <div className="w-full max-w-[640px] lg:w-[440px] space-y-2 pointer-events-auto max-h-[70dvh] overflow-y-auto">
            {ringing.map((p) => (
              <div key={p.nfc} className="rounded-[18px] bg-red-600 text-white p-4 shadow-[0_0_0_6px_rgba(220,38,38,0.35),0_20px_40px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Siren className="w-6 h-6 shrink-0 animate-pulse" /> PULSEIRA {p.nfc} FORA DA ÁREA
                </div>
                <p className="mt-1 text-sm leading-snug">
                  {nameOf(p.nfc) && <b>{nameOf(p.nfc)} · </b>}
                  Setor: <b>{p.setor || "—"}</b> · {p.distancia} m da cerca
                  {trend[p.nfc] && trend[p.nfc] !== "parado" && <> · <b>{trend[p.nfc]}</b></>}
                </p>
                {ringing.length === 1 && <p className="text-xs opacity-90 mt-1">Última posição {p.data} · fonte: {p.fonte || "—"}</p>}
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 rounded-full bg-white text-red-700 font-bold py-2 text-sm flex items-center justify-center gap-1" onClick={() => onOpenBracelet?.(p.nfc)}>
                    <MapPin className="w-4 h-4" /> Ver no mapa
                  </button>
                  <button className="flex-1 rounded-full border-2 border-white font-bold py-2 text-sm flex items-center justify-center gap-1" onClick={() => silence(p.nfc)}>
                    <BellOff className="w-4 h-4" /> Silenciar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </GpsContext.Provider>
  )
}
