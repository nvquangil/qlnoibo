# PRD v9.13 — Khung Tách dải size sống lại (bị async xoá từ v8.79) + Giao/Nhận in thêu theo dải

**Ngày:** 2026-10-31 · **Nguyen:** *"đang ở công đoạn cắt nhưng không có nút tách size. kiểm tra luôn: nếu tách size thì từ giao in thêu đến kho nhập các công đoạn đều có 2 dải."*

## 1. 🔴 Vì sao đứng ở Cắt mà vẫn không thấy nút — nguyên nhân THẬT, không phải v9.12 thiếu

v9.12 sửa đúng cái cổng hệ số, nhưng khung vẫn không hiện vì một lỗi **khác, có từ v8.79 (10/10)**:

Nhánh Cắt của form Ghi tiến độ chèn khung "Dải size" **đồng bộ** (`renderDaiSizeBar` cuối nhánh). Nhưng `renderCatMultiSoDo` — hàm vẽ khu nhập sổ cắt — là **async**: nó `await` tải sổ cắt rồi mới `box.innerHTML = ...`. Ghi đè đó chạy **sau** nên **xoá sạch khung dải** — khung sống được vài mili-giây rồi biến mất, mắt thường không kịp thấy.

Trước v8.79, lệnh 1 sơ đồ đi nhánh phẳng (đồng bộ) nên khung sống — Nguyen dùng được tuần đầu tháng 10. v8.79 đẩy **mọi** lệnh có sơ đồ vào nhánh async ⇒ khung biến mất trên mọi lệnh từ 10/10. Khớp từng chữ với *"trước có làm rồi mà giờ không nhìn thấy"*.

**Vá:** vẽ lại khung ngay sau **cả hai** chỗ ghi đè `innerHTML` trong `renderCatMultiSoDo`. Kèm: khung có `id` + tự dọn bản cũ (idempotent); khối "Sổ cắt đã ghi nhận" cũng tự dọn (trước đây hai fetch chạy đua thi thoảng chèn **hai khối chồng nhau**) và chèn **sau** khung dải — giữ đúng chủ đích v8.59.1 "dải size nằm đầu form".

## 2. Rà chuỗi công đoạn — trả lời câu "từ giao in thêu đến kho nhập"

| Công đoạn | Nở 2 dòng theo dải? |
|---|---|
| May · QC · Đóng gói · Kho nhập | ✅ có sẵn từ v8.59 (`dongNhapList`) |
| Giao gia công / Nhận gia công | ✅ có sẵn (5a/5b) |
| **Giao in thêu / Nhận in thêu** | ❌ **chưa có — v9.13 làm nốt** |

**v9.13 thêm cho In thêu:** ô chọn **Dải size** trên từng dòng giao (lệnh không tách thì form y như cũ); bảng dòng đã giao + bảng **SL nhận** đều có cột Dải (dòng cũ chưa gắn dải mang badge đỏ *chưa gắn dải*); nút **⊞ Mỗi hạng mục một dòng** nay nở theo **hạng mục × dải** (và hiện cả khi 1 hạng mục × nhiều dải — điều kiện cũ `>1 hạng mục` làm nút biến mất đúng ca đó); sửa luôn `colspan` bảng nhận vốn sai sẵn.

**Backend:** `getInTheList` trả `DaiSizeID + TenDai` (dò cột `coCotQLSX` — cột có từ migration_v859, **tới nay chưa ai đọc/ghi**); `POST /inthe` ghi `DaiSizeID` và **chặn ở server**: lệnh đã tách ⇒ mỗi dòng phải mang một dải **của chính lệnh**. Nhân tiện bịt luôn lỗ cùng loại ở **Giao gia công** — v8.59 chỉ chặn ở form, gọi API thẳng vẫn ghi được dòng không dải trong khi **lương gia công đã tra đơn giá theo dải từ v8.60** (dòng không dải rơi về giá "áp mọi dải" — sai tiền im lặng).

## 3. File

| File | Gì |
|---|---|
| `frontend/js/module.qlsx.js` | vẽ lại khung dải sau 2 chỗ innerHTML async; khung dải + khối sổ cắt idempotent, đúng thứ tự; In thêu: ô dải, 2 cột bảng, ⊞ hạng mục × dải, validate lưu |
| `backend/routes/qlsx.js` | `getInTheList` + `POST /inthe` có `DaiSizeID` (dò cột) + gate server; gate server cho `POST /nhagiacongchitiet` |
| `frontend/index.html` | `module.qlsx.js?v=9.13` |
| `backend/utils/kiem_he_so_hieu_luc.js` | thêm mục 5/6/7 (khung không bị xoá, in thêu có dải, bump) |

**Không migration** (cột `DonHangNhaInTheu.DaiSizeID` đã có từ v859 — anh chạy 01/10). **Tiền không đổi**: lương in thêu vẫn khớp đơn giá theo TÊN hạng mục.

## 4. Rà chéo

Bắt 1 chặn deploy + 2 OK-oan trong bộ kiểm — **lần thứ 5 cùng mẫu lỗi**: phép so chuỗi viết theo bản cũ của chính tôi (v9.13 thêm tham số thứ 5 vào `openTachDaiSizeModal`, regex cũ đòi `perm)`). Đã sửa cả ba + ghi đậm vào bộ nhớ. Xác nhận sạch: scope/closure đúng; không còn đường nào xoá khung; `getInTheList` chỉ một nơi gọi, 2 cột mới không vỡ chỗ nào; cú pháp soi tay sạch (vẫn phải `node --check`).

## 5. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_he_so_hieu_luc.js
```

`0 sai` → copy 3 file: `backend\routes\qlsx.js` · `frontend\js\module.qlsx.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5.

**Thử:**

1. 🔴 Ghi tiến độ → **Cắt** (lệnh nào cũng được): khung xanh **"Dải size của lệnh"** + nút 📏 **đứng yên ở đầu form** — không còn biến mất sau nửa giây tải.
2. Lệnh hệ số 11 → 📏 → `2-7`=6, `8-12`=5 → Lưu (đối chiếu *(theo SỔ CẮT)*).
3. **Giao in thêu**: mỗi dòng có ô **Dải size**; bấm **⊞** → nở hạng mục × 2 dải; bỏ chọn dải một dòng → Lưu bị chặn ngay cả khi gọi API thẳng.
4. **Nhận in thêu**: bảng có cột Dải, ghi SL nhận theo từng dải.
5. May/QC/Đóng gói/Kho nhập: mỗi màu 2 dòng `· 2-7` / `· 8-12` (60/50 với cây 10 lớp) — có sẵn, kiểm lại cho đủ chuỗi.
6. Lệnh KHÔNG tách dải: mọi form y như cũ, không cột thừa.

**Commit:** `"v9.13 dai size: khung tach dai song lai (bi async innerHTML xoa tu v8.79) + giao/nhan in theu theo dai + gate server cho ca gia cong"`

## 6. Nói trước

- **Đơn giá in thêu THEO DẢI chưa làm** (bước 5c của v8.59): `DonHangDonGiaInThe.DaiSizeID` vẫn chưa ai đọc/ghi; lương/công nợ nhà in khớp giá theo TÊN hạng mục — hai dải hiện **cùng một giá**. Màn hình giờ theo dõi theo dải nhưng giá chưa phân biệt — khi nào giá hai dải thật sự khác nhau thì phải làm nốt 5c (+ đơn giá may theo dải 5d), nói là tôi làm.
- Dòng giao in thêu **cũ** (trước khi tách): badge đỏ *chưa gắn dải*; muốn gắn thì xóa dòng và giao lại — không sửa tại chỗ, tránh gán nhầm dải cho số đã chốt với nhà in.
- Sau khi lưu tách dải, modal Ghi tiến độ **tự đóng và mở lại** để nạp dải mới — nó mở về công đoạn hiện tại của lệnh, anh đang đứng ở công đoạn khác thì chọn lại trong ô "Công đoạn".
