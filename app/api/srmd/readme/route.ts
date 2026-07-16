import { NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const sections = await db.collection(COLLECTIONS.srmd_readme).find({}).sort({ order: 1 }).toArray()
  return NextResponse.json({ sections: sections.map(s => ({ ...s, _id: String(s._id) })) })
}
