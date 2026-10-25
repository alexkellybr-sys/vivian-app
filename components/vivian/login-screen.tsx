"use client"

import { useState } from "react"
import { api, getNurse } from "@/lib/client"
import { GoldButton } from "./gold-button"

export function LoginScreen({ onLogin, notice }: { onLogin: (user: string) => void; notice?: string | null }) {
  const [user, setUser] = useState(() => getNurse())
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(notice || null)
  const input = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !pin.trim()) return setError("Preencha o usuário e o PIN.")
    setBusy(true)
    setError(null)
    try {
      onLogin(await api.login(user.trim(), pin.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 flex flex-col justify-center">
      <form className="bg-card mx-5 p-5 rounded-[25px] border-2 border-primary backdrop-blur-sm" onSubmit={submit}>
        <label className="block mb-4">
          <span className="block text-[13px] mb-1 font-bold">Usuário</span>
          <input className={input} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" placeholder="ex.: Enf. Maria" />
        </label>
        <label className="block mb-4">
          <span className="block text-[13px] mb-1 font-bold">PIN</span>
          <input className={input} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} autoComplete="current-password" />
        </label>
        <GoldButton type="submit" disabled={busy}>{busy ? "ENTRANDO..." : "Entrar"}</GoldButton>
        {error && <p role="alert" className="text-xs text-red-600 mt-3">{error}</p>}
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Novo usuário ou esqueceu o PIN? O administrador cadastra na aba <b>Usuários</b> da planilha.
        </p>
      </form>
    </div>
  )
}
