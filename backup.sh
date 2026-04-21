#!/bin/bash
# enavu-hub daily Postgres backup → Google Drive
# Saves timestamped dump locally + syncs to Google Drive via rclone

set -euo pipefail

BACKUP_DIR="$HOME/Documents/enavu-hub/backups"
RCLONE_REMOTE="gdrive:enavu-hub-backups"
KEEP_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="enavu_hub_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: $FILENAME"

# Dump Postgres from running container and compress
~/.rd/bin/docker exec enavu-hub-postgres-1 \
  pg_dump -U enavu enavu_hub | gzip > "$BACKUP_DIR/$FILENAME"

echo "[$(date)] Dump complete: $(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)"

# Sync to Google Drive
rclone copy "$BACKUP_DIR/$FILENAME" "$RCLONE_REMOTE" \
  --log-level INFO

echo "[$(date)] Synced to Google Drive ($RCLONE_REMOTE)"

# Delete local dumps older than KEEP_DAYS
find "$BACKUP_DIR" -name "enavu_hub_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Cleaned up dumps older than ${KEEP_DAYS} days"

echo "[$(date)] Backup done ✓"
