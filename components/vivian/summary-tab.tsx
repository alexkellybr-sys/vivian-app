"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Pill, Stethoscope, Thermometer } from "lucide-react"
import { buildSummary, fmtDate, type Registro } from "@/lib/summary"
import type { Bracelet } from "@/lib/types"
import { useGps } from "./gps-monitor"

const ABA_COLOR: Record<string, string> = {
  "Sinais vitais": "border-l-sky-500",
  Intercorrências: "border-l-red-500",
  Medicações: "border-l-violet-500",
  Alergias: "border-l-orange-500",
  Diagnóstico: "border-l-amber-600",
  Anamnese: "border-l-slate-500",
  Conferência: "border-l-green-600",
  Dados: "border-l-primary",
  GPS: "border-l-red-700",
}

const num = (v: string) => Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""))

export function SummaryTab({ bracelet, onGo }: { bracelet: Bracelet; onGo: (tabId: string) => void }) {
  const s = useMemo(() => buildSummary(bracelet), [bracelet])
  const { state } = useGps()
  const pos = state?.posicoes.find((p) => p.nfc === bracelet.nfc)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const d = bracelet.dados

  return (
    <div className="space-y-3">
      {/* identificação */}
      <div className="bg-card rounded-[18px] border-2 border-primary p-4 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {s.dayOfStay && <span className="font-bold">📅 Dia {s.dayOfStay} de internação</span>}
          {d["Data de nascimento"] && <span>Nasceu: {d["Data de nascimento"]}</span>}
          {d["Sexo"] && <span>{d["Sexo"]}</span>}
          {d["Leito"] && <span>Leito {d["Leito"]}</span>}
          {d["Nome da mãe"] && <span>Mãe: {d["Nome da mãe"]}</span>}
          {d["Telefone de emergência"] && <span>☎ {d["Telefone de emergência"]}</span>}
        </div>
        {pos && (
          <p className={`mt-2 font-bold ${pos.situacao === "FORA" ? "text-red-600" : "text-green-700"}`}>
            GPS: {pos.situacao === "FORA" ? `FORA DA ÁREA – setor ${pos.setor}, ${pos.distancia} m` : pos.situacao === "dentro" ? "dentro da área" : pos.situacao}
          </p>
        )}
      </div>

      {/* alergias sempre bem visíveis */}
      <Block title="Alergias" icon={<AlertTriangle className="w-4 h-4" />} tone={s.allergies.length ? "warn" : undefined} onAdd={() => onGo("alergias")}>
        {s.allergies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alergia registrada.</p>
        ) : (
          s.allergies.map((r, i) => <Line key={i} r={r} />)
        )}
      </Block>

      <Block title="Sinais vitais (últimos)" icon={<Thermometer className="w-4 h-4" />} onAdd={() => onGo("sinais")}>
        {s.vitals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sinal vital registrado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {s.vitals.map((v) => {
              const now = num(v.last!.valor)
              const before = v.previous ? num(v.previous.valor) : NaN
              const alert = (v.short === "Temp" && (now >= 37.8 || now < 36)) || (v.short === "Sat" && now < 92)
              return (
                <div key={v.short} className={`rounded-[12px] p-2 ${alert ? "bg-red-50 border border-red-400" : "bg-white"}`}>
                  <p className="text-[11px] text-muted-foreground">{v.short}</p>
                  <p className={`font-bold text-lg leading-tight ${alert ? "text-red-700" : ""}`}>
                    {v.last!.valor} <span className="text-xs font-normal">{v.unit}</span>
                    {Number.isFinite(before) && now !== before && (now > before ? <ArrowUp className="inline w-3 h-3" /> : <ArrowDown className="inline w-3 h-3" />)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(v.last!.date)}{v.previous ? ` · antes ${v.previous.valor}` : ""}</p>
                </div>
              )
            })}
          </div>
        )}
        {s.lastObs && <p className="text-xs mt-2">📝 {s.lastObs.items.find((i) => i.campo === "Observação")?.valor} <span className="text-muted-foreground">({s.lastObs.time}, {s.lastObs.usuario})</span></p>}
      </Block>

      <Block title="Diagnóstico" icon={<Stethoscope className="w-4 h-4" />} onAdd={() => onGo("diagnostico")}>
        {s.diagnosis ? <Line r={s.diagnosis} /> : <p className="text-sm text-muted-foreground">Sem diagnóstico registrado.</p>}
      </Block>

      <Block title="Medicações nas últimas 24 h" icon={<Pill className="w-4 h-4" />} onAdd={() => onGo("medicacoes")}>
        {s.meds.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nas últimas 24 h.</p> : s.meds.map((r, i) => <Line key={i} r={r} />)}
      </Block>

      <Block title="Intercorrências (últimos 3 dias)" icon={<AlertTriangle className="w-4 h-4" />} tone={s.incidents.some((r) => r.items.some((i) => i.valor === "Grave")) ? "danger" : undefined} onAdd={() => onGo("intercorrencias")}>
        {s.incidents.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma intercorrência recente. ✔</p> : s.incidents.map((r, i) => <Line key={i} r={r} />)}
      </Block>

      {s.conference && (
        <p className="text-xs px-1">
          ✅ Última conferência: {s.conference.items.find((i) => i.campo === "Resultado")?.valor || "registrada"} ({s.conference.time}, {s.conference.usuario})
        </p>
      )}

      {/* dia a dia */}
      <div>
        <h4 className="font-bold text-sm uppercase mt-4 mb-2 px-1">Registro dia a dia</h4>
        {s.days.length === 0 && <p className="text-sm px-1 text-muted-foreground">Nenhum registro ainda.</p>}
        {s.days.map((day, idx) => {
          const isOpen = open[day.key] ?? idx === 0
          const hasIncident = day.records.some((r) => r.aba === "Intercorrências" || r.aba === "GPS")
          return (
            <div key={day.key} className="bg-white rounded-[15px] mb-2 overflow-hidden">
              <button className="w-full text-left p-3 flex items-start justify-between gap-2" onClick={() => setOpen((o) => ({ ...o, [day.key]: !isOpen }))} aria-expanded={isOpen}>
                <span>
                  <b>{day.number ? `Dia ${day.number}` : "Dia"} · {day.label}</b>
                  {hasIncident && <span className="ml-2 text-[11px] font-bold text-white bg-red-600 rounded-full px-2">intercorrência</span>}
                  <span className="block text-xs text-muted-foreground">
                    {day.turnos.map((t) => `${t.turno}: ${t.nurses.join(", ")}`).join(" · ") || "—"} · {day.records.length} registro(s)
                  </span>
                </span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {day.records
                    .slice()
                    .reverse()
                    .map((r, i) => (
                      <div key={i} className={`border-l-[4px] pl-2 ${ABA_COLOR[r.aba] || "border-l-primary"}`}>
                        <p className="text-[11px] text-muted-foreground">
                          {r.time} · <b>{r.aba}</b>{r.usuario ? ` · ${r.usuario}` : ""}
                        </p>
                        <p className="text-sm">{r.items.map((it) => `${it.campo}: ${it.valor}`).join(" · ")}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Block({ title, icon, children, tone, onAdd }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "warn" | "danger"; onAdd?: () => void }) {
  const border = tone === "danger" ? "border-red-500 bg-red-50" : tone === "warn" ? "border-orange-400 bg-orange-50" : "border-primary bg-card"
  return (
    <section className={`rounded-[18px] border-2 p-4 ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-sm uppercase flex items-center gap-1.5">{icon}{title}</h4>
        {onAdd && <button className="text-xs font-bold underline" onClick={onAdd}>+ registrar</button>}
      </div>
      {children}
    </section>
  )
}

function Line({ r }: { r: Registro & { date?: Date } }) {
  const grave = r.items.some((i) => i.valor === "Grave")
  return (
    <p className={`text-sm mb-1 ${grave ? "text-red-700 font-bold" : ""}`}>
      {r.items.map((i) => i.valor).join(" · ")}{" "}
      <span className="text-[11px] text-muted-foreground font-normal">
        ({r.date ? fmtDate(r.date) : r.time}, {r.usuario || "—"})
      </span>
    </p>
  )
}
