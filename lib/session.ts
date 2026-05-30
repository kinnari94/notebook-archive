import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId?: string
  email?: string
}

const SESSION_OPTIONS = {
  cookieName: 'bapaji_session',
  password: process.env.SESSION_SECRET || 'bapaji-archive-secret-32-chars-min!!',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS)
}
