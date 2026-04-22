# ─── Base stage ──────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
COPY prisma ./prisma/

# ─── Development stage ───────────────────────────────────────────
FROM base AS development
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ─── Builder stage ───────────────────────────────────────────────
FROM base AS builder
RUN npm ci --omit=dev
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production stage ────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache curl dumb-init
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads /app/logs && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]
