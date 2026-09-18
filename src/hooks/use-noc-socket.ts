'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { WallEvent } from '@/lib/noc-types'

export function useNocSocket(
  onEvent: (event: WallEvent) => void,
  options: { role?: 'operator' | 'wall' } = {},
) {
  const roleRef = useRef(options.role ?? 'operator')
  useEffect(() => {
    roleRef.current = options.role ?? 'operator'
  }, [options.role])
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  // Keep latest handler in a ref so we never re-create the socket on re-renders.
  const handlerRef = useRef(onEvent)
  useEffect(() => {
    handlerRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('register', { role: roleRef.current })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('update:event', (event: WallEvent) => handlerRef.current(event))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [])

  const emit = (event: WallEvent) => {
    socketRef.current?.emit('update:event', event)
  }

  return { connected, emit }
}
