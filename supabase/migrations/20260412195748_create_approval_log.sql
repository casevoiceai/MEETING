/*
  # Approval Log Table

  ## Summary
  Creates a universal approval log table that tracks every action proposed
  by the Team (AI mentors, automated systems) that requires explicit user
  approval before execution. This enforces the core rule:
  "No meaningful action is completed without user approval."

  ## New Tables

  ### approval_log
  Tracks every proposed action across all systems.

  - `id` (uuid, primary key)
  - `action_type` (text) — category of action:
      'email_delete' | 'email_archive' | 'email_draft_send' |
      'task_complete' | 'task_delete' | 'project_rename' | 'project_delete' |
      'file_delete' | 'file_move' | 'notion_sync' | 'drive_sync_destructive' |
      'session_end_sync' | 'report_publish' | 'external_integration' | 'other'
  - `status` (text) — 'draft' | 'suggested' | 'pending_approval' | 'approved' | 'rejected' | 'completed'
  - `proposed_by` (text) — who/what proposed this ('JULIE' | 'SYSTEM' | mentor name)
  - `title` (text) — short human-readable description of the proposed action
  - `description` (text) — full detail of what will happen
  - `payload` (jsonb) — structured data for the action (IDs, content, etc.)
  - `context` (jsonb) — additional context (session ID, project ID, related items)
  - `blocked_reason` (text) — why action was blocked before user could approve
  - `approved_at` (timestamptz) — when user approved
  - `rejected_at` (timestamptz)
  - `completed_at` (timestamptz) — when the approved action was actually executed
  - `rejection_reason` (text)
  - `session_id` (uuid) — optional session this relates to
  - `auto_approved` (boolean) — true for allowed auto-actions (note saves, tagging, etc.)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled, anon can read/insert/update
*/

CREATE TABLE IF NOT EXISTS approval_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'pending_approval',
  proposed_by text NOT NULL DEFAULT 'SYSTEM',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  payload jsonb DEFAULT '{}'::jsonb,
  context jsonb DEFAULT '{}'::jsonb,
  blocked_reason text DEFAULT '',
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  rejection_reason text DEFAULT '',
  session_id uuid,
  auto_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE approval_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read approval_log"
  ON approval_log FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert approval_log"
  ON approval_log FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update approval_log"
  ON approval_log FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_approval_log_status ON approval_log(status);
CREATE INDEX IF NOT EXISTS idx_approval_log_action_type ON approval_log(action_type);
CREATE INDEX IF NOT EXISTS idx_approval_log_session ON approval_log(session_id);
CREATE INDEX IF NOT EXISTS idx_approval_log_created ON approval_log(created_at DESC);
