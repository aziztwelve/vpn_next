# syntax=docker/dockerfile:1.7
# ============================================================
# vpn_next — Telegram Mini App (Next.js 16, App Router, standalone)
# ============================================================
# Multi-stage build:
#   1. deps    — ставит только package*.json + npm ci
#   2. builder — копирует исходники, собирает standalone output
#   3. runner  — минимальный alpine-node с server.js и статикой
#
# Запуск через docker-compose (см. vpn_go/deploy/compose/docker-compose.yml,
# сервис `vpn-next`, profile=prod).
# ============================================================

# ---------- Stage 1: deps ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Alpine не содержит libc6-compat, который нужен некоторым нативным модулям.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------- Stage 2: builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- Stage 3: runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user для безопасности.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone bundle содержит минимальный server.js + нужные node_modules.
# public/ и .next/static нужно копировать вручную — см. доку Next.js.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# server.js — это minimal-сервер из standalone-бандла.
CMD ["node", "server.js"]
