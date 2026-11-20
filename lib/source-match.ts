// Find which NotebookLM source (transcript) an extracted incident came from, by
// searching the full text of every source in the notebook for the incident's quote.
// Mirrors the matching in scripts/backfill-source-links.mjs — keep the two in sync.

export interface FullSource { id: string; title: string; content: string }
export interface PreparedSource extends FullSource { text: string; wordSet: Set<string> }

export const normForMatch = (s: string) => (s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g, ' ')   // citation markers
  .replace(/[\p{P}\p{S}]+/gu, ' ')                // punctuation, any script
  .replace(/\s+/g, ' ')
  .trim()

export function prepareSources(sources: FullSource[]): PreparedSource[] {
  return sources.filter(s => s.content).map(s => {
    const text = normForMatch(s.content)
    return { ...s, text, wordSet: new Set(text.split(' ')) }
  })
}

function grams(text: string, n = 3): Set<string> {
  const w = text.split(' ').filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

/** Sources containing the quote: exactly, or ≥30% of its 3-word phrases. Ties (copies of one talk) all returned. */
function matchQuote(quote: string, sources: PreparedSource[]): PreparedSource[] {
  const q = normForMatch(quote)
  if (q.length < 10) return []
  const exact = sources.filter(s => s.text.includes(q))
  if (exact.length === 1) return exact
  const pool = exact.length > 1 ? exact : sources
  const g = grams(q)
  if (!g.size) return []
  const scored = pool.map(s => {
    let hits = 0
    for (const x of g) if (s.text.includes(x)) hits++
    return { s, hits }
  }).sort((a, b) => b.hits - a.hits)
  const best = scored[0]
  if (!best || best.hits === 0 || best.hits / g.size < 0.3) return []
  return scored.filter(x => x.hits === best.hits).map(x => x.s)
}

const STOP = new Set(('the and for with from that this was were his her him their they into onto upon who which during after before where when while also had has have there them then than such through about over under between across within without being been will would could should shall pujya gurudevshri gurudev param krupalu dev shrimad rajchandra bhagwan shri '
  + 'delivered expounding expounded explaining explained described describes mentions mentioned spiritual devotee devotees seekers seeker discourse discourses satsang').split(' '))

/** Rare-word match on the description, for incidents whose quote isn't verbatim. */
function matchKeywords(description: string, sources: PreparedSource[]): PreparedSource[] {
  const words = [...new Set(normForMatch(description).split(' ').filter(w => (w.length >= 4 || /\d/.test(w)) && !STOP.has(w)))]
  if (!words.length || !sources.length) return []
  const N = sources.length
  const idf = new Map(words.map(w => {
    const df = sources.filter(s => s.wordSet.has(w)).length
    return [w, df ? Math.log((N + 1) / df) : 0] as const
  }))
  const total = words.reduce((a, w) => a + idf.get(w)!, 0)
  if (!total) return []
  const scored = sources.map(s => ({ s, score: words.reduce((a, w) => a + (s.wordSet.has(w) ? idf.get(w)! : 0), 0) }))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  const next = scored.find(x => x.score < best.score * 0.97)
  const margin = next ? best.score / Math.max(next.score, 1e-9) : Infinity
  if (best.score / total < 0.5 || margin < 1.25) return []
  return scored.filter(x => x.score >= best.score * 0.97).map(x => x.s)
}

/** Best-matching sources for an incident (several when the notebook holds copies of one talk), or [] if unsure. */
export function findIncidentSources(quote: string, description: string, sources: PreparedSource[]): PreparedSource[] {
  const byQuote = matchQuote(quote, sources)
  return byQuote.length ? byQuote : matchKeywords(description, sources)
}
