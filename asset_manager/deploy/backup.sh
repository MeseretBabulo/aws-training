#!/usr/bin/env bash
# Daily backup of database + photos. Add to crontab:  0 2 * * * /opt/asset_manager/deploy/backup.sh
set -euo pipefail
SRC=/opt/asset_manager/data
DEST=/opt/backups
mkdir -p "$DEST"
sqlite3 "$SRC/asset_manager.db" ".backup '$SRC/backup.db'"
tar -czf "$DEST/asset_manager-$(date +%F).tar.gz" -C "$SRC" backup.db uploads
rm -f "$SRC/backup.db"
find "$DEST" -name 'asset_manager-*.tar.gz' -mtime +30 -delete
