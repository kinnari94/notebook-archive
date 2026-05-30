import { pbkdf2Sync, randomBytes } from 'crypto'
import { getDb } from './db'

export interface User {
  email: string
  passwordHash: string
  salt: string
  createdAt: Date
}

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  return hashPassword(password, salt) === hash
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb()
  return db.collection<User>('users').findOne({ email: email.toLowerCase().trim() }) as Promise<User | null>
}

export async function createUser(email: string, password: string): Promise<void> {
  const db = await getDb()
  const salt = randomBytes(32).toString('hex')
  await db.collection('users').insertOne({
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date(),
  })
}

export async function userCount(): Promise<number> {
  const db = await getDb()
  return db.collection('users').countDocuments()
}
