import { NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    const stats: Record<string, number> = {}
    for (const [key, col] of Object.entries(COLLECTIONS)) {
      try {
        stats[key] = await db.collection(col).countDocuments()
      } catch {
        stats[key] = 0
      }
    }
    return NextResponse.json({ stats })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
