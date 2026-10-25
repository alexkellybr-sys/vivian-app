"use client"

import type { ScreenId } from "@/lib/screens"
import { Header } from "./header"
import { GoldButton } from "./gold-button"

interface RecoverScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function RecoverScreen({ onNavigate }: RecoverScreenProps) {
  const handleSendCode = () => {
    alert("Código enviado!")
  }

  const handleResetPassword = () => {
    alert("Senha redefinida!")
    onNavigate("login")
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-20">
      <Header title="RECUPERAR ACESSO" onBack={() => onNavigate("login")} />

      <div className="bg-card mx-5 mt-5 p-5 rounded-[25px] border-2 border-primary backdrop-blur-sm">
        <p className="mb-3">Insira seu e-mail para receber o código:</p>
        <input
          type="email"
          className="w-full p-3 rounded-[15px] border border-primary bg-white outline-none"
        />
        <GoldButton onClick={handleSendCode}>Enviar Código</GoldButton>

        <hr className="my-5 border-muted" />

        <input
          type="text"
          placeholder="Código de verificação"
          className="w-full p-3 rounded-[15px] border border-primary bg-white outline-none mb-3"
        />
        <input
          type="password"
          placeholder="Nova Senha"
          className="w-full p-3 rounded-[15px] border border-primary bg-white outline-none"
        />
        <GoldButton onClick={handleResetPassword}>Redefinir Senha</GoldButton>
      </div>
    </div>
  )
}
