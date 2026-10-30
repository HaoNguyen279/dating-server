# Recommendations API and Ranking

Tài liệu này mô tả contract hiện tại của backend Express + Prisma, cách backend lọc/xếp hạng profile và cách frontend tiếp tục tải trang cũng như ghi nhận impression.

## 1. API base và định danh người xem

Backend mount recommendations dưới prefix:

```text
/api/recommendations
```

Ví dụ local: `http://localhost:3000/api/recommendations` (PORT mặc định của server là `3000`). Khi gọi từ app, dùng API base URL đang được cấu hình trong client; không hard-code localhost trên thiết bị thật.

Recommendations controller nhận `userId` từ path hoặc query. Với FE, hãy dùng user ID của tài khoản hiện đăng nhập và ưu tiên route path. Controller hiện chưa lấy viewer ID từ JWT claim; route recommendations cũng chưa gắn middleware xác thực riêng.

## 2. Tải recommendations

### Request đầu tiên

```http
GET /api/recommendations/{userId}?limit=20
```

| Parameter | Vị trí | Bắt buộc | Quy tắc |
|---|---|---:|---|
| `userId` | path | Có | UUID của viewer |
| `limit` | query | Không | Số nguyên từ 1 đến 50; mặc định 20 |
| `cursor` | query | Không | Bỏ trống ở request đầu tiên |

Ví dụ:

```http
GET /api/recommendations/11111111-1111-4111-8111-111111111111?limit=20
```

Route tương thích cũ cũng tồn tại:

```http
GET /api/recommendations?userId={userId}&limit=20
```

FE mới nên dùng route có `userId` trong path.

### Response có kết quả

```json
{
  "success": true,
  "data": [
    {
      "id": "profile-uuid",
      "user_id": "candidate-user-uuid",
      "display_name": "Mai",
      "birth_date": "1998-06-12T00:00:00.000Z",
      "gender": "female",
      "bio": "Thích đi bộ và đọc sách",
      "job_title": "Designer",
      "pet": "Mèo",
      "life_style": ["Yoga"],
      "hobbies": [
        { "id": "reading", "name": "Reading", "category": "Arts & Culture" }
      ],
      "education": "Cử nhân",
      "height_cm": 165,
      "city": "Hồ Chí Minh",
      "ward": "Phường Bến Nghé",
      "distance_km": 12.4,
      "is_verified": true,
      "languages": ["English", "Vietnamese"],
      "users": {
        "id": "candidate-user-uuid",
        "photos": [
          {
            "id": "photo-uuid",
            "url": "https://example.test/photo.jpg",
            "position": 0,
            "is_primary": true
          }
        ]
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "sessionId": "22222222-2222-4222-8222-222222222222",
    "nextCursor": "22222222-2222-4222-8222-222222222222:20"
  }
}
```

Các giá trị trong ví dụ chỉ minh họa shape, không phải profile cố định. `birth_date` được JSON serialize thành ISO date. `hobbies` là JSON object theo hobby ID/name/category. `pet` là string hoặc `null` theo schema hiện tại. `distance_km` là khoảng cách Haversine từ viewer đến candidate, làm tròn một chữ số thập phân; giá trị có thể là `null` nếu không tính được.

Recommendation response cố ý **không gửi** latitude/longitude, preferences, `last_active_at`, status tài khoản, `rankingScore`, feature scores hoặc `missingFeatures`. FE không được trông chờ các field này. Dùng `distance_km` nếu UI cần hiển thị khoảng cách số; `city` và `ward` vẫn là địa điểm profile.

### Response rỗng

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 20,
    "sessionId": null,
    "nextCursor": null
  }
}
```

Nếu request đầu tiên không có candidate hợp lệ thì session ID và cursor là `null`. Ở trang cursor, data cũng có thể rỗng nếu các candidate còn lại trong snapshot đều đã mất eligibility; response lúc đó vẫn trả session ID hiện tại và `nextCursor: null`. Empty state nên hiển thị theo `data.length === 0`; nếu cần thử lại sau khi user thay đổi profile/preferences, gọi lại request đầu tiên để tạo ranking session mới.

## 3. Cursor pagination

Nếu `nextCursor` khác `null`, gửi nguyên giá trị đó ở request kế tiếp:

```http
GET /api/recommendations/{userId}?limit=20&cursor={nextCursor}
```

Cursor là chuỗi opaque dạng `{sessionId}:{nextPosition}`. Client không tự tạo, giải mã, tăng position hoặc thay session ID. Dùng `URLSearchParams` để encode query parameter.

Quy tắc cho FE:

1. Lưu `sessionId` và `nextCursor` từ response đầu tiên.
2. Giữ nguyên session khi tải trang sau; không gọi request đầu tiên cho mỗi lần load-more.
3. Append `data` vào danh sách hiện tại theo đúng thứ tự server trả về; không sort ở client vì score không có trong API.
4. Nên dedupe theo `user_id` khi append để chống duplicate ở UI state.
5. Dừng tải khi `nextCursor === null`.
6. Khi refresh/reset discovery, bỏ danh sách/cursor/session cũ và gọi request đầu tiên để nhận snapshot mới.

Ranking session sống 24 giờ. Cursor sai, hết hạn hoặc thuộc user khác trả HTTP 400. Khi tải trang sau backend đọc candidate ID theo thứ tự snapshot, kiểm tra lại trạng thái tài khoản, swipe, match, preferences và khoảng cách; candidate không còn hợp lệ sẽ bị bỏ qua và con trỏ vẫn tiến lên.

Trang có thể chứa ít hơn `limit` phần tử nếu snapshot gần hết. Hãy dùng `nextCursor`, không suy luận đã hết dữ liệu chỉ từ số phần tử của trang.

Ví dụ JavaScript:

```ts
const first = await datingApi.getRecommendations(currentUserId, { limit: 20 });
setSessionId(first.pagination.sessionId);
setNextCursor(first.pagination.nextCursor);
setProfiles(first.data);

// Khi cần tải thêm:
if (nextCursor) {
  const page = await datingApi.getRecommendations(currentUserId, {
    limit: 20,
    cursor: nextCursor,
  });
  appendUniqueByUserId(page.data);
  setNextCursor(page.pagination.nextCursor);
}
```

## 4. Ghi nhận profile thực sự được hiển thị

```http
POST /api/recommendations/{userId}/impressions
Content-Type: application/json
```

Body:

```json
{
  "sessionId": "22222222-2222-4222-8222-222222222222",
  "candidateUserIds": ["candidate-user-uuid"]
}
```

- `sessionId`: session ID do GET trả về.
- `candidateUserIds`: UUID từ `profile.user_id`, **không dùng** `profile.id` (đó là ID của row profile). Body chỉ chấp nhận hai field `sessionId` và `candidateUserIds`.
- Mảng cần có 1–50 UUID. Backend bỏ qua ID không thuộc session đó.
- Session phải còn hạn và thuộc `userId` trên path.

Response:

```json
{
  "success": true,
  "data": { "recorded": 1 }
}
```

`recorded` là số impression mới được ghi. Một candidate chỉ được ghi một lần trong một session; gửi lại cùng user/session trả `recorded: 0`. Backend lấy `position` từ snapshot, nên client không gửi thứ tự hoặc score.

Chỉ gửi impression sau khi candidate card hiện tại thực sự được render và ở màn hình foreground/focused. Không gửi toàn bộ `data` vừa tải. UI hiện tại chờ card layout, Discovery focus, app active và 700 ms trước khi gửi; nếu card đổi hoặc app chuyển nền thì không ghi event đó.

## 5. Lỗi API

Response lỗi dùng JSON dạng:

```json
{
  "success": false,
  "message": "Invalid recommendation cursor"
}
```

| HTTP | Trường hợp thường gặp |
|---:|---|
| `400` | `userId` không phải UUID; `limit` ngoài 1–50; cursor sai/hết hạn/không thuộc viewer; viewer chưa có profile |
| `404` | Viewer không tồn tại hoặc không active; impression session không tồn tại, hết hạn hoặc không thuộc viewer |
| `500` | Lỗi backend không dự kiến |

Lỗi validation có thể bổ sung object `errors` theo field. Nếu nhận `400` cho cursor hết hạn, frontend nên bỏ snapshot cũ và bắt đầu một request mới; tránh retry liên tục với cursor cũ.

## 6. Pipeline và eligibility

Pipeline đang chạy:

```text
Viewer context
  → PostgreSQL eligibility filters / geo bounding box
  → exact reciprocal eligibility + Haversine distance
  → deterministic feature scoring
  → score DESC, user_id ASC
  → ranking snapshot
  → cursor pagination + eligibility recheck
  → client visibility impression
```

Eligibility là hard filter; score không thể làm candidate không đủ điều kiện xuất hiện. Hiện tại backend:

- Không đề xuất chính viewer; chỉ lấy user có status `active`.
- Chỉ lấy candidate có `show_me = true` (nếu candidate chưa có preference thì dùng default `true`).
- Tính tuổi từ `birth_date` tại ngày hiện tại, không dùng tuổi cache.
- Áp dụng khoảng tuổi và giới tính muốn tìm của viewer cho candidate, đồng thời kiểm tra candidate preferences có chấp nhận viewer theo tuổi/giới tính không.
- Không trả candidate mà viewer đã swipe bằng bất kỳ action nào (`like`, `pass`, `super_like`). Incoming swipe đơn phương không tự loại candidate.
- Loại active match khỏi discovery. Unmatch giữ nguyên swipe history; vì viewer đã swipe cặp đó nên candidate vẫn bị loại theo policy hiện tại.
- Yêu cầu khoảng cách nằm trong cả giới hạn của viewer và candidate. PostgreSQL dùng bounding box để giảm tập đọc; service dùng Haversine để xác minh chính xác.
- Nếu thiếu tọa độ cần thiết, fail closed: viewer thiếu tọa độ nhận danh sách rỗng; candidate thiếu/không hợp lệ bị loại.

Nếu viewer/candidate không có preferences row, default hiện tại là `interested_in: everyone`, `age_min: 18`, `age_max: 99`, `max_distance_km: 50`, `show_me: true`, `interested_languages: []`.

### Các chức năng chưa có trong backend hiện tại

Schema/API chưa có block hoặc report model; recommendation không thể lọc block hai chiều và không tạo report event. `user_status` hiện chỉ có `active`, `suspended`, `deleted`, chưa có enum `banned`. Nếu FE đang có nút block/report ở nơi khác, không suy luận rằng event đó đã được lưu hoặc đang ảnh hưởng ranking.

## 7. Scoring và ranking

Version hiện tại là `rule-v1`. Đây là baseline heuristic để ưu tiên thứ tự, **không phải** xác suất Like/Match, không phải thuật toán Tinder/Bumble và chưa được chứng minh là trọng số tối ưu.

| Feature | Weight | Cách tính |
|---|---:|---|
| Shared hobbies | 35% | Jaccard theo ID hobby đã biết: `intersection / union × 100`; bỏ ID trùng và ID ngoài catalog |
| Distance compatibility | 25% | `clamp(100 × (1 - distanceKm / radiusKm), 0, 100)`; radius là min của hai `max_distance_km` |
| Language compatibility | 15% | Chấm hai chiều: viewer `interested_languages` với candidate `languages`, và ngược lại; lấy trung bình các chiều có dữ liệu hợp lệ |
| Recent activity | 15% | Candidate `last_active_at`: ≤24 giờ 100; ≤72 giờ 80; ≤7 ngày 60; ≤30 ngày 30; cũ hơn 0 |
| Profile completeness | 10% | 25 điểm mỗi mục có dữ liệu: bio, job title, city/ward, ít nhất một ảnh |

Score cuối là tổng có trọng số và được làm tròn 2 chữ số. Tổng weight bằng 100%. Hobbies dùng ID trong catalog `hobbies_list.json`, không so tên hiển thị.

### Missing data

Các feature thiếu dùng điểm trung tính cố định `50`; weight không được phân bổ lại cho feature còn dữ liệu. Hành vi hiện tại:

- Hai bên có hobby hợp lệ nhưng không trùng: hobby score `0`.
- Hobbies chưa khai báo/không có ID hợp lệ: hobby score trung tính `50`, đánh dấu thiếu nội bộ.
- Một chiều ngôn ngữ không có preference hoặc không có danh sách ngôn ngữ: bỏ chiều đó; nếu chiều còn lại hợp lệ thì dùng chiều đó. Nếu không có chiều nào hợp lệ, language score `50`.
- `last_active_at` thiếu/không hợp lệ: activity score `50`.
- Tọa độ thiếu là hard eligibility failure, nên candidate không được scoring.

Các `missingFeatures` được lưu cùng snapshot để debug; API client không nhận chúng. Tie-breaker là `user_id` tăng dần để cùng score có thứ tự xác định.

## 8. Preferences liên quan

Các trường recommendation đọc từ `preferences`:

```text
interested_in: "male" | "female" | "everyone"
age_min, age_max: integer
max_distance_km: integer
show_me: boolean
interested_languages: string[]
```

`interested_languages` là soft ranking signal, không phải hard filter. Preference API hỗ trợ lưu trường này:

```http
PATCH /api/preferences/user/{userId}
Content-Type: application/json
```

```json
{
  "interested_languages": ["English", "Vietnamese"]
}
```

`PATCH` chỉ nhận field hợp lệ và cần ít nhất một field; `interested_languages` nhận tối đa 20 string, mỗi string dài 1–50 ký tự. Có thể dùng `PUT /api/preferences/user/{userId}` để upsert theo contract hiện tại của preferences API.

## 9. Dữ liệu snapshot

Prisma models được thêm:

- `recommendation_sessions`: viewer, `ranking_version`, thời điểm tạo và hết hạn.
- `recommendation_session_items`: candidate, `position`, `ranking_score`, `missing_features`.
- `recommendation_impressions`: viewer session/candidate, snapshot position và `viewed_at`.

Impression tái sử dụng swipe/match/conversation data hiện có cho các metric sau này; hiện chưa có analytics endpoint/dashboard tính like-through, match hoặc conversation-start rate.

