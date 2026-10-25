import type { Fence, LatLng } from "./types"

// Mesmas contas do Codigo.gs (a planilha avalia e grava; o app usa para desenhar e mostrar).

export function distance(a: LatLng, b: LatLng) {
  const R = 6371000
  const r = Math.PI / 180
  const h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function inside(f: Fence, p: LatLng) {
  if (f.forma === "circulo") return distance(p, f.coords[0]) <= f.raio
  let c = false
  const pts = f.coords
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i]
    const [yj, xj] = pts[j]
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

export function center(f: Fence): LatLng {
  if (f.forma === "circulo") return f.coords[0]
  const n = f.coords.length || 1
  return [f.coords.reduce((s, c) => s + c[0], 0) / n, f.coords.reduce((s, c) => s + c[1], 0) / n]
}

export function appliesTo(f: Fence, nfc: string) {
  if (!f.ativa) return false
  const list = (f.pulseiras || "todas").toLowerCase()
  if (list === "todas") return true
  const key = (v: string) => v.replace(/[^0-9a-z]/gi, "").toUpperCase().replace(/^0+(?=.)/, "")
  return list.split(/[,; ]+/).map(key).includes(key(nfc))
}

// "-3.7310, -38.5290" por linha → pontos
export function parseCoords(text: string): LatLng[] {
  return text
    .split(/\n|;/)
    .map((line) => line.match(/(-?\d+(?:[.,]\d+)?)\s*[, \t]\s*(-?\d+(?:[.,]\d+)?)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [Number(m[1].replace(",", ".")), Number(m[2].replace(",", "."))] as LatLng)
    .filter(([a, o]) => Math.abs(a) <= 90 && Math.abs(o) <= 180)
}
