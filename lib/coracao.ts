import type { HistoryEntry } from "./types"

// Teste do coraçãozinho – algoritmo da SBP (manual de 2022):
// • Normal: SatO2 ≥ 95% na mão direita E no pé, com diferença ≤ 3%
// • Duvidoso: SatO2 entre 90% e 94% OU diferença ≥ 4% → repetir em 1 hora (até 2 repetições)
// • Alterado: SatO2 ≤ 89% → UTI neonatal e ecocardiograma; ou duvidoso pela 3ª vez → encaminhar para ecocardiograma
export const ABA_CORACAO = "Teste do coraçãozinho"
export const RESULTADOS = ["Normal", "Repetir em 1 hora", "Alterado – encaminhar"] as const

const num = (v: string) => Number(String(v).replace(",", ".").replace(/[^\d.]/g, ""))

// quantos testes "Repetir" seguidos já houve (o histórico vem do mais novo para o mais antigo)
export function previousDoubtful(history: HistoryEntry[]) {
  let n = 0
  for (const e of history) {
    if (e.aba !== ABA_CORACAO || e.campo !== "Resultado") continue
    if (/^repetir/i.test(e.valor)) n++
    else break
  }
  return n
}

export function avaliarCoracao(maoTxt: string, peTxt: string, history: HistoryEntry[]) {
  const mao = num(maoTxt)
  const pe = num(peTxt)
  if (!maoTxt.trim() || !peTxt.trim() || !(mao > 0 && mao <= 100) || !(pe > 0 && pe <= 100)) return null
  const diff = Math.abs(mao - pe)
  const menor = Math.min(mao, pe)
  if (menor <= 89) return { resultado: RESULTADOS[2], motivo: `Saturação ${menor}% (≤ 89%): UTI neonatal e ecocardiograma.`, diff }
  if (mao >= 95 && pe >= 95 && diff <= 3) return { resultado: RESULTADOS[0], motivo: `Mão ${mao}% e pé ${pe}% (≥ 95%), diferença ${diff}% (≤ 3%).`, diff }
  const antes = previousDoubtful(history)
  const porque = menor < 95 ? `saturação ${menor}% (entre 90 e 94%)` : `diferença ${diff}% (≥ 4%)`
  if (antes >= 2) return { resultado: RESULTADOS[2], motivo: `Duvidoso pela 3ª vez (${porque}): encaminhar para ecocardiograma.`, diff }
  return { resultado: RESULTADOS[1], motivo: `Duvidoso: ${porque}. Repetir em 1 hora (aferição ${antes + 1} de 3).`, diff }
}
