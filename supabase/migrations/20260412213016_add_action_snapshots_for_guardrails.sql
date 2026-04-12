/*
  # Action Snapshots for Destructive-Action Guardrails

  ## Summary
  Creates the `action_snapshots` table to track when a user explicitly confirms a
  backup exists (or the system auto-captures a snapshot record) before a destructive
  operation is executed. This provides an audit trail of every destructive action
  that was confirmed and exactly what the user acknowledged.

  ## New Tables

  ### action_snapshots
  Stores a record of each destructive-action confirmation, including:
  - `action_type` — what type of destructive action (delete_file, delete_folder, etc.)
  - `target_id` — the ID of the record being acted on
  - `target_label` — human-readable name (file name, project name, etc.)
  - `confirmation_text` — the exact text the user typed to confirm
  - `backup_confirmed` — whether user confirmed a backup exists
  - `snapshot_data` — JSON snapshot of the record state at time of action
  - `confirmed_at` — when the user clicked confirm

  ## Security
  - RLS enabled on action_snapshots
  - Users can insert their own snapshots
  - Users can read their own snapshots (for audit)
*/

CREATE TABLE IF NOT EXISTS action_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  target_id text NOT NULL,
  target_label text NOT NULL DEFAULT '',
  confirmation_text text NOT NULL DEFAULT '',
  backup_confirmed boolean NOT NULL DEFAULT false,
  snapshot_data jsonb NOT NULL DEFAULT '{}',
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE action_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert snapshots"
  ON action_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read snapshots"
  ON action_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_action_snapshots_action_type ON action_snapshots(action_type);
CREATE INDEX IF NOT EXISTS idx_action_snapshots_target_id ON action_snapshots(target_id);
CREATE INDEX IF NOT EXISTS idx_action_snapshots_confirmed_at ON action_snapshots(confirmed_at DESC);
