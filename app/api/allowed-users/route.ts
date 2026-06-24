import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { DEFAULT_GUEST_PERMISSIONS } from '@/lib/permissions'

const COL = 'allowed_users'

export async function GET() {
  const db = await getDb()
  const users = await db.collection(COL)
    .find({}, { projection: { _id: 0, email: 1, addedAt: 1, role: 1, permissions: 1 } })
    .toArray()
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const { email, role } = await req.json()
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  const validRole = role === 'admin' ? 'admin' : 'guest'
  const permissions = validRole === 'admin' ? null : DEFAULT_GUEST_PERMISSIONS
  const db = await getDb()
  await db.collection(COL).updateOne(
    { email: email.toLowerCase().trim() },
    { $setOnInsert: { email: email.toLowerCase().trim(), role: validRole, permissions, addedAt: new Date() } },
    { upsert: true }
  )
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { email, role, permissions } = await req.json()
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const db = await getDb()
  const update: Record<string, unknown> = {}

  if (role !== undefined) {
    if (role !== 'admin' && role !== 'guest') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    update.role = role
    if (role === 'admin') update.permissions = null
    if (role === 'guest') update.permissions = DEFAULT_GUEST_PERMISSIONS
  }

  if (permissions !== undefined) {
    const valid = ['view', 'edit', 'no_access']
    for (const v of Object.values(permissions)) {
      if (!valid.includes(v as string)) {
        return NextResponse.json({ error: 'Invalid permission value' }, { status: 400 })
      }
    }
    update.permissions = permissions
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  await db.collection(COL).updateOne(
    { email: email.toLowerCase().trim() },
    { $set: update }
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { email } = await req.json()
  const db = await getDb()
  await db.collection(COL).deleteOne({ email: email.toLowerCase().trim() })
  return NextResponse.json({ ok: true })
}
