import GoogleProvider from 'next-auth/providers/google'
import type { JWT } from 'next-auth/jwt'
import type { Session, NextAuthOptions } from 'next-auth'
import { getDb } from '@/lib/db'
import { DEFAULT_GUEST_PERMISSIONS } from '@/lib/permissions'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { access_type: 'offline', prompt: 'consent' } },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim()
      if (!email) return false
      const db = await getDb()
      const count = await db.collection('allowed_users').countDocuments({})
      if (count === 0) return true
      const allowed = await db.collection('allowed_users').findOne({ email })
      return !!allowed
    },
    async jwt({ token, account, user }: { token: JWT; account: any; user?: any }) {
      if (account?.access_token) token.access_token = account.access_token
      // Only DB lookup on initial sign-in (user is only present then)
      if (user?.email) {
        const email = user.email.toLowerCase().trim()
        const db = await getDb()
        const count = await db.collection('allowed_users').countDocuments({})
        if (count === 0) {
          token.role = 'admin'
          token.permissions = null
        } else {
          const record = await db.collection('allowed_users').findOne({ email })
          token.role = (record?.role as string) ?? 'guest'
          token.permissions = record?.permissions ?? DEFAULT_GUEST_PERMISSIONS
        }
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      ;(session as any).access_token = token.access_token
      if (session.user) {
        ;(session.user as any).role = (token as any).role ?? 'guest'
        ;(session.user as any).permissions = (token as any).permissions ?? null
      }
      return session
    },
  },
}
