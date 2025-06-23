FROM node:18-alpine AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --only=production

# Copy frontend source
COPY frontend/ ./

# Build frontend (outputs to ../backend/public due to vite.config.ts)
RUN npm run build

FROM node:18-alpine AS backend-builder

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

# Build backend (TypeScript compilation)
RUN npx tsc

# Copy built frontend from previous stage (Vite builds to ../backend/public)
COPY --from=frontend-builder /app/backend/public ./public

FROM node:18-alpine AS production

# Install openssl for JWT secret generation
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy prisma directory first (needed for generate)
COPY --from=backend-builder /app/prisma ./prisma

# Generate Prisma client for production
RUN npx prisma generate

# Copy built application
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/public ./public

# Create data directory
RUN mkdir -p data

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'if [ -z "$JWT_SECRET" ]; then' >> /app/start.sh && \
    echo '  echo "⚠️  WARNING: No JWT_SECRET provided. Generating random secret for this session."' >> /app/start.sh && \
    echo '  echo "⚠️  For production, please set JWT_SECRET environment variable!"' >> /app/start.sh && \
    echo '  export JWT_SECRET=$(openssl rand -base64 64 | tr -d "\\n")' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'exec node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 4000

# Expose data directory as volume
VOLUME ["/app/data"]

# Set environment variables with sensible defaults
ENV NODE_ENV=production

# Start command
CMD ["/app/start.sh"] 