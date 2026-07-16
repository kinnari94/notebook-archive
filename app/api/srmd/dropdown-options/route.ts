import { NextRequest, NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'
import { canEditCollections } from '@/lib/require-edit'
import { STATIC_OPTION_SETS, type Option } from '@/lib/dropdown-option-sets'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GET → every option set (static defaults merged with user-added custom options),
// keyed by optionSetKey, plus `custom` — the subset of each key's values that were
// user-added (and are therefore deletable, unlike the hardcoded static defaults).
export async function GET() {
  const db = await getDb()
  const customDocs = await db.collection(COLLECTIONS.srmd_custom_dropdown_options).find({}).toArray()

  const optionSets: Record<string, Option[]> = {}
  for (const [key, options] of Object.entries(STATIC_OPTION_SETS)) {
    optionSets[key] = [...options]
  }
  const custom: Record<string, string[]> = {}
  for (const doc of customDocs) {
    const key = doc.optionSetKey as string
    const value = doc.value as string
    if (!optionSets[key]) optionSets[key] = []
    const exists = optionSets[key].some(o => o.value.toLowerCase() === value.toLowerCase())
    if (!exists) optionSets[key].push({ value, label: (doc.label as string) || value })
    if (!custom[key]) custom[key] = []
    custom[key].push(value)
  }

  return NextResponse.json({ optionSets, custom })
}

// POST { optionSetKey, value } → persist a new custom option for that key, visible to
// all users from then on. Gated behind collections edit access, same as every other
// mutating SRMD route.
export async function POST(req: NextRequest) {
  if (!(await canEditCollections())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const optionSetKey = String(body?.optionSetKey || '').trim()
  const value = String(body?.value || '').trim()
  if (!optionSetKey || !value) {
    return NextResponse.json({ error: 'optionSetKey and value are required' }, { status: 400 })
  }

  const db = await getDb()
  const col = db.collection(COLLECTIONS.srmd_custom_dropdown_options)

  const staticOptions = STATIC_OPTION_SETS[optionSetKey] || []
  const staticMatch = staticOptions.some(o => o.value.toLowerCase() === value.toLowerCase())
  const existing = staticMatch ? null : await col.findOne({
    optionSetKey,
    value: { $regex: `^${escapeRegex(value)}$`, $options: 'i' },
  })

  if (!staticMatch && !existing) {
    await col.insertOne({ optionSetKey, value, label: value, createdAt: new Date() })
  }

  const fresh = await col.find({ optionSetKey }).toArray()
  const customValues = fresh
    .filter(d => !staticOptions.some(o => o.value.toLowerCase() === (d.value as string).toLowerCase()))
    .map(d => d.value as string)
  const options: Option[] = [
    ...staticOptions,
    ...fresh
      .filter(d => !staticOptions.some(o => o.value.toLowerCase() === (d.value as string).toLowerCase()))
      .map(d => ({ value: d.value as string, label: (d.label as string) || (d.value as string) })),
  ]

  return NextResponse.json({ options, custom: customValues })
}

// DELETE { optionSetKey, value } → remove a previously user-added custom option.
// Built-in static defaults can't be deleted this way (they aren't stored in Mongo).
export async function DELETE(req: NextRequest) {
  if (!(await canEditCollections())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const optionSetKey = String(body?.optionSetKey || '').trim()
  const value = String(body?.value || '').trim()
  if (!optionSetKey || !value) {
    return NextResponse.json({ error: 'optionSetKey and value are required' }, { status: 400 })
  }

  const staticOptions = STATIC_OPTION_SETS[optionSetKey] || []
  if (staticOptions.some(o => o.value.toLowerCase() === value.toLowerCase())) {
    return NextResponse.json({ error: 'Built-in options cannot be deleted' }, { status: 400 })
  }

  const db = await getDb()
  const col = db.collection(COLLECTIONS.srmd_custom_dropdown_options)
  await col.deleteMany({ optionSetKey, value: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } })

  const fresh = await col.find({ optionSetKey }).toArray()
  const customValues = fresh.map(d => d.value as string)
  const options: Option[] = [
    ...staticOptions,
    ...fresh.map(d => ({ value: d.value as string, label: (d.label as string) || (d.value as string) })),
  ]

  return NextResponse.json({ options, custom: customValues })
}
