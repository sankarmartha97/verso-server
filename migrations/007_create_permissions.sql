-- 'owner' is not a storable role here -- documents.owner_id is the single
-- source of truth for ownership. This table only ever grants editor/
-- commenter/viewer to someone who isn't the owner.
CREATE TYPE permission_role AS ENUM ('editor', 'commenter', 'viewer');

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT,
  role permission_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permissions_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

-- A pending invite (user_id NULL) is keyed by email; once resolved on signup
-- it gets a user_id and the row transitions into the user_id-keyed uniqueness
-- class instead -- the two partial unique indexes below never overlap for a
-- single row.
CREATE UNIQUE INDEX permissions_document_user_uniq ON permissions(document_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX permissions_document_email_uniq ON permissions(document_id, invited_email) WHERE invited_email IS NOT NULL;
CREATE INDEX permissions_document_id_idx ON permissions(document_id);
CREATE INDEX permissions_user_id_idx ON permissions(user_id);

CREATE TABLE link_shares (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  role permission_role NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
