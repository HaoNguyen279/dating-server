CREATE TABLE "recommendation_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "ranking_version" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "recommendation_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recommendation_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "recommendation_sessions_user_expiry_idx"
  ON "recommendation_sessions"("user_id", "expires_at");

CREATE INDEX "recommendation_sessions_expiry_idx"
  ON "recommendation_sessions"("expires_at");

CREATE TABLE "recommendation_session_items" (
  "session_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "candidate_user_id" UUID NOT NULL,
  "ranking_score" DOUBLE PRECISION NOT NULL,
  "missing_features" JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "recommendation_session_items_pkey"
    PRIMARY KEY ("session_id", "position"),
  CONSTRAINT "recommendation_session_candidate_uq"
    UNIQUE ("session_id", "candidate_user_id"),
  CONSTRAINT "recommendation_session_items_position_check"
    CHECK ("position" >= 0),
  CONSTRAINT "recommendation_session_items_score_check"
    CHECK ("ranking_score" >= 0 AND "ranking_score" <= 100),
  CONSTRAINT "recommendation_session_items_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "recommendation_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "recommendation_session_items_candidate_user_id_fkey"
    FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "recommendation_session_candidate_idx"
  ON "recommendation_session_items"("candidate_user_id");

CREATE TABLE "recommendation_impressions" (
  "session_id" UUID NOT NULL,
  "candidate_user_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_impressions_pkey"
    PRIMARY KEY ("session_id", "candidate_user_id"),
  CONSTRAINT "recommendation_impressions_position_check"
    CHECK ("position" >= 0),
  CONSTRAINT "recommendation_impressions_session_item_fkey"
    FOREIGN KEY ("session_id", "candidate_user_id")
    REFERENCES "recommendation_session_items"("session_id", "candidate_user_id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "recommendation_impressions_viewed_idx"
  ON "recommendation_impressions"("viewed_at");
