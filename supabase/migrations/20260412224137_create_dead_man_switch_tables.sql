/*
  # Dead-Man Switch: Integration Failure Tracking

  ## Summary
  Creates two tables to support the dead-man switch system for Notion and Google Drive:
  automatic write-pause and lock when either integration fails 3 consecutive times.

  ## New Tables

  ### `integration_failure_log`
  Records every individual API failure for Notion or Drive.
  - `id` (uuid, primary key)
  - `integration` (text) — 'notion' | 'drive'
  - `error_code` (text) — HTTP status code as string, e.g. '401', '403', '404', or 'network'
  - `error_message` (text) — full error message
  - `operation` (text) — which operation was being attempted (e.g. 'sync_file', 'push_task')
  - `created_at` (timestamptz)

  ### `integration_locks`
  Stores the current lock state for each integration.
  - `id` (uuid, primary key)
  - `integration` (text, unique) — 'notion' | 'drive'
  - `locked` (boolean) — true = writes are paused, requires user review to resume
  - `consecutive_failures` (integer) — running count since last success
  - `locked_at` (timestamptz) — when the lock was engaged
  - `last_error_code` (text) — error code that triggered the lock
  - `last_error_message` (text)
  - `affected_operations` (text[]) — operations that were being blocked
  - `resolved_at` (timestamptz) — when the user cleared the lock
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Authenticated users can read and write their own lock/failure records

  ## Important Notes
  1. `integration_locks` uses UPSERT on `integration` column (unique)
  2. `integration_failure_log` is append-only — no DELETE policy
  3. The lock is engaged client-side when `consecutive_failures >= 3`
*/

CREATE TABLE IF NOT EXISTS public.integration_failure_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL CHECK (integration IN ('notion', 'drive')),
  error_code text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  operation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read integration_failure_log"
  ON public.integration_failure_log FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert integration_failure_log"
  ON public.integration_failure_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_integration_failure_log_integration_created
  ON public.integration_failure_log (integration, created_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text UNIQUE NOT NULL CHECK (integration IN ('notion', 'drive')),
  locked boolean NOT NULL DEFAULT false,
  consecutive_failures integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  last_error_code text NOT NULL DEFAULT '',
  last_error_message text NOT NULL DEFAULT '',
  affected_operations text[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read integration_locks"
  ON public.integration_locks FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert integration_locks"
  ON public.integration_locks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update integration_locks"
  ON public.integration_locks FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_integration_locks_integration
  ON public.integration_locks (integration);

INSERT INTO public.integration_locks (integration, locked, consecutive_failures)
VALUES ('notion', false, 0), ('drive', false, 0)
ON CONFLICT (integration) DO NOTHING;
