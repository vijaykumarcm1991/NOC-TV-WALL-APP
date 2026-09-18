import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/noc/audit?from=&to=&action=&q=&limit=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const action = searchParams.get('action')
  const q = searchParams.get('q')?.toLowerCase().trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

  // Build the where clause via a chain of filters
  const where: Record<string, unknown> = {}

  if (from) {
    const d = new Date(from)
    if (!isNaN(d.getTime())) where.createdAt = { gte: d }
  }
  if (to) {
    const d = new Date(to)
    if (!isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt as object), lte: d }
    }
  }
  if (action && action !== 'all') where.action = action

  let logs = await db.nocAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 50,
  })

  if (q) {
    logs = logs.filter(
      (l) =>
        l.actorName?.toLowerCase().includes(q) ||
        l.updateTitle?.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q),
    )
  }

  return NextResponse.json({ logs: logs.slice(0, limit) })
}
