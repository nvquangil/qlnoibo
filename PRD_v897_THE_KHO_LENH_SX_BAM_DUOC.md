# PRD v8.97 — Thẻ kho hàng hóa: cột Nguồn hàng hiện lệnh SX + phiếu nhập kho, bấm mở được

**Ngày:** 2026-10-23 · **Yêu cầu của Nguyen:**
- 2026-10-22: *"thẻ kho hàng hóa. cột nguồn hàng nếu là nhà sx điền thêm lệnh sx và có thể click vào xem được lệnh đó"*
- 2026-10-23: *"cột nguồn hàng thêm số phiếu nhập kho có thể mở xem luôn"*

## 1. Vì sao cột đang trống

Cột đã có sẵn chỗ ghi lệnh (`Nhà SX · DHxxxx`) từ v6.x, nhưng chỉ đọc `TheKhoHangHoa.DonHangID` — cột đó **chỉ được điền khi tạo thẻ kho bằng tay và chọn lệnh**, mà từ **v6.82 thẻ kho không gắn lệnh nữa**: hàng xưởng làm ra vào kho bằng **phiếu nhập kho loại Sản xuất**, và chính phiếu mới mang `DonHangID`. Kết quả: hầu hết mã Nhà SX chỉ hiện "Nhà SX" trơn, và cột *Mã đơn hàng SX* trong file Excel cũng trống.

## 2. Giả định đã chọn (nói rõ, anh thấy sai thì bảo)

| # | Giả định | Lý do |
|---|---|---|
| 1 | **Lệnh của một mã = HỢP hai nguồn**: `TheKhoHangHoa.DonHangID` ∪ `PhieuNhapKhoHang.DonHangID` của phiếu **không hủy** có dòng mã đó | Đúng công thức `maHangCuaLenh()` bên giá vốn (`utils/giaVonLenhSX.js`), chiều ngược lại — màn thẻ kho và giá vốn không nói hai kiểu |
| 2 | **Một mã có thể có nhiều lệnh** (lệnh lặp lại cùng sản phẩm) → hiện **danh sách**, không chọn một | Chọn một là giấu các lệnh còn lại |
| 3 | Lệnh xếp theo **ngày nhập kho gần nhất trước**; chỉ gắn ở thẻ tay (chưa nhập) → cuối | "Lệnh đang nhập" quan trọng hơn "lệnh mới tạo" |
| 4 | **Phiếu nhập kho**: mọi phiếu **không hủy** có mã đó, **cả phiếu SX lẫn phiếu NCC**, mới nhất trước | "Nguồn hàng" = hàng từ đâu về; mã Đặt ngoài thì nguồn chính là phiếu NCC. Phiếu hủy bỏ cho đỡ rối (form Sửa thẻ kho vẫn liệt kê cả hủy) |
| 5 | Mỗi dòng (Lệnh / Phiếu) hiện tối đa **3**, còn lại gom "+N … nữa" bấm để xổ, **riêng từng dòng** | Không để một ô cao 10 dòng |
| 6 | Bấm mã lệnh → **modal chi tiết lệnh** (QLSX, có nút In); bấm số phiếu → **modal phiếu nhập kho** (`ModuleNhapKho.xemPhieu`, đúng đường form Sửa thẻ kho dùng từ v6.83) | "xem được" ngay trên trang, không nhảy sang cửa sổ in |
| 7 | **Không ghi gì** vào `TheKhoHangHoa.DonHangID` | Cột đó đang là khóa loại trừ của ô chọn lệnh khi tạo thẻ tay (`/orders-for-thekho` lọc NOT EXISTS) — điền tự động là lệnh biến mất khỏi ô đó |
| 8 | Mã nhãn "Đặt ngoài" mà có phiếu nhập từ lệnh SX → **vẫn hiện lệnh** | Dữ liệu đang mâu thuẫn thì phải lộ ra, không giấu |
| 9 | Danh sách lệnh/phiếu **chỉ trả khi tab Thẻ kho hỏi** (`/items?nguon=1`) | `/items` nuôi ~9 màn (Bán hàng, Đơn khách, Báo giá…) và đã là câu nặng nhất module; danh sách phiếu theo mã lớn dần theo năm — không nhét vào mọi lần gọi |
| 10 | Mở lệnh cần quyền **xem QLSX**; mở phiếu cần quyền **KHOHANG → Phiếu nhập kho**. Không có → toast đúng câu của máy chủ | Dùng lại API sẵn có, không mở lỗ quyền mới |

## 3. Thay đổi

| Chỗ | Gì |
|---|---|
| `backend/routes/khohang.js` | `layNguonHangTheoMaHang(pool)` → `{ lenh, phieu }`: **một** lần quét `PhieuNhapKhoHangChiTiet` (một dòng mỗi cặp mã–phiếu, kèm lệnh + NCC) + một câu nhỏ thẻ tay; gom lệnh bằng JS (SoPhieu, NgayNhapGanNhat); lỗi ⇒ hai Map rỗng + log, **không ném**. GET `/items?nguon=1` gắn `LenhSX[]` + `PhieuNhap[]` vào từng dòng (không có cờ ⇒ không có hai trường). GET `/items/export`: cột *Mã đơn hàng SX* = mọi lệnh; **thêm cột *Phiếu nhập kho*** |
| `frontend/js/module.khohang.js` | `oNguonHangHtml(r)`: nhãn + dòng `Lệnh: DH… +N lệnh nữa` + dòng `Phiếu: NK… +N phiếu nữa`; tooltip lệnh = tên SP · trạng thái · nhập gần nhất · số phiếu, tooltip phiếu = ngày · từ SX/lệnh hoặc từ NCC; `data-search` gom mọi mã lệnh + số phiếu (gõ `NK2600…` ra đúng các mã của phiếu đó); `moLenhSX()` → `ModuleQLSX.openOrderDetail`, `moPhieuNhap()` → `ModuleNhapKho.xemPhieu`; backend cũ ⇒ lùi về `MaDH` của view, vẫn bấm được; `renderItems` gọi `/items?nguon=1` |
| `frontend/js/module.qlsx.js` | export thêm `openOrderDetail` (modal chi tiết lệnh có từ v5.2, trước chỉ dùng nội bộ) |
| `frontend/index.html` | `module.khohang.js?v=8.97`, `module.qlsx.js?v=8.97` |
| `backend/utils/kiem_lenh_sx_the_kho.js` *(mới)* | bộ tự kiểm 6 mục: SQL đúng nguồn + khớp giá vốn; **chạy thật phần gom JS** với pool giả lập (SoPhieu đếm phiếu không đếm dòng màu, thẻ tay không đè, thứ tự ngày/NULL); cờ `?nguon=1` đúng một chỗ; 6 hàm vẽ chạy thật trên 14 kịch bản (0/1/3/5 lệnh, 7 phiếu, backend cũ, XSS, tooltip, bấm "+N" chỉ xổ đúng dòng) |

**Không có migration. Không đổi dữ liệu. `module.nhapkho.js` không đổi.**

Rà chéo độc lập 2 vòng: vòng 1 bắt 1 lỗi thật (bộ tự kiểm có `*/` trong comment — đúng bài học v8.61) + fallback in lệnh che việc quên copy `module.qlsx.js` (nay toast báo rõ); vòng 2 bắt payload phình trên endpoint dùng chung (→ cờ `?nguon=1`) + thiếu kịch bản hai lệnh cùng NULL ngày (→ đã thêm).

## 4. Deploy

> 🔴 `server\D:\QLSX` là máy chạy thật. **Copy đủ 4 file.** Thiếu `module.qlsx.js` thì bấm lệnh ra toast *"module.qlsx.js trên máy chủ chưa cập nhật v8.97"* — cố ý, không phải lỗi.

**Bước 1 — kiểm tại C:**
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\khohang.js
node --check frontend\js\module.khohang.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_lenh_sx_the_kho.js
```
Dòng cuối phải `0 sai`. (Thiếu `jsdom` thì bộ kiểm tự bỏ qua một mục, không tính là sai.)

**Bước 2 — copy 4 file sang `server\D:\QLSX\`**
```
backend\routes\khohang.js
frontend\js\module.khohang.js
frontend\js\module.qlsx.js
frontend\index.html
```

**Bước 3 — máy chủ**
```powershell
pm2 restart qlnoibo
findstr /C:"layNguonHangTheoMaHang" D:\QLSX\backend\routes\khohang.js
findstr /C:"oPhieuNhapHtml" D:\QLSX\frontend\js\module.khohang.js
findstr /C:"printLenhSanXuat, openOrderDetail" D:\QLSX\frontend\js\module.qlsx.js
findstr /C:"module.khohang.js?v=" D:\QLSX\frontend\index.html
```
Bốn dòng đều ra kết quả, dòng cuối `?v=8.97`. Ctrl+F5.

**Bước 4 — thử**
1. Thẻ kho hàng hóa → một mã Nhà SX từng nhập từ lệnh: cột Nguồn hàng có *Lệnh: DH…* và *Phiếu: NK…*. Rê chuột vào từng mã thấy tooltip.
2. Bấm mã lệnh → modal *Chi tiết đơn hàng — DH…* mở ngay trên trang; bấm số phiếu → modal *Phiếu nhập kho NK…* mở (có In / Xuất Excel).
3. Một mã Đặt ngoài: không có dòng Lệnh, có dòng Phiếu (phiếu NCC).
4. Mã có ≥ 4 phiếu: thấy 3 số + *+N phiếu nữa*; bấm chỉ xổ dòng Phiếu, dòng Lệnh không đổi.
5. Ô tìm kiếm: gõ một số phiếu `NK26…` → chỉ còn các mã hàng của phiếu đó; gõ mã lệnh → các mã của lệnh đó.
6. Xuất Excel → có cột *Mã đơn hàng SX* và *Phiếu nhập kho* có dữ liệu.
7. Mở tab **Bán hàng** → vẫn nhanh như cũ (tab đó không gửi `?nguon=1`).
8. Tài khoản **không có quyền QLSX**: bấm mã lệnh → toast báo không có quyền, không treo.

**Bước 5** — commit `"v8.97 the kho: cot nguon hang hien lenh SX + phieu nhap, bam mo duoc"` → push.

## 5. Ngoài phạm vi (nói trước)

- Popup phiếu nhập mở từ thẻ kho: nút **Sửa** chỉ hiện nếu trong phiên đã từng mở tab *Phiếu nhập kho* (biến quyền của `module.nhapkho.js` chỉ nạp khi vào tab đó — hành vi có từ v6.83, form Sửa thẻ kho cũng vậy). Sửa một dòng trong `xemPhieu` là xong, nhưng là thêm một file nữa phải copy — anh cần thì nói.
- Popup *Lịch sử* của mã hàng (bấm vào mã) chưa hiện lệnh/phiếu.
