'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, Clock, Megaphone, Wrench, CircleDot, WifiOff, Radio, Pin } from 'lucide-react'
import { PRIORITY_META, CATEGORY_META } from '@/lib/noc-types'
import type { NocUpdate, Category, Priority, WallEvent } from '@/lib/noc-types'
import { useNocSocket } from '@/hooks/use-noc-socket'

interface TvWallViewProps {
  onExit: () => void
}

const CATEGORY_ICONS: Record<Category, typeof AlertTriangle> = {
  incident: AlertTriangle,
  maintenance: Wrench,
  announcement: Megaphone,
  general: CircleDot,
}

// Number of cards to show per "page" depending on viewport.
const PAGE_SIZE = 6
const PAGE_INTERVAL_MS = 12000 // 12s per page

export function TvWallView({ onExit }: TvWallViewProps) {
  const [updates, setUpdates] = useState<NocUpdate[]>([])
  const [now, setNow] = useState(() => new Date())
  const [pageIndex, setPageIndex] = useState(0)
  const [connected, setConnected] = useState(false)
  const [lastFetch, setLastFetch] = useState<number>(Date.now())
  const [visible, setVisible] = useState(true)

  // Page visibility — pause rotation when nobody is looking (saves CPU on wall displays)
  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Tick the clock every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Initial fetch + periodic refetch (catch-all for missed events)
  const fetchActive = async () => {
    try {
      const res = await fetch('/api/noc/updates?status=active')
      const data = await res.json()
      setUpdates((data.updates as NocUpdate[]) ?? [])
      setLastFetch(Date.now())
    } catch {
      /* swallow — UI shows stale data, the operator can still post */
    }
  }
  useEffect(() => {
    fetchActive()
    const id = setInterval(fetchActive, 20000)
    return () => clearInterval(id)
  }, [])

  // WebSocket events
  const socket = useNocSocket((event: WallEvent) => {
    setUpdates((prev) => {
      switch (event.type) {
        case 'update:created':
          if (prev.some((u) => u.id === event.update.id)) return prev
          return [event.update, ...prev]
        case 'update:resolved':
        case 'update:reactivated':
          return prev
            .filter((u) => (event.type === 'update:resolved' ? u.id !== event.update.id : true))
            .concat(event.type === 'update:reactivated' ? [event.update] : [])
        case 'update:pinned':
        case 'update:unpinned':
          return prev.map((u) => (u.id === event.update.id ? event.update : u))
        case 'update:deleted':
          return prev.filter((u) => u.id !== event.id)
        case 'wall:cleared':
          return []
        case 'wall:refresh':
          fetchActive()
          return prev
      }
    })
  })
  useEffect(() => {
    setConnected(socket.connected)
  }, [socket.connected])

  // Sort: pinned first, then by priority, then by recency
  const sorted = useMemo(() => {
    const priorityOrder: Record<Priority, number> = { critical: 0, warning: 1, info: 2, success: 3 }
    return [...updates].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      const p = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (p !== 0) return p
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [updates])

  // Pagination
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  useEffect(() => {
    if (pageCount <= 1) {
      setPageIndex(0)
      return
    }
    if (pageIndex > pageCount - 1) setPageIndex(0)
  }, [pageCount, pageIndex])
  useEffect(() => {
    if (!visible || pageCount <= 1) return
    const id = setInterval(() => {
      setPageIndex((p) => (p + 1) % pageCount)
    }, PAGE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [visible, pageCount])

  const pageItems = sorted.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE)

  // Ticker: all active updates scroll across the bottom
  const tickerText = useMemo(() => {
    if (sorted.length === 0) return 'No active updates · All systems nominal'
    return sorted
      .map(
        (u) =>
          `[${PRIORITY_META[u.priority].label.toUpperCase()}] ${u.title} — ${u.content.slice(0, 120)}`,
      )
      .join('    ◆    ')
  }, [sorted])

  // Exit on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit])

  // Critical count for header
  const criticalCount = sorted.filter((u) => u.priority === 'critical').length
  const warningCount = sorted.filter((u) => u.priority === 'warning').length

  const timeStr = now.toLocaleTimeString('en-US', { hour12: false })
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0f1a] text-slate-100">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0f1a]/80 px-6 py-3 backdrop-blur sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              Network Operations Center
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Live Status Wall
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* Status pills */}
          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill
              count={criticalCount}
              label="Critical"
              accent="#dc2626"
            />
            <StatusPill count={warningCount} label="Warning" accent="#f59e0b" />
            <StatusPill count={sorted.length} label="Active" accent="#06b6d4" />
          </div>

          {/* Connection */}
          <div className="flex items-center gap-2 text-xs">
            {connected ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-emerald-400">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400">Reconnecting</span>
              </>
            )}
          </div>

          {/* Clock */}
          <div className="flex flex-col items-end">
            <div className="font-mono text-xl font-bold tabular-nums tracking-wider sm:text-2xl">
              {timeStr}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
              {dateStr}
            </div>
          </div>

          {/* Exit button — small, top-right */}
          <button
            onClick={onExit}
            className="ml-2 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
            title="Exit wall view (Esc)"
          >
            <Radio className="h-3 w-3" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main grid */}
      <main className="relative z-10 flex-1 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <Activity className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-slate-100 sm:text-4xl">
              All Systems Nominal
            </h2>
            <p className="mt-2 max-w-xl text-base text-slate-400 sm:text-lg">
              No active updates on the wall. New posts from the operator console will appear here
              instantly.
            </p>
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((u) => (
              <WallCard key={u.id} update={u} now={now} />
            ))}
          </div>
        )}
      </main>

      {/* Pagination indicator */}
      {pageCount > 1 && (
        <div className="relative z-10 flex items-center justify-center gap-2 border-t border-white/10 bg-[#0b0f1a]/80 py-2 backdrop-blur">
          {Array.from({ length: pageCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === pageIndex ? 'w-8 bg-emerald-400' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>
      )}

      {/* Ticker */}
      <footer className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur">
        <div className="flex items-stretch">
          <div className="flex items-center gap-2 border-r border-white/10 bg-white/5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-200">
            <Megaphone className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Latest</span>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div
              key={tickerText}
              className="ticker-track whitespace-nowrap px-4 py-2.5 text-sm text-slate-200"
            >
              {tickerText}
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .ticker-track {
          animation: ticker-scroll 60s linear infinite;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

function StatusPill({ count, label, accent }: { count: number; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
      <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
        {count}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  )
}

function WallCard({ update, now }: { update: NocUpdate; now: Date }) {
  const meta = PRIORITY_META[update.priority]
  const CatIcon = CATEGORY_ICONS[update.category]

  // Expiry progress
  let expiryText: string | null = null
  let expiryRatio = 1
  if (update.expiresAt) {
    const exp = new Date(update.expiresAt).getTime()
    const created = new Date(update.createdAt).getTime()
    const total = Math.max(1, exp - created)
    const remaining = Math.max(0, exp - now.getTime())
    expiryRatio = remaining / total
    const mins = Math.floor(remaining / 60000)
    if (mins < 60) expiryText = `expires in ${mins}m`
    else {
      const hrs = Math.floor(mins / 60)
      const remMin = mins % 60
      expiryText = `expires in ${hrs}h ${remMin}m`
    }
  }

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 backdrop-blur-sm"
      style={{
        borderColor: `${meta.accent}55`,
        boxShadow: `0 0 0 1px ${meta.accent}22, 0 4px 30px ${meta.accent}11`,
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: meta.accent }}
      />
      {/* Pulse for critical */}
      {update.priority === 'critical' && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at top left, ${meta.accent}, transparent 60%)`,
            animation: 'critical-pulse 1.6s ease-in-out infinite',
          }}
        />
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: meta.accent,
                boxShadow: `0 0 8px ${meta.accent}`,
              }}
            />
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-wider text-slate-300">
            <CatIcon className="h-3 w-3" />
            {CATEGORY_META[update.category].label}
          </span>
          {update.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-300 ring-1 ring-violet-500/40">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {formatAgo(update.createdAt, now)}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-3 text-xl font-bold leading-tight tracking-tight text-slate-50 sm:text-2xl">
          {update.title}
        </h3>

        {/* Content */}
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300 sm:text-base">
          {update.content}
        </p>

        {/* Footer */}
        <div className="mt-auto pt-4">
          {expiryText && (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {expiryText}
                </span>
                <span>{Math.round(expiryRatio * 100)}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, expiryRatio * 100))}%`,
                    backgroundColor: meta.accent,
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Posted by <span className="font-medium text-slate-200">{update.authorName}</span>
              {update.source ? <span className="text-slate-500"> · {update.source}</span> : null}
            </span>
            <span className="font-mono tabular-nums">#{update.id.slice(-6)}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes critical-pulse {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  )
}

function formatAgo(iso: string, now: Date): string {
  const d = new Date(iso)
  const diff = now.getTime() - d.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}
