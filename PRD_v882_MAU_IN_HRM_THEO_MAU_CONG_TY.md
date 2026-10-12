# PRD v8.82 — Mẫu in HRM theo đúng mẫu công ty (HĐLĐ chính thức / thử việc / QĐ tăng lương)

Trạng thái: **CHỜ CHỐT 4 ĐIỂM** — chưa viết code.
Ngày: 2026-10-10

---

## 1. Yêu cầu

Nguyen gửi 3 mẫu thật của công ty, yêu cầu: *"những chỗ … điền theo trường ở màn nhập liệu, nếu chưa có bổ sung trường nhập liệu cho khớp"*.

Hiện `printHopDong()` / `printQuyetDinh()` trong `module.hrm.js` dùng mẫu tôi tự soạn — câu chữ điều khoản khác hẳn mẫu công ty, và thiếu nhiều mục.

---

## 2. ĐỐI CHIẾU: chỗ `…` trong mẫu ↔ dữ liệu hiện có

### 2.1 QUYẾT ĐỊNH TĂNG LƯƠNG

| Chỗ `…` trong mẫu | Lấy từ | Trạng thái |
|---|---|---|
| Số: …/QĐTL | `QuyetDinhNhanSu.SoQuyetDinh` | ✅ |
| Hà Nội, ngày … tháng … năm … | **ngày ký quyết định** | ❌ **THIẾU** — bảng chỉ có `NgayHieuLuc` |
| Họ và tên | `NhanVien.HoTen` | ✅ |
| Bộ phận/chức vụ | `BoPhan.TenBoPhan` + `NhanVien.ChucVu` | ✅ |
| Mức lương cũ | `GiaTriCu` | ✅ |
| Mức lương mới | `GiaTriMoi` | ✅ |
| Thời điểm áp dụng | `NgayHieuLuc` | ✅ |
| Giám đốc: Nguyễn Văn Quân | `COMPANY.giamDoc` | ⚠️ đang để **rỗng** trong code |

### 2.2 HỢP ĐỒNG LAO ĐỘNG (chính thức)

| Chỗ `…` | Lấy từ | Trạng thái |
|---|---|---|
| Số: …/HĐLĐ-MOYN | `HopDongLaoDong.SoHopDong` | ✅ |
| Hà Nội, ngày … tháng … năm | **ngày ký hợp đồng** | ❌ **THIẾU** |
| Bên A (tên, địa chỉ, MST, đại diện) | `COMPANY` | ✅ (trừ `giamDoc` đang rỗng) |
| Họ và tên / Ngày sinh / CCCD / Ngày cấp / Nơi cấp / Nơi cư trú / SĐT | `NhanVien.*` | ✅ |
| **Quốc tịch** | — | ❌ **THIẾU** |
| 1.1 Loại HĐLĐ … **… năm** từ ngày … đến hết ngày … | `LoaiHopDong`, `TuNgay`, `DenNgay` | ✅ (số năm tự tính từ 2 ngày) |
| 1.2 Chức danh | `HopDongLaoDong.ChucVu` | ✅ |
| 1.3 Bộ phận | `BoPhan.TenBoPhan` của nhân viên | ✅ |
| 1.4 Địa điểm làm việc | `NoiLamViec` (mặc định địa chỉ công ty) | ✅ |
| 3.1 Mức lương … đồng/tháng **(Bằng chữ: …)** | `LuongCoBan` + `docSoTienBangChu()` (`common.js:303`) | ✅ |
| 3.3a **Chuyên cần** … đồng/tháng | — | ❌ **THIẾU** |
| 3.3b Hỗ trợ xăng xe … đồng/tháng **… công** | `PhuCapXangXe` ✅ / **số công** ❌ | ❌ thiếu phần công |
| 3.3c Ăn trưa … đồng/tháng **… công** | `PhuCapAnCa` ✅ / **số công** ❌ | ❌ thiếu phần công |
| 3.3d **Phụ cấp chức vụ/trách nhiệm** | — | ❌ **THIẾU** |
| 3.3e **Quỹ KPI** … đồng/tháng | — | ❌ **THIẾU** |

⚠️ Mẫu công ty **không dùng** `PhuCapTrangPhuc` và `PhuCapDienThoai` — hai cột này đã có trong CSDL và đang dùng ở chỗ khác, nên **giữ nguyên**, chỉ là không in ra trong mẫu này.

### 2.3 HỢP ĐỒNG THỬ VIỆC

Giống mục 2.2, thêm:

| Chỗ `…` | Lấy từ | Trạng thái |
|---|---|---|
| Mã NV | `NhanVien.MaNhanVien` | ✅ |
| 1.2 **Quản lý trực tiếp** | — | ❌ **THIẾU** |
| 1.4 Thời gian thử việc: **30 ngày**, từ … đến … | `TuNgay`/`DenNgay` (số ngày tự tính) | ✅ |
| 3.2 hưởng **85%** mức lương | — | ❌ **THIẾU** (đang ghi cứng trong mẫu) |
| Ký: người thử việc | `NhanVien.HoTen` | ✅ |

---

## 3. TRƯỜNG CẦN BỔ SUNG — tổng hợp

### `NhanVien`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `QuocTich` | `NVARCHAR(50) NULL` | mặc định điền 'Việt Nam' trên form |

### `HopDongLaoDong`
| Cột | Kiểu | Dùng ở |
|---|---|---|
| `NgayKy` | `DATE NULL` | dòng "Hà Nội, ngày … tháng … năm" |
| `QuanLyTrucTiep` | `NVARCHAR(100) NULL` | HĐ thử việc mục 1.2 |
| `PhuCapChuyenCan` | `DECIMAL(14,2) NULL` | mục 3.3a |
| `PhuCapChucVu` | `DECIMAL(14,2) NULL` | mục 3.3d |
| `QuyKPI` | `DECIMAL(14,2) NULL` | mục 3.3e |
| `SoCongXangXe` | `DECIMAL(6,2) NULL` | mục 3.3b phần "… công" |
| `SoCongAnTrua` | `DECIMAL(6,2) NULL` | mục 3.3c phần "… công" |
| `TyLeThuViec` | `DECIMAL(5,2) NULL` | HĐ thử việc mục 3.2, mặc định 85 |

### `QuyetDinhNhanSu`
| Cột | Kiểu |
|---|---|
| `NgayKy` | `DATE NULL` |

### Hằng số trong code
`COMPANY.giamDoc` (`module.hrm.js:22`) đang để rỗng → điền **`NGUYỄN VĂN QUÂN`**.

---

## 4. 🔴 BỐN ĐIỂM CẦN CHỐT

**Q1 — "… đồng/tháng … công" nghĩa là gì?**
Mẫu ghi: *"Hỗ trợ xăng xe: ……… đồng/tháng ……… công."* Tôi hiểu là **số tiền trên tháng, tương ứng với số công chuẩn** (đi đủ số công đó thì hưởng đủ, thiếu công thì trừ theo tỷ lệ). Nếu đúng thì hai ô `SoCongXangXe` / `SoCongAnTrua` là **số công chuẩn**. Nếu ý khác (ví dụ: đơn giá trên mỗi công) thì cách lưu và cách in đều khác.

**Q2 — Phụ cấp thử việc có áp 85% không?**
Mẫu thử việc mục 3.3e ghi rõ: *"Các khoản phụ cấp, hỗ trợ và phúc lợi trên được tính riêng, không áp dụng mức 85% của lương thử việc."* Tôi sẽ in đúng câu đó. Chỉ hỏi để chắc: `TyLeThuViec` chỉ dùng cho **lương cơ bản**, đúng không?

**Q3 — Bốn loại quyết định còn lại.**
Mẫu tăng lương có kết cấu riêng (Điều 1 nêu lương cũ/mới, Điều 2 nói về căn cứ trả lương). *Khen thưởng, Kỷ luật, Bổ nhiệm, Điều chuyển* dùng chung khuôn này và chỉ đổi nội dung Điều 1, hay anh gửi mẫu riêng sau? Trước mắt tôi làm **mẫu tăng lương đúng chuẩn**, bốn loại kia dùng khuôn tổng quát hiện có.

**Q4 — Loại hợp đồng nào dùng mẫu nào.**
`LoaiHopDong` có *Thử việc* / *Xác định thời hạn* / *Không xác định thời hạn*. Hiểu: **Thử việc → mẫu thử việc**, hai loại còn lại → **mẫu chính thức** (mục 1.1 tự đổi câu chữ: "Xác định thời hạn … năm từ … đến …" hoặc "Không xác định thời hạn, từ ngày …").

---

## 5. Phạm vi

**Trong**: migration thêm cột · form nhập bổ sung ô · 3 hàm in theo đúng mẫu · `COMPANY.giamDoc` · bộ tự kiểm.

**Ngoài**: ❌ không sửa `payroll.js` (các phụ cấp mới **chỉ để in hợp đồng**, chưa đưa vào công thức tính lương — nếu muốn tính lương theo chúng thì là việc riêng, đụng bảng lương đã chốt) · ❌ không sinh file .docx (hệ thống in bằng `printHtml()` + Ctrl+P như mọi chứng từ khác) · ❌ không đổi mẫu Phụ lục / Thanh lý.

---

## 6. Rủi ro

⚠️ **Phụ cấp mới KHÔNG tự chảy vào bảng lương.** `payroll.js` hiện tính theo bộ phụ cấp cũ. Thêm `PhuCapChuyenCan` / `PhuCapChucVu` / `QuyKPI` vào hợp đồng mà không sửa payroll ⇒ hợp đồng in ra có khoản đó nhưng bảng lương không cộng. Đây là lựa chọn **có chủ ý** (không đụng kỳ lương đã chốt), nhưng phải nói rõ với người dùng, kẻo tưởng khai vào là tự tính.
