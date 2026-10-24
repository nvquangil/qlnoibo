# PRD v8.96 — Ảnh từng cây vải: tải ở phiếu nhập, bổ sung ở Tồn theo cây, hiện ở tồn cây / phiếu xuất

**Ngày:** 2026-10-22 · **Yêu cầu của Nguyen:** *"tồn kho cây vải bổ sung hình ảnh cây vải vào mã cây có sẵn. phiếu nhập kho vải thêm cột tải ảnh lên thay vì ảnh ở danh mục màu sắc. cột ảnh ở tồn cây và phiếu xuất lấy theo ảnh ở phiếu nhập"*

## 1. Giả định đã chọn

- Ảnh gắn với **CÂY** (`VaiCay.AnhCay`, migration_v883) — mỗi cây một ảnh.
- **Ảnh màu (v8.94) giữ làm ảnh lùi**: cây chưa có ảnh riêng thì hiện ảnh màu; có ảnh riêng thì ảnh cây thắng. Tab *Tồn kho vải* (theo mã) không có cây để gắn nên vẫn ảnh màu. Nếu anh muốn **bỏ hẳn** ảnh màu thì nói — xóa một vế trong `bieuThucAnhCay`.
- "Tải ảnh lên" = chọn từ thư viện **hoặc** chụp — không ép mở camera (rà chéo chỉ ra: `capture="environment"` làm iOS/Android mất lựa chọn Thư viện).

## 2. Thay đổi

| Chỗ | Gì |
|---|---|
| **Phiếu nhập — tạo & sửa** | cột **Ảnh** mỗi dòng: xem trước · 📷 chọn file · ✕ bỏ. Upload lúc bấm Lưu; upload hỏng ⇒ không lưu phiếu. Dòng khóa (đã phát sinh giao dịch) **vẫn sửa được ảnh**. Nháp chỉ giữ URL đã upload. |
| **Tồn theo cây** | nút 📷 cạnh ảnh (quyền edit): chọn file là upload + lưu ngay, vẽ lại ô, không tải lại trang. `PUT /api/khovai/cay/:cayId/anh`. |
| **Popup xem phiếu nhập** | + cột Ảnh (12 cột). |
| **Form xuất / popup xem xuất / bản in / cây theo NCC / cây theo phiếu nhập / cây theo đơn** | ảnh cây (lùi về màu) qua `ganAnhTheoCay` / `bieuThucAnhCay`. |
| Backend | `chuanAnhCay` chỉ nhận `/uploads/<file>` — URL lạ ⇒ **báo lỗi 400**, không nuốt; PUT sửa phiếu không gửi khóa `anhCay` thì giữ nguyên (form cũ trong cache không xóa ảnh). |

File: `database/migration_v883.sql` *(mới)* · `backend/utils/anhMau.js` · `backend/routes/khovai.js` · `frontend/js/module.khovai.js` · `frontend/index.html` (khovai 8.96).

## 3. Deploy

> 🔴 `server\D:\QLSX` là máy chạy thật. **Copy đủ 4 file cùng lúc** — frontend 8.96 với backend cũ là `anhCay` bị bỏ qua im lặng, ảnh thành file mồ côi.

**Bước 1 — kiểm tại C:**
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\anhMau.js
node --check backend\routes\khovai.js
node --check frontend\js\module.khovai.js
node backend\utils\kiem_in_phieu_xuat_tra_ncc.js
node backend\utils\kiem_be_rong_cot_form.js
node backend\utils\kiem_tong_tien_phieu_nhap_vai.js
```
Ba bộ kiểm phải `0 sai`.

**Bước 2 — migration** (SSMS → `migration_v883.sql`), trước restart.

**Bước 3 — copy 4 file sang `server\D:\QLSX\`**
```
backend\utils\anhMau.js
backend\routes\khovai.js
frontend\js\module.khovai.js
frontend\index.html
```

**Bước 4 — máy chủ**
```powershell
pm2 restart qlnoibo
findstr /C:"ganAnhTheoCay" D:\QLSX\backend\utils\anhMau.js
findstr /C:"kiemAnhCayHopLe" D:\QLSX\backend\routes\khovai.js
findstr /C:"uploadAnhCayRows" D:\QLSX\frontend\js\module.khovai.js
findstr /C:"module.khovai.js?v=" D:\QLSX\frontend\index.html
```
Bốn dòng ra kết quả, dòng cuối `?v=8.96`. Ctrl+F5.

**Bước 5 — thử**
1. Kho vải → Tồn theo cây → bấm 📷 ở một cây → chọn ảnh → ô hiện ảnh ngay, toast "Đã lưu ảnh cây". F5 vẫn còn.
2. Tạo phiếu nhập: 2 dòng, dòng 1 chọn ảnh, dòng 2 không → Lưu → popup xem: dòng 1 ảnh riêng, dòng 2 ảnh màu (nếu màu có ảnh) hoặc trống.
3. Sửa phiếu đó: đổi KG dòng 1, không đụng ảnh → Lưu → ảnh **vẫn còn**. Bấm ✕ dòng 1 → Lưu → dòng 1 lùi về ảnh màu/trống.
4. Tạo phiếu xuất → chọn cây dòng 1 → ô Ảnh hiện ảnh **cây**, không phải ảnh màu. Xem phiếu, In: cùng ảnh.
5. Điện thoại: bấm 📷 phải hiện cả **Chụp** lẫn **Thư viện**.

**Bước 6** — `node database\tao_file_cai_dat.js` → commit `"v8.96 anh tung cay vai (migration_v883)"` → push.
