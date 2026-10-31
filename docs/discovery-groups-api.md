# Discovery groups and relationship intentions

Tài liệu này mô tả API backend để FE xây màn Khám Phá như hình mẫu: các card hội có số thành viên, các card theo mục đích hẹn hò, tham gia/rời hội, và tải danh sách hồ sơ theo feed recommendation.

## Authentication

Tất cả endpoint trong tài liệu này yêu cầu Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

Backend xác thực token và tự lấy user hiện tại. FE không gửi `userId` cho các endpoint này. Tài khoản phải được liên kết Firebase và đang ở trạng thái active. Endpoint join còn yêu cầu user đã có profile.

## Relationship intention trên profile

`relationship_intention` là một giá trị đơn, có thể để `null`. Các giá trị hợp lệ hiện tại:

```text
Người yêu
Bạn hẹn hò lâu dài
Bất kì
Bạn mới
Chưa rõ
```

Cập nhật hồ sơ của user đang đăng nhập:

```http
PATCH /api/profiles/me/relationship-intention
Content-Type: application/json
Authorization: Bearer <firebase-id-token>

{
  "relationship_intention": "Bạn hẹn hò lâu dài"
}
```

Đặt về chưa chọn bằng `null`:

```json
{ "relationship_intention": null }
```

Backend kiểm tra các giá trị ở API và PostgreSQL. Giá trị không thuộc danh sách trả `400`. Khi đọc profile, field này có trong object profile.

## Tải card mục đích hẹn hò và số lượng hồ sơ

```http
GET /api/discovery-groups/intentions
```

Response trả đủ các lựa chọn, kể cả lựa chọn chưa có hồ sơ nào. `member_count` là số profile đang active tự khai lựa chọn đó; đây là số liệu đếm trực tiếp, không phải bộ đếm lưu riêng.

```json
{
  "success": true,
  "data": [
    { "value": "Người yêu", "member_count": 6500 },
    { "value": "Bạn hẹn hò lâu dài", "member_count": 4100 },
    { "value": "Bất kì", "member_count": 1200 },
    { "value": "Bạn mới", "member_count": 800 },
    { "value": "Chưa rõ", "member_count": 240 }
  ]
}
```

FE có thể map `value` sang tiêu đề/ảnh theo thiết kế; không hard-code `member_count`. Số được trả dạng integer, FE tự format theo locale, ví dụ `Intl.NumberFormat("vi-VN", { notation: "compact" })`.

## Tải danh sách hội

```http
GET /api/discovery-groups
```

Chỉ trả các hội đang active. Mỗi hội gồm số thành viên active và trạng thái tham gia của user hiện tại.

```json
{
  "success": true,
  "data": [
    {
      "id": "8d721bf7-8c55-4acd-973a-f92ed68b1b25",
      "slug": "me-game",
      "name": "Hội mê game",
      "is_active": true,
      "member_count": 866,
      "is_member": true
    },
    {
      "id": "5210f07c-35a7-42df-9d7c-cbf4709e8a1d",
      "slug": "me-phim",
      "name": "Hội mê phim",
      "is_active": true,
      "member_count": 2200,
      "is_member": false
    }
  ]
}
```

Database có 16 hội cố định; backend chỉ có API đọc danh sách, không có API để user tạo/sửa/tắt hội hay tự thay đổi membership.

| Slug | Tên hiển thị |
|---|---|
| `me-nghe-thuat` | Mê nghệ thuật |
| `me-game` | Hội mê game |
| `me-phim` | Hội mê phim |
| `du-lich` | Du lịch |
| `yeu-the-thao` | Yêu thể thao |
| `thich-di-nhau` | Thích đi nhậu |
| `me-am-thuc` | Mê ẩm thực |
| `yeu-thien-nhien` | Yêu thiên nhiên |
| `yeu-am-nhac` | Yêu âm nhạc |
| `thich-kham-pha-tri-thuc` | Thích khám phá tri thức |
| `song-tich-cuc` | Sống tích cực |
| `thich-ket-noi` | Thích kết nối |
| `nguoi-yeu` | Người yêu |
| `ban-hen-ho-lau-dai` | Bạn hẹn hò lâu dài |
| `bat-ki` | Bất kì |
| `ban-moi` | Bạn mới |

Membership được đồng bộ tự động từ hobby ID và `relationship_intention`, không dựa vào tên/category của hobby: ví dụ `gaming` đưa user vào `me-game`, `reading` đưa user vào `me-nghe-thuat`, còn `Người yêu` đưa user vào `nguoi-yeu`. Mapping nằm trong `discovery_group_hobbies` và `discovery_group_intentions`. Khi hobbies hoặc relationship intention thay đổi, PostgreSQL trigger thêm/xóa membership tương ứng; nếu `relationship_intention` là `null` hoặc `Chưa rõ`, user không thuộc 4 hội mục đích hẹn hò. Một user có thể thuộc nhiều hội.

Hai file JSON mẫu khớp nhau theo 101 hobby ID: profile lưu tên/category tiếng Việt từ catalog edit profile; database mapping ID sang một trong 12 hội hobby. `profiles.hobbies` giữ category của catalog, còn hội được tính theo mapping riêng.

## Tải recommendation theo hội

```http
GET /api/discovery-groups/me-game/recommendations?limit=20
```

Backend chỉ lấy thành viên active của hội, sau đó áp dụng eligibility hiện có (tuổi, giới tính, khoảng cách, swipe/match, trạng thái hiển thị) và ranking hiện tại. Feed dùng snapshot/cursor giống Discovery.

Response có shape recommendation hiện tại:

```json
{
  "success": true,
  "data": [
    {
      "id": "profile-uuid",
      "user_id": "user-uuid",
      "display_name": "Mai",
      "relationship_intention": "Bạn hẹn hò lâu dài",
      "hobbies": [],
      "distance_km": 12.4,
      "users": {
        "id": "user-uuid",
        "photos": []
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "sessionId": "session-uuid",
    "nextCursor": "session-uuid:20"
  }
}
```

Trang kế tiếp dùng cùng slug và cursor nguyên vẹn:

```http
GET /api/discovery-groups/me-game/recommendations?limit=20&cursor=session-uuid%3A20
```

Cursor thuộc về đúng user và đúng feed. Nếu gửi cursor của hội khác, hoặc thiếu/đổi filter, backend trả `400`; hãy bắt đầu request đầu tiên để tạo snapshot mới.

## Tải recommendation theo mục đích hẹn hò

```http
GET /api/discovery-groups/intentions/recommendations?relationshipIntention=Ng%C6%B0%E1%BB%9Di%20y%C3%AAu&limit=20
```

Giá trị filter phải là một trong các `value` từ endpoint `/intentions`. Filter là exact match trên `profiles.relationship_intention`; recommendation tiếp tục xếp hạng tập kết quả bằng hệ thống hiện có.

Trang kế tiếp phải giữ nguyên `relationshipIntention` và gửi cursor:

```http
GET /api/discovery-groups/intentions/recommendations?relationshipIntention=Ng%C6%B0%E1%BB%9Di%20y%C3%AAu&limit=20&cursor=session-uuid%3A20
```

FE nên dùng `URLSearchParams` để encode tiếng Việt. Không đưa `userId` vào URL; backend lấy user từ Firebase token.

Có thể kết hợp hội với mục đích hẹn hò:

```http
GET /api/discovery-groups/me-game/recommendations?relationshipIntention=B%E1%BA%A1n%20h%E1%BA%B9n%20h%C3%B2%20l%C3%A2u%20d%C3%A0i
```

Khi kết hợp, ứng viên phải là thành viên hội **và** có đúng relationship intention đã chọn.

## Ghi impression cho card đã hiển thị

Chỉ gửi candidate thực sự được đưa lên màn hình, dùng endpoint tương ứng với feed đã mở.

```http
POST /api/discovery-groups/me-game/recommendations/impressions
Content-Type: application/json

{
  "sessionId": "session-uuid",
  "candidateUserIds": ["candidate-user-uuid"]
}
```

Với feed relationship intention:

```http
POST /api/discovery-groups/intentions/recommendations/impressions
Content-Type: application/json

{
  "sessionId": "session-uuid",
  "candidateUserIds": ["candidate-user-uuid"]
}
```

Backend chỉ ghi candidate thuộc session của user đang đăng nhập. Gửi lặp không tạo impression trùng.

## Gợi ý luồng màn FE

1. Khi mở Khám Phá, gọi song song `GET /api/discovery-groups` và `GET /api/discovery-groups/intentions` để dựng card.
2. Khi bấm card hội, tải `GET /api/discovery-groups/{slug}/recommendations`; khi bấm card mục đích, tải endpoint `.../intentions/recommendations` với `relationshipIntention`.
3. Lưu riêng `sessionId` và `nextCursor` cho từng feed. Khi đổi card hoặc filter, xóa pagination state cũ và gọi lại trang đầu.
4. Chỉ gửi impression cho card đang hiển thị; không gửi toàn bộ batch đã tải.
5. `is_member` cho biết hobbies của user hiện tại có map vào hội đó hay không; membership do backend/database đồng bộ.
6. Nếu session hết hạn hoặc cursor lỗi, bỏ cursor và tải lại trang đầu.

## Lỗi thường gặp

| HTTP | Trường hợp |
|---|---|
| `400` | Slug, cursor, query hoặc payload sai; cursor không đúng feed |
| `401` | Thiếu hoặc Firebase ID token không hợp lệ |
| `403` | Tài khoản không active |
| `404` | Hội không tồn tại/đã tắt, user không active, hoặc session không còn |

`member_count` được tính từ membership tự đồng bộ của user active có profile. Không có cột count lưu dư thừa nên số phản ánh dữ liệu hiện tại, nhưng không nên gọi lại endpoint danh sách hội liên tục trong lúc cuộn feed.
