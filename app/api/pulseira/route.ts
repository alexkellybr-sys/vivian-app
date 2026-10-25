import { errorResponse, sheetGet, sheetPost, SheetError } from "@/lib/server/sheet"
import { keyFromText } from "@/lib/nfc"

// GET ?number=...&number=...  → abre a primeira pulseira encontrada (etiqueta pode trazer vários números)
export async function GET(request: Request) {
  const candidates = new URL(request.url).searchParams
    .getAll("number")
    .map((v) => (keyFromText(v) || v).trim())
    .filter((v) => /[0-9a-z]/i.test(v))
    .slice(0, 4)
  if (!candidates.length) return Response.json({ error: "Número NFC não informado." }, { status: 400 })
  try {
    for (const nfc of candidates) {
      try {
        const data = await sheetGet({ nfc })
        return Response.json({ pulseira: data.pulseira })
      } catch (error) {
        if (!(error instanceof SheetError && error.notFound)) throw error
      }
    }
    return Response.json(
      { error: `Pulseira ${candidates[0]} não cadastrada na planilha.`, notFound: true, nfc: candidates[0] },
      { status: 404 },
    )
  } catch (error) {
    return errorResponse(error)
  }
}

// POST { nfc, aba?, dados?, registros?, criar?, usuario }
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 })
  }
  const nfc = String(body?.nfc ?? "").trim()
  if (!/[0-9a-z]/i.test(nfc)) return Response.json({ error: "Número NFC inválido." }, { status: 400 })

  const dados: Record<string, string> = {}
  for (const [k, v] of Object.entries(body.dados && typeof body.dados === "object" ? body.dados : {})) {
    const name = String(k).trim().slice(0, 80)
    if (name && !/find\s*key|ntag/i.test(name)) dados[name] = String(v ?? "").slice(0, 2000)
  }
  const registros = (Array.isArray(body.registros) ? body.registros : [])
    .map((r: any) => ({ campo: String(r?.campo ?? "").slice(0, 80), valor: String(r?.valor ?? "").slice(0, 2000) }))
    .filter((r: { campo: string; valor: string }) => r.campo && r.valor.trim())
  const usuario = String(body.usuario ?? "").slice(0, 60)

  try {
    const data = await sheetPost(
      body.criar
        ? { action: "create", nfc, dados, usuario }
        : { action: "save", nfc, aba: String(body.aba ?? "").slice(0, 40), dados, registros, usuario },
    )
    return Response.json({ pulseira: data.pulseira })
  } catch (error) {
    return errorResponse(error)
  }
}

export const dynamic = "force-dynamic"
