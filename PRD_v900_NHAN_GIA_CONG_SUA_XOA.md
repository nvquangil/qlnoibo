# PRD v9.00 — Ghi nhận tiến độ · Nhận gia công: Sửa / Xóa từng dòng giao ngay tại công đoạn

**Ngày:** 2026-10-24 · **Nguyen:** *"quản lý sản xuất / ghi tiến độ: ở user admin có thể sửa, xóa ở các công đoạn"* → hỏi lại: thiếu ở **Nhận gia công**; áp theo **quyền Sửa/Xóa của chức năng Ghi tiến độ** (admin luôn có, người khác cấp trong Ma trận phân quyền — không khóa cứng isAdmin, đúng cách v6.18).

## 1. Hiện trạng

Các đợt đã ghi ở Cắt / May / QC / Đóng gói / Kho nhập đều có khối "đã ghi" với Sửa/Xóa. Riêng **Nhận gia công (NGC)** chỉ cho gõ *SL nhận* rồi Lưu; muốn đổi nhà gia công, SL giao, ghi chú hay bỏ một dòng giao nhầm thì phải quay về công đoạn *Giao gia công* — ở đó có Sửa/Xóa (v5.16/v5.30) nhưng người đang ở bước nhận hàng không nghĩ tới.

## 2. Thay đổi — `frontend/js/module.qlsx.js`, nhánh `NGC` (chỉ frontend)

| Nút | Làm gì | Quyền |
|---|---|---|
| **Sửa** (từng dòng) | sửa tại chỗ: nhà gia công (ô gõ-để-tìm), SL giao, ghi chú — gọi `PUT /orders/:maDH/nhagiacongchitiet/:id` **có sẵn** của GC; **không đụng SL nhận** đã ghi | `coQuyenSuaTienDo()` |
| **Xóa** (từng dòng) | `DELETE /orders/:maDH/nhagiacongchitiet/:id` có sẵn; hộp xác nhận nói rõ **mất cả SL nhận** của dòng, công nợ/lương gia công của nhà đó giảm đúng phần này | `coQuyenXoaTienDo()` |
| *Lưu số lượng nhận* | giữ nguyên như v5.30 (`PUT …/nhan`) | như cũ |

Thêm cột **Dải size** ở bảng NGC khi lệnh đã tách dải (trước không có → hai dòng cùng nhà cùng hạng mục khác dải không phân biệt được). Bảng vẽ lại tại chỗ sau mỗi Sửa/Xóa, không đóng modal.

**Không backend, không migration.** Hai route dùng lại vẫn gate `QLSX edit` như từ v5.16 (chung với nút Sửa/Xóa ở công đoạn GC) — gate quyền Sửa/Xóa chức năng Ghi tiến độ nằm ở giao diện. Nếu anh muốn siết backend theo `delete` cho DELETE thì nói — sẽ ảnh hưởng cả nút Xóa ở GC với người chỉ có quyền Sửa.

## 3. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_ngc_sua_xoa.js
node backend\utils\kiem_lenh_sx_the_kho.js
```
`0 sai` cả hai → copy **2 file** sang `server\D:\QLSX\`: `frontend\js\module.qlsx.js`, `frontend\index.html` (không cần pm2 restart) →
```powershell
findstr /C:"renderNgcNhanBox" D:\QLSX\frontend\js\module.qlsx.js
findstr /C:"module.qlsx.js?v=9.00" D:\QLSX\frontend\index.html
```
Ctrl+F5 / điện thoại tự tải lại.

**Thử:** Ghi nhận tiến độ → chọn công đoạn *Nhận gia công* của lệnh đã giao gia công → mỗi dòng có Sửa/Xóa (tài khoản chỉ có quyền Xem chức năng Ghi tiến độ: không có nút). Sửa SL giao → bảng vẽ lại, SL nhận cũ còn nguyên. Xóa một dòng → hộp xác nhận nêu SL nhận → dòng biến mất, công nợ gia công của nhà đó giảm.

**Commit** `"v9.00 nhan gia cong: sua/xoa tung dong giao tai cong doan"`.
