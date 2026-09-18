import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { logAudit } from '@/lib/audit'

/**
 * NextAuth configuration with a single Credentials provider backed by a
 * shared admin password (NOC_ADMIN_PASSWORD env var). Additional operators
 * can be added by extending NOC_USERS to "username:password,username2:password2".
 */

interface ParsedUser {
  username: string
  password: string
  name: string
}

export function parseUsers(): ParsedUser[] {
  const adminPassword = process.env.NOC_ADMIN_PASSWORD
  const usersEnv = process.env.NOC_USERS

  const users: ParsedUser[] = []

  if (usersEnv) {
    for (const pair of usersEnv.split(',')) {
      const [username, password] = pair.split(':').map((s) => s.trim())
      if (username && password) {
        users.push({ username, password, name: username })
      }
    }
  }

  // Fallback: a single admin user with the admin password
  if (users.length === 0 && adminPassword) {
    users.push({
      username: 'admin',
      password: adminPassword,
      name: process.env.NOC_ADMIN_NAME || 'NOC Admin',
    })
  }

  return users
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'NOC Operator',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'admin' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null

        const users = parseUsers()
        const user = users.find(
          (u) =>
            u.username.toLowerCase() === credentials.username.toLowerCase() &&
            u.password === credentials.password,
        )

        if (!user) {
          // Audit the failed attempt (best-effort)
          const headers = (req as unknown as { headers?: Headers })?.headers
          const ip = headers?.get?.('x-forwarded-for') ?? null
          await logAudit({
            action: 'login_failed',
            actorName: credentials.username,
            details: { reason: 'invalid_credentials' },
            ip,
          })
          return null
        }

        const headers = (req as unknown as { headers?: Headers })?.headers
        const ip = headers?.get?.('x-forwarded-for') ?? null
        await logAudit({
          action: 'login',
          actorName: user.name,
          ip,
        })

        return { id: user.username, name: user.name, email: user.username }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24 hours
  pages: {
    signIn: '/?view=login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name ?? token.name
        token.username = (user.email ?? user.name) as string
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string) ?? session.user.name
        ;(session.user as { username?: string }).username =
          (token.username as string) ?? (session.user.email ?? '')
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
