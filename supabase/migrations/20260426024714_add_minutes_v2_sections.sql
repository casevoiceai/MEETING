/*
  # Add v2 sections to meeting_minutes

  1. Modified Tables
    - `meeting_minutes`
      - `julie_review` (text) — short plain-English summary from Julie's perspective
      - `post_followups` (text[]) — post-meeting follow-up actions
      - `unresolved` (text[]) — discussed but not resolved items
      - `pinned_ideas` (text[]) — ideas worth saving for later
      - `rejected_ideas` (text[]) — intentionally rejected/parked ideas
      - `eod_closeout` (jsonb) — EOD closeout with: accomplished, open_items, next_action, needs_followup_tasks

  2. Notes
    - All columns default to empty to not break existing rows
    - eod_closeout is jsonb for structured access
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_minutes' AND column_name = 'julie_review') THEN
    ALTER TABLE meeting_minutes ADD COLUMN julie_review text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_minutes' AND column_name = 'post_followups') THEN
    ALTER TABLE meeting_minutes ADD COLUMN post_followups text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_minutes' AND column_name = 'unresolved') THEN
    ALTER TABLE meeting_minutes ADD COLUMN unresolved text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_minutes' AND column_name = 'pinned_ideas') THEN
    ALTER TABLE meeting_minutes ADD COLUMN pinned_ideas text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_minutes' AND column_name = 'rejected_ideas') THEN
    ALTER TABLE meeting_minutes ADD COLUMN rejected_ideas text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_minutes' AND column_name = 'eod_closeout') THEN
    ALTER TABLE meeting_minutes ADD COLUMN eod_closeout jsonb NOT NULL DEFAULT '{"accomplished":"","open_items":[],"next_action":"","needs_followup_tasks":false}';
  END IF;
END $$;
