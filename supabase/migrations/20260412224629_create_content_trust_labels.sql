/*
  # Prompt Injection Protection: Content Trust Labels

  ## Summary
  Creates a table to track the trust classification and injection scan results
  for all externally-ingested content (emails, attachments, imported documents,
  pasted text). Every piece of external content gets a trust label and an
  injection analysis record before it is processed by the system.

  ## New Table

  ### `content_trust_labels`
  Stores the trust classification and injection scan result for a unit of content.

  - `id` (uuid, primary key)
  - `content_ref` (text) — identifier for the content (email id, file id, paste hash, etc.)
  - `content_type` (text) — 'email' | 'attachment' | 'document' | 'paste' | 'web'
  - `trust_level` (text) — 'trusted' | 'untrusted' | 'quarantined' — default: 'untrusted'
  - `injection_detected` (boolean) — true if injection patterns were found
  - `injection_flags` (text[]) — list of specific patterns that triggered
  - `sandbox_summary` (text) — safe extracted summary (from sandbox mode only)
  - `sandbox_tags` (text[]) — safe extracted tags
  - `sandbox_metadata` (jsonb) — safe extracted metadata (sender, dates, subject, etc.)
  - `blocked_instructions` (text[]) — instructions found in content that were blocked
  - `raw_content_hash` (text) — SHA-256 hash of the raw content for deduplication
  - `scanned_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled — authenticated users only
  - No DELETE policy — trust labels are immutable audit records

  ## Important Notes
  1. Default trust_level is 'untrusted' — content must pass the scan to be promoted
  2. injection_detected = true forces trust_level to 'quarantined'
  3. blocked_instructions are logged but NEVER executed
*/

CREATE TABLE IF NOT EXISTS public.content_trust_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_ref text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'untrusted' CHECK (content_type IN ('email', 'attachment', 'document', 'paste', 'web')),
  trust_level text NOT NULL DEFAULT 'untrusted' CHECK (trust_level IN ('trusted', 'untrusted', 'quarantined')),
  injection_detected boolean NOT NULL DEFAULT false,
  injection_flags text[] NOT NULL DEFAULT '{}',
  sandbox_summary text NOT NULL DEFAULT '',
  sandbox_tags text[] NOT NULL DEFAULT '{}',
  sandbox_metadata jsonb NOT NULL DEFAULT '{}',
  blocked_instructions text[] NOT NULL DEFAULT '{}',
  raw_content_hash text NOT NULL DEFAULT '',
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_trust_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read content_trust_labels"
  ON public.content_trust_labels FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert content_trust_labels"
  ON public.content_trust_labels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_content_trust_labels_content_ref
  ON public.content_trust_labels (content_ref);

CREATE INDEX IF NOT EXISTS idx_content_trust_labels_trust_level
  ON public.content_trust_labels (trust_level);

CREATE INDEX IF NOT EXISTS idx_content_trust_labels_injection
  ON public.content_trust_labels (injection_detected) WHERE injection_detected = true;
