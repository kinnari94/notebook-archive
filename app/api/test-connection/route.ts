import { NextRequest, NextResponse } from 'next/server'
import { testConnection } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { uri } = await req.json()
    if (!uri) return NextResponse.json({ ok: false, message: 'URI is required' }, { status: 400 })
    const result = await testConnection(uri)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 500 })
  }
}
