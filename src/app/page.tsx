'use client'

import { useEffect, useState } from 'react'
import { OperatorConsole } from '@/components/noc/operator-console'
import { TvWallView } from '@/components/noc/tv-wall-view'

type View = 'console' | 'wall'

function readInitialView(): View {
  if (typeof window === 'undefined') return 'console'
  const url = new URL(window.location.href)
  return url.searchParams.get('view') === 'wall' ? 'wall' : 'console'
}

export default function Home() {
  const [view, setView] = useState<View>(() => readInitialView())

  // Keep the URL in sync (without scrolling / causing navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (view === 'wall') url.searchParams.set('view', 'wall')
    else url.searchParams.delete('view')
    window.history.replaceState({}, '', url.toString())
  }, [view])

  // Listen for browser back/forward so the wall ↔ console toggle is also navigable.
  useEffect(() => {
    const onPop = () => setView(readInitialView())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (view === 'wall') {
    return <TvWallView onExit={() => setView('console')} />
  }

  return <OperatorConsole onOpenWall={() => setView('wall')} />
}
