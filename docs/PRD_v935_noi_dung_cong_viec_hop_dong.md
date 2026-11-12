# PRD v9.35 — Nội dung công việc nhập tay, in vào mục 1.5 của hợp đồng

**Ngày:** 2026-11-09 · **Người yêu cầu:** Nguyen · **Trạng thái:** đã viết, CHƯA deploy

---

## 1. Yêu cầu (nguyên văn)

> "quản lý nhân sự. ký hợp đồng thêm trường nội dung công việc để nhập tay và gán vào mục 1.5 của
> mẫu hợp đồng. vì mỗi người 1 nội dung cụ thể khác nhau"

## 2. Hiện trạng

Mục 1.5 là **text cứng** trong `MAU_GOC`, giống hệt nhau ở mọi hợp đồng:

- HĐLĐ chính thức: *"1.5. Nội dung công việc: thực hiện công việc theo chức danh nêu trên, Bản mô tả
  công việc (nếu có), tiêu chuẩn kỹ thuật/quy trình liên quan và các phân công hợp pháp, hợp lý…"*
- HĐ thử việc: câu **ngắn hơn**, chữ khác.

⇒ Việc cần làm không phải thêm mục mới mà **thay text cứng bằng placeholder nhập tay**.

## 3. Nghiệm thu

| # | Thử | Đúng là |
|---|---|---|
| N1 | Ký hợp đồng mới → có ô **"Nội dung công việc — in vào mục 1.5"** (textarea 4 dòng) | mắt |
| N2 | Gõ nội dung → Lưu → **In** | mục 1.5 in đúng nội dung vừa gõ, xuống dòng đúng |
| N3 | **Để trống** → In | mục 1.5 in **nguyên văn điều khoản cũ**, không phải chỗ trống |
| N4 | Để trống ở **HĐ thử việc** → In | in đúng câu **của mẫu thử việc** (ngắn hơn), không phải câu chính thức |
| N5 | Sửa hợp đồng đã lưu | ô nhập đổ sẵn nội dung cũ, không trắng bảng |
| N6 | Màn **Xem** hợp đồng | có dòng "Nội dung công việc (mục 1.5)", xuống dòng đúng |
| N7 | Gõ `<b>x</b>` vào ô | bản in hiện đúng chữ `<b>x</b>`, KHÔNG in đậm (đã escape) |
| N8 | `node backend\utils\kiem_noi_dung_cong_viec.js` | xanh |
| N9 | `node backend\utils\kiem_ho_so_nhan_su.js` | không đỏ thêm |

## 4. Đã làm

| File | Việc |
|---|---|
| `database/migration_v887.sql` | **MỚI** — `HopDongLaoDong.NoiDungCongViec NVARCHAR(MAX) NULL` |
| `database/CAI_DAT_DAY_DU.sql` | gộp thành khối `[120/120]` |
| `backend/routes/hrm.js` | cờ dò cột **RIÊNG** + bind + ghép vào POST/PUT `/hopdong` |
| `frontend/js/module.hrm.js` | ô `#f_ndcv`, payload, `NDCV_MAC_DINH`, `bienChoHopDong(h, nv, maMau)`, 2 chỗ MAU_GOC, dòng ở màn Xem, cảnh báo mẫu thiếu chỗ cắm, `white-space:pre-wrap` |
| `backend/utils/kiem_ho_so_nhan_su.js` | thêm `'NoiDungCongViec'` vào `BIEN_RIENG` |
| `backend/utils/kiem_noi_dung_cong_viec.js` | **MỚI** — bộ tự kiểm (không copy sang D:\) |
| `frontend/index.html` | bump `module.hrm.js?v=9.05` → **9.35** |

### Ba quyết định thiết kế

**a) Cột đặt ở `HopDongLaoDong`, KHÔNG ở `NhanVien`.** Nội dung công việc thuộc về **một bản hợp đồng
cụ thể**: cùng một người ký HĐ thử việc → HĐ chính thức → tái ký sẽ có nội dung khác nhau, và bản in
phải giữ đúng nội dung của **bản đang in**, không phải trạng thái hiện tại của nhân viên.

**b) Cờ dò cột RIÊNG, không gộp vào `COT_HD_V882`.** Máy đã chạy `migration_v877` nhưng chưa chạy
`v887` phải thêm/sửa hợp đồng bình thường. Gộp chung ⇒ `coV882 = true` kéo `NoiDungCongViec` vào câu
SQL ⇒ "Invalid column name" ⇒ **vỡ cả thêm lẫn sửa hợp đồng**. Và **không cache** kết quả dò: cache
sống qua migration thì sau khi chạy migration vẫn phải restart mới lưu được, mà người dùng thì thấy
ô nhập hiện ra bình thường rồi gõ vào — gõ xong mất trắng.

**c) Để trống thì lùi về ĐÚNG câu gốc của từng mẫu.** 1.5 là một điều khoản pháp lý hoàn chỉnh; in ra
chỗ trống là làm hợp đồng **thiếu điều khoản**. Hai mẫu có câu khác nhau nên `NDCV_MAC_DINH` có hai
mục, chọn theo `maMau` truyền từ `printHopDong`.

## 5. Lệnh chạy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.hrm.js
node --check backend\routes\hrm.js
node backend\utils\kiem_noi_dung_cong_viec.js
node backend\utils\kiem_ho_so_nhan_su.js
```

🔴 **Trước khi deploy, chạy câu này** (xem §6 mục 2):

```sql
SELECT MaMau, PhienBan, CapNhatLuc FROM MauVanBanHRM
WHERE MaMau IN ('HDLD_CHINHTHUC','HDLD_THUVIEC');
```

Thứ tự deploy: `migration_v887.sql` → `pm2 restart qlnoibo` → copy 4 file C → D.

Copy sang `D:\QLSX`: `backend\routes\hrm.js`, `frontend\js\module.hrm.js`, `frontend\index.html`.
(`database\migration_v887.sql` chỉ cần chạy, không cần copy.)

## 6. Rà soát chéo độc lập — kết quả

| # | Mức | Nội dung | Xử lý |
|---|---|---|---|
| 1 | 🔴 ĐỎ | Bộ tự kiểm đếm `{{NoiDungCongViec}}` trên bản **thô** → chính câu ghi chú của v9.35 cũng khớp → đếm ra 3 thay vì 2 → **đỏ oan, exit 1**. Lần thứ **TƯ** vấp bẫy "quên lọc comment" | **đã sửa** — đếm trên `feMa` |
| 2 | 🔴 ĐỎ | `layMau()` ưu tiên bản người dùng đã sửa trong CSDL hơn `MAU_GOC`. Ai đã sửa mẫu HĐLĐ **trước** v9.35 thì bản của họ còn câu 1.5 cứng ⇒ nhân sự gõ nội dung, lưu được, màn Xem hiện đúng, **bản in ra vẫn câu cũ**. Hỏng im lặng trên văn bản pháp lý đem đi ký | **đã vá** — `inVanBan` nhận thêm `canCoBien`, thiếu chỗ cắm thì **toast báo rõ** (vẫn cho in, vì câu cũ là điều khoản hoàn chỉnh — chặn in thì không ký được hợp đồng nào) |
| 3 | 🟡 | Màn Xem dồn đoạn văn 4 dòng thành 1 dòng, trong khi bản in xuống dòng đúng | **đã sửa** — `white-space:pre-wrap` |
| 4 | 🟡 | Phép "KHÔNG cache" bắt theo **tên biến** → ai cache bằng tên khác là lọt | **đã sửa** — kiểm cấu trúc thân hàm |
| 5 | 🟡 | `hrm.js:603-610` có **byte điều khiển vô hình** trong khối comment chết `__CU_giaiMaDeKiem` (từ v8.85, không phải lỗi v9.35) ⇒ `findstr`/`grep` trả 0 kết quả trên file này | **KHÔNG sửa** — xem §7 |
| 6 | 🟢 | Cú pháp: 12 khối `${/* */''}` trong `module.hrm.js`, không khối nào có backtick trong comment nằm trong template literal | — |
| 7 | 🟢 | `bienChoHopDong` đổi chữ ký — 4 nơi gọi, `BIEN_THEO_MAU` gọi 2 tham số vẫn đúng (fallback về mẫu chính thức, chỉ lấy `Object.keys`) | — |
| 8 | 🟢 | Thứ tự `escapeHtml` **trước** rồi chèn `<br>` là đúng; đảo lại thì in ra chữ `&lt;br&gt;` lổn nhổn | — |
| 9 | 🟢 | `INSERT/UPDATE HopDongLaoDong` chỉ có đúng 2 chỗ trong repo, cả hai đã ghép. Không có route "ký nhanh"/"gia hạn"/"tái ký" bị sót | — |
| 10 | 🟢 | `GET /hopdong` dùng `SELECT hd.*` ⇒ có cột mới; form sửa đổ đúng giá trị | — |
| 11 | 🟢 | `kiem_ho_so_nhan_su.js` không đỏ oan (comment mới nằm ngoài lát cắt `khoiMauGoc`) | — |
| 12 | 🟢 | Quyền: ô mới nằm trong chính form đã có `requirePermission` + `requireChucNang`, không dính bẫy v9.27 | — |

## 7. Còn nợ / cảnh báo

- **`findstr` NÓI DỐI trên `backend\routes\hrm.js`.** Byte điều khiển ở khối comment chết dòng
  603-610 làm `findstr /C:"..."` trả về rỗng dù mã có thật. Nghi thức kiểm deploy thường dùng
  `findstr` tên hàm trên D:\ — **trên riêng file này phải đối chiếu bằng kích thước + ngày sửa**, kẻo
  tưởng chưa copy rồi đi nghi cache oan. Cùng họ với `module.tailieukythuat.js`. Sửa được bằng cách
  xóa khối comment chết, nhưng phải ghi đè cả file nên để thành việc riêng.
- **Người đã sửa mẫu HĐLĐ** cần vào tab *Mẫu văn bản*, chèn `{{NoiDungCongViec}}` vào mục 1.5, hoặc
  bấm *Mẫu gốc* (mất phần câu chữ họ đã sửa — hỏi trước khi bấm). Từ v9.35 bản in sẽ **báo rõ** khi
  rơi vào tình huống này.
- `HUONG_DAN_CAI_DAT.md` chưa ghi "cần chạy `migration_v887.sql`" (tiền lệ: dòng 1904 ghi cho v885).
