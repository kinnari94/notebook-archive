import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

export async function POST(req: NextRequest) {
  const keyJson  = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (!keyJson) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not set in .env.local' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch (e) {
    return NextResponse.json({ error: 'Could not parse form data', detail: String(e) }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file in request' }, { status: 400 })

  let credentials: Record<string, string>
  try {
    credentials = JSON.parse(keyJson)
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
    }
  } catch (e) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON', detail: String(e) }, { status: 500 })
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })

    const buffer = Buffer.from(await file.arrayBuffer())
    const body   = Readable.from(buffer)

    // supportsAllDrives is required for Shared Drive folders (IDs starting with 0A)
    const uploaded = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        mimeType: file.type || 'image/jpeg',
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: { mimeType: file.type || 'image/jpeg', body },
      fields: 'id,name',
    })

    const fileId = uploaded.data.id!

    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`
    return NextResponse.json({ url, fileId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload] Google Drive error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
