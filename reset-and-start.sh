#!/bin/bash

echo "🔄 Resetting Random Walk Project..."

# Kill all running processes
echo "🛑 Stopping all processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "prisma studio" 2>/dev/null || true
sleep 2

# Stop Docker containers if running
echo "🐳 Stopping Docker containers..."
docker-compose down 2>/dev/null || true
sleep 2

# Remove database files
echo "🗑️  Wiping database..."
rm -f backend/data/randomwalk.db*
rm -f backend/prisma/dev.db*

# Reset database with migrations
echo "🔄 Resetting database..."
cd backend
npx prisma migrate reset --force --skip-seed
cd ..

# Clean build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf backend/dist/
rm -rf backend/public/
rm -rf frontend/dist/

# Build frontend for development
echo "🏗️  Building frontend..."
cd backend && npm run build:frontend && cd ..

echo "✅ Reset complete!"
echo "🚀 Starting application..."

# Start the development server
npm run dev 