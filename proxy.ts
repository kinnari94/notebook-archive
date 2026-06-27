import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const DENIED = NextResponse.json({ error: 'Access Denied' }, { status: 403 })

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // /api/auth/session returns session JSON — block address-bar access only
  // (app fetch calls must still work; token check would cause circular auth loop)
  if (pathname === '/api/auth/session') {
    const fetchMode = req.headers.get('sec-fetch-mode')
    if (fetchMode === 'navigate') return DENIED
    return NextResponse.next()
  }

  const isApiRoute = pathname.startsWith('/api/')
  const isAuthRoute = pathname.startsWith('/api/auth/')

  if (isApiRoute && !isAuthRoute) {
    // Block direct browser address-bar navigation to API routes
    const fetchMode = req.headers.get('sec-fetch-mode')
    if (fetchMode === 'navigate') return DENIED

    // Block unauthenticated API access
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return DENIED

    return NextResponse.next()
  }

  // Page routes: redirect to login if not authenticated
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // All routes except login, NextAuth OAuth callbacks, and static assets
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
    // Pull /api/auth/session back in so we can block address-bar access
    '/api/auth/session',
  ],
}
