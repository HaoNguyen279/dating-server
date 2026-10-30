# Recommendation, Scoring và Ranking: nguyên lý và luồng hoạt động

Tài liệu này giải thích hệ thống bằng ngôn ngữ sản phẩm và luồng xử lý, không yêu cầu người đọc phải mở source code. Chi tiết endpoint, request/response và cách FE gọi API nằm trong [recommendations-api.md](./recommendations-api.md).

## 1. Hiểu nhanh ba khái niệm

- **Recommendation** chọn những profile có thể xuất hiện trong Discovery.
- **Eligibility** quyết định một profile có đủ điều kiện xuất hiện hay không. Đây là các điều kiện bắt buộc.
- **Scoring/Ranking** chấm và xếp thứ tự những profile đã đủ điều kiện. Điểm cao chỉ có nghĩa là được ưu tiên hiển thị trước trong heuristic hiện tại; điểm không phải xác suất Like hay Match.

Một profile không đủ eligibility sẽ không được hiển thị, dù các thông tin khác có thể cho điểm rất cao.

## 2. Luồng tổng thể

Khi frontend yêu cầu recommendations, backend thực hiện lần lượt:

1. **Xác định viewer:** tải user, profile, preferences, ảnh và hoạt động gần đây của người đang dùng Discovery.
2. **Lọc ứng viên trong PostgreSQL:** tìm user khác viewer, còn active, đang cho phép hiển thị, phù hợp sơ bộ về tuổi, giới tính và vùng tọa độ; loại swipe và active match theo policy hiện tại.
3. **Kiểm tra eligibility chính xác:** tính tuổi từ ngày sinh, xác nhận preference của hai người theo cả hai chiều và tính khoảng cách thực tế bằng Haversine.
4. **Tính điểm:** chấm các feature mềm cho từng ứng viên hợp lệ.
5. **Xếp hạng:** điểm cao hơn đứng trước; nếu bằng điểm thì sắp theo `user_id` tăng dần.
6. **Lưu snapshot:** lưu thứ tự đầy đủ của phiên, score nội bộ và version của ranking vào PostgreSQL.
7. **Trả trang đầu:** gửi profile và thông tin pagination; không gửi score hoặc preferences riêng tư.
8. **Ghi impression:** sau khi frontend xác nhận card thực sự được nhìn thấy, backend lưu impression một lần cho candidate đó trong session.

```text
Request Discovery
  → Load viewer
  → Hard filters trong DB
  → Eligibility hai chiều và khoảng cách chính xác
  → Scoring
  → Ranking ổn định
  → Snapshot PostgreSQL
  → Response trang đầu
  → Client báo card đã hiển thị
```

## 3. Eligibility: ai được phép xuất hiện?

Eligibility là bộ lọc cứng. Không có điểm ranking nào có thể bù cho việc không đạt một điều kiện bắt buộc.

### Tài khoản và trạng thái hiển thị

- Không đề xuất chính viewer.
- User phải có status `active`; `suspended` và `deleted` không được đưa vào.
- Candidate phải có `show_me = true`. Nếu candidate chưa có preferences row, mặc định hiển thị là `true`.
- Viewer phải tồn tại, active và có profile. Viewer không có profile nhận lỗi thay vì danh sách.

### Tuổi và giới tính: kiểm tra hai chiều

Backend lấy tuổi từ `birth_date` tại thời điểm request, không dựa vào một trường tuổi đã cache.

Giả sử A đang xem B:

- Tuổi và giới tính của B phải nằm trong lựa chọn của A.
- Đồng thời tuổi và giới tính của A phải nằm trong lựa chọn của B.

Giới tính trong profile có `male`, `female`, `non_binary`, `other`; preference `interested_in` có `male`, `female`, `everyone`. `everyone` chấp nhận mọi giá trị giới tính profile.

Nếu không có preferences row, giá trị mặc định là tuổi 18–99 và `everyone`.

### Swipe và match

- Nếu viewer đã swipe candidate bằng `like`, `pass` hoặc `super_like`, candidate bị loại khỏi Discovery.
- Incoming swipe đơn phương không tự loại candidate.
- Active match bị loại khỏi Discovery thông thường.
- Unmatch không xóa swipe history. Vì vậy candidate mà viewer đã swipe vẫn bị loại theo quy tắc swipe.

### Khoảng cách

`max_distance_km` là hard constraint trong implementation hiện tại. Khoảng cách phải nằm trong giới hạn của cả viewer lẫn candidate. Khoảng cách giữa hai tọa độ là đối xứng nên cùng một số km được so với cả hai giới hạn.

Để không phải đưa mọi profile vào RAM, PostgreSQL trước tiên lọc tọa độ trong một bounding box gần viewer. Sau đó backend tính Haversine để kiểm tra chính xác khoảng cách.

Nếu tọa độ của viewer thiếu hoặc không hợp lệ, backend trả danh sách rỗng vì không thể chứng minh ứng viên nằm trong bán kính. Candidate thiếu tọa độ cũng không đủ điều kiện.

Preference mặc định khi row không tồn tại là `max_distance_km = 50`.

### Ngôn ngữ không phải điều kiện loại

`interested_languages` hiện là soft signal dùng khi tính điểm. Không có ngôn ngữ chung không khiến profile bị loại khỏi danh sách.

## 4. Scoring: tính mức độ phù hợp tương đối

Mỗi feature được đưa về thang điểm 0–100. Tổng điểm dùng các trọng số baseline sau:

| Feature | Trọng số | Cách hiểu |
|---|---:|---|
| Hobby/interests | 35% | Hai người có nhiều sở thích chung hơn thì điểm cao hơn |
| Distance compatibility | 25% | Gần nhau hơn thì điểm cao hơn, trong bán kính cho phép |
| Language compatibility | 15% | Ngôn ngữ người này muốn tìm có trong danh sách ngôn ngữ người kia sử dụng không |
| Recent activity | 15% | Candidate mới hoạt động gần đây thì được ưu tiên hơn |
| Profile completeness | 10% | Profile có đủ thông tin hữu ích cho Discovery thì điểm cao hơn |

Tổng trọng số là 100%. Đây là heuristic khởi đầu để dễ giải thích và điều chỉnh, chưa được chứng minh là tối ưu.

### 4.1 Hobby similarity

Hobbies được so bằng **ID ổn định** trong catalog, không so bằng tên hiển thị. ID trùng được tính một lần; ID không có trong catalog bị bỏ qua.

Điểm dùng Jaccard similarity:

```text
Số hobby chung / Tổng số hobby khác nhau × 100
```

Ví dụ: A có `reading`, `hiking`; B có `reading`, `music`. Hai người có 1 sở thích chung và tổng cộng 3 ID khác nhau, nên hobby score là khoảng 33.33.

Nếu cả hai có hobby hợp lệ nhưng không chung ID nào, điểm là 0. Nếu một bên không có hobby hợp lệ để so sánh, feature được xem là thiếu và dùng điểm trung tính 50.

### 4.2 Distance compatibility

Điểm giảm tuyến tính theo khoảng cách so với giới hạn nhỏ hơn của hai người:

```text
Điểm = clamp(100 × (1 - khoảng cách / bán kính), 0, 100)
```

Ví dụ, nếu bán kính áp dụng là 50 km và khoảng cách là 10 km thì điểm khoảng cách là 80. Nếu ở sát giới hạn thì điểm gần 0. Đây chỉ là điểm ưu tiên tương đối, không phải phần trăm khả năng Match.

### 4.3 Language compatibility

Backend kiểm tra hai hướng:

1. Ngôn ngữ viewer muốn tìm so với ngôn ngữ candidate khai báo.
2. Ngôn ngữ candidate muốn tìm so với ngôn ngữ viewer khai báo.

Mỗi hướng hợp lệ được tính theo tỷ lệ preference được đáp ứng. Backend lấy trung bình các hướng có đủ dữ liệu. Một hướng thiếu dữ liệu không làm mất điểm của hướng còn lại.

Nếu không có hướng nào đủ dữ liệu, language feature nhận điểm trung tính 50. Nếu preference và ngôn ngữ đều có dữ liệu nhưng không có ngôn ngữ nào phù hợp, hướng đó có điểm 0.

### 4.4 Recent activity

Điểm dùng `users.last_active_at` của candidate:

| Lần hoạt động gần nhất | Điểm |
|---|---:|
| Trong 24 giờ | 100 |
| Trên 24 giờ đến 72 giờ | 80 |
| Trên 72 giờ đến 7 ngày | 60 |
| Trên 7 ngày đến 30 ngày | 30 |
| Trên 30 ngày | 0 |

Nếu thời gian hoạt động bị thiếu hoặc không hợp lệ, feature nhận điểm trung tính 50. Activity chỉ ảnh hưởng thứ tự hiển thị; nó không nói lên hai người có hợp nhau hay không.

### 4.5 Profile completeness

Backend kiểm tra bốn mục, mỗi mục đóng góp 25 điểm:

1. Có bio.
2. Có job title.
3. Có city hoặc ward.
4. Có ít nhất một ảnh.

Điểm tối đa là 100. Những trường không liên quan đến Discovery không làm tăng điểm này.

## 5. Cách ghép điểm và thiếu dữ liệu

Điểm cuối là tổng điểm feature nhân với trọng số tương ứng. Ví dụ:

| Feature | Điểm ví dụ | Trọng số | Phần đóng góp |
|---|---:|---:|---:|
| Hobbies | 80 | 35% | 28 |
| Distance | 80 | 25% | 20 |
| Languages | 50 | 15% | 7.5 |
| Activity | 100 | 15% | 15 |
| Completeness | 75 | 10% | 7.5 |
| **Tổng** |  | **100%** | **78** |

Điểm cuối được làm tròn hai chữ số và chỉ dùng nội bộ. API không trả điểm, điểm từng feature hay danh sách feature thiếu.

Chính sách missing data thống nhất:

- Feature thiếu nhận điểm trung tính cố định 50.
- Không chia lại trọng số của feature thiếu cho các feature còn dữ liệu. Nhờ đó cùng cấu hình luôn có cùng thang điểm.
- “Có dữ liệu nhưng không có điểm chung” khác “thiếu dữ liệu”: trường hợp đầu có thể nhận 0, trường hợp sau nhận 50.
- Việc thiếu preference ngôn ngữ được phân biệt với việc đã có preference nhưng không tìm thấy ngôn ngữ phù hợp.
- Thiếu tọa độ là eligibility failure, không phải missing score.

`missingFeatures` được lưu cùng ranking snapshot để hỗ trợ debug, không gửi về frontend.

## 6. Ranking: tạo thứ tự ổn định

Sau khi scoring xong, backend sắp xếp:

1. `score` giảm dần.
2. Nếu bằng điểm, `user_id` tăng dần.

Như vậy cùng dữ liệu và cùng thời điểm tính toán cho ra thứ tự xác định. Điểm có thể khác khi dữ liệu profile/preferences hoặc thời gian hoạt động thay đổi; snapshot giữ nguyên thứ tự trong session đang dùng.

Ranking version hiện tại là `rule-v1`. Version được lưu trong session để biết snapshot được tạo bằng bộ quy tắc nào.

## 7. Snapshot và pagination

Phân trang chỉ bằng `user_id` không phù hợp khi thứ tự dựa vào score. Vì vậy request đầu tiên tạo snapshot trong PostgreSQL:

- **Session:** user sở hữu, ranking version, lúc tạo và lúc hết hạn.
- **Session items:** mỗi candidate, vị trí, score nội bộ và danh sách feature thiếu.
- **Cursor:** session ID cộng với vị trí tiếp theo.

Session sống 24 giờ. FE xem cursor như chuỗi opaque và chuyển nguyên vẹn sang request kế tiếp.

Khi tải trang sau, backend:

1. Kiểm tra session tồn tại, còn hạn và thuộc viewer.
2. Đọc candidate theo vị trí snapshot.
3. Chạy lại eligibility trên dữ liệu mới nhất.
4. Bỏ candidate vừa bị swipe, match, ẩn, chuyển trạng thái hoặc không còn phù hợp.
5. Tiến cursor qua cả candidate bị bỏ để request không bị kẹt hoặc trả lặp.
6. Trả các candidate còn hợp lệ theo thứ tự snapshot.

Snapshot giữ ổn định thứ tự, nhưng không buộc backend trả một profile đã trở nên không đủ điều kiện sau khi snapshot được tạo. Snapshot mới chỉ được tạo khi FE bắt đầu request đầu tiên mới, ví dụ thao tác refresh/reset Discovery.

## 8. Impression: phân biệt “đã tải” và “đã thấy”

Backend không ghi impression cho tất cả profile trong response. FE gửi impression riêng cho card đã thực sự được đưa lên màn hình.

Luồng phía app hiện tại:

1. Lấy profile hiện tại từ card stack.
2. Chờ sự kiện layout của card.
3. Xác nhận màn Discovery đang focus và app đang foreground.
4. Chờ card tiếp tục ở trạng thái đó 700 ms.
5. Gửi `sessionId` và `candidateUserIds` chứa `profile.user_id`.

Backend xác nhận session thuộc viewer, candidate thuộc session và session còn hạn. Vị trí được backend lấy từ snapshot. Cặp session/candidate có khóa duy nhất nên gửi trùng không tạo impression thứ hai.

Impression lưu user xem, candidate, vị trí và thời gian. Swipe, match và conversation vẫn lấy từ các bảng nghiệp vụ hiện có; chưa có analytics endpoint tính các tỷ lệ như like-through hoặc match rate.

## 9. FE nên làm gì?

1. Dùng user ID của tài khoản hiện đăng nhập để gọi API.
2. Gọi request đầu tiên khi mở hoặc refresh Discovery.
3. Render profile đúng theo thứ tự backend trả; không tự xếp lại theo score vì score không được trả về.
4. Lưu `sessionId`/`nextCursor` và gọi load-more gần cuối danh sách.
5. Dedupe danh sách theo `user_id` khi nối page.
6. Chỉ báo impression cho card hiện tại sau khi nó đã thực sự hiển thị; không báo toàn bộ batch đã fetch.
7. Khi cursor hết hạn hoặc trả lỗi, bỏ pagination state cũ và gọi request đầu tiên để nhận session mới.
8. Nếu response đầu tiên không có kết quả, hiển thị empty state. Khi profile/preferences được cập nhật, refresh bằng request đầu tiên.

Chi tiết URL, schema request/response, lỗi HTTP và ví dụ gọi API nằm trong [recommendations-api.md](./recommendations-api.md).

## 10. Các giới hạn đã biết

- Backend hiện chưa có block/report model hoặc API, nên recommendation chưa thể loại block hai chiều hay ghi nhận report.
- `user_status` hiện có `active`, `suspended`, `deleted`; chưa có enum `banned`. Mọi status khác `active` bị loại.
- Viewer thiếu tọa độ sẽ nhận danh sách rỗng theo chính sách fail-closed.
- Trọng số là baseline heuristic; chưa được tối ưu bằng thử nghiệm sản phẩm.
- Impression cho biết card đã ở trạng thái hiển thị trên client theo điều kiện hiện tại; nó không chứng minh người dùng tập trung nhìn pixel hoặc đọc nội dung.
- Hiện có dữ liệu cần thiết để nối impression với swipe/match/conversation, nhưng chưa có báo cáo phân tích hoặc A/B test để kết luận ranking làm tăng Match.

