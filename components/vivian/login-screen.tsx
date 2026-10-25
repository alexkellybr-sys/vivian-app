"use client"

import { useState } from "react"
import { getNurse } from "@/lib/client"
import { GoldButton } from "./gold-button"

export function LoginScreen({ onLogin, onRecover, onRegister }: { onLogin: (user: string) => void; onRecover: () => void; onRegister: () => void }) {
  const [inst, setInst] = useState("")
  const [user, setUser] = useState(() => getNurse())
  const [pass, setPass] = useState("")
  const input = "w-full p-3 rounded-[15px] border border-primary bg-white outline-none text-base"

  return (
    <div className="flex-1 overflow-y-auto pb-20 flex flex-col justify-center">
      <form
        className="bg-card mx-5 p-5 rounded-[25px] border-2 border-primary backdrop-blur-sm"
        onSubmit={(e) => {
          e.preventDefault()
          onLogin(user.trim() || "Enfermagem")
        }}
      >
        <label className="block mb-4">
          <span className="block text-[13px] mb-1 font-bold">Instituição</span>
          <input className={input} value={inst} onChange={(e) => setInst(e.target.value)} autoComplete="organization" />
        </label>
        <label className="block mb-4">
          <span className="block text-[13px] mb-1 font-bold">Usuário</span>
          <input className={input} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" placeholder="ex.: Enf. Maria" />
        </label>
        <label className="block mb-4">
          <span className="block text-[13px] mb-1 font-bold">Senha</span>
          <input className={input} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        </label>
        <GoldButton type="submit">Entrar</GoldButton>
        <div className="text-center text-xs mt-3 space-x-2">
          <button type="button" onClick={onRecover} className="hover:underline">Esqueci Senha</button>
          <span>|</span>
          <button type="button" onClick={onRegister} className="hover:underline">Novo Usuário</button>
        </div>
      </form>
    </div>
  )
}
