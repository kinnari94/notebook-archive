const HF_URL = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2'
export const EMBEDDING_DIMENSIONS = 384

async function callHF(inputs: string | string[]): Promise<number[][]> {
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) throw new Error('HUGGINGFACE_API_KEY not set')

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs }),
    })

    if (res.status === 503) {
      // Model is warming up — wait and retry
      await new Promise(r => setTimeout(r, attempt === 0 ? 5000 : 3000))
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HuggingFace API ${res.status}: ${text}`)
    }

    const raw: unknown = await res.json()
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('Unexpected HF response')

    // Normalize to number[][] regardless of whether HF returned 1D or 2D
    if (Array.isArray(raw[0])) return raw as number[][]
    return [raw as number[]]
  }

  throw new Error('HuggingFace model unavailable after retries')
}

export async function getEmbedding(text: string): Promise<number[]> {
  const data = await callHF(text.slice(0, 1000))
  return data[0]
}

export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  return callHF(texts.map(t => t.slice(0, 1000)))
}
