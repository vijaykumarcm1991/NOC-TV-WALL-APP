'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Filter,
  Search,
  Loader2,
  Radio,
  ServerCrash,
  ShieldCheck,
  XCircle,
  History,
  LogOut,
  Pin,
} from 'lucide-react'
import { NewUpdateForm } from './new-update-form'
import { UpdateCard } from './update-card'
import { PRIORITY_META } from '@/lib/noc-types'
import type { NocUpdate, Priority, WallEvent } from '@/lib/noc-types'
import { useNocSocket } from '@/hooks/use-noc-socket'
import { signOut } from 'next-auth/react'

interface OperatorConsoleProps {
  onOpenWall: () => void
  onOpenAudit: () => void
  currentUser: { name: string; username: string } | null
}

export function OperatorConsole({ onOpenWall, onOpenAudit, currentUser }: OperatorConsoleProps) {
  const [updates, setUpdates] = useState<NocUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [showResolved, setShowResolved] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/noc/updates?status=all')
      const data = await res.json()
      setUpdates(data.updates ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // Refresh every 30s to auto-expire updates server-side
    const id = setInterval(fetchAll, 30000)
    return () => clearInterval(id)
  }, [])

  // WebSocket: apply events from other tabs/operators instantly, and expose `emit` so
  // local actions propagate to every connected wall display.
  const { emit } = useNocSocket((event: WallEvent) => {
    setUpdates((prev) => {
      switch (event.type) {
        case 'update:created':
          if (prev.some((u) => u.id === event.update.id)) return prev
          return [event.update, ...prev]
        case 'update:resolved':
        case 'update:reactivated':
        case 'update:pinned':
        case 'update:unpinned':
          return prev.map((u) => (u.id === event.update.id ? event.update : u))
        case 'update:deleted':
          return prev.filter((u) => u.id !== event.id)
        case 'wall:cleared':
          return prev.filter((u) => u.status !== 'active')
        default:
          return prev
      }
    })
  })

  const handleCreated = (update: NocUpdate) => {
    setUpdates((prev) => (prev.some((u) => u.id === update.id) ? prev : [update, ...prev]))
    emit({ type: 'update:created', update })
  }

  const handleResolve = async (id: string) => {
    const res = await fetch(`/api/noc/updates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve' }),
    })
    if (res.ok) {
      const data = await res.json()
      setUpdates((prev) => prev.map((u) => (u.id === id ? data.update : u)))
      emit({ type: 'update:resolved', update: data.update })
    }
  }

  const handleReactivate = async (id: string) => {
    const res = await fetch(`/api/noc/updates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reactivate' }),
    })
    if (res.ok) {
      const data = await res.json()
      setUpdates((prev) => prev.map((u) => (u.id === id ? data.update : u)))
      emit({ type: 'update:reactivated', update: data.update })
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/noc/updates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUpdates((prev) => prev.filter((u) => u.id !== id))
      emit({ type: 'update:deleted', id })
    }
  }

  const handlePin = async (id: string) => {
    const res = await fetch(`/api/noc/updates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pin' }),
    })
    if (res.ok) {
      const data = await res.json()
      setUpdates((prev) => prev.map((u) => (u.id === id ? data.update : u)))
      emit({ type: 'update:pinned', update: data.update })
    }
  }

  const handleUnpin = async (id: string) => {
    const res = await fetch(`/api/noc/updates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpin' }),
    })
    if (res.ok) {
      const data = await res.json()
      setUpdates((prev) => prev.map((u) => (u.id === id ? data.update : u)))
      emit({ type: 'update:unpinned', update: data.update })
    }
  }

  // Stats
  const stats = useMemo(() => {
    const active = updates.filter((u) => u.status === 'active')
    const resolved = updates.filter((u) => u.status === 'resolved')
    const expired = updates.filter((u) => u.status === 'expired')
    return {
      total: updates.length,
      active: active.length,
      critical: active.filter((u) => u.priority === 'critical').length,
      warning: active.filter((u) => u.priority === 'warning').length,
      info: active.filter((u) => u.priority === 'info').length,
      success: active.filter((u) => u.priority === 'success').length,
      resolved: resolved.length,
      expired: expired.length,
      pinned: active.filter((u) => u.pinned).length,
    }
  }, [updates])

  // Filtered lists (active: pinned first, then priority, then recency)
  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase()
    return updates
      .filter((u) => u.status === 'active')
      .filter((u) => (priorityFilter === 'all' ? true : u.priority === priorityFilter))
      .filter(
        (u) =>
          !q ||
          u.title.toLowerCase().includes(q) ||
          u.content.toLowerCase().includes(q) ||
          u.authorName.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        const order: Record<Priority, number> = { critical: 0, warning: 1, info: 2, success: 3 }
        const p = order[a.priority] - order[b.priority]
        if (p !== 0) return p
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [updates, query, priorityFilter])

  const filteredResolved = useMemo(() => {
    const q = query.trim().toLowerCase()
    return updates
      .filter((u) => u.status !== 'active')
      .filter((u) => (priorityFilter === 'all' ? true : u.priority === priorityFilter))
      .filter(
        (u) =>
          !q ||
          u.title.toLowerCase().includes(q) ||
          u.content.toLowerCase().includes(q) ||
          u.authorName.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [updates, query, priorityFilter])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">NOC TV Wall Console</h1>
              <p className="text-xs text-slate-500">Post important updates to the operations wall</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">
              Signed in as <span className="font-medium text-slate-700">{currentUser?.name ?? 'Operator'}</span>
            </span>
            <Button
              onClick={onOpenAudit}
              variant="outline"
              className="border-slate-200 bg-white"
              title="View audit log"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </Button>
            <Button onClick={onOpenWall} variant="default" className="bg-slate-900 hover:bg-slate-800">
              <Radio className="h-4 w-4" />
              <span className="hidden sm:inline">Open Wall View</span>
              <span className="sm:hidden">Wall</span>
            </Button>
            <Button
              onClick={() => signOut({ callbackUrl: '/' })}
              variant="ghost"
              className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 md:grid-cols-7 sm:px-6 lg:px-8">
          <StatTile label="Active" value={stats.active} icon={<Activity className="h-4 w-4" />} tone="slate" />
          <StatTile label="Critical" value={stats.critical} icon={<AlertOctagon className="h-4 w-4" />} tone="red" />
          <StatTile label="Warning" value={stats.warning} icon={<AlertOctagon className="h-4 w-4" />} tone="amber" />
          <StatTile label="Info" value={stats.info} icon={<Activity className="h-4 w-4" />} tone="cyan" />
          <StatTile label="Pinned" value={stats.pinned} icon={<Pin className="h-4 w-4" />} tone="violet" />
          <StatTile label="Resolved" value={stats.resolved} icon={<ShieldCheck className="h-4 w-4" />} tone="emerald" />
          <StatTile label="Expired" value={stats.expired} icon={<XCircle className="h-4 w-4" />} tone="slate" />
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Form */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-32">
              <NewUpdateForm onCreated={handleCreated} />
            </div>
          </div>

          {/* Right: Updates */}
          <div className="lg:col-span-2 space-y-5">
            {/* Filters */}
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search updates by title, content, or author..."
                      className="pl-9 border-slate-200 focus-visible:ring-slate-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <Filter className="h-4 w-4 shrink-0 text-slate-400" />
                    <PriorityChip
                      label="All"
                      active={priorityFilter === 'all'}
                      onClick={() => setPriorityFilter('all')}
                    />
                    {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                      <PriorityChip
                        key={p}
                        label={PRIORITY_META[p].label}
                        active={priorityFilter === p}
                        accent={PRIORITY_META[p].accent}
                        onClick={() => setPriorityFilter(p)}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active updates */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Active on Wall · {filteredActive.length}
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : filteredActive.length === 0 ? (
                <Card className="border-dashed border-slate-200 bg-white">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ServerCrash className="mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-500">No active updates match your filters.</p>
                    <p className="mt-1 text-xs text-slate-400">Post a new update using the form on the left.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredActive.map((u) => (
                    <UpdateCard
                      key={u.id}
                      update={u}
                      showActions
                      onResolve={handleResolve}
                      onReactivate={handleReactivate}
                      onDelete={handleDelete}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Resolved / Expired */}
            <div>
              <button
                onClick={() => setShowResolved((s) => !s)}
                className="mb-3 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-500" />
                  Resolved &amp; Expired · {filteredResolved.length}
                </span>
                <span className="text-xs text-slate-500">{showResolved ? 'Hide' : 'Show'}</span>
              </button>
              {showResolved && filteredResolved.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 opacity-80">
                  {filteredResolved.map((u) => (
                    <UpdateCard
                      key={u.id}
                      update={u}
                      compact
                      showActions
                      onReactivate={handleReactivate}
                      onDelete={handleDelete}
                      onUnpin={handleUnpin}
                    />
                  ))}
                </div>
              )}
              {showResolved && filteredResolved.length === 0 && (
                <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
                  No resolved or expired updates.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'slate' | 'red' | 'amber' | 'cyan' | 'violet' | 'emerald'
}) {
  const toneClasses: Record<typeof tone, string> = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  )
}

function PriorityChip({
  label,
  active,
  accent,
  onClick,
}: {
  label: string
  active: boolean
  accent?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
      }`}
      style={active && accent ? { backgroundColor: accent, borderColor: accent } : undefined}
    >
      {label}
    </button>
  )
}
