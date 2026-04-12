/*
  # Security Hardening: Indexes and RLS Policies

  ## Summary
  This migration addresses all security and performance warnings:

  ### 1. Add Missing Foreign Key Indexes
  - `email_analyses.email_id` — new index to cover FK
  - `email_attachments.email_id` — new index to cover FK
  - `email_drafts.email_id` — new index to cover FK

  ### 2. Drop Duplicate Indexes
  Keeping the `idx_` prefixed canonical versions, dropping the legacy duplicates:
  - Drop `linked_items_source_idx` (duplicate of `idx_linked_items_source`)
  - Drop `linked_items_target_idx` (duplicate of `idx_linked_items_target`)
  - Drop `project_notes_project_id_idx` (duplicate of `idx_project_notes_project_id`)
  - Drop `project_tasks_project_id_idx` (duplicate of `idx_project_tasks_project_id`)
  - Drop `sessions_session_key_idx` (duplicate of `idx_sessions_session_key`)

  ### 3. Drop Unused Standalone Indexes
  Indexes that have not been used and are not needed for FK coverage or unique constraints.
  Note: Indexes on FK columns that already have FK coverage via a proper index are retained.

  ### 4. Fix RLS Policies (Always-True → Authenticated-Scoped)
  All "always true" policies are replaced with proper `auth.uid() IS NOT NULL` checks
  (allowing any authenticated user to operate on shared/single-tenant data).
  `anon` role policies are replaced with `authenticated` role policies.
  This ensures only logged-in users can write data.
*/

-- ============================================================
-- SECTION 1: Add missing FK indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_email_analyses_email_id
  ON public.email_analyses (email_id);

CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id
  ON public.email_attachments (email_id);

CREATE INDEX IF NOT EXISTS idx_email_drafts_email_id
  ON public.email_drafts (email_id);

-- ============================================================
-- SECTION 2: Drop duplicate indexes (keep idx_ prefixed)
-- ============================================================

DROP INDEX IF EXISTS public.linked_items_source_idx;
DROP INDEX IF EXISTS public.linked_items_target_idx;
DROP INDEX IF EXISTS public.project_notes_project_id_idx;
DROP INDEX IF EXISTS public.project_tasks_project_id_idx;
DROP INDEX IF EXISTS public.sessions_session_key_idx;

-- ============================================================
-- SECTION 3: Drop unused standalone indexes
-- ============================================================

-- sessions
DROP INDEX IF EXISTS public.sessions_archived_idx;
DROP INDEX IF EXISTS public.sessions_key_topics_gin;

-- side_notes
DROP INDEX IF EXISTS public.side_notes_tags_gin;
DROP INDEX IF EXISTS public.side_notes_mentors_gin;
DROP INDEX IF EXISTS public.side_notes_session_id_idx;
DROP INDEX IF EXISTS public.side_notes_project_id_idx;
DROP INDEX IF EXISTS public.side_notes_archived_idx;

-- vault_files
DROP INDEX IF EXISTS public.vault_files_tags_gin;
DROP INDEX IF EXISTS public.vault_files_archived_idx;
DROP INDEX IF EXISTS public.vault_files_linked_session_id_idx;
DROP INDEX IF EXISTS public.idx_vault_files_quarantine_status;

-- vault_folders
DROP INDEX IF EXISTS public.idx_vault_folders_parent_id;

-- emails
DROP INDEX IF EXISTS public.emails_tags_gin;
DROP INDEX IF EXISTS public.idx_emails_linked_project_id;
DROP INDEX IF EXISTS public.idx_emails_linked_session_id;

-- julie_reports / transcripts
DROP INDEX IF EXISTS public.idx_julie_reports_session_id;
DROP INDEX IF EXISTS public.idx_session_transcripts_session_id;

-- vault_files FK indexes (keep coverage ones, drop redundant)
DROP INDEX IF EXISTS public.idx_vault_files_folder_id;
DROP INDEX IF EXISTS public.idx_vault_files_linked_project_id;
DROP INDEX IF EXISTS public.idx_vault_files_linked_session_id;

-- linked_items
DROP INDEX IF EXISTS public.idx_linked_items_source;
DROP INDEX IF EXISTS public.idx_linked_items_target;

-- approval_log
DROP INDEX IF EXISTS public.idx_approval_log_status;
DROP INDEX IF EXISTS public.idx_approval_log_action_type;
DROP INDEX IF EXISTS public.idx_approval_log_session;
DROP INDEX IF EXISTS public.idx_approval_log_created;

-- drive_sync_log
DROP INDEX IF EXISTS public.idx_drive_sync_log_status;
DROP INDEX IF EXISTS public.idx_drive_sync_log_session;
DROP INDEX IF EXISTS public.idx_drive_sync_log_local_file;

-- notion_sync_log
DROP INDEX IF EXISTS public.idx_notion_sync_log_status;
DROP INDEX IF EXISTS public.idx_notion_sync_log_session;
DROP INDEX IF EXISTS public.idx_notion_sync_log_pending;

-- action_snapshots
DROP INDEX IF EXISTS public.idx_action_snapshots_action_type;
DROP INDEX IF EXISTS public.idx_action_snapshots_target_id;
DROP INDEX IF EXISTS public.idx_action_snapshots_confirmed_at;

-- ============================================================
-- SECTION 4: Re-create essential FK coverage indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vault_files_folder_id
  ON public.vault_files (folder_id);

CREATE INDEX IF NOT EXISTS idx_vault_files_linked_project_id
  ON public.vault_files (linked_project_id);

CREATE INDEX IF NOT EXISTS idx_vault_files_linked_session_id
  ON public.vault_files (linked_session_id);

CREATE INDEX IF NOT EXISTS idx_julie_reports_session_id
  ON public.julie_reports (session_id);

CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id
  ON public.session_transcripts (session_id);

CREATE INDEX IF NOT EXISTS idx_linked_items_source
  ON public.linked_items (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_linked_items_target
  ON public.linked_items (target_type, target_id);

-- ============================================================
-- SECTION 5: Fix always-true RLS policies
-- ============================================================

-- ---- action_snapshots ----
DROP POLICY IF EXISTS "Anyone can insert snapshots" ON public.action_snapshots;
CREATE POLICY "Authenticated users can insert snapshots"
  ON public.action_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- approval_log ----
DROP POLICY IF EXISTS "Allow anon insert approval_log" ON public.approval_log;
DROP POLICY IF EXISTS "Allow anon update approval_log" ON public.approval_log;

CREATE POLICY "Authenticated users can insert approval_log"
  ON public.approval_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update approval_log"
  ON public.approval_log FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- drive_sync_log ----
DROP POLICY IF EXISTS "Allow anon insert drive_sync_log" ON public.drive_sync_log;
DROP POLICY IF EXISTS "Allow anon update drive_sync_log" ON public.drive_sync_log;

CREATE POLICY "Authenticated users can insert drive_sync_log"
  ON public.drive_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update drive_sync_log"
  ON public.drive_sync_log FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- notion_sync_log ----
DROP POLICY IF EXISTS "Allow anon insert notion_sync_log" ON public.notion_sync_log;
DROP POLICY IF EXISTS "Allow anon update notion_sync_log" ON public.notion_sync_log;

CREATE POLICY "Authenticated users can insert notion_sync_log"
  ON public.notion_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update notion_sync_log"
  ON public.notion_sync_log FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- integration_settings ----
DROP POLICY IF EXISTS "Allow anon insert integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Allow anon update integration_settings" ON public.integration_settings;

CREATE POLICY "Authenticated users can insert integration_settings"
  ON public.integration_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update integration_settings"
  ON public.integration_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- linked_items ----
DROP POLICY IF EXISTS "Anon users can insert linked items" ON public.linked_items;
DROP POLICY IF EXISTS "Anon users can delete linked items" ON public.linked_items;
DROP POLICY IF EXISTS "Authenticated users can insert linked items" ON public.linked_items;
DROP POLICY IF EXISTS "Authenticated users can delete linked items" ON public.linked_items;

CREATE POLICY "Authenticated users can insert linked items"
  ON public.linked_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete linked items"
  ON public.linked_items FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- email_analyses ----
DROP POLICY IF EXISTS "Authenticated users can insert email_analyses" ON public.email_analyses;
DROP POLICY IF EXISTS "Authenticated users can update email_analyses" ON public.email_analyses;

CREATE POLICY "Authenticated users can insert email_analyses"
  ON public.email_analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update email_analyses"
  ON public.email_analyses FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- email_attachments ----
DROP POLICY IF EXISTS "Authenticated users can insert email_attachments" ON public.email_attachments;

CREATE POLICY "Authenticated users can insert email_attachments"
  ON public.email_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- email_drafts ----
DROP POLICY IF EXISTS "Authenticated users can insert email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "Authenticated users can update email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "Authenticated users can delete email_drafts" ON public.email_drafts;

CREATE POLICY "Authenticated users can insert email_drafts"
  ON public.email_drafts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update email_drafts"
  ON public.email_drafts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete email_drafts"
  ON public.email_drafts FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- emails ----
DROP POLICY IF EXISTS "Authenticated users can insert emails" ON public.emails;
DROP POLICY IF EXISTS "Authenticated users can update emails" ON public.emails;
DROP POLICY IF EXISTS "Authenticated users can delete emails" ON public.emails;

CREATE POLICY "Authenticated users can insert emails"
  ON public.emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update emails"
  ON public.emails FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete emails"
  ON public.emails FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- julie_reports ----
DROP POLICY IF EXISTS "Allow insert julie_reports" ON public.julie_reports;
DROP POLICY IF EXISTS "Allow update julie_reports" ON public.julie_reports;

CREATE POLICY "Authenticated users can insert julie_reports"
  ON public.julie_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update julie_reports"
  ON public.julie_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- project_notes ----
DROP POLICY IF EXISTS "Allow insert project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Allow update project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Allow delete project_notes" ON public.project_notes;

CREATE POLICY "Authenticated users can insert project_notes"
  ON public.project_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project_notes"
  ON public.project_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project_notes"
  ON public.project_notes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- project_tasks ----
DROP POLICY IF EXISTS "Allow insert project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project_tasks" ON public.project_tasks;

CREATE POLICY "Authenticated users can insert project_tasks"
  ON public.project_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update project_tasks"
  ON public.project_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete project_tasks"
  ON public.project_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- projects ----
DROP POLICY IF EXISTS "Allow insert projects" ON public.projects;
DROP POLICY IF EXISTS "Allow update projects" ON public.projects;

CREATE POLICY "Authenticated users can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- session_memory ----
DROP POLICY IF EXISTS "Allow insert session_memory" ON public.session_memory;
DROP POLICY IF EXISTS "Allow update session_memory" ON public.session_memory;

CREATE POLICY "Authenticated users can insert session_memory"
  ON public.session_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update session_memory"
  ON public.session_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- session_transcripts ----
DROP POLICY IF EXISTS "Allow insert transcripts" ON public.session_transcripts;
DROP POLICY IF EXISTS "Allow update transcripts" ON public.session_transcripts;

CREATE POLICY "Authenticated users can insert session_transcripts"
  ON public.session_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update session_transcripts"
  ON public.session_transcripts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- sessions ----
DROP POLICY IF EXISTS "Allow insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow update sessions" ON public.sessions;

CREATE POLICY "Authenticated users can insert sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- side_notes ----
DROP POLICY IF EXISTS "Allow insert side_notes" ON public.side_notes;
DROP POLICY IF EXISTS "Allow update side_notes" ON public.side_notes;
DROP POLICY IF EXISTS "Allow delete side_notes" ON public.side_notes;

CREATE POLICY "Authenticated users can insert side_notes"
  ON public.side_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update side_notes"
  ON public.side_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete side_notes"
  ON public.side_notes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- tag_registry ----
DROP POLICY IF EXISTS "Allow insert tag_registry" ON public.tag_registry;
DROP POLICY IF EXISTS "Allow update tag_registry" ON public.tag_registry;

CREATE POLICY "Authenticated users can insert tag_registry"
  ON public.tag_registry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tag_registry"
  ON public.tag_registry FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- vault_files ----
DROP POLICY IF EXISTS "Authenticated users can insert vault files" ON public.vault_files;
DROP POLICY IF EXISTS "Authenticated users can update vault files" ON public.vault_files;
DROP POLICY IF EXISTS "Authenticated users can delete vault files" ON public.vault_files;

CREATE POLICY "Authenticated users can insert vault files"
  ON public.vault_files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update vault files"
  ON public.vault_files FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete vault files"
  ON public.vault_files FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---- vault_folders ----
DROP POLICY IF EXISTS "Authenticated users can insert vault folders" ON public.vault_folders;
DROP POLICY IF EXISTS "Authenticated users can update vault folders" ON public.vault_folders;
DROP POLICY IF EXISTS "Authenticated users can delete vault folders" ON public.vault_folders;

CREATE POLICY "Authenticated users can insert vault folders"
  ON public.vault_folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update vault folders"
  ON public.vault_folders FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete vault folders"
  ON public.vault_folders FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
