import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { canEditCollections } from '@/lib/require-edit'

const COL = 'physical_collections'
const DENIED = NextResponse.json({ error: 'Access Denied' }, { status: 403 })

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const db = await getDb()

  // Distinct values endpoint
  const distinct = searchParams.get('distinct')
  if (distinct === 'material') {
    const vals = await db.collection(COL).distinct('material', {})
    return NextResponse.json((vals as string[]).filter(Boolean).sort())
  }

  const q        = searchParams.get('q') || ''
  const status   = searchParams.get('status') || ''
  const material = searchParams.get('material') || ''
  const limit    = parseInt(searchParams.get('limit') || '100')
  const skip     = parseInt(searchParams.get('skip') || '0')

  const filter: Record<string, unknown> = {}

  if (q) {
    const re = { $regex: q, $options: 'i' }
    filter.$or = [
      { title: re }, { description: re }, { accessionCode: re },
      { givenBy: re }, { location: re }, { id: re },
    ]
  }
  if (status)   filter.status   = status
  if (material) filter.material = material

  const items = await db.collection(COL).find(filter).skip(skip).limit(limit).toArray()
  const total = await db.collection(COL).countDocuments(filter)
  return NextResponse.json({ items, total })
}

export async function POST(req: NextRequest) {
  if (!(await canEditCollections())) return DENIED
  const body = await req.json()
  const db = await getDb()
  const now = new Date()
  const result = await db.collection(COL).insertOne({ ...body, createdAt: now, updatedAt: now })
  return NextResponse.json({ ok: true, id: result.insertedId })
}

export async function PATCH(req: NextRequest) {
  if (!(await canEditCollections())) return DENIED
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  const body = await req.json()
  const db = await getDb()
  await db.collection(COL).updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...body, updatedAt: new Date() } }
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await canEditCollections())) return DENIED
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  const db = await getDb()
  await db.collection(COL).deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
