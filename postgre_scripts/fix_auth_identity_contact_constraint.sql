-- Allow passwordless OAuth/Firebase accounts to use their provider identity
-- as the login method even when they have no email or phone number.
BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_contact_required;

ALTER TABLE public.users
  ADD CONSTRAINT users_contact_required
  CHECK (
    email IS NOT NULL
    OR phone IS NOT NULL
    OR google_sub IS NOT NULL
    OR firebase_uid IS NOT NULL
  );

COMMIT;
