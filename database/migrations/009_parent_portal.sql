-- Parent portal. Parents and guardians sign in with their own (invited)
-- accounts and see only the learners linked to them. A parent has no school
-- of their own: one account can be linked to children at different schools.
-- Safe to re-run. (The new role value isn't used in this transaction.)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'parent';

CREATE TABLE IF NOT EXISTS guardian_links (
    guardian_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
    relationship VARCHAR(50),
    invited_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guardian_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_learner ON guardian_links (learner_id);
