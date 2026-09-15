CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY,
    kiosk_id TEXT NOT NULL,
    satisfaction TEXT NOT NULL CHECK (satisfaction IN ('satisfecho', 'insatisfecho')),
    attention_or_food TEXT,
    photo_key TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes (created_at);
CREATE INDEX IF NOT EXISTS idx_votes_kiosk_id ON votes (kiosk_id);
