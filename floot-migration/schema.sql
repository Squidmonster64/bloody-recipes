-- Apply after Floot auth resource. No existing user data is dropped.
CREATE TYPE recipe_draft_state AS ENUM ('draft','saved');
CREATE TABLE recipe_drafts (
 id uuid PRIMARY KEY,
 user_id integer NOT NULL REFERENCES users(id),
 source_facts jsonb NOT NULL,
 recipe jsonb NOT NULL,
 state recipe_draft_state NOT NULL DEFAULT 'draft',
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 recipe_id text UNIQUE,
 fingerprint text,
 UNIQUE(user_id,id)
);
CREATE INDEX recipe_drafts_user_updated ON recipe_drafts(user_id,updated_at DESC);
CREATE UNIQUE INDEX recipe_drafts_user_fingerprint ON recipe_drafts(user_id,fingerprint);
-- Not consumed in beta: the live publisher still owns permanent BD numbering.
CREATE SEQUENCE recipe_id_sequence START 42;
