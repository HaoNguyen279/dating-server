BEGIN;

ALTER TABLE "profiles"
DROP CONSTRAINT IF EXISTS "profiles_relationship_intention_check";

UPDATE "profiles"
SET "relationship_intention" = CASE lower("relationship_intention")
  WHEN 'người yêu' THEN 'Người yêu'
  WHEN 'bạn hẹn hò lâu dài' THEN 'Bạn hẹn hò lâu dài'
  WHEN 'bất kì' THEN 'Bất kì'
  WHEN 'bạn mới' THEN 'Bạn mới'
  WHEN 'chưa rõ' THEN 'Chưa rõ'
  ELSE "relationship_intention"
END
WHERE "relationship_intention" IS NOT NULL;

ALTER TABLE "profiles"
ADD CONSTRAINT "profiles_relationship_intention_check"
CHECK (
  "relationship_intention" IS NULL OR
  "relationship_intention" IN (
    'Người yêu',
    'Bạn hẹn hò lâu dài',
    'Bất kì',
    'Bạn mới',
    'Chưa rõ'
  )
);

COMMIT;
