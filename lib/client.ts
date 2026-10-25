"use client"

import { SCRIPT_URL } from "./config"
import { keyFromText } from "./nfc"
import type { AgendaItem, Bracelet, BraceletSummary, Fence, GpsState } from "./types"

// O app fala direto com o Apps Script da planilha.
// GET com parâmetros e POST com texto JSON (assim o navegador não faz "preflight", que o Google não aceita).

export class ApiError extends Error {
  constructor(message: string, public notFound = false, public nfc?: string, public auth = false) {
    super(message)
  }
}

async function parse(response: Response) {
  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    if (/accounts\.google|ServiceLogin|signin/i.test(text) || /accounts\.google/.test(response.url))
      throw new ApiError("O script da planilha não está público. No Apps Script: Implantar → Gerenciar implantações → editar → 'Quem pode acessar: Qualquer pessoa'.")
    throw new ApiError("A planilha respondeu com erro. Tente de novo em instantes.")
  }
  if (!data.ok) {
    if (data.auth) {
      setSession(null)
      window.dispatchEvent(new CustomEvent("vivian-auth", { detail: data.error }))
    }
    throw new ApiError(data.error || "Erro na planilha.", !!data.notFound, undefined, !!data.auth)
  }
  return data
}

async function get(params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, s: getSession() || "" }).toString()
  try {
    return await parse(await fetch(`${SCRIPT_URL}?${q}`, { cache: "no-store", redirect: "follow" }))
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError("Sem internet ou planilha fora do ar. Tente de novo.")
  }
}

async function post(body: Record<string, unknown>) {
  try {
    return await parse(
      await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...body, s: getSession() || "" }),
        redirect: "follow",
        cache: "no-store",
      }),
    )
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError("Sem internet ou planilha fora do ar. Tente salvar de novo.")
  }
}

export const api = {
  login: async (usuario: string, pin: string) => {
    const d = await post({ action: "login", usuario, pin })
    setSession(d.sessao)
    setNurse(d.usuario)
    return d.usuario as string
  },
  logout: () => post({ action: "logout" }).catch(() => {}).finally(() => setSession(null)),
  list: () => get({ action: "list" }).then((d) => d.pulseiras as BraceletSummary[]),
  // a etiqueta pode trazer vários números (Find Key, link, número de série): tenta um por um
  get: async (numbers: string[]) => {
    const candidates = numbers.map((v) => (keyFromText(v) || v).trim()).filter((v) => /[0-9a-z]/i.test(v)).slice(0, 4)
    if (!candidates.length) throw new ApiError("Número NFC não informado.")
    for (const nfc of candidates) {
      try {
        return (await get({ nfc })).pulseira as Bracelet
      } catch (e) {
        if (!(e instanceof ApiError && e.notFound)) throw e
      }
    }
    throw new ApiError(`Pulseira ${candidates[0]} não cadastrada na planilha.`, true, candidates[0])
  },
  save: (body: { nfc: string; aba?: string; dados?: Record<string, string>; registros?: { campo: string; valor: string }[]; criar?: boolean }) =>
    post(body.criar ? { action: "create", nfc: body.nfc, dados: body.dados || {} } : { action: "save", ...body }).then((d) => d.pulseira as Bracelet),
  // poll=1: a consulta automática do GPS não conta como "uso" (senão a sessão nunca expiraria)
  gps: () => get({ action: "gps", poll: "1" }) as Promise<GpsState & { rastreador: boolean }>,
  saveFence: (cerca: Partial<Fence> & { nome: string; apagar?: boolean }) => post({ action: "fence", cerca }).then((d) => d.cercas as Fence[]),
  // vacinas: programar ({nfc, vacina, data, horario, dias, alarme}), marcar dose aplicada ({id, aplicar}) ou cancelar ({id, cancelar})
  agenda: (item: Record<string, unknown>) => post({ action: "agenda", item }) as Promise<{ agenda: AgendaItem[]; pulseira: Bracelet | null }>,
  // PC: arquiva tudo da pulseira no Drive e deixa ela vazia para outro bebê
  archive: (nfc: string, confirmar: string) => post({ action: "archive", nfc, confirmar }) as Promise<{ pulseira: Bracelet; arquivo: string; bebe: string }>,
  sendPosition: (p: { nfc: string; lat: number; lng: number; acc?: number; fonte: string }) =>
    post({ action: "position", posicao: p }) as Promise<{ avaliacao: { situacao: string; setor: string; distancia: number; cerca?: string } }>,
}

// ── sessão / preferências guardadas no aparelho ──
const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {}
}

export const getSession = () => read("vivian-session")
export const setSession = (s: string | null) => write("vivian-session", s)
export const isLoggedIn = () => !!getSession()
export const getNurse = () => read("vivian-user") || ""
export const setNurse = (name: string) => write("vivian-user", name.trim())

export function cacheGet<T>(key: string): T | null {
  try {
    const v = read(`vivian-cache-${key}`)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
export const cacheSet = (key: string, value: unknown) => write(`vivian-cache-${key}`, JSON.stringify(value))
