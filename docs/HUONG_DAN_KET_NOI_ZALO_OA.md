# Hướng dẫn kết nối QLNoiBo với Zalo OA

**Ngày:** 2026-11-06 · Dành cho Nguyen làm trên `oa.zalo.me` + `developers.zalo.me`.

> ⚠️ **Mức độ chắc chắn.** Tôi **không tải được tài liệu Zalo bằng máy** trong phiên này (trang dựng
> bằng JS, trả về rỗng). Phần **kiến trúc** dưới đây chắc chắn đúng vì nó là cách mọi nền tảng
> OAuth + webhook hoạt động. Phần **tên nút, tên mục trên màn hình** có thể Zalo đã đổi — anh đối
> chiếu khi làm, chỗ nào lệch thì chụp màn hình gửi lại, tôi sửa hướng dẫn.

---

## Phần A — Nguyen làm (khoảng 15–20 phút)

### A1. Tạo ứng dụng và gắn với OA

1. Vào **developers.zalo.me** → đăng nhập bằng chính tài khoản Zalo **đang quản trị OA**.
2. Tạo một **ứng dụng** mới (tên gì cũng được, ví dụ `QLNoiBo Bot`).
3. Trong ứng dụng đó, bật/thêm sản phẩm **Official Account API**, rồi **liên kết với OA** đã xác
   thực của mình.
4. Ghi lại hai thứ ở mục thông tin ứng dụng:
   - **App ID** (dãy số)
   - **App Secret Key** (chuỗi dài) — ⚠️ đây là **mật khẩu**, đừng gửi qua Zalo chat công khai.

### A2a. 🔴 XÁC THỰC QUYỀN SỞ HỮU TÊN MIỀN (bắt buộc, làm TRƯỚC khi khai webhook)

Zalo không cho khai Webhook URL nếu tên miền chưa xác thực. Báo lỗi:
*"The webhook link has not been verified for domain."*

Vào `https://developers.zalo.me/app/<APP_ID>/verify-domain` → nhập `thoitrangmoyn.id.vn` → Zalo cho
chọn **3 cách**: DNS TXT / tải file HTML lên / thẻ meta ở trang chủ.

🔴 **Chọn DNS TXT.** Hai cách kia đòi phục vụ một đường dẫn ở GỐC tên miền, mà gốc tên miền đi qua
Cloudflare Tunnel vào **cổng 80** — nơi `duocPhepCongKhai` chỉ cho `/api/public/*` và
`/api/zalo/webhook` lọt. Chọn file/meta là phải mở thêm đường trên cổng công khai, không đáng.

Trên Cloudflare → DNS → Add record: Type `TXT`, Name `@`, Content = **nguyên chuỗi** Zalo đưa (kể cả
phần `zalo-platform-site-verification=` ở đầu), TTL Auto. Kiểm:

```powershell
nslookup -type=TXT thoitrangmoyn.id.vn 1.1.1.1
```

Rồi bấm **Xác thực** ở Zalo. **Giữ nguyên bản ghi TXT về sau** — Zalo kiểm lại định kỳ, xóa đi là
webhook rụng.

### A2b. Khai webhook

Trong phần **Webhook** của ứng dụng:

- **URL**: `https://thoitrangmoyn.id.vn/api/zalo/webhook`
- **Sự kiện cần bật** (tên có thể hơi khác):
  - `user_send_text` — khách nhắn chữ
  - `user_send_image` — khách gửi ảnh
  - `follow` / `unfollow` — khách quan tâm/bỏ quan tâm OA *(tuỳ chọn, để biết ai đang theo)*
- Zalo sẽ **gọi thử** URL này. **Chưa deploy route webhook thì sẽ báo lỗi — bình thường**, lưu lại
  rồi khai lại sau khi tôi viết xong.

### A3. Cấp quyền cho ứng dụng truy cập OA

Bước này sinh ra **access token** để hệ thống gửi tin trả lời. Trong trang ứng dụng thường có nút
**"Cấp quyền cho ứng dụng" / "Authorize"** → chọn OA → Zalo trả về một **mã code** (hiện trên URL
hoặc trên màn hình).

🔴 **Mã code này sống rất ngắn (vài phút)** — lấy xong phải đổi ngay sang token. Vậy nên:
**làm bước A3 CUỐI CÙNG**, sau khi đã gửi App ID + Secret cho tôi và tôi đã dựng xong chỗ nhận.

### A4. Gửi lại cho tôi

| Thứ | Ví dụ | Gửi thế nào |
|---|---|---|
| **App ID** | `1234567890123456789` | nhắn bình thường |
| **App Secret Key** | `AbCd...` | 🔴 **đặt thẳng vào file `.env` trên máy chủ**, đừng gửi qua chat |
| Ảnh chụp màn hình phần Webhook | | nếu tên mục khác hướng dẫn này |

**Cách đặt vào `.env`** (file `backend\.env` trên máy chủ — cùng chỗ đang khai `DB_SERVER`):

```
ZALO_OA_APP_ID=...
ZALO_OA_APP_SECRET=...
```

Rồi `pm2 restart qlnoibo`. Tôi **không bao giờ cần nhìn thấy Secret** — code chỉ đọc từ `.env`.

---

### A5. Lấy token lần đầu (ngay sau khi bấm Cấp quyền ở A3)

```powershell
cd D:\QLSX\backend
node utils\zaloOaToken.js --code <dán mã code vừa lấy>
```

Xem lại bất cứ lúc nào: `node utils\zaloOaToken.js` (in trạng thái, **không** in token).

🔴 **Dừng pm2 trước khi chạy `--lammoi` bằng tay.** Hai tiến trình cùng làm mới = refresh token xoay
hai lần, một cái chết ⇒ mất kết nối, phải cấp quyền lại từ đầu.

---

## Phần B — Đã viết xong (v9.30/v9.31), chờ khóa để chạy thật

| Việc | Trạng thái |
|---|---|
| `POST /api/zalo/webhook` — xác thực chữ ký, trả 200 ngay, chống tin lặp | ✅ `backend/routes/zalo.js` |
| Kho token: lưu, tự làm mới, chống hỏng — xem ⚠️ dưới | ✅ `backend/utils/zaloOaToken.js` |
| Gửi tin + tải ảnh khách gửi (chặn SSRF, giới hạn cỡ, hết giờ) | ✅ `backend/utils/zaloOaApi.js` |
| Nối vào phần đã có: chữ → v9.25; ảnh → mã vạch rồi dHash (v9.28/9.29) | ✅ |
| Phanh theo người gửi + trần đồng thời cho nhánh ảnh | ✅ 10 tin/phút/người, 2 ảnh cùng lúc |
| Cron tự làm mới token 4:17 sáng | ✅ |
| Nhật ký hỏi–đáp trong log pm2 (`[zalo] …`) | ✅ đọc lại sau 2 tuần |

🔴 **Mở cổng công khai cho đúng một đường dẫn.** Webhook đi qua Cloudflare Tunnel vào **cổng 80**,
mà cổng đó trước nay chỉ cho `/api/public/*` — đã thêm riêng `/api/zalo/webhook` vào danh sách
trắng (`server.js`). `/api/zalo/trangthai` **không** mở, và còn đòi đăng nhập.

✅ **Đã xác nhận (Nguyen, 2026-11-06): Tunnel trỏ `thoitrangmoyn.id.vn` → cổng 80.** Đúng thiết kế:
webhook tới được, mọi `/api/*` nội bộ khác vẫn bị cổng 80 chặn.

✅ **Đã kiểm thêm hai thứ có thể âm thầm giết webhook, cả hai đều sạch:**

- `server.js:75` chỉ tự chuyển `http → https` cho **GET/HEAD**. Chuyển hướng một POST là **mất
  nguyên thân yêu cầu** ⇒ chữ ký không bao giờ khớp. Ở đây POST đi thẳng, không bị đụng.
- `server.js:81` bỏ qua hẳn mọi request có `cf-ray` (đi qua Cloudflare) — tránh vòng lặp chuyển
  hướng vô hạn của chế độ SSL Flexible.

### ⚠️ Chỗ dễ mất kết nối nhất: refresh token xoay vòng

Theo cách Zalo OA làm (và đây là chỗ tôi **phải kiểm chứng lại bằng tài liệu thật** trước khi viết):

- **access token** sống **ngắn** (cỡ 1 giờ) — hết hạn thì bot im lặng không trả lời được nữa.
- **refresh token** sống dài (cỡ 3 tháng), nhưng **mỗi lần dùng để làm mới, Zalo trả về một refresh
  token MỚI và cái cũ chết**.

⇒ Hệ quả: nếu chương trình **không ghi đè kịp** refresh token mới (restart đúng lúc, ghi file lỗi,
chạy hai tiến trình cùng lúc), thì **mất kết nối vĩnh viễn** và phải làm lại bước A3 bằng tay.

Nên khi viết, tôi sẽ: ghi token xuống file **ngoài thư mục `uploads/`** (thư mục đó phục vụ công
khai ra internet — để token vào đó là lộ), ghi **trước** khi dùng, và có lệnh kiểm tra trạng thái
token để anh xem bất cứ lúc nào.

---

### B1. 🔴 Phép thử rẻ nhất, làm NGAY sau khi deploy — trước cả khi có khóa

Mở trên **điện thoại dùng 4G** (không dùng wifi công ty, để chắc là đi từ internet vào):

```
https://thoitrangmoyn.id.vn/api/zalo/webhook
```

| Thấy gì | Nghĩa là |
|---|---|
| `{"success":true}` | ✅ Đường thông. Zalo gọi được. |
| Trang đăng nhập / chặn của Cloudflare | 🔴 **Cloudflare Access đang bật cho cả tên miền chính** — Zalo bị chặn ở biên, không bao giờ tới máy chủ. Phải sửa policy cho Access chỉ áp `pm.` |
| `403` kèm câu "chỉ phục vụ trang catalogue" | 🔴 Chưa copy `server.js` mới sang `D:\QLSX` |
| Không vào được gì | Tunnel/pm2 chưa chạy |

Thử tiếp cho chắc là cửa **đã khóa**:

```
https://thoitrangmoyn.id.vn/api/zalo/trangthai
```
→ **phải bị chặn 403**. Nếu nó trả dữ liệu thì danh sách trắng ở `server.js` sai, dừng lại báo tôi.

### B2. 🔴 Lần khai webhook ĐẦU TIÊN: bật log chữ ký, xong thì GỠ

Công thức ký (`sha256(appId + thân thô + timestamp + secret)`, header `X-ZEvent-Signature: mac=…`)
**tôi chưa đối chiếu được bằng tài liệu Zalo**. Rất có thể đúng, nhưng phải xác nhận bằng lần gọi
thật. Trước khi bấm "Lưu" ở màn Webhook của Zalo:

1. Thêm vào `D:\QLSX\backend\.env`: `ZALO_OA_LOG_CHU_KY=1` → `pm2 restart qlnoibo`.
2. Bấm Lưu / Gửi thử ở màn Webhook của Zalo.
3. `pm2 logs qlnoibo --lines 50` → tìm dòng `[zalo] dò chữ ký — nhận=… tính=…`.
   - **Hai chuỗi giống nhau** → công thức đúng, mọi thứ chạy.
   - **Khác nhau** → gửi tôi nguyên dòng log đó (nó chỉ in 16 ký tự đầu, không lộ bí mật), tôi sửa
     công thức.
   - **Không có dòng nào** → Zalo chưa gọi tới được; xem lại URL đã khai.
4. 🔴 **Gỡ `ZALO_OA_LOG_CHU_KY` khỏi `.env` + restart** sau khi xong.

Cờ này **không hề nới lỏng bảo mật** — chữ ký sai vẫn bị **vứt, không xử lý**; nó chỉ in ra để đối chiếu.

### 🔴 v9.34 — chữ ký sai trả 200 + VỨT, không còn trả 401

Bản v9.30 trả **401** khi chữ ký sai. Zalo báo thẳng khi khai webhook:

> *"Hệ thống vừa thực hiện kết nối và gửi một http post request đến Webhook url … và nhận về http
> code 401. Webhook của bạn chỉ được thiết lập khi trả về http code 200 OK."*

Zalo dùng mã HTTP để **ĐĂNG KÝ** webhook, không phải để biết ta có xử lý hay không — và lần gọi thử
lúc khai báo rất có thể không mang chữ ký nào. Trả 401 = không bao giờ khai được, kể cả khi công thức
ký đã đúng. Tức là **cờ dò chữ ký của bản v9.30 cũng vô dụng**: nó ghi log rồi vẫn 401.

Nay: **luôn trả 200**, chữ ký không hợp lệ thì `return` ngay — không tải ảnh (cửa SSRF), không gọi
API Zalo (gửi tin mạo danh shop), không tra kho. Thân trả về **giống hệt nhau** ở cả hai trường hợp
để không thành máy dò công thức.

🔴 Đây **không phải** cờ "bỏ qua chữ ký" của bản đầu (rà chéo đã bác): cái đó CHO VÀO XỬ LÝ, cái này
vẫn VỨT. **Đừng "siết lại cho chặt" bằng cách trả 401** — là tự khóa chính mình lần nữa.

⚠️ Cái giá phải trả: công thức ký sai thì webhook khai **thành công** nhưng **im lặng không trả lời
khách** — nhìn ngoài tưởng chạy. Nên log gào lên: `[zalo] 🔴 CHƯA CÓ TIN NÀO QUA ĐƯỢC CHỮ KÝ (N lần
vứt)`. Thấy dòng đó là đi dò công thức theo 4 bước trên.

## Phần C — Thứ tự đúng

1. ✅ **Đã xong:** tra theo mã (`/api/public/tracuu`) — đang chạy thật.
2. ⏳ **Deploy** đợt đang chờ (có v9.28 tra theo ảnh) + chạy `node utils\anhHashSanPham.js --dung`.
3. ⏳ **Thử tra ảnh bằng curl** → biết tỉ lệ đọc mã vạch thật là bao nhiêu.
4. ⏳ Nguyen làm **A1 + A2 + A4** (chưa làm A3).
5. ⏳ Tôi viết webhook + kho token.
6. ⏳ Nguyen làm **A3** (cấp quyền), tôi nhận code đổi lấy token.
7. ⏳ Thử với 5–10 khách sỉ trong 2 tuần, đọc nhật ký rồi mới mở rộng.

Bước 3 nên làm trước bước 5: nếu mã vạch chụp qua Zalo đọc được tỉ lệ thấp, cách soạn câu trả lời
của bot sẽ khác hẳn (phải hỏi mã sớm thay vì cố nhận ảnh).
