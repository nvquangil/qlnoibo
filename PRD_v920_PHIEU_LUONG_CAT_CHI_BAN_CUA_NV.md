# PRD v9.20 — Phiếu lương nhân viên Cắt: chỉ hiện bàn cắt người đó tham gia

**Ngày:** 2026-11-04 · **Nguyen:** *"Bảng lương nhân viên bộ phận Cắt (bấm 1 nhân viên để xem / in phiếu lương). Cơ sở tính quỹ tháng — QUỸ LƯƠNG TRẢI VẢI CẮT — Tháng 10/2026 chỉ hiển thị bàn cắt nhân viên đó trải vải hoặc cắt."*

Cùng tab, cùng file với v9.18 + v9.19 ⇒ **deploy chung một đợt**.

## 1. Việc

Phiếu lương một nhân viên (bấm dòng trong *Bảng lương nhân viên bộ phận Cắt*) trước đây in **cả quỹ tháng** — mọi bàn cắt của bộ phận. Nay khối đó chỉ còn **bàn cắt mà chính nhân viên đó trải vải hoặc cắt**: tiêu đề "BÀN CẮT CÓ \<TÊN\> THAM GIA", dòng tiêu đề lệnh ghi `2/5 sơ đồ (tham gia / cả lệnh)`, dòng tổng đổi nhãn "TỔNG BÀN CÓ THAM GIA". Áp dụng cho cả bản xem lẫn bản in phiếu lương.

🔴 **Lọc theo ID, không theo tên.** Backend `loadSoDoCat` trả thêm `NhanVienCatID` và `NhanVienTraiVaiIDs` (danh sách id người trải vải, lùi về `td.NhanVienTraiVaiID` cho bàn ghi kiểu cũ) — lọc theo tên thì hai người trùng họ tên hiện nhầm bàn của nhau mà không ai biết.

⚠️ **Câu quan trọng đã thêm vào phiếu:** *"Lương khoán tháng KHÔNG bằng tổng tiền các bàn dưới đây — nó chia theo giờ công trên quỹ của cả bộ phận Cắt."* Thiếu câu này là công nhân cộng cột Thành tiền rồi hỏi vì sao lương không bằng. Bảng tóm tắt phía trên vẫn là số **toàn bộ phận** (Quỹ lương cắt tháng / Tổng giờ / Lương 1 giờ) — không bị lọc, và bộ kiểm có phép ghim điều đó.

Ba nơi **không đổi**: bảng "Bàn cắt theo lệnh sản xuất" trên màn chính, bản in "Quỹ + bàn cắt", bản in bảng lương, 3 sheet Excel (chứng từ quỹ cả bộ phận).

## 2. File

| File | Gì |
|---|---|
| `backend/routes/payroll.js` | `loadSoDoCat` + `NhanVienCatID`, `NhanVienTraiVaiIDs` |
| `frontend/js/module.payroll.js` | `laBanCuaNV()`; `buildLuongCatQuyBody(d, nv)` nhận tham số lọc tuỳ chọn; `buildLuongCatNVBody` gọi có `nv` |
| `frontend/index.html` | `module.payroll.js?v=9.20` |
| `backend/utils/kiem_luong_cat_marap_excel.js` *(sửa, KHÔNG copy)* | + mục 6: 8 ca hành vi `laBanCuaNV` + 2 phép chống **lỗ tiền bạc** (bản in cả bộ phận không được lọc; bảng tóm tắt phải giữ số toàn bộ phận) |
| `backend/utils/kiem_luong_theo_qc.js` *(sửa, KHÔNG copy)* | nới 1 phép colspan (nhãn dòng TỔNG nay đổi theo nhánh) |

Không migration. Số cột giữ nguyên 9 ở cả hai nhánh nên colspan/STT không đổi.

Rà chéo độc lập: **PASS 8/8, không lỗi logic**; 2 góp ý đã làm luôn (2 phép kiểm chống lỗ tiền bạc; nhãn `2/5 sơ đồ`). Nó cũng xác nhận nhánh "cả quỹ" ra **đúng số cũ** (tổng lệnh tính lại từ sơ đồ = đúng phép cộng của `tongHopLuongCat`).

## 3. Deploy — vẫn là đợt 4 file của v9.18+v9.19

Lệnh kiểm + danh sách file ở **PRD_v919 mục 4**, thêm hai dòng kiểm (đã có sẵn trong lệnh): `node backend\utils\kiem_luong_cat_marap_excel.js` và `node backend\utils\kiem_luong_theo_qc.js` phải `0 sai`. Sidebar sau deploy hiện **v9.20**.

**Thử:**
1. Tab Lương trải vải cắt → bấm một nhân viên: khối dưới chỉ còn bàn cắt người đó trải vải hoặc cắt; tiêu đề có tên người; dòng lệnh ghi `x/y sơ đồ`.
2. Bảng tóm tắt trong phiếu (Quỹ lương cắt tháng / Tổng giờ toàn bộ phận / Lương 1 giờ / LƯƠNG KHOÁN THÁNG) **không đổi** so với trước — đây là số cả bộ phận.
3. Bấm 🖨️ In phiếu lương: bản in khớp bản xem.
4. Nút **In quỹ + bàn cắt** và **In bảng lương**: vẫn liệt kê **cả bộ phận** (không bị lọc).
5. Nhân viên Cắt chỉ chấm công, không tham gia bàn nào: phiếu hiện câu "không tham gia bàn cắt nào (lương vẫn chia theo giờ công)", lương vẫn có số.
6. Hai nhân viên cùng trải vải một bàn: bàn đó xuất hiện ở phiếu của **cả hai**.

**Commit:** `"v9.20 phieu luong NV cat: chi liet ke ban cat nguoi do trai vai hoac cat (loc theo ID), kem canh bao luong chia theo gio cong"`

## 4. Nói trước

- Một bàn có nhiều người trải vải ⇒ bàn đó nằm trong phiếu của **mọi** người tham gia; cộng tổng các phiếu sẽ **lớn hơn** quỹ tháng. Đó là bản chất "danh sách tham gia", không phải chia tiền — tiền vẫn chia theo giờ công.
- Bàn ghi theo kiểu cũ (chỉ một người trải vải, chưa có bảng nhiều người) vẫn lọc đúng nhờ nhánh lùi `td.NhanVienTraiVaiID`.
