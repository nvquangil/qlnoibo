# Không vào được https://192.168.1.66:3443 — chẩn đoán theo thứ tự

Làm lần lượt, **dừng ở bước nào ra kết quả sai thì sửa đúng bước đó** rồi thử lại.

---

## BƯỚC 1 — Xem log: máy chủ có bật HTTPS không?

```
pm2 logs qlnoibo --lines 40
```

Tìm dòng bắt đầu bằng `[Server] HTTPS`. Đối chiếu:

| Log thấy gì | Nghĩa là | Sửa |
|---|---|---|
| `[Server] HTTPS  : https://localhost:3443` | Đã bật OK → nhảy sang **BƯỚC 3** | — |
| `Chưa cấu hình chứng chỉ trong .env` | **Đang chạy `server.js` CŨ** (bản cũ chỉ hiểu PEM, không hiểu `.pfx`), hoặc `.env` chưa có `SSL_PFX_PATH` | Copy lại `backend/server.js` bản mới (v5.72) + kiểm tra `.env` → `pm2 restart qlnoibo` |
| `KHÔNG đọc được file chứng chỉ` | Sai đường dẫn file `.pfx` | Kiểm tra `dir D:\certs` xem file có thật không, sửa `.env` cho khớp |
| `KHÔNG bật được HTTPS: ...` | Sai **mật khẩu** `.pfx` hoặc file `.pfx` lỗi | Đặt `SSL_PFX_PASS` đúng chuỗi đã dùng lúc `Export-PfxCertificate`, hoặc tạo lại chứng chỉ |
| `KHÔNG mở được cổng HTTPS 3443` | Cổng bị chương trình khác chiếm | `netstat -ano | findstr :3443` → tắt chương trình đó, hoặc đổi `HTTPS_PORT` sang `8443` |
| Không có dòng `[Server] HTTPS` nào | `server.js` cũ | Copy lại `server.js` |

> **Nguyên nhân hay gặp nhất: chưa copy `backend/server.js` bản mới.** Bản cũ bỏ qua hoàn toàn `SSL_PFX_PATH`, nên dù `.env` khai đúng thì HTTPS vẫn không bật → trình duyệt báo không kết nối được.

Kiểm tra nhanh file trên máy chủ đã là bản mới chưa:

```
findstr /C:"SSL_PFX_PATH" D:\QLSX\backend\server.js
```

Có in ra dòng nào = bản mới. Không in gì = **vẫn là bản cũ**, phải copy lại.

---

## BƯỚC 2 — Kiểm tra `.env`

```
type D:\QLSX\backend\.env
```

Phải có đúng 3 dòng này (không có dấu ngoặc kép, không có khoảng trắng quanh dấu `=`):

```
SSL_PFX_PATH=D:\certs\qlnoibo.pfx
SSL_PFX_PASS=qlnoibo
HTTPS_PORT=3443
```

Xong thì `pm2 restart qlnoibo` và quay lại BƯỚC 1.

---

## BƯỚC 3 — Thử NGAY TRÊN MÁY CHỦ (loại trừ firewall/mạng)

Trên chính máy chủ, mở trình duyệt vào:

```
https://localhost:3443
```

- **Vào được** (có cảnh báo chứng chỉ thì bấm *Nâng cao → Tiếp tục*) → máy chủ OK, lỗi nằm ở **firewall hoặc mạng** → sang BƯỚC 4.
- **Không vào được** → HTTPS chưa thật sự chạy → quay lại BƯỚC 1 đọc log.

Kiểm tra thêm bằng lệnh:

```
netstat -ano | findstr :3443
```

Phải thấy dòng `TCP 0.0.0.0:3443 ... LISTENING`. Nếu thấy `127.0.0.1:3443` thì chỉ nghe nội bộ máy chủ — copy lại `server.js` bản mới (bản mới bind `0.0.0.0`).

---

## BƯỚC 4 — Mở cổng 3443 trên Windows Firewall

Chạy PowerShell **quyền Administrator** trên máy chủ:

```powershell
New-NetFirewallRule -DisplayName "QLNoiBo HTTPS 3443" -Direction Inbound -Protocol TCP -LocalPort 3443 -Action Allow -Profile Any
```

Rồi thử lại từ máy tính bảng: `https://192.168.1.66:3443`

Kiểm tra rule đã có chưa:

```powershell
Get-NetFirewallRule -DisplayName "QLNoiBo*" | Format-Table DisplayName,Enabled,Direction,Action
```

---

## BƯỚC 5 — Máy tính bảng có thấy máy chủ không?

Trên máy tính bảng, thử mở địa chỉ **HTTP** cũ:

```
http://192.168.1.66:3000
```

- **Không vào được** → vấn đề mạng, chưa phải HTTPS: máy tính bảng khác wifi/khác dải mạng, hoặc router bật *AP isolation* (chặn thiết bị wifi nói chuyện với nhau). Vào cấu hình router tắt mục đó.
- **Vào được** nhưng `https://192.168.1.66:3443` không vào → firewall cổng 3443 (BƯỚC 4).

Kiểm tra IP máy chủ có đúng là `192.168.1.66`:

```
ipconfig
```

Đọc dòng **IPv4 Address** của card mạng đang dùng. Máy chủ có nhiều card (LAN + Wi-Fi + Hyper-V ảo) thì phải lấy đúng IP của card cùng mạng với máy tính bảng.

---

## BƯỚC 6 — Vào được nhưng camera vẫn không mở

Đúng địa chỉ `https://` rồi mà bấm 📷 vẫn báo chặn camera:

1. Chrome → biểu tượng ổ khoá trên thanh địa chỉ → **Cài đặt trang** → Camera → **Cho phép** → tải lại trang.
2. Đóng hết ứng dụng đang giữ camera (Zalo, Camera, Meet).
3. Máy tính bảng phải mở **https://** — nếu địa chỉ tự nhảy về `http://` thì đó là bookmark/tự động điền cũ, gõ lại đầy đủ `https://192.168.1.66:3443`.

---

## Nếu muốn bỏ hẳn chứng chỉ, làm cách nhanh hơn

Máy tính bảng Android + Chrome thì không cần HTTPS: mở `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → điền `http://192.168.1.66:3000` → **Enabled** → **Relaunch** → dùng camera ngay trên địa chỉ http cũ. Xem `HUONG_DAN_v5.72_QUET_QR_MAY_TINH_BANG.md` (Cách 1).

---

**Cần copy lại (v5.72.1):** `backend/server.js` → `pm2 restart qlnoibo`. Bản này log rõ từng nguyên nhân ở BƯỚC 1 và không còn sập tiến trình khi sai mật khẩu `.pfx`.
