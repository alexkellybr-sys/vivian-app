// Leitura das etiquetas NFC (NTAG): tira todos os números possíveis da etiqueta, em ordem de prioridade.

export type NDEFRecordLike = { recordType: string; data?: DataView }
export type NDEFReadingEvent = Event & { serialNumber: string; message: { records: NDEFRecordLike[] } }
export type NDEFReaderLike = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>
  onreading: ((event: NDEFReadingEvent) => void) | null
  onreadingerror: (() => void) | null
}

export function keyFromText(value: string): string | null {
  const findKey = value.match(/find\s*key\s*[:=]?\s*([0-9a-f:\-]{4,})/i)?.[1]
  if (findKey) return findKey
  const nfcParam = value.match(/[?&#/]nfc=([0-9a-z:\-]{4,})/i)?.[1]
  if (nfcParam) return nfcParam
  return null
}

export function candidatesFromTag(event: NDEFReadingEvent): string[] {
  const texts: string[] = []
  for (const record of event.message.records) {
    if (!record.data) continue
    try {
      texts.push(new TextDecoder().decode(record.data).replace(/\0/g, "").trim())
    } catch {}
  }
  const out: string[] = []
  const fromText = keyFromText(texts.join(" "))
  if (fromText) out.push(fromText)
  for (const text of texts) if (/^[0-9a-f:\-\s]{4,}$/i.test(text)) out.push(text)
  if (event.serialNumber) out.push(event.serialNumber)
  return Array.from(new Set(out.map((c) => c.trim()).filter(Boolean)))
}

export function normalizeKey(value: string) {
  return value.replace(/[^0-9a-z]/gi, "").toUpperCase().replace(/^0+(?=.)/, "")
}
