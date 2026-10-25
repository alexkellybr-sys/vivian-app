"use client"

import { useState } from "react"
import { api } from "@/lib/client"
import type { Bracelet } from "@/lib/types"
import { GoldButton } from "./gold-button"

const FIELDS = ["Nome do bebê", "Nome da mãe", "Leito", "Telefone de emergência"]

export function NewBraceletScreen({ initialNfc = "", onCreated }: { initialNfc?: string; onCreated: (b: Bracelet) => void }) {
  const [nfc, setNfc] = useState(initialNfc)
  const [form, setForm] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const input = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"

  const save = async () => {
    if (!/[0-9a-z]/i.test(nfc)) return setStatus({ ok: false, text: "Informe o número da pulseira (NFC)." })
    setBusy(true)
    setStatus(null)
    try {
      const dados = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()))
      onCreated(await api.save({ nfc: nfc.trim(), dados, criar: true }))
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "Erro ao cadastrar." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 pt-4 pb-6">
      {initialNfc && (
        <p className="mb-3 text-sm rounded-[12px] bg-accent/20 border border-accent px-3 py-2">
          A pulseira <b>{initialNfc}</b> ainda não está na planilha. Preencha para cadastrar — uma aba nova será criada para ela.
        </p>
      )}
      <div className="bg-card p-4 rounded-[22px] border-2 border-primary">
        <label className="block mb-3">
          <span className="block text-[13px] mb-1 font-bold">Número da pulseira (NFC)</span>
          <input className={input} inputMode="numeric" value={nfc} onChange={(e) => setNfc(e.target.value)} />
        </label>
        {FIELDS.map((f) => (
          <label key={f} className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">{f}</span>
            <input className={input} inputMode={/telefone/i.test(f) ? "tel" : "text"} value={form[f] || ""} onChange={(e) => setForm((c) => ({ ...c, [f]: e.target.value }))} />
          </label>
        ))}
        <GoldButton onClick={save} disabled={busy}>{busy ? "CADASTRANDO..." : "CADASTRAR PULSEIRA"}</GoldButton>
        {status && <p role="status" className={`text-xs mt-2 ${status.ok ? "text-green-700" : "text-red-600"}`}>{status.text}</p>}
      </div>
    </div>
  )
}
