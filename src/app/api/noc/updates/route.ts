import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/noc/updates?status=active|resolved|expired|all
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'active'

  const where = status === 'all' ? {} : { status }

  const updates = await db.nocUpdate.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  // Auto-expire any active updates whose expiresAt has passed
  const now = new Date()
  const toExpire = updates.filter(
    (u) => u.status === 'active' && u.expiresAt && new Date(u.expiresAt) <= now,
  )
  if (toExpire.length > 0) {
    await db.nocUpdate.updateMany({
      where: { id: { in: toExpire.map((u) => u.id) } },
      data: { status: 'expired', updatedAt: now },
    })
    for (const u of toExpire) {
      u.status = 'expired'
    }
  }

  return NextResponse.json({ updates })
}

// POST /api/noc/updates  — create a new update
export async function POST(req: NextRequest) {
  const body = await req.json()

  const title = (body.title ?? '').toString().trim()
  const content = (body.content ?? '').toString().trim()
  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
  }

  const priority = ['critical', 'warning', 'info', 'success'].includes(body.priority)
    ? body.priority
    : 'info'
  const category = ['incident', 'maintenance', 'announcement', 'general'].includes(body.category)
    ? body.category
    : 'general'
  const authorName = (body.authorName ?? '').toString().trim() || 'NOC Operator'
  const source = body.source ? body.source.toString().trim() : null

  let expiresAt: Date | null = null
  if (body.expiresAt) {
    const d = new Date(body.expiresAt)
    if (!isNaN(d.getTime())) expiresAt = d
  }
  if (body.expiresInMinutes && !expiresAt) {
    const mins = parseInt(body.expiresInMinutes, 10)
    if (!isNaN(mins) && mins > 0) {
      expiresAt = new Date(Date.now() + mins * 60 * 1000)
    }
  }

  const update = await db.nocUpdate.create({
    data: {
      title,
      content,
      priority,
      category,
      status: 'active',
      authorName,
      source,
      expiresAt,
    },
  })

  return NextResponse.json({ update })
}
