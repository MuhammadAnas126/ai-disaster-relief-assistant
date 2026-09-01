import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8000'

let socket: Socket | null = null

/**
 * Lazily creates (or returns) the shared socket connection. Configured so a
 * missing/offline backend never throws or crashes the UI — it just never
 * connects, and callers simply won't receive live events until it's up.
 */
export function getSocket(): Socket {
  if (socket) return socket

  socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 5000,
  })

  socket.on('connect_error', () => {
    // Expected when the backend isn't running yet — fail silently.
  })

  return socket
}
