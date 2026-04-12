/*
  # Create Backup Logs Table

  ## Summary
  Creates a persistent log of all Critical Path (Tier 0) backup completions.
  Each row records when a backup was run, which checklist steps were completed,
  and which Tier 0 items were included in the export.

  ## New Tables

  ### `backup_logs`
  - `id` (uuid, primary key)
  - `backup_date` (timestamptz) — when the backup was performed
  - `tier` (text) — always 'tier0' for Critical Path backups
  - `items_exported` (text[]) — which Tier 0 items were included
  - `checklist_steps` (jsonb) — completion state of each checklist step
    Example: {"exported": true, "local_drive": false, "external_drive": false, "verified": true, "logged": true}
  - `notes` (text) — optional user notes for this backup run
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read, insert, and update their backup logs
  - No DELETE policy (append-only audit trail)

  ## Notes
  - This table drives the "last backup date" and "overdue" warning in the Recovery UI
  - The checklist_steps JSONB allows flexible step tracking without schema changes
*/

CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date timestamptz NOT NULL DEFAULT now(),
  tier text NOT NULL DEFAULT 'tier0'
    CHECK (tier IN ('tier0', 'partial')),
  items_exported text[] NOT NULL DEFAULT '{}',
  checklist_steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read backup_logs"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert backup_logs"
  ON public.backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update backup_logs"
  ON public.backup_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_backup_logs_backup_date
  ON public.backup_logs (backup_date DESC);

CREATE INDEX IF NOT EXISTS idx_backup_logs_tier
  ON public.backup_logs (tier);
