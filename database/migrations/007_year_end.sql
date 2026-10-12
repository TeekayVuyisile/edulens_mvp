-- Year-end progression. Each school closes an academic year once: every
-- learner is promoted, kept back (repeated), finishes Foundation Phase
-- (graduated) or leaves, and the run is recorded. Safe to re-run.

-- Class history rows record how a year in a class ended; "promoted" is new.
-- (A value added here can't be used in this same transaction, and isn't.)
ALTER TYPE academic_status ADD VALUE IF NOT EXISTS 'promoted';

CREATE TABLE IF NOT EXISTS academic_year_rollovers (
    rollover_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    from_year INTEGER NOT NULL,
    to_year INTEGER NOT NULL,
    completed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (school_id, from_year)
);
