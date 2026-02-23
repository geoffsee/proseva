-- ProSeVA Email Relay - D1 Schema
-- Stores instance registry and email metadata only (no PII)

CREATE TABLE IF NOT EXISTS instances (
  instance_id TEXT PRIMARY KEY,
  email_address TEXT UNIQUE NOT NULL,
  public_key_jwk TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS emails (
  email_id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(instance_id),
  r2_key TEXT NOT NULL,
  ephemeral_public_key_jwk TEXT NOT NULL,
  iv TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  picked_up INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_emails_pending ON emails(instance_id, picked_up) WHERE picked_up = 0;
CREATE INDEX IF NOT EXISTS idx_emails_expires ON emails(expires_at) WHERE picked_up = 0;
CREATE INDEX IF NOT EXISTS idx_instances_email ON instances(email_address);
