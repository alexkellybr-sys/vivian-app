"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { BellOff, Check, MapPin, Siren, Syringe } from "lucide-react"
import { api } from "@/lib/client"
import type { AgendaItem, GpsState, Position } from "@/lib/types"
import { doseKey, dueDoses, fmtDose, type Dose } from "@/lib/vacinas"

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
  vaccineDue: Dose[]
  applyDose: (d: Dose) => Promise<void>
  updateAgenda: (a: AgendaItem[]) => void
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
      setState({ cercas: data.cercas, posicoes: data.posicoes, pulseiras: data.pulseiras, agenda: data.agenda || [] })
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

  // vacinas: confere a cada 15 s se chegou a hora de alguma dose
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])
  const [snoozed, setSnoozed] = useState<Record<string, number>>({})
  const [applying, setApplying] = useState<string | null>(null)
  const [doseError, setDoseError] = useState<string | null>(null)
  const vaccineDue = dueDoses(state?.agenda || [], Math.max(now, Date.now()))
  const vaccineRinging = vaccineDue.filter((d) => !(snoozed[doseKey(d)] > now))
  const updateAgenda = useCallback((a: AgendaItem[]) => setState((c) => (c ? { ...c, agenda: a } : c)), [])
  const snooze = (d: Dose) => setSnoozed((c) => ({ ...c, [doseKey(d)]: Date.now() + 10 * 60000 }))
  const applyDose = useCallback(
    async (d: Dose) => {
      setApplying(doseKey(d))
      setDoseError(null)
      try {
        const r = await api.agenda({ id: d.item.id, aplicar: d.key })
        setState((c) => (c ? { ...c, agenda: r.agenda } : c))
        if (r.pulseira) window.dispatchEvent(new CustomEvent("vivian-bracelet", { detail: r.pulseira }))
      } catch (e) {
        setDoseError(e instanceof Error ? e.message : "Não foi possível salvar.")
        throw e
      } finally {
        setApplying(null)
      }
    },
    [],
  )

  useEffect(() => {
    if (ringing.length || vaccineRinging.length) {
      siren.current?.start()
      if ("vibrate" in navigator) navigator.vibrate?.([600, 300, 600, 300, 600])
    } else siren.current?.stop()
  }, [ringing.length, vaccineRinging.length])

  const silence = (nfc: string) => setSilenced((c) => ({ ...c, [nfc]: true }))
  const enableSound = () => {
    if (siren.current?.unlock()) setTimeout(() => setSoundReady(!!siren.current?.ready), 50)
  }

  const nameOf = (nfc: string) => state?.pulseiras.find((p) => p.nfc === nfc)?.bebe || ""

  return (
    <GpsContext.Provider value={{ state, error, rastreador, refresh, alarms, trend, silence, soundReady, enableSound, onOpenBracelet, vaccineDue, applyDose, updateAgenda }}>
      {children}
      {vaccineRinging.length > 0 && (
        <div role="alertdialog" aria-label="Hora da vacina" className="fixed inset-x-0 bottom-0 lg:inset-x-auto lg:left-0 z-[99] p-3 flex justify-center pointer-events-none">
          <div className="w-full max-w-[640px] lg:w-[420px] space-y-2 pointer-events-auto max-h-[60dvh] overflow-y-auto">
            {vaccineRinging.map((d) => (
              <div key={doseKey(d)} className="rounded-[18px] bg-sky-700 text-white p-4 shadow-[0_0_0_6px_rgba(3,105,161,0.35),0_20px_40px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Syringe className="w-6 h-6 shrink-0 animate-pulse" /> HORA DA VACINA
                </div>
                <p className="mt-1 text-sm leading-snug">
                  <b>{d.item.vacina}</b> · {d.item.bebe ? <b>{d.item.bebe} · </b> : null}pulseira {d.item.nfc} · {fmtDose(d)}
                  {d.total > 1 && <> · dose {d.n} de {d.total}</>}
                </p>
                {doseError && <p className="text-xs mt-1 bg-white/20 rounded px-2 py-1">{doseError}</p>}
                <div className="mt-3 flex gap-2">
                  <button disabled={applying === doseKey(d)} className="flex-1 rounded-full bg-white text-sky-800 font-bold py-2 text-sm flex items-center justify-center gap-1" onClick={() => applyDose(d).catch(() => {})}>
                    <Check className="w-4 h-4" /> {applying === doseKey(d) ? "Salvando…" : "Aplicada"}
                  </button>
                  <button className="flex-1 rounded-full border-2 border-white font-bold py-2 text-sm" onClick={() => onOpenBracelet?.(d.item.nfc)}>
                    Abrir bebê
                  </button>
                  <button className="flex-1 rounded-full border-2 border-white font-bold py-2 text-sm flex items-center justify-center gap-1" onClick={() => snooze(d)}>
                    <BellOff className="w-4 h-4" /> 10 min
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
