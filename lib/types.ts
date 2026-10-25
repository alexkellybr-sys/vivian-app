export type BraceletSummary = {
  nfc: string
  bebe: string
  mae: string
  leito: string
  gps: string
  atualizado: string
  situacao: string
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

export type GpsState = { cercas: Fence[]; posicoes: Position[]; pulseiras: BraceletSummary[] }
