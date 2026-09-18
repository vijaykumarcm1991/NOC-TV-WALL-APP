'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  RotateCcw,
  Trash2,
  Clock,
  AlertTriangle,
  Megaphone,
  Wrench,
  CircleDot,
  Loader2,
  Pin,
  PinOff,
} from 'lucide-react'
import { PRIORITY_META, CATEGORY_META } from '@/lib/noc-types'
import type { NocUpdate, Category } from '@/lib/noc-types'

interface UpdateCardProps {
  update: NocUpdate
  compact?: boolean
  showActions?: boolean
  onResolve?: (id: string) => Promise<void>
  onReactivate?: (id: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onPin?: (id: string) => Promise<void>
  onUnpin?: (id: string) => Promise<void>
}

const CATEGORY_ICONS: Record<Category, typeof AlertTriangle> = {
  incident: AlertTriangle,
  maintenance: Wrench,
  announcement: Megaphone,
  general: CircleDot,
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `expires in ${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMin = mins % 60
  return `expires in ${hrs}h ${remMin}m`
}

export function UpdateCard({
  update,
  compact = false,
  showActions = false,
  onResolve,
  onReactivate,
  onDelete,
  onPin,
  onUnpin,
}: UpdateCardProps) {
  const [busy, setBusy] = useState(false)
  const meta = PRIORITY_META[update.priority]
  const CatIcon = CATEGORY_ICONS[update.category]
  const canPin = update.priority === 'critical' && update.status === 'active'

  const handleAction = async (fn: (id: string) => Promise<void>) => {
    setBusy(true)
    try {
      await fn(update.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      className={`relative overflow-hidden border-l-4 ${meta.border} ${meta.bg} bg-slate-900/80 backdrop-blur-sm ${
        update.pinned ? 'ring-2 ring-violet-500/50' : ''
      }`}
      style={{ borderLeftColor: meta.accent }}
    >
      {/* Glow accent */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: meta.accent }}
      />
      {update.pinned && (
        <div className="pointer-events-none absolute right-2 top-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
            <Pin className="h-2.5 w-2.5" />
            Pinned
          </span>
        </div>
      )}
      <div className="p-4 pl-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: meta.accent }}
            />
            {meta.label}
          </span>
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-800/50 text-[10px] uppercase tracking-wider text-slate-300"
          >
            <CatIcon className="mr-1 h-3 w-3" />
            {CATEGORY_META[update.category].label}
          </Badge>
          {update.status === 'resolved' && (
            <Badge
              variant="outline"
              className="border-emerald-600 bg-emerald-950/50 text-[10px] uppercase tracking-wider text-emerald-300"
            >
              Resolved
            </Badge>
          )}
          {update.status === 'expired' && (
            <Badge
              variant="outline"
              className="border-slate-600 bg-slate-800/50 text-[10px] uppercase tracking-wider text-slate-400"
            >
              Expired
            </Badge>
          )}
          <span className="ml-auto text-[11px] text-slate-400">{timeAgo(update.createdAt)}</span>
        </div>

        <h3
          className={`font-semibold leading-tight text-slate-50 ${compact ? 'text-base' : 'text-lg'}`}
        >
          {update.title}
        </h3>
        {!compact && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {update.content}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span className="font-medium text-slate-300">{update.authorName}</span>
          {update.source && <span>· {update.source}</span>}
          {update.expiresAt && update.status === 'active' && (
            <span className="flex items-center gap-1 text-amber-400">
              <Clock className="h-3 w-3" />
              {formatExpiry(update.expiresAt)}
            </span>
          )}
          {update.resolvedAt && (
            <span className="text-emerald-400">
              resolved {timeAgo(update.resolvedAt)}
            </span>
          )}
        </div>

        {showActions && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-3">
            {update.status === 'active' && onResolve && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleAction(onResolve)}
                className="border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:text-emerald-200"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Resolve
              </Button>
            )}
            {update.status !== 'active' && onReactivate && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleAction(onReactivate)}
                className="border-slate-600 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 hover:text-slate-100"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Reactivate
              </Button>
            )}
            {canPin && !update.pinned && onPin && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleAction(onPin)}
                title="Pin to top of wall"
                className="border-violet-600 bg-violet-950/30 text-violet-300 hover:bg-violet-900/40 hover:text-violet-200"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pin className="h-3 w-3" />}
                Pin
              </Button>
            )}
            {update.pinned && onUnpin && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleAction(onUnpin)}
                className="border-violet-600 bg-violet-950/30 text-violet-300 hover:bg-violet-900/40 hover:text-violet-200"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PinOff className="h-3 w-3" />}
                Unpin
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleAction(onDelete)}
                className="ml-auto border-red-700/60 bg-red-950/30 text-red-300 hover:bg-red-900/40 hover:text-red-200"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
