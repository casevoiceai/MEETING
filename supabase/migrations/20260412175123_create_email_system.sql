/*
  # Create Email System Tables

  ## Overview
  Foundation for V2 email integration. Stores inbound emails, attachments,
  team analysis, and draft replies.

  ## New Tables

  ### emails
  - `id` (uuid, PK)
  - `subject` (text)
  - `sender_name` (text)
  - `sender_email` (text)
  - `body` (text) — raw email body
  - `received_at` (timestamptz)
  - `is_read` (boolean, default false)
  - `archived` (boolean, default false)
  - `tags` (text[])
  - `linked_session_id` (uuid, FK → sessions)
  - `linked_project_id` (uuid, FK → projects)
  - `created_at` (timestamptz)

  ### email_attachments
  - `id` (uuid, PK)
  - `email_id` (uuid, FK → emails)
  - `filename` (text)
  - `content_type` (text) — mime type hint
  - `content` (text) — pasted or extracted text content
  - `routed_to` (text) — which mentor owns this attachment
  - `created_at` (timestamptz)

  ### email_analyses
  - `id` (uuid, PK)
  - `email_id` (uuid, FK → emails)
  - `summary` (text)
  - `intent` (text)
  - `risks` (text[])
  - `opportunities` (text[])
  - `suggested_tone` (text)
  - `key_points` (text[])
  - `tags` (text[])
  - `mentor_insights` (jsonb) — per-mentor analysis snippets
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### email_drafts
  - `id` (uuid, PK)
  - `email_id` (uuid, FK → emails)
  - `tone` (text) — formal | direct | friendly | assertive
  - `body` (text) — draft text
  - `drafted_by` (text) — which mentor drafted it
  - `approved_by_user` (boolean, default false)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - All rows accessible to authenticated users only

  ## Important Notes
  1. SEND LOCK: No automated send capability is built into this schema.
     The approved_by_user flag marks user approval only — sending is always manual.
  2. email_analyses.mentor_insights is JSONB for flexible per-mentor storage.
*/

CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT '',
  sender_name text NOT NULL DEFAULT '',
  sender_email text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  received_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  archived boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  linked_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'text/plain',
  content text NOT NULL DEFAULT '',
  routed_to text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  summary text DEFAULT '',
  intent text DEFAULT '',
  risks text[] DEFAULT '{}',
  opportunities text[] DEFAULT '{}',
  suggested_tone text DEFAULT '',
  key_points text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  mentor_insights jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  tone text NOT NULL DEFAULT 'direct',
  body text NOT NULL DEFAULT '',
  drafted_by text NOT NULL DEFAULT '',
  approved_by_user boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read emails"
  ON emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update emails"
  ON emails FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete emails"
  ON emails FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read email_attachments"
  ON email_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_attachments"
  ON email_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read email_analyses"
  ON email_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_analyses"
  ON email_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email_analyses"
  ON email_analyses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read email_drafts"
  ON email_drafts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_drafts"
  ON email_drafts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email_drafts"
  ON email_drafts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete email_drafts"
  ON email_drafts FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_emails_archived ON emails(archived);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analyses_email_id ON email_analyses(email_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_email_id ON email_drafts(email_id);
