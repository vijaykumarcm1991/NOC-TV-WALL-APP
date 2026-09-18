'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, History, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { AUDIT_ACTION_META } from '@/lib/noc-types'
import type { NocAuditLog, AuditAction } from '@/lib/noc-types'

interface AuditLogViewProps {
  onBack: () => void
}

const PAGE_SIZE = 25

export function AuditLogView({ onBack }: AuditLogViewProps) {
  const [logs, setLogs] = useState<NocAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState<AuditAction | 'all'>('all')

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (action !== 'all') params.set('action', action)
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`/api/noc/audit?${params.toString()}`)
      if (res.status === 401) {
        setError('Session expired. Please sign in again.')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      setLogs(data.logs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    const id = setInterval(fetchLogs, 30000)
    return () => clearInterval(id)
  }, [action])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(
      (l) =>
        l.actorName?.toLowerCase().includes(q) ||
        l.updateTitle?.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q),
    )
  }, [logs, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Audit Log</h1>
              <p className="text-xs text-slate-500">Every operator action is recorded</p>
            </div>
          </div>
          <Button onClick={onBack} variant="outline" className="border-slate-200">
            <ChevronLeft className="h-4 w-4" />
            Back to Console
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="mb-5 border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(0)
                  }}
                  placeholder="Search by actor, title, or details..."
                  className="pl-9 border-slate-200 focus-visible:ring-slate-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={action}
                  onValueChange={(v) => {
                    setAction(v as AuditAction | 'all')
                    setPage(0)
                  }}
                >
                  <SelectTrigger className="w-44 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {(Object.keys(AUDIT_ACTION_META) as AuditAction[]).map((a) => (
                      <SelectItem key={a} value={a}>
                        {AUDIT_ACTION_META[a].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              {action !== 'all' && ` · ${AUDIT_ACTION_META[action].label}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : error ? (
              <div className="px-4 py-10 text-center text-sm text-red-600">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                No audit entries match your filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pageItems.map((log) => {
                  const meta = AUDIT_ACTION_META[log.action]
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                      <Badge variant="outline" className={`mt-0.5 ${meta.tone} border-current/20`}>
                        {meta.label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          <span className="font-medium">{log.actorName}</span>{' '}
                          {log.action === 'create' && 'posted'}
                          {log.action === 'resolve' && 'resolved'}
                          {log.action === 'reactivate' && 'reactivated'}
                          {log.action === 'delete' && 'deleted'}
                          {log.action === 'pin' && 'pinned'}
                          {log.action === 'unpin' && 'unpinned'}
                          {log.action === 'login' && 'signed in'}
                          {log.action === 'login_failed' && 'failed to sign in'}
                          {log.updateTitle && (
                            <>
                              {' '}
                              <span className="text-slate-500">·</span>{' '}
                              <span className="font-mono text-xs text-slate-600">{log.updateTitle}</span>
                            </>
                          )}
                        </p>
                        {log.details && (
                          <p className="mt-1 truncate text-xs text-slate-400">{log.details}</p>
                        )}
                        {log.ip && (
                          <p className="mt-0.5 text-[11px] text-slate-400">from {log.ip}</p>
                        )}
                      </div>
                      <span className="ml-auto shrink-0 text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="border-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-slate-500">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="border-slate-200"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
