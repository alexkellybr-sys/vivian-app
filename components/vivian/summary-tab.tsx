"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Heart, Pill, Stethoscope, Syringe, Thermometer } from "lucide-react"
import { buildSummary, fmtDate, type Registro } from "@/lib/summary"
import type { Bracelet } from "@/lib/types"
import { useGps } from "./gps-monitor"
import { doses } from "@/lib/vacinas"
import { ANAMNESE_FIELDS, BIRTH_FIELD, HIDDEN_IN_DADOS } from "@/lib/tabs"

const ABA_COLOR: Record<string, string> = {
  "Sinais vitais": "border-l-sky-500",
  Intercorrências: "border-l-red-500",
  Medicações: "border-l-violet-500",
  Vacinas: "border-l-sky-600",
  "Teste do coraçãozinho": "border-l-red-500",
  Diagnóstico: "border-l-amber-600",
  Anamnese: "border-l-slate-500",
  Conferência: "border-l-green-600",
  Dados: "border-l-primary",
  GPS: "border-l-red-700",
}

const num = (v: string) => Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""))

const VERSION = process.env.NEXT_PUBLIC_VERSION || "dev"

export function SummaryTab({ bracelet, onGo }: { bracelet: Bracelet; onGo: (tabId: string) => void }) {
  const s = useMemo(() => buildSummary(bracelet), [bracelet])
  const { state } = useGps()
  const pos = state?.posicoes.find((p) => p.nfc === bracelet.nfc)
  const anam = [BIRTH_FIELD, ...ANAMNESE_FIELDS.map((f) => f.name)].filter((k) => bracelet.dados[k]).map((k) => [k, bracelet.dados[k]] as const)
  // anamnese antiga (texto livre, antes da ficha)
  const oldAnam = s.anamnese.filter((r) => r.items.some((i) => i.campo === "Anamnese"))
  const vacItems = (state?.agenda || []).filter((a) => a.nfc === bracelet.nfc && a.situacao !== "Concluída")
  const vacDue = vacItems.filter((a) => doses(a).some((d) => !d.aplicada && d.date.getTime() <= Date.now()))
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const d = bracelet.dados

  return (
    <div className="space-y-3">
      {d["Alta"] && (
        <div className="rounded-[18px] border-2 border-green-700 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-800">🏠 ALTA em {d["Alta"]}{d["Especialista da alta"] ? ` · ${d["Especialista da alta"]}` : ""}</p>
          {d["Observações da alta"] && <p className="mt-1">📝 {d["Observações da alta"]}</p>}
        </div>
      )}
      {/* identificação */}
      <div className="bg-card rounded-[18px] border-2 border-primary p-4 text-sm">
        {s.dayOfStay && <p className="font-bold mb-2">📅 Dia {s.dayOfStay} de internação</p>}
        {/* todos os dados preenchidos na aba Dados (inclusive campos novos criados no PC) */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {Object.entries(d)
            .filter(([k, v]) => v && k !== "Nome do bebê" && !HIDDEN_IN_DADOS.includes(k))
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold break-words">{v}</dd>
              </div>
            ))}
        </dl>
        {Object.entries(d).filter(([k, v]) => v && k !== "Nome do bebê" && !HIDDEN_IN_DADOS.includes(k)).length === 0 && (
          <p className="text-muted-foreground">Nenhum dado preenchido. <button className="underline" onClick={() => onGo("dados")}>Preencher</button></p>
        )}
        {pos && (
          <p className={`mt-2 font-bold ${pos.situacao === "FORA" ? "text-red-600" : "text-green-700"}`}>
            GPS: {pos.situacao === "FORA" ? `FORA DA ÁREA – setor ${pos.setor}, ${pos.distancia} m` : pos.situacao === "dentro" ? "dentro da área" : pos.situacao}
          </p>
        )}
      </div>

      {/* teste do coraçãozinho (coração vermelho) */}
      <Coracao r={s.coracao} onAdd={() => onGo("coracao")} />

      <Block title="Vacinas" icon={<Syringe className="w-4 h-4" />} tone={vacDue.length ? "warn" : undefined} onAdd={() => onGo("vacinas")}>
        {vacItems.length === 0 && s.vacinas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma vacina registrada.</p>}
        {vacItems.map((a) => {
          const next = doses(a).find((d) => !d.aplicada)
          const late = next && next.date.getTime() <= Date.now()
          return (
            <p key={a.id} className={`text-sm mb-1 ${late ? "text-red-700 font-bold" : ""}`}>
              {a.vacina} — {next ? `${late ? "na hora/atrasada" : "próxima"}: ${next.dia.slice(0, 5)} ${next.hora}` : "concluída ✔"}
              {next && next.total > 1 && <span className="text-[11px] text-muted-foreground font-normal"> (dose {next.n} de {next.total} · a cada {a.intervalo} h)</span>}
            </p>
          )
        })}
        {s.vacinas
          .flatMap((r) => r.items.filter((i) => i.campo === "Aplicada").map((i) => ({ ...r, items: [i] })))
          .slice(0, 4)
          .map((r, i) => (
            <p key={i} className="text-sm mb-1 text-green-800">
              ✔ {r.items[0].valor} <span className="text-[11px] text-muted-foreground">({r.usuario || "—"})</span>
            </p>
          ))}
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
                  {v.first && v.first !== v.previous && <p className="text-[10px] text-muted-foreground">inicial {v.first.valor} ({fmtDate(v.first.date)})</p>}
                </div>
              )
            })}
          </div>
        )}
        {s.lastObs && <p className="text-xs mt-2">📝 {s.lastObs.items.find((i) => i.campo === "Observação")?.valor} <span className="text-muted-foreground">({s.lastObs.time}, {s.lastObs.usuario})</span></p>}
      </Block>

      <Block title="Anamnese" icon={<Stethoscope className="w-4 h-4" />} onAdd={() => onGo("anamnese")}>
        {anam.length === 0 && oldAnam.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem anamnese registrada.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {anam.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k === BIRTH_FIELD ? "Nascimento" : k}</dt>
                <dd className="font-semibold break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {oldAnam.slice(0, 2).map((r, i) => <Line key={i} r={r} />)}
      </Block>

      <Block title="Diagnóstico" icon={<Stethoscope className="w-4 h-4" />} onAdd={() => onGo("diagnostico")}>
        {s.diagnosis ? <Line r={s.diagnosis} /> : <p className="text-sm text-muted-foreground">Sem diagnóstico registrado.</p>}
      </Block>

      <Block title="Medicações" icon={<Pill className="w-4 h-4" />} onAdd={() => onGo("medicacoes")}>
        {s.allMeds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma medicação registrada.</p>
        ) : (
          <>
            {s.meds.length === 0 && <p className="text-xs text-muted-foreground mb-1">Nenhuma nas últimas 24 h. Últimas registradas:</p>}
            {(s.meds.length ? s.meds : s.allMeds.slice(0, 3)).map((r, i) => <Line key={i} r={r} />)}
            {s.allMeds.length > Math.max(s.meds.length, 3) && <p className="text-[11px] text-muted-foreground">+ {s.allMeds.length - Math.max(s.meds.length, 3)} anteriores no registro dia a dia</p>}
          </>
        )}
      </Block>

      <Block title="Intercorrências" icon={<AlertTriangle className="w-4 h-4" />} tone={s.incidents.some((r) => r.items.some((i) => i.valor === "Grave")) ? "danger" : s.incidents.length ? "warn" : undefined} onAdd={() => onGo("intercorrencias")}>
        {s.allIncidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma intercorrência registrada. ✔</p>
        ) : (
          <>
            {s.incidents.length === 0 && <p className="text-xs text-muted-foreground mb-1">Nenhuma nos últimos 3 dias. Última:</p>}
            {(s.incidents.length ? s.incidents : s.allIncidents.slice(0, 1)).map((r, i) => <Line key={i} r={r} />)}
          </>
        )}
      </Block>

      <Block title="Conferência" icon={<Stethoscope className="w-4 h-4" />} onAdd={() => onGo("conferencia")}>
        {s.conference ? (
          <p className="text-sm">
            {s.conference.items.find((i) => i.campo === "Resultado")?.valor || "Registrada"}{" "}
            <span className="text-[11px] text-muted-foreground">({fmtDate((s.conference as Registro & { date: Date }).date)}, {s.conference.usuario})</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma conferência registrada.</p>
        )}
      </Block>

      {s.others.map((r, i) => (
        <Block key={i} title={r.aba} icon={<Stethoscope className="w-4 h-4" />}>
          <Line r={r} />
        </Block>
      ))}

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
      <p className="text-[10px] text-center text-muted-foreground pt-2">Vivian · versão {VERSION}</p>
    </div>
  )
}

function Coracao({ r, onAdd }: { r?: Registro & { date?: Date }; onAdd: () => void }) {
  const v = (campo: string) => r?.items.find((i) => i.campo === campo)?.valor || ""
  const mao = num(v("SatO2 mão direita (%)"))
  const pe = num(v("SatO2 pé (%)"))
  const res = v("Resultado")
  const tone = /alterado/i.test(res) ? "danger" : /repetir/i.test(res) ? "warn" : undefined
  return (
    <Block title="Teste do coraçãozinho" icon={<Heart className="w-4 h-4 fill-red-600 text-red-600" />} tone={tone} onAdd={onAdd}>
      {!r ? (
        <p className="text-sm text-muted-foreground">Ainda não foi feito.</p>
      ) : (
        <>
          <p className={`text-sm font-bold ${tone === "danger" ? "text-red-700" : tone === "warn" ? "text-orange-700" : "text-green-700"}`}>
            <Heart className="inline w-4 h-4 mr-1 -mt-0.5 fill-red-600 text-red-600" />
            {res || "Registrado"}
          </p>
          <p className="text-sm">
            {v("SatO2 mão direita (%)") && <>Mão direita {v("SatO2 mão direita (%)")}% · </>}
            {v("SatO2 pé (%)") && <>Pé {v("SatO2 pé (%)")}% · </>}
            {Number.isFinite(mao) && Number.isFinite(pe) && v("SatO2 mão direita (%)") && v("SatO2 pé (%)") && <>diferença {Math.abs(mao - pe)}% · </>}
            {v("Horas de vida") && <>{v("Horas de vida")} h de vida</>}
          </p>
          {v("Observação") && <p className="text-xs mt-1">📝 {v("Observação")}</p>}
          <p className="text-[11px] text-muted-foreground">{r.date ? fmtDate(r.date) : r.time} · {r.usuario || "—"}{v("Modo") ? ` · resultado ${v("Modo").toLowerCase()}` : ""}</p>
        </>
      )}
    </Block>
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
