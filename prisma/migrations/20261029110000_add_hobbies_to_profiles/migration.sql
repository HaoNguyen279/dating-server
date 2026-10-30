ALTER TABLE "profiles"
ADD COLUMN "hobbies" JSONB NOT NULL DEFAULT '[]'::jsonb;
