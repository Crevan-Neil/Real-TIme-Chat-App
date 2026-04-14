# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# ── Stage 2: Production Runner ───────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy compiled output and package files
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

EXPOSE 8000

CMD ["node", "dist/index.js"]
