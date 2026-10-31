BEGIN;

CREATE TABLE IF NOT EXISTS "discovery_group_intentions" (
  "group_id" UUID NOT NULL,
  "relationship_intention" VARCHAR(50) NOT NULL,
  CONSTRAINT "discovery_group_intentions_pkey"
    PRIMARY KEY ("group_id", "relationship_intention"),
  CONSTRAINT "discovery_group_intentions_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "discovery_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "discovery_group_intentions_value_check"
    CHECK ("relationship_intention" IN (
      'Người yêu',
      'Bạn hẹn hò lâu dài',
      'Bất kì',
      'Bạn mới'
    ))
);

CREATE INDEX IF NOT EXISTS "discovery_group_intentions_value_idx"
ON "discovery_group_intentions" ("relationship_intention");

INSERT INTO "discovery_groups" ("slug", "name", "is_active") VALUES
  ('nguoi-yeu', 'Người yêu', true),
  ('ban-hen-ho-lau-dai', 'Bạn hẹn hò lâu dài', true),
  ('bat-ki', 'Bất kì', true),
  ('ban-moi', 'Bạn mới', true)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name", "is_active" = true;

DELETE FROM "discovery_group_intentions";
INSERT INTO "discovery_group_intentions" ("group_id", "relationship_intention")
SELECT groups."id", mapping."relationship_intention"
FROM (VALUES
  ('nguoi-yeu', 'Người yêu'),
  ('ban-hen-ho-lau-dai', 'Bạn hẹn hò lâu dài'),
  ('bat-ki', 'Bất kì'),
  ('ban-moi', 'Bạn mới')
) AS mapping("slug", "relationship_intention")
JOIN "discovery_groups" AS groups ON groups."slug" = mapping."slug"
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sync_discovery_group_memberships_for_profile(
  p_user_id UUID,
  p_hobbies JSONB,
  p_relationship_intention VARCHAR
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM "discovery_group_members" AS membership
  WHERE membership."user_id" = p_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT hobby_mapping."group_id"
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p_hobbies) = 'array' THEN p_hobbies ELSE '[]'::jsonb END
        ) AS selected("hobby")
        JOIN "discovery_group_hobbies" AS hobby_mapping
          ON hobby_mapping."hobby_id" = selected."hobby" ->> 'id'
        JOIN "discovery_groups" AS group_row
          ON group_row."id" = hobby_mapping."group_id" AND group_row."is_active" = true

        UNION

        SELECT intention_mapping."group_id"
        FROM "discovery_group_intentions" AS intention_mapping
        JOIN "discovery_groups" AS group_row
          ON group_row."id" = intention_mapping."group_id" AND group_row."is_active" = true
        WHERE intention_mapping."relationship_intention" = p_relationship_intention
      ) AS expected_groups
      WHERE expected_groups."group_id" = membership."group_id"
    );

  INSERT INTO "discovery_group_members" ("group_id", "user_id")
  SELECT expected_groups."group_id", p_user_id
  FROM (
    SELECT hobby_mapping."group_id"
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_hobbies) = 'array' THEN p_hobbies ELSE '[]'::jsonb END
    ) AS selected("hobby")
    JOIN "discovery_group_hobbies" AS hobby_mapping
      ON hobby_mapping."hobby_id" = selected."hobby" ->> 'id'
    JOIN "discovery_groups" AS group_row
      ON group_row."id" = hobby_mapping."group_id" AND group_row."is_active" = true

    UNION

    SELECT intention_mapping."group_id"
    FROM "discovery_group_intentions" AS intention_mapping
    JOIN "discovery_groups" AS group_row
      ON group_row."id" = intention_mapping."group_id" AND group_row."is_active" = true
    WHERE intention_mapping."relationship_intention" = p_relationship_intention
  ) AS expected_groups
  ON CONFLICT ("group_id", "user_id") DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION sync_discovery_group_memberships_from_hobbies()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM sync_discovery_group_memberships_for_profile(
    NEW."user_id", NEW."hobbies", NEW."relationship_intention"
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION sync_discovery_group_memberships_from_relationship_intention()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM sync_discovery_group_memberships_for_profile(
    NEW."user_id", NEW."hobbies", NEW."relationship_intention"
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS "trg_profiles_sync_discovery_group_memberships" ON "profiles";
CREATE TRIGGER "trg_profiles_sync_discovery_group_memberships"
AFTER INSERT OR UPDATE OF "hobbies" ON "profiles"
FOR EACH ROW EXECUTE FUNCTION sync_discovery_group_memberships_from_hobbies();

DROP TRIGGER IF EXISTS "trg_profiles_sync_relationship_intention_memberships" ON "profiles";
CREATE TRIGGER "trg_profiles_sync_relationship_intention_memberships"
AFTER INSERT OR UPDATE OF "relationship_intention" ON "profiles"
FOR EACH ROW EXECUTE FUNCTION sync_discovery_group_memberships_from_relationship_intention();

UPDATE "profiles"
SET "relationship_intention" = "relationship_intention";

COMMIT;
