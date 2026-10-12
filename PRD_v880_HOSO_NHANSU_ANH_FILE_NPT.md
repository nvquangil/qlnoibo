# PRD v8.80 — Hồ sơ nhân sự: ảnh, file đính kèm, người phụ thuộc

Trạng thái: **CHỜ QUYẾT 2 ĐIỂM** — chưa viết dòng code nào.
Ngày: 2026-10-10

---

## 1. Yêu cầu

Nguyen (kèm ảnh mockup): hồ sơ nhân sự thêm
1. Tải **ảnh** nhân viên
2. Tải **giấy tờ / quyết định dạng PDF**
3. Danh sách **người phụ thuộc**

---

## 2. 🔴 CHẶN TRƯỚC KHI LÀM — dữ liệu nhân sự sẽ CÔNG KHAI RA INTERNET

Đây không phải rủi ro giả định. Ba dòng code sau đã tồn tại:

| File | Dòng | Nội dung |
|---|---|---|
| `backend/server.js` | 140 | `app.use('/uploads', express.static(...))` — **KHÔNG qua `requireAuth`** |
| `backend/server.js` | 112–122 | `duocPhepCongKhai()` whitelist `/uploads/` và `/anh/` |
| `backend/server.js` | 198 | `PUBLIC_PORT = 80` — cổng công khai phục vụ catalogue cho khách |

Nghĩa là: **mọi file trong `backend/uploads/` ai biết URL đều tải được, kể cả từ internet qua cổng 80.**

Hiện chỉ có ảnh vải, ảnh hàng hóa nên hậu quả nhỏ. Nhưng việc này đưa vào đó:
**ảnh chân dung · bản scan CCCD · hợp đồng lao động · quyết định lương · giấy khai sinh người phụ thuộc.**

Tên file sinh theo `prefix_timestamp.ext` (`upload.js`) — nếu prefix là mã nhân viên thì **đoán được**.

Đây là dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. Tôi không đề xuất phương án "làm trước, bảo mật sau".

**Cách xử lý (đã khảo sát, repo có sẵn khuôn):** lưu hồ sơ nhân sự vào thư mục **riêng, ngoài `/uploads`**, và phục vụ qua route có gate — đúng khuôn `hoadon.js:959-987` (whitelist đuôi file, `path.basename()` chống traversal, kiểm thư mục gốc, `Content-Disposition`).

Cái giá: `anhNho()` (`common.js:75`) và `routes/anh.js` chỉ nhận tên file phẳng trong `/uploads`, nên **ảnh đại diện nhân viên không có thumbnail** — tải ảnh gốc đã nén 1600px (~100–300 KB). Chấp nhận được cho một ô ảnh.

---

## 3. Hiện trạng — cái gì đã có

### Tái dùng được nguyên, không viết mới
- `POST /api/upload` (`upload.js`): multer **30 MB** + sharp tự xoay/nén 1600px. **Nhánh `!laAnh` (dòng 57–62) đã ghi nguyên bản file không phải ảnh ⇒ PDF chạy được ngay**, chỉ cần đặt `accept="application/pdf"`.
- `uploadFile(file, prefix)` — `common.js:55`, đã dùng ở 9 module.
- **Widget chọn nhiều file + xóa + upload ngay**: `module.qlsx.js:1941-1987` (`anhHinhInBoxHtml` / `wireAnhHinhInBox`) — khuôn mẫu cho danh sách file đính kèm.
- `multer` + `sharp` đã có trong `package.json`. **Không cài thêm thư viện nào.**

### Đã có nhưng chưa nối dây
4 bảng văn bản HRM (`HopDongLaoDong`, `PhuLucHopDong`, `QuyetDinhNhanSu`, `ThanhLyHopDong`) **đều đã có cột `FileDinhKem NVARCHAR(500)`**, và backend **đã đọc/ghi** `b.fileDinhKem` (`hrm.js:323, 414, 435, 484, 505, 554, 578`).

🔴 **Nhưng frontend chưa bao giờ gửi** — grep `fileDinhKem` trong `module.hrm.js` ra **0 kết quả**. Cột luôn NULL. Đường ống thông 90%, thiếu đúng ô chọn file.

### Chưa có
- Cột ảnh nhân viên (`NhanVien` không có `AnhDaiDien`)
- Bảng file đính kèm nhiều file cho nhân viên
- **Bảng `NguoiPhuThuoc`** — hiện chỉ có một con số `NhanVien.SoNguoiPhuThuoc INT`

---

## 4. ⚠️ Người phụ thuộc đụng vào TÍNH THUẾ TNCN

`payroll.js:954`:
```js
const giamTruNPT = (Number(cfg.GiamTruNPT) || 0) * (Number(e.SoNguoiPhuThuoc) || 0);
```

Thêm bảng chi tiết thì phải quyết `SoNguoiPhuThuoc` lấy từ đâu. **Đổi payroll sang đếm trực tiếp từ bảng mới là rủi ro cao** — nó làm đổi thuế TNCN của **các kỳ lương đã chốt**: người phụ thuộc khai hôm nay sẽ hồi tố vào bảng lương tháng trước.

Đề xuất: **giữ nguyên cột `SoNguoiPhuThuoc` làm nguồn tính lương**, bảng mới chỉ tự cập nhật lại con số đó khi thêm/xóa người phụ thuộc. Payroll không đụng tới ⇒ kỳ cũ không đổi.

---

## 5. ⚠️ Rủi ro mất hồ sơ pháp lý khi deploy

`backend/.gitignore:3` loại `uploads/*` khỏi git. Thư mục nguồn ở máy C **rỗng**. Quy trình deploy là copy tay C → D.

**Copy nhầm cả thư mục `uploads/` rỗng từ máy dev đè lên máy chủ = mất sạch file.** Hiện mất ảnh vải thì khó chịu; sau việc này là **mất hợp đồng lao động và CCCD, không khôi phục được từ CSDL** vì CSDL chỉ giữ đường dẫn.

`HUONG_DAN_CAI_DAT.md:53` đã ghi "GIỮ LẠI nguyên vẹn: backend/uploads/". Việc này làm hậu quả của một lần sơ ý nặng hơn nhiều — cần nhắc lại ở hướng dẫn deploy của bản này.

---

## 6. Tiêu chí hoàn thành

1. Form nhân viên có ô chọn ảnh; bảng danh sách và màn hồ sơ hiện ảnh.
2. Mỗi nhân viên đính kèm được **nhiều file** (PDF/ảnh), mỗi file giữ **tên gốc** và **loại giấy tờ**, xem/tải/xóa được.
3. Quản lý được danh sách người phụ thuộc; `SoNguoiPhuThuoc` tự khớp với số dòng.
4. **Bảng lương các kỳ đã chốt không đổi một đồng nào** sau khi triển khai — đối chiếu trước/sau.
5. **File hồ sơ nhân sự KHÔNG tải được khi chưa đăng nhập, và KHÔNG tải được qua cổng 80.**
6. 4 bảng văn bản HRM gắn được file (nối nốt đường ống đã có).
7. CSDL chưa chạy migration vẫn chạy bình thường (dò cột trước khi dùng).

---

## 7. Phạm vi

**Trong phạm vi**
- Ảnh đại diện nhân viên
- File đính kèm nhiều file cho nhân viên (bảng riêng, giữ tên gốc + loại giấy tờ)
- Bảng + màn hình người phụ thuộc, đồng bộ `SoNguoiPhuThuoc`
- Thư mục lưu riêng + route phục vụ file có phân quyền
- Nối ô chọn file cho 4 form văn bản HRM

**Ngoài phạm vi — ảnh mockup có nhưng Nguyen không yêu cầu**
- ❌ Chấm công, Tính lương, BHXH, Thuế TNCN, Khen thưởng – Kỷ luật, Lịch sử thay đổi (các tab bên trái mockup)
- ❌ Đổi bố cục màn hồ sơ thành dạng hai cột như mockup
- ❌ Import Excel có ảnh
- ❌ Sửa `payroll.js`

---

## 8. Kế hoạch

| # | Việc | File |
|---|---|---|
| 1 | Migration: `NhanVien.AnhDaiDien`, bảng `HoSoDinhKemNhanVien`, bảng `NguoiPhuThuoc`, seed `ChucNang` | `database/migration_v876.sql` |
| 2 | Thư mục `backend/uploads_hr/` + route `GET /api/hrm/file/:id` gate `HRM/view` (khuôn `hoadon.js:959`) | `backend/routes/hrm.js` |
| 3 | Chặn `uploads_hr` khỏi `duocPhepCongKhai()` | `backend/server.js` |
| 4 | Route upload riêng cho hồ sơ nhân sự (ghi vào `uploads_hr`) | `backend/routes/hrm.js` |
| 5 | CRUD file đính kèm + người phụ thuộc; đồng bộ `SoNguoiPhuThuoc` | `backend/routes/hrm.js` |
| 6 | `bindNhanVien` + INSERT + UPDATE thêm `AnhDaiDien` (**3 chỗ**, hrm.js:40/179/208) | `backend/routes/hrm.js` |
| 7 | Form nhân viên: ô ảnh; màn hồ sơ: khối file đính kèm + người phụ thuộc | `frontend/js/module.hrm.js` |
| 8 | Nối `fileDinhKem` vào 4 form văn bản | `frontend/js/module.hrm.js` |
| 9 | Bump `?v=` (`module.hrm.js` đang 6.38) | `frontend/index.html` |
| 10 | Bộ tự kiểm + hướng dẫn deploy nhắc giữ `uploads_hr/` | `backend/utils/` |

Migration chỉ **thêm** cột/bảng, không đụng dữ liệu cũ ⇒ không có bước nào không hoàn tác được.

---

## 9. Hai điểm cần quyết

**Q1 — Mức bảo mật file hồ sơ.** Xem mục 2.
**Q2 — `SoNguoiPhuThuoc` tự tính hay nhập tay.** Xem mục 4.
