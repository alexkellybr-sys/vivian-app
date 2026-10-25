"use client"

import { useState } from "react"
import { Bell, BellOff, Check, Syringe } from "lucide-react"
import { api } from "@/lib/client"
import { VACINAS } from "@/lib/tabs"
import type { Bracelet, HistoryEntry } from "@/lib/types"
import { ddmmyyyy, doseKey, doses, hhmmNow } from "@/lib/vacinas"
import { Card, History, run, SaveButton, type Status } from "./bracelet-screen"
import { useGps } from "./gps-monitor"

const inputCls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"
const OUTRA = "Outra…"
const isoToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const isoToBr = (iso: string) => iso.split("-").reverse().join("/")

// Aba Vacinas: programa a vacina (nome, data, horário, por quantos dias) e o app avisa na hora marcada.
export function VacinasTab({ nfc, history, onSaved }: { nfc: string; history: HistoryEntry[]; onSaved: (b: Bracelet) => void }) {
  const { state, updateAgenda, applyDose } = useGps()
  const [vacina, setVacina] = useState(VACINAS[0])
  const [outra, setOutra] = useState("")
  const [data, setData] = useState(isoToday)
  const [horario, setHorario] = useState("")
  const [dias, setDias] = useState("1")
  const [alarme, setAlarme] = useState(true)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const nome = vacina === OUTRA ? outra.trim() : vacina
  const items = (state?.agenda || []).filter((a) => a.nfc === nfc)
  const now = Date.now()

  const send = (aplicadaAgora: boolean) =>
    run(setStatus, async () => {
      if (!nome) throw new Error("Escreva o nome da vacina.")
      if (!aplicadaAgora && !horario) throw new Error("Escolha o horário.")
      const n = new Date()
      const r = await api.agenda({
        nfc,
        vacina: nome,
        data: aplicadaAgora ? ddmmyyyy(n) : isoToBr(data),
        horario: aplicadaAgora ? hhmmNow(n) : horario,
        dias: aplicadaAgora ? 1 : Math.max(1, Math.min(60, Number(dias) || 1)),
        alarme: aplicadaAgora ? false : alarme,
        aplicadaAgora,
      })
      updateAgenda(r.agenda)
      if (r.pulseira) onSaved(r.pulseira)
      setHorario("")
      setOutra("")
      setDias("1")
    })

  const cancel = async (id: string) => {
    if (!window.confirm("Cancelar esta vacina programada?")) return
    setBusy(id)
    try {
      const r = await api.agenda({ id, cancelar: true })
      updateAgenda(r.agenda)
      if (r.pulseira) onSaved(r.pulseira)
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "Não foi possível cancelar." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Card>
        <label className="block mb-3">
          <span className="block text-[13px] mb-1 font-bold">Vacina</span>
          <select className={inputCls} value={vacina} onChange={(e) => setVacina(e.target.value)}>
            {VACINAS.map((v) => <option key={v}>{v}</option>)}
            <option>{OUTRA}</option>
          </select>
        </label>
        {vacina === OUTRA && (
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Nome da vacina</span>
            <input className={inputCls} value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="ex.: Hepatite B (2ª dose)" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Data</span>
            <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Horário</span>
            <input type="time" className={inputCls} value={horario} onChange={(e) => setHorario(e.target.value)} />
          </label>
        </div>
        <label className="block mb-3">
          <span className="block text-[13px] mb-1 font-bold">Dias (1 = dose única; 3 = uma por dia durante 3 dias)</span>
          <input className={inputCls} inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </label>
        <label className="mb-4 flex items-center gap-3 text-base">
          <input type="checkbox" className="w-5 h-5 accent-primary" checked={alarme} onChange={(e) => setAlarme(e.target.checked)} />
          Avisar com alarme na hora
        </label>
        <SaveButton status={status} onClick={() => send(false)} label="PROGRAMAR VACINA" />
        <button className="w-full mt-2 rounded-[25px] border-2 border-primary bg-white/70 py-3 text-sm font-bold" onClick={() => send(true)} disabled={status?.busy}>
          Registrar como aplicada agora
        </button>
      </Card>

      <div className="mt-4">
        <h4 className="font-bold text-sm uppercase mb-2 px-1">Vacinas programadas</h4>
        {!state && <p className="text-sm px-1 text-muted-foreground">Carregando agenda…</p>}
        {state && items.length === 0 && <p className="text-sm px-1 text-muted-foreground">Nenhuma vacina programada.</p>}
        {items.map((a) => (
          <div key={a.id} className="bg-white rounded-[15px] p-3 mb-2 border-l-[5px] border-l-sky-600">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold flex items-center gap-1.5">
                <Syringe className="w-4 h-4" /> {a.vacina}
                {a.alarme ? <Bell className="w-3.5 h-3.5 text-sky-700" aria-label="com alarme" /> : <BellOff className="w-3.5 h-3.5 text-muted-foreground" aria-label="sem alarme" />}
              </p>
              {a.situacao !== "Concluída" && (
                <button className="text-xs underline text-red-700" disabled={busy === a.id} onClick={() => cancel(a.id)}>
                  Cancelar
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-1">
              {a.situacao === "Concluída" ? "Concluída ✔" : `${a.dias > 1 ? `${a.dias} dias` : "dose única"} · às ${a.horario}`} · programada por {a.por || "—"}
            </p>
            {doses(a).map((d) => {
              const late = !d.aplicada && d.date.getTime() <= now
              return (
                <div key={doseKey(d)} className="flex items-center justify-between gap-2 text-sm py-0.5">
                  <span className={d.aplicada ? "text-green-700" : late ? "text-red-700 font-bold" : ""}>
                    {d.dia.slice(0, 5)} {a.horario} — {d.aplicada ? "aplicada ✔" : late ? "na hora / atrasada" : "pendente"}
                  </span>
                  {!d.aplicada && (
                    <button
                      className="text-xs font-bold rounded-full border-2 border-primary px-3 py-1 flex items-center gap-1"
                      disabled={busy === doseKey(d)}
                      onClick={async () => {
                        setBusy(doseKey(d))
                        await applyDose(d).catch(() => {})
                        setBusy(null)
                      }}
                    >
                      <Check className="w-3 h-3" /> {busy === doseKey(d) ? "…" : "Aplicada"}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <History entries={history} aba="Vacinas" />
    </>
  )
}
