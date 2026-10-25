// SÓ SERVIDOR (rotas /api). Não importe em telas do app — o token ficaria visível.

// Link do "App da Web" do Apps Script (termina em /exec). Pode ser trocado na Vercel pela variável APPS_SCRIPT_URL.
export const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx9HHgY3WLXGrF3fzNuSHNeCh4EF3zWOFV5aq5eVF-fHDXrcFpdAcgOkVvhnQk-bWNi/exec"

// Igual ao TOKEN do Codigo.gs.
const TOKEN = process.env.APPS_SCRIPT_TOKEN || "viv_58f59d9c681c1c1d6c1ce3bdc9247ed4"

export class SheetError extends Error {
  constructor(message: string, public status = 502, public notFound = false) {
    super(message)
  }
}

async function parse(response: Response) {
  const text = await response.text()
  if (/^\s*</.test(text)) {
    // Google devolveu uma página (login ou erro) em vez de JSON
    throw new SheetError(
      /accounts\.google|ServiceLogin|signin/i.test(text) || /accounts\.google/.test(response.url)
        ? "O script da planilha não está público. No Apps Script: Implantar → Gerenciar implantações → editar → 'Quem pode acessar: Qualquer pessoa' → Nova versão."
        : "O script da planilha respondeu com erro. Confira se o código foi colado inteiro no Apps Script.",
    )
  }
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new SheetError("Resposta inválida da planilha.")
  }
  if (!data.ok) throw new SheetError(data.error || "Erro na planilha.", data.notFound ? 404 : 502, !!data.notFound)
  return data
}

export async function sheetGet(params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, token: TOKEN }).toString()
  let response: Response
  try {
    response = await fetch(`${APPS_SCRIPT_URL}?${query}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30000) })
  } catch {
    throw new SheetError("Sem conexão com a planilha. Tente de novo.")
  }
  return parse(response)
}

export async function sheetPost(body: Record<string, unknown>) {
  let response: Response
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...body, token: TOKEN }),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    throw new SheetError("Sem conexão com a planilha. Tente salvar de novo.")
  }
  return parse(response)
}

export function errorResponse(error: unknown) {
  const e = error instanceof SheetError ? error : new SheetError(error instanceof Error ? error.message : "Erro inesperado.")
  return Response.json({ error: e.message, notFound: e.notFound }, { status: e.status })
}
