# PRD v9.04 — Phiếu bán hàng "có quyền sửa mà không sửa được" (PX26609)

**Ngày:** 2026-10-26 · **Nguyen:** *"phiếu bán hàng có phiếu không sửa được dù user có quyền sửa ví dụ PX26609"*

## 1. Chẩn đoán

Backend chặn **cả Sửa lẫn Hủy** khi phiếu bán hàng đã có **phiếu thu** gắn vào — đúng nghiệp vụ: sửa/hủy phiếu sẽ làm số tiền đã thu lệch với công nợ khách.

| Nơi | Luật | Câu thông báo |
|---|---|---|
| `banhang.js` `PUT /phieu/:id` (Sửa) | `SUM(PhieuThu.SoTien) > 0` → chặn | *"Phiếu này đã có phiếu thu N đ — xóa phiếu thu đó trước khi **sửa** phiếu bán hàng."* |
| `banhang.js` `PUT /phieu/:id/huy` (Hủy) | `SUM(PhieuThu.SoTien) > 0` → chặn | *"… trước khi **hủy** phiếu bán hàng."* |
| `banhang.js` `DELETE /phieu/:id` (Xóa) | `COUNT(PhieuThu) > 0` → chặn | *"Phiếu này đang có phiếu thu liên kết — xóa phiếu thu trước."* |

**Lỗi nằm ở màn danh sách**, `module.khohang.js` dòng 3644 (bản cũ):

```js
${perm.canEdit && r.TrangThai !== 'Đã hủy' && !Number(r.DaThu) ? `<button … act-sua …>Sửa</button>` : ''}
${perm.canEdit && r.TrangThai !== 'Đã hủy'                     ? `<button … act-huy …>Hủy</button>` : ''}
```

Phiếu có phiếu thu ⇒ **nút Sửa biến mất hoàn toàn, không một lời giải thích**, trong khi **nút Hủy vẫn hiện**. Người dùng thấy mình có quyền, thấy nút Hủy, mà nút Sửa không có ⇒ kết luận "có quyền sửa mà không sửa được". Câu giải thích rõ ràng của backend **không bao giờ tới được mắt người dùng** vì không có nút nào để bấm.

Đây là biến thể tệ hơn của lỗi kinh điển "bấm nút không có gì xảy ra": còn chẳng có nút để bấm.

**Lỗi phụ phát hiện kèm:** điều kiện frontend là `!Number(r.DaThu)` — khóa **mọi** giá trị khác 0, kể cả **âm**. Backend là `> 0`. Phiếu có phiếu thu điều chỉnh/hoàn tiền làm tổng thu âm thì backend **cho sửa** mà frontend vẫn ẩn nút. v9.04 đổi thành `> 0` cho khớp.

### Xác nhận PX26609 — thử 10 giây, không cần SQL

Mở **Thẻ kho hàng hóa → Phiếu bán hàng**, tìm PX26609, nhìn cột **Thao tác**:

| Thấy gì | Kết luận |
|---|---|
| Có nút **Hủy**, không có nút **Sửa** | Đúng lỗi này — phiếu đã có phiếu thu. Cột **Đã thu** của dòng đó sẽ khác 0. |
| **Không có** cả Hủy lẫn Sửa lẫn Xóa | Không phải lỗi này — user thiếu quyền **Sửa** của phân hệ *Thẻ kho hàng hóa* / chức năng *Phiếu bán hàng*. Kiểm trong **Ma trận phân quyền**. |
| Dòng nền hồng, badge **Đã hủy** | Phiếu đã hủy — không sửa được là đúng, phải lập phiếu mới. |

Muốn chắc bằng số (SSMS, chỉ đọc):

```sql
SELECT p.PhieuBHID, p.SoPhieu, p.NgayBan, p.TenKhach, p.TrangThai, p.TongThanhToan,
       ISNULL((SELECT SUM(t.SoTien) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID), 0) AS DaThu,
       (SELECT COUNT(*) FROM PhieuThu t WHERE t.PhieuBHID = p.PhieuBHID) AS SoPhieuThu
FROM PhieuBanHang p WHERE p.SoPhieu = N'PX26609';

SELECT t.PhieuThuID, t.SoPhieu, t.NgayThu, t.SoTien, t.HinhThuc, t.DienGiai
FROM PhieuThu t JOIN PhieuBanHang p ON p.PhieuBHID = t.PhieuBHID
WHERE p.SoPhieu = N'PX26609' ORDER BY t.NgayThu, t.PhieuThuID;
```

## 2. Sửa

| File | Gì |
|---|---|
| `backend/routes/banhang.js` | **Mới** `GET /phieu/:id/phieuthu` — liệt kê phiếu thu đang chặn, trả kèm `tongDaThu` (số **tươi**). Gate bằng **`KHOHANG/view` + chức năng Phiếu bán hàng**, **không** dùng `CONGNO/view` (người bán hàng thường không có quyền Công nợ ⇒ 403 ⇒ lại thành nút câm). Chỉ đọc. `DienGiai` cắt còn 120 ký tự — phiếu thu "Chuyển thẳng" tự sinh diễn giải kèm **tên nhà cung cấp**, không cần phơi hết sang phân hệ bán hàng. |
| `frontend/js/module.khohang.js` | Nút Sửa và Hủy **luôn hiện** khi có quyền + phiếu chưa hủy. Khi `DaThu > 0` thì hiện ở dạng **🔒 khóa** (viền đứt, mờ); bấm vào mở modal nói rõ *"đây không phải vấn đề quyền"*, liệt kê phiếu thu đang chặn và chỉ 3 bước xử lý, kèm nút **🔄 Tải lại danh sách**. Điều kiện đổi `!Number(r.DaThu)` → `Number(r.DaThu) > 0`. Cột Thao tác thêm **`data-notim`**. |
| `frontend/index.html` | `module.khohang.js?v=9.04` |
| `backend/utils/kiem_sua_phieu_ban_hang.js` *(mới, **không copy sang D:\QLSX** — công cụ chạy ở C)* | 7 nhóm, 30 phép kiểm. |

**Không migration. Không đổi luật nghiệp vụ** — vẫn chặn như cũ, chỉ nói ra lý do.

## 3. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\banhang.js
node --check frontend\js\module.khohang.js
node --check backend\utils\kiem_sua_phieu_ban_hang.js
node backend\utils\kiem_sua_phieu_ban_hang.js
```

`0 sai` → copy **đúng 3 file** sang `server\D:\QLSX\` (file `kiem_*.js` là công cụ, **không copy**):

- `backend\routes\banhang.js`
- `frontend\js\module.khohang.js`
- `frontend\index.html`

```powershell
pm2 restart qlnoibo
findstr /C:"phieu/:id/phieuthu" D:\QLSX\backend\routes\banhang.js
findstr /C:"act-khoa" D:\QLSX\frontend\js\module.khohang.js
findstr /C:"module.khohang.js?v=9.04" D:\QLSX\frontend\index.html
```

**Thử:**

1. Mở PX26609 → cột Thao tác phải có **🔒 Sửa** và **🔒 Hủy** (viền đứt).
2. Bấm **🔒 Sửa** → modal hiện danh sách phiếu thu đang chặn + 3 bước xử lý.
3. Vào **Công nợ → Phiếu thu**, xóa phiếu thu đó → quay lại danh sách phiếu bán hàng, **không F5**, bấm lại **🔒 Sửa** → phải hiện *"Phiếu thu đã được xóa rồi…"* và tự tải lại, nút Sửa trở lại bình thường.
4. Phiếu **chưa thu đồng nào** → nút Sửa/Hủy bình thường như trước, không đổi gì.
5. Gõ **"sua"** vào ô tìm của danh sách phiếu bán hàng → **không** được ra nguyên bảng (cột Thao tác đã có `data-notim`).

**Commit:** `"v9.04 phieu ban hang: nut Sua/Huy bi khoa phai noi ro ly do thay vi bien mat"`

## 4. Rà chéo bắt được gì (bản viết đầu đã sai 6 chỗ)

| Chỗ | Lỗi bản đầu | Đã sửa |
|---|---|---|
| Modal, nhánh danh sách rỗng | Dùng `data-dathu` (ảnh chụp lúc tải bảng) nên khi kế toán **vừa xóa phiếu thu xong**, màn hình báo *"Số liệu không khớp — báo người quản trị"*. Vu oan cho CSDL đúng lúc người dùng vừa làm đúng | Dùng `tongDaThu` tươi từ API; `tươi = 0` ⇒ báo *"đã xóa rồi"* + tự tải lại danh sách |
| Cột Thao tác | Thiếu `data-notim` từ trước. v9.04 làm nặng thêm: mọi phiếu chưa hủy nay đều mang chữ "Sửa"/"Hủy" ⇒ gõ "sua" ra **nguyên bảng** | Thêm `data-notim` |
| Handler `.act-khoa` | `try/catch` chỉ bọc lời gọi API; `openModal` ném thì nút lại câm | Bọc cả thân hàm |
| `boComment()` trong bộ tự kiểm | Coi `accept="image/*"` là mở comment ⇒ **nuốt 43 dòng code thật** của `module.khohang.js`. Hôm nay vô hại, nhưng là đúng cái bẫy đã vấp 3 lần ở `kiem_ho_so_nhan_su.js` | Bắt buộc `/*` phải đứng sau ký tự mở hợp lệ |
| Phép kiểm "handler phải có catch" | Cửa sổ cắt 3400 ký tự tràn sang handler `.act-xoa` (vốn có sẵn `catch`) ⇒ **không thể trượt** = vô dụng | Cắt đúng tới mốc `.act-xoa` |
| 2 phép kiểm nội dung modal | Test trên bản **còn comment** ⇒ xóa modal mà để lại comment vẫn ĐẠT oan | Đổi sang bản đã bóc comment |

Đã xác minh thêm: 6 cột `PhieuThu` route mới đọc đều có trong `CREATE TABLE` gốc (`migration_v668.sql:161`), **không** phải cột thêm bằng migration ⇒ không cần dò cột. Route 3 đoạn `/phieu/:id/phieuthu` không bị `/phieu/:id` nuốt (Express 4, `:param` không ăn dấu `/`).

## 5. Nói trước

- Luật nghiệp vụ **không đổi**: vẫn phải xóa phiếu thu trước khi sửa phiếu bán hàng. Nếu anh muốn **đổi luật** (ví dụ cho sửa phiếu khi số tiền không đổi, chỉ sửa ghi chú / địa chỉ giao hàng) thì đó là việc khác, nói để tôi làm riêng — hiện tại backend chặn theo *toàn phiếu*, không phân biệt sửa gì.
- `DELETE /phieu/:id` dùng `COUNT(*) > 0` còn `PUT` dùng `SUM(SoTien) > 0`. Lệch nhau ở trường hợp hiếm: phiếu thu tổng bằng 0 hoặc âm thì **sửa được nhưng không xóa được**. Không gây sai số liệu, chưa đụng tới.
- Màn **Công nợ → Phiếu thu** vẫn là nơi duy nhất xóa phiếu thu; người bán hàng không có quyền đó sẽ phải nhờ kế toán. Modal nói rõ đường đi nhưng không tự làm thay.
- **Cùng kiểu lỗi, chỗ khác, chưa sửa** — rà chéo liệt kê, để anh quyết có làm tiếp không:

| File:dòng | Vấn đề |
|---|---|
| `module.congno.js:358` | `catch (e) { }` rỗng khi tải danh sách phiếu bán hàng ⇒ ô chọn *"Thu cho phiếu bán hàng"* **rỗng, không lý do**. Đúng nghiệp vụ tiền, đáng sửa nhất trong 4 cái còn lại |
| `module.payroll.js:771-786` | `daChot` ẩn nút Tính lương / Chốt bảng lương, không nói mở chốt bằng cách nào |
| `module.nhapkho.js:131-136` | Phiếu nhập "Đã hủy" ẩn Sửa/Hủy/Tạo thẻ kho — backend có câu rõ ràng mà không ai thấy |
| `module.khohang.js:3668` | Nút Hóa đơn ẩn khi phiếu đã hủy (rủi ro thấp, trạng thái hiện ngay trên dòng) |
