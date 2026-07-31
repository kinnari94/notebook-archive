import { NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

// Every Object_ID currently in Inventory Master, for the Object ID picker shown on
// Condition Assessment / Risk & Priority's add-entry forms — lets those forms link to
// an existing inventory object instead of the user retyping its ID by hand.
export async function GET() {
  const db = await getDb()
  const rows = await db.collection(COLLECTIONS.srmd_inventory_master)
    .find({ Object_ID: { $exists: true, $ne: '' } }, { projection: { _id: 0, Object_ID: 1, Object_Name: 1 } })
    .sort({ Object_ID: 1 })
    .toArray()

  const options = rows
    .filter(r => typeof r.Object_ID === 'string' && r.Object_ID.trim())
    .map(r => ({
      value: r.Object_ID as string,
      label: r.Object_Name ? `${r.Object_ID} — ${r.Object_Name}` : (r.Object_ID as string),
    }))

  return NextResponse.json({ options })
}
