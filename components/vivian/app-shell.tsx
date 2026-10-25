"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Home, Settings, User, Users } from "lucide-react"
import { api, cacheGet, cacheSet, getNurse, isLoggedIn } from "@/lib/client"
import { asset } from "@/lib/config"
import type { ScreenId } from "@/lib/screens"
import type { Bracelet, BraceletSummary } from "@/lib/types"
import { NAME_FIELD } from "@/lib/tabs"
import { AlertsScreen } from "./alerts-screen"
import { BraceletScreen } from "./bracelet-screen"
import { BraceletsScreen } from "./bracelets-screen"
import { GpsProvider, useGps } from "./gps-monitor"
import { HomeScreen } from "./home-screen"
import { Header } from "./header"
import { LoadingScreen } from "./loading-screen"
import { LoginScreen } from "./login-screen"
import { NewBraceletScreen } from "./new-bracelet-screen"
import { ProfileScreen } from "./profile-screen"
import { SplashScreen } from "./splash-screen"

const LOGGED_SCREENS: ScreenId[] = ["home", "list", "bracelet", "alerts", "profile", "new"]

export function AppShell({ painel = false }: { painel?: boolean }) {
  const [screen, setScreen] = useState<ScreenId>("splash")
  const [selected, setSelected] = useState<string | undefined>()
  const [tab, setTab] = useState("resumo")
  const [newNfc, setNewNfc] = useState("")
  const [list, setList] = useState<BraceletSummary[]>(() => cacheGet<BraceletSummary[]>("list") || [])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [wide, setWide] = useState(painel)
  const [ready, setReady] = useState(false)
  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  const [cameFromList, setCameFromList] = useState(false)

  const navigate = useCallback((s: ScreenId) => setScreen(s), [])
  const logged = LOGGED_SCREENS.includes(screen)
  const desktop = wide && logged

  // computador (tela larga) → painel com lista à esquerda e pulseira à direita
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const update = () => setWide(painel || mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [painel])

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const l = await api.list()
      setList(l)
      cacheSet("list", l)
      setListError(null)
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Erro ao carregar a planilha.")
    } finally {
      setListLoading(false)
    }
  }, [])

  const openBracelet = useCallback((nfc: string, tabId = "resumo") => {
    setCameFromList(false)
    setSelected(nfc)
    setTab(tabId)
    setScreen("bracelet")
  }, [])

  const notFound = useCallback((nfc: string) => {
    setNewNfc(nfc)
    setScreen("new")
  }, [])

  // início: link da etiqueta (?nfc=), painel (/painel) ou abertura normal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromTag = params.get("nfc")
    if (fromTag) window.history.replaceState(null, "", window.location.pathname)
    if (isLoggedIn()) {
      if (fromTag) {
        setScreen("home")
        // guarda antes: se a sessão tiver vencido, abre esta pulseira logo depois do login
        sessionStorage.setItem("vivian-pending-nfc", fromTag)
        api
          .get([fromTag])
          .then((b) => {
            sessionStorage.removeItem("vivian-pending-nfc")
            openBracelet(b.nfc)
          })
          .catch((e) => {
            if (e?.auth) return
            sessionStorage.removeItem("vivian-pending-nfc")
            if (e?.notFound) notFound(e.nfc || fromTag)
            else setListError(e.message)
          })
      } else if (painel) setScreen("list")
      else setScreen("home")
    } else if (fromTag || painel) {
      if (fromTag) sessionStorage.setItem("vivian-pending-nfc", fromTag)
      setScreen("login")
    }
    setReady(true)
  }, [openBracelet, notFound, painel])

  useEffect(() => {
    if (logged) void loadList()
  }, [logged, loadList])

  // tela "Carregando" depois do login
  useEffect(() => {
    if (screen !== "loading") return
    const t = setTimeout(() => {
      const pending = sessionStorage.getItem("vivian-pending-nfc")
      sessionStorage.removeItem("vivian-pending-nfc")
      setScreen(window.matchMedia("(min-width: 1024px)").matches || painel ? "list" : "home")
      if (pending)
        api
          .get([pending])
          .then((b) => openBracelet(b.nfc))
          .catch((e) => (e?.notFound ? notFound(e.nfc || pending) : setListError(e.message)))
    }, 1200)
    return () => clearTimeout(t)
  }, [screen, openBracelet, notFound, painel])

  const login = () => {
    setLoginNotice(null)
    setScreen("loading")
  }
  const logout = () => {
    void api.logout()
    setSelected(undefined)
    setScreen("login")
  }

  // sessão expirou / usuário desativado na planilha → volta para o login
  useEffect(() => {
    const onAuth = (e: Event) => {
      setLoginNotice((e as CustomEvent<string>).detail || "Sua sessão terminou. Entre de novo com seu PIN.")
      setScreen((s) => (LOGGED_SCREENS.includes(s) ? "login" : s))
    }
    window.addEventListener("vivian-auth", onAuth)
    return () => window.removeEventListener("vivian-auth", onAuth)
  }, [])

  // depois de salvar, atualiza a linha da lista sem esperar a planilha
  const onSaved = (b: Bracelet) =>
    setList((current) => {
      const row: BraceletSummary = { nfc: b.nfc, bebe: b.dados[NAME_FIELD] || "", mae: b.dados["Nome da mãe"] || "", leito: b.dados["Leito"] || "", gps: b.dados["GPS (IMEI)"] || "", atualizado: "", situacao: "" }
      const exists = current.some((x) => x.nfc === b.nfc)
      const next = exists ? current.map((x) => (x.nfc === b.nfc ? { ...x, ...row, atualizado: x.atualizado, situacao: x.situacao } : x)) : [...current, row]
      cacheSet("list", next)
      return next
    })

  if (!ready) return <div className="h-dvh bg-background" />

  const listScreen = (
    <BraceletsScreen list={list} loading={listLoading} error={listError} selected={selected} compact={desktop} onRefresh={loadList} onOpen={(n) => { setCameFromList(true); openBracelet(n) }} onNotFound={notFound} onNew={() => { setNewNfc(""); setScreen("new") }} />
  )
  const created = (b: Bracelet) => {
    onSaved(b)
    openBracelet(b.nfc)
  }
  const detail =
    screen === "bracelet" && selected ? (
      <BraceletScreen nfc={selected} tabId={tab} onTabChange={setTab} onSaved={onSaved} />
    ) : screen === "alerts" ? (
      <AlertsScreen onOpen={(n) => openBracelet(n, "gps")} />
    ) : screen === "profile" ? (
      <ProfileScreen onLogout={logout} />
    ) : screen === "new" ? (
      <NewBraceletScreen key={newNfc} initialNfc={newNfc} onCreated={created} />
    ) : null

  const titles: Partial<Record<ScreenId, string>> = { home: "VIVIAN", list: "PACIENTES", bracelet: "PACIENTE", alerts: "ALERTAS E SEGURANÇA", profile: "MEU PERFIL", new: "NOVA PULSEIRA" }

  return (
    <GpsProvider enabled={logged} onOpenBracelet={(n) => openBracelet(n, "gps")}>
      {desktop ? (
        // ───────── PAINEL DO COMPUTADOR ─────────
        <div className="h-dvh w-full bg-background flex flex-col">
          <DesktopBar screen={screen} onNavigate={navigate} />
          <div className="flex-1 grid grid-cols-[400px_1fr] min-h-0">
            <aside className="border-r-2 border-primary/30 overflow-y-auto pb-6">{listScreen}</aside>
            <main className="overflow-y-auto">
              {detail || <p className="p-10 text-center text-muted-foreground">Selecione uma pulseira na lista para ver as abas.</p>}
            </main>
          </div>
        </div>
      ) : (
        // ───────── CELULAR ─────────
        <div className="w-full max-w-[414px] h-dvh bg-background mx-auto relative overflow-hidden flex flex-col">
          {screen === "splash" && <SplashScreen onNavigate={navigate} />}
          {screen === "login" && <LoginScreen onLogin={login} notice={loginNotice} />}
          {screen === "loading" && <LoadingScreen />}
          {logged && (
            <>
              <Header
                title={titles[screen] || ""}
                onBack={screen !== "home" ? () => navigate(screen === "bracelet" && cameFromList ? "list" : "home") : undefined}
                rightIcon={screen === "home" || screen === "list" ? <AlarmBell onClick={() => navigate("alerts")} /> : undefined}
              />
              <div className="flex-1 overflow-y-auto pb-24">
                {screen === "home" ? (
                  <HomeScreen onOpen={(n) => openBracelet(n)} onNotFound={notFound} onPatients={() => navigate("list")} />
                ) : screen === "list" ? (
                  listScreen
                ) : (
                  detail
                )}
              </div>
              <BottomNav screen={screen} onNavigate={navigate} />
            </>
          )}
        </div>
      )}
    </GpsProvider>
  )
}

function AlarmBell({ onClick }: { onClick: () => void }) {
  const { alarms } = useGps()
  return (
    <button aria-label="Alertas" onClick={onClick} className="relative">
      <Bell className="w-5 h-5" />
      {alarms.length > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 grid place-items-center">{alarms.length}</span>}
    </button>
  )
}

function BottomNav({ screen, onNavigate }: { screen: ScreenId; onNavigate: (s: ScreenId) => void }) {
  const { alarms } = useGps()
  const item = (s: ScreenId, icon: React.ReactNode, label: string, badge = 0) => (
    <button aria-label={label} className={`relative flex flex-col items-center text-[10px] font-bold ${screen === s ? "text-foreground" : "text-foreground/55"}`} onClick={() => onNavigate(s)}>
      {icon}
      {label}
      {badge > 0 && <span className="absolute -top-1 right-0 bg-red-600 text-white rounded-full w-4 h-4 grid place-items-center">{badge}</span>}
    </button>
  )
  return (
    <nav className="absolute bottom-0 w-full h-[70px] bg-gradient-to-br from-accent via-[#F9E498] to-primary flex justify-around items-center rounded-t-[20px] z-50">
      {item("home", <Home className="w-6 h-6" />, "Início")}
      {item("list", <Users className="w-6 h-6" />, "Pacientes")}
      {item("alerts", <Bell className="w-6 h-6" />, "Alertas", alarms.length)}
      {item("profile", <Settings className="w-6 h-6" />, "Perfil")}
    </nav>
  )
}

function DesktopBar({ screen, onNavigate }: { screen: ScreenId; onNavigate: (s: ScreenId) => void }) {
  const { alarms, soundReady, enableSound } = useGps()
  const btn = (s: ScreenId, label: string, icon: React.ReactNode, badge = 0) => (
    <button onClick={() => onNavigate(s)} className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${screen === s ? "bg-white/70" : "hover:bg-white/40"}`}>
      {icon}
      {label}
      {badge > 0 && <span className="bg-red-600 text-white rounded-full px-2 text-xs">{badge}</span>}
    </button>
  )
  return (
    <header className="bg-gradient-to-br from-accent via-[#F9E498] to-primary px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 font-bold text-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/images/vivian-splash.jpg")} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" /> VIVIAN · Painel de pulseiras
      </div>
      <div className="flex items-center gap-2">
        {!soundReady && (
          <button onClick={enableSound} className="rounded-full bg-white px-4 py-2 text-sm font-bold">🔊 Ativar som do alarme</button>
        )}
        {btn("alerts", "Alertas", <Bell className="w-4 h-4" />, alarms.length)}
        {btn("profile", getNurse() || "Perfil", <User className="w-4 h-4" />)}
      </div>
    </header>
  )
}
