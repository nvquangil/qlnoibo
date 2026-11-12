# PRD v9.24 — Ô chọn cây vải ở công đoạn Cắt hiện thêm KG và MÉT

**Ngày:** 2026-11-05 · **Yêu cầu:** Nguyen · **Trạng thái:** viết xong, CHƯA deploy
**Không có migration.** Đi chung đợt với v9.23 (cùng hai file `qlsx.js` + `module.qlsx.js`).

---

## 1. Vấn đề

Nguyên văn: *"công đoạn cắt cột mã cây khi chọn cây list hiển thị mã cây hiển thị thêm số kg và số
mét. hiện tại hiển thị mỗi mã cây"*.

Vải quản lý theo **kg hoặc theo mét** tùy loại. Ô chọn cây chỉ cho đọc mã cây (và ở form Cắt là mã
cây + loại + màu + KG) thì người cắt phải tra ngược sang kho vải mới biết cây đó được cấp bao nhiêu.

## 2. Đã làm

**Hai ô chọn cây, cùng một cách hiển thị:**

| Màn | Trước | Sau |
|---|---|---|
| Ghi tiến độ → **Cắt** | `CAY-01 — Cotton Trắng (đã xuất 25 KG, xuất 12/10)` | `CAY-01 — Cotton Trắng (đã xuất 35 KG · 84 m, xuất 12/10 – 20/10)` |
| **Sửa sổ cắt** | `CAY-01 · Cotton · Trắng` | `CAY-01 · Cotton · Trắng — đã xuất 35 KG · 84 m` |

Số là phần **ĐÃ CẤP cho chính lệnh này** (`PhieuXuatVaiChiTiet.KGXuat` + `.SoMet`), **không phải**
số của cả cây lúc nhập — cây nhập 300 m mới cấp 60 m mà hiện 300 là người cắt tưởng còn thừa vải.
Cây chỉ quản theo kg (không có mét) thì không in chữ thừa.

**🔴 Gom theo cây (rà chéo chỉ ra):** một cây xuất cho lệnh qua **nhiều phiếu** thì trước đây form
Cắt hiện mấy dòng trùng mã cây chỉ khác ngày, còn màn Sửa sổ cắt chỉ lấy dòng đầu. Nay cả hai dùng
chung `gomCayDaXuat()`: một cây = một dòng, KG/mét **cộng dồn**, ngày hiện thành khoảng
`12/10 – 20/10`. Hai màn nói cùng một con số.

## 3. File đã sửa

| File | Việc |
|---|---|
| `backend/routes/qlsx.js` | `getVaiCayDaXuatChoDon`: thêm `ct.SoMet AS MetGiao` |
| `frontend/js/module.qlsx.js` | `soKgMet()` + `gomCayDaXuat()` + `chuoiNgayXuat()` (mức module, dùng chung); `labelForGiaoVai`; `nhanApp` của Sửa sổ cắt; `giaoVaiList` gom theo cây |
| `frontend/index.html` | bump `module.qlsx.js?v=9.24` |
| `backend/utils/kiem_chon_cay_kg_met.js` | **MỚI** — bộ tự kiểm (không copy sang D:\) |

## 4. Lệnh chạy (PowerShell)

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_chon_cay_kg_met.js
```

Copy `backend\routes\qlsx.js`, `frontend\js\module.qlsx.js`, `frontend\index.html` sang `D:\QLSX`
(đi chung đợt v9.23 — xem PRD_v923 mục 5, **migration chạy trước pm2 restart**).

## 5. Nghiệm thu

1. Ghi tiến độ → Cắt → ô "Cây vải (đã xuất cho đơn)": mỗi cây **một dòng**, có `KG · m` và ngày.
2. Cây chỉ có kg (vải quản theo cân): chỉ hiện `25 KG`, không hiện `0 m`.
3. Cây xuất qua hai phiếu: số là **tổng hai phiếu**, ngày hiện khoảng `12/10 – 20/10`.
4. Sửa sổ cắt → ô chọn cây: cùng con số với màn Cắt.
5. Gõ mã cây để tìm vẫn ra; cây đã chọn ở dòng trên vẫn bị ẩn khỏi dòng dưới.

## 6. Chưa làm (nếu cần thì nói)

Bảng **"Xuất vải kèm đơn hàng"** ở màn xem chi tiết lệnh và bản in (`module.qlsx.js:882`, `:6654`)
vẫn chỉ có cột **KG xuất**, chưa có mét — chỗ này lấy dữ liệu từ API khác (`vx.chiTiet`), phải sửa
thêm một câu SQL nữa.
