import { NextResponse } from 'next/server'
import { getAllLocations } from '@/lib/db'

export async function GET() {
  try {
    const locations = await getAllLocations()
    return NextResponse.json({ locations, count: locations.length })
  } catch (e) {
    console.error('GET /api/locations error:', e)
    return NextResponse.json({ error: String(e), locations: [] }, { status: 500 })
  }
}
