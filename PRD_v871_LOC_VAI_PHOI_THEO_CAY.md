# PRD — v8.71: SL từ Cắt đang cộng cả vải phối

**Trạng thái:** CHỜ DUYỆT — chưa viết dòng code nào. **Mọi giả định đã xác minh bằng dữ liệu 2026-10-07.**
**Ngày:** 2026-10-07 · **Người báo:** Nguyen · **Lệnh phát hiện:** DH2608064

> ### ✅ Xác minh 2026-10-07 — nguyên nhân đã rõ, không ai khai nhầm
>
> Đơn DH2608064 có **3 phiếu xuất vải**: 11147 (29/08), 11151 (31/08), **11183 (10/09)**.
> Phiếu 11183 có 5 dòng, **tất cả đều `Phối`**, mã vải tiền tố **`BO2DA`** = vải **bo** (bo cổ, bo tay):
> `BO2DA-NAU34`, `BO2DA-REU165`, `BO2DA-TIMTHAN135`, `BO2DA-KEM11`, `BO2DA-XANH142`.
>
> Ba cây của bàn cắt 15/09 chính là vải bo đó:
>
> | CayID | Mã cây | Màu | Phiếu | Kiểu |
> |---|---|---|---|---|
> | 13443 | BO2DA-NAU34040926001 | Nâu 34 | 11183 | Phối |
> | 13496 | BO2DA-TIMTHAN13509… | Tím Than 135 | 11183 | Phối |
> | 13499 | BO2DA-REU165090926… | Rêu 165 | 11183 | Phối |
>
> **Dữ liệu đúng hoàn toàn. `KieuVai` khai chuẩn ở cả 3 phiếu.** Lỗi nằm ở phần mềm.
>
> #### 🔴 CƠ CHẾ GÂY LỖI — ghi nhớ, đây là mấu chốt
>
> `2DA-NAU34` (vải thân) và `BO2DA-NAU34` (vải bo) **dùng chung một `MauSacID` = 7456**.
> `getStageActualQtyByColor` gom theo `MauSacID` ⇒ vải thân và vải bo rơi vào **CÙNG MỘT Ô**.
>
> ⇒ **Mọi cách lọc ở mức MÀU đều bất khả thi.** Loại `MauSacID` 7456 là mất luôn 210 cái hàng thật.
> Bắt buộc lọc ở mức **CÂY** qua `PhieuXuatVaiChiTiet.KieuVai`. Không có đường khác.
>
> Giả định **G3 được xác nhận**: 15/09 là vải phối thật, **600 là số đúng**.
> Giả định **G1 được xác nhận** trên lệnh này: `KieuVai` khai đủ ở cả 3 phiếu, `Khong_Ro = 0`.

---

## 1. Vấn đề

Lệnh DH2608064 cắt **600 cái** vải chính. Mọi công đoạn sau (May, QC, Đóng gói, Kho nhập) hiển thị **2 400**.

| Màu | Từ cây **Chính** | Từ cây **Phối** | Hệ thống tính |
|---|---|---|---|
| Nâu 34 | 210 | 210 | 420 |
| Rêu 165 | 180 | 180 | 360 |
| Tím Than 135 | 210 | 210 | 420 |
| Kem | 0 | 570 | 570 |
| Kem 11 | 0 | 210 | 210 |
| Thiên thanh | 0 | 210 | 210 |
| Xanh 142 | 0 | 210 | 210 |
| **Tổng** | **600** | **1 800** | **2 400** |

Cột "từ cây Chính" cộng lại ra đúng 600. Toàn bộ 1 800 còn lại là **vải phối bị tính thành sản phẩm**.

### Nguyên nhân kỹ thuật

Hai tầng cùng hỏng:

**Tầng ghi** — `routes/qlsx.js`, vòng ghi sổ cắt:

```js
mauTongHop[mauSacId] = (mauTongHop[mauSacId] || 0) + soLuongCai;
```

Cộng **mọi cây** trong bàn cắt vào `TienDoChiTietMau` theo `MauSacID` của cây, **không phân biệt Chính/Phối**. Cây phối cắt ra bo, cổ, túi — không phải thân áo — nhưng vẫn vào như sản phẩm.

**Tầng đọc** — `getStageActualQtyByColor()` / `getStageQtyByColorDai()`:

```sql
MauSacID NOT IN (SELECT MauSacID FROM DonHangChiTietVai
                 WHERE DonHangID=@id AND Kieu = N'Phối' AND MauSacID IS NOT NULL)
```

Từ **v6.43** màu ở Ra lệnh SX gõ tự do ⇒ `MauSacID = NULL`. Điều kiện `IS NOT NULL` gạt sạch mọi dòng Phối ⇒ `NOT IN (tập rỗng)` ⇒ **không loại được gì**.

Comment trong `getCatMauList()` đã ghi đúng lỗi này từ v6.12 và đã vá bằng `PhieuXuatVaiChiTiet.KieuVai`. `getStageActualQtyByColor()` **không được vá theo**.

### Vì sao không copy nguyên bộ lọc của `getCatMauList` sang là xong

`getCatMauList` lọc ở mức **MÀU** — "giữ màu nào có ít nhất một cây KieuVai='Chính'". Với lệnh này, Nâu 34 / Rêu 165 / Tím Than có **cả cây Chính lẫn cây Phối cùng màu**, nên màu đó được giữ và `SUM` vẫn cộng cả hai.

⚠️ Tức **`getCatMauList` cũng đang sai** với lệnh này (ra 1 200 thay vì 600), chỉ đúng với các màu thuần phối (Kem, Thiên thanh, Xanh 142 — bị loại sạch).

Phải lọc ở mức **CÂY**, không phải mức màu.

---

## 2. Phạm vi ảnh hưởng — hẹp hơn dự đoán ban đầu

> ### ⚠️ ĐÍNH CHÍNH 2026-10-07 — TỒN KHO KHÔNG BỊ ẢNH HƯỞNG
> Bản PRD đầu viết *"DELTA cộng vào `TheKhoHangHoa` ⇒ tồn thành phẩm có thể cộng dư"*. **Sai.**
> Tôi tin vào một comment trên `getStageActualQtyByColor` mà không kiểm đường ghi thật.
> **v6.91 đã GỠ BỎ HẲN** khối cộng DELTA vào `TheKhoChiTietMau.NhapCai` (ghi chú v6.91 trong
> `POST /orders/:maDH/tiendo`). Comment kia lỗi thời từ đó — đã sửa lại trong code.
>
> Bài học: mô tả đường ghi phải kiểm bằng **đường ghi**, không đọc comment rồi kết luận.

Chỉ công đoạn **Cắt** sinh `TienDoChiTietMau` **từ cây vải**. May / QC / Đóng gói / Kho nhập người
dùng **gõ tay** số lượng theo màu — không đi qua cây nào, nên số của chúng không chứa vải phối.
Chúng chỉ *hiển thị* sai ở cột đối chiếu "SL tổng từ Cắt".

| Nơi dùng | Có sai không |
|---|---|
| `slCatTheoMau` — "SL tổng từ Cắt" trên form mọi công đoạn | ✅ **Sai** — triệu chứng Nguyen thấy |
| `getCatMauList()` — danh sách màu + `TongSoLop` (hệ số Ri ở Đóng gói) | ✅ **Sai** |
| `getTongSLCatForOrder()` — Giao/Nhận nhà in thêu | ✅ Sai (dùng `getCatMauList`) |
| `getSoCatTheoMau()` ở `khohang.js` — điền sẵn "Số cắt" khi tạo Thẻ kho | ✅ **Sai** — bản sao chép của cùng logic |
| `slTheoMauCongDoan` / `slKhoNhapTheoMau` | ❌ Không — dữ liệu gõ tay |
| `TheKhoHangHoa` / tồn kho | ❌ **Không** — đường ghi đã gỡ từ v6.91 |
| `bangke.js` → `getBTPPrefill()` | ❌ Không — **đã lọc đúng ở mức cây** từ v6.00 |

**Việc còn phải đo:** danh sách màu ở form May/QC lấy từ `getCatMauList` — vốn để lọt màu phối. Nếu
đã có người **gõ số cho màu phối** ở các công đoạn sau thì dữ liệu đó thật sự bẩn, và sau v8.71 các
dòng đó **biến mất khỏi màn hình trong khi số vẫn nằm trong CSDL**. Truy vấn 3 trong
`kiem_tra_v871_do_muc_lech_vai_phoi.sql` đếm đúng việc này.

---

## 3. Tiêu chí hoàn thành

1. DH2608064: "SL tổng từ Cắt" ra **600**, phân bổ Nâu 34 = 210, Rêu 165 = 180, Tím Than 135 = 210; Kem / Kem 11 / Thiên thanh / Xanh 142 **không xuất hiện**.
2. Lệnh **không có vải phối** giữ nguyên con số như trước (không hồi quy).
3. Lệnh cấp vải **không qua phiếu xuất** (không có `KieuVai`) giữ nguyên mọi cây — không được ra 0.
4. Con số ở `getCatMauList` và `getStageActualQtyByColor` **khớp nhau**. Hai luật khác nhau là hai màn hình ra hai số.

---

## 4. Giả định — cần Nguyen xác nhận

| # | Giả định | Tình trạng |
|---|---|---|
| G1 | `PhieuXuatVaiChiTiet.KieuVai` là **nguồn sự thật duy nhất** về cây nào là phối. | ✅ **Xác nhận** trên DH2608064: khai đủ ở cả 3 phiếu, `Khong_Ro = 0`. ⚠️ Vẫn cần **lưới an toàn**: đơn nào không có phiếu xuất nào khai `KieuVai` thì giữ nguyên mọi cây — y như `getCatMauList` đang làm. Không có lưới này thì đơn cấp vải tay sẽ ra SL = 0. |
| G2 | Vải phối **không bao giờ** tính thành sản phẩm — dù cắt ra bao nhiêu lớp. | ⬜ **Nguyen cần xác nhận.** Nếu có ca phối cũng ra thành phẩm thì cách lọc này sai bản chất. |
| G3 | 15/09 cắt Nâu 34 / Rêu 165 / Tím Than từ cây khai `Phối` là **vải phối thật**, không phải khai nhầm. | ✅ **Xác nhận**: đó là vải **bo** (`BO2DA-*`) từ phiếu 11183. **600 là số đúng.** |

Chỉ còn **G2** chờ xác nhận.

---

## 5. Hai hướng sửa

### Hướng B — sửa tầng ĐỌC (đề xuất làm trước)

Tính lại "SL từ Cắt theo màu" từ `TienDoCatChiTietCay` JOIN `PhieuXuatVaiChiTiet`, chỉ lấy cây `KieuVai = N'Chính'`, thay vì đọc `TienDoChiTietMau`.

- ✅ **Dữ liệu cũ tự đúng ngay**, không đụng một dòng dữ liệu nào
- ✅ Không rủi ro mất dữ liệu, rollback = revert code
- ❌ `TienDoChiTietMau` **vẫn chứa số sai** — nơi nào khác đọc thẳng bảng đó vẫn lệch
- ❌ Thêm một JOIN vào đường nóng (mọi lần mở form lệnh SX)

### Hướng A — sửa tầng GHI

Vòng ghi sổ cắt chỉ cộng cây `KieuVai = 'Chính'` vào `TienDoChiTietMau`.

- ✅ Sạch về bản chất, mọi nơi đọc tự đúng, không thêm JOIN
- ❌ **Dữ liệu cũ vẫn sai** — phải backfill `TienDoChiTietMau`
- ❌ Backfill là thao tác **không thể hoàn tác** trên dữ liệu sản xuất

### Khuyến nghị

**B trước, A sau.** B chặn máu ngay với rủi ro gần bằng không. A là việc dọn nền, làm sau khi đã đo được mức độ sai của dữ liệu cũ bằng một truy vấn chỉ-đọc.

Không gộp hai hướng vào một lần deploy: nếu có hồi quy sẽ không biết do cái nào.

---

## 6. Đã làm — hướng B, Nguyen duyệt 2026-10-07

### Ba luật đã chốt

| Luật | Trường hợp | Xử lý |
|---|---|---|
| **L1** | Cây có **ít nhất một** dòng xuất khai `Chính` cho đơn này | **Tính**. Cây xuất nhiều lần, lần đầu `Chính` lần sau `Phối` → vẫn tính (bảo thủ, không làm mất hàng thật). |
| **L2** | Cây **không có** dòng xuất nào cho đơn này (cấp vải tay) | **Vẫn tính**, nhưng đếm vào `soCayChuaRo` để form hiện **cảnh báo cam**. |
| **L3** | Đơn **không có** dòng xuất nào khai `KieuVai` (dữ liệu cũ) | **Giữ nguyên mọi cây** — không lọc gì. |

### Thay đổi theo file

| File | Thay đổi |
|---|---|
| `backend/routes/qlsx.js` | `donCoKhaiKieuVai()` + `dieuKienCayChinh()` + **`slCatTheoMauTuCay()`** — một bản công thức duy nhất. `getStageActualQtyByColor()` rẽ nhánh: **chỉ công đoạn CẮT** dùng đường mới. `getCatMauList()` dùng chung hàm đó, **gỡ hẳn** bản vá mức màu v6.60.1. Câu `TongSoLop` cũng lọc cây y hệt. `GET /orders/:maDH` trả thêm `soCayChuaRoKieu`. Sửa comment sai về DELTA tồn kho. |
| `backend/routes/khohang.js` | `getSoCatTheoMau()` — bản sao chép của cùng logic, nay cũng tính từ cây. **Giữ nguyên** phạm vi "TOP 1 bàn cắt mới nhất" (cố ý, chỉ là gợi ý điền form). |
| `frontend/js/module.qlsx.js` | Cảnh báo cam `canhBaoCayChuaRo` dưới "Tổng SL cắt" (form May) và "Tổng SL bàn cắt" (Giao in thêu). |
| `frontend/index.html` | `module.qlsx.js?v=8.71` |
| `database/kiem_tra_v871_do_muc_lech_vai_phoi.sql` | **Chỉ đọc** — 5 truy vấn đo mức lệch toàn hệ thống. |

⚠️ `getStageQtyByColorDai()` **không đụng** — nó chỉ phục vụ MAY/QC/DG/KN, không dùng cho CẮT.

⚠️ **Không có migration.** Không đổi cấu trúc CSDL.

⚠️ Sửa cả backend lẫn frontend ⇒ copy đủ 4 file, **`pm2 restart qlnoibo`**, rồi **Ctrl+F5**.

### Chưa làm — chờ kết quả đo

| # | Việc | Điều kiện |
|---|---|---|
| 4 | Chạy `kiem_tra_v871_do_muc_lech_vai_phoi.sql`, đọc mức lệch | Nguyen chạy |
| 6 | (Hướng A) sửa tầng ghi + backfill `TienDoChiTietMau` | duyệt riêng sau khi xem kết quả 4 |

---

## 7. Câu hỏi mở

1. ✅ **G2 đã chốt** 2026-10-07: *"không có ca nào vải phối được tính thành sản phẩm"*.
2. Truy vấn 3 — nếu có màu phối đã bị gõ số ở May/QC/Đóng gói thì xử lý thế nào: xóa dòng, hay để nguyên và chấp nhận số trong CSDL không khớp màn hình?

### Rủi ro đã biết, chưa xử lý (ngoài phạm vi v8.71)

`bangke.js` → `getBTPPrefill()` lọc **đúng** ở mức cây, nhưng còn hai điểm khác với v8.71:

- Không có lưới **L3**: đơn không khai `KieuVai` nào → bảng kê **rỗng**.
- Lớp chặn phụ `AND NOT EXISTS (DonHangChiTietVai Kieu='Phối' AND MauSacID = dv.MauSacID)` lọc ở
  **mức màu** — nếu Cấu trúc vải khai rõ một màu là Phối mà màu đó **cũng** có cây chính (vải bo cùng
  màu thân, có khai MauSacID), bảng kê sẽ **mất luôn phần hàng chính** của màu đó.

Chưa ai báo lỗi này, và sửa sẽ làm bảng kê hiện thêm dòng — không đụng khi chưa có yêu cầu. Ghi lại
để lần sau không phải tìm lại.

---

## 8. Ghi chú để không lặp lại

**Một `MauSacID` KHÔNG định danh được một loại vải.** `2DA-NAU34` (thân) và `BO2DA-NAU34` (bo) là hai
mã vải khác nhau, cùng `MauSacID = 7456`. Bất kỳ phép gom/lọc nào theo `MauSacID` đều trộn chúng
làm một.

Đây là lý do thật khiến `getCatMauList` (lọc mức màu, vá v6.60.1) **vẫn sai** với lệnh có vải phối
cùng màu thân — và vì sao bản vá đó trông như đã giải quyết vấn đề suốt từ v6.60 tới nay.

Trước khi viết bất kỳ câu lọc "màu chính / màu phối" nào: hỏi **cây**, đừng hỏi **màu**.
