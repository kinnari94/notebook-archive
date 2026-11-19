import dns from 'node:dns'
import { MongoClient } from 'mongodb'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

const uri = process.env.MONGODB_URI
const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
if (!uri && !isBuildPhase) throw new Error('MONGODB_URI is not set in .env.local')

const options = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 0,
}

// `mongodb+srv://` URIs need a DNS SRV lookup. Some ISP/router resolvers
// refuse SRV queries (→ "querySrv EREFUSED"), so prefer public resolvers
// for Node's dns.resolve* calls, keeping the system ones as fallback.
if (uri?.startsWith('mongodb+srv://')) {
  try {
    const system = dns.getServers().filter(s => !['8.8.8.8', '1.1.1.1'].includes(s))
    dns.setServers(['8.8.8.8', '1.1.1.1', ...system])
  } catch {}
}

function connect(): Promise<MongoClient> {
  return new MongoClient(uri!, options).connect()
}

let clientPromise: Promise<MongoClient>

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

if (isBuildPhase) {
  // Next.js imports every route module during `next build` to collect page
  // data; no request handler actually runs, so nothing awaits this promise.
  clientPromise = Promise.reject(new Error('MongoDB unavailable during build'))
  clientPromise.catch(() => {})
} else if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    const p = connect()
    // Don't cache a failed connection forever — allow the next request to retry.
    p.catch(() => { if (global._mongoClientPromise === p) global._mongoClientPromise = undefined })
    global._mongoClientPromise = p
  }
  clientPromise = global._mongoClientPromise
} else {
  clientPromise = connect()
}

/** Returns a live client promise; in dev, re-connects if the last attempt failed. */
export function getClientPromise(): Promise<MongoClient> {
  if (!isBuildPhase && process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const p = connect()
      p.catch(() => { if (global._mongoClientPromise === p) global._mongoClientPromise = undefined })
      global._mongoClientPromise = p
    }
    return global._mongoClientPromise
  }
  return clientPromise
}

export default clientPromise
