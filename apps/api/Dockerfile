# ============================================
# AETHER API - Production Dockerfile
# Multi-stage build for optimal image size
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Activate the repository's package manager without using npm.
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Activate the repository's package manager without using npm.
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY . .

# Build shared types package first
RUN cd packages/shared-types && pnpm build

# Build the application
RUN pnpm --filter @aether/api build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Prisma needs OpenSSL to select the correct Alpine engine binary.
RUN apk add --no-cache openssl

# Activate the repository's package manager without using npm.
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate

# Set environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 aether

# Copy package files for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Prisma CLI is needed at startup to apply the committed schema migrations.
RUN pnpm install --frozen-lockfile --prod=false

# Copy built application
COPY --from=builder --chown=aether:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=aether:nodejs /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder --chown=aether:nodejs /app/apps/api/prisma ./apps/api/prisma

# Create uploads directory
RUN mkdir -p /app/apps/api/public/uploads/avatars && \
    chown -R aether:nodejs /app

# Switch to non-root user
USER aether

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Apply migrations without invoking Corepack at runtime. Railway's Docker
# runtime uses this command directly, so package.json's start script is not
# relied on here.
CMD ["sh", "-c", "./apps/api/node_modules/.bin/prisma migrate deploy --schema ./apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
