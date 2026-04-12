/*
  # Notion Fallback Mode

  ## Summary
  Enhances the notion_sync_log table to fully support fallback mode when
  Notion is unavailable. Items are saved locally with a "notion_sync_pending"
  status and retried automatically when Notion becomes available.

  Also tracks the Notion connection status in integration_settings with a
  last_error field for display in the UI.

  ## Changes to notion_sync_log
  - New status value: 'notion_sync_pending' — saved locally, waiting for Notion
  - New column `last_error_at` (timestamptz) — when the last failure occurred
  - New column `next_retry_at` (timestamptz) — when to attempt next retry

  ## Changes to integration_settings
  - New column `last_error` (text) — last connection error message
  - New column `last_error_at` (timestamptz) — when the last error occurred
  - New column `fallback_mode` (boolean) — true when operating in fallback mode
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_sync_log' AND column_name = 'last_error_at'
  ) THEN
    ALTER TABLE notion_sync_log ADD COLUMN last_error_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notion_sync_log' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE notion_sync_log ADD COLUMN next_retry_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE integration_settings ADD COLUMN last_error text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'last_error_at'
  ) THEN
    ALTER TABLE integration_settings ADD COLUMN last_error_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_settings' AND column_name = 'fallback_mode'
  ) THEN
    ALTER TABLE integration_settings ADD COLUMN fallback_mode boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notion_sync_log_pending ON notion_sync_log(status, next_retry_at)
  WHERE status IN ('notion_sync_pending', 'failed');
