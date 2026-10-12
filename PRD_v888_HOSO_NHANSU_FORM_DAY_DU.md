# PRD v8.88 — Form thêm/sửa nhân sự có luôn Tải file và Người phụ thuộc

Trạng thái: **ĐÃ VIẾT CODE** — chờ chạy thử.
Ngày: 2026-10-12
Đi cùng đợt với: `PRD_v887_CONGNO_KH_LOC_KY.md` (Nguyen chốt làm cả hai trong một đợt).

**Hai điểm đổi so với thiết kế ban đầu, do rà chéo:**

1. **Lúc thêm mới gửi `soNguoiPhuThuoc = 0`**, không gửi `nptCho.length`. Các dòng `NguoiPhuThuoc`
   chèn SAU khi tạo nhân viên; gửi 2 rồi cả hai lần chèn đều hỏng là cột còn nguyên 2 trong khi bảng
   rỗng ⇒ **payroll cho 2 suất giảm trừ gia cảnh cho người không có ai phụ thuộc**, không ai phát
   hiện. `dongBoSoNPT()` ở backend chạy sau mỗi lần chèn và là nơi duy nhất được ghi cột này.
2. **Thêm `type="button"` cho các nút của `veDinhKem()` / `veNguoiPhuThuoc()`.** Hai khối này trước
   đây chỉ nằm ở màn Hồ sơ (không có `<form>`) nên thiếu `type` không sao; đặt vào trong
   `<form id="nvForm">` thì trình duyệt coi là nút submit — **bấm "Xóa file" là lưu luôn hồ sơ**.

⇒ Mục 6 (Rủi ro) bên dưới **không còn**: không cần rà SQL trước khi deploy nữa, vì đường Sửa gửi
đúng số đang hiện trên ô (bằng số dòng thật), còn đường Thêm mới gửi 0.

---

## 1. Vấn đề

Nguyen (2026-10-12): *"Hồ sơ nhân sự khi thêm mới nhân sự có thêm chức năng tải file liên quan. Hiện
tại thêm xong vào hồ sơ mới có chỗ tải file lên. Chức năng thêm mới, sửa đều có luôn. Thêm người
phụ thuộc."*

Hiện form **Thêm nhân viên mới** / **Sửa hồ sơ** chỉ có các ô dữ liệu và ảnh chân dung. Hai khối
**Tải file liên quan** và **Người phụ thuộc** nằm ở màn Hồ sơ (xem chi tiết). Người làm nhân sự phải
làm hai lượt: tạo nhân viên → tìm lại trong danh sách → mở hồ sơ → mới đính được giấy tờ.

## 2. Vì sao hiện chưa có

Hai khối đó gọi `POST /api/hrm/nhanvien/:id/dinhkem` và `.../nguoiphuthuoc` — **cần `NhanVienID`**,
mà lúc thêm mới thì chưa có.

Cách giải đã có sẵn trong chính form này: **ảnh chân dung** lúc thêm mới cũng không có ID. Nó tải
file lên trước qua `POST /api/hrm/upload` (route này không cần ID, chỉ trả **tên lưu** trên đĩa), giữ
tên lưu trong ô ẩn, rồi ghi cùng lúc bấm Thêm. Làm y như vậy cho hai khối còn lại.

---

## 3. Thiết kế

### Hai chế độ, cùng một giao diện

| | Sửa (đã có ID) | Thêm mới (chưa có ID) |
|---|---|---|
| Đính kèm | Ghi ngay như hiện nay — **không đổi** | Tải file lên ngay, giữ `{TenFile, TenLuu, LoaiGiayTo, GhiChu}` trong bộ nhớ |
| Người phụ thuộc | Ghi ngay như hiện nay — **không đổi** | Giữ bản ghi trong bộ nhớ |
| Lúc bấm Lưu | Như hiện nay | `POST /nhanvien` → lấy `NhanVienID` → ghi lần lượt các mục đang chờ |

Danh sách đang chờ hiển thị **y như danh sách thật** (cùng bảng, cùng nút Xóa), thêm một dòng ghi chú
*"Các mục này được lưu khi bấm Thêm nhân viên"* — người dùng phải biết chúng chưa nằm trong CSDL.

### Ô "Số người phụ thuộc"

Chuyển thành **chỉ đọc, tự đếm theo danh sách** trong form.

Lý do: backend `dongBoSoNPT()` đã tự đếm từ bảng `NguoiPhuThuoc` và ghi đè cột `SoNguoiPhuThuoc`.
Để ô nhập tay bên cạnh một danh sách là hai nguồn cho cùng một con số — người dùng gõ 3, lưu xong
thành 1, không báo gì. **Con số này vào thẳng giảm trừ gia cảnh khi tính lương.**

`payroll.js` **không đổi**: vẫn đọc `NhanVien.SoNguoiPhuThuoc` như cũ.

### Ghi phần phụ lỗi sau khi nhân viên đã tạo

**Không xóa nhân viên vừa tạo.** Rollback ở đây là xóa mất cả hồ sơ người dùng vừa gõ vì một file
hỏng — tệ hơn nhiều so với thiếu một đính kèm.

Xử lý: ghi được bao nhiêu thì ghi, đếm số mục hỏng, báo
*"Đã lưu nhân viên. Còn N mục chưa ghi được: …"* rồi **mở luôn màn Hồ sơ** của nhân viên đó để bổ
sung ngay. Lưu nhân viên hỏng thì dừng hẳn, không ghi gì thêm.

### File rác khi bấm Hủy

File tải lên nằm trên đĩa ngay lúc chọn. Bấm Hủy ⇒ file đã lên `uploads_hr/` mà không có bản ghi nào
trỏ tới. **Ảnh chân dung hiện cũng đang như vậy từ v8.80** — không phải vấn đề mới.

Đợt này **không xử lý**, chỉ ghi nhận. Dọn file mồ côi là việc riêng (cần quét đối chiếu bảng
`HoSoDinhKemNhanVien` + cột `AnhDaiDien`, chạy định kỳ) — gộp vào đây là làm một việc khác giữa chừng.

---

## 4. Phạm vi

**Trong**: `frontend/js/module.hrm.js` — form thêm/sửa nhân viên · bộ tự kiểm · bump `?v=`.

**Ngoài**: ❌ sửa backend (ba route đã đủ dùng) · ❌ migration · ❌ dọn file mồ côi ·
❌ `payroll.js` · ❌ đổi khối đính kèm/NPT ở màn Hồ sơ (dùng lại nguyên hàm, không viết bản thứ hai).

---

## 5. Cách nghiệm thu

1. **Thêm mới**: điền hồ sơ, đính 2 file, thêm 2 người phụ thuộc, bấm Thêm → mở lại hồ sơ thấy đủ
   2 file + 2 người; ô Số người phụ thuộc = **2**.
2. **Thêm mới rồi bấm Hủy** → không có nhân viên nào được tạo, không có bản ghi đính kèm nào.
3. **Sửa**: mở hồ sơ cũ, thêm 1 file → ghi ngay như trước, **không chờ bấm Lưu** (giữ đúng hành vi cũ).
4. Xóa hết người phụ thuộc → ô Số người phụ thuộc = **0**, lương kỳ sau giảm trừ đúng 0 người.
5. Thêm mới mà **không** đính gì → chạy y như trước khi sửa.

---

## 6. Rủi ro

⚠️ **Số người phụ thuộc đi vào lương.** Đổi ô nhập tay thành tự đếm nghĩa là: nhân viên nào đang có
`SoNguoiPhuThuoc` gõ tay mà **chưa nhập danh sách NPT**, lần sau mở form và bấm Lưu sẽ bị đếm về 0 —
giảm trừ gia cảnh mất, thuế TNCN tăng.

🔴 **Phải rà trước khi deploy**: đếm xem có bao nhiêu nhân viên `SoNguoiPhuThuoc > 0` nhưng không có
dòng nào trong bảng `NguoiPhuThuoc`. Có thì phải nhập danh sách cho họ trước, hoặc hoãn phần đổi ô
này sang đợt sau. Tôi sẽ kèm câu SQL đối chiếu trong hướng dẫn deploy.
