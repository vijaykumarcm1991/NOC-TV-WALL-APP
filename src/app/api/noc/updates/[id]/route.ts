import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/noc/updates/[id]  — update status (resolve/reactivate) or edit fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()

  const existing = await db.nocUpdate.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Update not found' }, { status: 404 })
  }

  const action = body.action ?? 'edit'

  if (action === 'resolve') {
    const updated = await db.nocUpdate.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() },
    })
    return NextResponse.json({ update: updated })
  }

  if (action === 'reactivate') {
    const updated = await db.nocUpdate.update({
      where: { id },
      data: { status: 'active', resolvedAt: null, updatedAt: new Date() },
    })
    return NextResponse.json({ update: updated })
  }

  // Generic edit
  const data: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.content === 'string') data.content = body.content
  if (['critical', 'warning', 'info', 'success'].includes(body.priority)) data.priority = body.priority
  if (['incident', 'maintenance', 'announcement', 'general'].includes(body.category))
    data.category = body.category
  if (typeof body.authorName === 'string' && body.authorName.trim()) data.authorName = body.authorName.trim()
  if (typeof body.source === 'string') data.source = body.source.trim() || null
  if (body.expiresAt === null) {
    data.expiresAt = null
  } else if (typeof body.expiresAt === 'string') {
    const d = new Date(body.expiresAt)
    if (!isNaN(d.getTime())) data.expiresAt = d
  }

  const updated = await db.nocUpdate.update({ where: { id }, data })
  return NextResponse.json({ update: updated })
}

// DELETE /api/noc/updates/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const existing = await db.nocUpdate.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Update not found' }, { status: 404 })
  }
  await db.nocUpdate.delete({ where: { id } })
  return NextResponse.json({ ok: true, id })
}
