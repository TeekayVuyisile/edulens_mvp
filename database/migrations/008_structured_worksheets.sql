-- AI worksheets are stored as structured JSON (title, instructions, typed
-- questions with answers) instead of AI-written HTML, which was rendered
-- unsanitised. Requests also record the language, question types, model and
-- token usage. Safe to re-run.

ALTER TABLE worksheet_requests
  ADD COLUMN IF NOT EXISTS language VARCHAR(30) NOT NULL DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS question_types TEXT[],
  ADD COLUMN IF NOT EXISTS model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;

ALTER TABLE worksheet_library
  ADD COLUMN IF NOT EXISTS content JSONB,
  ADD COLUMN IF NOT EXISTS language VARCHAR(30) NOT NULL DEFAULT 'English',
  ALTER COLUMN content_html DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worksheet_requests_teacher_created ON worksheet_requests (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worksheet_library_school ON worksheet_library (school_id, created_at DESC);
