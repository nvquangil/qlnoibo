# PRD v8.89 — Sổ công nợ NCC lọc kỳ + dòng TỔNG cộng theo kết quả tìm kiếm

Trạng thái: **ĐÃ VIẾT CODE** — chờ chạy thử.
Ngày: 2026-10-12

---

## 1. Hai yêu cầu

Nguyen (2026-10-12):

1. *"Làm tiếp phần công nợ nhà cung cấp giống như công nợ khách hàng vừa làm xong."*
2. *"Bảng Công nợ khách hàng: khi gõ tìm kiếm phần tổng cộng có thể thay đổi theo hiển thị khách
   hàng hiện tại, đang cộng cố định tổng công nợ của tất cả các khách."*

---

## 2. Việc 1 — sổ NCC lọc kỳ

Làm đúng như v8.87 đã làm cho sổ khách hàng: khối lọc kỳ đặt **trên** bảng, dòng **DƯ ĐẦU KỲ**, hiện
cả *Dư cuối kỳ* lẫn *Còn nợ hiện tại*, tiêu đề in đổi thành **SỔ TỔNG HỢP CÔNG NỢ NHÀ CUNG CẤP**.

**Phần cắt kỳ tách thành hàm dùng chung `catTheoKy()`** ở `backend/routes/congno.js`, cả hai sổ gọi
nó. Viết hai đoạn riêng thì sớm muộn một bên tính dư đầu kỳ kiểu khác — mà lệch ở đây là **lệch tiền**.

Không truyền kỳ ⇒ cả hai sổ trả y như trước. 5 chỗ gọi `soChiTietNCC` cũ không phải sửa.

---

## 3. Việc 2 — dòng TỔNG theo kết quả lọc

Lọc còn một khách mà dòng TỔNG vẫn là tổng của toàn bộ ⇒ người đọc tưởng đó là số của khách đang xem.
Sửa chung ở `wireTableSearch()` trong `common.js`, bật bằng `opts.tongTheoLoc` — **mặc định tắt**, nên
mọi bảng khác chạy y như cũ.

Ba quyết định:

- **Cộng theo `data-so` (số thô), không parse lại chuỗi đã định dạng.** "163.031.698" parse ngược
  được, nhưng chỉ cần một ô đổi cách hiển thị (thêm đơn vị, thêm thẻ, số âm trong ngoặc) là phép cộng
  ra số khác mà vẫn in đẹp.
- **Khớp theo TÊN cột (`data-cot`), không theo vị trí ô.** Khớp theo chỉ số vẫn đúng với hai bảng
  hiện nay — nhưng chỉ vì ô gộp (`colspan`) của dòng TỔNG đang nằm ở **cuối**. Ai thêm một ô gộp vào
  **giữa** dòng tổng, kiểu `<td colspan="2">TỔNG</td>`, là tiền rơi nhầm cột, in ra vẫn đẹp, không
  báo lỗi gì.
- **`opts.tomTat` cho dòng tóm tắt NGOÀI bảng.** Thanh công cụ phía trên có dòng "Tổng còn phải thu:
  … / 57 khách" — nó không nằm trong `tr[data-tong]` nên không tự đổi. Thiếu bước này thì màn hình có
  **hai con số tiền mâu thuẫn** cùng lúc, đúng cái nhầm lẫn mà v8.89 định sửa.

Nhãn đổi thành **"TỔNG (đang lọc)"** và **"… (đang lọc)"** khi có từ khoá, để không ai nhầm tổng của
tập đang lọc với tổng của toàn bộ.

---

## 4. Rà chéo tìm được, đã sửa

| Lỗi | Hậu quả nếu để nguyên |
|---|---|
| Thanh tóm tắt trên bảng vẫn cố định | Hai con số tiền mâu thuẫn trên cùng màn hình — **chính nửa yêu cầu còn thiếu** |
| Khớp cột theo chỉ số ô | Thêm `colspan` vào giữa dòng tổng là tiền rơi nhầm cột, im lặng |
| Ô *Còn nợ* dòng TỔNG là text trần | Mất màu đỏ/xanh ở đúng cột quan trọng nhất; nhánh "giữ thẻ `<b>`" thành mã chết |
| Kiểm ngày chạy **sau** 8 câu SQL của sổ NCC | Gõ sai một ký tự ngày phải đợi hết 8 truy vấn mới nhận lỗi |

**Ghi nhận, không sửa trong đợt này** (lỗi cũ, không phải do v8.89):

- Dòng "Không tìm thấy dòng nào khớp" nằm **dưới** dòng TỔNG, và bị đẩy lên đầu bảng sau khi sắp xếp.
- `wireTableSort` đọc `innerText` chứ không đọc `data-so`, nên cột "Điều chỉnh" (in rỗng khi bằng 0)
  sắp xếp theo chuỗi. `data-so` giờ đã có sẵn trên đúng những ô đó — sửa được rẻ ở đợt sau.
- ⚠️ **Bẫy cần nhớ**: `wireTableSearch` loại khỏi `rows` mọi dòng chứa `.empty-hint`. Bật
  `tongTheoLoc` cho một bảng có `<span class="empty-hint">` lồng trong dòng dữ liệu thì dòng đó
  **không bao giờ được cộng** — tổng thiếu tiền, im lặng. Hai bảng công nợ hiện không dính.

---

## 5. Phạm vi

**Trong**: `congno.js` (backend) · `module.congno.js` · `common.js` · bộ tự kiểm · bump `?v=`.

**Ngoài**: ❌ sổ nhà gia công / in thêu · ❌ sổ 2 chiều · ❌ route `/export` nhận kỳ (nút đã đổi nhãn
thành "Xuất Excel toàn bộ") · ❌ `wireTableSort` đọc `data-so`.

---

## 6. Cách nghiệm thu

1. Mở sổ một NCC, **không chọn kỳ** → y hệt trước khi sửa.
2. Chọn kỳ → `Dư đầu kỳ + Σ Phát sinh − Σ Đã trả = Dư cuối kỳ`; `Đến ngày` lùi về quá khứ thì
   `Dư cuối kỳ ≠ Còn nợ hiện tại` và màn hình hiện **cả hai**.
3. Bảng Công nợ khách hàng: gõ tên một khách → **dòng TỔNG trong bảng** và **dòng tóm tắt trên thanh
   công cụ** đều bằng đúng số của khách đó, cả hai có chữ "(đang lọc)".
4. Xóa từ khoá → cả hai quay về tổng của toàn bộ, mất chữ "(đang lọc)".
5. Làm lại bước 3–4 ở bảng Công nợ nhà cung cấp.
6. Các bảng khác (Danh mục, Kho vải, Lệnh SX…) gõ tìm kiếm → **không đổi gì** so với trước.
