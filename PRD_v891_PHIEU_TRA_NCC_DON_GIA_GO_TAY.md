# PRD v8.91 — Phiếu xuất kho vải / trả NCC: bỏ cột Kiểu + Số mét, thêm Đơn giá gõ tay

**Ngày:** 2026-10-15 · **Yêu cầu của Nguyen:** *"phiếu xuất kho vải. trả nhà cung cấp: bỏ cột kiểu. chỉ cần cột mã cây, số kg và thêm cột đơn giá"*

Hai quyết định đã chốt:
- *"Gõ tay được, để trống thì lấy giá nhập"*
- *"Bỏ luôn, chỉ còn Mã cây + Số kg + Đơn giá"*

---

## 1. Vấn đề

Trước v8.91 phiếu trả vải về NCC **không gõ được đơn giá** — hệ thống luôn lấy `VaiCay.DonGiaNhap`. Thực tế trả hàng thường có giá thỏa thuận khác giá nhập (hàng lỗi, trả muộn, đổi tỷ giá). Không gõ được thì số giảm nợ sai và phải sửa tay trong sổ công nợ.

Đồng thời form trả NCC đang hiện hai cột vô nghĩa với nghiệp vụ trả hàng: **Kiểu** (Chính/Phối — chỉ dùng cho vải cấp cho lệnh SX) và **Số mét** (đối chiếu với NCC luôn theo kg).

## 2. Tiêu chí hoàn thành

| # | Tiêu chí | Cách kiểm |
|---|---|---|
| T1 | Chế độ trả NCC chỉ còn: Mã cây · KG xuất · Đơn giá · Thành tiền | Mở form, tích "Trả nhà cung cấp" |
| T2 | Để trống Đơn giá ⇒ công nợ dùng `DonGiaNhap` **y như trước** | Lập 1 phiếu trả không gõ giá, đối chiếu sổ công nợ NCC |
| T3 | **Mọi phiếu trả lập trước v8.91 giữ nguyên số tiền** | Câu đối chiếu trước/sau trong `migration_v879.sql` |
| T4 | Bản in, popup Xem, sổ công nợ, bảng chứng từ: **cùng một con số** | Mở 1 phiếu có gõ giá, so 4 màn |
| T5 | Sửa phiếu (dù chỉ sửa ngày) **không làm mất** đơn giá đã gõ | Lập phiếu gõ giá → sửa ngày → xem lại công nợ |
| T6 | Chế độ xuất SX **không đổi gì** — vẫn có Kiểu, Kg chỉ định, Số mét | `node backend\utils\kiem_in_phieu_xuat_tra_ncc.js` |

## 3. Phạm vi

**Trong:** form Tạo/Sửa phiếu xuất vải, bản in, popup Xem, công nợ NCC (bảng tổng + sổ chi tiết), bảng xem chứng từ.

**Ngoài:** phiếu nhập vải, giá thành đơn hàng (`qlsx.js` vẫn dùng `DonGiaNhap` — vải đã cắt vào sản phẩm, đúng phải theo giá nhập), phụ kiện, kho hàng hóa.

---

## 4. Thiết kế

### 4.1 Dữ liệu — `migration_v879.sql`

```sql
ALTER TABLE PhieuXuatVaiChiTiet ADD DonGiaTra DECIMAL(18,2) NULL;
```

**NULL, không DEFAULT 0.** `DEFAULT 0` là mọi phiếu trả cũ bỗng dưng giảm nợ 0 đồng, công nợ NCC nhảy vọt mà không ai hiểu tại sao. `NULL = hành vi cũ` là nguyên tắc xuyên suốt của thay đổi này.

### 4.2 Một công thức tiền duy nhất

`backend/utils/tienVaiNhap.js`:

```js
bieuThucTienTraVai(pool, 'ct', 'vc')
  → (ISNULL(ct.KGXuat,0) * COALESCE(ct.DonGiaTra, vc.DonGiaNhap, 0))
  → chưa chạy migration: (ISNULL(ct.KGXuat,0) * ISNULL(vc.DonGiaNhap,0))
```

**Ba** nơi gọi nó (trước v8.91 là ba bản chép tay):
- `congno.js · congNoNCC()` — bảng tổng hợp
- `congno.js · soChiTietNCC()` — sổ chi tiết
- `chungTu.js · nhánh PXV` — bấm số phiếu để xem chứng từ

### 4.3 Chuẩn hóa ô nhập — `chuanDonGiaTra()`

| Người gõ | Ghi xuống | Công nợ dùng |
|---|---|---|
| để trống | `NULL` | `DonGiaNhap` |
| `0` | **`NULL`** | `DonGiaNhap` |
| số âm | `NULL` | `DonGiaNhap` |
| chữ | `NULL` | `DonGiaNhap` |
| `70000` | `70000` | `70000` |

**Vì sao 0 cũng thành NULL:** `Number('0')` là 0 và `isNaN(0)` là `false`, nên phép kiểm "rỗng hoặc không phải số" không bắt được số 0. Ghi thẳng 0 xuống thì `COALESCE(0, ...)` trả 0 — phiếu trả 500 kg giảm nợ **đúng 0 đồng**, công nợ phải trả phình lên nguyên giá trị lô hàng, im lặng. Trả hàng cho không thì không lập phiếu trả, nên 0 gần như luôn là gõ nhầm.

### 4.4 Giao diện

| Chế độ | Cột |
|---|---|
| Xuất cho sản xuất | Kiểu · Mã cây · KG xuất · Số mét |
| Trả nhà cung cấp | Mã cây · KG xuất · Đơn giá · Thành tiền |

- **Form Tạo**: ẩn/hiện bằng CSS trên `<table class="bang-xuat tra-ncc">`. Ô `.x-kieu` **vẫn nằm trong DOM**, chỉ không nhìn thấy — xóa hẳn thì dòng xuất SX gửi lên thiếu `kieuVai`, backend mặc định `'Chính'`, cây PHỐI thành CHÍNH, sản lượng cắt cộng dư. Đúng con bug DH2608064 mà v8.71 vừa sửa.
- **Form Sửa**: chế độ cố định lúc mở nên dựng thẳng đúng bộ cột; Kiểu và Số mét giữ lại dưới dạng `<input type="hidden">` mang đúng giá trị đang có trong CSDL.
- Chọn cây xong **tự điền** `DonGiaNhap` của chính cây đó (qua `onResolve` của `wireSearchableSelect`); sửa được; xóa trắng = quay về giá nhập.
- Bề rộng cột đặt thẳng lên `<th>`, **không dùng `<colgroup>`** — `display:none` không bỏ được một `<col>` khỏi bảng, trình duyệt vẫn đếm đủ rồi gán lệch.

---

## 5. Bảy lỗi rà chéo bắt được (ghi lại để không tái phạm)

| # | Lỗi | Hậu quả nếu lọt |
|---|---|---|
| 1 | Form Sửa không gửi `donGiaTra` nhưng backend vẫn ghi | Sửa **ngày xuất** thôi cũng **xóa trắng** giá đã gõ. 500 kg × (85.000−50.000) = **17,5 triệu**, không log |
| 2 | Còn bản chép công thức thứ ba ở `chungTu.js` | Sổ công nợ ghi 50.000/kg, bấm vào chính dòng đó xem chứng từ thấy 85.000/kg |
| 3 | Hàm giả trong bộ tự kiểm sai ⇒ 4 phép kiểm **báo đỏ oan** | Test bao giờ cũng đỏ ⇒ lần sau có lỗi thật không ai tin |
| 4 | Gắn listener vào `#xcay_N` — id đó **không tồn tại** | Tự điền đơn giá không bao giờ chạy |
| 5 | Hai bản cache dò cột riêng | Chạy migration quên restart ⇒ **bản in một giá, công nợ một giá** |
| 6 | Gõ `0` lọt qua phép kiểm | Phiếu trả giảm nợ **0 đồng** |
| 7 | `CAI_DAT_DAY_DU.sql` chưa gộp v879 | Máy cài mới không có cột, gõ giá bị chặn |

Thêm (vòng 2): form Sửa phiếu trả nạp **toàn kho** chứ không lọc theo NCC của phiếu ⇒ thay vào cây của NCC khác thì **giảm nợ nhầm nhà cung cấp**. Lỗ này có từ v5.3, v8.91 làm nó đắt hơn nên sửa luôn.

---

## 6. File đã sửa

**Backend**
- `database/migration_v879.sql` *(MỚI)*
- `backend/utils/tienVaiNhap.js` — `bieuThucTienTraVai`, `coCotDonGiaTra` (không cache), `chuanDonGiaTra`
- `backend/utils/vaiXuatService.js` — lưu khi tạo phiếu
- `backend/utils/chungTu.js` — nhánh PXV
- `backend/routes/congno.js` — hai câu công nợ NCC
- `backend/routes/khovai.js` — đọc cho bản in + lưu khi sửa phiếu
- `backend/utils/kiem_in_phieu_xuat_tra_ncc.js` — bộ tự kiểm

**Frontend**
- `frontend/js/module.khovai.js`
- `frontend/index.html` — `module.khovai.js?v=8.91`

---

## 7. Deploy

> 🔴 **`server\D:\QLSX` LÀ MÁY CHẠY THẬT.** Không có bản chạy thử. Mọi lần copy sang đó là deploy lên production.

### Bước 1 — kiểm cú pháp TRƯỚC KHI COPY (tại C:)

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\tienVaiNhap.js
node --check backend\utils\vaiXuatService.js
node --check backend\utils\chungTu.js
node --check backend\routes\congno.js
node --check backend\routes\khovai.js
node --check frontend\js\module.khovai.js
node backend\utils\kiem_in_phieu_xuat_tra_ncc.js
```

**Phải thấy `0 sai`.** Có bất kỳ dòng đỏ nào thì DỪNG, gửi tôi nguyên văn.

### Bước 2 — gộp migration vào bản cài đặt đầy đủ

```powershell
node tao_file_cai_dat.js
```

`CAI_DAT_DAY_DU.sql` đang dừng ở `[111/111] migration_v878.sql`. Chạy xong phải thấy `[112/112] migration_v879.sql`.

### Bước 3 — số công nợ NCC TRƯỚC khi chạy migration

Mở SSMS trên database `QLNoiBo`, chạy phần "TRƯỚC" trong `migration_v879.sql` (câu `SELECT ... GROUP BY NCC_ID`). **Chụp màn hình hoặc copy kết quả ra file.**

### Bước 4 — chạy migration

```
SSMS → database QLNoiBo → mở database\migration_v879.sql → Execute
```

Có guard `IF COL_LENGTH(...) IS NULL` nên chạy lại nhiều lần vô hại.

### Bước 5 — copy file sang máy chạy thật

Copy 8 file này từ `C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo\` sang `server\D:\QLSX\`, giữ nguyên cấu trúc thư mục:

```
backend\utils\tienVaiNhap.js
backend\utils\vaiXuatService.js
backend\utils\chungTu.js
backend\utils\kiem_in_phieu_xuat_tra_ncc.js
backend\routes\congno.js
backend\routes\khovai.js
frontend\js\module.khovai.js
frontend\index.html
```

### Bước 6 — restart + xóa cache trình duyệt

```powershell
pm2 restart qlnoibo
```

Rồi **Ctrl+F5** trên máy khách.

> Lần này `coCotDonGiaTra` **không cache** nên về lý không bắt buộc restart sau migration. Vẫn restart vì 6 file backend vừa đổi.

### Bước 7 — đối chiếu lại số công nợ NCC

Chạy lại đúng câu ở Bước 3. **Phải khớp từng dòng với kết quả đã lưu** — chưa có phiếu nào gõ giá thì mọi `DonGiaTra` đều NULL, `COALESCE` lùi về `DonGiaNhap`, số không được phép nhúc nhích.

Lệch một đồng nào cũng báo tôi ngay, đừng deploy tiếp.

### Bước 8 — thử tay

1. Kho vải → Xuất kho → **Tạo phiếu xuất** → tích "Trả nhà cung cấp" → chọn NCC.
   Bảng dòng phải chỉ còn **Mã cây · KG xuất · Đơn giá · Thành tiền**.
2. Chọn một cây → ô **Đơn giá tự điền** giá nhập của cây đó.
3. Sửa đơn giá thành số khác → **Thành tiền** đổi theo → Lưu.
4. Mở lại phiếu (**Xem**) → thấy đúng đơn giá vừa gõ + dòng **TỔNG CỘNG có tổng tiền**.
5. **In phiếu** → cột Đơn giá in đúng con số đó.
6. Công nợ → Nhà cung cấp → mở NCC đó → **sổ chi tiết** phải ghi giảm nợ bằng đúng tổng tiền ở bước 4.
7. **Bấm vào số phiếu** trong sổ → bảng chứng từ cũng phải ra đúng con số đó.
8. 🔴 **Sửa phiếu**: mở phiếu vừa lập → chỉ đổi **ngày xuất** → Lưu → quay lại sổ công nợ. **Số không được đổi.**
9. Lập một phiếu trả khác, **để trống** Đơn giá → công nợ phải tính theo giá nhập như trước.
10. Xuất kho cho **lệnh sản xuất** (không tích trả NCC) → bảng vẫn phải có **Kiểu · Số mét**, không có Đơn giá.

---

## 8. Còn nợ (không thuộc v8.91, ghi để không quên)

- `PUT /api/khovai/xuat/:id` vẫn `SET Chuyen=NULL, MucDich=NULL` vì form Sửa không có hai ô đó — dữ liệu cũ nhập từ nơi khác sẽ mất khi mở ra sửa. Lỗi từ v5.3.
- v8.90 (giá vốn tự cập nhật từ lệnh SX) **đã viết nhưng chưa deploy, chưa test**.
- v8.74 (QC/Đóng gói nhiều đợt) vừa bật — **kỳ lương đầu tiên sau khi bật phải đối chiếu tay**.
