FROM node:20-bookworm-slim AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
# npm installs the platform-specific esbuild binary into
# node_modules/@esbuild/linux-x64/bin/esbuild. We don't pull in the OS-level
# esbuild package — Debian's version drifts from whatever vite expects (host
# 0.25.x vs binary 0.17.x is fatal) and a previous workaround that symlinked
# the system binary in caused exactly that mismatch.
RUN npm install --legacy-peer-deps --unsafe-perm && \
  (find node_modules/@esbuild -type f -name esbuild -exec chmod +x {} + 2>/dev/null || true)

# Copy frontend source
COPY frontend/ ./

# Build frontend (outputs to ../backend/public due to vite.config.ts)
RUN set -eux; \
  node ./node_modules/typescript/bin/tsc; \
  node ./node_modules/vite/bin/vite.js build

FROM node:20-bookworm-slim AS backend-builder

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --legacy-peer-deps --unsafe-perm

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN node ./node_modules/prisma/build/index.js generate

# Build backend (TypeScript compilation)
RUN node ./node_modules/typescript/bin/tsc

# Copy built frontend from previous stage (Vite builds to ../backend/public)
COPY --from=frontend-builder /app/backend/public ./public

FROM node:20-bookworm-slim AS production

# Install openssl and wget for startup and healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --unsafe-perm && npm cache clean --force

# Copy prisma directory first (needed for generate)
COPY --from=backend-builder /app/backend/prisma ./prisma

# Production `npm install --omit=dev` already pulled in the full prisma
# package and its transitive deps (prisma is a runtime dep — the app runs
# `prisma migrate deploy` on startup), so we only need to bring in the
# generated client output, which `prisma generate` produced in the builder.
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public

# Create data directory
RUN mkdir -p data

# Create startup script that handles JWT secret generation
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'if [ -z "$JWT_SECRET" ]; then' >> /app/start.sh && \
    echo '  echo "⚠️  WARNING: No JWT_SECRET provided. Generating random secret for this session."' >> /app/start.sh && \
    echo '  echo "⚠️  For production, please set JWT_SECRET environment variable!"' >> /app/start.sh && \
    echo '  export JWT_SECRET=$(openssl rand -base64 64 | tr -d "\\n")' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "🔍 Checking database status..."' >> /app/start.sh && \
    echo 'node node_modules/prisma/build/index.js migrate deploy' >> /app/start.sh && \
    echo 'echo "🚀 Starting Random Walk application..."' >> /app/start.sh && \
    echo 'exec node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 4000

# Expose data directory as volume
VOLUME ["/app/data"]

# Set environment variables with sensible defaults
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/randomwalk.db
ENV PORT=4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/health || exit 1

# Start command
CMD ["/app/start.sh"] 