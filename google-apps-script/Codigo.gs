/**
 * VIVIAN v3 – a planilha É o servidor do app (Google Apps Script)
 *
 * O app (site no GitHub Pages) fala direto com este script. Ninguém entra sem PIN:
 *  • "Usuários"   – Nome | PIN | Ativo | Último acesso   (cadastre aqui as enfermeiras)
 *  • "Pulseiras"  – índice: NFC | Bebê | Mãe | Leito | GPS | Última atualização | Abrir aba (link)
 *  • "<NFC>"      – uma aba por pulseira: DADOS (A-B) e HISTÓRICO (D-H)
 *  • "Cercas", "Posições" – GPS
 * A primeira aba antiga (coluna A = NFC) é usada só para importar as pulseiras na 1ª vez.
 *
 * Instalação: Extensões → Apps Script → apague tudo → cole → Salvar
 *   Implantar → Nova implantação → App da Web → Executar como: Eu → Quem pode acessar: Qualquer pessoa
 *
 * Rastreador GPS (opcional, ex.: GF-07 enviando para um servidor Traccar):
 *   preencha TRACCAR_URL e TRACCAR_TOKEN abaixo, salve e rode a função "ativarRastreador" uma vez.
 */

const TRACCAR_URL = ""   // ex.: "https://demo.traccar.org"
const TRACCAR_TOKEN = "" // token da conta no Traccar (Configurações da conta → Token)
const SESSION_MINUTES = 60 // sai sozinho depois de 60 min sem uso

const INDEX = "Pulseiras"
const FENCES = "Cercas"
const POSITIONS = "Posições"
const HIST_COL = 4 // coluna D
const FIRST_ROW = 3 // linhas 1-2 = título e cabeçalhos
const DEFAULT_FIELDS = ["Nome do bebê", "Nome da mãe", "Leito", "Data de nascimento", "Sexo", "Telefone de emergência", "GPS (IMEI)"]
const INDEX_HEADERS = ["NFC", "Bebê", "Mãe", "Leito", "GPS", "Última atualização", "Abrir aba"]
const FENCE_HEADERS = ["Nome", "Tipo", "Pulseiras", "Forma", "Coordenadas", "Raio (m)", "Ativa", "Atualizado"]
const POS_HEADERS = ["NFC", "Latitude", "Longitude", "Precisão (m)", "Fonte", "Data/hora", "Situação", "Setor", "Distância (m)"]

// ───────────────────────── utilidades ─────────────────────────
function ss_() { return SpreadsheetApp.getActiveSpreadsheet() }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON) }
function now_() { return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm:ss") }
function str_(v) { return v instanceof Date ? Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm") : String(v == null ? "" : v).trim() }
function safe_(v) { const s = String(v == null ? "" : v); return /^[=+@]/.test(s) ? "'" + s : s }
function key_(v) {
  return String(v == null ? "" : v).replace(/^\s*(ntag\s*)?find\s*key\s*[:=]?\s*/i, "").replace(/[^0-9a-z]/gi, "").toUpperCase().replace(/^0+(?=.)/, "")
}
function rows_(sheet, firstRow, col, numCols) {
  const last = sheet.getLastRow()
  if (last < firstRow) return []
  return sheet.getRange(firstRow, col, last - firstRow + 1, numCols).getValues().map(function (r) { return r.map(str_) })
}
function header_(sheet, title, headers) {
  sheet.getRange(1, 1).setValue(title).setFontWeight("bold").setFontSize(13)
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#F9E498")
  sheet.setFrozenRows(2)
}

// ───────────────────────── estrutura ─────────────────────────
function ensureSetup_() {
  const ss = ss_()
  if (ss.getSheetByName(INDEX)) return
  const index = ss.insertSheet(INDEX, 0)
  header_(index, "VIVIAN – Pulseiras (clique em 'Abrir ▶' para ver a aba da pulseira)", INDEX_HEADERS)
  const fences = ss.getSheetByName(FENCES) || ss.insertSheet(FENCES)
  header_(fences, "VIVIAN – Cercas do GPS", FENCE_HEADERS)
  const pos = ss.getSheetByName(POSITIONS) || ss.insertSheet(POSITIONS)
  header_(pos, "VIVIAN – Última posição de cada pulseira", POS_HEADERS)
  ensureUsers_()

  // importa as pulseiras da aba antiga (coluna A = NFC; nome na célula depois de "nome")
  const old = ss.getSheets().filter(function (s) { return [INDEX, FENCES, POSITIONS, USERS].indexOf(s.getName()) < 0 })[0]
  if (old && old.getLastRow() >= 1) {
    const data = old.getRange(1, 1, old.getLastRow(), Math.max(old.getLastColumn(), 1)).getValues().map(function (r) { return r.map(str_) })
    data.forEach(function (row) {
      const nfc = row[0]
      if (!key_(nfc) || /find\s*key|ntag/i.test(nfc)) return
      let name = ""
      for (let i = 1; i < row.length; i++) {
        const inline = row[i].match(/^\s*nome\s*[:=]\s*(.+)$/i)
        if (inline) { name = inline[1].trim(); break }
        if (/^\s*nome\s*[:=]?\s*$/i.test(row[i])) { name = row.slice(i + 1).filter(String)[0] || ""; break }
      }
      createBracelet_(nfc, name ? { "Nome do bebê": name } : {}, "importação")
    })
  }
}

// ───────────────────────── usuários e sessões ─────────────────────────
const USERS = "Usuários"
function ensureUsers_() {
  const ss = ss_()
  if (ss.getSheetByName(USERS)) return
  const u = ss.insertSheet(USERS)
  header_(u, "VIVIAN – Usuários (PIN de 4 a 8 números). Ativo = sim/não", ["Nome", "PIN", "Ativo", "Último acesso"])
  u.getRange(1, 2, 1000, 1).setNumberFormat("@")
  const pin = String(Math.floor(100000 + Math.random() * 900000))
  u.getRange(FIRST_ROW, 1, 1, 3).setValues([["Administrador", pin, "sim"]])
}
function users_() {
  ensureUsers_()
  return rows_(ss_().getSheetByName(USERS), FIRST_ROW, 1, 3).map(function (r, i) { return { nome: r[0], pin: r[1], ativo: r[2].toLowerCase() !== "não" && r[2].toLowerCase() !== "nao", row: i + FIRST_ROW } })
    .filter(function (u) { return u.nome && u.pin })
}
function login_(nome, pin) {
  const cache = CacheService.getScriptCache()
  const fk = "f_" + String(nome).trim().toLowerCase()
  const fails = Number(cache.get(fk) || 0)
  if (fails >= 5) return { ok: false, error: "Muitas tentativas erradas. Aguarde 10 minutos." }
  const u = users_().filter(function (x) { return x.nome.trim().toLowerCase() === String(nome).trim().toLowerCase() })[0]
  if (!u || !u.ativo || u.pin !== String(pin).trim()) {
    cache.put(fk, String(fails + 1), 600)
    return { ok: false, error: "Usuário ou PIN incorreto." }
  }
  cache.remove(fk)
  const props = PropertiesService.getScriptProperties()
  const now = Date.now()
  const all = props.getProperties()
  Object.keys(all).forEach(function (k) { if (k.indexOf("s_") === 0) { try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k) } catch (e) { props.deleteProperty(k) } } })
  // um aparelho por usuário: a sessão anterior desta pessoa é encerrada
  Object.keys(all).forEach(function (k) {
    if (k.indexOf("s_") !== 0) return
    try { const o = JSON.parse(all[k]); if (o.u === u.nome && !o.kicked) props.setProperty(k, JSON.stringify({ u: o.u, exp: now + 6 * 3600000, kicked: true })) } catch (e) {}
  })
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "")
  props.setProperty("s_" + token, JSON.stringify({ u: u.nome, exp: now + SESSION_MINUTES * 60000 }))
  ss_().getSheetByName(USERS).getRange(u.row, 4).setValue(now_())
  return { ok: true, sessao: token, usuario: u.nome }
}
let AUTH_REASON = ""
function session_(token, renew) {
  AUTH_REASON = "Sessão expirada. Entre de novo."
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return null
  const props = PropertiesService.getScriptProperties()
  const raw = props.getProperty("s_" + token)
  if (!raw) return null
  const s = JSON.parse(raw)
  if (s.kicked) { AUTH_REASON = "Você entrou com este usuário em outro aparelho. Aqui a sessão foi encerrada."; return null }
  const now = Date.now()
  if (s.exp < now) { AUTH_REASON = "Saiu sozinho depois de 1 hora sem uso. Entre de novo."; return null }
  const u = users_().filter(function (x) { return x.nome === s.u })[0]
  if (!u || !u.ativo) { AUTH_REASON = "Usuário desativado na planilha."; return null } // desativar corta o acesso na hora
  // uso real (não a consulta automática do GPS) renova os 60 min; grava no máximo a cada 5 min
  if (renew !== false && s.exp - now < (SESSION_MINUTES - 5) * 60000) props.setProperty("s_" + token, JSON.stringify({ u: s.u, exp: now + SESSION_MINUTES * 60000 }))
  return s.u
}
function logout_(token) { if (token) PropertiesService.getScriptProperties().deleteProperty("s_" + token) }

// ───────────────────────── rastreador (Traccar) ─────────────────────────
function ativarRastreador() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "sincronizarRastreador") ScriptApp.deleteTrigger(t) })
  ScriptApp.newTrigger("sincronizarRastreador").timeBased().everyMinutes(1).create()
  sincronizarRastreador()
}
function sincronizarRastreador() {
  if (!TRACCAR_URL || !TRACCAR_TOKEN) return 0
  ensureSetup_()
  const linked = list_().filter(function (p) { return p.gps })
  if (!linked.length) return 0
  const base = TRACCAR_URL.replace(/\/$/, "")
  const opt = { headers: { Authorization: "Bearer " + TRACCAR_TOKEN }, muteHttpExceptions: true }
  const devices = JSON.parse(UrlFetchApp.fetch(base + "/api/devices", opt).getContentText() || "[]")
  const positions = JSON.parse(UrlFetchApp.fetch(base + "/api/positions", opt).getContentText() || "[]")
  const props = PropertiesService.getScriptProperties()
  let sent = 0
  linked.forEach(function (p) {
    const d = devices.filter(function (x) { return String(x.uniqueId).trim() === String(p.gps).trim() })[0]
    const pos = d && positions.filter(function (x) { return x.deviceId === d.id })[0]
    if (!pos || !pos.valid || (pos.latitude === 0 && pos.longitude === 0)) return
    if (props.getProperty("t_" + p.nfc) === pos.fixTime) return
    savePosition_({ nfc: p.nfc, lat: pos.latitude, lng: pos.longitude, acc: pos.accuracy || 0, fonte: "rastreador " + (d.name || p.gps) }, "rastreador")
    props.setProperty("t_" + p.nfc, pos.fixTime)
    sent++
  })
  return sent
}

// link "Abrir ▶" para a aba da pulseira (link comum: funciona em qualquer idioma da planilha)
function setLink_(cell, sheet) {
  cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText("Abrir ▶").setLinkUrl("#gid=" + sheet.getSheetId()).build())
}
function repararLinks_() {
  const index = ss_().getSheetByName(INDEX)
  rows_(index, FIRST_ROW, 1, 1).forEach(function (r, i) {
    const b = r[0] && braceletSheet_(r[0])
    if (b) setLink_(index.getRange(FIRST_ROW + i, 7), b)
  })
}

function braceletSheet_(nfc) {
  const k = key_(nfc)
  const sheets = ss_().getSheets()
  for (let i = 0; i < sheets.length; i++) if (key_(sheets[i].getName()) === k && /^[0-9a-z:\- ]+$/i.test(sheets[i].getName())) return sheets[i]
  return null
}

function indexRow_(nfc) {
  const index = ss_().getSheetByName(INDEX)
  const keys = rows_(index, FIRST_ROW, 1, 1)
  for (let i = 0; i < keys.length; i++) if (key_(keys[i][0]) === key_(nfc)) return i + FIRST_ROW
  return -1
}

function createBracelet_(nfc, dados, user) {
  const name = String(nfc).trim().replace(/^0+(?=.)/, "")
  let sheet = braceletSheet_(name)
  if (!sheet) {
    sheet = ss_().insertSheet(name)
    sheet.getRange(1, 1).setValue("PULSEIRA " + name).setFontWeight("bold").setFontSize(14)
    sheet.getRange(2, 1, 1, 2).setValues([["DADOS", "Valor"]]).setFontWeight("bold").setBackground("#F9E498")
    sheet.getRange(2, HIST_COL, 1, 5).setValues([["Data/hora", "Aba", "Campo", "Valor", "Usuário"]]).setFontWeight("bold").setBackground("#E6D5F7")
    sheet.getRange(1, HIST_COL).setValue("HISTÓRICO").setFontWeight("bold")
    sheet.getRange(FIRST_ROW, 1, DEFAULT_FIELDS.length, 2).setValues(DEFAULT_FIELDS.map(function (f) { return [f, ""] }))
    sheet.getRange(1, 2, 1000, 1).setNumberFormat("@")
    sheet.getRange(1, HIST_COL + 3, 1000, 1).setNumberFormat("@")
    sheet.setFrozenRows(2)
    sheet.setColumnWidth(1, 170); sheet.setColumnWidth(2, 220); sheet.setColumnWidth(3, 30)
    sheet.setColumnWidth(HIST_COL, 140); sheet.setColumnWidth(HIST_COL + 3, 260)
  }
  if (indexRow_(name) < 0) {
    const index = ss_().getSheetByName(INDEX)
    const row = Math.max(index.getLastRow() + 1, FIRST_ROW)
    index.getRange(row, 1, 1, 6).setValues([[name, "", "", "", "", now_()]])
    setLink_(index.getRange(row, 7), sheet)
  }
  if (dados && Object.keys(dados).length) saveDados_(sheet, name, dados, user || "")
  return sheet
}

// ───────────────────────── leitura ─────────────────────────
function readBracelet_(sheet) {
  const dadosRows = rows_(sheet, FIRST_ROW, 1, 2).filter(function (r) { return r[0] })
  const dados = {}
  dadosRows.forEach(function (r) { dados[r[0]] = r[1] })
  const hist = rows_(sheet, FIRST_ROW, HIST_COL, 5).filter(function (r) { return r[0] || r[2] })
    .map(function (r) { return { data: r[0], aba: r[1], campo: r[2], valor: r[3], usuario: r[4] } })
  return { nfc: sheet.getName(), campos: dadosRows.map(function (r) { return r[0] }), dados: dados, historico: hist.slice(-1500).reverse() }
}

function list_() {
  const index = ss_().getSheetByName(INDEX)
  const positions = {}
  rows_(ss_().getSheetByName(POSITIONS), FIRST_ROW, 1, POS_HEADERS.length).forEach(function (r) { positions[key_(r[0])] = r })
  return rows_(index, FIRST_ROW, 1, 6).filter(function (r) { return r[0] }).map(function (r) {
    const p = positions[key_(r[0])]
    return { nfc: r[0], bebe: r[1], mae: r[2], leito: r[3], gps: r[4], atualizado: r[5], situacao: p ? p[6] : "" }
  })
}

// ───────────────────────── gravação ─────────────────────────
function appendHistory_(sheet, entries) {
  if (!entries.length) return
  const hist = rows_(sheet, FIRST_ROW, HIST_COL, 1)
  let row = FIRST_ROW
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i][0]) { row = FIRST_ROW + i + 1; break }
  sheet.getRange(row, HIST_COL, entries.length, 5).setValues(entries.map(function (e) { return e.map(safe_) }))
  rebuildSummary_(sheet)
}

// ───────────────────────── resumo por dia (colunas J-P) ─────────────────────────
const SUM_COL = 10 // coluna J
const SUM_HEADERS = ["Dia", "Data", "Enfermeiras por turno", "Sinais vitais", "Intercorrências", "Medicações", "Outros registros"]
const SHORT = { "Peso (g)": "Peso", "Temperatura (°C)": "Temp", "Freq. cardíaca (bpm)": "FC", "Freq. respiratória (irpm)": "FR", "Saturação O2 (%)": "Sat" }
function turno_(hhmm) { const h = Number(String(hhmm).slice(0, 2)); return h >= 7 && h < 13 ? "Manhã" : h >= 13 && h < 19 ? "Tarde" : "Noite" }
function dayKey_(stamp) { const m = String(stamp).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : "" }
function hhmm_(stamp) { const m = String(stamp).match(/(\d{1,2}):(\d{2})/); return m ? ("0" + m[1]).slice(-2) + ":" + m[2] : "" }
function dayNumber_(day, first, birth) {
  const ref = birth || first
  if (!ref) return ""
  return Math.round((new Date(day + "T12:00:00") - new Date(ref + "T12:00:00")) / 86400000) + 1
}
function rebuildSummary_(sheet) {
  const hist = rows_(sheet, FIRST_ROW, HIST_COL, 5).filter(function (r) { return r[0] && r[2] })
  const dados = {}
  rows_(sheet, FIRST_ROW, 1, 2).forEach(function (r) { if (r[0]) dados[r[0]] = r[1] })
  const birth = dayKey_(dados["Data de nascimento"] || "")
  const days = {}, order = []
  hist.forEach(function (r) {
    const d = dayKey_(r[0])
    if (!d) return
    if (!days[d]) { days[d] = { turnos: {}, sinais: {}, inter: {}, med: {}, outros: {} }; order.push(d) }
    const day = days[d], t = hhmm_(r[0]), key = t + " " + r[1]
    if (r[4] && r[4] !== "importação") { day.turnos[turno_(t)] = day.turnos[turno_(t)] || []; if (day.turnos[turno_(t)].indexOf(r[4]) < 0) day.turnos[turno_(t)].push(r[4]) }
    if (r[1] === "Sinais vitais" && SHORT[r[2]]) { (day.sinais[SHORT[r[2]]] = day.sinais[SHORT[r[2]]] || []).push(r[3]) }
    else if (r[1] === "Intercorrências") { (day.inter[key] = day.inter[key] || []).push(r[2] === "Gravidade" ? r[3].toUpperCase() : r[3]) }
    else if (r[1] === "Medicações") { (day.med[key] = day.med[key] || []).push(r[3]) }
    else { (day.outros[key] = day.outros[key] || []).push(r[2] + ": " + r[3]) }
  })
  order.sort()
  const join = function (obj, sep) { return Object.keys(obj).map(function (k) { return k + " – " + obj[k].join(sep) }).join("\n") }
  const out = order.map(function (d) {
    const x = days[d]
    return [
      dayNumber_(d, order[0], birth), d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4),
      ["Manhã", "Tarde", "Noite"].filter(function (t) { return x.turnos[t] }).map(function (t) { return t + ": " + x.turnos[t].join(", ") }).join("\n"),
      Object.keys(x.sinais).map(function (k) { return k + " " + x.sinais[k].slice(-4).join(" → ") }).join("\n"),
      join(x.inter, " · "), join(x.med, " "), join(x.outros, " · ").slice(0, 1500),
    ].map(safe_)
  })
  const last = Math.max(sheet.getLastRow(), FIRST_ROW)
  sheet.getRange(1, SUM_COL, last, SUM_HEADERS.length).clearContent()
  sheet.getRange(1, SUM_COL).setValue("RESUMO POR DIA (atualiza sozinho)").setFontWeight("bold")
  sheet.getRange(2, SUM_COL, 1, SUM_HEADERS.length).setValues([SUM_HEADERS]).setFontWeight("bold").setBackground("#D9EAD3")
  sheet.setColumnWidth(SUM_COL, 40); sheet.setColumnWidth(SUM_COL + 1, 85); sheet.setColumnWidths(SUM_COL + 2, 5, 230)
  if (out.length) sheet.getRange(FIRST_ROW, SUM_COL, out.length, SUM_HEADERS.length).setValues(out).setWrap(true).setVerticalAlignment("top")
}

function saveDados_(sheet, nfc, dados, user) {
  const rows = rows_(sheet, FIRST_ROW, 1, 2)
  const stamp = now_()
  const history = []
  Object.keys(dados).forEach(function (field) {
    const name = String(field).trim()
    if (!name) return
    const value = String(dados[field] == null ? "" : dados[field])
    let idx = -1
    for (let i = 0; i < rows.length; i++) if (rows[i][0].toLowerCase() === name.toLowerCase()) { idx = i; break }
    if (idx < 0) {
      idx = rows.length
      for (let i = 0; i < rows.length; i++) if (!rows[i][0]) { idx = i; break }
      sheet.getRange(FIRST_ROW + idx, 1).setValue(safe_(name))
      rows[idx] = [name, ""]
    }
    if (rows[idx][1] !== value) {
      sheet.getRange(FIRST_ROW + idx, 2).setValue(safe_(value))
      history.push([stamp, "Dados", name, value, user])
      rows[idx][1] = value
    }
  })
  appendHistory_(sheet, history)
  updateIndex_(nfc, sheet)
  return history.length
}

function updateIndex_(nfc, sheet) {
  const row = indexRow_(nfc)
  if (row < 0) return
  const d = readBracelet_(sheet).dados
  ss_().getSheetByName(INDEX).getRange(row, 2, 1, 5).setValues([[
    safe_(d["Nome do bebê"] || ""), safe_(d["Nome da mãe"] || ""), safe_(d["Leito"] || ""), safe_(d["GPS (IMEI)"] || ""), now_(),
  ]])
}

// ───────────────────────── GPS ─────────────────────────
function fences_() {
  return rows_(ss_().getSheetByName(FENCES), FIRST_ROW, 1, FENCE_HEADERS.length).map(function (r, i) { return { r: r, row: i + FIRST_ROW } })
    .filter(function (x) { return x.r[0] }).map(function (x) {
    const r = x.r
    let coords = []
    try { coords = JSON.parse(r[4] || "[]") } catch (e) {}
    return { row: x.row, nome: r[0], tipo: r[1] || "permitida", pulseiras: r[2] || "todas", forma: r[3] || "poligono", coords: coords, raio: Number(r[5]) || 0, ativa: r[6] !== "não" }
  })
}

function saveFence_(f) {
  f.nome = String(f.nome || "").trim().slice(0, 60)
  if (!f.nome) throw new Error("Dê um nome para a cerca.")
  f.coords = (Array.isArray(f.coords) ? f.coords : []).map(function (c) { return [Number(c[0]), Number(c[1])] })
    .filter(function (c) { return isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180 }).slice(0, 200)
  if (!f.apagar && (f.forma === "circulo" ? (f.coords.length < 1 || !(Number(f.raio) > 0)) : f.coords.length < 3))
    throw new Error("Cerca incompleta: polígono precisa de 3 pontos; círculo precisa de centro e raio.")
  const sheet = ss_().getSheetByName(FENCES)
  const existing = fences_().filter(function (x) { return x.nome.toLowerCase() === String(f.nome).trim().toLowerCase() })[0]
  if (f.apagar) { if (existing) sheet.deleteRow(existing.row); return }
  const row = existing ? existing.row : Math.max(sheet.getLastRow() + 1, FIRST_ROW)
  sheet.getRange(row, 1, 1, FENCE_HEADERS.length).setValues([[
    safe_(String(f.nome).trim()), f.tipo === "setor" ? "setor" : "permitida", safe_(f.pulseiras || "todas"), f.forma === "circulo" ? "circulo" : "poligono",
    JSON.stringify(f.coords || []), Number(f.raio) || "", f.ativa === false ? "não" : "sim", now_(),
  ]])
}

// mesma conta do app (lib/geo.ts)
function toXY_(lat, lng, lat0) { return [lng * 111320 * Math.cos(lat0 * Math.PI / 180), lat * 110540] }
function inside_(f, lat, lng) {
  if (f.forma === "circulo") return dist_(lat, lng, f.coords[0][0], f.coords[0][1]) <= f.raio
  let c = false
  const pts = f.coords
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i][0], xi = pts[i][1], yj = pts[j][0], xj = pts[j][1]
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c
  }
  return c
}
function dist_(a1, o1, a2, o2) {
  const R = 6371000, r = Math.PI / 180
  const h = Math.pow(Math.sin((a2 - a1) * r / 2), 2) + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.pow(Math.sin((o2 - o1) * r / 2), 2)
  return 2 * R * Math.asin(Math.sqrt(h))
}
function edgeDist_(f, lat, lng) {
  if (f.forma === "circulo") return Math.max(0, dist_(lat, lng, f.coords[0][0], f.coords[0][1]) - f.raio)
  const p = toXY_(lat, lng, lat)
  let best = Infinity
  for (let i = 0; i < f.coords.length; i++) {
    const a = toXY_(f.coords[i][0], f.coords[i][1], lat), b = toXY_(f.coords[(i + 1) % f.coords.length][0], f.coords[(i + 1) % f.coords.length][1], lat)
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy))
  }
  return best
}
function center_(f) {
  if (f.forma === "circulo") return f.coords[0]
  let a = 0, o = 0
  f.coords.forEach(function (c) { a += c[0]; o += c[1] })
  return [a / f.coords.length, o / f.coords.length]
}
function sector_(from, lat, lng) {
  const r = Math.PI / 180
  const y = Math.sin((lng - from[1]) * r) * Math.cos(lat * r)
  const x = Math.cos(from[0] * r) * Math.sin(lat * r) - Math.sin(from[0] * r) * Math.cos(lat * r) * Math.cos((lng - from[1]) * r)
  const deg = (Math.atan2(y, x) / r + 360) % 360
  return ["Norte", "Nordeste", "Leste", "Sudeste", "Sul", "Sudoeste", "Oeste", "Noroeste"][Math.round(deg / 45) % 8]
}
function appliesTo_(f, nfc) {
  if (!f.ativa) return false
  const list = String(f.pulseiras || "todas").toLowerCase()
  return list === "todas" || list.split(/[,; ]+/).map(key_).indexOf(key_(nfc)) >= 0
}
function evaluate_(nfc, lat, lng) {
  const fences = fences_().filter(function (f) { return appliesTo_(f, nfc) && f.coords.length })
  const allowed = fences.filter(function (f) { return f.tipo !== "setor" })
  const zone = fences.filter(function (f) { return f.tipo === "setor" && inside_(f, lat, lng) })[0]
  if (!allowed.length) return { situacao: "sem cerca", setor: zone ? zone.nome : "", distancia: 0 }
  const inAllowed = allowed.filter(function (f) { return inside_(f, lat, lng) })[0]
  if (inAllowed) return { situacao: "dentro", cerca: inAllowed.nome, setor: zone ? zone.nome : "", distancia: 0 }
  let nearest = null, d = Infinity
  allowed.forEach(function (f) { const e = edgeDist_(f, lat, lng); if (e < d) { d = e; nearest = f } })
  const dir = sector_(center_(nearest), lat, lng)
  return { situacao: "FORA", cerca: nearest.nome, setor: (zone ? zone.nome + " – " : "") + dir, distancia: Math.round(d) }
}

function savePosition_(p, user) {
  const sheet = ss_().getSheetByName(POSITIONS)
  const lat = Number(p.lat), lng = Number(p.lng)
  if (!isFinite(lat) || !isFinite(lng)) throw new Error("Coordenadas inválidas.")
  const ev = evaluate_(p.nfc, lat, lng)
  const rows = rows_(sheet, FIRST_ROW, 1, POS_HEADERS.length)
  let idx = -1
  for (let i = 0; i < rows.length; i++) if (key_(rows[i][0]) === key_(p.nfc)) { idx = i; break }
  const before = idx >= 0 ? rows[idx][6] : ""
  const row = idx >= 0 ? FIRST_ROW + idx : Math.max(sheet.getLastRow() + 1, FIRST_ROW)
  sheet.getRange(row, 1, 1, POS_HEADERS.length).setValues([[
    String(p.nfc).replace(/^0+(?=.)/, ""), lat, lng, Math.round(Number(p.acc) || 0), safe_(p.fonte || ""), now_(), ev.situacao, safe_(ev.setor || ""), ev.distancia,
  ]])
  // registra no histórico da pulseira só quando muda (saiu / voltou)
  if (before !== ev.situacao && (ev.situacao === "FORA" || before === "FORA")) {
    const b = braceletSheet_(p.nfc)
    if (b) appendHistory_(b, [[now_(), "GPS", ev.situacao === "FORA" ? "ALARME – saiu da cerca" : "Voltou para a cerca",
      ev.situacao === "FORA" ? (ev.cerca + " | setor " + ev.setor + " | " + ev.distancia + " m") : ev.cerca, user || p.fonte || ""]])
  }
  return ev
}

function positions_() {
  return rows_(ss_().getSheetByName(POSITIONS), FIRST_ROW, 1, POS_HEADERS.length).filter(function (r) { return r[0] }).map(function (r) {
    return { nfc: r[0], lat: Number(r[1]), lng: Number(r[2]), acc: Number(r[3]) || 0, fonte: r[4], data: r[5], situacao: r[6], setor: r[7], distancia: Number(r[8]) || 0 }
  })
}

// ───────────────────────── agenda de vacinas (alarme no app) ─────────────────────────
// Cada linha: 1ª dose em Data + Horário, repete "A cada (h)" horas durante "Dias" dias (A cada = 0 → dose única).
const AGENDA = "Agenda"
const AGENDA_HEADERS = ["ID", "Pulseira", "Bebê", "Vacina", "Data", "Horário", "Dias", "Alarme", "Doses aplicadas", "Situação", "Programado por", "Atualizado", "A cada (h)"]
function agendaSheet_() {
  let s = ss_().getSheetByName(AGENDA)
  if (!s) {
    s = ss_().insertSheet(AGENDA)
    s.getRange(1, 1, 1000, AGENDA_HEADERS.length).setNumberFormat("@") // datas ficam como texto
    header_(s, "VIVIAN – Agenda de vacinas (o app avisa na hora marcada)", AGENDA_HEADERS)
  } else if (!str_(s.getRange(2, AGENDA_HEADERS.length).getValue())) {
    // aba criada pela versão anterior: acrescenta a coluna "A cada (h)"
    s.getRange(1, AGENDA_HEADERS.length, 1000, 1).setNumberFormat("@")
    s.getRange(2, AGENDA_HEADERS.length).setValue("A cada (h)").setFontWeight("bold").setBackground("#F9E498")
  }
  return s
}
// linhas antigas (sem "A cada"): uma dose por dia
function interval_(r) { return r[12] === "" ? ((Number(r[6]) || 1) > 1 ? 24 : 0) : Math.max(0, Number(r[12]) || 0) }
function totalDoses_(dias, intervalo) { return intervalo > 0 ? Math.max(1, Math.min(200, Math.floor(dias * 24 / intervalo))) : 1 }
function agenda_() {
  return rows_(agendaSheet_(), FIRST_ROW, 1, AGENDA_HEADERS.length).filter(function (r) { return r[0] && r[9] !== "Cancelada" && r[9] !== "Arquivada" }).slice(-300).map(function (r) {
    return { id: r[0], nfc: r[1], bebe: r[2], vacina: r[3], data: r[4], horario: r[5], dias: Number(r[6]) || 1, intervalo: interval_(r), alarme: r[7] !== "Não",
      aplicadas: r[8] ? r[8].split(/\s*,\s*/).filter(String) : [], situacao: r[9], por: r[10] }
  })
}
// a = { nfc, vacina, data "dd/MM/yyyy", horario "HH:mm", intervalo (h), dias, alarme } → programa
// a = { id, aplicar: "dd/MM/yyyy HH:mm" } → marca essa dose como aplicada;  a = { id, cancelar: true } → cancela
function saveAgenda_(a, user) {
  const s = agendaSheet_()
  const stamp = now_()
  if (a.id) {
    const rows = rows_(s, FIRST_ROW, 1, AGENDA_HEADERS.length)
    const i = rows.map(function (r) { return r[0] }).indexOf(String(a.id))
    if (i < 0) throw new Error("Vacina não encontrada na agenda.")
    const r = rows[i]
    const sheet = braceletSheet_(r[1])
    if (a.cancelar) {
      s.getRange(FIRST_ROW + i, 10, 1, 3).setValues([["Cancelada", r[10], stamp]])
      if (sheet) appendHistory_(sheet, [[stamp, "Vacinas", "Cancelada", r[3] + " (programada " + r[4] + " " + r[5] + ")", user]])
      return sheet
    }
    const dose = String(a.aplicar || "")
    if (!/^\d{2}\/\d{2}\/\d{4}( \d{2}:\d{2})?$/.test(dose)) throw new Error("Dose inválida.")
    const done = r[8] ? r[8].split(/\s*,\s*/).filter(String) : []
    if (done.indexOf(dose) < 0) done.push(dose)
    const status = done.length >= totalDoses_(Number(r[6]) || 1, interval_(r)) ? "Concluída" : "Programada"
    s.getRange(FIRST_ROW + i, 9, 1, 4).setValues([[done.join(", "), status, r[10], stamp]])
    if (sheet) appendHistory_(sheet, [[stamp, "Vacinas", "Aplicada", r[3] + " – dose de " + (dose.length > 10 ? dose : dose + " " + r[5]), user]])
    return sheet
  }
  const sheet = braceletSheet_(a.nfc)
  if (!sheet) throw new Error("Pulseira " + a.nfc + " não cadastrada.")
  const vacina = String(a.vacina || "").trim().slice(0, 80)
  const data = String(a.data || "")
  const horario = String(a.horario || "")
  const intervalo = Math.max(0, Math.min(168, Number(a.intervalo) || 0))
  const dias = intervalo ? Math.max(1, Math.min(60, Number(a.dias) || 1)) : 1
  if (!vacina) throw new Error("Informe o nome da vacina.")
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data) || !/^\d{2}:\d{2}$/.test(horario)) throw new Error("Informe a data e o horário.")
  const bebe = (list_().filter(function (p) { return key_(p.nfc) === key_(sheet.getName()) })[0] || {}).bebe || ""
  const id = Utilities.getUuid().replace(/-/g, "").slice(0, 10)
  const total = totalDoses_(dias, intervalo)
  const aplicadas = a.aplicadaAgora ? data + " " + horario : ""
  const status = a.aplicadaAgora && total === 1 ? "Concluída" : "Programada"
  s.getRange(Math.max(s.getLastRow() + 1, FIRST_ROW), 1, 1, AGENDA_HEADERS.length)
    .setValues([[id, sheet.getName(), bebe, vacina, data, horario, String(dias), a.alarme === false ? "Não" : "Sim", aplicadas, status, user, stamp, String(intervalo)].map(safe_)])
  const hist = a.aplicadaAgora
    ? [[stamp, "Vacinas", "Aplicada", vacina + " – " + data + " " + horario, user]]
    : [[stamp, "Vacinas", "Vacina", vacina, user], [stamp, "Vacinas", "1ª dose", data + " " + horario, user],
       [stamp, "Vacinas", "Repetição", intervalo ? "a cada " + intervalo + " h por " + dias + " dia(s) – " + total + " doses" : "dose única", user],
       [stamp, "Vacinas", "Alarme", a.alarme === false ? "Não" : "Sim", user]]
  appendHistory_(sheet, hist)
  updateIndex_(sheet.getName(), sheet)
  return sheet
}

// ───────────────────────── apagar dados (alta) → arquivo no Google Drive ─────────────────────────
// Copia a aba da pulseira (e as vacinas dela) para uma planilha nova na pasta "Vivian – Arquivo" do Drive,
// anota na aba "Arquivo" desta planilha e deixa a pulseira vazia (sem nome) para outro bebê.
const ARCHIVE = "Arquivo"
const ARCHIVE_FOLDER = "Vivian – Arquivo"
const ARCHIVE_HEADERS = ["Arquivado em", "Pulseira", "Bebê", "Mãe", "Arquivado por", "Planilha do arquivo"]
function archiveFolder_() {
  const it = DriveApp.getFoldersByName(ARCHIVE_FOLDER)
  return it.hasNext() ? it.next() : DriveApp.createFolder(ARCHIVE_FOLDER)
}
function archiveBracelet_(nfc, user) {
  const sheet = braceletSheet_(nfc)
  if (!sheet) throw new Error("Pulseira " + nfc + " não cadastrada.")
  const name = sheet.getName()
  const b = readBracelet_(sheet)
  const bebe = b.dados["Nome do bebê"] || "", mae = b.dados["Nome da mãe"] || ""
  if (!b.historico.length && !Object.keys(b.dados).some(function (k) { return b.dados[k] })) throw new Error("Esta pulseira já está vazia.")
  const stamp = now_()

  // 1) cópia para o Drive
  const title = (bebe || "Sem nome") + " – pulseira " + name + " – arquivado " + stamp.replace(/\//g, "-").replace(/:/g, "h").slice(0, 16)
  const file = SpreadsheetApp.create(title)
  sheet.copyTo(file).setName("Pulseira " + name)
  const ag = agendaSheet_()
  const agRows = rows_(ag, FIRST_ROW, 1, AGENDA_HEADERS.length)
  const mine = agRows.filter(function (r) { return r[0] && key_(r[1]) === key_(name) })
  if (mine.length) {
    const v = file.insertSheet("Vacinas")
    v.getRange(1, 1, 1, AGENDA_HEADERS.length).setValues([AGENDA_HEADERS]).setFontWeight("bold")
    v.getRange(2, 1, mine.length, AGENDA_HEADERS.length).setValues(mine.map(function (r) { return r.map(safe_) }))
  }
  file.deleteSheet(file.getSheets()[0])
  DriveApp.getFileById(file.getId()).moveTo(archiveFolder_())

  // 2) registro na aba "Arquivo"
  let arch = ss_().getSheetByName(ARCHIVE)
  if (!arch) { arch = ss_().insertSheet(ARCHIVE); header_(arch, "VIVIAN – Bebês arquivados (pasta do Drive: " + ARCHIVE_FOLDER + ")", ARCHIVE_HEADERS) }
  const row = Math.max(arch.getLastRow() + 1, FIRST_ROW)
  arch.getRange(row, 1, 1, 5).setValues([[stamp, name, safe_(bebe), safe_(mae), user]])
  arch.getRange(row, 6).setRichTextValue(SpreadsheetApp.newRichTextValue().setText("Abrir arquivo ▶").setLinkUrl(file.getUrl()).build())

  // 3) vacinas pendentes desta pulseira saem da agenda
  mine.forEach(function (r) {
    if (r[9] === "Programada") ag.getRange(FIRST_ROW + agRows.indexOf(r), 10, 1, 3).setValues([["Arquivada", r[10], stamp]])
  })
  // 4) última posição do GPS some
  const pos = ss_().getSheetByName(POSITIONS)
  const pr = rows_(pos, FIRST_ROW, 1, 1)
  for (let i = pr.length - 1; i >= 0; i--) if (key_(pr[i][0]) === key_(name)) pos.deleteRow(FIRST_ROW + i)

  // 5) pulseira vazia: só os campos padrão, sem histórico nem resumo
  const last = Math.max(sheet.getLastRow(), FIRST_ROW)
  sheet.getRange(FIRST_ROW, 1, last - FIRST_ROW + 1, 2).clearContent()
  sheet.getRange(FIRST_ROW, HIST_COL, last - FIRST_ROW + 1, 5).clearContent()
  sheet.getRange(FIRST_ROW, 1, DEFAULT_FIELDS.length, 2).setValues(DEFAULT_FIELDS.map(function (f) { return [f, ""] }))
  rebuildSummary_(sheet)
  updateIndex_(name, sheet)
  return { sheet: sheet, url: file.getUrl(), bebe: bebe }
}

// ───────────────────────── entradas ─────────────────────────
// GET  ?s=<sessão>&action=list|gps|fences|positions   ou   ?s=...&nfc=11982
function doGet(e) {
  const p = (e && e.parameter) || {}
  try {
    if (!p.s && !p.action) return json_({ ok: true, app: "Vivian", versao: 3 })
    ensureSetup_()
    const user = session_(p.s, p.poll !== "1")
    if (!user) return json_({ ok: false, auth: true, error: AUTH_REASON })
    if (p.action === "list") return json_({ ok: true, pulseiras: list_() })
    if (p.action === "fences") return json_({ ok: true, cercas: fences_() })
    if (p.action === "positions") return json_({ ok: true, posicoes: positions_() })
    if (p.action === "gps") return json_({ ok: true, cercas: fences_(), posicoes: positions_(), pulseiras: list_(), agenda: agenda_(), rastreador: !!(TRACCAR_URL && TRACCAR_TOKEN) })
    const sheet = braceletSheet_(p.nfc)
    if (!sheet) return json_({ ok: false, notFound: true, error: "Pulseira " + p.nfc + " não cadastrada." })
    return json_({ ok: true, pulseira: readBracelet_(sheet) })
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) })
  }
}

// POST (texto JSON) { action: "login"|"logout"|"save"|"create"|"fence"|"position"|"agenda"|"archive", s: <sessão>, ... }
function doPost(e) {
  let b
  try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}") } catch (err) { return json_({ ok: false, error: "Dados inválidos." }) }
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(25000)
    ensureSetup_()
    if (b.action === "login") return json_(login_(b.usuario || "", b.pin || ""))
    if (b.action === "logout") { logout_(b.s); return json_({ ok: true }) }
    const user = session_(b.s, true)
    if (!user) return json_({ ok: false, auth: true, error: AUTH_REASON })
    if (b.action === "fence") { saveFence_(b.cerca || {}); return json_({ ok: true, cercas: fences_() }) }
    if (b.action === "archive") {
      if (key_(b.confirmar) !== key_(b.nfc)) return json_({ ok: false, error: "Confirme digitando o número da pulseira." })
      const r = archiveBracelet_(b.nfc, user)
      SpreadsheetApp.flush()
      return json_({ ok: true, pulseira: readBracelet_(r.sheet), arquivo: r.url, bebe: r.bebe })
    }
    if (b.action === "agenda") {
      const sh = saveAgenda_(b.item || {}, user)
      SpreadsheetApp.flush()
      return json_({ ok: true, agenda: agenda_(), pulseira: sh ? readBracelet_(sh) : null })
    }
    if (b.action === "position") { const ev = savePosition_(b.posicao || {}, user); return json_({ ok: true, avaliacao: ev }) }
    if (b.action === "create") {
      if (!key_(b.nfc)) return json_({ ok: false, error: "Número NFC inválido." })
      const sheet = createBracelet_(b.nfc, b.dados || {}, user)
      return json_({ ok: true, pulseira: readBracelet_(sheet) })
    }
    const sheet = braceletSheet_(b.nfc)
    if (!sheet) return json_({ ok: false, notFound: true, error: "Pulseira " + b.nfc + " não cadastrada." })
    if (b.dados && Object.keys(b.dados).length) saveDados_(sheet, sheet.getName(), b.dados, user)
    if (Array.isArray(b.registros) && b.registros.length) {
      const stamp = now_()
      const aba = String(b.aba || "Registro").slice(0, 40)
      appendHistory_(sheet, b.registros.filter(function (r) { return r && String(r.valor || "").trim() })
        .map(function (r) { return [stamp, aba, String(r.campo || "").slice(0, 80), String(r.valor).slice(0, 2000), user] }))
      updateIndex_(sheet.getName(), sheet)
    }
    SpreadsheetApp.flush()
    return json_({ ok: true, pulseira: readBracelet_(sheet) })
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) })
  } finally {
    try { lock.releaseLock() } catch (e) {}
  }
}

// Menu na planilha: Vivian → Preparar abas (opcional; o app também prepara sozinho)
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Vivian").addItem("Preparar abas", "prepararAbas").addToUi()
}
function prepararAbas() {
  ensureSetup_()
  repararLinks_()
  rows_(ss_().getSheetByName(INDEX), FIRST_ROW, 1, 1).forEach(function (r) { const b = r[0] && braceletSheet_(r[0]); if (b) rebuildSummary_(b) })
}

// Rode uma vez no editor (▶ Executar) para autorizar o acesso ao Google Drive (pasta "Vivian – Arquivo")
function autorizarArquivo() {
  const f = archiveFolder_()
  Logger.log("Pasta do arquivo pronta: " + f.getUrl())
}
