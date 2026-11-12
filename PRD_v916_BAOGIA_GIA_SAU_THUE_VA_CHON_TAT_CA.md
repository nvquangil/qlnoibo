# PRD v9.16 — Báo giá Aloha: Giá bán là giá SAU thuế (bỏ CK shop) + nút Chọn tất cả

**Ngày:** 2026-11-04 · **Nguyen:** *"Báo giá aloha sửa lại lấy cột giá bán đưa vào cột giá sau thuế, tự chia giá trước thuế điền vào cột giá bán trước thuế. Thêm chức năng chọn tất cả khi tạo báo giá."*

## 1. Công thức giá — chốt bằng ví dụ số (AskUserQuestion)

Câu chữ có hai cách hiểu (giữ hay bỏ CK shop 33% của v8.37) lệch nhau 49% trên báo giá gửi khách — hỏi lại bằng số thật, Nguyen chọn: **"Giá bán 100.000 (bỏ CK shop)"**.

| | Công thức | Ví dụ (Giá bán 100.000, VAT 8%) |
|---|---|---|
| Cột **Sau VAT** | = Giá bán của thẻ kho (đã gồm thuế) | **100.000** |
| Cột **Giá trước VAT** | = Giá bán ÷ (1 + %VAT) | **92.593** |

**CK shop không còn xuất hiện trong báo giá.** `SQL_GIA_ALOHA` về `h.GiaBan AS GiaAloha` (giữ alias nên popup Xem / bản in / Excel tự theo); gỡ `.input('ckShop')` ở cả 3 route; công thức đổi ở **hai đầu phải khớp**: backend `/baogia/:id/export` và `baoGiaTruocVat()`/`baoGiaSauVat()` (frontend). Nhãn ô chọn mã: "(sau CK: …)" → **"(giá bán: …)"**.

🔴 **Lịch sử BA lần đổi chiều — ghi thẳng vào code (ghi chú `SQL_GIA_ALOHA`), đừng tự "sửa lại cho giống" bản nào:**
v6.62 gốc Giá bán → **chia ↓** · v8.37 gốc giá sau CK (chưa thuế) → **nhân ↑** (67.000/72.360) · v9.16 gốc Giá bán → **chia ↓** (100.000/92.593). Mỗi lần đều kèm ví dụ số của Nguyen; muốn đổi tiếp phải có ví dụ số mới.

## 2. Chọn tất cả khi tạo/sửa báo giá

Hai nút trên danh sách mã: **"☑️ Chọn tất cả (dòng đang hiện)"** + **"☐ Bỏ chọn (dòng đang hiện)"** — chỉ tác động dòng đang hiện sau 3 bộ lọc (cùng luật `cmChonHet` v8.24: lọc còn 3 mã mà tích cả 800 mã là tai nạn); `type="button"` (nút trần trong form là submit); tự bật/tắt ô %VAT theo trạng thái tích, **giữ nguyên giá trị %VAT** từng dòng; dòng đếm "đã tích đang bị ẩn" cập nhật theo.

## 3. File

| File | Gì |
|---|---|
| `backend/routes/khohang.js` | `SQL_GIA_ALOHA` = GiaBan; gỡ 3 `.input('ckShop')`; công thức export đảo chiều |
| `frontend/js/module.khohang.js` | 2 hàm giá đảo chiều; nhãn "(giá bán: …)"; 2 nút chọn/bỏ chọn + `datChonDongDangHien()` |
| `frontend/index.html` | `module.khohang.js?v=9.16` |
| `backend/utils/kiem_bao_gia_gia_sau_thue.js` *(mới, KHÔNG copy)* | trích 2 hàm chạy 6 ca số + khớp hai đầu + nút |
| `backend/utils/kiem_lenh_sx_the_kho.js` *(sửa, KHÔNG copy)* | bỏ ghim cứng `?v=8.97` (đỏ oan mỗi lần bump) → so số `>= 8.97` |
| `HUONG_DAN_CAI_DAT.md` | mục v8.37 đánh dấu hết hiệu lực + thêm mục v9.16 |

Không migration. `layTyLeCK`/`CK_SHOP` vẫn dùng cho Thẻ kho, Bán hàng, bảng kê — chỉ báo giá thôi dùng.

## 4. Deploy — GỘP vào đợt 15 file (xem PRD_v915 mục 4 đã cập nhật)

Không deploy lẻ: `index.html` mang cả năm bump v9.11→v9.16. Lệnh kiểm + danh sách 15 file + `pm2 restart` ở **PRD_v915 mục 4**; sidebar sau deploy hiện **v9.16**.

**Thử:**
1. Tạo báo giá → ô chọn mã ghi "(giá bán: 100.000đ)"; popup Xem và file Excel **cùng ra**: Sau VAT 100.000, Giá trước VAT 92.593 (VAT 8%); mã VAT 10%: Giá bán 110.000 → trước VAT 100.000 chẵn.
2. Đối chiếu ngược trên Excel: Trước VAT × (1+%VAT) = đúng Giá bán.
3. Lọc danh mục còn N mã → bấm Chọn tất cả: chỉ N mã được tích, ô %VAT mở ra và giữ số đang có; Bỏ chọn → thôi tích; bấm hai nút KHÔNG được tự lưu form.
4. Sửa báo giá cũ: dòng prefill VAT 10 → Chọn tất cả không đổi số 10 đó.
5. Bỏ chọn hết → Lưu → báo "Chưa chọn mã hàng nào".

**Commit:** `"v9.16 bao gia aloha: gia ban la gia SAU thue (bo CK shop), chia nguoc ra gia truoc thue + nut chon tat ca/bo chon theo dong dang hien"`

## 5. Nói trước

- Báo giá ĐÃ LƯU không có giá đóng băng (giá luôn tính từ Giá bán hiện tại) ⇒ mở lại báo giá cũ sau deploy là **số đổi theo công thức mới** — đúng chủ ý "sửa lại", nhưng báo giá đã GỬI khách trước đây là file Excel rời, không bị đổi.
- Ô "Giá bán đề xuất" (cột 11 Excel) vẫn trống như từ trước — không ai yêu cầu điền.
- `CAI_DAT_DAY_DU.sql:428` còn câu comment cũ về cột `GiaAloha` (file SINH TỰ ĐỘNG bởi `tao_file_cai_dat.js` — không sửa tay; thuần mỹ phẩm).
