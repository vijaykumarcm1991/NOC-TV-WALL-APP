import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface NocUpdatePayload {
  id: string
  title: string
  content: string
  priority: 'critical' | 'warning' | 'info' | 'success'
  category: 'incident' | 'maintenance' | 'announcement' | 'general'
  status: 'active' | 'resolved' | 'expired'
  authorName: string
  source?: string | null
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
  resolvedAt?: string | null
}

type WallEvent =
  | { type: 'update:created'; update: NocUpdatePayload }
  | { type: 'update:resolved'; update: NocUpdatePayload }
  | { type: 'update:deleted'; id: string }
  | { type: 'update:reactivated'; update: NocUpdatePayload }
  | { type: 'wall:cleared' }
  | { type: 'wall:refresh' }

const connectedClients = new Set<string>()

io.on('connection', (socket) => {
  connectedClients.add(socket.id)
  console.log(`[NOC-Wall] Client connected: ${socket.id} (total: ${connectedClients.size})`)

  // Identify client role (operator vs wall)
  socket.on('register', (data: { role: 'operator' | 'wall' }) => {
    socket.data.role = data?.role ?? 'operator'
    console.log(`[NOC-Wall] Client ${socket.id} registered as ${socket.data.role}`)
  })

  // Broadcast update events emitted by the operator UI to every connected client
  // (including the originating socket so all wall displays stay in sync).
  socket.on('update:event', (event: WallEvent) => {
    io.emit('update:event', event)
  })

  // Heartbeat ping from wall displays
  socket.on('wall:ping', () => {
    socket.emit('wall:pong', { ts: Date.now() })
  })

  socket.on('disconnect', () => {
    connectedClients.delete(socket.id)
    console.log(`[NOC-Wall] Client disconnected: ${socket.id} (total: ${connectedClients.size})`)
  })

  socket.on('error', (error) => {
    console.error(`[NOC-Wall] Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[NOC-Wall] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[NOC-Wall] Received SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[NOC-Wall] Received SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
