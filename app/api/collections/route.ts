import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { ObjectId } from 'mongodb'

const COL = 'physical_collections'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const status   = searchParams.get('status') || ''
  const limit    = parseInt(searchParams.get('limit') || '100')
  const skip     = parseInt(searchParams.get('skip') || '0')

  const db = await getDb()
  const filter: Record<string, unknown> = {}

  if (q) {
    const re = { $regex: q, $options: 'i' }
    filter.$or = [
      { title: re }, { description: re }, { accessionCode: re },
      { givenBy: re }, { location: re }, { id: re },
    ]
  }
  if (category) filter.category = category
  if (status)   filter.status   = status

  const items = await db.collection(COL).find(filter).skip(skip).limit(limit).toArray()
  const total = await db.collection(COL).countDocuments(filter)
  return NextResponse.json({ items, total })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = await getDb()
  const now = new Date()
  const result = await db.collection(COL).insertOne({ ...body, createdAt: now, updatedAt: now })
  return NextResponse.json({ ok: true, id: result.insertedId })
}

export async function PATCH(req: NextRequest) {
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
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  const db = await getDb()
  await db.collection(COL).deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ok: true })
}
