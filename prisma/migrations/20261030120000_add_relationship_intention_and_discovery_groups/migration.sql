ALTER TABLE "profiles"
ADD COLUMN "relationship_intention" VARCHAR(50);

ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_relationship_intention_check"
CHECK (
  "relationship_intention" IS NULL OR
  "relationship_intention" IN (
    'người yêu',
    'bạn hẹn hò lâu dài',
    'bất kì',
    'bạn mới',
    'chưa rõ'
  )
);

CREATE INDEX "profiles_relationship_intention_idx"
ON "profiles" ("relationship_intention");

CREATE TABLE "discovery_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discovery_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discovery_groups_slug_uq" UNIQUE ("slug")
);

CREATE INDEX "discovery_groups_active_name_idx"
ON "discovery_groups" ("is_active", "name");

CREATE TABLE "discovery_group_members" (
  "group_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discovery_group_members_pkey" PRIMARY KEY ("group_id", "user_id"),
  CONSTRAINT "discovery_group_members_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "discovery_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "discovery_group_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "discovery_group_members_user_idx"
ON "discovery_group_members" ("user_id");

ALTER TABLE "recommendation_sessions"
ADD COLUMN "discovery_group_id" UUID;

ALTER TABLE "recommendation_sessions"
ADD COLUMN "relationship_intention_filter" VARCHAR(50);

ALTER TABLE "recommendation_sessions"
ADD CONSTRAINT "recommendation_sessions_discovery_group_id_fkey"
FOREIGN KEY ("discovery_group_id") REFERENCES "discovery_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "recommendation_sessions_group_idx"
ON "recommendation_sessions" ("discovery_group_id");

INSERT INTO "discovery_groups" ("slug", "name") VALUES
  ('me-phim', 'Hội mê Phim'),
  ('me-game', 'Hội mê Game')
ON CONFLICT ("slug") DO NOTHING;
