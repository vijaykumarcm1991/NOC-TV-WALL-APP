import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/auth/me — returns the current session's user (or null)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({
    user: {
      name: session.user.name,
      username: (session.user as { username?: string }).username ?? session.user.email,
    },
  })
}
