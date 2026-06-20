import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const COL = 'allowed_users'

export async function GET() {
  const db = await getDb()
  const users = await db.collection(COL).find({}, { projection: { _id: 0, email: 1, addedAt: 1 } }).toArray()
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  const db = await getDb()
  await db.collection(COL).updateOne(
    { email: email.toLowerCase().trim() },
    { $setOnInsert: { email: email.toLowerCase().trim(), addedAt: new Date() } },
    { upsert: true }
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { email } = await req.json()
  const db = await getDb()
  await db.collection(COL).deleteOne({ email: email.toLowerCase().trim() })
  return NextResponse.json({ ok: true })
}
