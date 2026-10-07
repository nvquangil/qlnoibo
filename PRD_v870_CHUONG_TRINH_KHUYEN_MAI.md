# PRD — CHƯƠNG TRÌNH KHUYẾN MÃI (dự kiến v8.70)

**Trạng thái:** ĐÃ DUYỆT — code xong v8.70 + v8.70.1 + v8.70.2, **chưa chạy migration, chưa test**.
**Ngày:** 2026-10-06 · **Người yêu cầu:** Nguyen

---

## Bổ sung sau khi duyệt

### v8.70.1 — Bảng chọn mã hàng (Nguyen yêu cầu thêm)
> "Mã hàng tham gia khi click vào sổ list hàng hóa còn tồn trong kho. Có lọc theo danh mục thẻ kho, loại hàng, chọn từng mã hoặc chọn tất cả."

- Route mới `GET /api/khuyenmai/chon-ma-hang` — chỉ mã có `TongTon > 0`, kèm **Danh mục thẻ kho** và **Loại hàng**.
- Modal chọn: 2 ô lọc + ô tìm, checkbox từng dòng, nút **Chọn tất cả / Bỏ chọn** chỉ áp cho **dòng đang hiện sau bộ lọc**.
- ⚠️ Đã sửa một lỗi thứ tự route: `GET /:id` khai trước nên nuốt cả `/chon-ma-hang`. Mọi route GET chữ cố định nay nằm **trên** `/:id` (cuối file).

### v8.70.2 — Lỗ hổng: khuyến mãi không bao giờ được áp ở màn lập phiếu
Backend chỉ lấy %KM khi ô `%CK shop` gửi lên **trống**, nhưng form Lập phiếu bán hàng **luôn gửi một con số** (mặc định = CK dùng chung). Hệ quả nếu không sửa: chương trình khuyến mãi khai xong vẫn bán 33%, `ChuongTrinhID` luôn NULL, người lập phiếu không hề thấy có khuyến mãi.

Đã sửa:

| Nơi | Thay đổi |
|---|---|
| `GET /api/khuyenmai/ap-dung?ngay=` | Route mới, trả map %KM theo **ngày**. Không gắn `requireChucNang('khuyenmai')` — người lập phiếu phải đọc được giá dù không có quyền khai chương trình. |
| Form lập phiếu bán hàng | Điền sẵn %CK theo chương trình; nhãn 🎁 dưới ô %CK; **đổi ngày bán → nạp lại** bảng KM của ngày đó. |
| Gõ tay %CK | Đánh dấu `ckTuTay` ⇒ nhãn tắt, dòng **không** gắn chương trình (đúng ý: cố ý đặt giá khác). |
| Sửa phiếu đã lưu | %CK cũ giữ nguyên (`ckTuTay = true`) — chương trình hiện hành **không** ghi đè phiếu đã phát hành. |
| Excel 1 phiếu + Excel danh sách phiếu | Thêm cột **Chương trình KM**. |
| Màn Đơn khách đặt hàng | Nhãn 🎁 dưới mã hàng; **Phiếu giao hàng in** tính giá sau CK theo %KM (trước đây in giá theo CK dùng chung ⇒ lệch với phiếu bán hàng). |

**Chưa làm:** không có.

> ### ⚠️ Nguyen làm rõ 2026-10-06 — THIẾT KẾ ĐỔI, ĐƠN GIẢN HƠN HẲN
> > "hiện tại đang có Tỷ lệ chiết khấu dùng chung: CK shop (%). trong tạo chương trình khuyến mại thì đánh **tổng phần trăm CK** cho từng mã hàng. Ví dụ đang CK shop là 33% thì khi tạo c.trình khuyến mại đánh **35%**, vậy trong phiếu bán hàng sẽ thể hiện **35%** với những mã hàng được gán. Hết thời gian khuyến mãi trở về tỷ lệ chiết khấu dùng chung."
>
> Tức khuyến mãi **KHÔNG phải một % cộng thêm** — nó **THAY THẾ** `%CKShop` cho các mã được gán, trong khoảng thời gian chương trình.
>
> **Hệ quả:**
> - ⛔ **Câu hỏi chặn Q1 (cộng % hay nhân chồng) KHÔNG CÒN** — không có phép cộng/nhân nào cả, chỉ là thay số.
> - **Công thức tính tiền GIỮ NGUYÊN 100%**, không đụng một dòng nào: `GiaBan = GiaBanLe − GiaBanLe × %CKShop/100`. Chương trình chỉ quyết định `%CKShop` của dòng đó là **33** hay **35**.
> - Chỉ cần **MỘT cột mới** trên `PhieuBanHangChiTiet` (`ChuongTrinhID`) để in ra tên chương trình. **Không cần cột `PhanTramKM`** — con số đã nằm sẵn ở `PhanTramCKShop` vốn đang được lưu theo từng dòng.
> - "Hết thời gian trở về tỷ lệ dùng chung" là **tự nhiên**, không phải viết thêm gì: hết hạn thì không tra ra chương trình nào, `%CKShop` lấy từ `CauHinhHeThong` như cũ.
>
> Xem mục 4 đã viết lại theo thiết kế này.

---

## 1. Yêu cầu

> "Thẻ kho hàng hóa, tạo thêm chức năng chương trình khuyến mại. Tạo chương trình khuyến mãi thời gian bắt đầu và thời gian kết thúc. Chọn hàng hóa tham gia chương trình, phần trăm khuyến mãi theo giá bán lẻ (phần trăm này ngoài phần trăm CK cố định). Trên phiếu bán hàng thể hiện hàng khuyến mại theo chương trình nào."

## 2. Hiện trạng — chuỗi tính giá đang chạy

Lấy nguyên văn từ `backend/routes/banhang.js` (đầu file):

```
Dòng:   GiaBan       = GiaBanLe − GiaBanLe × %CKShop/100
        ThanhTien    = GiaBan × SoLuongCai
Phiếu:  TongTienHang = SUM(ThanhTien)
        TienCKNPP    = TongTienHang × %CKNPP/100
        TienTruocVAT = TongTienHang − TienCKNPP
        TienVAT      = TienTruocVAT × %VAT/100
        TongThanhToan= TienTruocVAT + TienVAT     ← số vào công nợ khách hàng
```

Có **HAI** chiết khấu cố định, ở hai cấp khác nhau:

| | Tên | Cấp | Nguồn |
|---|---|---|---|
| 1 | **CK Shop** | từng DÒNG | `CauHinhHeThong.CK_SHOP` (mặc định 33), lưu lại vào `PhieuBanHangChiTiet.PhanTramCKShop` |
| 2 | **CK NPP** | cả PHIẾU | `CauHinhHeThong.CK_NPP` (mặc định 17) |

⚠️ `PhanTramCKShop` được **lưu lại trên từng dòng phiếu**, không đọc lại từ cấu hình. Đây là tiền lệ đúng và PRD này đi theo: phiếu đã lập giữ nguyên con số lúc lập, đổi cấu hình/chương trình về sau **không làm thay đổi phiếu cũ**.

## 3. Tiêu chí hoàn thành

1. Khai được chương trình KM: tên, ngày bắt đầu, ngày kết thúc, danh sách mã hàng tham gia, %KM.
2. Lập phiếu bán hàng trong thời gian chương trình → dòng hàng tham gia **tự động** có %KM.
3. Phiếu (màn hình + bản in + Excel) ghi rõ dòng nào thuộc **chương trình nào**.
4. Phiếu đã lập **không đổi** khi sửa/xóa/hết hạn chương trình.
5. Phiếu của hàng **không** tham gia chương trình ra **đúng từng con số như trước**.

## 4. Thiết kế

### 4.1 Hai bảng mới

```
ChuongTrinhKhuyenMai
  ID, TenChuongTrinh NVARCHAR(200), TuNgay DATE, DenNgay DATE,
  PhanTramCK DECIMAL(5,2),          -- TỔNG %CK áp cho mã trong chương trình (vd 35)
  GhiChu, TrangThai NVARCHAR(20),   -- 'Hoạt động' / 'Tạm dừng'
  CreatedAt, NguoiTaoID

ChuongTrinhKhuyenMaiChiTiet
  ID, ChuongTrinhID (FK, ON DELETE CASCADE),
  MaHangID (FK TheKhoHangHoa),
  PhanTramCK DECIMAL(5,2) NULL      -- NULL = dùng % của chương trình
  UNIQUE (ChuongTrinhID, MaHangID)
```

⚠️ Tên cột là **`PhanTramCK`** chứ không phải `PhanTramKM` — đây là **TỔNG %CK thay thế**, không phải phần cộng thêm. Đặt tên sai là người sửa sau cộng nhầm nó vào `%CKShop`.

`PhanTramCK` để ở **cả hai cấp**: khai một lần cho cả chương trình, mã nào đặc biệt thì đè riêng. Không có nó thì mỗi mức % phải tạo một chương trình riêng.

### 4.2 MỘT cột mới trên dòng phiếu bán hàng

```
PhieuBanHangChiTiet
  + ChuongTrinhID  INT NULL  (FK ChuongTrinhKhuyenMai, NO ACTION)
```

**Chỉ một cột, và chỉ để HIỂN THỊ tên chương trình.** Con số %CK thật đã nằm sẵn ở `PhanTramCKShop` — cột đó vốn được lưu theo từng dòng từ trước, nên:

- Phiếu đã lập **giữ nguyên %** dù chương trình bị sửa, tạm dừng hay xóa về sau.
- `ChuongTrinhID = NULL` = dòng bán theo CK dùng chung → **mọi phiếu cũ không đổi một con số nào**.
- Hết hạn chương trình thì không tra ra gì, `%CKShop` quay về `CauHinhHeThong` — **không phải viết thêm code nào** cho vế "trở về tỷ lệ dùng chung".

⚠️ Khoá ngoại để **NO ACTION**: xóa một chương trình đã có phiếu dùng sẽ bị chặn. Tầng ứng dụng phải kiểm trước và báo bằng tiếng người, không để SQL Server ném tên khoá ngoại ra màn hình (bài học v8.55).

⚠️ Khoá ngoại để **NO ACTION**: xóa một chương trình đã có phiếu dùng sẽ bị chặn. Tầng ứng dụng phải kiểm trước và báo bằng tiếng người, không để SQL Server ném tên khoá ngoại ra màn hình (bài học v8.55).

### 4.3 Màn hình

Tab mới **"Chương trình khuyến mãi"** trong phân hệ **Thẻ kho hàng hóa** (cạnh `baogiaaloha`, `taikhoankhach`).
Danh sách chương trình → mở ra form: thông tin chung + bảng mã hàng tham gia (gõ tìm để thêm, %KM riêng từng dòng để trống thì theo chương trình).

### 4.4 Áp giá khi lập phiếu

Khi chọn mã hàng vào phiếu, backend tra chương trình **đang hiệu lực theo ngày của phiếu** (`NgayBan`, không phải ngày hôm nay — lập phiếu lùi ngày phải ra đúng giá của ngày đó) và điền sẵn %KM + tên chương trình. Người lập vẫn sửa tay được.

---

## 5. Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Hiểu sai cách cộng %KM với %CK → **sai tiền mọi phiếu** | **Cao** | Q1 — chặn, phải trả lời trước |
| Một mã nằm trong 2 chương trình cùng lúc | Cao | Q2 |
| Sửa chương trình làm đổi phiếu cũ | Cao | Đã chặn bằng thiết kế: lưu `PhanTramKM` trên dòng phiếu |
| Lập phiếu lùi ngày lấy nhầm chương trình | Trung bình | Tra theo `NgayBan` của phiếu, không theo ngày hệ thống |

---

## 6. Câu hỏi mở

### ~~Q1. %KM cộng hay nhân chồng?~~ — ĐÃ GIẢI QUYẾT
Không cộng, không nhân. Chương trình **thay thế** `%CKShop`. Xem khối làm rõ ở đầu file.

### Q2. Một mã nằm trong 2 chương trình còn hiệu lực cùng lúc thì lấy cái nào?
**Đề xuất: lấy %CK CAO NHẤT** (có lợi cho khách), **đồng thời cảnh báo ngay lúc khai** nếu mã đó đã nằm trong chương trình khác có thời gian chồng lấn. Cảnh báo chứ không chặn — có thể có lý do nghiệp vụ. Làm vậy thì dù chọn quy tắc nào, người khai cũng nhìn thấy trước.

### Q3. Áp cho **mọi khách**, hay chỉ nhóm Shop?
**Đề xuất: mọi khách.** Nếu chỉ Shop thì thêm một bộ lọc sau, không phải làm lại.

### Q4. Có áp cho **Đơn khách đặt hàng** không? — *câu duy nhất tôi chưa dám mặc định*
Đơn khách đặt là bước giữ hàng **trước** khi lập phiếu. Nếu đơn vẫn hiện 33% mà phiếu ra 35% thì khách thắc mắc. Nhưng tôi **chưa kiểm** đơn khách đặt có lưu %CK theo dòng hay không — phải đọc code trước, không đoán.

### Q5. CK NPP cấp phiếu
`TienCKNPP = TongTienHang × %CKNPP`. %CK Shop cao hơn làm `TongTienHang` nhỏ đi, nên **tiền CK NPP cũng nhỏ theo** — hệ quả tự nhiên của công thức sẵn có, để nguyên.

---

## 7b. ĐÃ LÀM (2026-10-06, Nguyen duyệt)

| | Việc | File |
|---|---|---|
| ✅ | Migration: 2 bảng + 1 cột `PhieuBanHangChiTiet.ChuongTrinhID` | `database/migration_v870.sql` + `kiem_tra_v870.sql` |
| ✅ | **Một bản công thức duy nhất** tra "%CK của mã X ngày Y" + kiểm trùng chồng thời gian | `backend/utils/khuyenMai.js` |
| ✅ | CRUD chương trình, chặn xóa khi đã có phiếu dùng | `backend/routes/khuyenmai.js` + đăng ký ở `server.js` |
| ✅ | Áp %CK khi lập phiếu (theo **NgayBan**, không phải hôm nay) + lưu `ChuongTrinhID` | `backend/routes/banhang.js` |
| ✅ | Màn Đơn khách đặt hàng: tra sống, trả `khuyenMai` map | `backend/routes/khohang.js` |
| ✅ | Tab "Chương trình khuyến mãi" + form khai | `frontend/js/module.khohang.js` |
| ✅ | Phiếu bán hàng: dưới % CK ghi **🎁 tên chương trình** | `frontend/js/module.khohang.js` |

**Thứ tự ưu tiên %CK của một dòng phiếu — 3 bậc, không được đổi:**
1. Số người lập **gõ tay** trên form
2. %CK của **chương trình** đang hiệu lực cho mã đó (nhiều chương trình → lấy **cao nhất**)
3. **CK dùng chung** ở `CauHinhHeThong`

`ChuongTrinhID` chỉ gán khi dòng **thực sự** bán theo %CK của chương trình — người lập gõ đè số khác thì không gán, vì lúc đó không còn là bán theo chương trình nữa.

**CÒN LẠI (chưa làm):** hiện nhãn khuyến mãi trên **màn Đơn khách đặt hàng phía frontend** (backend đã trả `khuyenMai`), và **bản in + Excel** phiếu bán hàng.

---

## 7. Thứ tự làm (sau khi duyệt)

1. `migration_v870.sql` — 2 bảng mới + 2 cột trên `PhieuBanHangChiTiet`.
2. Backend CRUD chương trình (chặn xóa khi đã có phiếu dùng).
3. Tab "Chương trình khuyến mãi" trong Thẻ kho hàng hóa.
4. Áp %KM khi lập phiếu bán hàng (theo `NgayBan`) + lưu `ChuongTrinhID` / `PhanTramKM`.
5. Hiện tên chương trình trên màn phiếu + **bản in** + **Excel**.
6. **Kiểm chứng:** lập một phiếu hàng KHÔNG khuyến mãi, so từng con số với trước nâng cấp — `TongTienHang`, `TienCKNPP`, `TienVAT`, `TongThanhToan`, và số vào **công nợ khách hàng**. Lệch một số là dừng.
