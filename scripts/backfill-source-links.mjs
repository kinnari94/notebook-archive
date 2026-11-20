/**
 * Link every incident to the exact NotebookLM source it came from.
 *
 * Older extractions saved no citations (or every citation of the whole answer),
 * so the incident's "source" link couldn't point at its own transcript. This
 * downloads the full text of each source in the notebook and finds the one that
 * contains the incident's source quote (exactly, or by overlapping phrases).
 *
 * Usage:
 *   node scripts/backfill-source-links.mjs           (preview only — nothing written)
 *   node scripts/backfill-source-links.mjs --apply   (save the links)
 *
 * Requires a NotebookLM login on this machine (same as extraction).
 */

import { MongoClient } from 'mongodb'
import { config } from 'dotenv'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local'), quiet: true })

const APPLY = process.argv.includes('--apply')
const ASK = process.argv.includes('--ask') // ask NotebookLM for incidents nothing else could place
const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

const norm = s => (s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g, ' ')    // citation markers
  .replace(/[\p{P}\p{S}]+/gu, ' ')                 // punctuation, any script
  .replace(/\s+/g, ' ')
  .trim()

function grams(text, n = 3) {
  const w = text.split(' ').filter(Boolean)
  const out = new Set()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

function fetchSources(notebookId) {
  const r = spawnSync(PYTHON, [join(__dirname, 'nlm_fulltext.py'), notebookId], {
    encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, env: process.env,
  })
  if (r.error) throw r.error
  let data
  try { data = JSON.parse(r.stdout.trim()) } catch { throw new Error(`Bad output from nlm_fulltext.py: ${r.stderr || r.stdout}`.slice(0, 400)) }
  if (data.error) throw new Error(data.error)
  return data
}

/** Best source for a quote: exact containment first, then most shared 3-word phrases. */
function match(quote, sources) {
  const q = norm(quote)
  if (q.length < 10) return { status: 'no-quote' }
  const exact = sources.filter(s => s.text.includes(q))
  if (exact.length === 1) return { status: 'exact', source: exact[0] }
  const pool = exact.length > 1 ? exact : sources
  const g = grams(q)
  if (!g.size) return { status: 'no-quote' }
  const scored = pool.map(s => {
    let hits = 0
    for (const x of g) if (s.text.includes(x)) hits++
    return { s, hits }
  }).sort((a, b) => b.hits - a.hits)
  const [best, second] = scored
  if (!best || best.hits === 0) return { status: 'unmatched' }
  const share = best.hits / g.size
  if (share < 0.3) return { status: 'unmatched', share }
  // A tie almost always means the notebook holds the same talk twice (e.g. a
  // "subs only" file and a "yt subs" file) — the quote is in both, so link both.
  const tied = scored.filter(x => x.hits === best.hits).map(x => x.s)
  if (second && second.hits === best.hits) return { status: 'duplicate-source', sources: tied, share }
  return { status: 'fuzzy', sources: [best.s], share }
}

const STOP = new Set(('the and for with from that this was were his her him their they into onto upon who which during after before where when while also had has have there them then than such through about over under between across within without being been will would could should shall into onto pujya gurudevshri gurudev param krupalu dev shrimad rajchandra bhagwan shri '
  + 'delivered expounding expounded explaining explained described describes mentions mentioned spiritual devotee devotees seekers seeker discourse discourses satsang').split(' '))

/** Keyword match for incidents with no quote: rare words (names, places, numbers) weigh most. */
function keywordMatch(description, sources) {
  const words = [...new Set(norm(description).split(' ').filter(w => (w.length >= 4 || /\d/.test(w)) && !STOP.has(w)))]
  if (!words.length) return null
  for (const s of sources) if (!s.wordSet) s.wordSet = new Set(s.text.split(' '))
  const N = sources.length
  const idf = Object.fromEntries(words.map(w => {
    const df = sources.filter(s => s.wordSet.has(w)).length
    return [w, df ? Math.log((N + 1) / df) : 0]
  }))
  const total = words.reduce((a, w) => a + idf[w], 0)
  const scored = sources.map(s => ({ s, score: words.reduce((a, w) => a + (s.wordSet.has(w) ? idf[w] : 0), 0) }))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score === 0 || !total) return null
  // Copies of the same talk score (almost) identically — link them together.
  const tied = scored.filter(x => x.score >= best.score * 0.97).map(x => x.s)
  const next = scored.find(x => x.score < best.score * 0.97)
  const margin = next ? best.score / Math.max(next.score, 1e-9) : Infinity
  return { sources: tied, coverage: best.score / total, margin, words: words.filter(w => best.s.wordSet.has(w) && idf[w] > 0) }
}

/** ~240 chars of the source around where the matched words cluster, so a match can be checked. */
function snippet(content, words) {
  const lc = content.toLowerCase()
  let bestPos = -1, bestHits = 0
  for (const w of words) {
    let i = lc.indexOf(w)
    while (i !== -1) {
      const win = lc.slice(Math.max(0, i - 120), i + 120)
      const hits = words.filter(x => win.includes(x)).length
      if (hits > bestHits) { bestHits = hits; bestPos = i }
      i = lc.indexOf(w, i + 1)
    }
  }
  if (bestPos < 0) return ''
  return content.slice(Math.max(0, bestPos - 120), bestPos + 120).replace(/\s+/g, ' ').trim()
}

/**
 * Last resort: ask NotebookLM to quote the passage, then use the sources it cites.
 * Only used with --ask, for incidents nothing else could place.
 */
async function askNotebookForSource(nbId, description, sources) {
  const prompt = `Quote verbatim the passage in the sources that this statement is based on, with its citation: "${description}". Quote only that one passage. If no source supports it, reply exactly NOT_FOUND.`
  const r = spawnSync(PYTHON, [join(__dirname, 'nlm_ask.py'), nbId, prompt], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env })
  let data
  try { data = JSON.parse(r.stdout.trim()) } catch { return { error: (r.stderr || r.stdout || 'no output').slice(0, 200) } }
  if (data.error) return { error: data.error }
  if (/NOT_FOUND/.test(data.answer) || !data.references?.length) return { error: 'NotebookLM found no supporting passage' }
  const counts = new Map()
  for (const ref of data.references) counts.set(ref.source_id, (counts.get(ref.source_id) || 0) + 1)
  const max = Math.max(...counts.values())
  const ids = [...counts].filter(([, n]) => n === max).map(([id]) => id)
  const picked = ids.map(id => sources.find(s => s.id === id) || { id, title: id })
  const cited = data.references.find(ref => ids.includes(ref.source_id) && ref.cited_text)?.cited_text || ''
  return { sources: picked, cited: cited.replace(/\s+/g, ' ').trim().slice(0, 300) }
}

function matchIncident(d, sources) {
  const m = match(d.source_chunk, sources)
  if (m.status === 'exact') return { ...m, sources: [m.source] }
  if (m.status !== 'no-quote' && m.status !== 'unmatched') return m
  // No usable quote — match the description's distinctive words instead.
  const k = keywordMatch(d.description, sources)
  if (k && k.coverage >= 0.5 && k.margin >= 1.25) {
    return { status: 'by-description', sources: k.sources, share: k.coverage, margin: k.margin, cited: snippet(k.sources[0].content, k.words) }
  }
  return { ...m, share: k?.coverage, margin: k?.margin, candidate: k?.sources[0]?.title }
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const col = client.db(process.env.MONGODB_DB || 'bapaji_archive').collection('incidents')

const incidents = await col.find({ source_notebook: { $exists: true, $ne: null } }, {
  projection: { description: 1, source_chunk: 1, source_notebook: 1, source_notebook_title: 1, nlm_source_links: 1 },
}).toArray()

const byNb = new Map()
for (const d of incidents) {
  if (!byNb.has(d.source_notebook)) byNb.set(d.source_notebook, [])
  byNb.get(d.source_notebook).push(d)
}

const counts = { exact: 0, fuzzy: 0, 'duplicate-source': 0, 'by-description': 0, unmatched: 0, 'no-quote': 0, failedNotebook: 0 }
const updates = []

for (const [nbId, list] of byNb) {
  const title = list[0].source_notebook_title || nbId
  process.stdout.write(`\n━━ ${title} — ${list.length} incidents. Downloading sources… `)
  let sources
  try {
    sources = fetchSources(nbId).map(s => ({ ...s, text: norm(s.content) }))
  } catch (e) {
    console.log(`FAILED: ${e.message}`)
    counts.failedNotebook += list.length
    continue
  }
  const empty = sources.filter(s => !s.text).length
  console.log(`${sources.length} sources${empty ? ` (${empty} with no text)` : ''}`)

  let asked = 0
  for (const d of list) {
    let m = matchIncident(d, sources)
    if (!m.sources?.length && ASK && !(d.nlm_source_links || []).length) {
      if (asked++ > 0) await new Promise(r => setTimeout(r, 15000)) // same pacing as extraction
      const a = await askNotebookForSource(nbId, d.description, sources)
      if (a.sources) {
        m = { status: 'asked-notebooklm', sources: a.sources, cited: a.cited }
        console.log(`  ? asked NotebookLM → ${a.sources.map(s => s.title).join(' / ')}\n      incident: ${d.description}\n      passage:  …${a.cited}…`)
      } else {
        console.log(`  ? asked NotebookLM — ${a.error} | ${d.description}`)
      }
    }
    counts[m.status] = (counts[m.status] || 0) + 1
    if (m.sources?.length) {
      updates.push({
        _id: d._id,
        links: m.sources.map(s => ({
          source_id: s.id,
          source_title: s.title,
          cited_text: d.source_chunk || m.cited || '',
          nlm_url: `https://notebooklm.google.com/notebook/${nbId}?source=${s.id}`,
          matched_by: m.status,
        })),
      })
      if (m.status === 'by-description') {
        console.log(`  ~ by-description ${(m.share * 100).toFixed(0)}% words, ${m.margin === Infinity ? '∞' : m.margin.toFixed(1)}× next → ${m.sources.map(s => s.title).join(' / ')}\n      incident: ${d.description}\n      passage:  …${m.cited}…`)
      } else if (m.status === 'fuzzy' || (m.share != null && m.share < 0.6)) {
        console.log(`  ~ ${m.status} ${(m.share * 100).toFixed(0)}% → ${m.sources.map(s => s.title).join(' / ')} | ${d.description.slice(0, 70)}`)
      }
    } else {
      const extra = m.share != null ? ` (best ${(m.share * 100).toFixed(0)}% words${m.margin ? `, ${m.margin.toFixed(1)}× next` : ''}${m.candidate ? `, candidate ${m.candidate}` : ''})` : ''
      console.log(`  ✗ ${m.status}${extra} | ${d.description}`)
    }
  }
}

console.log(`\nMatched exactly: ${counts.exact} · by phrases: ${counts.fuzzy} · in a duplicated source (both copies linked): ${counts['duplicate-source']} · by description: ${counts['by-description']} · asked NotebookLM: ${counts['asked-notebooklm'] || 0} · no match: ${counts.unmatched} · no quote: ${counts['no-quote']}${counts.failedNotebook ? ` · notebook download failed: ${counts.failedNotebook}` : ''}`)

if (!APPLY) {
  console.log(`\nPreview only. Re-run with --apply to save ${updates.length} source links.`)
} else if (updates.length) {
  const r = await col.bulkWrite(updates.map(u => ({
    updateOne: { filter: { _id: u._id }, update: { $set: { nlm_source_links: u.links } } },
  })))
  console.log(`\nSaved source links on ${r.modifiedCount} incidents.`)
}

await client.close()
