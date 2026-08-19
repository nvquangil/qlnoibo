# Lỗi 521 "Web server is down" khi vào trang public qua Cloudflare

**521 nghĩa là: Cloudflare KHÔNG kết nối được tới máy chủ của anh.** Trang web nội bộ vẫn chạy — chỉ là đường từ Cloudflare vào máy chủ bị chặn hoặc sai cổng. Máy chủ ở đây gọi là *origin*.

Trước tiên xác định anh đang dùng cách nào, vì cách chữa khác nhau hoàn toàn.

## BƯỚC 0 — Đang đi đường nào?

Cloudflare → **DNS → Records**, xem bản ghi của `thoitrangmoyn.id.vn`:

| Bản ghi | Nghĩa | Đi tiếp |
|---|---|---|
| **CNAME** → `<dãy-ký-tự>.cfargotunnel.com` | Đang dùng **Cloudflare Tunnel** | **PHẦN A** |
| **A** → IP công ty (vd `14.160.x.x`), đám mây **cam** | Cloudflare gọi thẳng vào IP công ty | **PHẦN B** |
| Có **cả hai** | Đây là nguyên nhân: 2 bản ghi tranh nhau | Xoá bản ghi **A**, giữ CNAME tunnel → xong |

---

## PHẦN A — Đang dùng Tunnel

Tunnel thì Cloudflare không cần cổng nào mở; 521 lúc này gần như chắc chắn do **cloudflared không chạy**.

Trên máy chủ, PowerShell:

```powershell
Get-Service cloudflared
```

- **Stopped** → `Start-Service cloudflared` rồi thử lại trang.
- **Không tồn tại dịch vụ** → chưa cài xong tunnel, xem lại `HUONG_DAN_v5.72...`/BƯỚC 2.85.
- **Running** mà vẫn 521 → vào Zero Trust → **Networks → Tunnels**, tunnel phải là **HEALTHY**; mở tab **Public Hostname** kiểm tra:
  - Hostname đúng `thoitrangmoyn.id.vn`
  - Type **HTTP**, URL **`localhost:80`** (KHÔNG phải `https://localhost` hay cổng 3000)

Kiểm tra origin còn sống:

```
pm2 list
netstat -ano | findstr :80
```

Phải thấy `qlnoibo` **online** và cổng 80 đang **LISTENING**. Nếu 80 không listening: mở `backend/.env` xem `PUBLIC_PORT=80`, rồi `pm2 restart qlnoibo` và đọc log — nếu log ghi *"KHÔNG mở được cổng công khai 80"* thì cổng 80 đang bị IIS/Skype chiếm.

---

## PHẦN B — Đang dùng bản ghi A trỏ IP công ty (đám mây cam)

Cloudflare phải mở được kết nối từ internet vào IP công ty. Có **hai nguyên nhân** hay gặp, kiểm tra theo thứ tự:

### B1. Chế độ SSL đang là Full / Full (strict) nhưng origin chỉ có HTTP

Đây là **nguyên nhân số 1** của 521 sau khi cấu hình theo hướng dẫn trước (tôi có khuyên bật Full (strict) — đúng cho tunnel, nhưng **sai** cho trường hợp bản ghi A trỏ vào cổng 80 HTTP).

- **Full/Full (strict)**: Cloudflare gọi origin bằng **HTTPS cổng 443**. Máy chủ không nghe 443 → **521**.
- **Flexible**: Cloudflare gọi origin bằng **HTTP cổng 80** — khớp với cấu hình hiện tại.

Sửa: **SSL/TLS → Overview → chọn `Flexible`** → tải lại trang.

> Khách vẫn thấy `https://` và ổ khoá xanh (Cloudflare bọc HTTPS ở biên). Chặng Cloudflare → công ty đi HTTP; với trang catalogue công khai (chỉ hiện ảnh/tên hàng/giá, khách đăng nhập bằng tài khoản riêng) thì mức này chấp nhận được. Muốn mã hoá cả chặng đó thì chuyển sang **Tunnel** (PHẦN A) — vừa mã hoá vừa không phải mở cổng nào.

### B2. NAT cổng 80 đã bị đóng

Hướng dẫn trước có bước *"đóng port-forward 80 và 3000"* — bước đó chỉ đúng **khi đã chạy Tunnel**. Nếu vẫn dùng bản ghi A thì phải mở lại:

- Router: NAT/port-forward **cổng ngoài 80 → máy chủ, cổng 80**.
- Windows Firewall: cho phép cổng 80 ở profile **Public**:

```powershell
New-NetFirewallRule -DisplayName "QLNoiBo HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Any
```

Kiểm tra IP công ty hiện tại có khớp bản ghi A không (IP động là hay lệch):

```
curl https://api.ipify.org
```

So với ô **Content** của bản ghi A. Lệch thì sửa bản ghi (hoặc dùng DDNS / chuyển sang Tunnel).

---

## BƯỚC CUỐI — Xác nhận origin thật sự trả lời

Trên **máy chủ**:

```
curl -I http://localhost/catalogue.html
```

Phải ra `HTTP/1.1 200`. Nếu ra `301/302` liên tục hoặc lỗi thì vấn đề ở phần mềm, không phải Cloudflare.

Từ **ngoài mạng** (điện thoại 4G, thay IP thật vào):

```
http://14.160.x.x/catalogue.html
```

- Vào được → origin OK, lỗi nằm ở cấu hình Cloudflare (B1).
- Không vào được → NAT/firewall (B2).

---

## Kèm 1 bản sửa mã nguồn (v5.77) — chống vòng lặp chuyển hướng

Với chế độ **Flexible**, Cloudflare gọi origin bằng HTTP. Middleware ép HTTPS của v5.68 sẽ thấy `x-forwarded-proto: http` và trả 302 sang `https://` → trình duyệt quay lại Cloudflare → Cloudflare lại gọi origin bằng HTTP → **vòng lặp vô hạn** (`ERR_TOO_MANY_REDIRECTS`). Bản v5.77 bỏ qua bước chuyển hướng khi request đi qua Cloudflare (nhận biết bằng header `cf-ray`) — việc ép HTTPS để **Cloudflare → SSL/TLS → Edge Certificates → Always Use HTTPS** lo, đúng chỗ hơn.

**Cài:** copy `backend/server.js` → `pm2 restart qlnoibo`.

---

## Nên chọn cấu hình nào

| | Tunnel (PHẦN A) | Bản ghi A + Flexible (PHẦN B) |
|---|---|---|
| Mở cổng ra internet | Không | Có (cổng 80) |
| Lộ IP công ty | Không | Có |
| Mã hoá chặng Cloudflare → công ty | Có | Không |
| Phụ thuộc | dịch vụ `cloudflared` phải chạy | NAT + IP tĩnh |

Tôi vẫn khuyên **Tunnel**. Nếu đang gấp thì tạm chuyển SSL sang **Flexible** + mở lại NAT 80 cho trang chạy ngay, rồi dựng tunnel sau và đóng cổng lại.
