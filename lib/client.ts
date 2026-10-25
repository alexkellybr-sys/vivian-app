"use client"

import type { Bracelet, BraceletSummary, Fence, GpsState } from "./types"

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { cache: "no-store", ...init })
  } catch {
    throw new ApiError("Sem internet. Verifique a conexão e tente de novo.")
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.error || "Erro ao falar com o servidor.", !!data.notFound, data.nfc)
  return data as T
}

export class ApiError extends Error {
  constructor(message: string, public notFound = false, public nfc?: string) {
    super(message)
  }
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

export const api = {
  list: () => call<{ pulseiras: BraceletSummary[] }>("/api/pulseiras").then((d) => d.pulseiras),
  get: (numbers: string[]) =>
    call<{ pulseira: Bracelet }>(`/api/pulseira?${numbers.map((n) => `number=${encodeURIComponent(n)}`).join("&")}`).then((d) => d.pulseira),
  save: (body: { nfc: string; aba?: string; dados?: Record<string, string>; registros?: { campo: string; valor: string }[]; criar?: boolean }) =>
    call<{ pulseira: Bracelet }>("/api/pulseira", json({ ...body, usuario: getNurse() })).then((d) => d.pulseira),
  gps: () => call<GpsState & { rastreador: boolean }>("/api/gps"),
  saveFence: (cerca: Partial<Fence> & { nome: string; apagar?: boolean }) =>
    call<{ cercas: Fence[] }>("/api/gps", json({ tipo: "cerca", cerca, usuario: getNurse() })).then((d) => d.cercas),
  sendPosition: (p: { nfc: string; lat: number; lng: number; acc?: number; fonte: string }) =>
    call<{ avaliacao: { situacao: string; setor: string; distancia: number; cerca?: string } }>("/api/gps", json({ tipo: "posicao", ...p, usuario: getNurse() })),
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

export const getNurse = () => read("vivian-user") || ""
export const setNurse = (name: string) => write("vivian-user", name.trim())
export const isLoggedIn = () => read("vivian-logged-in") === "1"
export const setLoggedIn = (v: boolean) => write("vivian-logged-in", v ? "1" : null)

export function cacheGet<T>(key: string): T | null {
  try {
    const v = read(`vivian-cache-${key}`)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
export const cacheSet = (key: string, value: unknown) => write(`vivian-cache-${key}`, JSON.stringify(value))
