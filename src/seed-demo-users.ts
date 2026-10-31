import "dotenv/config";
import { Pool } from "pg";

const DEMO_USER_COUNT = 500;
const EMAIL_PREFIX = "demo.user.";
const HCMC_CENTER = { latitude: 10.7769, longitude: 106.7009 };

const photoUrls = [
  "https://scontent.fsgn2-9.fna.fbcdn.net/v/t39.30808-6/865612753_1689385679246656_5046864739759194350_n.jpg?stp=dst-jpg_tt6&cstp=mx1366x2048&ctp=s1366x2048&_nc_cat=104&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_ohc=Dpwb7tNdX10Q7kNvwFZPtHW&_nc_oc=Adr9GEXqAtBkMZU-g_LTpiakIIKf0vrtbvRlEE6Yc5fF6uct4V66rLsY9sLl1Nhmegs&_nc_zt=23&_nc_ht=scontent.fsgn2-9.fna&_nc_gid=dlmIY_wP-4bcReQPVeDBYg&_nc_ss=7b2a8&oh=00_AQRfBsIJWMtn0qMqdZ6ZaBx11gMe9S34mT7Obd21vDAbZQ&oe=6AEB2FA0",
  "https://scontent.fsgn2-10.fna.fbcdn.net/v/t39.99422-6/725698296_1668687537760218_1204187028849674638_n.png?stp=dst-jpg_tt6&cstp=mx1290x2001&ctp=p526x296&_nc_cat=110&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=833d8c&_nc_ohc=gHlD0QazJa0Q7kNvwHYiXc8&_nc_oc=Adouhp0KyPiPUkjLWkyqom2aGM7s1oDcarr6JNqZ7ZXGiYEc6nYuikHZ8oY6hVh1Lxo&_nc_zt=14&_nc_ht=scontent.fsgn2-10.fna&_nc_gid=DlWRcNsssBI1H5bUXmMzpA&_nc_ss=7b2a8&oh=00_AQRL0gNGOPORLtd32YC2e5aNrTaSJw-888mItZh-tNkUNA&oe=6AEB3767",
  "https://scontent.fsgn2-7.fna.fbcdn.net/v/t39.30808-6/820204760_122208658130836060_6847384075328321892_n.jpg?stp=cp6_dst-jpg_tt6&cstp=mx1536x2048&ctp=s1536x2048&_nc_cat=105&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Sl_ScEzlAL4Q7kNvwFJ2aQ7&_nc_oc=AdqdJ-D4-zHKUooj2H-lpEVsoMnhlrnJCyQ8pnRlYAw4kwEZaSKzp5EVR2EblGiCnVw&_nc_zt=23&_nc_ht=scontent.fsgn2-7.fna&_nc_gid=TSzI8nJOZTQ-Tsm1fCg7zg&_nc_ss=7b2a8&oh=00_AQRhEDAs7uRoUwWUuct4IFHW-DpnB6rE7-r4_Lc5kwJz5Q&oe=6AEB24FE",
  "https://scontent.fsgn2-8.fna.fbcdn.net/v/t39.30808-6/796659456_122208285920836060_4961163202190765381_n.jpg?stp=dst-jpg_tt6&cstp=mx1544x2048&ctp=s1544x2048&_nc_cat=102&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=127cfc&_nc_ohc=y8U0AMP5rxkQ7kNvwGqwRxo&_nc_oc=Adrz5YREzxrkmk9x0SFrqcwlGgCIpofjVG4YB-PmQVsoSzguGJprp_TQKZUpJjEMO-U&_nc_zt=23&_nc_ht=scontent.fsgn2-8.fna&_nc_gid=_lOqEXu0veJNtTEo-ZrSFQ&_nc_ss=7b2a8&oh=00_AQRE6c4-Xbp3bu1XUysahazulo6iFbNov27ANtmNCtADJw&oe=6AEB550F",
  "https://scontent.fsgn2-5.fna.fbcdn.net/v/t39.30808-6/788081099_122204529128836060_2627646288432632863_n.jpg?stp=dst-jpg_tt6&cstp=mx1637x2048&ctp=s1637x2048&_nc_cat=110&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=127cfc&_nc_ohc=6Hy--AFprTsQ7kNvwEnA40o&_nc_oc=AdpVNhS8fCTxlx3zjJO86fr_soz7Flh6qE_IKdykoT5wZ9VnTc0BIq1fOKIkoAzVTGc&_nc_zt=23&_nc_ht=scontent.fsgn2-5.fna&_nc_gid=oWZjUyt3cFQtkLW54uOYRA&_nc_ss=7b2a8&oh=00_AQQn_9g4rLY86iX8pdIbn4Dhz9ugCaWRjgIXKRrbpI53Ig&oe=6AEB3B68",
];

const localizedCategories = [
  "Âm nhạc",
  "Ẩm thực & Đồ uống",
  "Cộng đồng & Lối sống",
  "Du lịch & Khám phá",
  "Giao lưu & Đời sống về đêm",
  "Học tập & Công nghệ",
  "Nghệ thuật & Sáng tạo",
  "Phim ảnh & Giải trí",
  "Sức khỏe & Phong cách sống",
  "Thể thao & Thể hình",
  "Thiên nhiên & Ngoài trời",
  "Trò chơi",
];

const femaleNames = [
  "Thảo", "Ngọc", "Hân", "Mai", "Linh", "Vy", "Chi", "Quỳnh", "Trang", "Phương",
  "My", "Nhi", "Ngân", "Trâm", "Hương", "Diễm", "Thu", "Yến", "Oanh", "Tuyết",
];
const maleNames = [
  "Minh", "Hoàng", "Huy", "Tuấn", "Nam", "Khoa", "Quân", "Duy", "Long", "Phúc",
  "Thành", "Đức", "Hải", "Tùng", "Kiệt", "Khôi", "Vinh", "Bảo", "Trung", "Sơn",
];
const unisexNames = ["An", "Bình", "Giang", "Khánh", "Minh", "Ngọc", "Phương", "Thanh"];
const familyNames = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đoàn", "Trương", "Mai", "Cao",
];
const wards = [
  "Phường Bến Nghé", "Phường Bến Thành", "Phường Cầu Ông Lãnh", "Phường Đa Kao",
  "Phường Tân Định", "Phường Thảo Điền", "Phường An Phú", "Phường Bình Thạnh",
  "Phường Phú Nhuận", "Phường Tân Phú", "Phường 7", "Phường 10",
];
const jobs = [
  "Thiết kế đồ họa", "Kỹ sư phần mềm", "Marketing", "Giáo viên", "Chuyên viên tài chính",
  "Nhiếp ảnh gia", "Nhân viên kinh doanh", "Đầu bếp", "Kiến trúc sư", "Chuyên viên nhân sự",
  "Bác sĩ", "Sinh viên", "Quản lý sản phẩm", "Nhà sáng tạo nội dung", "Luật sư",
];
const educationOptions = ["Cao đẳng", "Đại học", "Thạc sĩ", "Đang học đại học"];
const petOptions = ["Chó", "Mèo", "Chó và mèo", "Không nuôi thú cưng"];
const lifestyles = ["Không hút thuốc", "Thích vận động", "Ngủ sớm", "Thích cà phê", "Ăn uống lành mạnh", "Thỉnh thoảng uống rượu"];
const intentions = ["Người yêu", "Bạn hẹn hò lâu dài", "Bất kì", "Bạn mới", "Chưa rõ", null];
const interestOptions = ["male", "female", "everyone"] as const;
const relationshipLanguages = [["Tiếng Việt"], ["Tiếng Việt", "English"]];

type Hobby = { id: string; name: string; category: string };

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffled<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = randomInt(0, index);
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

function makeBirthDate(age: number): string {
  const now = new Date();
  const year = now.getUTCFullYear() - age;
  const month = randomInt(0, 11);
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  firstOfMonth.setUTCDate(randomInt(1, lastDay));
  return firstOfMonth.toISOString().slice(0, 10);
}

function makeCoordinates() {
  const angle = Math.random() * Math.PI * 2;
  const radiusDegrees = Math.sqrt(Math.random()) * 0.065;
  return {
    latitude: Number((HCMC_CENTER.latitude + radiusDegrees * Math.cos(angle)).toFixed(6)),
    longitude: Number((HCMC_CENTER.longitude + radiusDegrees * Math.sin(angle) / Math.cos(HCMC_CENTER.latitude * Math.PI / 180)).toFixed(6)),
  };
}

function chooseHobbies(catalog: Hobby[]): Hobby[] {
  const byCategory = new Map<string, Hobby[]>();
  for (const hobby of catalog) {
    const group = byCategory.get(hobby.category) ?? [];
    group.push(hobby);
    byCategory.set(hobby.category, group);
  }

  const categories = shuffled([...byCategory.keys()]);
  const target = randomInt(7, 8);
  const chosen: Hobby[] = [];
  for (const category of categories) {
    if (chosen.length >= target) break;
    const options = shuffled(byCategory.get(category) ?? []);
    chosen.push(...options.slice(0, Math.min(randomInt(1, 2), target - chosen.length)));
  }
  return chosen;
}

function demoEmail(index: number): string {
  return `${EMAIL_PREFIX}${String(index).padStart(4, "0")}@example.com`;
}

function makeDisplayName(index: number, gender: string): string {
  const givenNames = gender === "female"
    ? femaleNames
    : gender === "male"
      ? maleNames
      : unisexNames;
  const familyName = familyNames[(index * 7) % familyNames.length]!;
  const givenName = givenNames[(index * 13) % givenNames.length]!;
  return `${familyName} ${givenName}`;
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DIRECT_URL or DATABASE_URL before seeding demo users");

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const hobbyResult = await client.query<Hobby>(
    `SELECT DISTINCT ON (hobby->>'id')
       hobby->>'id' AS id, hobby->>'name' AS name, hobby->>'category' AS category
     FROM public.profiles AS profile
     CROSS JOIN LATERAL jsonb_array_elements(profile.hobbies) AS hobby
     WHERE hobby->>'category' = ANY($1::text[])
       AND EXISTS (
         SELECT 1 FROM public.discovery_group_hobbies AS mapping
         WHERE mapping.hobby_id = hobby->>'id'
       )
     ORDER BY hobby->>'id', hobby->>'name'`,
    [localizedCategories],
  );
  if (hobbyResult.rows.length < 50) {
    throw new Error(`Expected a localized hobby catalog, found ${hobbyResult.rows.length} hobbies`);
  }
  const catalog = hobbyResult.rows;

  const requestedEmails = Array.from({ length: DEMO_USER_COUNT }, (_, index) => demoEmail(index + 1));
  const existing = await client.query<{ id: string; email: string; gender: string }>(
    `SELECT user_row.id, user_row.email, profile.gender::text AS gender
     FROM public.users AS user_row
     JOIN public.profiles AS profile ON profile.user_id = user_row.id
     WHERE user_row.email = ANY($1::text[])`,
    [requestedEmails],
  );
  const existingEmails = new Set(existing.rows.map((row) => row.email));
  const usersToCreate = requestedEmails.filter((email) => !existingEmails.has(email));
  const existingNameUpdates = existing.rows.map(({ id, email, gender }) => ({
    user_id: id,
    display_name: makeDisplayName(
      Number(email.slice(EMAIL_PREFIX.length, EMAIL_PREFIX.length + 4)),
      gender,
    ),
  }));
  const updatedExistingNames = existingNameUpdates.length
    ? await client.query(
        `UPDATE public.profiles AS profile
         SET display_name = input.display_name
         FROM jsonb_to_recordset($1::jsonb) AS input(user_id uuid, display_name varchar(50))
         WHERE profile.user_id = input.user_id`,
        [JSON.stringify(existingNameUpdates)],
      )
    : { rowCount: 0 };

  if (usersToCreate.length === 0) {
    await client.query("COMMIT");
    console.log(JSON.stringify({
      created_users: 0,
      updated_existing_names: updatedExistingNames.rowCount,
      total_demo_user_slots: DEMO_USER_COUNT,
    }, null, 2));
  } else {
    const insertedUsers = await client.query<{ id: string; email: string }>(
      `INSERT INTO public.users (email, status, last_active_at)
       SELECT email, 'active'::public.user_status, now() - (random() * interval '3 days')
       FROM unnest($1::text[]) AS input(email)
       RETURNING id, email`,
      [usersToCreate],
    );

    const profileRows = insertedUsers.rows.map(({ id, email }) => {
      const index = Number(email.slice(EMAIL_PREFIX.length, EMAIL_PREFIX.length + 4));
      const { latitude, longitude } = makeCoordinates();
      const gender = Math.random() < 0.48 ? "female" : Math.random() < 0.92 ? "male" : "non_binary";
      const chosenHobbies = chooseHobbies(catalog);
      return {
        user_id: id,
        display_name: makeDisplayName(index, gender),
        birth_date: makeBirthDate(randomInt(20, 40)),
        gender,
        bio: pick([
          "Thích khám phá những quán cà phê mới và trò chuyện vui vẻ.",
          "Cuối tuần thường dành thời gian cho bạn bè, âm nhạc và những chuyến đi ngắn.",
          "Yêu cuộc sống ở thành phố, thích thử điều mới và giữ năng lượng tích cực.",
          "Tìm người hợp gu để cùng chia sẻ những điều giản dị mỗi ngày.",
          "Thích vận động, xem phim và khám phá ẩm thực Sài Gòn.",
        ]),
        job_title: pick(jobs),
        pet: pick(petOptions),
        life_style: shuffled(lifestyles).slice(0, randomInt(2, 4)),
        hobbies: chosenHobbies,
        education: pick(educationOptions),
        height_cm: randomInt(gender === "female" ? 150 : 163, gender === "female" ? 178 : 192),
        city: "Hồ Chí Minh",
        ward: pick(wards),
        latitude,
        longitude,
        relationship_intention: pick(intentions),
        languages: pick(relationshipLanguages),
      };
    });

    await client.query(
      `INSERT INTO public.profiles (
         user_id, display_name, birth_date, gender, bio, job_title, pet,
         life_style, hobbies, education, height_cm, city, ward, latitude,
         longitude, relationship_intention, languages
       )
       SELECT user_id, display_name, birth_date, gender::public.gender_type, bio,
              job_title, pet, life_style, hobbies, education, height_cm, city,
              ward, latitude, longitude, relationship_intention, languages
       FROM jsonb_to_recordset($1::jsonb) AS profile(
         user_id uuid, display_name varchar(50), birth_date date, gender text,
         bio text, job_title varchar(100), pet varchar(50), life_style varchar(50)[],
         hobbies jsonb, education varchar(100), height_cm smallint, city varchar(100),
         ward varchar(100), latitude numeric(9,6), longitude numeric(9,6),
         relationship_intention varchar(50), languages varchar(50)[]
       )`,
      [JSON.stringify(profileRows)],
    );

    const preferenceRows = insertedUsers.rows.map(({ id }) => ({
      user_id: id,
      interested_in: pick(interestOptions),
      age_min: randomInt(18, 24),
      age_max: randomInt(45, 65),
      max_distance_km: randomInt(25, 80),
      show_me: true,
      interested_languages: pick(relationshipLanguages),
    }));
    await client.query(
      `INSERT INTO public.preferences (
         user_id, interested_in, age_min, age_max, max_distance_km, show_me,
         interested_languages
       )
       SELECT user_id, interested_in::public.interested_type, age_min, age_max,
              max_distance_km, show_me, interested_languages
       FROM jsonb_to_recordset($1::jsonb) AS preference(
         user_id uuid, interested_in text, age_min smallint, age_max smallint,
         max_distance_km integer, show_me boolean, interested_languages varchar(50)[]
       )`,
      [JSON.stringify(preferenceRows)],
    );

    const photoRows = insertedUsers.rows.map(({ id }) => ({
      user_id: id,
      url: pick(photoUrls),
    }));
    await client.query(
      `INSERT INTO public.photos (user_id, url, position, is_primary)
       SELECT user_id, url, 0, true
       FROM jsonb_to_recordset($1::jsonb) AS photo(user_id uuid, url text)`,
      [JSON.stringify(photoRows)],
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({
      created_users: insertedUsers.rowCount,
      total_demo_user_slots: DEMO_USER_COUNT,
      created_profiles: profileRows.length,
      created_preferences: preferenceRows.length,
      created_primary_photos: photoRows.length,
      updated_existing_names: updatedExistingNames.rowCount,
      hobby_catalog_size: catalog.length,
    }, null, 2));
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
