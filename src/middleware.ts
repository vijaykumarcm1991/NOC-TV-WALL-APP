import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

/**
 * Middleware:
 *  - GET /api/noc/updates*  → PUBLIC (wall display must be able to fetch without auth)
 *  - POST/PATCH/DELETE /api/noc/updates* → requires authenticated session
 *  - The Next.js page itself (`/`) is NOT protected here — the page handles auth
 *    client-side so the wall view (`?view=wall`) stays public.
 */

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      // Only authorize if there's a token AND the request is NOT a GET
      authorized: ({ token, req }) => {
        const method = req.method ?? 'GET'
        if (method === 'GET') return true
        return !!token
      },
    },
    pages: {
      signIn: '/?view=login',
    },
  },
)

export const config = {
  // Match all endpoints of the NOC updates API (both list and per-item routes)
  matcher: ['/api/noc/updates', '/api/noc/updates/:id*'],
}
