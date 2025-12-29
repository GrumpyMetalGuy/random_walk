FROM node:20-bookworm-slim AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
# Install system esbuild and point node-esbuild to it to avoid binary exec issues
RUN apt-get update && apt-get install -y --no-install-recommends esbuild && rm -rf /var/lib/apt/lists/*
ENV ESBUILD_BINARY_PATH=/usr/bin/esbuild
# Ensure npm lifecycle scripts run correctly as root (esbuild download/permissions)
RUN npm install --legacy-peer-deps --unsafe-perm && \
  npm rebuild esbuild || true && \
  # Fallback: fix esbuild binary execute permission if needed
  (chmod +x node_modules/@esbuild/linux-x64/bin/esbuild 2>/dev/null || true) && \
  (chmod +x node_modules/esbuild-linux-64/bin/esbuild 2>/dev/null || true) && \
  (find node_modules/@esbuild -type f -name esbuild -exec chmod +x {} + 2>/dev/null || true) && \
  # Force esbuild to use system binary via symlink if present
  (ln -sf /usr/bin/esbuild node_modules/@esbuild/linux-x64/bin/esbuild 2>/dev/null || true) && \
  (ln -sf /usr/bin/esbuild node_modules/esbuild-linux-64/bin/esbuild 2>/dev/null || true)

# Copy frontend source
COPY frontend/ ./

# Build frontend (outputs to ../backend/public due to vite.config.ts)
RUN set -eux; \
  (find node_modules/@esbuild -maxdepth 3 -type f -name esbuild -exec chmod +x {} + 2>/dev/null || true); \
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

# Copy generated Prisma client and CLI from builder to avoid needing npx at runtime
COPY --from=backend-builder /app/backend/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/prisma ./node_modules/prisma

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