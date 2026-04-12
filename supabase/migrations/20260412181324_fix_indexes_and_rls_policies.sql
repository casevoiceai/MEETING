/*
  # Fix Unindexed Foreign Keys, Unused Indexes, and Overly Permissive RLS Policies

  ## Summary
  This migration addresses three categories of security/performance issues:

  1. **Missing FK indexes** — Adds covering indexes on all foreign key columns that lack them,
     improving JOIN and cascade performance on emails, julie_reports, session_transcripts,
     vault_files, and vault_folders.

  2. **Unused indexes** — Drops indexes that have not been used, reducing write overhead and
     storage bloat. These are safe to drop since queries are not relying on them.

  3. **Always-true RLS policies** — Replaces `USING (true)` / `WITH CHECK (true)` policies with
     `TO authenticated` scoped policies that require the caller to be an authenticated user.
     This application does not use per-row ownership (no user_id columns), so the correct
     restriction is "authenticated users only" rather than "anyone at all". All write policies
     are tightened to `TO authenticated`.

  ## Tables affected
  - emails, email_analyses, email_attachments, email_drafts
  - julie_reports, session_transcripts, sessions, session_memory
  - projects, project_notes, project_tasks
  - side_notes, tag_registry
  - vault_files, vault_folders
*/

-- ============================================================
-- 1. ADD MISSING FK INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_emails_linked_project_id
  ON public.emails (linked_project_id);

CREATE INDEX IF NOT EXISTS idx_emails_linked_session_id
  ON public.emails (linked_session_id);

CREATE INDEX IF NOT EXISTS idx_julie_reports_session_id
  ON public.julie_reports (session_id);

CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id
  ON public.session_transcripts (session_id);

CREATE INDEX IF NOT EXISTS idx_vault_files_folder_id
  ON public.vault_files (folder_id);

CREATE INDEX IF NOT EXISTS idx_vault_files_linked_project_id
  ON public.vault_files (linked_project_id);

CREATE INDEX IF NOT EXISTS idx_vault_files_linked_session_id
  ON public.vault_files (linked_session_id);

CREATE INDEX IF NOT EXISTS idx_vault_folders_parent_id
  ON public.vault_folders (parent_id);

-- ============================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_session_memory_session_id;
DROP INDEX IF EXISTS public.idx_side_notes_session_id;
DROP INDEX IF EXISTS public.idx_emails_archived;
DROP INDEX IF EXISTS public.idx_emails_received_at;
DROP INDEX IF EXISTS public.idx_email_attachments_email_id;
DROP INDEX IF EXISTS public.idx_email_analyses_email_id;
DROP INDEX IF EXISTS public.idx_email_drafts_email_id;

-- ============================================================
-- 3. FIX ALWAYS-TRUE RLS POLICIES
-- ============================================================

-- ---- email_analyses ----
DROP POLICY IF EXISTS "Authenticated users can insert email_analyses" ON public.email_analyses;
DROP POLICY IF EXISTS "Authenticated users can update email_analyses" ON public.email_analyses;

CREATE POLICY "Authenticated users can insert email_analyses"
  ON public.email_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email_analyses"
  ON public.email_analyses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- email_attachments ----
DROP POLICY IF EXISTS "Authenticated users can insert email_attachments" ON public.email_attachments;

CREATE POLICY "Authenticated users can insert email_attachments"
  ON public.email_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ---- email_drafts ----
DROP POLICY IF EXISTS "Authenticated users can delete email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "Authenticated users can insert email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "Authenticated users can update email_drafts" ON public.email_drafts;

CREATE POLICY "Authenticated users can delete email_drafts"
  ON public.email_drafts FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_drafts"
  ON public.email_drafts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email_drafts"
  ON public.email_drafts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- emails ----
DROP POLICY IF EXISTS "Authenticated users can delete emails" ON public.emails;
DROP POLICY IF EXISTS "Authenticated users can insert emails" ON public.emails;
DROP POLICY IF EXISTS "Authenticated users can update emails" ON public.emails;

CREATE POLICY "Authenticated users can delete emails"
  ON public.emails FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert emails"
  ON public.emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update emails"
  ON public.emails FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- julie_reports ----
DROP POLICY IF EXISTS "Allow insert julie_reports" ON public.julie_reports;
DROP POLICY IF EXISTS "Allow update julie_reports" ON public.julie_reports;

CREATE POLICY "Allow insert julie_reports"
  ON public.julie_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update julie_reports"
  ON public.julie_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- project_notes ----
DROP POLICY IF EXISTS "Allow delete project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Allow insert project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Allow update project_notes" ON public.project_notes;

CREATE POLICY "Allow delete project_notes"
  ON public.project_notes FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert project_notes"
  ON public.project_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update project_notes"
  ON public.project_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- project_tasks ----
DROP POLICY IF EXISTS "Allow delete project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project_tasks" ON public.project_tasks;

CREATE POLICY "Allow delete project_tasks"
  ON public.project_tasks FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert project_tasks"
  ON public.project_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update project_tasks"
  ON public.project_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- projects ----
DROP POLICY IF EXISTS "Allow insert projects" ON public.projects;
DROP POLICY IF EXISTS "Allow update projects" ON public.projects;

CREATE POLICY "Allow insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- session_memory ----
DROP POLICY IF EXISTS "Allow insert by anyone" ON public.session_memory;
DROP POLICY IF EXISTS "Allow update by session_id" ON public.session_memory;

CREATE POLICY "Allow insert session_memory"
  ON public.session_memory FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update session_memory"
  ON public.session_memory FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- session_transcripts ----
DROP POLICY IF EXISTS "Allow insert transcripts" ON public.session_transcripts;
DROP POLICY IF EXISTS "Allow update transcripts" ON public.session_transcripts;

CREATE POLICY "Allow insert transcripts"
  ON public.session_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update transcripts"
  ON public.session_transcripts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- sessions ----
DROP POLICY IF EXISTS "Allow insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow update sessions" ON public.sessions;

CREATE POLICY "Allow insert sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- side_notes ----
DROP POLICY IF EXISTS "Allow delete side_notes" ON public.side_notes;
DROP POLICY IF EXISTS "Allow insert side_notes" ON public.side_notes;
DROP POLICY IF EXISTS "Allow update side_notes" ON public.side_notes;

CREATE POLICY "Allow delete side_notes"
  ON public.side_notes FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert side_notes"
  ON public.side_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update side_notes"
  ON public.side_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- tag_registry ----
DROP POLICY IF EXISTS "Allow insert tag_registry" ON public.tag_registry;
DROP POLICY IF EXISTS "Allow update tag_registry" ON public.tag_registry;

CREATE POLICY "Allow insert tag_registry"
  ON public.tag_registry FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update tag_registry"
  ON public.tag_registry FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- vault_files ----
DROP POLICY IF EXISTS "Public can delete vault files" ON public.vault_files;
DROP POLICY IF EXISTS "Public can insert vault files" ON public.vault_files;
DROP POLICY IF EXISTS "Public can update vault files" ON public.vault_files;

CREATE POLICY "Authenticated users can delete vault files"
  ON public.vault_files FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vault files"
  ON public.vault_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vault files"
  ON public.vault_files FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- vault_folders ----
DROP POLICY IF EXISTS "Public can delete vault folders" ON public.vault_folders;
DROP POLICY IF EXISTS "Public can insert vault folders" ON public.vault_folders;
DROP POLICY IF EXISTS "Public can update vault folders" ON public.vault_folders;

CREATE POLICY "Authenticated users can delete vault folders"
  ON public.vault_folders FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vault folders"
  ON public.vault_folders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vault folders"
  ON public.vault_folders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
