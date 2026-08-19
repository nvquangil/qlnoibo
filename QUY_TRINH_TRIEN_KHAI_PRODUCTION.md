## Runbook: Nâng cấp QLNoiBo Production (v5.0 → v5.8)

**Owner:** Nguyen (Delivery Manager) | **Frequency:** As needed (one-time, khi quyết định go-live batch v5.1–v5.8)
**Last Updated:** 2026-07-13 | **Last Run:** Chưa chạy lần nào

### Purpose

Đưa production (`D:\QLSX`, pm2 `qlnoibo`, hiện đang **v5.0**) lên đúng trạng thái code hiện tại trong thư mục dự án (**v5.8**, đã gồm 3 lần chỉnh sau phản hồi trực tiếp gần đây: bảng công đoạn May tại "Ghi tiến độ", định dạng Vải chính/phối trên phiếu báo cáo, và "SL chỉ định" phụ kiện ở form Tạo phiếu Xuất). Toàn bộ đợt v5.1–v5.8 **chưa từng chạy trên 1 instance SQL Server thật** trong quá trình phát triển — runbook này giả định sẽ chạy thử trên môi trường test trước khi áp dụng cho production thật.

**Điểm mấu chốt cần hiểu trước khi bắt đầu:** code từng version đã được sửa **trực tiếp đè lên nhau** trong cùng 1 bộ code (không giữ snapshot riêng cho v5.1, v5.2...) — vì vậy KHÔNG thể và KHÔNG cần deploy code tuần tự theo từng version. Chỉ copy code đúng **1 lần duy nhất** (bản hiện tại, đã là v5.8). Ngược lại, 8 script migration DB **bắt buộc chạy tuần tự đúng thứ tự**, vì mỗi script build trên cấu trúc bảng do script trước tạo ra.

### Prerequisites

- [ ] Quyền truy cập SSMS + SQL Server đang chạy production DB (hoặc bản sao trên môi trường test)
- [ ] Quyền truy cập máy chủ chạy `D:\QLSX` (Command Prompt, pm2)
- [ ] Đã xác nhận production đang đúng ở bản v5.0, không lệch so với dự kiến — kiểm tra nhanh: mở app, vào Quản lý User → Ma trận phân quyền; nếu **chưa** thấy 2 lựa chọn "Theo nhóm quyền"/"Theo từng user" thì đúng là v5.0, có thể bắt đầu theo đúng trình tự dưới đây
- [ ] Đủ 8 file migration trong `database/`: `migration_v5_userperm.sql`, `migration_v52_qlsx.sql`, `migration_v53.sql`, `migration_v54.sql`, `migration_v55.sql`, `migration_v56.sql`, `migration_v57.sql`, `migration_v58.sql`
- [ ] Đã báo trước cho toàn bộ user: sẽ có gián đoạn ngắn (restart server) và cần đăng xuất/đăng nhập lại sau khi xong

### Procedure

#### Bước 1: Backup

```
1. Backup database (xem Phần D, HUONG_DAN_CAI_DAT.md)
2. Backup thư mục code hiện tại trên production:
   copy D:\QLSX  →  D:\QLSX_backup_v5.0_20260713 (hoặc tên tương tự kèm ngày)
```

**Expected result:** có 1 bản backup DB + 1 bản backup thư mục code, đủ để rollback nếu cần.
**If it fails:** dừng lại, không sang bước nào khác cho tới khi backup thành công.

#### Bước 2: Chạy 8 script migration, ĐÚNG THỨ TỰ, trong SSMS

```
1. database/migration_v5_userperm.sql   (v5.0 → v5.1)
2. database/migration_v52_qlsx.sql      (v5.1 → v5.2)
3. database/migration_v53.sql           (v5.2 → v5.3)
4. database/migration_v54.sql           (v5.3 → v5.4)
5. database/migration_v55.sql           (v5.4 → v5.5)
6. database/migration_v56.sql           (v5.5 → v5.6)
7. database/migration_v57.sql           (v5.6 → v5.7)
8. database/migration_v58.sql           (v5.7 → v5.8)
```

**Expected result:** cả 8 script chạy không lỗi. Tất cả đều additive/idempotent (chỉ thêm bảng/cột mới, không xoá hay đổi kiểu dữ liệu cột cũ) — chạy lại 1 script nếu không chắc đã chạy đủ chưa cũng an toàn.
**If it fails:** dừng ngay tại script lỗi, KHÔNG chạy tiếp script kế tiếp — đối chiếu lại đúng mô tả script đó trong `HUONG_DAN_CAI_DAT.md` (Bước 2.5 đến 2.12) trước khi thử lại.

#### Bước 3: Thay code — CHỈ 1 LẦN

```
Copy toàn bộ backend/ và frontend/ (bản hiện tại trong thư mục dự án, đã là v5.8) đè lên D:\QLSX
GIỮ LẠI nguyên vẹn: backend/.env, backend/uploads/, backend/node_modules/
```

**Expected result:** không copy tuần tự theo từng version — 1 lần copy bản mới nhất là đủ cho toàn bộ 8 bản nâng cấp.
**If it fails:** nếu lỡ ghi đè `.env`/`uploads`, khôi phục ngay 2 phần này từ bản backup ở Bước 1 trước khi khởi động lại server.

#### Bước 4: Cài lại thư viện + khởi động lại

```
cd D:\QLSX\backend
npm install
pm2 restart qlnoibo
```

**Expected result:** `pm2 logs qlnoibo` hiện dòng server đã khởi động thành công, không có dòng lỗi kết nối DB.
**If it fails:** lỗi kết nối DB thường do `.env` bị ghi đè nhầm ở Bước 3; lỗi cú pháp/module thường do code copy ở Bước 3 bị thiếu file — copy lại toàn bộ, không copy chọn lọc.

#### Bước 5: Yêu cầu toàn bộ user đăng xuất/đăng nhập lại

```
Thông báo: mọi tài khoản đăng xuất và đăng nhập lại 1 lần sau khi server đã restart xong
```

**Expected result:** mọi tài khoản nạp đúng cấu trúc phân quyền mới nhất (v5.1 `UserPermissions`, v5.3 `CanEdit`/`CanDelete` theo tab con, v5.6 `QLSX.tiendo`). Một vài bản trung gian không bắt buộc bước này riêng lẻ, nhưng làm 1 lần cho toàn bộ batch là lựa chọn an toàn nhất — không cần phân biệt từng version cần hay không cần.

### Verification

Vì đây là gộp 8 bản nâng cấp cùng lúc, checklist đầy đủ theo từng bản nằm ở `HUONG_DAN_CAI_DAT.md` (Bước 2.5 đến 2.12) — nên kiểm tra hết nếu có thời gian, đặc biệt trên môi trường test. Ưu tiên kiểm tra TRƯỚC vì đây là các điểm thay đổi cơ chế nền tảng, ảnh hưởng rộng nhất, hoặc mới được sửa sau phản hồi trực tiếp gần đây (rủi ro cao hơn vì ít vòng kiểm tra nhất):

- [ ] In BẤT KỲ phiếu nào (Lệnh sản xuất, Phiếu báo cáo, Kho vải, Phụ kiện, tem QR) — tab/cửa sổ chính KHÔNG bị khoá/chuyển focus (v5.8, cơ chế in đổi sang iframe)
- [ ] Mọi ô tìm kiếm (mã cây, phụ kiện, công đoạn may...) — khung gợi ý tự dựng, không bị cắt chữ, dùng được phím mũi tên/Enter/Escape (v5.8, bỏ hẳn `<datalist>`)
- [ ] Ghi tiến độ → May, đơn Nhà Làm — bảng "Công đoạn may đã chọn" sửa được y hệt Kỹ thuật, thêm/bớt công đoạn được (đã sửa lại sau phản hồi trực tiếp, khác bản gốc ban đầu)
- [ ] Phiếu báo cáo đơn hàng → "Xuất vải kèm đơn hàng" — đúng định dạng "Vải chính: loại - màu / Vải phối: loại - màu" (đã sửa sau phản hồi trực tiếp)
- [ ] Phiếu xuất phụ kiện → Tạo mới, có gắn đơn hàng — hiện "— chỉ định: X" cạnh ô Số lượng khi chọn phụ kiện (đã sửa sau phản hồi trực tiếp, mới nhất)
- [ ] Ra lệnh sản xuất — form không giữ lại dữ liệu phiên trước sau khi tạo lệnh
- [ ] Quản lý User → Ma trận phân quyền — đủ cả "Theo nhóm quyền"/"Theo từng user", đủ 3 cột Xem/Sửa/Xóa theo từng tab con, có dòng "Ghi nhận tiến độ" tách riêng khỏi "Xem/Sửa lệnh sản xuất"
- [ ] Từng phân hệ còn lại (Kho vải, Kho hàng hóa, Phụ kiện, Mobile, Dashboard) — theo đúng checklist chi tiết ở Bước 2.5–2.12 tương ứng trong `HUONG_DAN_CAI_DAT.md`

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Migration script báo lỗi thiếu bảng/cột tham chiếu | Chưa chạy đủ script trước đó theo đúng thứ tự, hoặc production chưa thực sự ở v5.0 | Dừng lại, xác nhận lại đúng thứ tự Bước 2, đối chiếu state hiện tại với `HUONG_DAN_CAI_DAT.md` |
| "Lỗi máy chủ khi đăng nhập" ngay sau restart | `.env` sai `DB_SERVER` (instance mặc định vs named instance) hoặc bị ghi đè nhầm ở Bước 3 | Xem `pm2 logs qlnoibo`, tìm dòng `[DB] Loi ket noi SQL Server`, đối chiếu lại Bước 4 (Cấu hình kết nối database) trong `HUONG_DAN_CAI_DAT.md` |
| Sau nâng cấp, 1 user vẫn thấy quyền/giao diện cũ | Chưa đăng xuất/đăng nhập lại | Yêu cầu đăng xuất/đăng nhập lại — quyền chỉ được tính lại lúc đăng nhập |
| Quét QR báo lỗi trên máy khác ngoài máy chủ | Bình thường nếu chưa cài HTTPS qua mkcert (Bước 2.7, tuỳ chọn, không bắt buộc cho batch này) | Bỏ qua nếu không cần quét QR từ máy khác, hoặc làm riêng phần mkcert tuỳ chọn |

### Rollback

1. `pm2 stop qlnoibo`
2. Khôi phục database từ bản backup ở Bước 1 (ghi đè toàn bộ — các migration đã thêm bảng/cột mới, không thể "undo" từng phần)
3. Khôi phục thư mục `D:\QLSX` từ bản backup code ở Bước 1
4. `pm2 restart qlnoibo`
5. Xác nhận app chạy đúng lại bản v5.0 như trước khi nâng cấp

### Escalation

| Situation | Contact | Method |
|---|---|---|
| Migration script lỗi giữa chừng, không rõ nguyên nhân | Người triển khai chính | Đối chiếu đúng Bước tương ứng trong `HUONG_DAN_CAI_DAT.md` trước khi thử lại |
| Sau khi rollback vẫn không phục hồi được | DBA / người quản lý hạ tầng SQL Server | Khôi phục từ bản backup, kiểm tra log SQL Server trực tiếp |

### History

| Date | Run By | Notes |
|---|---|---|
| | | |
