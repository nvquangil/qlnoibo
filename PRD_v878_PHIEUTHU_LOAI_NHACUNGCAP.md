# PRD v8.78 — Phiếu thu: thêm loại đối tượng "Nhà cung cấp"

Trạng thái: **CHỜ TRẢ LỜI 1 CÂU NGHIỆP VỤ** — chưa viết dòng code nào.
Ngày: 2026-10-10

---

## 1. Yêu cầu

Nguyen: *"phiếu thu loại đối tượng thêm nhà cung cấp"*.

Form Phiếu thu (`module.congno.js:362-366`) hiện có đúng 2 lựa chọn:

| Giá trị | Nhãn |
|---|---|
| `KhachHang` | Khách hàng (giảm công nợ) |
| `Khac` | Khác (không vào công nợ) |

Phiếu CHI thì đã có 4: `NhaCungCap` / `NhaGiaCong` / `NhanVien` / `Khac` (`module.congno.js:525-531`).

---

## 2. Hiện trạng — ba điều quyết định toàn bộ thiết kế

### 2.1 `PhieuThu` KHÔNG có cột `NCC_ID`, `PhieuChi` thì CÓ

| Bảng | LoaiDoiTuong | KhachHangID | NCC_ID | NhaGiaCongID |
|---|---|---|---|---|
| `PhieuThu` (`CAI_DAT_DAY_DU.sql:6583`) | ✅ mặc định `KhachHang` | ✅ | ❌ **không có** | ❌ |
| `PhieuChi` (`CAI_DAT_DAY_DU.sql:6606`) | ✅ mặc định `NhaCungCap` | ❌ | ✅ | ✅ |
| `CongNoDieuChinh` | ✅ | ✅ | ✅ | — |

⇒ Bắt buộc có migration thêm `PhieuThu.NCC_ID INT NULL` + khóa ngoại.

### 2.2 🔴 `chuanHoaPhieuThu()` là whitelist NGƯỢC — cái bẫy nguy hiểm nhất

`congno.js:49`:

```js
loai: b.loaiDoiTuong === 'Khac' ? 'Khac' : 'KhachHang',
```

Mọi giá trị **khác** `'Khac'` đều bị ép thành `'KhachHang'`. Nên nếu chỉ thêm option ở form mà quên sửa
dòng này, phiếu thu chọn "Nhà cung cấp" sẽ được **lưu vào CSDL là `KhachHang`**, mang `TenDoiTuong` là
tên NCC.

Hậu quả: `congNoKhachHang()` (`congno.js:864-867`) gom "Đã thu" theo **TÊN** với điều kiện
`LoaiDoiTuong = N'KhachHang'` ⇒ số tiền đó **cộng thẳng vào công nợ của một "khách hàng" trùng tên NCC**.
Không báo lỗi, không ai thấy — chỉ là công nợ khách sai.

Nặng hơn với **đối tác 2 chiều (v7.81)**: nếu NCC đó đồng thời là khách hàng (ghép qua
`NhaCungCap.KhachHangID`, `migration_v696.sql`), tiền sẽ **trừ nợ phải thu** của chính đối tác đó thay
vì tác động lên nợ phải trả ⇒ **lệch gấp đôi**.

Tin tốt: hàng rào `WHERE LoaiDoiTuong = N'KhachHang'` đã dựng sẵn ở **8 chỗ** đọc `PhieuThu`
(`congno.js:864, 916`, `dashboard.js:144, 153`, `baocao.js:637`, `utils/congNoTruocChungTu.js:45`,
`utils/gop_ten_khach.js:84`, `routes/danhmuc.js:120`). Chỉ cần ghi ĐÚNG loại thì tất cả tự an toàn.

### 2.3 Công nợ NCC hiện HOÀN TOÀN MÙ với phiếu thu

`congNoNCC()` (`congno.js:951-1021`) tính "đã trả" **chỉ từ `PhieuChi`** (dòng 962-964).
`soChiTietNCC()` (`congno.js:1029-1106`) liệt kê 7 loại chứng từ: `PNV · PNPK · PC · PXV · PXPK · PNKH`
+ điều chỉnh — **không có `PT`**.

⇒ Thêm option mà không sửa hai hàm này thì phiếu thu NCC **biến mất khỏi mọi báo cáo công nợ**,
chỉ còn thấy ở sổ quỹ. Lại là kiểu sai im lặng.

---

## 3. 🔴 CÂU HỎI PHẢI TRẢ LỜI TRƯỚC KHI CODE

**"Thu tiền từ nhà cung cấp" trong nghiệp vụ của anh là gì, và nó có được tính vào công nợ NCC không?**

Hai cách hiểu, dẫn tới hai khối lượng công việc khác hẳn nhau:

### Phương án A — CÓ vào công nợ (đúng kế toán)
NCC hoàn/trả lại tiền (tiền thừa, hàng lỗi, chiết khấu trả sau) ⇒ phần "đã trả" giảm đi ⇒
**số còn nợ NCC TĂNG lại**: `ConNo = phaiTra − daTra + thuLaiTuNCC`.

Phải sửa thêm: `congNoNCC()`, `soChiTietNCC()` (thêm `CtLoai = 'PT'`, **đúng dấu**),
`baocao.js:650` (mục B, nếu không sửa thì mục B và màn Công nợ NCC lệch nhau).
Sổ đối tác 2 chiều **tự hưởng** vì nó gọi lại `soChiTietNCC()` (`congno.js:1114-1131`) — nhưng đặt
sai dấu là lệch gấp đôi và sổ 2 chiều lệch theo.

### Phương án B — KHÔNG vào công nợ (chỉ ghi nguồn tiền)
Giống option "Khác" hiện có, nhưng được **chọn NCC từ danh mục** thay vì gõ tay, để biết tiền từ đâu
và lọc/báo cáo được. Công nợ NCC không đổi.

Phải sửa ít hơn hẳn: migration + `chuanHoaPhieuThu` + INSERT/UPDATE + form. Không đụng `congNoNCC()`.

**Tôi không đoán giúp được** — chọn sai A/B thì hoặc công nợ NCC sai, hoặc anh làm xong vẫn chưa
có cái mình cần.

---

## 4. Tiêu chí hoàn thành

1. Form Phiếu thu có lựa chọn "Nhà cung cấp", chọn vào thì hiện ô chọn NCC từ danh mục (không gõ tay).
2. Phiếu lưu xuống đúng `LoaiDoiTuong = N'NhaCungCap'` + `NCC_ID` — **không bao giờ** rơi vào `KhachHang`.
3. Công nợ **khách hàng** không đổi một đồng nào sau khi thêm loại này (kiểm bằng cách đối chiếu
   trước/sau trên cùng kỳ).
4. Công nợ **NCC** hành xử đúng theo phương án đã chọn (A hoặc B) — và **mục B của Báo cáo tài chính
   khớp với màn Công nợ NCC**, không lệch.
5. Bảng danh sách phiếu thu phân biệt được loại (hiện chỉ có badge cho `Khac`).
6. CSDL chưa chạy migration vẫn chạy bình thường (dò cột bằng `coCot` trước khi dùng).
7. Bộ tự kiểm mới chạy xanh.

---

## 5. Phạm vi

**Trong phạm vi**
- `database/migration_v875.sql` (mới) + gộp vào `CAI_DAT_DAY_DU.sql`
- `congno.js`: `chuanHoaPhieuThu()`, POST/PUT `/phieuthu`
- `module.congno.js`: form phiếu thu + badge ở bảng danh sách + bump `?v=`
- (phương án A) `congNoNCC()`, `soChiTietNCC()`, `baocao.js` mục B
- `utils/chungTu.js` nhánh `PT`: thêm `LEFT JOIN NhaCungCap` — hiện chỉ nhánh `PC` có, nên popup xem
  chứng từ của phiếu thu NCC sẽ không hiện tên NCC
- Bộ tự kiểm mới

**Ngoài phạm vi**
- ❌ Thêm `NhaGiaCong` / `NhanVien` cho phiếu thu (chỉ làm NCC như anh yêu cầu)
- ❌ Sửa cơ chế gộp tên khách (`gop_ten_khach.js`) — chỉ RÀ để chắc nó không chạm phiếu thu NCC
- ❌ Đụng vào phiếu chi

---

## 6. Hai chỗ dễ quên, đã có cảnh báo sẵn trong code

**`SQL_NHOM_DONG_TIEN`** (`baocao.js:514-519`) có comment ở dòng 497-499 nói thẳng:

> *"`laChi` = true thì mới có nhánh 'Trả nhà cung cấp' — PhieuThu không trả cho NCC, để nhánh đó ở cả
> hai bên là mở đường cho một phiếu thu lạc vào nhóm chi."*

Đây là một giả định **đã được code-hóa có chủ ý** và việc này phá nó. Sau khi thêm, phiếu thu NCC chưa
khai loại tài khoản sẽ rơi vào nhóm "(chưa phân loại)" ở mục C của Báo cáo tài chính. Cần quyết: để vậy,
hay thêm nhóm riêng "Thu lại từ nhà cung cấp".

**`routes/danhmuc.js:120-122`** áp điều kiện `LoaiDoiTuong = N'KhachHang'` cho cả bảng `PhieuChi` khi gộp
tên khách — trông lạ, cần rà lại khi làm.

---

## 7. Kế hoạch (sau khi chốt A hay B)

| # | Việc | File | Chỉ có ở PA |
|---|---|---|---|
| 1 | Migration thêm `PhieuThu.NCC_ID` + FK | `database/migration_v875.sql` | A và B |
| 2 | Gộp vào bản cài đặt đầy đủ | `database/CAI_DAT_DAY_DU.sql` | A và B |
| 3 | `chuanHoaPhieuThu()`: mở whitelist, NULL hóa chéo | `congno.js:47-68` | A và B |
| 4 | INSERT/UPDATE `/phieuthu` thêm `NCC_ID` (dò cột trước) | `congno.js:424, 515` | A và B |
| 5 | Form: option + ẩn/hiện ô (**xóa giá trị** ô bị ẩn, theo mẫu `dongBoO()` dòng 554-563) | `module.congno.js:362` | A và B |
| 6 | Badge loại ở bảng danh sách phiếu thu | `module.congno.js:244` | A và B |
| 7 | Nhánh `PT` JOIN NhaCungCap | `utils/chungTu.js` | A và B |
| 8 | `congNoNCC()` cộng phiếu thu | `congno.js:951` | **chỉ A** |
| 9 | `soChiTietNCC()` thêm `CtLoai='PT'`, đúng dấu | `congno.js:1029` | **chỉ A** |
| 10 | Mục B báo cáo tài chính khớp lại | `baocao.js:650` | **chỉ A** |
| 11 | Bộ tự kiểm + bump `?v=` | `utils/`, `index.html` | A và B |

Migration là **thêm cột NULL, không sửa dữ liệu có sẵn** ⇒ không có bước nào không hoàn tác được.
Nhưng nếu chọn phương án A thì **số công nợ NCC sẽ thay đổi** ngay khi có phiếu thu NCC đầu tiên.
