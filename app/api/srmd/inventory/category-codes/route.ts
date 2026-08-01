import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Every Category Code already in use for a given Collection_Type, parsed live from
// existing Inventory Master Object_ID values (rather than a hand-maintained list) —
// e.g. for collectionType=TX, matches "PPG-TX-SH-0001" or "PPG_TX_SH_0001" (both the
// legacy dash-joined and current underscore-joined forms) and extracts "SH". Textile
// and Paper Bound don't share a subtype vocabulary, so this is always scoped to one
// Collection_Type at a time.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const collectionType = (searchParams.get('collectionType') || '').trim().toUpperCase()
  if (!collectionType) return NextResponse.json({ options: [] })

  const db = await getDb()
  const pattern = new RegExp(`^[^-_]+[-_]${escapeRegex(collectionType)}[-_]([A-Za-z0-9]+)[-_]\\d`, 'i')

  const docs = await db.collection(COLLECTIONS.srmd_inventory_master)
    .find({ Collection_Type: collectionType, Object_ID: { $exists: true, $ne: '' } }, { projection: { Object_ID: 1, Object_Name: 1 } })
    .toArray()

  // One representative Object_Name per code (the first one seen), so the dropdown
  // can show e.g. "SH — Shawl" instead of just the bare code — read off the real
  // data itself rather than a hand-maintained code-to-name mapping. Every code that
  // appears at all gets a map entry (even if its example stays undefined because
  // every record using it happens to have a blank Object_Name), so it still shows
  // up in the dropdown, just without a name hint.
  const codeExamples = new Map<string, string | undefined>()
  for (const doc of docs) {
    const m = String(doc.Object_ID).match(pattern)
    if (!m) continue
    const code = m[1].toUpperCase()
    if (!codeExamples.has(code)) codeExamples.set(code, undefined)
    if (!codeExamples.get(code) && doc.Object_Name) {
      codeExamples.set(code, String(doc.Object_Name).trim())
    }
  }

  const options = [...codeExamples.keys()].sort().map(code => {
    const example = codeExamples.get(code)
    return { value: code, label: example ? `${code} — ${example}` : code }
  })
  return NextResponse.json({ options })
}
