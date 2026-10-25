"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Fence, LatLng, Position } from "@/lib/types"
import { center } from "@/lib/geo"

type Props = {
  fences: Fence[]
  positions: Position[]
  focusNfc?: string
  draft?: { forma: "poligono" | "circulo"; coords: LatLng[]; raio: number } | null
  onPick?: (p: LatLng) => void
  className?: string
}

type L = typeof import("leaflet")

export function GpsMap({ fences, positions, focusNfc, draft, onPick, className }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<import("leaflet").Map | null>(null)
  const layer = useRef<import("leaflet").LayerGroup | null>(null)
  const lib = useRef<L | null>(null)
  const pickRef = useRef(onPick)
  const fitted = useRef(false)
  pickRef.current = onPick

  // cria o mapa uma vez
  useEffect(() => {
    let cancelled = false
    void import("leaflet").then((mod) => {
      const Lf = ((mod as unknown as { default?: L }).default || mod) as L
      if (cancelled || !box.current || map.current) return
      lib.current = Lf
      const m = Lf.map(box.current, { zoomControl: true, attributionControl: true }).setView([-3.7319, -38.5267], 15)
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m)
      m.on("click", (e: import("leaflet").LeafletMouseEvent) => pickRef.current?.([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]))
      layer.current = Lf.layerGroup().addTo(m)
      map.current = m
      draw()
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw() {
    const Lf = lib.current
    const m = map.current
    const g = layer.current
    if (!Lf || !m || !g) return
    g.clearLayers()
    const bounds: [number, number][] = []

    for (const f of fences) {
      if (!f.coords.length) continue
      const allowed = f.tipo !== "setor"
      const style = { color: allowed ? "#16a34a" : "#B8860B", weight: 2, fillOpacity: allowed ? 0.12 : 0.08, dashArray: allowed ? undefined : "6 6" }
      const shape = f.forma === "circulo" ? Lf.circle(f.coords[0], { ...style, radius: f.raio }) : Lf.polygon(f.coords, style)
      shape.bindTooltip(`${f.nome} (${allowed ? "área permitida" : "setor"})`).addTo(g)
      if (f.forma === "circulo") {
        const b = shape.getBounds()
        bounds.push([b.getNorth(), b.getEast()], [b.getSouth(), b.getWest()])
      } else bounds.push(...f.coords)
      Lf.marker(center(f), {
        icon: Lf.divIcon({ className: "", html: `<div style="font:600 11px sans-serif;color:${allowed ? "#15803d" : "#8a6508"};white-space:nowrap;transform:translate(-50%,-50%)">${escapeHtml(f.nome)}</div>` }),
        interactive: false,
      }).addTo(g)
    }

    if (draft && draft.coords.length) {
      const st = { color: "#7c3aed", weight: 2, dashArray: "4 4", fillOpacity: 0.1 }
      if (draft.forma === "circulo") {
        if (draft.raio > 0) Lf.circle(draft.coords[0], { ...st, radius: draft.raio }).addTo(g)
      } else if (draft.coords.length >= 2) Lf.polygon(draft.coords, st).addTo(g)
      draft.coords.forEach((c) => Lf.circleMarker(c, { radius: 5, color: "#7c3aed", fillOpacity: 1 }).addTo(g))
    }

    for (const p of positions) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
      const out = p.situacao === "FORA"
      const focus = p.nfc === focusNfc
      if (p.acc > 0) Lf.circle([p.lat, p.lng], { radius: p.acc, color: out ? "#dc2626" : "#2563eb", weight: 1, fillOpacity: 0.06 }).addTo(g)
      Lf.circleMarker([p.lat, p.lng], {
        radius: focus ? 10 : 7,
        color: "#fff",
        weight: 2,
        fillColor: out ? "#dc2626" : "#2563eb",
        fillOpacity: 1,
      })
        .bindTooltip(`${p.nfc}${out ? " – FORA" : ""}`, { permanent: focus, direction: "top", offset: [0, -8] })
        .addTo(g)
      if (focus) bounds.push([p.lat, p.lng])
    }

    if (!fitted.current && bounds.length) {
      m.fitBounds(bounds as import("leaflet").LatLngBoundsExpression, { padding: [30, 30], maxZoom: 18 })
      fitted.current = true
    }
  }

  useEffect(draw)

  // centraliza na pulseira quando ela muda
  useEffect(() => {
    const p = positions.find((x) => x.nfc === focusNfc)
    if (p && map.current && fitted.current) map.current.panTo([p.lat, p.lng])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNfc])

  return <div ref={box} className={className || "h-[320px] w-full rounded-[18px] overflow-hidden border-2 border-primary relative isolate z-0"} />
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}
