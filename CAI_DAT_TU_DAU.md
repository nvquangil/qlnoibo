# QLNoiBo — Cài đặt từ đầu trên máy mới

Tài liệu này chỉ nói **cách dựng hệ thống lên từ con số không**. Lịch sử sửa lỗi và ghi chú từng
phiên bản nằm ở `HUONG_DAN_CAI_DAT.md` (hơn 5.000 dòng) — không cần đọc khi cài máy mới.

---

## 1. Cần có sẵn trên máy

| Phần mềm | Ghi chú |
|---|---|
| **Windows Server / Windows 10+** | hệ thống chạy bằng pm2 trên Windows |
| **SQL Server 2017** trở lên | bản Express dùng được; nhớ **bật SQL Server Authentication** |
| **Node.js 18** trở lên | tải bản LTS ở nodejs.org |
| **pm2** | `npm install -g pm2 pm2-windows-startup` |

Bật **TCP/IP** cho SQL Server trong *SQL Server Configuration Manager* → khởi động lại dịch vụ SQL,
nếu không Node sẽ không nối vào được.

---

## 2. Lấy mã nguồn

```cmd
D:
git clone <đường-dẫn-kho-git> D:\QLSX
cd D:\QLSX\backend
npm install
```

Nếu chép tay bằng USB thì bỏ qua `git clone`, chỉ cần chạy `npm install` trong `backend`.

---

## 3. Tạo cơ sở dữ liệu trống

Mở SQL Server Management Studio, chạy:

```sql
CREATE DATABASE QLNoiBo;
```

Chỉ tạo database rỗng — **không** chạy tay file SQL nào, bước 5 sẽ lo.

---

## 4. Khai file cấu hình `.env`

Tạo `D:\QLSX\backend\.env`:

```ini
DB_SERVER=localhost\SQL2017
DB_DATABASE=QLNoiBo
DB_USER=sa
DB_PASSWORD=<mật khẩu sa>
DB_ENCRYPT=false

PORT=3000            # cổng nội bộ (đăng nhập, mọi phân hệ)
PUBLIC_PORT=80       # cổng công khai — CHỈ phục vụ trang catalogue cho khách. Đặt 0 để tắt hẳn.

SESSION_SECRET=<chuỗi ngẫu nhiên dài, tự đặt>

# Chỉ khai khi chạy sau Cloudflare Tunnel / nginx / IIS:
# TRUST_PROXY=loopback
# HTTPS_HOSTS=tenmien.com
```

`SESSION_SECRET` để nguyên giá trị mẫu là **ai cũng giả được phiên đăng nhập** — bắt buộc tự đặt.

---

## 5. Dựng toàn bộ bảng — MỘT LỆNH

```cmd
cd D:\QLSX\database
node chay_migration.js --schema
```

Lệnh này chạy `schema.sql` rồi **80 file migration theo đúng thứ tự**, và ghi lại từng file đã chạy
vào bảng `MigrationDaChay`.

Xem trước thứ tự mà không đụng vào CSDL:

```cmd
node chay_migration.js --danh-sach
```

Nếu đứt giữa chừng: sửa lỗi rồi chạy lại `node chay_migration.js` — nó **tiếp từ chỗ dang dở**,
không chạy lại từ đầu.

### Nâng cấp máy đang chạy (không phải cài mới)

```cmd
cd D:\QLSX\database
node chay_migration.js
```

Chỉ chạy những migration chưa chạy.

> ⚠️ **Máy đang chạy thật (D:\QLSX) trước giờ chạy migration bằng tay**, nên bảng `MigrationDaChay`
> chưa có gì. Lần **đầu tiên** dùng công cụ này trên máy đó phải chạy:
>
> ```cmd
> node chay_migration.js --danh-dau
> ```
>
> Nó đánh dấu cả 80 file là "đã chạy" mà **không chạy lệnh nào**. Bỏ bước này thì nó sẽ chạy lại
> toàn bộ 80 file lên CSDL đang có dữ liệu thật.

---

## 6. Khởi động

```cmd
cd D:\QLSX\backend
pm2 start server.js --name qlnoibo
pm2 save
pm2-startup install
```

Mở `http://localhost:3000` → đăng nhập bằng tài khoản quản trị mặc định do `schema.sql` tạo
(xem trong file đó, **đổi mật khẩu ngay sau lần đăng nhập đầu**).

---

## 7. Việc bắt buộc làm sau khi cài

1. **Đổi mật khẩu quản trị.**
2. **Cấp quyền**: *Quản lý User → Ma trận phân quyền*. Mọi phân hệ mặc định **tắt hết** cho mọi
   nhóm — đây là chủ ý, không phải lỗi. Không cấp thì không ai thấy gì (trừ tài khoản admin).
   Nhớ các phân hệ thêm sau này: `DASHBOARD`, `DOISOAT`, `BAOCAO`, `CONGNO`, và các chức năng con
   `KHOHANG/banhang`, `KHOHANG/nhaplai`.
3. **Khai danh mục gốc**: Bộ phận, Loại vải, Màu sắc, Nhà cung cấp, Khách hàng, Đơn vị tính.
4. **Đối soát ngân hàng** (nếu dùng): *Đối soát ngân hàng → Tài khoản ngân hàng* → khai số TK kèm
   mã VietQR. Muốn nhận giao dịch tự động thì đặt `DOISOAT_WEBHOOK_KEY` trong bảng
   `CauHinhHeThong` rồi trỏ webhook của SePay/Casso về `POST /api/doisoat/webhook/<khóa>`.

---

## 8. Sao lưu

Migration **không hoàn tác được**. Trước mỗi lần nâng cấp:

```sql
BACKUP DATABASE QLNoiBo TO DISK = 'D:\Backup\QLNoiBo_20260817.bak' WITH INIT;
```

Các lệnh sửa dữ liệu hàng loạt trong `backend/utils/` đều tự lưu file JSON vào `backend/backup/`
trước khi ghi — **đừng xóa thư mục đó**, đó là đường lui duy nhất.

---

## 9. Công cụ dọn dữ liệu thường dùng

Chạy trong `D:\QLSX\backend`. Tất cả đều **chạy thử trước**, thêm `--ghi` mới thực sự ghi.

| Lệnh | Việc |
|---|---|
| `node utils/gop_ten_khach.js --liet-ke` | Xem tên khách bị viết lệch nhau |
| `node utils/gop_ten_khach.js --chuan-hoa` | Gộp tên "nhìn giống hệt nhau" (dấu tiếng Việt lưu khác cách) |
| `node utils/gop_ten_khach.js --soi="<tên>"` | In mã từng ký tự — tìm ký tự vô hình |
| `node utils/gop_ten_khach.js --danh-muc` | Tìm tên trùng trong **Danh mục khách hàng** |
| `node utils/gop_ten_khach.js --tu-file=utils/gop_npp.json` | Gộp theo danh sách khai sẵn |
| `node utils/kiem_ton_am.js` | Dò tồn kho âm |
| `node utils/nhap_ton_vai_excel.js <file>` | Nhập tồn kho vải từ Excel |

---

## 10. Gặp sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Trang trắng, máy chủ vẫn chạy | Lỗi cú pháp file JS — chạy `node --check` từng file trong `backend/routes` và `frontend/js` |
| "Đã sửa mà vẫn lỗi như cũ" | Trình duyệt dùng file cũ → **Ctrl+F5**; và nhớ tăng số `?v=` trong `frontend/index.html` |
| Bấm nút không thấy gì xảy ra | Handler async văng giữa chừng — mở **F12 → Console** xem lỗi |
| Không nối được SQL | Chưa bật TCP/IP, hoặc chưa bật SQL Server Authentication, hoặc sai tên instance trong `DB_SERVER` |
| Vòng lặp chuyển hướng HTTPS | Đang chạy sau Cloudflare — xem `TRUST_PROXY` và `HTTPS_HOSTS` trong `.env` |
