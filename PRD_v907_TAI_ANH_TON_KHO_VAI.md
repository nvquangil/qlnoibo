# PRD v9.07 — Thẻ kho vải / Tồn theo cây: nút 📥 Tải ảnh theo lọc đang hiện

**Ngày:** 2026-10-27 · **Nguyen:** *"tồn kho vải thêm nút tải ảnh về theo lọc hiện trên màn hình"* — *"giống như nút tải ảnh màu còn tồn của thẻ kho hàng hóa"* — chốt lại giữa chừng: **đặt ở tab Tồn theo cây** (bản đầu tôi đặt nhầm sang tab Tồn kho, đã gỡ).

## 1. Thiết kế

Trải nghiệm **y hệt** nút của Thẻ kho hàng hóa (chuỗi v8.16→v8.23, đã chạy ổn trên iOS thật): máy tính tải **1 file `.zip`**, điện thoại qua **hộp thoại chia sẻ gốc** (Web Share → lưu về Ảnh/Photos), cùng ngưỡng hỏi lại khi quá 150 ảnh. Nút nằm trong toolbar tab **Kho vải → Tồn theo cây**, cạnh "📷 Quét QR tìm cây" / "⬇️ Xuất Excel".

**Khác biệt kỹ thuật duy nhất** (và là lý do không copy nguyên route cũ): bộ lọc của màn này là **ô tìm `#fSearch` chạy ở trình duyệt** — nó **vẽ lại tbody** từ mảng đã lọc (khác cả cách ẩn/hiện dòng), server không tái hiện được chuỗi tìm. Nên:
- danh sách ảnh đọc từ biến **`dangHien`** — chính mảng cây đang hiển thị, được handler `#fSearch` gán lại mỗi lần lọc (quét QR tìm cây cũng đổ vào `#fSearch` nên cũng được tôn trọng);
- bản `.zip` gửi danh sách lên bằng **POST** `/api/khovai/rolls/anh.zip` (danh sách dài, không nhét vào query).

Ảnh là cột **Ảnh** của chính bảng — ảnh **từng cây** (`AnhCay`, cây chưa có ảnh riêng thì lùi về ảnh màu — v8.96). Tên file trong zip: **`MaCay.ext`**. Hai cây lùi về cùng một ảnh màu thì vẫn **mỗi cây một file** mang tên mã cây đó.

## 2. Sửa

| File | Gì |
|---|---|
| `backend/routes/khovai.js` | Route mới `POST /rolls/anh.zip`. Gate `KHOVAI/view`; **tự kiểm `canView` của chức năng `rolls`** thay vì `requireChucNang` — middleware đó suy action từ HTTP method, POST bị tính là *edit* ⇒ người chỉ-có-quyền-XEM sẽ 403 oan trong khi đây là thao tác đọc thuần túy. An toàn: chỉ nhận link `/uploads/`, whitelist ký tự tên file + `statSync().isFile()`, ≤ 800 mục, **kiểm + gom trước rồi mới pipe zip** (danh sách rỗng trả JSON 400 tử tế), `require('archiver')` trong handler. |
| `frontend/js/module.khovai.js` | 5 hàm `kv*` (4 hàm là **bản sao có chủ đích** từ `module.khohang.js` — hai IIFE không gọi chéo được, và không refactor luồng đã xác nhận chạy tốt trên máy thật; sửa công thức bên nào phải sửa bên kia) + `kvTaiZipVeMay` (fetch POST → blob → `<a download>`); nút `#kvTaiAnhCay` ở **renderRolls**; biến `dangHien` cập nhật trong handler `#fSearch`; handler try/catch/finally (bài v9.06). Tab Tồn kho (renderDashboard) **không còn nút nào** — bản đặt nhầm đã gỡ sạch. |
| `frontend/index.html` | `module.khovai.js?v=9.07` |
| `backend/utils/kiem_tai_anh_ton_vai.js` *(mới, không copy sang D:\)* | Mở đầu bằng **`vm.Script` parse cả 2 file** (thay `node --check`); kiểm gate/thứ tự pipe/giới hạn; kiểm nút nằm ĐÚNG renderRolls và renderDashboard sạch dấu vết; `dangHien` phải được `#fSearch` gán lại; và mục 4: **các bất biến công thức Web Share phải có mặt ở CẢ khovai lẫn khohang** — sửa một bên quên bên kia là đỏ. |

**Không migration. `archiver` đã có sẵn trên server từ v8.17** — không cần `npm install` lần này.

## 2b. Rà chéo bắt được gì (đã sửa trong bản này)

| Mức | Lỗi bản viết đầu | Sửa |
|---|---|---|
| 🟠 | `path.basename('/uploads/..')` trả `'..'` ⇒ `path.join` ra **thư mục backend**, `existsSync` vẫn true, archiver nhận một thư mục là **nổ giữa stream** sau khi đã gửi header zip | Whitelist ký tự tên file + bắt buộc `statSync().isFile()` |
| 🟠 | Khử trùng theo **link trần**: nhiều mã vải dùng chung một ảnh màu thì zip chỉ còn mã đầu tiên, các mã sau biến mất không dấu vết — lệch kỳ vọng "giống nút thẻ kho hàng hóa" | Khử theo `tên + link` (chỉ gộp dòng lặp thật sự) |
| 🟡 | Desktop fetch-blob: **không hiện gì ở thanh tải** cho tới byte cuối, toast cũ nói "chờ trình duyệt tải xuống" ⇒ nhiều ảnh trông như nút treo; và không có toast báo xong | Toast nói đúng ("đang nén trên máy chủ, 1–2 phút, chưa thấy gì là bình thường") + toast "Đã tải xong" |
| 🟡 | Client không có trần ⇒ >800 ảnh bấm xong mới ăn 400 từ server | Trần cứng 800 ngay tại client, cùng câu chữ |
| 🟡 | 3 phép của bộ tự kiểm báo OK oan / kiểm thiếu | Đã vá (iR>=0, neo try ngoài, 1 thẻ script) |

Rà chéo cũng xác nhận: **4 hàm Web Share khớp từng dòng với bản gốc khohang** (chỉ khác title — có chủ đích); route không bị route nào nuốt; `tr data-i` không phá STT/ô tìm/`laDongThongBao`; express.json 5mb đủ cho 800 mục.

## 3. Deploy

Vào hàng đợi gộp (giờ là **v9.02 → v9.07**; `module.khovai.js` + `index.html` vốn đã trong danh sách copy của v9.05).

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\khovai.js
node --check frontend\js\module.khovai.js
node backend\utils\kiem_tai_anh_ton_vai.js
```

Copy thêm so với danh sách cũ: `backend\routes\khovai.js` (backend đổi ⇒ `pm2 restart qlnoibo`).

**Thử:**
0. **Trước hết nhìn cột Ảnh của tab Tồn theo cây CÓ ảnh không** — cột này cần `migration_v881`/`v883` (trong 3 migration đợt v8.94–v9.01 chưa xác nhận riêng). Cột trống toàn bộ thì nút sẽ luôn báo "không có ảnh nào" và việc cần sửa là chạy migration, không phải nút.
1. Kho vải → **Tồn theo cây**, **không gõ gì** vào ô tìm → bấm 📥 → desktop tải `anh_ton_theo_cay.zip`, giải nén thấy mỗi cây có ảnh một file tên theo **mã cây** (cây cột Ảnh trống không có trong zip). Hai cây lùi về cùng ảnh màu → **cả hai file** đều có.
2. Gõ mã vải vào ô tìm cho còn vài cây → bấm 📥 → zip chỉ còn đúng ảnh các cây đang hiện. Quét QR tìm 1 cây → bấm 📥 → zip đúng 1 ảnh.
3. Điện thoại: bấm 📥 → hộp thoại chia sẻ hiện ra, lưu về Ảnh — y như nút bên thẻ kho hàng hóa.
4. Lọc tới khi các cây hiện đều không có ảnh → bấm 📥 → báo rõ "không có ảnh nào để tải", nút không kẹt.
5. Tài khoản chỉ có quyền **Xem** Kho vải (không có Sửa) → bấm 📥 vẫn tải được (đây là thao tác xem).
6. Tab **Tồn kho** (tổng hợp theo mã vải): xác nhận **không** có nút tải ảnh nào — bản đặt nhầm đã gỡ.

**Commit:** `"v9.07 ton kho vai: nut tai anh theo loc dang hien (zip desktop / web share mobile)"`

## 4. Nói trước

- Cây không có ảnh bị bỏ qua lặng lẽ (đúng quyết định cũ của anh ở v8.16: "bỏ qua, không báo") — nút đếm từ danh sách đang hiện nên toast "Đang nén N ảnh" nói đúng số sẽ nhận.
- Nhiều cây cùng mã vải thường **lùi về chung một ảnh màu** (cây chưa chụp ảnh riêng) ⇒ zip sẽ có nhiều file **nội dung giống nhau, tên khác nhau** (mỗi mã cây một file). Đó là chủ đích — "ảnh theo cây"; muốn mỗi ảnh chỉ một file thì nói, đổi một dòng khử trùng.
- Màn **Báo cáo → Tồn kho vải** và tab **Tồn kho** (tổng hợp theo mã) không có nút này; cần thì nói — route backend nhận danh sách tùy ý, gắn thêm rất nhanh.
