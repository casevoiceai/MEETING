/*
  # File Quarantine System

  ## Summary
  Adds quarantine status tracking to vault_files so every uploaded file
  goes through a security pipeline (type validation, size check, content
  scan placeholder). Files are assigned one of three statuses and
  quarantined/blocked files are prevented from being previewed or shared.

  ## Changes to vault_files
  - New column `quarantine_status` (text, default 'pending')
      Values: 'pending' | 'clean' | 'quarantined' | 'blocked'
  - New column `quarantine_reason` (text, default '')
      Human-readable reason when status is quarantined or blocked
  - New column `quarantine_scanned_at` (timestamptz)
      Timestamp when the last scan completed

  ## Security
  - 'quarantined' files: preview disabled, team access disabled
  - 'blocked' files: storage access should be revoked; file kept for audit
  - 'pending' files: treated as quarantined until scan completes
  - 'clean' files: full access granted

  ## Index
  - Index on quarantine_status for fast filtering in Vault queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'quarantine_status'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN quarantine_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'quarantine_reason'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN quarantine_reason text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'quarantine_scanned_at'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN quarantine_scanned_at timestamptz;
  END IF;
END $$;

UPDATE vault_files
SET quarantine_status = 'clean', quarantine_scanned_at = now()
WHERE quarantine_status = 'pending' OR quarantine_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_vault_files_quarantine_status ON vault_files(quarantine_status);
