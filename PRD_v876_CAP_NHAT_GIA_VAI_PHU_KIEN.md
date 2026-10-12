# PRD v8.76 — Cập nhật giá vải & giá phụ kiện cho mã chưa có giá

Trạng thái: **CHỜ KẾT QUẢ ĐO (mục 4 của `kiem_tra_gia_thieu.sql`) rồi mới code**
Ngày: 2026-10-09 · Bản 2 (sửa sau khi Nguyen trả lời Q1–Q4)

---

## 1. Vấn đề

Nhiều cây vải và nhiều mã phụ kiện **không có đơn giá**. Hệ quả đo được:

| Nơi dùng giá | File | Khi giá trống |
|---|---|---|
| Công nợ nhà cung cấp | `congno.js:951-958` | phiếu nhập ghi nợ **0 đồng** |
| Giá thành đơn hàng | `qlsx.js:3057, 3082` | dòng gắn cờ `ThieuDonGia`, giá thành thiếu |
| Báo cáo tồn vải (giá trị) | `baocao.js:323, 633` | giá trị tồn thấp hơn thực tế |
| Sổ kế toán | `congno.js:1695, 2209` | dòng nhập vải không có đơn giá |

Không phải lỗi phần mềm — là **dữ liệu chưa khai**. Nhập tay từng cây qua giao diện không khả thi.

---

## 2. Hai phát hiện quyết định thiết kế

### 2.1 Hệ thống KHÔNG lưu giá ở cấp mã

| | Bảng | Cột | Mức lưu |
|---|---|---|---|
| Vải | `VaiCay` | `DonGiaNhap DECIMAL(14,2) NULL` | **từng CÂY** |
| Phụ kiện | `PhieuPhuKienChiTiet` | `DonGia DECIMAL(14,2) NULL` | **từng DÒNG phiếu NHẬP** |

`DanhMucVai` / `DanhMucPhuKien` không có cột giá.
⇒ "Điền giá cho mã" = **UPDATE hàng loạt các dòng con**. Không có chỗ nào điền một lần.

### 2.2 File bảng giá khớp theo MÃ LOẠI VẢI — cấp cao hơn mã vải

```
LoaiVai.MaLoai (vd CTT4C)  →  nhiều DanhMucVai.MaVai (chất liệu + màu)  →  nhiều VaiCay
```

Nguyen xác nhận file có **mã loại vải + giá** (không phải mã vải). Một giá áp cho mọi màu của chất
liệu đó. Nghiệp vụ hợp lý, nhưng độ tin cậy của khóa khớp khác hẳn:

| Cột | Ràng buộc | Rủi ro |
|---|---|---|
| `DanhMucVai.MaVai` | `NOT NULL UNIQUE` | không có |
| `DanhMucPhuKien.MaPhuKien` | cần kiểm tra | mục 9 của SQL |
| **`LoaiVai.MaLoai`** | **`NULL` được, KHÔNG UNIQUE** | 🔴 một mã có thể trỏ tới nhiều loại vải ⇒ áp nhầm giá |

⇒ Mục 7 của `kiem_tra_gia_thieu.sql` phải sạch (không có dòng trùng) trước khi dùng khóa này.
Mã loại trùng hoặc trống thì CLI **bỏ qua và báo tên**, không đoán.

### 2.3 🔴 SỬA LẠI NHẬN ĐỊNH VỀ CÔNG NỢ (bản 1 của PRD này nói sai)

Bản 1 viết "nợ NCC phát sinh khi **xuất** cây", trích `congno.js:973`. **Sai** — dòng 973 là phiếu
**trả hàng về NCC** (giảm nợ). Công nợ thật ở dòng **951–954**:

```sql
SUM(KGNhap × DonGiaNhap)  trên MỌI cây thuộc PhieuNhapVai CÓ NCC_ID
```

**Nợ phát sinh lúc NHẬP, không liên quan đến việc cây đã xuất hay chưa.** Phụ kiện y hệt
(`congno.js:955-958`: `SoLuong × DonGia` trên phiếu `LoaiPhieu = N'Nhập'` có `NCC_ID`).

Nguyen trả lời Q4: *"công nợ không thay đổi vì những cây nhập trước là tồn kho nhập vào"*.
**Lý do này không đúng** — chính việc nhập mới tạo nợ; cây nằm im trong kho vẫn tính.

**Nhưng kết luận có thể vẫn đúng, vì một lý do khác:** chỉ phiếu có `NCC_ID IS NOT NULL` mới vào công
nợ. Tồn đầu kỳ nhập bằng CLI `nhap_ton_vai_excel.js` tạo phiếu **không gán NCC**
(`INSERT PhieuNhapVai (NgayNhap, GhiChu, NguoiTaoID)` — không có `NCC_ID`). Cây thuộc nhóm đó điền
giá bao nhiêu cũng không đụng công nợ.

⇒ Câu hỏi đúng không phải *"cây đã xuất chưa"* mà **"phiếu nhập của cây đó có gán NCC không"**.
Mục 4 / 4b / 4c của `kiem_tra_gia_thieu.sql` trả lời chính xác câu đó. **Chưa có số này thì chưa code.**

---

## 3. Tiêu chí hoàn thành

1. Nạp được file bảng giá hiện có của Nguyen (mã loại vải + giá / mã phụ kiện + giá), **không phải gõ lại**.
2. Mặc định **XEM TRƯỚC** — không có `--ghi` thì tuyệt đối không đụng CSDL.
3. Dòng nào **đã có giá thì bỏ qua**, không bao giờ đè (Nguyen chốt ở Q2).
4. Trước khi ghi: **sao lưu** giá trị cũ ra JSON trong `backend/backup/`.
5. Ghi trong **transaction** — lỗi giữa chừng rollback hết.
6. Báo rõ mã nào trong file **không khớp** được (mã loại trùng / trống / không tồn tại) — không im lặng bỏ qua.
7. Chạy lại `kiem_tra_gia_thieu.sql`: số dòng thiếu giá giảm đúng bằng số đã điền.

---

## 4. Phạm vi

**Trong phạm vi**
- `backend/utils/gia_vai_phukien_excel.js` — CLI chạy bằng `node`, dò cột theo **tên tiêu đề**
  (dùng lại cơ chế `TU_DIEN_COT` của `nhap_ton_vai_excel.js`) nên đọc được file Nguyen tự làm.
- `database/kiem_tra_gia_thieu.sql` — chỉ đọc, đã xong, chạy được ngay.

**Ngoài phạm vi (cố ý)**
- ❌ Thêm cột giá vào `DanhMucVai` / `DanhMucPhuKien` / `LoaiVai`. Đổi mô hình dữ liệu, kéo theo công
  nợ + giá thành + sổ kế toán. Nếu cần thì là dự án riêng.
- ❌ Màn hình web nhập giá hàng loạt. Việc làm một lần, không đáng làm giao diện.
- ❌ Tự suy giá / nội suy từ mã tương tự.
- ❌ Sửa `LoaiVai.MaLoai` cho hết trùng. Nếu mục 7 có dòng trùng, Nguyen sửa tay ở màn Danh mục.

---

## 5. Ràng buộc

- Bash sandbox của tôi chết cả phiên ⇒ **tôi không đọc được `bang gia vai.xlsx`, không tạo được `.xlsx`**.
  Mọi thao tác Excel do CLI chạy trên máy Nguyen. Tôi chỉ viết code.
- ⚠️ Tôi **không chạy được `node --check`** — lớp lỗi đã làm sập máy chạy thật ở v8.73.
  → Bước 1 của hướng dẫn: `node --check backend\utils\gia_vai_phukien_excel.js`.
- File này là **CLI độc lập**, không nằm trong luồng web ⇒ lỗi cú pháp **không làm sập pm2**.
  Rủi ro production bằng 0; rủi ro thật nằm ở phần GHI.
- Thư viện có sẵn `xlsx@0.18.5`. Không thêm phụ thuộc.

---

## 6. Thiết kế (đã chốt theo Q1–Q3)

### Đọc file của Nguyen

CLI nhận file có 2 nhóm cột, nhận cả 2 sheet trong 1 file lẫn 2 file riêng:

| Nhóm | Cột khóa | Cột giá | Dò theo tên tiêu đề |
|---|---|---|---|
| Vải | Mã loại vải | Đơn giá | `ma loai`, `ma loai vai`, `maloai` / `don gia`, `gia`, `don gia nhap` |
| Phụ kiện | Mã phụ kiện | Đơn giá | `ma phu kien`, `maphukien`, `ma pk` / như trên |

Tự nhận nhóm bằng cột khóa có mặt. Nếu file có thêm cột **Mã vải** hoặc **Mã cây** thì
**ưu tiên khóa hẹp hơn** (cây > mã vải > mã loại) — để sau này muốn điền chính xác từng cây vẫn dùng
đúng CLI này, không phải viết cái khác.

### Quy tắc ghi — Nguyen đã chốt

| | Quyết định |
|---|---|
| **Q1** Phụ kiện điền vào dòng nhập nào | **MỌI dòng nhập đang trống** của mã đó |
| **Q2** Ghi đè giá đã có | **KHÔNG.** `DonGiaNhap > 0` / `DonGia > 0` ⇒ bỏ qua, đếm riêng, báo trong bảng tổng kết |

Vải: `UPDATE VaiCay SET DonGiaNhap = @gia WHERE VaiID IN (mọi mã vải của mã loại đó) AND ISNULL(DonGiaNhap,0) = 0`
Phụ kiện: `UPDATE PhieuPhuKienChiTiet SET DonGia = @gia WHERE PhuKienID = @id AND ID IN (dòng thuộc phiếu Nhập) AND ISNULL(DonGia,0) = 0`

Không có cờ `--ghi-de`. Muốn sửa giá đã có thì vào màn Nhập kho sửa tay — cố ý làm khó, vì đó là sửa
số liệu đã chốt.

### Bảng xem trước (chế độ mặc định)

```
MA LOAI   TEN LOAI VAI        GIA FILE   SE DIEN  BO QUA(da co gia)  KG
CTT4C     Cotton 4 chieu        85.000       142                 31   3.204,5
...
--------------------------------------------------------------------------
TONG: 1.284 cay se dien / 310 bo qua / 12.450,2 kg
  -> trong do 0 cay thuoc phieu nhap CO NCC  => cong no NCC KHONG doi
  -> hoac: 418 cay thuoc phieu nhap CO NCC   => cong no NCC se TANG 35.530.000 d   🔴

KHONG KHOP (3 dong trong file):
  - "CTT4D": khong co trong danh muc loai vai
  - "VAI01": ma loai nay tro toi 2 loai vai khac nhau -> sua o Danh muc truoc
```

Dòng "công nợ sẽ tăng" **in ngay ở chế độ xem trước**, trước khi ghi — để không ai bấm `--ghi` mà
không biết số đó.

### Câu lệnh

```
node utils/gia_vai_phukien_excel.js "D:\bang gia vai.xlsx"            # xem truoc, KHONG ghi
node utils/gia_vai_phukien_excel.js "D:\bang gia vai.xlsx" --ghi      # ghi that (backup + transaction)
node utils/gia_vai_phukien_excel.js "D:\bang gia vai.xlsx" --sheet "Vai"
node utils/gia_vai_phukien_excel.js --xuat-mau "D:\mau_dien_gia.xlsx" # sinh file mau neu can
```

---

## 7. Kế hoạch

| # | Việc | Phụ thuộc | Ai làm |
|---|---|---|---|
| 1 | Chạy `database/kiem_tra_gia_thieu.sql` | — | **Nguyen** ← đang ở đây |
| 2 | Gửi tôi kết quả mục 4 / 4b / 4c (công nợ) + mục 7 / 9 (khóa trùng) | 1 | Nguyen |
| 3 | Viết CLI | 2 | tôi |
| 4 | `node --check` + chạy xem trước, gửi tôi console | 3 | Nguyen |
| 5 | 🔴 Chạy `--ghi` | 4 + **"proceed" riêng** | Nguyen |
| 6 | Chạy lại bước 1 đối chiếu | 5 | Nguyen |

**Bước 5 KHÔNG hoàn tác được bằng giao diện** (chỉ hoàn tác bằng file backup JSON + SQL viết tay).
Duyệt PRD này **không** phải duyệt bước 5 — tôi sẽ hỏi lại riêng khi tới đó.

---

## 8. Còn mở

**Chỉ còn một câu, và nó là số liệu chứ không phải quyết định:** mục 4 của SQL trả về gì?

- Nếu **chỉ có dòng "KHÔNG có NCC"** → giả định của Nguyen ở Q4 đúng trên thực tế, điền giá không đụng
  công nợ, làm tiếp bình thường.
- Nếu **có dòng "CÓ NCC"** → công nợ phải trả sẽ tăng đúng `Σ(KGNhap × giá điền)` cho các NCC ở mục 4b.
  Lúc đó cần Nguyen quyết thêm: điền hết, hay **chỉ điền nhóm không có NCC** (CLI thêm cờ `--bo-qua-co-ncc`).

Đã trả lời: Q1 = mọi dòng · Q2 = không ghi đè · Q3 = mã loại vải + giá / mã phụ kiện + giá.
