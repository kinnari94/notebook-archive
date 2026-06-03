import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import type { JWT } from 'next-auth/jwt'
import type { Session, NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { access_type: 'offline', prompt: 'consent' } },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }: { token: JWT; account: any }) {
      if (account?.access_token) token.access_token = account.access_token
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      (session as any).access_token = token.access_token
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
