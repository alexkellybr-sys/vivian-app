"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { api, getNurse } from "@/lib/client"
import type { Bracelet } from "@/lib/types"
import { hhmmNow } from "@/lib/vacinas"
import { Card, History, run, SaveButton, type Status } from "./bracelet-screen"

const inputCls = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"
const pad = (n: number) => String(n).padStart(2, "0")
const isoToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Aba Alta (só no celular): registra a alta e avisa o PC para arquivar/apagar os dados da pulseira
export function AltaTab({ bracelet, onSaved }: { bracelet: Bracelet; onSaved: (b: Bracelet) => void }) {
  const d = bracelet.dados
  const especialista = getNurse()
  const [data, setData] = useState(isoToday)
  const [hora, setHora] = useState(() => hhmmNow())
  const [obs, setObs] = useState("")
  const [status, setStatus] = useState<Status>(null)

  const darAlta = () =>
    run(setStatus, async () => {
      if (!data || !hora) throw new Error("Preencha a data e a hora da alta.")
      const quando = `${data.split("-").reverse().join("/")} ${hora}`
      onSaved(await api.save({ nfc: bracelet.nfc, aba: "Alta", dados: { Alta: quando, "Especialista da alta": especialista, "Observações da alta": obs.trim() } }))
    })
  const desfazer = () => {
    if (!window.confirm("Cancelar a alta deste bebê?")) return
    return run(setStatus, async () => {
      onSaved(await api.save({ nfc: bracelet.nfc, aba: "Alta", dados: { Alta: "", "Especialista da alta": "", "Observações da alta": "" } }))
    })
  }

  return (
    <>
      {d["Alta"] ? (
        <Card>
          <p className="font-bold text-lg flex items-center gap-2 text-green-800">
            <LogOut className="w-5 h-5" /> Alta registrada
          </p>
          <p className="text-sm mt-1">
            {d["Alta"]} · {d["Especialista da alta"] || "—"}
          </p>
          {d["Observações da alta"] && <p className="text-sm mt-1">📝 {d["Observações da alta"]}</p>}
          <p className="text-xs text-muted-foreground mt-2">O PC já foi avisado para arquivar e liberar a pulseira.</p>
          <button className="mt-3 text-sm underline text-red-700" onClick={desfazer} disabled={status?.busy}>
            Cancelar a alta
          </button>
          {status && !status.busy && <p className={`text-xs mt-2 ${status.ok ? "text-green-700" : "text-red-600"}`}>{status.text}</p>}
        </Card>
      ) : (
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <label className="block mb-3">
              <span className="block text-[13px] mb-1 font-bold">Data</span>
              <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label className="block mb-3">
              <span className="block text-[13px] mb-1 font-bold">Hora</span>
              <input type="time" className={inputCls} value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
          </div>
          <label className="block mb-3">
            <span className="block text-[13px] mb-1 font-bold">Observações</span>
            <textarea rows={3} className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <label className="block mb-4">
            <span className="block text-[13px] mb-1 font-bold">Nome do especialista</span>
            <input className={`${inputCls} bg-muted/40`} value={especialista} readOnly aria-readonly />
          </label>
          <SaveButton status={status} onClick={darAlta} label="DAR ALTA" />
          <p className="text-[11px] text-muted-foreground mt-2 text-center">Ao dar alta, o PC recebe o aviso para arquivar e apagar os dados desta pulseira.</p>
        </Card>
      )}
      <History entries={bracelet.historico} aba="Alta" />
    </>
  )
}
