import { db } from '@/lib/db'

export type AuditAction =
  | 'create'
  | 'resolve'
  | 'reactivate'
  | 'delete'
  | 'pin'
  | 'unpin'
  | 'login'
  | 'login_failed'

interface AuditEntry {
  action: AuditAction
  actorName: string
  updateId?: string | null
  updateTitle?: string | null
  details?: Record<string, unknown> | null
  ip?: string | null
}

/**
 * Persist a single audit log entry. Best-effort: failures are logged but never
 * bubble up so they cannot fail the originating API request.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.nocAuditLog.create({
      data: {
        action: entry.action,
        actorName: entry.actorName,
        updateId: entry.updateId ?? null,
        updateTitle: entry.updateTitle ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ip: entry.ip ?? null,
      },
    })
  } catch (err) {
    console.error('[audit] failed to write log:', err)
  }
}

/**
 * Extract the originating client IP from a Next.js request, accounting for
 * the Caddy / Docker proxy chain.
 */
export function getRequestIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}
