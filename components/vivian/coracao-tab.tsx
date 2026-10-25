"use client"

import { useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { api } from "@/lib/client"
import { ABA_CORACAO, avaliarCoracao, RESULTADOS } from "@/lib/coracao"
import type { Bracelet, HistoryEntry } from "@/lib/types"
import { Card, History, run, SaveButton, type Status } from "./bracelet-screen"

const inputCls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"
type Modo = "Automático" | "Manual"
const MODO_KEY = "vivian-coracao-modo"

export function CoracaoTab({ nfc, history, onSaved }: { nfc: string; history: HistoryEntry[]; onSaved: (b: Bracelet) => void }) {
  const [modo, setModo] = useState<Modo>("Automático")
  const [horas, setHoras] = useState("")
  const [mao, setMao] = useState("")
  const [pe, setPe] = useState("")
  const [manual, setManual] = useState("")
  const [obs, setObs] = useState("")
  const [status, setStatus] = useState<Status>(null)

  // o modo escolhido fica guardado neste aparelho
  useEffect(() => {
    try {
      if (localStorage.getItem(MODO_KEY) === "Manual") setModo("Manual")
    } catch {}
  }, [])
  const escolher = (m: Modo) => {
    setModo(m)
    try {
      localStorage.setItem(MODO_KEY, m)
    } catch {}
  }

  const auto = avaliarCoracao(mao, pe, history)
  const resultado = modo === "Automático" ? auto?.resultado || "" : manual
  const h = Number(horas)
  const tone = /alterado/i.test(resultado) ? "bg-red-50 border-red-500 text-red-800" : /repetir/i.test(resultado) ? "bg-orange-50 border-orange-400 text-orange-800" : "bg-green-50 border-green-600 text-green-800"

  const save = () =>
    run(setStatus, async () => {
      if (!mao.trim() || !pe.trim()) throw new Error("Preencha a saturação da mão direita e do pé.")
      if (!resultado) throw new Error(modo === "Manual" ? "Escolha o resultado." : "Saturação inválida.")
      const registros = [
        { campo: "Horas de vida", valor: horas.trim() },
        { campo: "SatO2 mão direita (%)", valor: mao.trim() },
        { campo: "SatO2 pé (%)", valor: pe.trim() },
        { campo: "Resultado", valor: resultado },
        { campo: "Modo", valor: modo },
        { campo: "Observação", valor: obs.trim() },
      ].filter((r) => r.valor)
      onSaved(await api.save({ nfc, aba: ABA_CORACAO, registros }))
      setMao("")
      setPe("")
      setManual("")
      setObs("")
    })

  return (
    <>
      <Card>
        <div className="mb-4">
          <span className="block text-[13px] mb-1 font-bold">Resultado</span>
          <div role="radiogroup" aria-label="Modo do resultado" className="grid grid-cols-2 rounded-full border-2 border-primary overflow-hidden">
            {(["Automático", "Manual"] as Modo[]).map((m) => (
              <button key={m} role="radio" aria-checked={modo === m} onClick={() => escolher(m)} className={`py-2 text-sm font-bold ${modo === m ? "bg-gradient-to-br from-accent via-[#F9E498] to-primary" : "bg-white"}`}>
                {m}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {modo === "Automático" ? "O app calcula pelo protocolo da SBP (2022). A enfermeira só confere." : "A enfermeira escolhe o resultado."}
          </p>
        </div>
        <label className="block mb-3">
          <span className="block text-[13px] mb-1 font-bold">Horas de vida</span>
          <input className={inputCls} inputMode="numeric" value={horas} placeholder="ex.: 30" onChange={(e) => setHoras(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          {horas && (h < 24 || h > 48) && <span className="block text-[11px] text-orange-700 mt-1">O protocolo indica fazer o teste entre 24 e 48 horas de vida.</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">SatO2 mão direita (%)</span>
            <input className={inputCls} inputMode="numeric" value={mao} onChange={(e) => setMao(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
          </label>
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">SatO2 pé (%)</span>
            <input className={inputCls} inputMode="numeric" value={pe} onChange={(e) => setPe(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
          </label>
        </div>
        {modo === "Automático" ? (
          auto ? (
            <div role="status" className={`mb-3 rounded-[15px] border-2 px-3 py-2 ${tone}`}>
              <p className="font-bold flex items-center gap-1.5">
                <Heart className="w-4 h-4 fill-red-600 text-red-600" /> {auto.resultado}
              </p>
              <p className="text-xs">{auto.motivo}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">Preencha as duas saturações para ver o resultado.</p>
          )
        ) : (
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Resultado (manual)</span>
            <select className={inputCls} value={manual} onChange={(e) => setManual(e.target.value)}>
              <option value="">—</option>
              {RESULTADOS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {auto && auto.resultado !== manual && manual && <span className="block text-[11px] text-orange-700 mt-1">Pelo protocolo seria: {auto.resultado}.</span>}
          </label>
        )}
        <label className="block mb-3">
          <span className="block text-[13px] mb-1 font-bold">Observação</span>
          <textarea rows={2} className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>
        <SaveButton status={status} onClick={save} label="REGISTRAR" disabled={!mao || !pe || !resultado} />
      </Card>
      <History entries={history} aba={ABA_CORACAO} />
    </>
  )
}
