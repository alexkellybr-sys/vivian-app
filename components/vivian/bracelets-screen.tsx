"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, Nfc, Plus, RefreshCw, X } from "lucide-react"
import { api, ApiError } from "@/lib/client"
import { candidatesFromTag, type NDEFReaderLike } from "@/lib/nfc"
import type { BraceletSummary } from "@/lib/types"
import { GoldButton } from "./gold-button"
import { useGps } from "./gps-monitor"

type Props = {
  list: BraceletSummary[]
  loading: boolean
  error: string | null
  selected?: string
  compact?: boolean // painel do PC
  onRefresh: () => void
  onOpen: (nfc: string) => void
  onNotFound: (nfc: string) => void
  onNew: () => void
}

// Lê a etiqueta (Android/Chrome) ou recebe o número do link (?nfc=) e abre a pulseira
export function useNfcOpen(onOpen: (nfc: string) => void, onNotFound: (nfc: string) => void) {
  const [status, setStatus] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const busy = useRef(false)

  const stop = () => {
    abort.current?.abort()
    abort.current = null
    setReading(false)
  }
  useEffect(() => () => abort.current?.abort(), [])

  const lookup = async (numbers: string[]) => {
    if (busy.current) return
    busy.current = true
    setStatus(`Etiqueta lida (${numbers[0]}). Consultando a planilha…`)
    try {
      const b = await api.get(numbers)
      setStatus(null)
      onOpen(b.nfc)
    } catch (e) {
      if (e instanceof ApiError && e.notFound) {
        setStatus(null)
        onNotFound(e.nfc || numbers[0])
      } else setStatus(e instanceof Error ? e.message : "Não foi possível consultar a planilha.")
    } finally {
      busy.current = false
    }
  }

  const read = async () => {
    if (reading) {
      stop()
      setStatus(null)
      return
    }
    if (!("NDEFReader" in window)) {
      setStatus(
        "Este navegador não lê NFC direto. No Android use o Chrome. No iPhone, encoste o celular na etiqueta (com o app fechado) e toque na notificação — o paciente abre sozinho.",
      )
      return
    }
    const reader = new (window as Window & { NDEFReader: new () => NDEFReaderLike }).NDEFReader()
    const controller = new AbortController()
    abort.current = controller
    setReading(true)
    setStatus("Aproxime a etiqueta NFC da parte de trás do celular…")
    reader.onreadingerror = () => setStatus("Não foi possível ler esta etiqueta. Tente novamente.")
    reader.onreading = (event) => {
      stop()
      const numbers = candidatesFromTag(event)
      if (!numbers.length) return setStatus("A etiqueta não tem número legível.")
      void lookup(numbers)
    }
    try {
      await reader.scan({ signal: controller.signal })
    } catch (error) {
      stop()
      setStatus(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Permissão de NFC negada. Libere o NFC para este site nas configurações do Chrome."
          : "Não foi possível ligar o NFC. Verifique se o NFC do celular está ligado.",
      )
    }
  }

  return { read, reading, status, setStatus, lookup }
}

export function BraceletsScreen({ list, loading, error, selected, compact, onRefresh, onOpen, onNotFound, onNew }: Props) {
  const { state, alarms } = useGps()
  const nfc = useNfcOpen(onOpen, onNotFound)
  const situation = (n: string) => state?.posicoes.find((p) => p.nfc === n)?.situacao || ""

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-xs text-muted-foreground">{list.length} pulseira(s) na planilha</p>
        <button aria-label="Atualizar lista" onClick={onRefresh} className="p-1" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && <p className="mx-5 mt-2 text-xs text-red-600">{error}</p>}
      {!list.length && loading && <p className="mx-5 mt-3 text-sm">Carregando da planilha…</p>}

      <div>
        {list.map((b) => {
          const s = situation(b.nfc)
          const out = alarms.some((a) => a.nfc === b.nfc)
          return (
            <button
              key={b.nfc}
              onClick={() => onOpen(b.nfc)}
              className={`w-[calc(100%-2rem)] text-left bg-white mx-4 mt-3 p-4 rounded-[15px] flex justify-between items-center border-l-[5px] ${
                out ? "border-l-red-600 bg-red-50" : "border-l-primary"
              } ${selected === b.nfc ? "ring-2 ring-primary" : ""}`}
            >
              <div>
                <b>{b.bebe || "Sem nome"}</b>
                <br />
                <span className="text-sm text-muted-foreground">
                  Pulseira {b.nfc}
                  {b.leito ? ` · Leito ${b.leito}` : ""}
                </span>
                {s && (
                  <span className={`ml-2 text-[11px] font-bold rounded-full px-2 py-0.5 ${s === "FORA" ? "bg-red-600 text-white" : s === "dentro" ? "bg-green-100 text-green-800" : "bg-muted"}`}>
                    GPS {s === "FORA" ? "FORA" : s}
                  </span>
                )}
              </div>
              <ChevronRight className="w-5 h-5 shrink-0" />
            </button>
          )
        })}
      </div>

      {!compact && (
        <div className="px-5 mt-4 mb-4">
          <GoldButton onClick={nfc.read}>
            <Nfc className="w-4 h-4 mr-2 inline" />
            {nfc.reading ? "APROXIME A ETIQUETA (TOQUE P/ CANCELAR)" : "LEITURA NFC"}
          </GoldButton>
          {nfc.status && (
            <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
              <span className="flex-1">{nfc.status}</span>
              <button type="button" aria-label="Fechar mensagem" onClick={() => nfc.setStatus(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <button
        aria-label="Cadastrar pulseira"
        className={`${compact ? "mx-4 mt-3 rounded-[15px] py-3 text-sm font-bold flex gap-2 justify-center" : "fixed bottom-24 right-5 w-[60px] h-[60px] rounded-full flex justify-center items-center z-10"} bg-gradient-to-br from-accent via-[#F9E498] to-primary shadow-lg`}
        onClick={onNew}
      >
        <Plus className="w-6 h-6" />
        {compact && "Cadastrar pulseira"}
      </button>
    </div>
  )
}
