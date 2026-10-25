import type { AgendaItem } from "./types"

// Doses de uma vacina programada: 1ª dose em data+horário, repete a cada "intervalo" horas durante "dias" dias.
export type Dose = { item: AgendaItem; key: string; dia: string; hora: string; date: Date; n: number; total: number; aplicada: boolean }

const pad = (n: number) => String(n).padStart(2, "0")
export const ddmmyyyy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
export const hhmmNow = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export const totalDoses = (dias: number, intervalo: number) => (intervalo > 0 ? Math.max(1, Math.min(200, Math.floor((dias * 24) / intervalo))) : 1)

export function doseTimes(data: string, horario: string, dias: number, intervalo: number): Date[] {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const t = horario.match(/^(\d{2}):(\d{2})$/)
  if (!m || !t) return []
  const first = new Date(+m[3], +m[2] - 1, +m[1], +t[1], +t[2]).getTime()
  return Array.from({ length: totalDoses(dias, intervalo) }, (_, i) => new Date(first + i * intervalo * 3600000))
}

export function doses(item: AgendaItem): Dose[] {
  const times = doseTimes(item.data, item.horario, item.dias, item.intervalo)
  return times.map((date, i) => {
    const dia = ddmmyyyy(date)
    const hora = hhmmNow(date)
    const key = `${dia} ${hora}`
    // registros antigos guardavam só a data (uma dose por dia)
    return { item, key, dia, hora, date, n: i + 1, total: times.length, aplicada: item.aplicadas.includes(key) || item.aplicadas.includes(dia) }
  })
}

// doses na hora (ou atrasadas há menos de 12 h) que ainda não foram aplicadas e têm alarme ligado
export const ALARM_WINDOW_MS = 12 * 3600000
export function dueDoses(agenda: AgendaItem[], now = Date.now()): Dose[] {
  return agenda
    .filter((a) => a.alarme && a.situacao !== "Concluída")
    .flatMap(doses)
    .filter((d) => !d.aplicada && d.date.getTime() <= now && now - d.date.getTime() < ALARM_WINDOW_MS)
}

export const doseKey = (d: Dose) => `${d.item.id}|${d.key}`
export const fmtDose = (d: Dose) => `${d.dia.slice(0, 5)} ${d.hora}`
export const repeticao = (a: Pick<AgendaItem, "dias" | "intervalo">) =>
  a.intervalo > 0 ? `a cada ${a.intervalo} h por ${a.dias} dia${a.dias > 1 ? "s" : ""} · ${totalDoses(a.dias, a.intervalo)} doses` : "dose única"
