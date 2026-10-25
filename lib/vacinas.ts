import type { AgendaItem } from "./types"

// Doses de uma vacina programada: uma por dia, no mesmo horário, durante "dias" dias.
export type Dose = { item: AgendaItem; dia: string; date: Date; aplicada: boolean }

const pad = (n: number) => String(n).padStart(2, "0")
export const ddmmyyyy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
export const hhmmNow = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function doses(item: AgendaItem): Dose[] {
  const m = item.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const t = item.horario.match(/^(\d{2}):(\d{2})$/)
  if (!m || !t) return []
  const out: Dose[] = []
  for (let i = 0; i < Math.max(1, item.dias); i++) {
    const date = new Date(+m[3], +m[2] - 1, +m[1] + i, +t[1], +t[2])
    const dia = ddmmyyyy(date)
    out.push({ item, dia, date, aplicada: item.aplicadas.includes(dia) })
  }
  return out
}

// doses na hora (ou atrasadas há menos de 12 h) que ainda não foram aplicadas e têm alarme ligado
export const ALARM_WINDOW_MS = 12 * 3600000
export function dueDoses(agenda: AgendaItem[], now = Date.now()): Dose[] {
  return agenda
    .filter((a) => a.alarme && a.situacao !== "Concluída")
    .flatMap(doses)
    .filter((d) => !d.aplicada && d.date.getTime() <= now && now - d.date.getTime() < ALARM_WINDOW_MS)
}

export const doseKey = (d: Dose) => `${d.item.id}|${d.dia}`
export const fmtDose = (d: Dose) => `${d.dia.slice(0, 5)} ${d.item.horario}`
