BEGIN;

CREATE TABLE IF NOT EXISTS "discovery_group_hobbies" (
  "group_id" UUID NOT NULL,
  "hobby_id" VARCHAR(100) NOT NULL,
  CONSTRAINT "discovery_group_hobbies_pkey" PRIMARY KEY ("group_id", "hobby_id"),
  CONSTRAINT "discovery_group_hobbies_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "discovery_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "discovery_group_hobbies_hobby_idx"
ON "discovery_group_hobbies" ("hobby_id");

UPDATE "discovery_groups"
SET "is_active" = false
WHERE "slug" NOT IN ('me-nghe-thuat', 'me-game', 'me-phim', 'du-lich', 'yeu-the-thao', 'thich-di-nhau', 'me-am-thuc', 'yeu-thien-nhien', 'yeu-am-nhac', 'thich-kham-pha-tri-thuc', 'song-tich-cuc', 'thich-ket-noi');

INSERT INTO "discovery_groups" ("slug", "name", "is_active") VALUES
  ('me-nghe-thuat', 'Mê nghệ thuật', true),
  ('me-game', 'Hội mê game', true),
  ('me-phim', 'Hội mê phim', true),
  ('du-lich', 'Du lịch', true),
  ('yeu-the-thao', 'Yêu thể thao', true),
  ('thich-di-nhau', 'Thích đi nhậu', true),
  ('me-am-thuc', 'Mê ẩm thực', true),
  ('yeu-thien-nhien', 'Yêu thiên nhiên', true),
  ('yeu-am-nhac', 'Yêu âm nhạc', true),
  ('thich-kham-pha-tri-thuc', 'Thích khám phá tri thức', true),
  ('song-tich-cuc', 'Sống tích cực', true),
  ('thich-ket-noi', 'Thích kết nối', true)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "is_active" = true;

DELETE FROM "discovery_group_hobbies";
INSERT INTO "discovery_group_hobbies" ("group_id", "hobby_id")
SELECT g."id", mapped."hobby_id"
FROM (VALUES
  ('me-nghe-thuat', 'reading'),
  ('me-nghe-thuat', 'writing'),
  ('me-nghe-thuat', 'poetry'),
  ('me-nghe-thuat', 'painting'),
  ('me-nghe-thuat', 'drawing'),
  ('me-nghe-thuat', 'photography'),
  ('me-nghe-thuat', 'dancing'),
  ('me-nghe-thuat', 'acting'),
  ('me-nghe-thuat', 'crafts'),
  ('me-nghe-thuat', 'fashion'),
  ('me-nghe-thuat', 'interior_design'),
  ('me-phim', 'theater'),
  ('me-nghe-thuat', 'museums'),
  ('thich-ket-noi', 'content_creation'),
  ('me-nghe-thuat', 'blogging'),
  ('me-nghe-thuat', 'makeup'),
  ('me-game', 'gaming'),
  ('me-game', 'board_games'),
  ('me-game', 'puzzles'),
  ('me-game', 'esports'),
  ('me-phim', 'movies'),
  ('me-phim', 'tv_shows'),
  ('me-phim', 'anime'),
  ('me-phim', 'manga'),
  ('me-phim', 'comics'),
  ('me-phim', 'comedy'),
  ('me-phim', 'podcasts'),
  ('me-phim', 'standup_comedy'),
  ('du-lich', 'travel'),
  ('du-lich', 'road_trips'),
  ('du-lich', 'backpacking'),
  ('du-lich', 'beach'),
  ('du-lich', 'food_travel'),
  ('du-lich', 'picnics'),
  ('yeu-the-thao', 'cycling'),
  ('yeu-the-thao', 'running'),
  ('song-tich-cuc', 'gym'),
  ('song-tich-cuc', 'yoga'),
  ('song-tich-cuc', 'pilates'),
  ('yeu-the-thao', 'swimming'),
  ('yeu-the-thao', 'badminton'),
  ('yeu-the-thao', 'basketball'),
  ('yeu-the-thao', 'football'),
  ('yeu-the-thao', 'soccer'),
  ('yeu-the-thao', 'tennis'),
  ('yeu-the-thao', 'martial_arts'),
  ('yeu-the-thao', 'climbing'),
  ('yeu-the-thao', 'skateboarding'),
  ('yeu-the-thao', 'snowboarding'),
  ('yeu-the-thao', 'skiing'),
  ('yeu-the-thao', 'surfing'),
  ('me-am-thuc', 'cooking'),
  ('me-am-thuc', 'baking'),
  ('me-am-thuc', 'coffee'),
  ('me-am-thuc', 'tea'),
  ('me-am-thuc', 'foodie'),
  ('thich-di-nhau', 'wine_tasting'),
  ('thich-di-nhau', 'mixology'),
  ('thich-di-nhau', 'craft_beer'),
  ('me-am-thuc', 'street_food'),
  ('me-am-thuc', 'restaurant_hopping'),
  ('thich-di-nhau', 'pub_crawling'),
  ('thich-di-nhau', 'bar_hopping'),
  ('thich-di-nhau', 'nightlife'),
  ('thich-ket-noi', 'socializing'),
  ('thich-ket-noi', 'karaoke'),
  ('thich-ket-noi', 'dancing_salsa'),
  ('yeu-am-nhac', 'music'),
  ('yeu-am-nhac', 'singing'),
  ('yeu-am-nhac', 'playing_instruments'),
  ('yeu-am-nhac', 'concerts'),
  ('yeu-thien-nhien', 'hiking'),
  ('yeu-thien-nhien', 'camping'),
  ('yeu-thien-nhien', 'nature'),
  ('yeu-thien-nhien', 'stargazing'),
  ('yeu-thien-nhien', 'gardening'),
  ('yeu-thien-nhien', 'plants'),
  ('yeu-thien-nhien', 'fishing'),
  ('yeu-thien-nhien', 'birdwatching'),
  ('yeu-thien-nhien', 'sailing'),
  ('yeu-thien-nhien', 'environment'),
  ('yeu-thien-nhien', 'pets'),
  ('thich-kham-pha-tri-thuc', 'learning'),
  ('thich-kham-pha-tri-thuc', 'languages'),
  ('thich-kham-pha-tri-thuc', 'programming'),
  ('thich-kham-pha-tri-thuc', 'technology'),
  ('thich-kham-pha-tri-thuc', 'science'),
  ('thich-kham-pha-tri-thuc', 'astronomy'),
  ('thich-kham-pha-tri-thuc', 'investing'),
  ('thich-kham-pha-tri-thuc', 'entrepreneurship'),
  ('thich-kham-pha-tri-thuc', 'history'),
  ('song-tich-cuc', 'meditation'),
  ('song-tich-cuc', 'mindfulness'),
  ('song-tich-cuc', 'journaling'),
  ('song-tich-cuc', 'fashion_shopping'),
  ('song-tich-cuc', 'thrifting'),
  ('me-nghe-thuat', 'diy'),
  ('song-tich-cuc', 'cars'),
  ('song-tich-cuc', 'motorcycles'),
  ('song-tich-cuc', 'collecting'),
  ('thich-ket-noi', 'volunteering')
) AS mapped("slug", "hobby_id")
JOIN "discovery_groups" AS g ON g."slug" = mapped."slug"
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sync_discovery_group_memberships_from_hobbies()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM "discovery_group_members" AS membership
  WHERE membership."user_id" = NEW."user_id"
    AND NOT EXISTS (
      SELECT 1
      FROM "discovery_group_hobbies" AS mapping
      JOIN "discovery_groups" AS group_row
        ON group_row."id" = mapping."group_id" AND group_row."is_active" = true
      WHERE mapping."group_id" = membership."group_id"
        AND mapping."hobby_id" IN (
          SELECT selected."hobby" ->> 'id'
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(NEW."hobbies") = 'array' THEN NEW."hobbies" ELSE '[]'::jsonb END
          ) AS selected("hobby")
        )
    );

  INSERT INTO "discovery_group_members" ("group_id", "user_id")
  SELECT DISTINCT mapping."group_id", NEW."user_id"
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(NEW."hobbies") = 'array' THEN NEW."hobbies" ELSE '[]'::jsonb END
  ) AS selected("hobby")
  JOIN "discovery_group_hobbies" AS mapping
    ON mapping."hobby_id" = selected."hobby" ->> 'id'
  JOIN "discovery_groups" AS group_row
    ON group_row."id" = mapping."group_id" AND group_row."is_active" = true
  ON CONFLICT ("group_id", "user_id") DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION clear_discovery_group_memberships_after_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM "discovery_group_members" WHERE "user_id" = OLD."user_id";
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS "trg_profiles_sync_discovery_group_memberships" ON "profiles";
CREATE TRIGGER "trg_profiles_sync_discovery_group_memberships"
AFTER INSERT OR UPDATE OF "hobbies" ON "profiles"
FOR EACH ROW EXECUTE FUNCTION sync_discovery_group_memberships_from_hobbies();

DROP TRIGGER IF EXISTS "trg_profiles_clear_discovery_group_memberships" ON "profiles";
CREATE TRIGGER "trg_profiles_clear_discovery_group_memberships"
AFTER DELETE ON "profiles"
FOR EACH ROW EXECUTE FUNCTION clear_discovery_group_memberships_after_profile_delete();

WITH hobby_catalog("id", "name", "category") AS (
  VALUES
    ('reading', 'Đọc sách', 'Nghệ thuật & Sáng tạo'),
    ('writing', 'Viết lách', 'Nghệ thuật & Sáng tạo'),
    ('poetry', 'Thơ ca', 'Nghệ thuật & Sáng tạo'),
    ('painting', 'Vẽ tranh', 'Nghệ thuật & Sáng tạo'),
    ('drawing', 'Vẽ', 'Nghệ thuật & Sáng tạo'),
    ('photography', 'Nhiếp ảnh', 'Nghệ thuật & Sáng tạo'),
    ('dancing', 'Nhảy múa', 'Nghệ thuật & Sáng tạo'),
    ('acting', 'Diễn xuất', 'Nghệ thuật & Sáng tạo'),
    ('crafts', 'Thủ công mỹ nghệ', 'Nghệ thuật & Sáng tạo'),
    ('fashion', 'Thời trang', 'Nghệ thuật & Sáng tạo'),
    ('interior_design', 'Thiết kế nội thất', 'Nghệ thuật & Sáng tạo'),
    ('theater', 'Sân khấu và kịch nghệ', 'Nghệ thuật & Sáng tạo'),
    ('museums', 'Bảo tàng và phòng trưng bày', 'Nghệ thuật & Sáng tạo'),
    ('content_creation', 'Sáng tạo nội dung', 'Nghệ thuật & Sáng tạo'),
    ('blogging', 'Viết blog', 'Nghệ thuật & Sáng tạo'),
    ('makeup', 'Trang điểm và làm đẹp', 'Nghệ thuật & Sáng tạo'),
    ('gaming', 'Chơi trò chơi điện tử', 'Trò chơi'),
    ('board_games', 'Trò chơi bàn cờ', 'Trò chơi'),
    ('puzzles', 'Giải đố', 'Trò chơi'),
    ('esports', 'Thể thao điện tử', 'Trò chơi'),
    ('movies', 'Xem phim', 'Phim ảnh & Giải trí'),
    ('tv_shows', 'Xem chương trình truyền hình', 'Phim ảnh & Giải trí'),
    ('anime', 'Anime', 'Phim ảnh & Giải trí'),
    ('manga', 'Manga', 'Phim ảnh & Giải trí'),
    ('comics', 'Truyện tranh', 'Phim ảnh & Giải trí'),
    ('comedy', 'Hài kịch', 'Phim ảnh & Giải trí'),
    ('podcasts', 'Nghe podcast', 'Phim ảnh & Giải trí'),
    ('standup_comedy', 'Hài độc thoại', 'Phim ảnh & Giải trí'),
    ('travel', 'Du lịch', 'Du lịch & Khám phá'),
    ('road_trips', 'Du lịch đường dài', 'Du lịch & Khám phá'),
    ('backpacking', 'Du lịch bụi', 'Du lịch & Khám phá'),
    ('beach', 'Đi biển', 'Du lịch & Khám phá'),
    ('food_travel', 'Du lịch ẩm thực', 'Du lịch & Khám phá'),
    ('picnics', 'Dã ngoại', 'Du lịch & Khám phá'),
    ('cycling', 'Đạp xe', 'Thể thao & Thể hình'),
    ('running', 'Chạy bộ', 'Thể thao & Thể hình'),
    ('gym', 'Tập gym', 'Thể thao & Thể hình'),
    ('yoga', 'Yoga', 'Thể thao & Thể hình'),
    ('pilates', 'Pilates', 'Thể thao & Thể hình'),
    ('swimming', 'Bơi lội', 'Thể thao & Thể hình'),
    ('badminton', 'Cầu lông', 'Thể thao & Thể hình'),
    ('basketball', 'Bóng rổ', 'Thể thao & Thể hình'),
    ('football', 'Bóng bầu dục Mỹ', 'Thể thao & Thể hình'),
    ('soccer', 'Bóng đá', 'Thể thao & Thể hình'),
    ('tennis', 'Quần vợt', 'Thể thao & Thể hình'),
    ('martial_arts', 'Võ thuật', 'Thể thao & Thể hình'),
    ('climbing', 'Leo núi thể thao', 'Thể thao & Thể hình'),
    ('skateboarding', 'Trượt ván', 'Thể thao & Thể hình'),
    ('snowboarding', 'Trượt ván tuyết', 'Thể thao & Thể hình'),
    ('skiing', 'Trượt tuyết', 'Thể thao & Thể hình'),
    ('surfing', 'Lướt sóng', 'Thể thao & Thể hình'),
    ('cooking', 'Nấu ăn', 'Ẩm thực & Đồ uống'),
    ('baking', 'Làm bánh', 'Ẩm thực & Đồ uống'),
    ('coffee', 'Cà phê', 'Ẩm thực & Đồ uống'),
    ('tea', 'Trà', 'Ẩm thực & Đồ uống'),
    ('foodie', 'Thử món ăn mới', 'Ẩm thực & Đồ uống'),
    ('wine_tasting', 'Thưởng thức rượu vang', 'Ẩm thực & Đồ uống'),
    ('mixology', 'Pha chế cocktail', 'Ẩm thực & Đồ uống'),
    ('craft_beer', 'Bia thủ công', 'Ẩm thực & Đồ uống'),
    ('street_food', 'Ẩm thực đường phố', 'Ẩm thực & Đồ uống'),
    ('restaurant_hopping', 'Khám phá các quán ăn', 'Ẩm thực & Đồ uống'),
    ('pub_crawling', 'Đi nhậu cùng bạn bè', 'Giao lưu & Đời sống về đêm'),
    ('bar_hopping', 'Khám phá các quán bar', 'Giao lưu & Đời sống về đêm'),
    ('nightlife', 'Cuộc sống về đêm', 'Giao lưu & Đời sống về đêm'),
    ('socializing', 'Gặp gỡ người mới', 'Giao lưu & Đời sống về đêm'),
    ('karaoke', 'Hát karaoke', 'Giao lưu & Đời sống về đêm'),
    ('dancing_salsa', 'Nhảy salsa', 'Giao lưu & Đời sống về đêm'),
    ('music', 'Nghe nhạc', 'Âm nhạc'),
    ('singing', 'Ca hát', 'Âm nhạc'),
    ('playing_instruments', 'Chơi nhạc cụ', 'Âm nhạc'),
    ('concerts', 'Nhạc sống và hòa nhạc', 'Âm nhạc'),
    ('hiking', 'Đi bộ đường dài', 'Thiên nhiên & Ngoài trời'),
    ('camping', 'Cắm trại', 'Thiên nhiên & Ngoài trời'),
    ('nature', 'Khám phá thiên nhiên', 'Thiên nhiên & Ngoài trời'),
    ('stargazing', 'Ngắm sao', 'Thiên nhiên & Ngoài trời'),
    ('gardening', 'Làm vườn', 'Thiên nhiên & Ngoài trời'),
    ('plants', 'Chăm sóc cây cảnh', 'Thiên nhiên & Ngoài trời'),
    ('fishing', 'Câu cá', 'Thiên nhiên & Ngoài trời'),
    ('birdwatching', 'Ngắm chim', 'Thiên nhiên & Ngoài trời'),
    ('sailing', 'Chèo thuyền buồm', 'Thiên nhiên & Ngoài trời'),
    ('environment', 'Bảo vệ môi trường', 'Thiên nhiên & Ngoài trời'),
    ('pets', 'Vui chơi cùng thú cưng', 'Thiên nhiên & Ngoài trời'),
    ('learning', 'Học hỏi điều mới', 'Học tập & Công nghệ'),
    ('languages', 'Học ngoại ngữ', 'Học tập & Công nghệ'),
    ('programming', 'Lập trình', 'Học tập & Công nghệ'),
    ('technology', 'Công nghệ', 'Học tập & Công nghệ'),
    ('science', 'Khoa học', 'Học tập & Công nghệ'),
    ('astronomy', 'Thiên văn học', 'Học tập & Công nghệ'),
    ('investing', 'Đầu tư', 'Học tập & Công nghệ'),
    ('entrepreneurship', 'Khởi nghiệp', 'Học tập & Công nghệ'),
    ('history', 'Lịch sử', 'Học tập & Công nghệ'),
    ('meditation', 'Thiền', 'Sức khỏe & Phong cách sống'),
    ('mindfulness', 'Chánh niệm', 'Sức khỏe & Phong cách sống'),
    ('journaling', 'Viết nhật ký', 'Sức khỏe & Phong cách sống'),
    ('fashion_shopping', 'Mua sắm', 'Sức khỏe & Phong cách sống'),
    ('thrifting', 'Săn đồ secondhand', 'Sức khỏe & Phong cách sống'),
    ('diy', 'Tự làm đồ thủ công', 'Sức khỏe & Phong cách sống'),
    ('cars', 'Ô tô', 'Sức khỏe & Phong cách sống'),
    ('motorcycles', 'Xe máy', 'Sức khỏe & Phong cách sống'),
    ('collecting', 'Sưu tầm', 'Sức khỏe & Phong cách sống'),
    ('volunteering', 'Hoạt động tình nguyện', 'Cộng đồng & Lối sống')
)
UPDATE "profiles" AS profile
SET "hobbies" = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN catalog."id" IS NOT NULL AND jsonb_typeof(item."value") = 'object' THEN
        jsonb_set(
          jsonb_set(item."value", '{name}', to_jsonb(catalog."name"), true),
          '{category}', to_jsonb(catalog."category"), true
        )
      ELSE item."value"
    END
    ORDER BY item."ordinality"
  )
  FROM jsonb_array_elements(profile."hobbies") WITH ORDINALITY AS item("value", "ordinality")
  LEFT JOIN hobby_catalog AS catalog ON catalog."id" = item."value" ->> 'id'
), '[]'::jsonb)
WHERE jsonb_typeof(profile."hobbies") = 'array';

COMMIT;
