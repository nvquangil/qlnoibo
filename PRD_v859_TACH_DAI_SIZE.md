# PRD — TÁCH DẢI SIZE TRONG MỘT LỆNH SẢN XUẤT (dự kiến v8.59)

**Trạng thái:** CHỜ DUYỆT — chưa viết dòng code nào. 4 câu hỏi mở ở mục 6 **ĐÃ CHỐT**, còn 2 câu phát sinh ở mục 6b.
**Ngày:** 2026-10-01 · **Người yêu cầu:** Nguyen

> ### Đã chốt 2026-10-01
> 1. **Ngưỡng hiện nút tách:** hệ số **> 6**, không chặn cứng.
> 2. **Công đoạn nhập theo dải:** **May + QC + Giao gia công + Đóng gói + Kho nhập.** (Phương án (b) — nặng hơn (a), kéo theo mục 6b dưới đây.)
> 3. **Số dải:** **N dải**, không khoá 2.
> 4. **Thẻ kho:** **mỗi dải một mã hàng** → bắt buộc sửa 3 chỗ ở mục 4.5.

---

## 1. Vấn đề

Một lệnh sản xuất cắt chung một sơ đồ gồm nhiều size, nhưng **đóng gói và nhập kho lại tách theo dải size**.

Ví dụ thật: hệ số sổ cắt = **11** → mỗi lớp cắt ra 11 cái = **dải 2-7 (6 cái) + dải 8-12 (5 cái)**. Xưởng gói và nhập kho hai dải này **riêng**, nhưng hệ thống chỉ ghi tiến độ theo **MÀU**, không có chiều size, nên không tách được.

Hiện trạng đã rà toàn repo — không có chiều size nào truy vấn được:

| Nơi | Chiều đang có |
|---|---|
| `TienDoChiTietMau` (tiến độ mọi công đoạn) | chỉ Màu |
| `TheKhoHangHoa` / `TheKhoChiTietMau` | chỉ Màu |
| `PhieuNhapKhoHangChiTiet` | Mã hàng × Màu |
| `DonHangChiTietSoDo` (sơ đồ) | không có size |
| `DonHangSanXuat.Size` | chuỗi tự do `"9M - 4Y"`, chỉ để in |
| `BangKeBanThanhPham` | có lưới size nhưng lưu **JSON**, không JOIN/SUM được |

Dải size hiện chỉ sống dưới dạng **một con số đếm ngầm**: `HeSoQuyDoi` = số cái trong 1 ri = số size trong 1 ri.

---

## 2. Tiêu chí hoàn thành

1. Lệnh có hệ số lớn khai báo được **N dải size**, mỗi dải có **tên** và **hệ số** riêng.
2. **Bất biến bắt buộc: tổng hệ số các dải = hệ số của lệnh.** (6 + 5 = 11). Hệ thống chặn lưu nếu lệch.
3. Các công đoạn sau Cắt nhập liệu **theo từng dải**, quy đổi Ri → cái bằng **hệ số của dải đó**.
4. Lệnh **không tách** chạy y hệt hôm nay, không đổi một con số nào.
5. Dữ liệu cũ giữ nguyên, không backfill.

## 3. Ngoài phạm vi

- Danh mục size dùng chung toàn hệ thống (bảng `Size` chuẩn). Ở đây dải size **thuộc về từng lệnh**, không phải danh mục chung.
- Tách size ở công đoạn **Cắt** — cắt vẫn ghi theo lớp/cây như hiện nay, một lớp ra đủ cả N dải.
- Sửa `BangKeBanThanhPham` (vẫn là phiếu in JSON, không đụng).

---

## 4. Thiết kế

### 4.1 Bảng mới `DonHangDaiSize`

```
ID          INT IDENTITY PK
DonHangID   INT NOT NULL  FK -> DonHangSanXuat
TenDai      NVARCHAR(100) NOT NULL   -- "2-7", "8-12", "13-17"
HeSo        INT NOT NULL             -- số cái trong 1 ri CỦA DẢI NÀY
ThuTu       INT NULL
CreatedAt   DATETIME2 DEFAULT SYSDATETIME()
```
Không có dòng nào = lệnh **không tách** (mặc định, như hiện nay).

### 4.2 `TienDoChiTietMau` thêm cột

```
DaiSizeID   INT NULL  FK -> DonHangDaiSize(ID)
```
- `NULL` = dòng của lệnh không tách, **hoặc** dòng cũ trước bản này → mọi truy vấn hiện có vẫn đúng.
- Khác NULL = dòng thuộc đúng một dải.

> Chọn **thêm cột** chứ không tạo bảng tiến độ riêng: mọi hàm đang cộng `SUM(SoLuongLuyKe)` (lương, báo cáo năng suất, giá thành, đối chiếu) **tự đúng không cần sửa** — tách dải chỉ làm nhiều dòng hơn, tổng không đổi.

### 4.3 Khai báo dải — đặt ở đâu

Nút **"Tách dải size"** trong form **Ghi nhận tiến độ công đoạn Cắt**, hiện khi hệ số của lệnh **> 6** (ngưỡng — xem câu hỏi mở Q1).

Form tách:

| Tên dải | Hệ số |
|---|---|
| 2-7 | 6 |
| 8-12 | 5 |
| | **Tổng: 11 / 11 ✓** |

- Dòng tổng tính sống, **nút Lưu khoá** cho tới khi tổng = hệ số lệnh.
- Sửa/xoá dải **sau khi đã có tiến độ** → chặn, báo rõ dải nào đang vướng và ở công đoạn nào. *(Đúng bài học v8.55: FK `PhanCongMay` chặn DELETE, phải kiểm trước và báo bằng tiếng người, không để SQL Server ném tên khoá ngoại ra màn hình.)*

### 4.4 Các công đoạn sau

Form Ghi tiến độ của **Đóng gói** và **Kho nhập** (xem Q2 về May/QC): nếu lệnh **có** dải thì mỗi màu nở thành **N dòng, một dòng một dải**:

```
Màu Đỏ · dải 2-7   | Ri [__] | SL lẻ [__] | Tổng (cái) 0 | ...
   1 ri = 6 cái · Cắt 18 lớp = 18 ri
Màu Đỏ · dải 8-12  | Ri [__] | SL lẻ [__] | Tổng (cái) 0 | ...
   1 ri = 5 cái · Cắt 18 lớp = 18 ri
```

- `soLuongRiLe()` đổi từ hệ số **của lệnh** sang hệ số **của dải**. Hàm này đã gom về một chỗ ở v8.49 nên chỉ sửa một nơi.
- Cột đối chiếu **SL từ Cắt theo dải** = `TongSoLop × HeSoDai` (18 × 6 = 108 cái cho dải 2-7). Số lớp dùng chung cho mọi dải vì một lớp ra đủ cả N dải.
- Lệnh **không** tách: form giữ nguyên hình dạng hôm nay.

### 4.5 Thẻ kho / nhập kho

Mỗi dải nên là **một mã hàng** riêng (`LoaiRi` = hệ số dải) để tồn kho, bán hàng, báo cáo tự đúng theo dải.

⚠️ **Ba chỗ đang giả định "1 lệnh = 1 thẻ kho", phải sửa, nếu không báo cáo thiếu số mà KHÔNG báo lỗi:**

| File:dòng | Hiện tại | Hệ quả nếu để nguyên |
|---|---|---|
| `backend/routes/khohang.js:72` | `NOT EXISTS (... TheKhoHangHoa h WHERE h.DonHangID = d.DonHangID)` | **Chặn** tạo mã hàng thứ 2 cho cùng lệnh |
| `backend/routes/qlsx.js:383` | `SELECT TOP 1 ... FROM TheKhoHangHoa WHERE DonHangID=@id` | Lấy bừa ĐVT của một mã |
| `backend/routes/qlsx.js:4189` | `...recordset[0]` | Báo cáo năng suất chỉ cộng tồn **mã đầu tiên** |

---

## 5. Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Sửa hệ số lệnh sau khi đã tách → tổng dải không còn khớp | Cao | Chặn sửa hệ số khi lệnh đã có dải, hoặc bắt khai lại dải |
| Lương khoán may đổi nếu May cũng tách dải | Cao | Xem Q2 — nếu May **không** tách thì lương không đổi |
| Tách dải rồi mới phát hiện khai sai tên/hệ số | Trung bình | Cho sửa khi **chưa** có tiến độ; có rồi thì chặn kèm thông báo rõ |
| 3 chỗ "1 lệnh 1 thẻ kho" bỏ sót | Cao | Đã liệt kê ở 4.5, phải sửa cùng đợt |

---

## 6. Câu hỏi mở — cần trả lời trước khi code

**Q1. Ngưỡng hiện nút "Tách dải size".** Nguyen nói *"lớn hơn 5 hoặc 6"*. Đề xuất: hiện nút khi hệ số **> 6**, nhưng **không chặn cứng** — ai muốn tách ở hệ số nhỏ hơn vẫn tách được. Đồng ý?

**Q2. Công đoạn nào nhập theo dải?** Nguyen nói *"từ các công đoạn sau"*.
- (a) **Chỉ Đóng gói + Kho nhập** — khớp đúng mô tả ban đầu, **lương khoán may không đổi**. ← đề xuất
- (b) Cả **May + QC + Đóng gói + Kho nhập** — chi tiết hơn nhưng **lương khoán may tính theo dải**, phải sửa `loadLuongKhoanMay` và đổi cách giao việc.

**Q3. Số dải tối đa?** Thiết kế cho **N dải** (không khoá 2). Xác nhận có lệnh nào cần 3 dải trở lên không?

**Q4. Mỗi dải một mã hàng thẻ kho — đúng ý không?** Nếu Nguyen muốn giữ **một** mã hàng cho cả lệnh thì tồn kho sẽ không tách được theo dải, và mục 4.5 bỏ đi.

---

## 6b. PHÁT SINH TỪ CÂU TRẢ LỜI Q2 — cần chốt, vì nó QUYẾT ĐỊNH SCHEMA

Chọn (b) kéo chiều dải size vào hai bảng **đang nuôi số tiền**. Hai câu dưới đây quyết định migration viết thế nào, nên phải trả lời trước bước 1.

> **ĐÃ CHỐT 2026-10-01: Q5 = TÁCH · Q6 = TÁCH.** Cả hai chọn phương án (b).
> `PhanCongMay.DaiSizeID` và `DonHangNhaInTheu.DaiSizeID` đều có trong `migration_v859.sql`.
> ⚠️ **Còn một câu CHƯA trả lời** — xem Q7 ở cuối mục này.

### Q5. Giao việc may cho công nhân có tách theo dải không?

`PhanCongMay(TienDoID, NhanVienID, DonGiaCongDoanMayID, SoLuong)` gắn vào **bản ghi tiến độ**, không gắn vào dòng màu. Nên dù tiến độ May đã tách dải, phần giao việc **chưa tự tách theo**.

- **(a) KHÔNG tách giao việc** ← **đề xuất.** Đơn giá công đoạn may tính theo *công đoạn* (tra khóa, vắt sổ…), **không đổi theo size**, nên tách dải không làm đổi một đồng lương nào. `loadLuongKhoanMay` giữ nguyên, rủi ro gần bằng không.
- (b) Tách giao việc theo dải → thêm `PhanCongMay.DaiSizeID`, sửa form giao việc + `loadLuongKhoanMay`. **Chỉ đáng làm nếu công nhân may dải lớn được trả khác dải nhỏ.**

### Q6. In thêu có tách theo dải không?

Nguyen liệt kê *"May + QC, giao gia công"* — **không** nhắc in thêu.

- **(a) KHÔNG tách in thêu** ← **đề xuất**, đúng phạm vi Nguyen nêu. `DonHangNhaInTheu` giữ nguyên.
- (b) Tách luôn cho đồng bộ → thêm `DonHangNhaInTheu.DaiSizeID`.

### Hệ quả đã biết của Q2 = (b), dù Q5/Q6 chọn gì

| Ảnh hưởng | Chi tiết |
|---|---|
| `DonHangChiTietNhaGiaCong` thêm `DaiSizeID NULL` | Giao/nhận gia công tách được theo dải |
| **Lương GC & Sổ công nợ nhà gia công** | Dùng chung `utils/luongGiaCongInThe.js` (cố ý từ v7.53). Tách dải chỉ làm **nhiều dòng hơn**, `SUM(SoLuongNhan × đơn giá)` **không đổi** → tiền không nhảy. Nhưng **dòng trong sổ công nợ sẽ tách ra**, người đọc sổ sẽ thấy khác. |
| Đơn giá hạng mục gia công | Vẫn theo **hạng mục**, không theo dải — xem Q7 |
| Form Giao gia công | Mỗi nhà × hạng mục nở thành N dòng theo dải |

### Q7. ĐƠN GIÁ có khác nhau giữa các dải size không? — **CHƯA TRẢ LỜI**

Đã hỏi 2026-10-01, chưa có câu trả lời. Thiết kế hiện tại giả định **KHÔNG**:

- Đơn giá **công đoạn may** theo *công đoạn* (tra khóa, vắt sổ…) — `DonHangDonGiaCongDoanMay`
- Đơn giá **gia công** theo *hạng mục* — `DonHangHangMucGiaCong` / `HangMucGiaCong.DonGiaMacDinh`
- Đơn giá **in thêu** theo *hạng mục in thêu* — `DonHangDonGiaInThe`

Nhờ giả định này, tách dải **không làm đổi một đồng nào** — chỉ nhiều dòng hơn, tổng giữ nguyên.

**Nếu thực tế đơn giá CÓ khác theo dải** (may/gia công dải lớn đắt hơn dải nhỏ) thì ba bảng đơn giá trên phải thêm chiều dải — việc này **cộng thêm vào phạm vi**, và lúc đó tiền **sẽ** đổi. Chưa làm gì cho tình huống này. Thiết kế hiện tại vẫn mở đường: thêm `DaiSizeID` vào bảng đơn giá là thay đổi *cộng thêm*, không phải làm lại.

---

## 7. Thứ tự làm — TIẾN ĐỘ

- [x] **Bước 1 — `migration_v859.sql`.** Nguyen đã chạy 2026-10-01, xác nhận đủ bảng + 4 cột. *(Còn nợ: gộp vào `CAI_DAT_DAY_DU.sql`.)*
- [x] **Bước 2 — Backend CRUD dải.** `GET/PUT /orders/:maDH/daisize` + `daiSizeList` trong `GET /orders/:maDH`. Lưu theo **diff giữ nguyên ID**; chặn xoá dải đang có tiến độ kèm thông báo tiếng người; **backend chặn thật** điều kiện tổng hệ số = hệ số lệnh.
- [x] **Bước 2b — `migration_v860.sql`: đơn giá KHÁC theo dải.** Nguyen xác nhận 2026-10-01 đơn giá khác theo dải → thêm `DaiSizeID` vào `DonHangDonGiaCongDoanMay`, `DonHangHangMucGiaCong`, `DonHangDonGiaInThe`. Đã chạy, 8 dòng OK, mọi đếm = 0.
- [x] **Bước 3 — Form tách dải ở công đoạn Cắt.** `renderDaiSizeBar()` + `openTachDaiSizeModal()`. Tổng hệ số tính sống, nút Lưu khoá tới khi khớp hệ số lệnh.
- [x] **Bước 4 — May/QC/Đóng gói/Kho nhập nở dòng theo dải.** Backend: ghi `TienDoChiTietMau.DaiSizeID`, thêm `getStageQtyByColorDai()` (khoá `MauSacID|DaiSizeID`) + trả `slTheoMauDai`. Frontend: `dongNhapList()` / `heSoCuaDong()` / `slCatCuaDong()` / `daNhapCuaDong()` dùng chung cho cả 4 công đoạn; mọi selector khoá theo **màu + dải**.
- [x] **Bước 5a — Giao gia công theo dải.** Ô chọn dải ở form giao (bắt buộc khi lệnh đã tách), cột "Dải size" ở bảng đã giao, backend ghi/đọc `DonHangChiTietNhaGiaCong.DaiSizeID`, **`loadGiaCong()` tra đơn giá theo dải** (khớp dải → dòng NULL → không có giá).
- [x] **Bước 5b — Màn khai đơn giá giao gia công theo dải.** Cột "Dải size" trong editor (`Mọi dải` = dòng chung), backend GET trả `daiSizeList` + `DaiSizeID`, POST ghi `DaiSizeID`; **khoá chống trùng đổi từ `hạng mục` sang `hạng mục + dải`** — giữ khoá cũ là dòng dải thứ hai bị loại âm thầm.
- [ ] Bước 5c — Giao in thêu theo dải + `loadInThe()` tra giá theo dải
- [ ] Bước 5d — Đơn giá **công đoạn may** theo dải + form giao việc may chọn đúng dòng
- [x] ~~Bước 6 — Gỡ chặn thẻ kho~~ **BỎ** (Nguyen 2026-10-01): nhập kho có thể nhập bổ sung vào cùng lệnh, mã hàng tự tạo tay nên không cần nới ràng buộc "1 lệnh 1 thẻ kho".
- [ ] Bước 7 — Kiểm chứng lệnh không tách: từng con số phải y hệt trước

### Chi tiết các bước

1. `migration_v859.sql` — bảng `DonHangDaiSize`; cột `DaiSizeID NULL` cho `TienDoChiTietMau` **và `DonHangChiTietNhaGiaCong`** (+ `PhanCongMay` / `DonHangNhaInTheu` nếu Q5/Q6 chọn (b)). Gộp vào `CAI_DAT_DAY_DU.sql`.
2. Backend: CRUD dải (chặn xoá khi đã có tiến độ) + trả `daiSizeList` trong `GET /orders/:maDH`.
3. Frontend: form tách dải ở công đoạn Cắt — tổng hệ số phải khớp hệ số lệnh mới cho Lưu.
4. Frontend: **May, QC, Đóng gói, Kho nhập** nở dòng theo dải; `soLuongRiLe()` dùng hệ số **của dải**.
5. Frontend + backend: form **Giao gia công** nở dòng theo dải.
6. Gỡ chặn thẻ kho (`khohang.js:72`) + sửa `qlsx.js:383` và `qlsx.js:4189`.
7. **Kiểm chứng bắt buộc:** chọn một lệnh **không tách** đã có số liệu, so **từng con số** trước/sau nâng cấp — lương khoán may, lương GC, công nợ nhà gia công, báo cáo năng suất, giá thành. Lệch một số nào là dừng, không deploy.
