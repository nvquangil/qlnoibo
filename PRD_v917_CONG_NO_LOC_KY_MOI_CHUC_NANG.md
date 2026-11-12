# PRD v9.17 — Công nợ: lọc từ ngày–đến ngày + chọn Tháng/Quý/Năm ở mọi chức năng

**Ngày:** 2026-11-04 · **Nguyen:** *"Phân hệ quản lý công nợ các chức năng ở trong tạo thêm lọc theo ngày đến ngày, chọn tháng, quý năm"* + *"số tổng và còn lại biến động theo lọc"*. Phạm vi chốt qua hỏi đáp: **gọn** — danh sách chứng từ + các sổ chi tiết; bảng công nợ tổng KH/NCC/GC giữ nguyên (số là *còn nợ hiện tại*; muốn xem theo kỳ đã có sổ chi tiết của từng đối tác).

## 1. Ô "⏱ Tháng/Quý/Năm…" dùng chung

Một `<select>` liệt kê **12 tháng + 8 quý + 4 năm** gần nhất — chọn một kỳ là hai ô *từ ngày / đến ngày* **tự điền và áp dụng luôn** (bấm hộ nút Lọc/Xem của màn đó). Hai ô ngày vẫn gõ tay được như cũ cho khoảng lẻ. Ngày dựng bằng số **local (giờ VN)**, không `toISOString` (bẫy lùi 1 ngày). `dsKyNhanh()`/`trongKy()` là hàm thuần — bộ kiểm chạy ca thật (vòng năm, quý vắt năm, 29/02 năm nhuận, biên kỳ).

## 2. Gắn vào đâu

| Chỗ | Trước | Nay |
|---|---|---|
| **Phiếu thu** (danh sách) | không có lọc ngày | lọc từ–đến + kỳ nhanh + nút ✖; **Tổng đã thu + đếm X/Y phiếu tính từ đúng các dòng lọc ra**, nhãn "(đang lọc ngày)" |
| **Phiếu chi** (danh sách) | không có | như trên, gồm cả **tổng tính CPKD** theo lọc |
| **Điều chỉnh công nợ** | không có, không có tổng | lọc + thêm dòng **"Cộng gộp"** (dương tăng/âm giảm, có dấu) theo lọc |
| Sổ công nợ KH / NCC (modal) | từ–đến + nút Lọc (v8.87) | + ô kỳ nhanh, chọn là lọc luôn |
| Sổ công nợ gia công (modal) | từ–đến + Xem (v8.72) | + ô kỳ nhanh |
| Sổ quỹ chi tiết (modal) | từ–đến + Xem | + ô kỳ nhanh |
| Khối "Sổ chi tiết — kỳ" (xuất Excel/Xem sổ, trong modal KH + NCC) | từ–đến | + ô kỳ nhanh **chỉ điền ô** (khối có 2 nút hành động, không bấm hộ) |

Kỹ thuật: **lọc = vẽ lại tab** với mảng đã lọc (không ẩn dòng — ô tìm `wireTableSearch` của common.js cũng ẩn/hiện dòng, hai bộ lọc cùng sờ `style.display` là giẫm nhau); kỳ đang lọc nhớ trong `kyLocDS` — xóa/sửa phiếu xong vẫn giữ kỳ. "Còn lại/dư cuối kỳ" của các sổ chi tiết vốn đã động theo kỳ từ v8.72/v8.87 — nay chỉ thêm đường chọn nhanh. Nút **Xuất Excel** của Phiếu thu/chi vẫn xuất **toàn bộ** (route `/export` chưa nhận kỳ) — khi đang lọc, title nút nói rõ điều đó.

## 3. File

| File | Gì |
|---|---|
| `frontend/js/module.congno.js` | khối helper v9.17 + 3 danh sách + 5 khối kỳ |
| `frontend/index.html` | `module.congno.js?v=9.17` |
| `backend/utils/kiem_cong_no_loc_ky.js` *(mới, KHÔNG copy)* | vm.Script + 15 ca hành vi dsKyNhanh/trongKy + phép nối dây |

**Backend KHÔNG đổi. Không migration.** Rà chéo độc lập: PASS toàn bộ 8 mục, không lỗi chặn.

## 4. Deploy — GỘP vào đợt 16 file (PRD_v915 mục 4 đã cập nhật)

`index.html` nay mang bump v9.17 ⇒ **thêm `frontend\js\module.congno.js` vào đợt gộp** (thiếu là trình duyệt xin ?v=9.17 mà server trả bản cũ). Bộ kiểm thứ 6: `node backend\utils\kiem_cong_no_loc_ky.js`.

**Thử sau deploy:**
1. Phiếu thu: chọn "Tháng 10/2026" → hai ô ngày tự điền 01/10→31/10, bảng chỉ còn phiếu tháng 10, **Tổng đã thu đổi theo** + đếm "X/Y phiếu"; bấm ✖ → về đủ.
2. Phiếu chi: như trên, tổng CPKD cũng đổi theo. Điều chỉnh: dòng "Cộng gộp" đổi theo lọc.
3. Xóa 1 phiếu khi đang lọc → bảng vẽ lại **vẫn giữ kỳ đang lọc**.
4. Sổ công nợ khách (modal): chọn "Quý 3/2026" ở ô kỳ nhanh → sổ tự lọc, dư đầu/cuối kỳ đổi theo (như bấm Lọc tay).
5. Gõ tay từ ngày > đến ngày → toast chặn.
6. Khối "Sổ chi tiết — kỳ": chọn kỳ nhanh → 2 ô điền, tự bấm 👁️ Xem sổ / ⬇️ Xuất Excel.

**Commit:** `"v9.17 cong no: loc tu ngay-den ngay + chon thang/quy/nam o moi chuc nang, tong toolbar tinh theo dong dang loc"`

## 5. Nói trước / còn mở

- Bảng công nợ tổng KH/NCC/GC **không** lọc kỳ (phạm vi chốt "gọn") — làm sau nếu cần: mỗi đối tác thêm dư đầu kỳ/phát sinh/dư cuối kỳ, nặng, đổi nghĩa bảng.
- Route `/export` phiếu thu/chi chưa nhận kỳ — file Excel luôn toàn bộ; muốn file theo kỳ là việc backend riêng.
- Đổi kỳ lọc làm toolbar vẽ lại ⇒ chữ đang gõ trong ô tìm bị xóa (hệ quả của chọn vẽ-lại, chấp nhận).
