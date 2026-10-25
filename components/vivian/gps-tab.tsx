"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { Crosshair, MapPinned, Plus, Smartphone, Trash2, X } from "lucide-react"
import { api } from "@/lib/client"
import { appliesTo, parseCoords } from "@/lib/geo"
import type { LatLng } from "@/lib/types"
import { useGps } from "./gps-monitor"
import { GoldButton } from "./gold-button"

const GpsMap = dynamic(() => import("./gps-map").then((m) => m.GpsMap), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full rounded-[18px] border-2 border-primary bg-white/50 grid place-items-center text-sm">Carregando mapa…</div>,
})

type Draft = { nome: string; tipo: "permitida" | "setor"; forma: "poligono" | "circulo"; coords: LatLng[]; raio: number; soEsta: boolean; texto: string; modo: "mapa" | "texto" }
const emptyDraft = (): Draft => ({ nome: "", tipo: "permitida", forma: "poligono", coords: [], raio: 50, soEsta: false, texto: "", modo: "mapa" })

export function GpsTab({ nfc, imei }: { nfc: string; imei: string }) {
  const { state, refresh, trend, rastreador, error } = useGps()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const watchId = useRef<number | null>(null)
  const lastSent = useRef(0)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)

  const fences = useMemo(() => (state?.cercas || []).filter((f) => appliesTo(f, nfc)), [state, nfc])
  const pos = state?.posicoes.find((p) => p.nfc === nfc || p.nfc.replace(/^0+/, "") === nfc.replace(/^0+/, ""))

  const send = async (lat: number, lng: number, acc: number, fonte: string) => {
    try {
      await api.sendPosition({ nfc, lat, lng, acc, fonte })
      await refresh()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erro ao enviar posição." })
    }
  }

  // ── celular como rastreador ──
  const stopTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    void wakeLock.current?.release().catch(() => {})
    wakeLock.current = null
    setTracking(false)
  }
  useEffect(() => stopTracking, [])

  const startTracking = () => {
    if (!("geolocation" in navigator)) return setMsg({ ok: false, text: "Este aparelho não tem GPS disponível no navegador." })
    setTracking(true)
    setMsg({ ok: true, text: "Usando o GPS deste celular. Mantenha esta tela aberta." })
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request("screen").then((l) => (wakeLock.current = l)).catch(() => {})
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastSent.current < 10000) return
        lastSent.current = Date.now()
        void send(p.coords.latitude, p.coords.longitude, p.coords.accuracy, "celular")
      },
      (err) => {
        stopTracking()
        setMsg({ ok: false, text: err.code === 1 ? "Permissão de localização negada. Libere a localização para este site." : "Não foi possível obter a localização." })
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    )
  }

  // ── clique no mapa ──
  const onPick = (p: LatLng) => {
    if (draft && draft.modo === "mapa") {
      setDraft({ ...draft, coords: draft.forma === "circulo" ? [p] : [...draft.coords, p] })
      return
    }
    if (testMode) void send(p[0], p[1], 0, "simulação")
  }

  const draftCoords = draft ? (draft.modo === "texto" ? parseCoords(draft.texto).slice(0, draft.forma === "circulo" ? 1 : 200) : draft.coords) : []

  const saveFence = async () => {
    if (!draft) return
    const coords = draftCoords
    if (!draft.nome.trim()) return setMsg({ ok: false, text: "Dê um nome para a cerca (ex.: Maternidade)." })
    if (draft.forma === "poligono" && coords.length < 3) return setMsg({ ok: false, text: "Marque pelo menos 3 pontos." })
    if (draft.forma === "circulo" && (!coords.length || !(draft.raio > 0))) return setMsg({ ok: false, text: "Marque o centro e informe o raio." })
    setBusy(true)
    try {
      await api.saveFence({ nome: draft.nome.trim(), tipo: draft.tipo, forma: draft.forma, coords, raio: draft.raio, pulseiras: draft.soEsta ? nfc : "todas", ativa: true })
      await refresh()
      setDraft(null)
      setMsg({ ok: true, text: "Cerca salva na planilha ✔" })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erro ao salvar a cerca." })
    } finally {
      setBusy(false)
    }
  }

  const removeFence = async (nome: string) => {
    if (!window.confirm(`Apagar a cerca "${nome}"?`)) return
    setBusy(true)
    try {
      await api.saveFence({ nome, apagar: true })
      await refresh()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erro ao apagar." })
    } finally {
      setBusy(false)
    }
  }

  const useMyLocationAsCenter = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => draft && setDraft({ ...draft, modo: "mapa", coords: draft.forma === "circulo" ? [[+p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6)]] : [...draft.coords, [+p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6)]] }),
      () => setMsg({ ok: false, text: "Não foi possível obter a localização." }),
      { enableHighAccuracy: true, timeout: 20000 },
    )

  const out = pos?.situacao === "FORA"
  const input = "w-full p-2.5 rounded-[12px] border border-primary bg-white outline-none text-base"

  return (
    <div className="space-y-3">
      {/* situação */}
      <div className={`rounded-[18px] p-4 border-2 ${out ? "bg-red-50 border-red-500" : "bg-card border-primary"}`}>
        {!pos ? (
          <p className="text-sm">Sem posição para esta pulseira ainda. Use o rastreador, o celular ou o modo teste abaixo.</p>
        ) : (
          <>
            <p className={`font-bold ${out ? "text-red-700" : "text-green-700"}`}>
              {out ? "⚠️ FORA DA ÁREA" : pos.situacao === "dentro" ? "✔ Dentro da área" : "Sem cerca definida"}
            </p>
            {out && (
              <p className="text-sm mt-1">
                Setor: <b>{pos.setor}</b> · <b>{pos.distancia} m</b> da cerca
                {trend[pos.nfc] && trend[pos.nfc] !== "parado" ? ` · ${trend[pos.nfc]}` : ""}
              </p>
            )}
            {!out && pos.setor && <p className="text-sm mt-1">Setor: {pos.setor}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} · {pos.data} · fonte: {pos.fonte || "—"}
              {pos.acc ? ` · precisão ±${pos.acc} m` : ""}
            </p>
          </>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      <GpsMap fences={fences} positions={pos ? [pos] : []} focusNfc={nfc} draft={draft ? { forma: draft.forma, coords: draftCoords, raio: draft.raio } : null} onPick={onPick} />
      <p className="text-[11px] text-muted-foreground -mt-1">
        Verde = área permitida · tracejado dourado = setor de referência · ponto azul/vermelho = pulseira
      </p>

      {/* fonte da posição */}
      <div className="bg-card rounded-[18px] border-2 border-primary p-4 space-y-3">
        <h4 className="font-bold text-sm uppercase">Posição da pulseira</h4>
        <p className="text-xs">
          <b>Rastreador:</b> {imei ? `IMEI ${imei}` : "nenhum ligado (preencha “GPS (IMEI)” na aba Dados)"} ·{" "}
          {rastreador ? "servidor de rastreamento conectado" : "servidor de rastreamento não configurado"}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="w-5 h-5 accent-primary" checked={tracking} onChange={(e) => (e.target.checked ? startTracking() : stopTracking())} />
          <Smartphone className="w-4 h-4" /> Usar o GPS deste celular como rastreador
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="w-5 h-5 accent-primary" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} disabled={!!draft} />
          <Crosshair className="w-4 h-4" /> Modo teste: tocar no mapa move a pulseira
        </label>
      </div>

      {/* cercas */}
      <div className="bg-card rounded-[18px] border-2 border-primary p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm uppercase">Cercas</h4>
          {!draft && (
            <button className="text-sm font-bold flex items-center gap-1" onClick={() => { setTestMode(false); setDraft(emptyDraft()) }}>
              <Plus className="w-4 h-4" /> Nova cerca
            </button>
          )}
        </div>
        {fences.length === 0 && !draft && <p className="text-sm">Nenhuma cerca para esta pulseira.</p>}
        {fences.map((f) => (
          <div key={f.nome} className="flex items-center justify-between bg-white rounded-[12px] px-3 py-2 text-sm">
            <span>
              <MapPinned className={`w-4 h-4 inline mr-1 ${f.tipo === "setor" ? "text-primary" : "text-green-600"}`} />
              <b>{f.nome}</b> · {f.tipo === "setor" ? "setor" : "área permitida"} · {f.forma === "circulo" ? `círculo ${f.raio} m` : `${f.coords.length} pontos`}
              {f.pulseiras !== "todas" && " · só esta pulseira"}
            </span>
            <button aria-label={`Apagar cerca ${f.nome}`} onClick={() => removeFence(f.nome)} disabled={busy}>
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        ))}

        {draft && (
          <div className="bg-white rounded-[14px] p-3 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <b>Nova cerca</b>
              <button aria-label="Cancelar nova cerca" onClick={() => setDraft(null)}><X className="w-4 h-4" /></button>
            </div>
            <input className={input} placeholder="Nome (ex.: Maternidade)" value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Tipo de cerca" className={input} value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value as Draft["tipo"] })}>
                <option value="permitida">Área permitida (alarme ao sair)</option>
                <option value="setor">Setor de referência (só nome)</option>
              </select>
              <select aria-label="Forma da cerca" className={input} value={draft.forma} onChange={(e) => setDraft({ ...draft, forma: e.target.value as Draft["forma"], coords: [] })}>
                <option value="poligono">Polígono (pontos)</option>
                <option value="circulo">Círculo (centro + raio)</option>
              </select>
            </div>
            <div className="flex gap-2">
              {(["mapa", "texto"] as const).map((m) => (
                <button key={m} className={`flex-1 rounded-full py-1.5 border ${draft.modo === m ? "bg-primary text-white border-primary" : "border-primary"}`} onClick={() => setDraft({ ...draft, modo: m })}>
                  {m === "mapa" ? "Tocar no mapa" : "Digitar coordenadas"}
                </button>
              ))}
            </div>
            {draft.modo === "mapa" ? (
              <p className="text-xs">
                {draft.forma === "circulo" ? "Toque no mapa no CENTRO da área." : `Toque no mapa em cada canto da área (${draft.coords.length} pontos).`}{" "}
                {draft.coords.length > 0 && draft.forma === "poligono" && (
                  <button className="underline" onClick={() => setDraft({ ...draft, coords: draft.coords.slice(0, -1) })}>desfazer último</button>
                )}{" "}
                <button className="underline" onClick={useMyLocationAsCenter}>usar minha localização</button>
              </p>
            ) : (
              <textarea
                className={input}
                rows={4}
                placeholder={draft.forma === "circulo" ? "-3.73100, -38.52900" : "-3.73000, -38.53000\n-3.73000, -38.52800\n-3.73200, -38.52800\n-3.73200, -38.53000"}
                value={draft.texto}
                onChange={(e) => setDraft({ ...draft, texto: e.target.value })}
              />
            )}
            {draft.forma === "circulo" && (
              <label className="flex items-center gap-2">
                Raio (m)
                <input className={input + " max-w-[110px]"} inputMode="numeric" value={draft.raio || ""} onChange={(e) => setDraft({ ...draft, raio: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </label>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 accent-primary" checked={draft.soEsta} onChange={(e) => setDraft({ ...draft, soEsta: e.target.checked })} />
              Só para esta pulseira (senão vale para todas)
            </label>
            <GoldButton onClick={saveFence} disabled={busy} className="mt-1 py-3">{busy ? "SALVANDO..." : "SALVAR CERCA"}</GoldButton>
          </div>
        )}
      </div>

      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  )
}
