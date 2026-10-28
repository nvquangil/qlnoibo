# PRD v9.09 — Lệnh SX ở lại ô chọn phiếu nhập kho cho tới khi **nhập xong**

**Ngày:** 2026-10-28 · **Nguyen:** *"khi kho nhập cập nhật lần đầu dù chưa hoàn thành nhưng phiếu nhập kho hàng hóa hiện lệnh sx đó luôn. khi nào lệnh đó hoàn thành phiếu nhập cuối cùng nhập xong lệnh đó sẽ không hiện nữa."*

## 1. Khoảng cách thật

| | Cũ (v8.47 + v6.89) | Yêu cầu |
|---|---|---|
| Hiện lệnh khi nào | Ghi KN lần đầu → hiện ngay | ✅ giống |
| **Ẩn lệnh khi nào** | **Ngay sau phiếu ĐẦU TIÊN** | **Lệnh Hoàn thành + phiếu cuối nhập xong** |

Luật v6.89 *"một lệnh SX chỉ nhập kho một lần"* sai với thực tế: **tổ kho nhập theo từng đợt**. Từ đợt 2 trở đi lệnh biến mất khỏi ô chọn, phải biết đường tích ô "Nhập bổ sung" — không ai nói cho họ biết. Đúng lớp lỗi *"không có nút để bấm"* (`feedback_qlnoibo_an_nut_khong_noi_ly_do`).

## 2. Luật mới

**Ẩn lệnh khi và chỉ khi cả ba đúng:**

1. có ≥ 1 phiếu nhập kho chưa hủy, **và**
2. `DonHangSanXuat.TrangThai = 'Hoàn thành'`, **và**
3. **đã nhập đủ**: Σ SL trên các phiếu (quy ra **Cái**) ≥ luỹ kế công đoạn Kho nhập (Cái).

**Mốc (3) là luỹ kế KN, không phải SL cắt** — chứng từ phải khớp với cái **tổ kho đã ghi nhận**, không phải với sản lượng cắt. Hai số đó được phép lệch (ghi chú v8.47), và phần lệch chính là "còn hàng chưa làm phiếu".

🔴 **Đơn vị là bẫy chính.** `PhieuNhapKhoHangChiTiet.SoLuongChinh` quy về **đơn vị chính của mã hàng**, mà đơn vị chính **có thể là Ri**; luỹ kế KN luôn là **Cái**. Cộng thô `SoLuongChinh` rồi so là mã quản theo Ri báo "đã nhập đủ" trong khi mới nhập được 1/*hệ số*. Biểu thức quy đổi lấy **nguyên văn** từ mẫu số của `tinhGiaThanh()`.

**Lùi về an toàn** — không lệnh nào đang hiện mà nay biến mất:

- Lệnh cũ không có luỹ kế KN (`canNhap = 0`) → quay về đúng luật cũ "có phiếu là ẩn".
- Lệnh **Đã hủy** → giữ nguyên luật cũ (có phiếu là ẩn). Không cho rơi vào nhánh mới, vì nó không bao giờ `Hoàn thành` nên sẽ nằm lại **vĩnh viễn**.
- Mọi lỗi đọc đều bắt lại: hỏng một nguồn ⇒ coi như 0 ⇒ **không ẩn lệnh nào**. Thừa lệnh còn hơn lệnh biến mất không lý do.
- Lệnh của **phiếu đang sửa** (`?phieuNKID=`) giữ vô điều kiện, kể cả khi bị cắt ở mốc 300 hoặc không qua nổi `WHERE`.

## 3. Sửa

| File | Gì |
|---|---|
| `backend/utils/slNhapKhoChungTu.js` *(mới)* | `slPhieuNhapTheoDon(pool)` → `{DonHangID: {SoLanNhap, SLCai, SoPhieuGanNhat}}`. Hai câu GROUP BY quét bảng phiếu **một lần**, thay 2 subquery tương quan. |
| `backend/routes/qlsx.js` | `module.exports.slKhoNhapTheoDon` — dùng lại thay vì chép CTE `knTd`/`heCat` (hệ số Ri đã sai 3 lần). |
| `backend/routes/nhapkho.js` | `/danhmuc`: bỏ `NOT EXISTS` **và bỏ `TOP`**; thêm `locLenhChoPhieuNhap()`. **Chặn lưu phiếu SanXuat không chọn lệnh** (POST + PUT). |
| `frontend/js/module.nhapkho.js` | Nhãn mỗi dòng: `⚠️ đã nhập 2 phiếu · 240/360 cái · còn thiếu 120 (PN26031)`; ô tích đổi nghĩa. |
| `frontend/index.html` | `module.nhapkho.js?v=9.09` |
| `backend/utils/kiem_lenh_sx_o_phieu_nhap.js` *(mới, không copy sang D:\)* | `vm.Script` + 30 phép kiểm. |

**Không có migration.** Không thêm cột, không sửa dữ liệu.

## 4. 🔴 Rà chéo chặn deploy — lỗi của chính tôi

**Tôi đã đổi `TOP 300` *sau* bộ lọc thành `TOP 500` *trước* bộ lọc.** Bản cũ đặt TOP sau `NOT EXISTS(phiếu)` nên nó **đào sâu tuỳ ý** vào lịch sử — luôn đủ 300 lệnh chưa lập phiếu, kể cả lệnh 2 năm trước. Bản của tôi chỉ nhìn 500 lệnh mới nhất: **lệnh xếp hạng 501 trở đi không bao giờ vào được ô chọn dù chưa từng lập phiếu**, và ô chọn là `<select>` thuần không có ô tìm nên không với tới được. Với ~100 lệnh/tháng thì 500 lệnh ≈ 5 tháng ⇒ mọi lệnh cũ hơn thế mất hút. Chính là lớp lỗi bản vá này nói muốn diệt. **Đã bỏ hẳn `TOP`.**

Rà chéo còn bắt 4 lỗi nữa, đã sửa: lệnh **Đã hủy** nằm lại vĩnh viễn; lời hứa "giữ lệnh của phiếu đang sửa" **không đúng** vì `break` ở mốc 300 vẫn cắt (thêm `unshift` + truy vấn bù); bộ tự kiểm **thiếu đúng mảnh quan trọng nhất** `ct.SoLuongChinh * CASE` nên đổi `tinhGiaThanh` thành `ct.SoLuong` vẫn xanh; câu gợi ý ghi "ô dưới" trong khi ô tích ở **trên**.

Kèm một lỗ **có từ trước**: `PUT /phieu/:id` không chặn phiếu SanXuat thiếu `donHangId`, nên ô lệnh SX rỗng + bấm Lưu = âm thầm gỡ phiếu khỏi lệnh, dấu hiệu duy nhất là một câu về *giá vốn* nối vào toast **thành công**. Đã chặn 400 ở cả POST lẫn PUT.

## 5. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\slNhapKhoChungTu.js
node --check backend\routes\nhapkho.js
node --check backend\routes\qlsx.js
node --check frontend\js\module.nhapkho.js
node backend\utils\kiem_lenh_sx_o_phieu_nhap.js
```

Phải ra `0 sai` trước khi copy. Copy 5 file → `pm2 restart qlnoibo` → Ctrl+F5. **Không có migration nên thứ tự nào cũng được.**

**Thử:**

1. Lệnh đang chạy, đã ghi KN, **chưa có phiếu** → hiện, không nhãn.
2. Lập phiếu đợt 1 (một phần) → mở form mới: lệnh **vẫn còn**, nhãn `⚠️ đã nhập 1 phiếu · 120/360 cái · còn thiếu 240`. **Đây là việc chính của bản này.**
3. Nhập nốt cho đủ **và** lệnh đã `Hoàn thành` → lệnh **biến mất**. Tích "Hiện cả lệnh SX đã nhập xong" → thấy lại, nhãn `✓ đã nhập xong`.
4. Nhập đủ nhưng lệnh **chưa** `Hoàn thành` → vẫn hiện (còn hàng sẽ về).
5. **Sửa** một phiếu cũ → ô lệnh SX **có sẵn đúng lệnh**, kể cả lệnh đã nhập xong.
6. Chọn loại "Từ sản xuất" rồi để trống ô lệnh SX, bấm Lưu → **báo đỏ**, không lưu.
7. Lệnh SX **rất cũ** (ngoài 500 lệnh gần nhất) chưa từng lập phiếu → vẫn chọn được.

**Commit:** `"v9.09 phieu nhap kho: lenh SX o lai o chon den khi nhap xong (so voi luy ke cong doan KN), chan luu phieu SanXuat thieu lenh"`

## 6. Nói trước

- **So TỔNG qua mọi màu.** KN ghi 100 cái màu A + 50 màu B, phiếu nhập 150 cái **toàn màu A** ⇒ lệnh vẫn ẩn. Đúng yêu cầu đã phát biểu, nhưng không bắt được lệch theo màu. Muốn chặt hơn thì phải so từng màu — nói nếu cần.
- **Dữ liệu KN trước v8.49** có thể lưu số **Ri** thay vì Cái ⇒ `canNhap` thấp ⇒ ẩn sớm. Những lệnh đó ở bản cũ **đã luôn bị ẩn** ngay khi có phiếu nên không mất gì so với trước, nhưng cũng không được hưởng tính năng mới.
- `/danhmuc` nay thêm ~6 lượt truy vấn (quét `TienDoSanXuat` + `TienDoChiTietMau` + `PhieuNhapKhoHang`). Route này gọi lúc mở form, lúc tích ô, và một lần sau khi lưu. `PhieuNhapKhoHang` **không có index trên `DonHangID`** — nếu thấy form mở chậm thì thêm index đó là xong.
- Danh sách cắt ở **300 lệnh còn phải nhập, mới nhất**. Nếu xưởng tồn đọng hơn 300 lệnh chưa nhập xong thì phải thêm ô tìm cho `<select>` này.
