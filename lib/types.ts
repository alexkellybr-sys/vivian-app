export type BraceletSummary = {
  nfc: string
  bebe: string
  mae: string
  leito: string
  gps: string
  atualizado: string
  situacao: string
  enfermaria?: string
  dnv?: string
  alta?: string // "dd/MM/aaaa HH:mm · Enf. Fulana" quando o celular deu alta
}

export type HistoryEntry = { data: string; aba: string; campo: string; valor: string; usuario: string }

export type Bracelet = {
  nfc: string
  campos: string[]
  dados: Record<string, string>
  historico: HistoryEntry[]
}

export type LatLng = [number, number]

export type Fence = {
  nome: string
  tipo: "permitida" | "setor"
  pulseiras: string // "todas" ou lista "11982, 30502"
  forma: "poligono" | "circulo"
  coords: LatLng[] // polígono: vértices; círculo: [centro]
  raio: number
  ativa: boolean
}

export type Position = {
  nfc: string
  lat: number
  lng: number
  acc: number
  fonte: string
  data: string
  situacao: string // "dentro" | "FORA" | "sem cerca"
  setor: string
  distancia: number
}

export type AgendaItem = {
  id: string
  nfc: string
  bebe: string
  vacina: string
  data: string // dd/MM/yyyy
  horario: string // HH:mm
  dias: number
  intervalo: number // horas entre as doses (0 = dose única)
  alarme: boolean
  aplicadas: string[] // "dd/MM/yyyy HH:mm" de cada dose aplicada (antigas: só dd/MM/yyyy)
  situacao: string // Programada | Concluída
  por: string
}

export type GpsState = { cercas: Fence[]; posicoes: Position[]; pulseiras: BraceletSummary[]; agenda: AgendaItem[] }
