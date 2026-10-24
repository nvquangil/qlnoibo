# PRD v9.01 — Ô tìm ký tự bất kỳ ở 5 danh sách phiếu

**Ngày:** 2026-10-24 · **Nguyen:** *"thẻ kho hàng hóa: phiếu nhập thêm tìm kiếm ký tự bất kỳ. thẻ kho vải, thẻ kho phụ kiện: phiếu nhập kho, phiếu xuất kho thêm tìm kiếm ký tự bất kỳ"*

## 1. Cách làm

Dùng **đúng ô tìm dùng chung** đã có (`searchBoxHtml` + `wireTableSearch`, common.js v8.72 — cùng luật với Danh sách lệnh SX, Danh mục phụ kiện, Tài liệu kỹ thuật): lọc ẩn/hiện dòng trong bảng **đã tải**, **tách từ khớp hết** ("cty a 10/2026" ra dòng có cả hai), **bỏ dấu** ("nguyen" khớp "Nguyễn"), không gọi lại API. Bên cạnh ô có chữ *Hiện x/y dòng*.

| Màn | Tìm được theo |
|---|---|
| Thẻ kho hàng hóa → **Phiếu nhập kho** | số phiếu, ngày, loại nhập, NCC / lệnh SX, số HĐ, số dòng, SL, tiền, trạng thái — **kết hợp** với bộ lọc Từ ngày/Đến ngày/Loại/Số phiếu có sẵn (bộ lọc đó gọi API, ô tìm lọc trong kết quả) |
| Kho vải → **Phiếu nhập kho** | số phiếu NKV-, ngày, NCC, số HĐ, số cây, KG, mét, tiền, người tạo, ghi chú |
| Kho vải → **Phiếu xuất kho** | số phiếu XKV-, ngày, mã đơn/lệnh, người nhận, số cây, KG, mét, người tạo |
| Kho phụ kiện → **Phiếu nhập kho** | số phiếu NPK-, ngày, NCC, số HĐ, số dòng, SL, người tạo, ghi chú |
| Kho phụ kiện → **Phiếu xuất kho** | số phiếu XPK-, ngày, đơn hàng, mã rập, số dòng, SL, người tạo, ghi chú |

Cột *Thao tác* gắn `data-notim` — chữ trên nút ("Xem", "Sửa") không lọt vào chuỗi tìm (bài học v7.92). Dòng TỔNG ở `tfoot` không bị ẩn; **vẫn là tổng của cả danh sách**, không cộng lại theo lọc.

**Giới hạn nói trước:** tìm theo **cột đang hiện**, không tìm vào dòng chi tiết bên trong phiếu (mã hàng / mã cây / tên phụ kiện). Muốn "phiếu nào có mã X" thì: hàng hóa → cột Nguồn hàng ở Thẻ kho (v8.97) liệt kê phiếu theo mã; vải → Tồn theo cây tìm mã cây (v8.73). Nếu anh vẫn muốn tìm theo chi tiết ngay ở danh sách phiếu thì nói — backend phải trả thêm chuỗi mã hàng/mã cây mỗi phiếu.

## 2. File

`frontend/js/module.nhapkho.js` (`taiBang`) · `frontend/js/module.khovai.js` (`renderNhap`, `renderXuat`) · `frontend/js/module.phukien.js` (`renderPhieuNhap`, `renderPhieuXuat`) · `frontend/index.html` (ba file lên `?v=9.01`) · `backend/utils/kiem_tim_kiem_phieu.js` *(mới)*. **Chỉ frontend.**

## 3. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.nhapkho.js
node --check frontend\js\module.khovai.js
node --check frontend\js\module.phukien.js
node backend\utils\kiem_tim_kiem_phieu.js
```
`0 sai` → copy 4 file sang `server\D:\QLSX\`: `frontend\js\module.nhapkho.js`, `frontend\js\module.khovai.js`, `frontend\js\module.phukien.js`, `frontend\index.html` (không cần pm2 restart) →
```powershell
findstr /C:"nkTim" D:\QLSX\frontend\js\module.nhapkho.js
findstr /C:"kvXuatTim" D:\QLSX\frontend\js\module.khovai.js
findstr /C:"pkXuatTim" D:\QLSX\frontend\js\module.phukien.js
findstr /C:"module.phukien.js?v=9.01" D:\QLSX\frontend\index.html
```
**Thử:** mỗi màn gõ tên NCC không dấu → còn đúng các phiếu của NCC đó, *Hiện x/y dòng*; gõ "xem" → bảng **không** co lại (chữ trên nút không được tính); xóa ô → đủ dòng; dòng TỔNG vẫn hiện.

**Commit** `"v9.01 o tim ky tu bat ky o 5 danh sach phieu"`.
