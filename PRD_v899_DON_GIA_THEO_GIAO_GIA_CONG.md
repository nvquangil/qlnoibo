# PRD v8.99 — Đơn giá công đoạn may / Đơn giá giao gia công: chỉ liệt kê lệnh đã giao đúng kênh

**Ngày:** 2026-10-24 · **Nguyen:** *"khi công đoạn giao gia công chọn vào Giao nhà làm thì sẽ đưa lệnh đó vào đơn giá công đoạn may, khi chọn giao gia công thì sẽ đưa lệnh đó vào đơn giá gia công. Hiện tại đang thể hiện cả 2. Khi chưa giao gia công thì chưa đưa vào đơn giá nào cả."*

## 1. Hiện trạng

Hai tab nằm trong *Quản lý sản xuất → Tài liệu may/Đóng gói* (`module.tailieukythuat.js`, nhóm `tlmay`). Danh sách lệnh lấy từ `GET /api/tailieukythuat/orders?loai=dongiamay|dongiagiacong` → `getOrdersWithDocStatus()` — câu này **liệt kê mọi lệnh** cho mọi loại tài liệu, chỉ trừ hai loại in thêu đã lọc theo ô *Có in thêu* (v5.87). Nên hai tab đơn giá hiện hết.

Cờ đã có sẵn: ở công đoạn **Giao gia công** form ghi hai checkbox độc lập `DonHangSanXuat.DaGiaoNhaLam` / `DaGiaoGiaCong` (v5.24; v8.32 đã xác nhận ghi xuống CSDL đúng trên DH2609084).

## 2. Quy tắc + giả định (anh thấy sai thì nói)

| Tab | Hiện lệnh khi | Ghi chú |
|---|---|---|
| Đơn giá công đoạn may | `DaGiaoNhaLam = 1` | |
| Đơn giá giao gia công | `DaGiaoGiaCong = 1` | |
| Tick **cả hai** (một phần làm trong, một phần thuê ngoài) | hiện ở **cả hai** tab | đúng nghĩa, không phải lỗi |
| Chưa ghi công đoạn Giao gia công (cả hai = 0) | **không ở tab nào** | đúng yêu cầu |

**Ngoại lệ có chủ đích — tôi không làm đúng 100% câu "chưa giao thì không đưa vào đâu":** lệnh **đã có đơn giá** (đã có dòng trong `DonHangDonGiaCongDoanMay` / `DonHangHangMucGiaCong`) **vẫn hiện** dù chưa tick, kèm nhãn ⚠ *chưa tick Giao nhà làm / Giao gia công* ở cột Trạng thái. Lý do: đó là dữ liệu đã nhập và đang được **lương khoán may** và **công nợ gia công** đọc; giấu đi thì số vẫn chạy mà không ai mở ra sửa/xoá được. Muốn chặt (giấu luôn): bỏ vế `OR EXISTS` ở hai dòng `locGiao` trong backend — một dòng mỗi tab.

Không lọc các tab khác (Thông số kỹ thuật, Mô tả đường may, Là/đóng gói…). Không migration. Dò cột như cách v5.87: CSDL thiếu cột thì không lọc, không gắn nhãn.

## 3. Thay đổi

| File | Gì |
|---|---|
| `backend/routes/tailieukythuat.js` | `getOrdersWithDocStatus`: `locGiao` theo `loai`; SELECT thêm `DaGiaoNhaLam/DaGiaoGiaCong` (NULL khi CSDL chưa có cột) |
| `frontend/js/module.tailieukythuat.js` | dòng ghi chú trên bảng ở 2 tab ("Chỉ hiện lệnh đã tick … ở công đoạn Giao gia công"); nhãn ⚠ cho lệnh có đơn giá nhưng chưa tick |
| `frontend/index.html` | `module.tailieukythuat.js?v=8.99` |
| `backend/utils/kiem_don_gia_theo_giao_gia_cong.js` *(mới)* | bộ tự kiểm; mục 3 **cảnh báo** vị trí ký tự điều khiển — ripgrep báo `module.tailieukythuat.js` là "binary" (có byte NUL) **từ trước**, node vẫn chạy, chỉ in số dòng để anh biết |

## 4. Deploy

**Bước 1 — kiểm tại C:**
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\tailieukythuat.js
node --check frontend\js\module.tailieukythuat.js
node backend\utils\kiem_don_gia_theo_giao_gia_cong.js
```
`0 sai`. Mục 3 có dòng `!!` là cảnh báo, không chặn.

**Bước 2 — copy 3 file sang `server\D:\QLSX\`**
```
backend\routes\tailieukythuat.js
frontend\js\module.tailieukythuat.js
frontend\index.html
```

**Bước 3 — máy chủ**
```powershell
pm2 restart qlnoibo
findstr /C:"locGiao" D:\QLSX\backend\routes\tailieukythuat.js
findstr /C:"nhanChuaGiao" D:\QLSX\frontend\js\module.tailieukythuat.js
findstr /C:"module.tailieukythuat.js?v=" D:\QLSX\frontend\index.html
```
Máy tính Ctrl+F5; điện thoại (đã ở 8.98) tự tải lại khi mở lại app.

**Bước 4 — thử**
1. Lệnh mới chưa qua Giao gia công → không có ở cả hai tab.
2. Ghi tiến độ công đoạn Giao gia công, tick **chỉ Giao nhà làm** → có ở *Đơn giá công đoạn may*, không có ở *Đơn giá giao gia công*. Tick chỉ *Giao gia công* → ngược lại. Tick cả hai → cả hai.
3. Lệnh cũ đã có đơn giá may nhưng chưa tick → vẫn hiện, cột Trạng thái có *⚠ chưa tick Giao nhà làm*.
4. Tab *Thông số kỹ thuật* vẫn liệt kê đủ lệnh như cũ.

**Bước 5** — commit `"v8.99 don gia may/gia cong chi liet ke lenh da giao dung kenh"` → push.
