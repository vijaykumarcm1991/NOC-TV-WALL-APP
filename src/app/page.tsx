'use client'

import { useEffect, useState } from 'react'
import { OperatorConsole } from '@/components/noc/operator-console'
import { TvWallView } from '@/components/noc/tv-wall-view'
import { LoginView } from '@/components/noc/login-view'
import { AuditLogView } from '@/components/noc/audit-log-view'

type View = 'console' | 'wall' | 'login' | 'audit'

interface CurrentUser {
  name: string
  username: string
}

function readInitialView(): View {
  if (typeof window === 'undefined') return 'console'
  const url = new URL(window.location.href)
  const v = url.searchParams.get('view')
  if (v === 'wall' || v === 'login' || v === 'audit') return v
  return 'console'
}

export default function Home() {
  const [view, setView] = useState<View>(() => readInitialView())
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  // Fetch current session user
  const refreshUser = async () => {
    setUserLoading(true)
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setUserLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  // If user becomes null while on console/audit, redirect to login
  useEffect(() => {
    if (!userLoading && !user && (view === 'console' || view === 'audit')) {
      setView('login')
    }
  }, [user, userLoading, view])

  // Keep the URL in sync (without scrolling / causing navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (view === 'console') url.searchParams.delete('view')
    else url.searchParams.set('view', view)
    window.history.replaceState({}, '', url.toString())
  }, [view])

  // Listen for browser back/forward so view toggles are navigable
  useEffect(() => {
    const onPop = () => setView(readInitialView())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // The wall view is always public — render it before any auth check
  if (view === 'wall') {
    return <TvWallView onExit={() => setView('console')} />
  }

  // Show a loading state while we check session
  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        <div className="animate-pulse">Loading…</div>
      </div>
    )
  }

  // Login view is public
  if (view === 'login' || !user) {
    return (
      <LoginView
        onLoggedIn={() => {
          refreshUser()
          setView('console')
        }}
      />
    )
  }

  if (view === 'audit') {
    return <AuditLogView onBack={() => setView('console')} />
  }

  return (
    <OperatorConsole
      onOpenWall={() => setView('wall')}
      onOpenAudit={() => setView('audit')}
      currentUser={user}
    />
  )
}
