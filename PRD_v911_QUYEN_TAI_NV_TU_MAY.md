# PRD v9.11 — Màn Chấm công đi mượn route của phân hệ Danh mục

**Ngày:** 2026-10-31 · **Nguyen:** *"chấm công. user có đủ quyền nhưng khi tải nhân viên từ máy báo bạn không có quyền truy cập. user admin vẫn tải được."*

## 1. Nguyên nhân — đã xác nhận bằng bằng chứng, không phải suy đoán

Câu người dùng thấy là **"Tài khoản của bạn không có quyền thực hiện thao tác này"** — **nguyên văn** câu của `requirePermission` (`auth.js:23`), *không* phải câu của `requireChucNang` (*"…không có quyền **sửa** ở chức năng này"*).

Ảnh phân quyền của `huongns`: ghi đè riêng đủ Xem/Thêm/Sửa/Xóa cho **Quản lý nhân sự** và **Tính lương**, đủ hết chức năng PAYROLL (Chấm công tick cả 4 cột). **Danh mục không tick ghi đè riêng.**

Nút "Tải NV từ máy" (`openDeviceUsers`) gọi **ba** API, chỉ **một** có thể hiện lỗi ra màn hình:

| Dòng | Gọi gì | Lỗi thì sao |
|---|---|---|
| 327 | `GET /api/danhmuc/nhanvien` | **toast + `return`** ← đường duy nhất |
| 334 | `.../machamcong-list` | `catch {}` rỗng |
| 335 | `POST .../nhanvien-tumay` | `catch {}` rỗng |

⇒ **Màn Chấm công đi mượn route của phân hệ DANH MỤC.** Người làm chấm công buộc phải được cấp cả Danh mục — nơi chứa khách hàng, nhà cung cấp, mã hàng, màu sắc — chỉ để lấy **tên và mã nhân viên**. Sai về nghiệp vụ.

🔴 **Chẩn đoán đầu tiên của tôi SAI.** Tôi đọc backend, thấy `POST .../nhanvien-tumay` chỉ đọc mà `requireChucNang` suy POST ⇒ `edit`, và kết luận ngay đó là thủ phạm — trong khi route đó bị `catch` rỗng nuốt, **không bao giờ tới mắt ai**. Lần thứ hai mắc kiểu này (sau PX26445). Luật đã ghi vào bộ nhớ: **triệu chứng là một câu chữ ⇒ truy ngược từ chỗ in ra câu đó.**

## 2. Sửa

### (a) Bản vá thật — Chấm công dùng đường của chính nó

Route **mới** `GET /api/payroll/nhanvien`, gác `requirePermission('PAYROLL','view')` + `requireChucNang('PAYROLL','chamcong')`, trả đúng **4 cột** chấm công cần:

```sql
SELECT NhanVienID, MaNhanVien, HoTen, MaChamCong FROM NhanVien ORDER BY HoTen
```

**Siết chặt hơn bản cũ, không phải nới rộng:** 4 cột thay vì `SELECT *` — không lộ lương, SĐT, bộ phận, ngày vào cho người chỉ làm chấm công. Thứ tự `ORDER BY HoTen` **giữ y hệt** route CRUD cũ. Vỏ `{success, data}` giống hệt. Không lọc nhân viên nghỉ việc — giữ đúng tập dữ liệu cũ, vì người đã nghỉ vẫn còn bản ghi chấm công cần đối chiếu.

### (b) Hai chỗ bắt lỗi thôi nuốt — đây là thứ đã che mắt cả hai chúng tôi

`openDeviceUsers()` nay **gọi tên việc** đang hỏng, thay vì nuốt im lặng hoặc báo chung chung.

### (c) Cùng bệnh ở hai màn khác, rà chéo tìm ra

| Chỗ | Hậu quả nếu thiếu quyền Danh mục | Sửa |
|---|---|---|
| `module.users.js` — 3 lời gọi Danh mục trong một `Promise.all`, chỉ 1 có `.catch` | **Vỡ CẢ màn Phân quyền** (cả 3 tab), nặng hơn ca này | `.catch` đủ cả 3 |
| `module.khohang.js:247` form Tài khoản khách | Form ném lỗi giữa chừng | `.catch` cho khớp các chỗ khác trong chính file đó |

### (d) Lỗi thiết kế tìm thấy dọc đường — **không** phải nguyên nhân ca này

`requireChucNang` suy hành động từ HTTP method vẫn là bẫy thật: route POST **chỉ đọc** âm thầm đòi quyền SỬA, mâu thuẫn ngay với `requirePermission(..., 'view')` viết bên cạnh. Thêm **tham số thứ ba tuỳ chọn** `hanhDong`; bỏ trống ⇒ hành vi y hệt trước ⇒ ~200 chỗ gọi cũ không đổi. Ép `'view'` cho 4 route đã đọc kỹ, xác nhận không ghi gì. **Cố ý không đụng** `qlsx.js /canhbao/chay-ngay` (gửi email).

Kèm: chặn giá trị `hanhDong` lạ. `chucNangPerm` chỉ có `canView/canEdit/canDelete`; gõ nhầm `'create'` ⇒ key `canCreate` không tồn tại ⇒ `undefined === false` là false ⇒ **gate biến mất hoàn toàn, không log**. Nay lùi về suy theo method + `console.error`. **Không `throw`** — throw lúc đăng ký route là sập server khi khởi động.

Và câu từ chối nay **gọi tên** chức năng: *"…ở chức năng "PAYROLL/chamcong". Nhờ quản trị bật quyền đó."*

## 3. File

| File | Gì |
|---|---|
| `backend/routes/payroll.js` | **route mới `GET /nhanvien`**; 2 route POST chỉ-đọc ép `'view'` |
| `backend/middleware/auth.js` | tham số `hanhDong`; `chuanHoaHanhDong()`; câu từ chối gọi tên |
| `backend/routes/khuyenmai.js` · `backend/routes/nhaplai.js` | 1 route mỗi file ép `'view'` |
| `frontend/js/module.payroll.js` | đổi sang `/api/payroll/nhanvien`; 2 chỗ catch gọi tên việc |
| `frontend/js/module.users.js` · `frontend/js/module.khohang.js` | thêm `.catch` cho lời gọi sang Danh mục |
| `frontend/index.html` | `payroll` · `users` · `khohang` → `?v=9.11` |
| `backend/utils/kiem_quyen_route_chi_doc.js` *(mới, không copy sang D:\)* | kiểm **hành vi** middleware + rà route |

**Không có migration.** 4 cột đã đối chiếu `CAI_DAT_DAY_DU.sql` — `MaChamCong` có từ migration_v610.

## 4. 🔴 Rà chéo: bộ tự kiểm báo đỏ oan — **lần thứ BA**

v9.10 regex sai, v9.11 `includes()` quá khít, rồi v9.11 regex viết theo **bản nháp cũ** của chính tôi (`hanhDong || actionFromMethod` — dạng tôi đã bỏ khi thêm `chuanHoaHanhDong`). Mỗi lần đều khiến script `exit 1` vĩnh viễn ⇒ **lưới an toàn duy nhất bị vô hiệu**, lần này trên file mọi route đi qua.

**Nguyên nhân gốc: tôi cứ đi so chuỗi.** Nay mục 2 của bộ kiểm **gọi thẳng middleware** với `req` giả và xem nó cho qua hay chặn — đổi cách viết trong `auth.js` bao nhiêu lần cũng không làm phép này đỏ oan; chỉ **hành vi sai** mới đỏ:

- bỏ trống + POST ⇒ vẫn đòi SỬA (hành vi cũ, ~200 route không được đổi)
- ép `'view'` + POST ⇒ chỉ đòi XEM ← **toàn bộ mục đích bản vá**
- giá trị lạ ⇒ lùi về suy theo method, **không** mở toang gate
- admin qua; không có dòng cấu hình ⇒ mặc định cho phép; bị chặn ⇒ **403** (không phải 401, vì 401 bị `common.js` đá về `/login`)

Rà chéo còn bắt: bộ kiểm **không** biên dịch file frontend đã sửa (nay có); chú thích ở route `/nhanvien-tumay` **quy sai thủ phạm**, mâu thuẫn với chú thích cách đó 45 dòng (đã sửa); PRD bản trước **lạc hậu** so với mã (đây là bản viết lại).

## 5. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\middleware\auth.js
node --check backend\routes\payroll.js
node --check backend\routes\khuyenmai.js
node --check backend\routes\nhaplai.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.users.js
node --check frontend\js\module.khohang.js
node backend\utils\kiem_quyen_route_chi_doc.js
```

Phải ra `0 sai`. 🔴 `middleware/auth.js` là file **mọi route đi qua** — sai ở đây hỏng cả hệ thống, không phải một màn.

**7 file copy:** `backend\middleware\auth.js` · `backend\routes\payroll.js` · `backend\routes\khuyenmai.js` · `backend\routes\nhaplai.js` · `frontend\js\module.payroll.js` · `frontend\js\module.users.js` · `frontend\js\module.khohang.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5.

Sau restart, **việc đầu tiên**: đăng nhập bằng một **tài khoản thường** (không phải admin) và mở vài màn bất kỳ.

**Thử:**

1. 🔴 **`huongns` → Chấm công → "Tải NV từ máy"** → danh sách hiện ra, **không cần bật quyền Danh mục**. Đây là phép thử của cả bản này.
2. Nếu vẫn lỗi → đọc câu báo: nay nó **gọi tên việc** (*"DANH SÁCH NHÂN VIÊN"* hay *"TỪ MÁY CHẤM CÔNG"*) → gửi tôi nguyên văn.
3. `huongns` → **Phân quyền** (nếu được cấp Quản lý User) → màn mở bình thường, ô Bộ phận / Công đoạn có thể rỗng nhưng **không vỡ màn**.
4. Tài khoản chỉ được **Xem** tab Chấm công → mở được danh sách; nút **Lưu gán** vẫn bị chặn (route `/mapnhanvien` vẫn đòi `edit`).
5. Admin → mọi thứ như cũ.

**Commit:** `"v9.11 cham cong: dung route nhan vien cua chinh phan he thay vi muon /api/danhmuc + route POST chi-doc khong con doi quyen sua"`

## 6. Nói trước

- **5 route `hoadon.js`** (`/dangnhap` `/dangxuat` `/tracuu` `/taifile` `/dunglaipdf`) cùng bệnh POST-chỉ-đọc, **chưa rà** — đăng nhập cổng TCT và tải file có tác dụng ra ngoài, không chắc là việc chỉ-đọc. Module HOADON mới P1 nên chưa ai vấp. Đã ghi vào `NGOAI_LE_FILE` của bộ kiểm.
- `dashboard.js:66` `POST /cauhinh/:khoa` **GHI cấu hình** nhưng chỉ đòi `requirePermission('DASHBOARD','view')` — nới lỏng **ngược chiều**, bộ kiểm hiện chỉ soi một chiều nên không bắt được.
- Người chỉ có quyền **Xem** tab Chấm công nay mở được socket tới máy chấm công vật lý (ZKTeco bị chiếm phiên trong lúc đọc).
- `/nhanvien-tumay` có 3 `await` **ngoài** `try`, mà `payroll.js` không có lưới bọc async ⇒ lỗi ở đó là request treo. Lỗi có sẵn, chưa sửa.
- Các màn khác vẫn gọi `/api/danhmuc/*` **có `.catch`** và suy biến êm — không đụng.
