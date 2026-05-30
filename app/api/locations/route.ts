import { NextResponse } from 'next/server'
import { getAllLocations } from '@/lib/db'

export async function GET() {
  try {
    const locations = await getAllLocations()
    return NextResponse.json({ locations })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
