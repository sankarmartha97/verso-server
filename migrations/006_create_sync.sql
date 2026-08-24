CREATE TABLE document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  update BYTEA NOT NULL,
  origin UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_updates_doc_id ON document_updates(document_id, id);

CREATE TABLE document_snapshots (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  state BYTEA NOT NULL,
  last_update_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_snapshots_doc_id ON document_snapshots(document_id, created_at DESC);
