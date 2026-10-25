"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { api, cacheGet, cacheSet } from "@/lib/client"
import { DADOS_OPTIONS, NAME_FIELD, TABS, type FieldDef, type TabDef } from "@/lib/tabs"
import type { Bracelet, HistoryEntry } from "@/lib/types"
import { GoldButton } from "./gold-button"
import { GpsTab } from "./gps-tab"
import { SummaryTab } from "./summary-tab"
import { useGps } from "./gps-monitor"

type Props = {
  nfc: string
  tabId?: string
  onTabChange?: (id: string) => void
  onSaved?: (b: Bracelet) => void
}

const inputCls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"

export function BraceletScreen({ nfc, tabId, onTabChange, onSaved }: Props) {
  const [bracelet, setBracelet] = useState<Bracelet | null>(() => cacheGet<Bracelet>(`b-${nfc}`))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState(tabId || "resumo")
  const { alarms } = useGps()

  useEffect(() => setTab(tabId || "resumo"), [tabId])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const b = await api.get([nfc])
      setBracelet(b)
      cacheSet(`b-${nfc}`, b)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erro ao carregar.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setBracelet(cacheGet<Bracelet>(`b-${nfc}`))
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfc])

  const updated = (b: Bracelet) => {
    setBracelet(b)
    cacheSet(`b-${nfc}`, b)
    onSaved?.(b)
  }

  const current = TABS.find((t) => t.id === tab) || TABS[0]
  const name = bracelet?.dados[NAME_FIELD] || ""
  const inAlarm = alarms.some((a) => a.nfc === nfc)

  // saiu/voltou da cerca → a planilha gravou no histórico; recarrega para mostrar
  const firstSituation = useRef(true)
  useEffect(() => {
    if (firstSituation.current) {
      firstSituation.current = false
      return
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inAlarm])

  const choose = (id: string) => {
    setTab(id)
    onTabChange?.(id)
  }

  return (
    <div className="flex flex-col">
      <div className="bg-card mx-4 mt-4 p-4 rounded-[22px] border-2 border-primary flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-lg leading-tight">{name || "Bebê sem nome"}</h3>
          <p className="text-sm text-muted-foreground">
            Pulseira {nfc}
            {bracelet?.dados["Leito"] ? ` · Leito ${bracelet.dados["Leito"]}` : ""}
            {bracelet?.dados["Nome da mãe"] ? ` · Mãe: ${bracelet.dados["Nome da mãe"]}` : ""}
          </p>
          {inAlarm && <p className="text-sm font-bold text-red-600 mt-1">⚠️ GPS: fora da área</p>}
        </div>
        <button aria-label="Atualizar da planilha" onClick={load} disabled={loading} className="p-1">
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {loadError && <p className="mx-5 mt-2 text-xs text-red-600">{loadError}</p>}

      <div role="tablist" aria-label="Abas do paciente" className="flex gap-2 overflow-x-auto lg:flex-wrap px-4 py-3 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => choose(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase border-2 transition ${
              t.id === current.id ? "bg-gradient-to-br from-accent via-[#F9E498] to-primary border-primary" : "bg-white/70 border-primary/40"
            } ${t.id === "gps" && inAlarm ? "!bg-red-600 !text-white !border-red-600" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-6">
        {!bracelet ? (
          <p className="text-sm px-1">{loading ? "Carregando da planilha…" : "Não foi possível carregar esta pulseira."}</p>
        ) : current.kind === "resumo" ? (
          <SummaryTab bracelet={bracelet} onGo={choose} />
        ) : current.kind === "dados" ? (
          <DadosTab key={nfc} bracelet={bracelet} onSaved={updated} />
        ) : current.kind === "registro" ? (
          <RegistroTab key={`${nfc}-${current.id}`} nfc={nfc} tab={current} history={bracelet.historico} onSaved={updated} />
        ) : current.kind === "checklist" ? (
          <ChecklistTab key={`${nfc}-${current.id}`} nfc={nfc} tab={current} history={bracelet.historico} onSaved={updated} />
        ) : (
          <>
            <GpsTab nfc={nfc} imei={bracelet.dados["GPS (IMEI)"] || ""} />
            <History entries={bracelet.historico} aba="GPS" title="Histórico de alarmes" />
          </>
        )}
      </div>
    </div>
  )
}

// ───────────── Dados ─────────────
function DadosTab({ bracelet, onSaved }: { bracelet: Bracelet; onSaved: (b: Bracelet) => void }) {
  const [form, setForm] = useState<Record<string, string>>(bracelet.dados)
  const [newField, setNewField] = useState("")
  const [status, setStatus] = useState<Status>(null)
  useEffect(() => setForm(bracelet.dados), [bracelet])

  const fields = useMemo(() => Array.from(new Set([...bracelet.campos, ...Object.keys(form)])), [bracelet.campos, form])
  const changed = fields.filter((f) => (form[f] ?? "") !== (bracelet.dados[f] ?? ""))

  const save = () =>
    run(setStatus, async () => {
      const dados = Object.fromEntries(changed.map((f) => [f, form[f] ?? ""]))
      onSaved(await api.save({ nfc: bracelet.nfc, aba: "Dados", dados }))
    })

  return (
    <Card>
      {fields.map((f) => (
        <Field key={f} def={{ name: f, input: DADOS_OPTIONS[f] ? "select" : "text", options: DADOS_OPTIONS[f], inputMode: /telefone/i.test(f) ? "tel" : "text" }} value={form[f] ?? ""} onChange={(v) => setForm((c) => ({ ...c, [f]: v }))} />
      ))}
      <div className="flex gap-2 items-end mb-3">
        <label className="flex-1">
          <span className="block text-[13px] mb-1 font-bold">Novo campo</span>
          <input className={inputCls} placeholder="ex.: Tipo sanguíneo" value={newField} onChange={(e) => setNewField(e.target.value)} />
        </label>
        <button
          className="rounded-full border-2 border-primary px-4 py-3 text-sm font-bold"
          onClick={() => {
            const n = newField.trim()
            if (n && !(n in form)) setForm((c) => ({ ...c, [n]: "" }))
            setNewField("")
          }}
        >
          Adicionar
        </button>
      </div>
      <SaveButton disabled={!changed.length} status={status} onClick={save} />
    </Card>
  )
}

// ───────────── Registros (Sinais, Intercorrências, ...) ─────────────
function RegistroTab({ nfc, tab, history, onSaved }: { nfc: string; tab: Extract<TabDef, { kind: "registro" }>; history: HistoryEntry[]; onSaved: (b: Bracelet) => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>(null)
  const filled = tab.fields.filter((f) => (form[f.name] ?? "").trim())

  const save = () =>
    run(setStatus, async () => {
      onSaved(await api.save({ nfc, aba: tab.label, registros: filled.map((f) => ({ campo: f.name, valor: form[f.name].trim() })) }))
      setForm({})
    })

  return (
    <>
      <Card>
        {tab.fields.map((f) => (
          <Field key={f.name} def={f} value={form[f.name] ?? ""} onChange={(v) => setForm((c) => ({ ...c, [f.name]: v }))} />
        ))}
        <SaveButton disabled={!filled.length} status={status} onClick={save} label="REGISTRAR" />
      </Card>
      <History entries={history} aba={tab.label} />
    </>
  )
}

// ───────────── Conferência ─────────────
function ChecklistTab({ nfc, tab, history, onSaved }: { nfc: string; tab: Extract<TabDef, { kind: "checklist" }>; history: HistoryEntry[]; onSaved: (b: Bracelet) => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<Status>(null)
  const all = tab.items.every((i) => checked[i])

  const save = () =>
    run(setStatus, async () => {
      const registros = [
        ...tab.items.map((i) => ({ campo: i, valor: checked[i] ? "Sim" : "Não" })),
        { campo: "Resultado", valor: all ? "Tudo conferido ✔" : `Pendente: ${tab.items.filter((i) => !checked[i]).join(", ")}` },
      ]
      onSaved(await api.save({ nfc, aba: tab.label, registros }))
      setChecked({})
    })

  return (
    <>
      <Card>
        {tab.items.map((i) => (
          <label key={i} className="mb-3 flex items-center gap-3 text-base">
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={!!checked[i]} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
            {i}
          </label>
        ))}
        <SaveButton status={status} onClick={save} label={all ? "CONFIRMAR CONFERÊNCIA" : "REGISTRAR (COM PENDÊNCIAS)"} />
      </Card>
      <History entries={history} aba={tab.label} />
    </>
  )
}

// ───────────── peças comuns ─────────────
type Status = { ok: boolean; text: string; busy?: boolean } | null

async function run(set: (s: Status) => void, fn: () => Promise<void>) {
  set({ ok: true, text: "Salvando na planilha…", busy: true })
  try {
    await fn()
    set({ ok: true, text: "Salvo na planilha ✔" })
  } catch (e) {
    set({ ok: false, text: e instanceof Error ? e.message : "Não foi possível salvar." })
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-card p-4 rounded-[22px] border-2 border-primary">{children}</div>
}

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block mb-3">
      <span className="block text-[13px] mb-1 font-bold">{def.name}</span>
      {def.input === "textarea" ? (
        <textarea rows={3} className={inputCls} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : def.input === "select" ? (
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {def.options?.map((o) => <option key={o}>{o}</option>)}
          {value && !def.options?.includes(value) && <option>{value}</option>}
        </select>
      ) : (
        <input className={inputCls} value={value} inputMode={def.inputMode} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function SaveButton({ status, onClick, disabled, label = "SALVAR" }: { status: Status; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <>
      <GoldButton onClick={onClick} disabled={disabled || status?.busy} className={disabled ? "opacity-50" : ""}>
        {status?.busy ? "SALVANDO..." : label}
      </GoldButton>
      {status && !status.busy && <p role="status" className={`text-xs mt-2 ${status.ok ? "text-green-700" : "text-red-600"}`}>{status.text}</p>}
    </>
  )
}

function History({ entries, aba, title = "Histórico" }: { entries: HistoryEntry[]; aba: string; title?: string }) {
  const groups: { data: string; usuario: string; items: HistoryEntry[] }[] = []
  for (const e of entries.filter((x) => x.aba === aba)) {
    const last = groups[groups.length - 1]
    if (last && last.data === e.data && last.usuario === e.usuario) last.items.push(e)
    else groups.push({ data: e.data, usuario: e.usuario, items: [e] })
  }
  return (
    <div className="mt-4">
      <h4 className="font-bold text-sm uppercase mb-2 px-1">{title}</h4>
      {groups.length === 0 && <p className="text-sm px-1 text-muted-foreground">Nenhum registro ainda.</p>}
      {groups.slice(0, 50).map((g, i) => (
        <div key={i} className="bg-white rounded-[15px] p-3 mb-2 border-l-[5px] border-l-primary">
          <p className="text-xs text-muted-foreground mb-1">
            {g.data}
            {g.usuario ? ` · ${g.usuario}` : ""}
          </p>
          {g.items
            .slice()
            .reverse()
            .map((e, j) => (
              <p key={j} className="text-sm">
                <b>{e.campo}:</b> {e.valor}
              </p>
            ))}
        </div>
      ))}
    </div>
  )
}
