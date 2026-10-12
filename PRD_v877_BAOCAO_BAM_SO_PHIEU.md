# PRD v8.77 — Báo cáo kinh doanh: bấm số phiếu để xem chi tiết chứng từ

Trạng thái: **CHỜ DUYỆT**
Ngày: 2026-10-09

---

## 1. Vấn đề

Ở Báo cáo kinh doanh, bấm vào một mã (vải / phụ kiện / hàng hóa) mở được popup chi tiết xuất nhập.
Popup có cột **Số phiếu** nhưng là chữ thường, không bấm được (`module.baocao.js:182`).
Người xem thấy con số lạ thì phải tự nhớ số phiếu, thoát ra, sang phân hệ khác, tìm lại — hoặc bỏ qua.
Modal **Chi tiết thu chi** ở tab Tài chính cũng y hệt (`module.baocao.js:392`).

---

## 2. Hiện trạng kỹ thuật

### Thuận lợi: cả 3 bảng tồn kho dùng CHUNG một hàm
`renderTonKho(perm, loai)` (`module.baocao.js:228`) và `moChiTietTon()` (dòng 161) phục vụ cả
tồn vải / tồn phụ kiện / tồn hàng hóa. Sửa một chỗ được cả ba.

### Dữ liệu: ba bảng ở ba trạng thái khác nhau

| Route | Đã trả ID phiếu? | Phải làm |
|---|---|---|
| `/tonvai/chitiet` | ✅ `PhieuID` (`baocao.js:993, 1003`) | thêm `CtLoai` |
| `/tonphukien/chitiet` | ✅ `PhieuID` (`baocao.js:1047`) | thêm `CtLoai` |
| `/tonhanghoa/chitiet` | ❌ SQL chỉ `SELECT p.SoPhieu` | thêm `PhieuNKID` / `PhieuBHID` vào SELECT |
| `/taichinh/chitiet` | ❌ | thêm `PhieuThuID` / `PhieuChiID` |

### Đã có sẵn một route đọc chứng từ gần như đầy đủ
`congno.js:1659` — `GET /api/congno/chungtu?loai=&id=` trả `{ tieuDe, header, dong[] }` cho **8 loại**:
`PT · PC · PNV · PNPK · PXPK · PNKH · PNL · PXV`. Đúng bộ mà báo cáo cần, **thiếu đúng một loại: `PBH`**
(phiếu bán hàng — đường xuất của tồn hàng hóa).

Hai chi tiết đã kiểm:
- Nhánh `PXV` (dòng 1773) **không lọc `LaTraNCC`** → dùng được cho cả phiếu xuất vải thường.
  Chỉ tiêu đề đang cứng "Phiếu trả vải NCC", phải sửa theo cờ.
- Quyền route đó là `CONGNO/view`, kèm comment (dòng 1656): *"người xem sổ công nợ phải xem được
  chứng từ tạo ra số đó, không thể bắt họ phải có thêm quyền của phân hệ Kho vải / Phụ kiện"*.
  Nguyên tắc này áp nguyên cho Báo cáo.

### Vì sao KHÔNG gọi chéo hàm của module khác
`openNhapDetailModal` (`khovai.js:347`), `openPhieuNhapDetailModal` (`phukien.js:488`),
`xemPhieuBanHang` (`khohang.js:3631`) đều là closure trong IIFE, **không export**. Route gốc của chúng
gate bằng `KHOVAI`/`PHUKIEN`/`KHOHANG` → người chỉ có quyền Báo cáo bấm vào sẽ nhận **403**.

Repo đã gặp đúng bài này 2 lần và cả 2 lần chọn cùng cách — `congno.js:1088` và `qlsx.js:337`:
tự dựng modal + route riêng gate theo quyền màn hình đang gọi. Comment ở `congno.js:1089` nói rõ lý do:
*"gọi chéo sang là kéo theo cả mớ nút mà người xem sổ công nợ có thể không có quyền dùng. Ở đây chỉ cần XEM."*

---

## 3. 🔴 Rủi ro chính — lớp lỗi đã vỡ ở v7.48

Comment `congno.js:1730` ghi lại nguyên văn:

> *"`soChiTietNCC()` sinh 7 `CtLoai` mà route `/chungtu` chỉ xử lý 4. Sinh ở một bên, đọc ở bên kia,
> hai danh sách không ai buộc phải khớp."*

Hậu quả lần đó: người dùng bấm vào dòng "Nhập kho hàng hóa" thì nhận *"Loại chứng từ không hỗ trợ
xem chi tiết"*. Việc này **thêm 4 chỗ sinh `CtLoai` mới** (3 bảng tồn kho + thu chi) ⇒ đúng điều kiện
để tái phạm.

**Phòng bằng cơ chế, không bằng trí nhớ:**
1. Khai danh sách `CtLoai` hợp lệ ở **một nơi duy nhất** — một hằng exported cạnh `docChungTu()`.
2. Mọi chỗ sinh `CtLoai` lấy từ hằng đó, không gõ chuỗi tay.
3. Mở rộng bộ tự kiểm sẵn có `backend/utils/kiem_chungtu_congno_ncc.js` để đối chiếu
   **danh sách sinh ra ở baocao.js** với **danh sách docChungTu xử lý được** — lệch là test đỏ.

---

## 4. Tiêu chí hoàn thành

1. Ở cả 4 modal (tồn vải, tồn phụ kiện, tồn hàng hóa, chi tiết thu chi), cột Số phiếu là link bấm được.
2. Bấm vào mở modal chi tiết chứng từ **chồng lên** modal đang xem; bấm Đóng/Esc quay lại đúng modal cũ
   (modal stack của `common.js:481` đã lo, không phải viết thêm).
3. Modal chứng từ **chỉ XEM** — không có nút Sửa / Hủy / Xóa.
4. Người chỉ có quyền `BAOCAO/view` bấm được, không cần quyền Kho vải / Phụ kiện / Kho hàng.
5. Dòng không có chứng từ thật (ví dụ "Đơn khách (dữ liệu cũ)" — `baocao.js:945`) **không thành link**,
   không báo lỗi.
6. Bộ tự kiểm chạy xanh, bao gồm phép đối chiếu ở mục 3.

---

## 5. Phạm vi

**Trong phạm vi**
- 3 bảng tồn kho + modal Chi tiết thu chi (Nguyen đã chốt làm cả hai).
- Thêm nhánh `PBH` vào `docChungTu` — `congno.js` cũng hưởng lợi (hiện phải dùng hàm riêng
  `xemPhieuBanHangTuCongNo` ở frontend).
- Sửa tiêu đề `PXV` / `PXPK` để phân biệt "trả NCC" và "xuất thường".

**Ngoài phạm vi**
- ❌ Export các hàm modal của `khovai.js` / `phukien.js` / `khohang.js`.
- ❌ Thêm nút thao tác (sửa/xóa) trong modal chứng từ.
- ❌ Đụng vào phép tính tồn đầu / tồn cuối.

---

## 6. Kế hoạch

| # | Việc | File | Ghi chú |
|---|---|---|---|
| 1 | Tách thân route `/chungtu` thành `docChungTu(pool, loai, id)` + hằng `CT_LOAI`, export cả hai | `backend/routes/congno.js` | route cũ gọi hàm — hành vi không đổi |
| 2 | Thêm nhánh `PBH`; sửa tiêu đề `PXV`/`PXPK` theo `LaTraNCC` | `backend/routes/congno.js` | |
| 3 | Route `GET /chungtu` gate `BAOCAO/view` → gọi `docChungTu` | `backend/routes/baocao.js` | |
| 4 | Thêm `CtLoai` + `CtID` vào 4 route chi tiết | `backend/routes/baocao.js` | `tonhanghoa` phải sửa SQL |
| 5 | `oSoPhieu(r)` + `xemChungTu(loai, id)` + gắn vào 2 modal | `frontend/js/module.baocao.js` | khuôn từ `congno.js:1037` |
| 6 | Bump `?v=` cho `module.baocao.js` | `frontend/index.html` | bắt buộc — file đã deploy |
| 7 | Mở rộng bộ tự kiểm đối chiếu `CtLoai` | `backend/utils/kiem_chungtu_congno_ncc.js` | |
| 8 | `node --check` 3 file backend + mở F12 Console kiểm frontend | — | Nguyen chạy |

Không có migration. Không đụng dữ liệu — **toàn bộ là đọc**, không có bước nào không hoàn tác được.

---

## 7. Câu hỏi mở

Không có. Hai điểm cần quyết đã chốt: route riêng gate `BAOCAO/view`, và làm cả Chi tiết thu chi.
