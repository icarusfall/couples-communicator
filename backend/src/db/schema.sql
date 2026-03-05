-- Couples (created first since users reference it)
CREATE TABLE IF NOT EXISTS couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pairing_code VARCHAR(8) UNIQUE,
    pairing_code_expires_at TIMESTAMPTZ,
    couple_salt BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pseudonym VARCHAR(50) NOT NULL,
    email_hash VARCHAR(64),
    password_hash VARCHAR(255) NOT NULL,
    couple_id UUID REFERENCES couples(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Documents (encrypted blobs)
CREATE TABLE IF NOT EXISTS shared_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    couple_id UUID REFERENCES couples(id) NOT NULL,
    encrypted_content BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_documents_user_couple
  ON shared_documents (user_id, couple_id);

-- Password reset columns (idempotent via IF NOT EXISTS workaround)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='encrypted_email') THEN
    ALTER TABLE users ADD COLUMN encrypted_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_reset_token') THEN
    ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(64) UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_reset_expires_at') THEN
    ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMPTZ;
  END IF;
END $$;
