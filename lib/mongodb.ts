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
    global._mongoClientPromise = new MongoClient(uri!, options).connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  clientPromise = new MongoClient(uri!, options).connect()
}

export default clientPromise
