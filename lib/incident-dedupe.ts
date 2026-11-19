// Fuzzy duplicate detection for extracted incidents.
//
// Standard extraction runs one NotebookLM query per category against the whole
// notebook, so the same incident is routinely returned by several category
// queries — each time with slightly different wording. Exact-hash dedupe can't
// catch that, so we compare normalized token sets instead.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'was', 'were', 'his', 'her', 'him',
  'their', 'they', 'into', 'onto', 'upon', 'at', 'in', 'on', 'of', 'to', 'a', 'an', 'by',
  'as', 'is', 'are', 'be', 'been', 'he', 'she', 'it', 'its', 'who', 'which', 'during',
  'after', 'before', 'where', 'when', 'while', 'also', 'had', 'has', 'have', 'there',
  'pujya', 'gurudevshri', 'gurudev', 'param', 'krupalu', 'dev', 'shrimad', 'rajchandra',
])

export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(s: string): Set<string> {
  const out = new Set<string>()
  for (const w of normalizeText(s).split(' ')) {
    if (w.length < 3 || STOPWORDS.has(w)) continue
    // crude stemming so "visited"/"visits"/"visit" match
    out.add(w.replace(/(ing|ed|es|s)$/, ''))
  }
  return out
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return (2 * inter) / (a.size + b.size)
}

export interface DedupeEntry {
  id: string
  year?: number
  tokens: Set<string>
  chunk: string
  category?: string
}

export function makeEntry(id: string, description: string, year: number | undefined, sourceChunk: string, category?: string): DedupeEntry {
  return { id, year, tokens: tokenize(description), chunk: normalizeText(sourceChunk), category }
}

const SIMILARITY_THRESHOLD = 0.6
// Two entries in the same category describing the same year/place are far more
// likely to be rewordings, so accept a looser word match there
// (e.g. "inaugurated regular satsangs at Yogi Sabhagruh in 2004" vs
//  "established a regular discourse series at Yogi Sabhagruh … 2004").
const SAME_CATEGORY_THRESHOLD = 0.55
const NEAR_IDENTICAL = 0.85

/** Returns the id of an existing entry that this one duplicates, or null. */
export function findDuplicate(entry: DedupeEntry, pool: DedupeEntry[]): string | null {
  for (const other of pool) {
    const sim = dice(entry.tokens, other.tokens)
    // Near-identical wording is the same incident even if the model computed a
    // different year (e.g. "at seven years of age" → 1870 one run, 1874 the next).
    if (sim >= NEAR_IDENTICAL) return other.id
    // Otherwise, different known years → different incidents.
    if (entry.year && other.year && entry.year !== other.year) continue
    // Same quoted source passage is a strong signal.
    if (entry.chunk.length >= 25 && entry.chunk === other.chunk) return other.id
    const sameCat = !!entry.category && entry.category === other.category
    if (sim >= (sameCat ? SAME_CATEGORY_THRESHOLD : SIMILARITY_THRESHOLD)) return other.id
  }
  return null
}
