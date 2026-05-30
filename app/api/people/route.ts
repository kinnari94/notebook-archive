import { NextResponse } from 'next/server'
import { getAllPeople } from '@/lib/db'

export async function GET() {
  try {
    const people = await getAllPeople()
    return NextResponse.json({ people })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
