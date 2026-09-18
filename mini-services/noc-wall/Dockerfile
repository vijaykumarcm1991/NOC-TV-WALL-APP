# syntax=docker/dockerfile:1.6
# =============================================================================
# NOC TV Wall — WebSocket mini-service
# =============================================================================
# Tiny Bun-based container that runs the socket.io broadcast service.
# Listens on port 3003 internally.
# =============================================================================

FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

COPY --from=deps /app/node_modules ./node_modules
COPY index.ts ./

EXPOSE 3003

# Bun natively supports TypeScript — no compile step needed
CMD ["bun", "index.ts"]
