"use client"

import { useState } from "react"
import { Bell, BellOff, Check, Syringe } from "lucide-react"
import { api } from "@/lib/client"
import { VACINAS } from "@/lib/tabs"
import type { Bracelet, HistoryEntry } from "@/lib/types"
import { ddmmyyyy, doseKey, doses, doseTimes, hhmmNow, repeticao } from "@/lib/vacinas"
import { Card, History, run, SaveButton, type Status } from "./bracelet-screen"
import { useGps } from "./gps-monitor"

const inputCls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"
const OUTRA = "Outra…"
const INTERVALOS = [0, 1, 2, 3, 4, 6, 8, 12, 24, 48, 72]
const isoToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const isoToBr = (iso: string) => iso.split("-").reverse().join("/")
const short = (d: Date) => `${ddmmyyyy(d).slice(0, 5)} ${hhmmNow(d)}`

// Aba Vacinas: hora da 1ª dose, repetir a cada X horas, por Y dias → o app avisa em cada dose.
export function VacinasTab({ nfc, history, onSaved }: { nfc: string; history: HistoryEntry[]; onSaved: (b: Bracelet) => void }) {
  const { state, updateAgenda, applyDose } = useGps()
  const [vacina, setVacina] = useState(VACINAS[0])
  const [outra, setOutra] = useState("")
  const [data, setData] = useState(isoToday)
  const [horario, setHorario] = useState("")
  const [intervalo, setIntervalo] = useState(0)
  const [dias, setDias] = useState("1")
  const [alarme, setAlarme] = useState(true)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})

  const nome = vacina === OUTRA ? outra.trim() : vacina
  const items = (state?.agenda || []).filter((a) => a.nfc === nfc)
  const now = Date.now()
  const nDias = Math.max(1, Math.min(60, Number(dias) || 1))
  const preview = horario ? doseTimes(isoToBr(data), horario, nDias, intervalo) : []

  const send = (aplicadaAgora: boolean) =>
    run(setStatus, async () => {
      if (!nome) throw new Error("Escreva o nome da vacina.")
      if (!aplicadaAgora && !horario) throw new Error("Escolha o horário da 1ª dose.")
      const n = new Date()
      const r = await api.agenda({
        nfc,
        vacina: nome,
        data: aplicadaAgora ? ddmmyyyy(n) : isoToBr(data),
        horario: aplicadaAgora ? hhmmNow(n) : horario,
        intervalo: aplicadaAgora ? 0 : intervalo,
        dias: aplicadaAgora || !intervalo ? 1 : nDias,
        alarme: aplicadaAgora ? false : alarme,
        aplicadaAgora,
      })
      updateAgenda(r.agenda)
      if (r.pulseira) onSaved(r.pulseira)
      setHorario("")
      setOutra("")
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
            <span className="block text-[13px] mb-1 font-bold">Data da 1ª dose</span>
            <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Hora do alarme</span>
            <input type="time" className={inputCls} value={horario} onChange={(e) => setHorario(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Repetir a cada</span>
            <select className={inputCls} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))}>
              {INTERVALOS.map((h) => (
                <option key={h} value={h}>{h === 0 ? "Não repete (dose única)" : `${h} hora${h > 1 ? "s" : ""}`}</option>
              ))}
            </select>
          </label>
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Por quantos dias</span>
            <input className={`${inputCls} ${!intervalo ? "opacity-50" : ""}`} disabled={!intervalo} inputMode="numeric" value={intervalo ? dias : "1"} onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </label>
        </div>
        {preview.length > 0 && (
          <p className="text-xs mb-3 rounded-[12px] bg-white px-3 py-2">
            <b>{preview.length} dose{preview.length > 1 ? "s" : ""}:</b> {preview.slice(0, 6).map(short).join(" · ")}
            {preview.length > 6 && ` … última ${short(preview[preview.length - 1])}`}
          </p>
        )}
        <label className="mb-4 flex items-center gap-3 text-base">
          <input type="checkbox" className="w-5 h-5 accent-primary" checked={alarme} onChange={(e) => setAlarme(e.target.checked)} />
          Tocar alarme em cada dose
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
        {items.map((a) => {
          const all = doses(a)
          const done = all.filter((d) => d.aplicada).length
          const pending = all.filter((d) => !d.aplicada)
          const shown = showAll[a.id] ? all : [...all.filter((d) => d.aplicada).slice(-2), ...pending.slice(0, 4)]
          return (
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
                {a.situacao === "Concluída" ? "Concluída ✔ · " : ""}
                {repeticao(a)} · {done}/{all.length} aplicada{all.length > 1 ? "s" : ""} · programada por {a.por || "—"}
              </p>
              {shown.map((d) => {
                const late = !d.aplicada && d.date.getTime() <= now
                return (
                  <div key={doseKey(d)} className="flex items-center justify-between gap-2 text-sm py-0.5">
                    <span className={d.aplicada ? "text-green-700" : late ? "text-red-700 font-bold" : ""}>
                      {all.length > 1 ? `${d.n}ª · ` : ""}{d.dia.slice(0, 5)} {d.hora} — {d.aplicada ? "aplicada ✔" : late ? "na hora / atrasada" : "pendente"}
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
              {shown.length < all.length && (
                <button className="text-xs underline mt-1" onClick={() => setShowAll((c) => ({ ...c, [a.id]: true }))}>
                  ver todas as {all.length} doses
                </button>
              )}
            </div>
          )
        })}
      </div>
      <History entries={history} aba="Vacinas" />
    </>
  )
}
