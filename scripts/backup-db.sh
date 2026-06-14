#!/bin/bash

# Database Backup Script for StudyAI
# Automatically dumps the PostgreSQL database, compresses it, and retains files for 7 days.

# Exit immediately if a command exits with a non-zero status
set -e

# Load environment variables if available
if [ -f ../.env ]; then
  export $(cat ../.env | xargs)
fi

DB_USER=${DATABASE_USER:-"postgres"}
DB_NAME=${DATABASE_NAME:-"studyai"}
DB_HOST=${DATABASE_HOST:-"localhost"}
DB_PORT=${DATABASE_PORT:-5432}
DB_PASS=${DATABASE_PASSWORD:-"postgres"}

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create backup directory if it does not exist
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup for $DB_NAME..."

# Export password for pg_dump
export PGPASSWORD="$DB_PASS"

# Run pg_dump and compress the output
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup completed successfully. Saved to $BACKUP_FILE"

# Clean up backups older than 7 days
echo "[$(date)] Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +7 -exec rm -f {} \;

echo "[$(date)] Database backup maintenance finished."
