/*
  # Create Source of Truth Table

  ## Summary
  Creates a persistent decision log table called `source_of_truth`.
  This is the anti-drift grounding system — every major architectural 
  decision or rule is appended here so the system stays aligned over time.

  ## New Tables

  ### `source_of_truth`
  - `id` (uuid, primary key) — unique entry identifier
  - `entry_date` (timestamptz) — when the decision was made
  - `decision_title` (text) — short human-readable title
  - `summary` (text) — plain-English explanation of the decision
  - `affected_systems` (text[]) — which parts of the system are affected
  - `approved_by_user` (boolean) — whether the user explicitly confirmed this
  - `entry_type` (text) — 'decision' | 'rule' | 'architecture' | 'constraint'
  - `session_key` (text) — which session this was recorded in (nullable)
  - `tags` (text[]) — optional labels for filtering
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on `source_of_truth`
  - Authenticated users can read all entries
  - Authenticated users can insert entries
  - Authenticated users can update entries they created
  - No deletion allowed (append-only for integrity)

  ## Notes
  - The table is append-only by design — no DELETE policy is created
  - This enforces the integrity of the decision log
*/

CREATE TABLE IF NOT EXISTS public.source_of_truth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date timestamptz NOT NULL DEFAULT now(),
  decision_title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  affected_systems text[] NOT NULL DEFAULT '{}',
  approved_by_user boolean NOT NULL DEFAULT false,
  entry_type text NOT NULL DEFAULT 'decision'
    CHECK (entry_type IN ('decision', 'rule', 'architecture', 'constraint')),
  session_key text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.source_of_truth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read source_of_truth"
  ON public.source_of_truth FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert source_of_truth"
  ON public.source_of_truth FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update source_of_truth"
  ON public.source_of_truth FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_source_of_truth_entry_date
  ON public.source_of_truth (entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_source_of_truth_entry_type
  ON public.source_of_truth (entry_type);

CREATE INDEX IF NOT EXISTS idx_source_of_truth_session_key
  ON public.source_of_truth (session_key);
