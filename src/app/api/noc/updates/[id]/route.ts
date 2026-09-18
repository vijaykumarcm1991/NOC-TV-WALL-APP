import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit, getRequestIp } from '@/lib/audit'
import { sendUpdateWebhook } from '@/lib/webhook'

// PATCH /api/noc/updates/[id] — update status (resolve/reactivate) or edit fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const actorName = session.user.name ?? 'NOC Operator'

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
    await logAudit({
      action: 'resolve',
      actorName,
      updateId: id,
      updateTitle: updated.title,
      ip: getRequestIp(req),
    })
    sendUpdateWebhook(updated as never, process.env.SLACK_WEBHOOK_URL || process.env.WEBHOOK_URL, 'resolved')
    return NextResponse.json({ update: updated })
  }

  if (action === 'reactivate') {
    const updated = await db.nocUpdate.update({
      where: { id },
      data: { status: 'active', resolvedAt: null, updatedAt: new Date() },
    })
    await logAudit({
      action: 'reactivate',
      actorName,
      updateId: id,
      updateTitle: updated.title,
      ip: getRequestIp(req),
    })
    sendUpdateWebhook(updated as never, process.env.SLACK_WEBHOOK_URL || process.env.WEBHOOK_URL, 'reactivated')
    return NextResponse.json({ update: updated })
  }

  if (action === 'pin') {
    const updated = await db.nocUpdate.update({
      where: { id },
      data: { pinned: true, pinnedAt: new Date(), updatedAt: new Date() },
    })
    await logAudit({
      action: 'pin',
      actorName,
      updateId: id,
      updateTitle: updated.title,
      ip: getRequestIp(req),
    })
    return NextResponse.json({ update: updated })
  }

  if (action === 'unpin') {
    const updated = await db.nocUpdate.update({
      where: { id },
      data: { pinned: false, pinnedAt: null, updatedAt: new Date() },
    })
    await logAudit({
      action: 'unpin',
      actorName,
      updateId: id,
      updateTitle: updated.title,
      ip: getRequestIp(req),
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const actorName = session.user.name ?? 'NOC Operator'

  const existing = await db.nocUpdate.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Update not found' }, { status: 404 })
  }
  await db.nocUpdate.delete({ where: { id } })
  await logAudit({
    action: 'delete',
    actorName,
    updateId: id,
    updateTitle: existing.title,
    ip: getRequestIp(req),
  })
  sendUpdateWebhook(existing as never, process.env.SLACK_WEBHOOK_URL || process.env.WEBHOOK_URL, 'deleted')
  return NextResponse.json({ ok: true, id })
}
