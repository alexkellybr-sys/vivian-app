// Integração opcional com um servidor Traccar (traccar.org), que recebe a posição de rastreadores
// como o GF-07 (configurado por SMS para enviar ao servidor). Só liga se as variáveis existirem na Vercel:
//   TRACCAR_URL   ex.: https://demo.traccar.org
//   TRACCAR_TOKEN (token da conta)  ou  TRACCAR_USER + TRACCAR_PASSWORD
// Na aba Dados da pulseira, o campo "GPS (IMEI)" liga a pulseira ao rastreador (o "Identificador" no Traccar).

import { sheetPost } from "./sheet"
import type { BraceletSummary } from "../types"

const URL_BASE = (process.env.TRACCAR_URL || "").replace(/\/$/, "")
const lastSent = new Map<string, string>() // nfc → fixTime já enviado

function headers(): HeadersInit {
  if (process.env.TRACCAR_TOKEN) return { Authorization: `Bearer ${process.env.TRACCAR_TOKEN}` }
  const user = process.env.TRACCAR_USER || ""
  const pass = process.env.TRACCAR_PASSWORD || ""
  return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` }
}

export const traccarEnabled = () => !!URL_BASE

// Copia as posições novas do Traccar para a planilha (que avalia a cerca e registra alarmes).
export async function syncTraccar(pulseiras: BraceletSummary[]) {
  if (!URL_BASE) return 0
  const linked = pulseiras.filter((p) => p.gps && p.gps.trim())
  if (!linked.length) return 0
  const opts = { headers: headers(), cache: "no-store" as const, signal: AbortSignal.timeout(10000) }
  const [devices, positions] = await Promise.all([
    fetch(`${URL_BASE}/api/devices`, opts).then((r) => (r.ok ? r.json() : [])),
    fetch(`${URL_BASE}/api/positions`, opts).then((r) => (r.ok ? r.json() : [])),
  ])
  let sent = 0
  for (const p of linked) {
    const device = (devices as any[]).find((d) => String(d.uniqueId).trim() === p.gps.trim())
    const pos = device && (positions as any[]).find((x) => x.deviceId === device.id)
    if (!pos || !pos.valid || (pos.latitude === 0 && pos.longitude === 0)) continue
    if (lastSent.get(p.nfc) === pos.fixTime) continue
    await sheetPost({
      action: "position",
      posicao: { nfc: p.nfc, lat: pos.latitude, lng: pos.longitude, acc: pos.accuracy || 0, fonte: `rastreador ${device.name || p.gps}` },
      usuario: "rastreador",
    })
    lastSent.set(p.nfc, pos.fixTime)
    sent++
  }
  return sent
}
