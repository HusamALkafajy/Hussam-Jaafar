#!/bin/bash
set -e

# ====================================================
# StudyAI - Staging Deployment Script
# ====================================================

echo "🚀 Starting Staging Deployment for StudyAI..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git checkout main
git pull origin main

# 2. Spin up/update Infrastructure (Postgres & Redis)
echo "🐳 Starting Infrastructure Containers..."
docker compose -f docker-compose.staging.yml up -d

# Wait for Postgres to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec studyai-postgres pg_isready -U studyai -d studyai_staging; do
  sleep 2
done

# 3. Install dependencies
echo "📦 Installing pnpm dependencies..."
pnpm install --frozen-lockfile

# 4. Run Database Migrations
echo "🗄️ Running Drizzle Database Migrations..."
# Safely apply migrations against the active DB
pnpm --filter @studyai/database db:migrate

# 5. Build Monorepo (Next.js & NestJS)
echo "🏗️ Building Applications (Web & API)..."
pnpm run build

# 6. Restart PM2 processes
# Assumes PM2 ecosystem.config.js is configured for the VPS
echo "🔄 Restarting API and Web services via PM2..."
pm2 reload all || pm2 start ecosystem.config.js

echo "✅ Deployment Successful!"