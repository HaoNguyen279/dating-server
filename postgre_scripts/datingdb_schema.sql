-- =====================================================================
-- DATING APP - PostgreSQL schema (v2: multi-provider login)
-- Database : datingdb
-- Tables   : users, profiles, photos, preferences, swipes, matches,
--            conversations, messages,
--            auth_identities, phone_otps, user_sessions, login_events
-- Login    : Google Sign In, Facebook, Số điện thoại (OTP)
-- Yêu cầu  : PostgreSQL 13+ (DROP DATABASE ... FORCE, gen_random_uuid)
-- Chạy bằng: psql -U postgres -f datingdb_schema.sql
--            (phải chạy bằng psql vì có lệnh \connect, \set)
-- =====================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- A. XOÁ + TẠO LẠI DATABASE
-- Phải kết nối vào database khác (postgres) mới xoá được datingdb.
-- WITH (FORCE) tự ngắt mọi kết nối đang mở tới datingdb.
-- ---------------------------------------------------------------------
\connect postgres

DROP DATABASE IF EXISTS datingdb WITH (FORCE);
CREATE DATABASE datingdb WITH ENCODING 'UTF8';

\connect datingdb

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- dự phòng cho PG < 13

-- ---------------------------------------------------------------------
-- 0. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE user_status     AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE gender_type     AS ENUM ('male', 'female', 'non_binary', 'other');
CREATE TYPE interested_type AS ENUM ('male', 'female', 'everyone');
CREATE TYPE swipe_action    AS ENUM ('like', 'pass', 'super_like');
CREATE TYPE match_status    AS ENUM ('active', 'unmatched');
CREATE TYPE message_type    AS ENUM ('text', 'image', 'gif');

-- Enum cho phần đăng nhập
-- Thêm provider mới sau này: ALTER TYPE auth_provider ADD VALUE 'apple';
CREATE TYPE auth_provider   AS ENUM ('google', 'facebook', 'phone');
CREATE TYPE otp_purpose     AS ENUM ('login', 'register', 'link_phone', 'change_phone');
CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');

-- ---------------------------------------------------------------------
-- 0.1 HÀM DÙNG CHUNG: tự cập nhật updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. USERS
-- Tài khoản gốc. Cách đăng nhập nằm ở auth_identities (và/hoặc password_hash).
-- email/phone là thông tin liên hệ, đều có thể NULL.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    email               varchar(255),
    phone               varchar(20),
    password_hash       text,                                  -- NULL nếu chỉ đăng nhập bằng Google/Facebook/OTP
    email_verified_at   timestamptz,
    phone_verified_at   timestamptz,
    status              user_status  NOT NULL DEFAULT 'active',
    last_active_at      timestamptz,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT users_email_format
        CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT users_phone_format
        CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$'),
    -- Chỉ được "đã xác minh" khi có giá trị tương ứng
    CONSTRAINT users_email_verified_needs_email
        CHECK (email_verified_at IS NULL OR email IS NOT NULL),
    CONSTRAINT users_phone_verified_needs_phone
        CHECK (phone_verified_at IS NULL OR phone IS NOT NULL),
    -- Đăng nhập bằng mật khẩu thì phải có email hoặc SĐT làm định danh
    CONSTRAINT users_password_needs_contact
        CHECK (password_hash IS NULL OR email IS NOT NULL OR phone IS NOT NULL)
);

-- Email không phân biệt hoa thường; phone unique (NULL được phép lặp)
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE UNIQUE INDEX users_phone_uq ON users (phone);
CREATE INDEX users_status_idx      ON users (status);
CREATE INDEX users_last_active_idx ON users (last_active_at DESC);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Đổi email/SĐT mà không kèm xác minh mới thì reset trạng thái đã xác minh
CREATE OR REPLACE FUNCTION reset_verification_on_contact_change()
RETURNS trigger AS $$
BEGIN
    IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email)
       AND NEW.email_verified_at IS NOT DISTINCT FROM OLD.email_verified_at THEN
        NEW.email_verified_at := NULL;
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone
       AND NEW.phone_verified_at IS NOT DISTINCT FROM OLD.phone_verified_at THEN
        NEW.phone_verified_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_reset_verification
    BEFORE UPDATE OF email, phone ON users
    FOR EACH ROW EXECUTE FUNCTION reset_verification_on_contact_change();

-- ---------------------------------------------------------------------
-- 2. PROFILES (1 - 1 với users)
-- ---------------------------------------------------------------------
CREATE TABLE profiles (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid          NOT NULL UNIQUE
                                REFERENCES users (id) ON DELETE CASCADE,
    display_name  varchar(50)   NOT NULL,
    birth_date    date          NOT NULL,
    gender        gender_type   NOT NULL,
    bio           text,
    job_title     varchar(100),
    height_cm     smallint,
    city          varchar(100),
    latitude      numeric(9,6),
    longitude     numeric(9,6),
    is_verified   boolean       NOT NULL DEFAULT false,

    CONSTRAINT profiles_display_name_not_blank CHECK (length(btrim(display_name)) > 0),
    CONSTRAINT profiles_bio_len    CHECK (bio IS NULL OR length(bio) <= 500),
    CONSTRAINT profiles_height     CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250),
    CONSTRAINT profiles_lat_range  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
    CONSTRAINT profiles_lng_range  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    -- Có toạ độ thì phải có đủ cả hai
    CONSTRAINT profiles_geo_pair   CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX profiles_gender_idx ON profiles (gender);
CREATE INDEX profiles_birth_idx  ON profiles (birth_date);
CREATE INDEX profiles_geo_idx    ON profiles (latitude, longitude);
-- Gợi ý: dữ liệu lớn nên dùng PostGIS (geography + GiST index) thay cho 2 cột này.

-- Chỉ cho phép người từ 18 tuổi trở lên
-- (dùng trigger vì CHECK không nên phụ thuộc vào ngày hiện tại)
CREATE OR REPLACE FUNCTION enforce_min_age()
RETURNS trigger AS $$
BEGIN
    IF NEW.birth_date > (current_date - INTERVAL '18 years') THEN
        RAISE EXCEPTION 'User must be at least 18 years old (birth_date = %)', NEW.birth_date
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_min_age
    BEFORE INSERT OR UPDATE OF birth_date ON profiles
    FOR EACH ROW EXECUTE FUNCTION enforce_min_age();

-- ---------------------------------------------------------------------
-- 3. PHOTOS (1 - N với users)
-- ---------------------------------------------------------------------
CREATE TABLE photos (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL
                             REFERENCES users (id) ON DELETE CASCADE,
    url         text         NOT NULL,
    position    smallint     NOT NULL DEFAULT 0,
    is_primary  boolean      NOT NULL DEFAULT false,
    created_at  timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT photos_url_not_blank CHECK (length(btrim(url)) > 0),
    CONSTRAINT photos_position_range CHECK (position BETWEEN 0 AND 8),   -- tối đa 9 ảnh
    CONSTRAINT photos_user_position_uq UNIQUE (user_id, position)
        DEFERRABLE INITIALLY IMMEDIATE                                   -- cho phép hoán đổi thứ tự trong 1 transaction
);

-- Mỗi user chỉ có tối đa 1 ảnh đại diện
CREATE UNIQUE INDEX photos_one_primary_per_user
    ON photos (user_id) WHERE is_primary;

-- ---------------------------------------------------------------------
-- 4. PREFERENCES (1 - 1 với users)
-- ---------------------------------------------------------------------
CREATE TABLE preferences (
    id               uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid             NOT NULL UNIQUE
                                      REFERENCES users (id) ON DELETE CASCADE,
    interested_in    interested_type  NOT NULL DEFAULT 'everyone',
    age_min          smallint         NOT NULL DEFAULT 18,
    age_max          smallint         NOT NULL DEFAULT 99,
    max_distance_km  integer          NOT NULL DEFAULT 50,
    show_me          boolean          NOT NULL DEFAULT true,
    updated_at       timestamptz      NOT NULL DEFAULT now(),

    CONSTRAINT preferences_age_min   CHECK (age_min >= 18),
    CONSTRAINT preferences_age_range CHECK (age_max >= age_min AND age_max <= 120),
    CONSTRAINT preferences_distance  CHECK (max_distance_km BETWEEN 1 AND 20000)
);

CREATE TRIGGER trg_preferences_updated_at
    BEFORE UPDATE ON preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 5. SWIPES
-- ---------------------------------------------------------------------
CREATE TABLE swipes (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id   uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    swiped_id   uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    action      swipe_action  NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT swipes_no_self_swipe CHECK (swiper_id <> swiped_id),
    -- Một người chỉ vuốt một người khác đúng 1 lần
    CONSTRAINT swipes_pair_uq UNIQUE (swiper_id, swiped_id)
);

-- Tìm "ai đã like tôi" và kiểm tra like ngược để tạo match
CREATE INDEX swipes_swiped_action_idx ON swipes (swiped_id, action);

-- ---------------------------------------------------------------------
-- 6. MATCHES
-- ---------------------------------------------------------------------
CREATE TABLE matches (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id      uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user2_id      uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status        match_status  NOT NULL DEFAULT 'active',
    matched_at    timestamptz   NOT NULL DEFAULT now(),
    unmatched_at  timestamptz,

    -- Quy ước user1_id < user2_id để cặp (A,B) và (B,A) không bị trùng
    CONSTRAINT matches_order_check CHECK (user1_id < user2_id),
    CONSTRAINT matches_pair_uq UNIQUE (user1_id, user2_id),
    -- unmatched_at chỉ có giá trị khi status = 'unmatched'
    CONSTRAINT matches_unmatched_consistent
        CHECK ((status = 'unmatched') = (unmatched_at IS NOT NULL))
);

CREATE INDEX matches_user2_idx ON matches (user2_id);   -- user1_id đã được phủ bởi unique index
CREATE INDEX matches_status_idx ON matches (status);

-- ---------------------------------------------------------------------
-- 7. CONVERSATIONS (1 - 1 với matches)
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id         uuid         NOT NULL UNIQUE
                                  REFERENCES matches (id) ON DELETE CASCADE,
    last_message_at  timestamptz,
    created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX conversations_last_message_idx ON conversations (last_message_at DESC NULLS LAST);

-- ---------------------------------------------------------------------
-- 8. MESSAGES
-- ---------------------------------------------------------------------
CREATE TABLE messages (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  uuid          NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id        uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content          text          NOT NULL,
    message_type     message_type  NOT NULL DEFAULT 'text',
    is_read          boolean       NOT NULL DEFAULT false,
    read_at          timestamptz,
    created_at       timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT messages_content_not_blank CHECK (length(btrim(content)) > 0),
    CONSTRAINT messages_text_len CHECK (message_type <> 'text' OR length(content) <= 2000),
    -- is_read và read_at luôn đồng bộ
    CONSTRAINT messages_read_consistent CHECK (is_read = (read_at IS NOT NULL))
);

-- Tải lịch sử chat theo thời gian
CREATE INDEX messages_conv_created_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX messages_sender_idx       ON messages (sender_id);
-- Đếm tin chưa đọc nhanh
CREATE INDEX messages_unread_idx ON messages (conversation_id) WHERE NOT is_read;

-- ---------------------------------------------------------------------
-- 9. AUTH_IDENTITIES (1 - N với users)  *** MỚI ***
-- Mỗi dòng = một cách đăng nhập đã liên kết với tài khoản.
--   google   : provider_user_id = "sub" trong ID token của Google
--   facebook : provider_user_id = user id (app-scoped) của Facebook
--   phone    : provider_user_id = số điện thoại dạng E.164 (+84901234567)
-- ---------------------------------------------------------------------
CREATE TABLE auth_identities (
    id                       uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  uuid           NOT NULL
                                            REFERENCES users (id) ON DELETE CASCADE,
    provider                 auth_provider  NOT NULL,
    provider_user_id         varchar(255)   NOT NULL,
    provider_email           varchar(255),
    provider_email_verified  boolean        NOT NULL DEFAULT false,
    display_name             varchar(100),
    avatar_url               text,
    raw_profile              jsonb          NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamptz    NOT NULL DEFAULT now(),
    updated_at               timestamptz    NOT NULL DEFAULT now(),
    last_login_at            timestamptz,

    -- Một tài khoản Google/Facebook/SĐT chỉ gắn được với đúng 1 user
    CONSTRAINT auth_identities_provider_uq UNIQUE (provider, provider_user_id),
    -- Mỗi user chỉ có tối đa 1 identity cho mỗi provider
    CONSTRAINT auth_identities_user_provider_uq UNIQUE (user_id, provider),

    CONSTRAINT auth_identities_provider_uid_not_blank
        CHECK (length(btrim(provider_user_id)) > 0),
    -- Provider phone thì provider_user_id phải là số E.164
    CONSTRAINT auth_identities_phone_e164
        CHECK (provider <> 'phone' OR provider_user_id ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT auth_identities_email_format
        CHECK (provider_email IS NULL OR provider_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT auth_identities_email_verified_needs_email
        CHECK (NOT provider_email_verified OR provider_email IS NOT NULL),
    CONSTRAINT auth_identities_raw_profile_object
        CHECK (jsonb_typeof(raw_profile) = 'object')
);

CREATE INDEX auth_identities_user_idx  ON auth_identities (user_id);
-- Dùng khi cần tìm tài khoản có sẵn theo email để gợi ý liên kết
CREATE INDEX auth_identities_email_idx ON auth_identities (lower(provider_email))
    WHERE provider_email IS NOT NULL;

CREATE TRIGGER trg_auth_identities_updated_at
    BEFORE UPDATE ON auth_identities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 10. PHONE_OTPS  *** MỚI ***
-- Dùng khi tự quản lý OTP qua SMS. Chỉ lưu HASH của mã OTP.
-- Nếu dùng dịch vụ ngoài (Firebase Auth, Twilio Verify...) có thể bỏ bảng này.
-- ---------------------------------------------------------------------
CREATE TABLE phone_otps (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    phone         varchar(20)  NOT NULL,
    purpose       otp_purpose  NOT NULL DEFAULT 'login',
    otp_hash      text         NOT NULL,
    attempts      smallint     NOT NULL DEFAULT 0,
    max_attempts  smallint     NOT NULL DEFAULT 5,
    ip_address    inet,
    expires_at    timestamptz  NOT NULL,
    consumed_at   timestamptz,
    created_at    timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT phone_otps_phone_e164  CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT phone_otps_hash_not_blank CHECK (length(btrim(otp_hash)) > 0),
    CONSTRAINT phone_otps_max_attempts CHECK (max_attempts BETWEEN 1 AND 20),
    CONSTRAINT phone_otps_attempts CHECK (attempts BETWEEN 0 AND max_attempts),
    CONSTRAINT phone_otps_expiry CHECK (expires_at > created_at)
);

-- Lấy OTP mới nhất của một SĐT + mục đích; giới hạn tần suất gửi
CREATE INDEX phone_otps_lookup_idx  ON phone_otps (phone, purpose, created_at DESC);
CREATE INDEX phone_otps_expires_idx ON phone_otps (expires_at);

-- ---------------------------------------------------------------------
-- 11. USER_SESSIONS  *** MỚI ***
-- Refresh token / phiên đăng nhập theo thiết bị. Chỉ lưu HASH của token.
-- identity_id cho biết phiên này được tạo bằng cách đăng nhập nào.
-- ---------------------------------------------------------------------
CREATE TABLE user_sessions (
    id                  uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid             NOT NULL
                                         REFERENCES users (id) ON DELETE CASCADE,
    identity_id         uuid             REFERENCES auth_identities (id) ON DELETE SET NULL,
    refresh_token_hash  text             NOT NULL,
    device_id           varchar(100),
    device_name         varchar(100),
    platform            device_platform,
    ip_address          inet,
    user_agent          text,
    created_at          timestamptz      NOT NULL DEFAULT now(),
    last_used_at        timestamptz,
    expires_at          timestamptz      NOT NULL,
    revoked_at          timestamptz,

    CONSTRAINT user_sessions_token_uq UNIQUE (refresh_token_hash),
    CONSTRAINT user_sessions_token_not_blank CHECK (length(btrim(refresh_token_hash)) > 0),
    CONSTRAINT user_sessions_expiry  CHECK (expires_at > created_at),
    CONSTRAINT user_sessions_revoked CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX user_sessions_user_active_idx ON user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX user_sessions_identity_idx    ON user_sessions (identity_id);
CREATE INDEX user_sessions_expires_idx     ON user_sessions (expires_at);

-- ---------------------------------------------------------------------
-- 12. LOGIN_EVENTS  *** MỚI ***
-- Nhật ký đăng nhập (thành công / thất bại) để audit và chống brute-force.
-- user_id có thể NULL (đăng nhập thất bại, chưa xác định được tài khoản).
-- ---------------------------------------------------------------------
CREATE TABLE login_events (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid           REFERENCES users (id) ON DELETE SET NULL,
    provider        auth_provider  NOT NULL,
    identifier      varchar(255),                 -- SĐT / email đã thử đăng nhập
    success         boolean        NOT NULL,
    failure_reason  varchar(100),
    ip_address      inet,
    user_agent      text,
    created_at      timestamptz    NOT NULL DEFAULT now(),

    -- Thành công thì không có lý do lỗi
    CONSTRAINT login_events_reason_consistent
        CHECK (success = (failure_reason IS NULL))
);

CREATE INDEX login_events_user_idx       ON login_events (user_id, created_at DESC);
CREATE INDEX login_events_ip_idx         ON login_events (ip_address, created_at DESC);
CREATE INDEX login_events_identifier_idx ON login_events (identifier, created_at DESC);

-- ---------------------------------------------------------------------
-- 13. TRIGGERS NGHIỆP VỤ
-- ---------------------------------------------------------------------

-- 13.1 Người gửi phải là một trong hai người của match, và match phải còn active
CREATE OR REPLACE FUNCTION validate_message_sender()
RETURNS trigger AS $$
DECLARE
    m matches%ROWTYPE;
BEGIN
    SELECT mt.* INTO m
    FROM conversations c
    JOIN matches mt ON mt.id = c.match_id
    WHERE c.id = NEW.conversation_id;

    IF NEW.sender_id NOT IN (m.user1_id, m.user2_id) THEN
        RAISE EXCEPTION 'Sender % is not a participant of conversation %',
            NEW.sender_id, NEW.conversation_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF m.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot send message: match is unmatched'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_validate_sender
    BEFORE INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION validate_message_sender();

-- 13.2 Cập nhật conversations.last_message_at khi có tin nhắn mới
CREATE OR REPLACE FUNCTION touch_conversation_last_message()
RETURNS trigger AS $$
BEGIN
    UPDATE conversations
       SET last_message_at = NEW.created_at
     WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_touch_conversation
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION touch_conversation_last_message();

-- 13.3 Tự động tạo match + conversation khi hai người like nhau
CREATE OR REPLACE FUNCTION create_match_on_mutual_like()
RETURNS trigger AS $$
DECLARE
    v_match_id uuid;
BEGIN
    IF NEW.action IN ('like', 'super_like')
       AND EXISTS (
            SELECT 1 FROM swipes s
            WHERE s.swiper_id = NEW.swiped_id
              AND s.swiped_id = NEW.swiper_id
              AND s.action IN ('like', 'super_like')
       )
    THEN
        INSERT INTO matches (user1_id, user2_id)
        VALUES (LEAST(NEW.swiper_id, NEW.swiped_id),
                GREATEST(NEW.swiper_id, NEW.swiped_id))
        ON CONFLICT (user1_id, user2_id) DO NOTHING
        RETURNING id INTO v_match_id;

        IF v_match_id IS NOT NULL THEN
            INSERT INTO conversations (match_id) VALUES (v_match_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_swipes_create_match
    AFTER INSERT ON swipes
    FOR EACH ROW EXECUTE FUNCTION create_match_on_mutual_like();

-- 13.4 Khi liên kết identity, đồng bộ ngược email/SĐT đã xác minh sang users
--      (chỉ điền khi users còn trống và không trùng với người khác)
CREATE OR REPLACE FUNCTION sync_user_from_identity()
RETURNS trigger AS $$
BEGIN
    IF NEW.provider = 'phone' THEN
        UPDATE users u
           SET phone             = COALESCE(u.phone, NEW.provider_user_id),
               phone_verified_at = COALESCE(u.phone_verified_at, now())
         WHERE u.id = NEW.user_id
           AND (u.phone IS NULL OR u.phone = NEW.provider_user_id)
           AND NOT EXISTS (
                SELECT 1 FROM users o
                WHERE o.phone = NEW.provider_user_id AND o.id <> NEW.user_id
           );
    ELSIF NEW.provider_email IS NOT NULL AND NEW.provider_email_verified THEN
        UPDATE users u
           SET email             = COALESCE(u.email, NEW.provider_email),
               email_verified_at = COALESCE(u.email_verified_at, now())
         WHERE u.id = NEW.user_id
           AND (u.email IS NULL OR lower(u.email) = lower(NEW.provider_email))
           AND NOT EXISTS (
                SELECT 1 FROM users o
                WHERE lower(o.email) = lower(NEW.provider_email) AND o.id <> NEW.user_id
           );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auth_identities_sync_user
    AFTER INSERT ON auth_identities
    FOR EACH ROW EXECUTE FUNCTION sync_user_from_identity();

-- 13.5 Mỗi tài khoản phải luôn còn ít nhất 1 cách đăng nhập
--      (mật khẩu HOẶC ít nhất 1 auth_identity).
--      Kiểm tra DEFERRED: cuối transaction mới kiểm tra, nên có thể
--      INSERT users rồi INSERT auth_identities trong cùng 1 transaction,
--      và xoá user (cascade) không bị chặn.
CREATE OR REPLACE FUNCTION ensure_user_has_login_method()
RETURNS trigger AS $$
DECLARE
    v_user_id uuid;
    v_hash    text;
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        v_user_id := NEW.id;
    ELSE
        v_user_id := OLD.user_id;
    END IF;

    SELECT u.password_hash INTO v_hash FROM users u WHERE u.id = v_user_id;
    IF NOT FOUND THEN
        RETURN NULL;   -- user đã bị xoá, không cần kiểm tra
    END IF;

    IF v_hash IS NULL
       AND NOT EXISTS (SELECT 1 FROM auth_identities a WHERE a.user_id = v_user_id) THEN
        RAISE EXCEPTION 'User % must have at least one login method (password or identity)', v_user_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_users_login_method
    AFTER INSERT OR UPDATE OF password_hash ON users
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ensure_user_has_login_method();

CREATE CONSTRAINT TRIGGER trg_auth_identities_login_method
    AFTER DELETE ON auth_identities
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ensure_user_has_login_method();

-- 13.6 Dọn dữ liệu hết hạn (gọi định kỳ bằng cron / pg_cron)
--      SELECT purge_expired_auth_data();
CREATE OR REPLACE FUNCTION purge_expired_auth_data(p_keep interval DEFAULT interval '7 days')
RETURNS void AS $$
BEGIN
    DELETE FROM phone_otps
     WHERE expires_at < now() - p_keep;

    DELETE FROM user_sessions
     WHERE expires_at < now() - p_keep
        OR (revoked_at IS NOT NULL AND revoked_at < now() - p_keep);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================================
-- Ví dụ luồng đăng ký bằng Google (chạy trong 1 transaction):
--
--   BEGIN;
--   INSERT INTO users (email) VALUES ('an@example.com') RETURNING id;
--   INSERT INTO auth_identities
--       (user_id, provider, provider_user_id, provider_email, provider_email_verified)
--   VALUES (:user_id, 'google', '1098765432109876543', 'an@example.com', true);
--   COMMIT;
--
-- Ví dụ đăng ký bằng SĐT:
--   BEGIN;
--   INSERT INTO users DEFAULT VALUES RETURNING id;
--   INSERT INTO auth_identities (user_id, provider, provider_user_id)
--   VALUES (:user_id, 'phone', '+84901234567');
--   COMMIT;
-- =====================================================================
