# syntax=docker/dockerfile:1.6
# =============================================================================
# NOC TV Wall — Next.js app (multi-stage build)
# =============================================================================
# Stage 1: Install all dependencies (including dev) using bun for speed
# Stage 2: Build the Next.js app (standalone output)
# Stage 3: Production runtime — slim Node image with only required artifacts
# =============================================================================

ARG NODE_VERSION=20-alpine

# ---------- Stage 1: deps ----------
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy lockfile + package.json first for cache-friendly installs
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install all dependencies (including dev) and generate Prisma client
RUN bun install --frozen-lockfile
RUN bunx prisma generate


# ---------- Stage 2: builder ----------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app with standalone output
RUN bun run build


# ---------- Stage 3: runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install OpenSSL (required by Prisma's SQLite engine on Alpine) + wget (for healthcheck)
RUN apk add --no-cache openssl libc6-compat wget

# Copy the standalone Next.js server (includes prisma client + engine binary)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema
COPY --from=builder /app/prisma ./prisma

# Install the Prisma CLI in the runner stage. We use npm here (bundled with
# node:20-alpine) because the Prisma CLI has a deep transitive dependency tree
# (e.g. @prisma/config → effect → c12, deepmerge-ts, empathic) that isn't fully
# captured by `COPY --from=builder /app/node_modules/prisma`. Installing fresh
# with npm resolves the whole tree cleanly. We pin the exact version to match
# what's in bun.lock (avoids version mismatch with @prisma/client).
RUN npm install --omit=dev --no-save prisma@6.19.2

# Create the db directory (mount point for the persistent volume)
RUN mkdir -p /app/db

EXPOSE 3000

# Initialize the database (idempotent) then start the Next.js server.
# We use the locally-installed prisma binary directly (no `npx` fetch).
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --accept-data-loss --skip-generate && node server.js"]
