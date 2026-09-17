ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_satisfaction_check;

ALTER TABLE votes ADD CONSTRAINT votes_satisfaction_check
    CHECK (satisfaction IN ('muy_satisfecho', 'satisfecho', 'regular', 'poco_satisfecho', 'insatisfecho'));
