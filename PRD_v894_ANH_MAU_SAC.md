# PRD v8.94 — Ảnh cho danh mục Màu sắc; hiện ở phiếu xuất kho vải và thẻ kho vải

**Ngày:** 2026-10-21 · **Yêu cầu của Nguyen:** *"danh mục màu sắc thêm trường tải ảnh lên. khi xuất kho cũng thể hiện thêm cột hình ảnh, thẻ kho vải cũng thêm cột hình ảnh"*

## 1. Giả định đã chọn (nói rõ, anh sửa nếu khác ý)

- **Ảnh gắn với MÀU** (`MauSac.AnhMau`), không gắn với mã vải hay từng cây. Một màu một ảnh; mọi cây cùng màu dùng chung. Nếu cần ảnh theo mã vải (cùng màu khác chất liệu) thì là việc khác.
- **"Thẻ kho vải"** = cả hai tab *Tồn kho vải* (theo mã) và *Tồn theo cây*. Thêm cột Ảnh ở cả hai.
- **"Khi xuất kho"** = form Tạo phiếu xuất (ô ảnh cạnh Mã cây, hiện ngay khi chọn cây), popup Xem phiếu, bản in. Form **Sửa** phiếu không thêm (không được yêu cầu).
- Ảnh dùng hạ tầng sẵn có: upload `/api/upload` → `/uploads/mau_<ts>.jpg` (nén 1600px), thu nhỏ qua `/anh/80/…`. Thư mục `/uploads` công khai — ảnh màu vải không nhạy cảm.
- Xuất Excel của hai tab tồn kho **không** chèn ảnh.

## 2. Thay đổi

| File | Gì |
|---|---|
| `database/migration_v881.sql` *(mới)* | `MauSac.AnhMau NVARCHAR(500) NULL` |
| `backend/utils/anhMau.js` *(mới)* | `ganAnhMauTheoVai(pool, rows)` — gắn ảnh vào dòng đọc từ view qua VaiID (view không lộ MauSacID; không sửa view) |
| `backend/utils/crudFactory.js` | cờ cột `khongGuiThiGiu` (PUT không có khóa thì giữ nguyên — không để form cũ xóa ảnh); **bỏ cache dò cột** |
| `backend/routes/danhmuc.js` | cột `AnhMau` tuyChon + khongGuiThiGiu |
| `backend/routes/khovai.js` | /dashboard, /rolls, /ncc/:id/cay, /phieunhap/:id/cay, /orders/:id/vaichophep gắn ảnh; GET /xuat/:id lines có `ms.AnhMau` (dò cột) |
| `frontend/js/common.js` | `anhMauThuNhoHtml(url, cạnh)` dùng chung |
| `frontend/js/module.danhmuc.js` | kiểu ô `image` (xem trước, Bỏ ảnh, upload lúc Lưu — upload hỏng thì không lưu) |
| `frontend/js/module.khovai.js` | cột Ảnh ở 5 chỗ; bản in 11 → 12 cột (soCotTruoc 7/9) |
| `backend/utils/kiem_in_phieu_xuat_tra_ncc.js` | cập nhật 12 cột, colspan 7/9, kiểm có/không `<img>` |
| `frontend/index.html` | common 8.94 · danhmuc 8.94 · khovai 8.94 |

Rà chéo bắt được 1 lỗ: đường nạp cây theo **đơn hàng** (dùng nhiều nhất) thiếu gắn ảnh ⇒ "xuất tự do có ảnh, chọn đơn thì mất". Đã sửa.

## 3. Deploy

> 🔴 `server\D:\QLSX` là máy chạy thật.

**Bước 1 — kiểm tại C:**
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\anhMau.js
node --check backend\utils\crudFactory.js
node --check backend\routes\danhmuc.js
node --check backend\routes\khovai.js
node --check frontend\js\common.js
node --check frontend\js\module.danhmuc.js
node --check frontend\js\module.khovai.js
node backend\utils\kiem_in_phieu_xuat_tra_ncc.js
```
Bộ kiểm phải `0 sai`.

**Bước 2 — migration** (SSMS → `migration_v881.sql`). Chạy **trước** khi restart.

**Bước 3 — copy 9 file sang `server\D:\QLSX\`**
```
backend\utils\anhMau.js                       ← MỚI
backend\utils\crudFactory.js
backend\routes\danhmuc.js
backend\routes\khovai.js
backend\utils\kiem_in_phieu_xuat_tra_ncc.js
frontend\js\common.js
frontend\js\module.danhmuc.js
frontend\js\module.khovai.js
frontend\index.html
```

**Bước 4 — máy chủ**
```powershell
pm2 restart qlnoibo
findstr /C:"ganAnhMauTheoVai" D:\QLSX\backend\utils\anhMau.js
findstr /C:"anhMauThuNhoHtml" D:\QLSX\frontend\js\common.js
findstr /C:"wireOAnh" D:\QLSX\frontend\js\module.danhmuc.js
findstr /C:"x-anh" D:\QLSX\frontend\js\module.khovai.js
```
Bốn dòng đều phải ra kết quả. Ctrl+F5 máy khách.

**Bước 5 — thử**
1. Danh mục → Màu sắc → Sửa một màu → chọn ảnh → thấy xem trước → Lưu → bảng hiện ảnh nhỏ. Bấm ảnh mở ảnh gốc.
2. Sửa lại màu đó, chỉ đổi tên, không đụng ảnh → Lưu → **ảnh vẫn còn**.
3. Bỏ ảnh → Lưu → ô trống.
4. Kho vải → Tồn kho vải và Tồn theo cây: cột Ảnh có ảnh ở các dòng màu đó.
5. Tạo phiếu xuất → chọn đơn hàng → chọn cây màu đó → ô Ảnh hiện ngay. Bỏ chọn đơn (xuất tự do) → vẫn hiện.
6. Xem một phiếu xuất cũ có màu đó → cột Ảnh; In → ảnh 32px cạnh Mầu, dòng TỔNG không lệch cột.

**Bước 6** — `node database\tao_file_cai_dat.js` (phải thấy `[114/114] migration_v881.sql`) → `git add -A; git commit -m "v8.94 anh mau sac (migration_v881)"; git push`.
