ALTER TABLE "users" ADD COLUMN "google_sub" VARCHAR(255);

CREATE UNIQUE INDEX "users_google_sub_uq" ON "users"("google_sub");
