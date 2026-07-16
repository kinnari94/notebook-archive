import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { HANDOVER_CHECKLIST_ITEMS } from '@/lib/handover-checklist'
import { canEditCollections } from '@/lib/require-edit'

const COL = 'srmd_handover_checklist'

// The 13 checklist items are fixed (mirroring the workbook's own rows) — only their
// Status/Date/Notes are stored, keyed by the item text itself since it's stable and unique.
export async function GET() {
  const db = await getDb()
  const saved = await db.collection(COL).find({}).toArray()
  const byItem = new Map(saved.map(d => [d.item as string, d]))

  const items = HANDOVER_CHECKLIST_ITEMS.map((item, i) => {
    const doc = byItem.get(item)
    return {
      item,
      order: i,
      status: (doc?.status as string) || '',
      date: (doc?.date as string) || '',
      notes: (doc?.notes as string) || '',
    }
  })

  return NextResponse.json({ items })
}

export async function PATCH(req: NextRequest) {
  if (!(await canEditCollections())) return NextResponse.json({ error: 'Access Denied' }, { status: 403 })
  const body = await req.json()
  const { item, status, date, notes } = body as { item: string; status?: string; date?: string; notes?: string }

  if (!item || !HANDOVER_CHECKLIST_ITEMS.includes(item)) {
    return NextResponse.json({ ok: false, error: 'Unknown checklist item' }, { status: 400 })
  }

  const setFields: Record<string, unknown> = { item, updated_at: new Date() }
  if (status !== undefined) setFields.status = status
  if (date !== undefined) setFields.date = date
  if (notes !== undefined) setFields.notes = notes

  const db = await getDb()
  await db.collection(COL).updateOne({ item }, { $set: setFields }, { upsert: true })
  return NextResponse.json({ ok: true })
}
