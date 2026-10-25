// Abas do paciente. O "label" é o que aparece no app E o que vai na coluna "Aba" do histórico da planilha.
// Para criar/mudar campos, é só editar esta lista.

export type FieldDef = {
  name: string
  label?: string // texto na tela (se for diferente do nome na planilha)
  readOnly?: boolean
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
  | { id: string; label: string; kind: "coracao" }
  | { id: string; label: string; kind: "anamnese" }
  | { id: string; label: string; kind: "alta" }

export const TABS: TabDef[] = [
  { id: "resumo", label: "Resumo", kind: "resumo" },
  { id: "anamnese", label: "Anamnese", kind: "anamnese" },
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
  { id: "coracao", label: "Teste do coraçãozinho", kind: "coracao" },
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
  { id: "vacinas", label: "Vacinas", kind: "vacinas" },
  {
    id: "intercorrencias",
    label: "Intercorrências",
    kind: "registro",
    fields: [
      { name: "Gravidade", input: "select", options: ["Leve", "Moderada", "Grave"] },
      { name: "Descrição", input: "textarea" },
    ],
  },
  {
    id: "conferencia",
    label: "Conferência",
    kind: "checklist",
    items: ["Peso confirmado", "Vacinas conferidas", "Procedimento correto", "Local correto", "Pulseira conferida com a mãe"],
  },
  { id: "diagnostico", label: "Diagnóstico", kind: "registro", fields: [{ name: "Diagnóstico", input: "textarea" }, { name: "CID" }] },
  { id: "gps", label: "GPS", kind: "gps" },
  { id: "alta", label: "Alta", kind: "alta" }, // só no celular
]

// campos da aba Dados que têm opções fixas
export const DADOS_OPTIONS: Record<string, string[]> = {
  Sexo: ["Feminino", "Masculino"],
}

// nomes prontos na aba Vacinas (dá para digitar outra)
export const VACINAS = ["BCG", "Hepatite B"]

// campos da aba Anamnese (ficam guardados junto com os Dados da pulseira, colunas A-B da planilha)
export const BIRTH_FIELD = "Data de nascimento" // "dd/MM/aaaa HH:mm"
export const ANAMNESE_FIELDS: FieldDef[] = [
  { name: "Tipo de parto", input: "select", options: ["Vaginal", "Cesárea", "Fórceps"] },
  { name: "Sexo", input: "select", options: ["Feminino", "Masculino"] },
  { name: "Peso ao nascer (g)", inputMode: "numeric", placeholder: "Ex: 3200" },
  { name: "Estatura (cm)", inputMode: "decimal", placeholder: "Ex: 49" },
  { name: "PC (cm)", inputMode: "decimal", placeholder: "Perímetro cefálico" },
  { name: "PT (cm)", inputMode: "decimal", placeholder: "Perímetro torácico" },
  { name: "IG (semanas)", inputMode: "numeric", placeholder: "Idade gestacional" },
  { name: "APGAR", placeholder: "Ex: 9/10" },
  { name: "DNV", inputMode: "numeric", placeholder: "Número da Declaração de Nascido Vivo" },
  { name: "Enfermeiro(a) responsável", placeholder: "Nome do(a) enfermeiro(a)" },
  { name: "Observações da anamnese", input: "textarea" },
]
export const ALTA_FIELDS = ["Alta", "Especialista da alta", "Observações da alta"]
// estes não aparecem na aba Dados (têm aba própria)
// Sexo e DNV aparecem nas duas abas (é o mesmo dado); o IMEI do rastreador fica na aba GPS
export const SHARED_WITH_DADOS = ["Sexo", "DNV"]
export const IMEI_FIELD = "GPS (IMEI)"
export const HIDDEN_IN_DADOS = [BIRTH_FIELD, ...ANAMNESE_FIELDS.map((f) => f.name).filter((n) => !SHARED_WITH_DADOS.includes(n)), ...ALTA_FIELDS, IMEI_FIELD]
// no Resumo, os campos da anamnese aparecem no bloco Anamnese (não repetir em cima)
export const HIDDEN_IN_RESUMO_TOP = [BIRTH_FIELD, ...ANAMNESE_FIELDS.map((f) => f.name), ...ALTA_FIELDS]
// campos básicos que sempre aparecem na aba Dados, nesta ordem
export const BASE_FIELDS = ["Nome da mãe", "Nome do bebê", "Enfermaria", "Leito", "Sexo", "DNV", "Telefone de emergência"]
// como cada campo aparece na aba Dados
export const DADOS_LABELS: Record<string, string> = { DNV: "Número da DNV" }
export const DADOS_READONLY = ["DNV"] // vem da Anamnese

export const NAME_FIELD = "Nome do bebê"
