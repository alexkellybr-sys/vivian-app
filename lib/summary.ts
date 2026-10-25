import type { Bracelet, HistoryEntry } from "./types"

// Monta o "Resumo" do bebê a partir do histórico da planilha (mesma ideia do bloco RESUMO POR DIA do script).

export type Registro = { time: string; aba: string; usuario: string; items: { campo: string; valor: string }[] }
export type Day = { key: string; label: string; number: number | null; turnos: { turno: Turno; nurses: string[] }[]; records: Registro[] }
export type Turno = "Manhã" | "Tarde" | "Noite"

const VITALS: { campo: string; short: string; unit: string }[] = [
  { campo: "Temperatura (°C)", short: "Temp", unit: "°C" },
  { campo: "Freq. cardíaca (bpm)", short: "FC", unit: "bpm" },
  { campo: "Freq. respiratória (irpm)", short: "FR", unit: "irpm" },
  { campo: "Saturação O2 (%)", short: "Sat", unit: "%" },
  { campo: "Peso (g)", short: "Peso", unit: "g" },
]

// "25/10/2026 14:00" ou "25/10/2026 14:00:00" → Date (horário local)
export function parseStamp(s: string): Date | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0)
}
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
export const turnoOf = (d: Date): Turno => (d.getHours() >= 7 && d.getHours() < 13 ? "Manhã" : d.getHours() >= 13 && d.getHours() < 19 ? "Tarde" : "Noite")
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

// junta as linhas do histórico que foram gravadas juntas (mesma hora, aba e usuário) num registro
function records(entries: HistoryEntry[]) {
  const out: (Registro & { date: Date })[] = []
  for (const e of entries) {
    const date = parseStamp(e.data)
    if (!date) continue
    const last = out[out.length - 1]
    if (last && last.date.getTime() === date.getTime() && last.aba === e.aba && last.usuario === e.usuario) last.items.push({ campo: e.campo, valor: e.valor })
    else out.push({ date, time: hhmm(date), aba: e.aba, usuario: e.usuario, items: [{ campo: e.campo, valor: e.valor }] })
  }
  // o histórico vem do mais novo para o mais antigo; dentro do registro, volta para a ordem gravada
  out.forEach((r) => r.items.reverse())
  return out
}

export function admissionStart(b: Bracelet): Date | null {
  const birth = parseStamp(b.dados["Data de nascimento"] || "")
  if (birth) return birth
  const all = records(b.historico).filter((r) => r.usuario !== "importação")
  return all.length ? all[all.length - 1].date : null
}

export function dayNumber(start: Date | null, d: Date) {
  if (!start) return null
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

export function buildSummary(b: Bracelet, now = new Date()) {
  const recs = records(b.historico)
  const start = admissionStart(b)

  // situação atual
  const vitals = VITALS.map((v) => {
    // direto do histórico (já vem do mais novo para o mais antigo), um valor por linha
    const values = b.historico
      .filter((e) => e.aba === "Sinais vitais" && e.campo === v.campo && e.valor)
      .map((e) => ({ valor: e.valor, date: parseStamp(e.data) || new Date(0) }))
    // values[0] = mais recente; o último da lista = primeiro da internação (ex.: temperatura inicial)
    return { ...v, last: values[0], previous: values[1], first: values.length > 1 ? values[values.length - 1] : undefined }
  }).filter((v) => v.last)
  const lastObs = recs.find((r) => r.aba === "Sinais vitais" && r.items.some((i) => i.campo === "Observação"))
  const allergies = recs.filter((r) => r.aba === "Alergias")
  const diagnosis = recs.find((r) => r.aba === "Diagnóstico")
  const dayMs = 86400000
  const meds = recs.filter((r) => r.aba === "Medicações" && now.getTime() - r.date.getTime() <= dayMs)
  const incidents = recs.filter((r) => r.aba === "Intercorrências" && now.getTime() - r.date.getTime() <= 3 * dayMs)
  const conference = recs.find((r) => r.aba === "Conferência")
  const anamnese = recs.filter((r) => r.aba === "Anamnese")
  const alergiaCount = allergies.length

  // dia a dia (mais novo primeiro)
  const days: Day[] = []
  for (const r of recs) {
    if (r.usuario === "importação") continue
    const key = dayKey(r.date)
    let day = days.find((d) => d.key === key)
    if (!day) {
      day = { key, label: `${WEEK[r.date.getDay()]} ${String(r.date.getDate()).padStart(2, "0")}/${String(r.date.getMonth() + 1).padStart(2, "0")}`, number: dayNumber(start, r.date), turnos: [], records: [] }
      days.push(day)
    }
    day.records.push({ time: r.time, aba: r.aba, usuario: r.usuario, items: r.items })
    if (r.usuario) {
      const t = turnoOf(r.date)
      let tu = day.turnos.find((x) => x.turno === t)
      if (!tu) day.turnos.push((tu = { turno: t, nurses: [] }))
      if (!tu.nurses.includes(r.usuario)) tu.nurses.push(r.usuario)
    }
  }
  const order: Turno[] = ["Manhã", "Tarde", "Noite"]
  days.forEach((d) => d.turnos.sort((a, b) => order.indexOf(a.turno) - order.indexOf(b.turno)))

  return {
    dayOfStay: start ? dayNumber(start, now) : null,
    vitals,
    lastObs,
    allergies,
    diagnosis,
    meds,
    incidents,
    conference,
    anamnese,
    alergiaCount,
    days,
  }
}

export const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hhmm(d)}`
