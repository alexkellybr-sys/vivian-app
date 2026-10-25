// Abas do paciente. O "label" é o que aparece no app E o que vai na coluna "Aba" do histórico da planilha.
// Para criar/mudar campos, é só editar esta lista.

export type FieldDef = {
  name: string
  input?: "text" | "textarea" | "select"
  options?: string[]
  inputMode?: "text" | "numeric" | "decimal" | "tel"
  placeholder?: string
}

export type TabDef =
  | { id: string; label: string; kind: "resumo" }
  | { id: string; label: string; kind: "dados" }
  | { id: string; label: string; kind: "registro"; fields: FieldDef[] }
  | { id: string; label: string; kind: "checklist"; items: string[] }
  | { id: string; label: string; kind: "gps" }
  | { id: string; label: string; kind: "vacinas" }

export const TABS: TabDef[] = [
  { id: "resumo", label: "Resumo", kind: "resumo" },
  { id: "dados", label: "Dados", kind: "dados" },
  {
    id: "sinais",
    label: "Sinais vitais",
    kind: "registro",
    fields: [
      { name: "Peso (g)", inputMode: "numeric" },
      { name: "Temperatura (°C)", inputMode: "decimal" },
      { name: "Freq. cardíaca (bpm)", inputMode: "numeric" },
      { name: "Freq. respiratória (irpm)", inputMode: "numeric" },
      { name: "Saturação O2 (%)", inputMode: "numeric" },
      { name: "Observação", input: "textarea" },
    ],
  },
  {
    id: "coracao",
    label: "Teste do coraçãozinho",
    kind: "registro",
    fields: [
      { name: "Horas de vida", inputMode: "numeric", placeholder: "ex.: 30" },
      { name: "SatO2 mão direita (%)", inputMode: "numeric" },
      { name: "SatO2 pé (%)", inputMode: "numeric" },
      { name: "Resultado", input: "select", options: ["Normal", "Repetir em 1 hora", "Alterado – encaminhar"] },
      { name: "Observação", input: "textarea" },
    ],
  },
  {
    id: "intercorrencias",
    label: "Intercorrências",
    kind: "registro",
    fields: [
      { name: "Gravidade", input: "select", options: ["Leve", "Moderada", "Grave"] },
      { name: "Descrição", input: "textarea" },
    ],
  },
  { id: "anamnese", label: "Anamnese", kind: "registro", fields: [{ name: "Anamnese", input: "textarea" }] },
  { id: "vacinas", label: "Vacinas", kind: "vacinas" },
  { id: "diagnostico", label: "Diagnóstico", kind: "registro", fields: [{ name: "Diagnóstico", input: "textarea" }, { name: "CID" }] },
  {
    id: "medicacoes",
    label: "Medicações",
    kind: "registro",
    fields: [
      { name: "Medicamento" },
      { name: "Dose" },
      { name: "Via", input: "select", options: ["Oral", "Intravenosa", "Intramuscular", "Subcutânea", "Tópica", "Inalatória"] },
      { name: "Horário", placeholder: "ex.: 14:00" },
    ],
  },
  {
    id: "conferencia",
    label: "Conferência",
    kind: "checklist",
    items: ["Peso confirmado", "Vacinas conferidas", "Procedimento correto", "Local correto", "Pulseira conferida com a mãe"],
  },
  { id: "gps", label: "GPS", kind: "gps" },
]

// campos da aba Dados que têm opções fixas
export const DADOS_OPTIONS: Record<string, string[]> = {
  Sexo: ["Feminino", "Masculino", "Indeterminado"],
}

// nomes prontos na aba Vacinas (dá para digitar outra)
export const VACINAS = ["BCG", "Hepatite B", "Vitamina K"]

export const NAME_FIELD = "Nome do bebê"
