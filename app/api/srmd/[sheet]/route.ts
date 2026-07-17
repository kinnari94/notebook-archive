import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSrmdSheet } from '@/lib/srmd-sheets'
import { ObjectId } from 'mongodb'
import { canEditCollections } from '@/lib/require-edit'

const DENIED = NextResponse.json({ error: 'Access Denied' }, { status: 403 })

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000
}

// Checks each of config.uniqueFields individually — a match on ANY one of them means
// the save must be rejected. excludeId lets PATCH ignore the record being edited.
async function findDuplicateField(
  db: Awaited<ReturnType<typeof getDb>>,
  config: NonNullable<ReturnType<typeof getSrmdSheet>>,
  body: Record<string, unknown>,
  excludeId?: string
): Promise<string | null> {
  for (const field of config.uniqueFields ?? []) {
    const value = body[field]
    if (typeof value !== 'string' || !value.trim()) continue
    const filter: Record<string, unknown> = { [field]: value.trim() }
    if (excludeId) filter._id = { $ne: new ObjectId(excludeId) }
    const existing = await db.collection(config.collection).findOne(filter)
    if (existing) return field
  }
  return null
}

function duplicateFieldMessage(field: string, value: unknown): string {
  return `${field.replace(/_/g, ' ')} "${String(value).trim()}" already exists. IDs must be unique.`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sheet: string }> }) {
  const { sheet } = await params
  const config = getSrmdSheet(sheet)
  if (!config) return NextResponse.json({ error: `Unknown view "${sheet}"` }, { status: 404 })

  const db = await getDb()
  const { searchParams } = new URL(req.url)

  const RESERVED_PARAMS = new Set(['q', 'objectId', 'limit', 'skip'])

  const q        = searchParams.get('q') || ''
  const objectId = searchParams.get('objectId') || ''
  const limit    = parseInt(searchParams.get('limit') || '50')
  const skip     = parseInt(searchParams.get('skip') || '0')

  const filter: Record<string, unknown> = {}
  if (q && config.searchFields.length) {
    filter.$or = config.searchFields.map(f => ({ [f]: { $regex: q, $options: 'i' } }))
  }
  if (objectId && config.objectIdField) filter[config.objectIdField] = objectId

  // Generic exact-match filters — any query param whose name matches a known field key
  // (used by the sub-view's Filters panel, one dropdown per select-type field).
  const fieldKeys = new Set(config.fields.map(f => f.key))
  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_PARAMS.has(key) || !value) continue
    if (fieldKeys.has(key)) filter[key] = value
  }

  // _id as a final tiebreaker keeps ordering stable when many records share the same
  // sortField value (e.g. an imported batch sharing one Photo_Date) — without it,
  // editing a tied record (which can change its on-disk size/position) can make it
  // appear to jump elsewhere in the list even though nothing about its rank changed.
  const sort: Record<string, 1 | -1> = config.groupBy
    ? { [config.groupBy]: 1, [config.sortField]: config.sortDir, _id: 1 }
    : { [config.sortField]: config.sortDir, _id: 1 }

  const items = await db.collection(config.collection)
    .find(filter).sort(sort).skip(skip).limit(limit).toArray()
  const total = await db.collection(config.collection).countDocuments(filter)

  return NextResponse.json({
    items: items.map(d => ({ ...d, _id: String(d._id) })),
    total,
    config,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sheet: string }> }) {
  if (!(await canEditCollections())) return DENIED
  const { sheet } = await params
  const config = getSrmdSheet(sheet)
  if (!config) return NextResponse.json({ error: `Unknown view "${sheet}"` }, { status: 404 })

  const body = await req.json()
  const db = await getDb()

  const dupField = await findDuplicateField(db, config, body)
  if (dupField) {
    return NextResponse.json({ error: duplicateFieldMessage(dupField, body[dupField]) }, { status: 409 })
  }

  const now = new Date()
  try {
    const result = await db.collection(config.collection).insertOne({ ...body, imported_at: now, updated_at: now })
    return NextResponse.json({ ok: true, id: result.insertedId })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ error: 'That ID already exists. IDs must be unique.' }, { status: 409 })
    }
    throw err
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sheet: string }> }) {
  if (!(await canEditCollections())) return DENIED
  const { sheet } = await params
  const config = getSrmdSheet(sheet)
  if (!config) return NextResponse.json({ error: `Unknown view "${sheet}"` }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })

  const body = await req.json()
  const db = await getDb()

  const dupField = await findDuplicateField(db, config, body, id)
  if (dupField) {
    return NextResponse.json({ error: duplicateFieldMessage(dupField, body[dupField]) }, { status: 409 })
  }

  try {
    await db.collection(config.collection).updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...body, updated_at: new Date() } }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ error: 'That ID already exists. IDs must be unique.' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sheet: string }> }) {
  if (!(await canEditCollections())) return DENIED
  const { sheet } = await params
  const config = getSrmdSheet(sheet)
  if (!config) return NextResponse.json({ error: `Unknown view "${sheet}"` }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })

  const db = await getDb()
  await db.collection(config.collection).deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
