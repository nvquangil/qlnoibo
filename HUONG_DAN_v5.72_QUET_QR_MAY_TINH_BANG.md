# Quét QR bằng camera máy tính bảng trong mạng nội bộ (v5.72)

Chỉ dùng trong LAN, không liên quan gì tới internet hay tên miền công khai.

Trình duyệt **chỉ mở camera khi trang chạy https**. Có 2 cách, chọn **một**.

---

## CÁCH 1 — Bật cờ trong Chrome trên máy tính bảng (5 phút, KHÔNG sửa gì trên máy chủ)

Dùng cho **máy tính bảng Android** (hoặc máy tính Windows) chạy **Chrome / Edge**.

1. Trên máy chủ, xem IP LAN: mở Command Prompt → `ipconfig` → lấy dòng **IPv4 Address**, ví dụ `192.168.1.10`.
2. Trên máy tính bảng, mở Chrome → gõ vào thanh địa chỉ:

```
chrome://flags/#unsafely-treat-insecure-origin-as-secure
```

3. Ô nhập ngay dưới tên cờ đó, điền **đúng địa chỉ đang dùng** (kèm cổng, không có dấu `/` cuối):

```
http://192.168.1.10:3000
```

4. Đổi ô bên phải từ *Disabled* sang **Enabled** → bấm **Relaunch** ở góc dưới.
5. Mở `http://192.168.1.10:3000` → đăng nhập → bấm **📷 Quét QR** → Chrome xin quyền camera → **Cho phép**. Xong.

Ghi nhớ:

- Làm **một lần cho mỗi máy tính bảng**, giữ nguyên sau khi tắt máy.
- Địa chỉ phải khớp **từng ký tự** với cái đang mở. Nếu sau này đổi IP máy chủ thì phải sửa lại cờ này → **nên đặt IP tĩnh cho máy chủ**.
- **iPad/Safari không có cờ này** → dùng Cách 2.

---

## CÁCH 2 — Bật HTTPS trên máy chủ bằng chứng chỉ tự ký (làm 1 lần, mọi thiết bị dùng được, kể cả iPad)

Không cần openssl, không cần tên miền, không cần internet — chỉ dùng PowerShell có sẵn trong Windows.

### 2.1 Tạo chứng chỉ (trên máy chủ)

Mở **PowerShell với quyền Administrator**, thay `192.168.1.10` bằng IP thật của máy chủ:

```powershell
New-Item -ItemType Directory -Force -Path D:\certs | Out-Null

$cert = New-SelfSignedCertificate `
  -Subject "CN=QLNoiBo" `
  -TextExtension @("2.5.29.17={text}DNS=localhost&DNS=server&IPAddress=192.168.1.10") `
  -CertStoreLocation "cert:\LocalMachine\My" `
  -KeyExportPolicy Exportable `
  -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears(10)

$pwd = ConvertTo-SecureString -String "qlnoibo" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath D:\certs\qlnoibo.pfx -Password $pwd
```

`IPAddress=` là phần quan trọng — thiếu nó thì vào bằng IP sẽ bị trình duyệt từ chối.

### 2.2 Khai vào `backend/.env`

```
SSL_PFX_PATH=D:\certs\qlnoibo.pfx
SSL_PFX_PASS=qlnoibo
HTTPS_PORT=3443
```

```
pm2 restart qlnoibo
```

Log phải có dòng:

```
[Server] HTTPS  : https://localhost:3443  (dùng cho máy tính bảng/điện thoại trong LAN quét QR bằng camera)
```

Mở Windows Firewall cho cổng **3443** ở profile **Private**.

### 2.3 Trên máy tính bảng

1. Mở `https://192.168.1.10:3443`
2. Hiện cảnh báo *"Kết nối của bạn không phải là kết nối riêng tư"* → bấm **Nâng cao / Advanced** → **Tiếp tục truy cập** (đây là chứng chỉ do chính máy chủ của anh tạo, an toàn trong mạng nội bộ).
3. Đăng nhập → **📷 Quét QR** → Cho phép camera. Xong.

Chấp nhận cảnh báo **một lần cho mỗi thiết bị**. Muốn hết hẳn cảnh báo thì cài file `D:\certs\qlnoibo.pfx` vào phần *Chứng chỉ gốc tin cậy* của thiết bị — không bắt buộc, camera vẫn chạy bình thường khi có cảnh báo.

> **KHÔNG** thêm địa chỉ này vào `HTTPS_HOSTS`. Biến đó dành cho tên miền công khai; máy trong xưởng vẫn vào `http://server:3000` như thường, chỉ ai cần quét QR thì mở địa chỉ `https://...:3443`.

---

## Nên chọn cách nào

| | Cách 1 (cờ Chrome) | Cách 2 (HTTPS tự ký) |
|---|---|---|
| Sửa máy chủ | Không | Có (2 dòng `.env`) |
| Việc phải làm trên mỗi thiết bị | Bật cờ 1 lần | Bấm "Tiếp tục truy cập" 1 lần |
| iPad / Safari | **Không dùng được** | Dùng được |
| Đổi IP máy chủ | Phải sửa cờ trên từng máy | Phải tạo lại chứng chỉ |

Một hai cái máy tính bảng Android → **Cách 1**. Nhiều thiết bị, hoặc có iPad → **Cách 2**.

---

## Nếu vẫn không mở được camera

1. Máy tính bảng phải cùng wifi với máy chủ; thử mở `http://192.168.1.10:3000` xem có vào được phần mềm không (không vào được là vấn đề mạng/firewall, chưa phải camera).
2. Chrome → biểu tượng ổ khoá/ⓘ trên thanh địa chỉ → **Cài đặt trang** → Camera → **Cho phép**.
3. Kiểm tra không có ứng dụng khác đang giữ camera (Zalo, Camera, Meet…) — đóng hết rồi thử lại.
4. Cách 1: kiểm tra lại chuỗi trong cờ có đúng cổng `:3000` và **không** có `/` ở cuối.

---

**Cài (mã nguồn v5.72):** copy `backend/server.js` → sửa `.env` nếu dùng Cách 2 → **`pm2 restart qlnoibo`**. Cách 1 không cần copy gì.
