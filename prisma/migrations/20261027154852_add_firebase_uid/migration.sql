-- AddColumn firebase_uid to users table
ALTER TABLE "users" ADD COLUMN "firebase_uid" VARCHAR(255);

-- Create unique index for firebase_uid
CREATE UNIQUE INDEX "users_firebase_uid_uq" ON "users"("firebase_uid");
