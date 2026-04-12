/*
  # Integration Sync Tables

  ## Summary
  Adds tables to support Google Drive and Notion integration sync state.
  All sync operations are tracked with status, error messages, and retry counts.
  Integration credentials are stored per-integration type.

  ## New Tables

  ### integration_settings
  Stores connection credentials and config for each integration.
  - `id` (uuid, primary key)
  - `integration_type` (text) — 'google_drive' | 'notion'
  - `access_token` (text) — OAuth token or API key (treated as opaque)
  - `refresh_token` (text) — for OAuth integrations
  - `config` (jsonb) — integration-specific config (folder IDs, DB IDs, etc.)
  - `connected` (boolean) — whether the integration is active
  - `connected_at` (timestamptz)
  - `last_sync_at` (timestamptz)

  ### drive_sync_log
  Tracks every file pushed to Google Drive.
  - `id` (uuid)
  - `local_file_id` (uuid) — references vault_files.id (nullable for generated reports)
  - `session_id` (uuid) — which session triggered this
  - `drive_file_id` (text) — returned Google Drive file ID
  - `drive_url` (text) — shareable Drive URL
  - `drive_folder` (text) — which folder it went into
  - `file_name` (text)
  - `file_type` (text) — 'vault_file' | 'transcript' | 'side_note' | 'julie_report'
  - `status` (text) — 'pending' | 'syncing' | 'synced' | 'failed'
  - `error_message` (text)
  - `retry_count` (int)
  - `created_at` (timestamptz)
  - `synced_at` (timestamptz)

  ### notion_sync_log
  Tracks every record pushed to Notion databases.
  - `id` (uuid)
  - `notion_db` (text) — 'julie_reports' | 'tasks' | 'projects'
  - `notion_page_id` (text) — returned Notion page ID
  - `local_id` (text) — local session/task/project ID this maps to
  - `local_type` (text) — 'session' | 'task' | 'project'
  - `session_id` (uuid)
  - `drive_links` (jsonb) — array of Drive URLs linked in this Notion page
  - `payload` (jsonb) — the data that was sent
  - `status` (text) — 'pending' | 'pending_approval' | 'approved' | 'syncing' | 'synced' | 'failed'
  - `approved_by_user` (boolean)
  - `error_message` (text)
  - `retry_count` (int)
  - `created_at` (timestamptz)
  - `synced_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public access allowed (no auth in this app) via permissive policies for anon
*/

CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type text NOT NULL UNIQUE,
  access_token text DEFAULT '',
  refresh_token text DEFAULT '',
  config jsonb DEFAULT '{}'::jsonb,
  connected boolean DEFAULT false,
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read integration_settings"
  ON integration_settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert integration_settings"
  ON integration_settings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update integration_settings"
  ON integration_settings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS drive_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_file_id uuid,
  session_id uuid,
  drive_file_id text DEFAULT '',
  drive_url text DEFAULT '',
  drive_folder text DEFAULT '',
  file_name text DEFAULT '',
  file_type text DEFAULT 'vault_file',
  status text DEFAULT 'pending',
  error_message text DEFAULT '',
  retry_count integer DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  synced_at timestamptz
);

ALTER TABLE drive_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read drive_sync_log"
  ON drive_sync_log FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert drive_sync_log"
  ON drive_sync_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update drive_sync_log"
  ON drive_sync_log FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS notion_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_db text DEFAULT '',
  notion_page_id text DEFAULT '',
  local_id text DEFAULT '',
  local_type text DEFAULT 'session',
  session_id uuid,
  drive_links jsonb DEFAULT '[]'::jsonb,
  payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending_approval',
  approved_by_user boolean DEFAULT false,
  error_message text DEFAULT '',
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  synced_at timestamptz
);

ALTER TABLE notion_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read notion_sync_log"
  ON notion_sync_log FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert notion_sync_log"
  ON notion_sync_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update notion_sync_log"
  ON notion_sync_log FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_drive_sync_log_status ON drive_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_drive_sync_log_session ON drive_sync_log(session_id);
CREATE INDEX IF NOT EXISTS idx_drive_sync_log_local_file ON drive_sync_log(local_file_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_status ON notion_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_session ON notion_sync_log(session_id);

INSERT INTO integration_settings (integration_type, connected, config)
VALUES 
  ('google_drive', false, '{"root_folder_name": "MyStatement", "folders": {"sessions": "", "files": "", "side_notes": "", "reports": ""}}'::jsonb),
  ('notion', false, '{"databases": {"julie_reports": "", "tasks": "", "projects": ""}}'::jsonb)
ON CONFLICT (integration_type) DO NOTHING;
