# ============================================
# AETHER API - Production Dockerfile
# Multi-stage build for optimal image size
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY . .

# Generate Prisma Client
RUN cd apps/api && npx prisma generate

# Build the application
RUN pnpm --filter @aether/api build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Set environment
ENV NODE_ENV=production
ENV API_PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 aether

# Copy built application
COPY --from=builder --chown=aether:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=aether:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=aether:nodejs /app/packages ./packages
COPY --from=builder --chown=aether:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=aether:nodejs /app/package.json ./
COPY --from=builder --chown=aether:nodejs /app/pnpm-workspace.yaml ./

# Create uploads directory
RUN mkdir -p /app/apps/api/public/uploads/avatars && \
    chown -R aether:nodejs /app/apps/api/public

# Switch to non-root user
USER aether

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "apps/api/dist/index.js"]
