"use client"

import { useEffect, useMemo, useState } from "react"
import { api, getNurse } from "@/lib/client"
import { ANAMNESE_FIELDS, BIRTH_FIELD, type FieldDef } from "@/lib/tabs"
import type { Bracelet } from "@/lib/types"
import { Card, History, run, SaveButton, type Status } from "./bracelet-screen"

const inputCls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base text-center placeholder:text-muted-foreground/70"
const pad = (v: string) => (v ? v.padStart(2, "0") : "")

type Birth = { dia: string; mes: string; ano: string; hora: string; min: string }
function parseBirth(v: string): Birth {
  const m = (v || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/)
  return m ? { dia: pad(m[1]), mes: pad(m[2]), ano: m[3], hora: m[4] ? pad(m[4]) : "", min: m[5] || "" } : { dia: "", mes: "", ano: "", hora: "", min: "" }
}
function joinBirth(b: Birth) {
  if (!b.dia && !b.mes && !b.ano) return ""
  const date = `${pad(b.dia)}/${pad(b.mes)}/${b.ano}`
  return b.hora ? `${date} ${pad(b.hora)}:${pad(b.min || "0")}` : date
}
function birthError(b: Birth) {
  if (!b.dia && !b.mes && !b.ano && !b.hora && !b.min) return null
  const d = +b.dia, m = +b.mes, y = +b.ano, h = b.hora === "" ? 0 : +b.hora, mi = b.min === "" ? 0 : +b.min
  if (!(d >= 1 && d <= 31) || !(m >= 1 && m <= 12) || !(y >= 2000 && y <= 2100)) return "Data de nascimento incompleta ou inválida."
  if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59)) return "Hora de nascimento inválida."
  const dt = new Date(y, m - 1, d)
  if (dt.getDate() !== d) return "Data de nascimento inválida."
  return null
}

const byName = (n: string) => ANAMNESE_FIELDS.find((f) => f.name === n)!

// Aba Anamnese: dados do nascimento, do parto e medidas (como na ficha da maternidade)
export function AnamneseTab({ bracelet, onSaved }: { bracelet: Bracelet; onSaved: (b: Bracelet) => void }) {
  const initial = useMemo(() => {
    const f: Record<string, string> = {}
    for (const x of ANAMNESE_FIELDS) f[x.name] = bracelet.dados[x.name] || ""
    if (!f["Enfermeiro(a) responsável"]) f["Enfermeiro(a) responsável"] = getNurse()
    return f
  }, [bracelet])
  const [form, setForm] = useState(initial)
  const [birth, setBirth] = useState(() => parseBirth(bracelet.dados[BIRTH_FIELD] || ""))
  const [status, setStatus] = useState<Status>(null)
  useEffect(() => {
    setForm(initial)
    setBirth(parseBirth(bracelet.dados[BIRTH_FIELD] || ""))
  }, [initial, bracelet])

  const changed: Record<string, string> = {}
  for (const x of ANAMNESE_FIELDS) if ((form[x.name] || "").trim() !== (bracelet.dados[x.name] || "")) changed[x.name] = (form[x.name] || "").trim()
  const birthText = joinBirth(birth)
  if (birthText !== (bracelet.dados[BIRTH_FIELD] || "")) changed[BIRTH_FIELD] = birthText
  const hasChanges = Object.keys(changed).length > 0

  const save = () =>
    run(setStatus, async () => {
      const err = birthError(birth)
      if (err) throw new Error(err)
      onSaved(await api.save({ nfc: bracelet.nfc, aba: "Anamnese", dados: changed }))
    })

  const set = (name: string) => (v: string) => setForm((c) => ({ ...c, [name]: v }))
  const B = (k: keyof Birth, label: string, ph: string, max: number) => (
    <label className="block">
      <span className="block text-[13px] mb-1 font-bold">{label}</span>
      <input className={inputCls} inputMode="numeric" placeholder={ph} value={birth[k]} onChange={(e) => setBirth((c) => ({ ...c, [k]: e.target.value.replace(/\D/g, "").slice(0, max) }))} />
    </label>
  )

  return (
    <>
      <Card>
        <h4 className="font-bold mb-3">Data e Hora do Nascimento</h4>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {B("dia", "Dia", "DD", 2)}
          {B("mes", "Mês", "MM", 2)}
          {B("ano", "Ano", "AAAA", 4)}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {B("hora", "Hora", "HH", 2)}
          {B("min", "Minuto", "MM", 2)}
        </div>

        <h4 className="font-bold mb-3">Dados do Parto</h4>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <F def={byName("Tipo de parto")} value={form["Tipo de parto"]} onChange={set("Tipo de parto")} />
          <F def={byName("Sexo")} value={form["Sexo"]} onChange={set("Sexo")} />
        </div>

        <h4 className="font-bold mb-3">Medidas</h4>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {["Peso ao nascer (g)", "Estatura (cm)", "PC (cm)", "PT (cm)", "IG (semanas)", "APGAR"].map((n) => (
            <F key={n} def={byName(n)} value={form[n]} onChange={set(n)} label={n === "Peso ao nascer (g)" ? "Peso (g)" : undefined} />
          ))}
        </div>
        <div className="space-y-3 mb-4">
          <F def={byName("DNV")} value={form["DNV"]} onChange={set("DNV")} label="Número da DNV" />
          <F def={byName("Enfermeiro(a) responsável")} value={form["Enfermeiro(a) responsável"]} onChange={set("Enfermeiro(a) responsável")} />
          <F def={byName("Observações da anamnese")} value={form["Observações da anamnese"]} onChange={set("Observações da anamnese")} label="Observações" />
        </div>
        <SaveButton status={status} onClick={save} disabled={!hasChanges} />
      </Card>
      <History entries={bracelet.historico} aba="Anamnese" />
    </>
  )
}

function F({ def, value, onChange, label }: { def: FieldDef; value: string; onChange: (v: string) => void; label?: string }) {
  const cls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"
  return (
    <label className="block">
      <span className="block text-[13px] mb-1 font-bold">{label || def.name}</span>
      {def.input === "select" ? (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione</option>
          {def.options?.map((o) => <option key={o}>{o}</option>)}
          {value && !def.options?.includes(value) && <option>{value}</option>}
        </select>
      ) : def.input === "textarea" ? (
        <textarea rows={3} className={cls} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} inputMode={def.inputMode} placeholder={def.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
