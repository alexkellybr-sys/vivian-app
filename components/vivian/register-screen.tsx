"use client"

import type { ScreenId } from "@/lib/screens"
import { Header } from "./header"
import { GoldButton } from "./gold-button"
import { InputField } from "./input-field"
import { UserPlus } from "lucide-react"

interface RegisterScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  const handleSubmit = () => {
    alert("Dados salvos!")
    onNavigate("login")
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-20">
      <Header
        title="NOVO USUÁRIO"
        onBack={() => onNavigate("login")}
        rightIcon={<UserPlus className="w-5 h-5" />}
      />

      <div className="pt-4 flex-1 flex flex-col">
        <InputField label="Nome" type="text" />
        <InputField label="CPF" type="text" />
        <InputField label="Unidade" type="text" />
        <InputField label="E-mail" type="email" />
        <InputField label="Telefone" type="tel" />

        <div className="px-5 mt-auto pb-4">
          <GoldButton onClick={handleSubmit}>Salvar Dados</GoldButton>
        </div>
      </div>
    </div>
  )
}
