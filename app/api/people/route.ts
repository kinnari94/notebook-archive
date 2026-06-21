import { NextResponse } from 'next/server'
import { getAllPeople } from '@/lib/db'

export async function GET() {
  try {
    const people = await getAllPeople()
    return NextResponse.json({ people, count: people.length })
  } catch (e) {
    console.error('GET /api/people error:', e)
    return NextResponse.json({ error: String(e), people: [] }, { status: 500 })
  }
}
