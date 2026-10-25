import { errorResponse, sheetGet, sheetPost } from "@/lib/server/sheet"
import { syncTraccar, traccarEnabled } from "@/lib/server/traccar"

// GET → cercas + últimas posições (+ busca posições novas do Traccar, se configurado)
export async function GET() {
  try {
    let data = await sheetGet({ action: "gps" })
    if (traccarEnabled()) {
      try {
        if ((await syncTraccar(data.pulseiras)) > 0) data = await sheetGet({ action: "gps" })
      } catch {
        /* Traccar fora do ar não pode travar o app */
      }
    }
    return Response.json({ cercas: data.cercas, posicoes: data.posicoes, pulseiras: data.pulseiras, rastreador: traccarEnabled() })
  } catch (error) {
    return errorResponse(error)
  }
}

// POST { tipo: "posicao", nfc, lat, lng, acc, fonte } | { tipo: "cerca", cerca }
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 })
  }
  const usuario = String(body?.usuario ?? "").slice(0, 60)
  try {
    if (body?.tipo === "cerca") {
      const c = body.cerca || {}
      const coords = (Array.isArray(c.coords) ? c.coords : [])
        .map((p: unknown) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : null))
        .filter((p: number[] | null): p is number[] => !!p && p.every(Number.isFinite))
        .slice(0, 200)
      const nome = String(c.nome ?? "").trim().slice(0, 60)
      if (!nome) return Response.json({ error: "Dê um nome para a cerca." }, { status: 400 })
      if (!c.apagar && (c.forma === "circulo" ? coords.length < 1 || !(Number(c.raio) > 0) : coords.length < 3))
        return Response.json({ error: "Cerca incompleta: polígono precisa de 3 pontos; círculo precisa de centro e raio." }, { status: 400 })
      const data = await sheetPost({
        action: "fence",
        cerca: { nome, tipo: c.tipo, pulseiras: String(c.pulseiras ?? "todas").slice(0, 200), forma: c.forma, coords, raio: Number(c.raio) || 0, ativa: c.ativa !== false, apagar: !!c.apagar },
        usuario,
      })
      return Response.json({ cercas: data.cercas })
    }
    if (body?.tipo === "posicao") {
      const lat = Number(body.lat)
      const lng = Number(body.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
        return Response.json({ error: "Coordenadas inválidas." }, { status: 400 })
      const data = await sheetPost({
        action: "position",
        posicao: { nfc: String(body.nfc ?? ""), lat, lng, acc: Number(body.acc) || 0, fonte: String(body.fonte ?? "").slice(0, 40) },
        usuario,
      })
      return Response.json({ avaliacao: data.avaliacao })
    }
    return Response.json({ error: "Pedido desconhecido." }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}

export const dynamic = "force-dynamic"
