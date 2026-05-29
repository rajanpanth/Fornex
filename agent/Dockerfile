# Dockerfile for the Fornex agent runtime.
#
# Built and run on Fly.io as a single always-on Machine. The agent loop
# wakes every 15 minutes, reads the on-chain VaultStrategy, fetches market
# signals, asks BULL/BEAR/ZEN for votes, and writes a MultiAgentDecision PDA
# to Solana devnet. No HTTP server, no inbound traffic.
#
# Build context: the `agent/` directory only. We intentionally do NOT pull
# in the Next.js workspace at the repo root — the agent is self-contained.

FROM node:20-bookworm-slim AS base

# OpenSSL is required by some Solana SDK transitive deps.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install dependencies first so docker layer caching skips reinstalls
#    when only source files change.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev=false; \
    else npm install; fi

# 2. Copy the rest of the agent. .dockerignore drops .env and node_modules.
COPY . .

# 3. Default cmd. pm2-runner.js bootstraps ts-node and requires src/index.ts.
#    Fly's restart policy will restart on crash so we don't need pm2 inside
#    the container (one process per Machine is the Fly idiom).
CMD ["node", "pm2-runner.js"]
