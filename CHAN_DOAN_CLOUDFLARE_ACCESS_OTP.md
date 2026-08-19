# Cloudflare Access (OTP email) không hỏi mã — chẩn đoán cho qlnb.thoitrangmoyn.id.vn

## Nghi phạm số 1: TÊN MIỀN TRONG ỨNG DỤNG ACCESS KHÔNG KHỚP

Hướng dẫn cũ (BƯỚC 2.85) tôi viết ví dụ là **`pm.thoitrangmoyn.id.vn`**, nhưng thực tế anh đang dùng **`qlnb.thoitrangmoyn.id.vn`**. Nếu ứng dụng Access đang khai `pm` thì nó bảo vệ một tên miền **không tồn tại**, còn `qlnb` **không được bảo vệ** → vào thẳng, không hỏi OTP. Đây là lỗi của tôi trong tài liệu.

**Kiểm tra:** Zero Trust (`one.dash.cloudflare.com`) → **Access → Applications** → mở ứng dụng → xem ô hostname. Phải đúng từng ký tự:

```
qlnb.thoitrangmoyn.id.vn
```

Sai thì sửa (Configure → Public hostname) hoặc xoá và tạo lại theo phần dưới.

---

## Kiểm tra nhanh Access có đang chặn hay không

Mở **cửa sổ ẩn danh** rồi vào:

```
https://qlnb.thoitrangmoyn.id.vn/cdn-cgi/access/login
```

| Thấy gì | Nghĩa |
|---|---|
| Trang Cloudflare xin **email** | Access ĐANG hoạt động cho tên miền này |
| **HTTP ERROR 404** | Request ĐÃ qua Cloudflare (tunnel/proxy đúng) nhưng **KHÔNG có ứng dụng Access nào cho hostname này**. Đường dẫn `/cdn-cgi/...` do Cloudflare tự phục vụ, không bao giờ chuyển về máy chủ — Access chưa bật thì Cloudflare trả 404 |
| Ra trang đăng nhập phần mềm | Hostname này KHÔNG đi qua Cloudflare (đám mây xám / vào bằng LAN) |

> **404 = tin tốt một nửa**: hạ tầng Cloudflare đúng, chỉ thiếu đúng một thứ — ứng dụng Access cho `qlnb.thoitrangmoyn.id.vn`. Làm tiếp phần dưới.

---

## Tạo lại cho đúng (5 bước) — làm hết cả 5, đừng bỏ bước 1 và 2

1. Zero Trust → **Settings → Custom Pages / Team domain**: phải đã có **team name** (dạng `<tên>.cloudflareaccess.com`). Chưa có thì đặt ngay — thiếu bước này Access không hoạt động.
2. Zero Trust → **Settings → Authentication → Login methods**: **One-time PIN** phải **bật**. (Đây là cách gửi mã 6 số về email; không bật thì không có phương thức đăng nhập nào.)
3. **Access → Applications → Add an application → Self-hosted**
   - Application name: `QLNoiBo`
   - Session Duration: **1 month**
   - Public hostname: Subdomain `qlnb` · Domain `thoitrangmoyn.id.vn` · Path để **trống**
4. **Add policy**
   - Policy name: `Nhan vien`
   - Action: **Allow** (KHÔNG chọn *Bypass* — Bypass nghĩa là cho qua không cần xác thực, đây là lỗi hay gặp thứ 2)
   - Include → **Emails** → nhập từng email, **Enter sau mỗi email** (không nhấn Enter thì email không được thêm vào danh sách, policy thành rỗng)
5. **Save** → mở lại bằng cửa sổ ẩn danh.

---

## Nếu vẫn không hỏi

| Kiểm tra | Cách xử lý |
|---|---|
| Đang mở bằng cửa sổ thường và đã từng qua Access | Phiên còn hiệu lực tới 1 tháng → dùng **ẩn danh**, hoặc Access → **Revoke existing sessions** |
| Bản ghi DNS `qlnb` | Phải là CNAME tunnel, đám mây **CAM**. Xám = không qua Cloudflare = Access không can thiệp (anh đã xác nhận là CNAME tunnel — kiểm tra thêm màu đám mây) |
| Vào bằng LAN `http://server:3000` | Access **không** áp — đúng thiết kế, không phải lỗi |
| Trong tunnel có nhiều Public Hostname | Access áp theo **hostname**, không theo tunnel. Mỗi hostname cần app riêng nếu muốn bảo vệ |
| Policy có nhiều rule | Rule **Bypass** ở trên sẽ thắng rule Allow ở dưới → xoá rule Bypass |
| Logs | Zero Trust → **Logs → Access**: mỗi lần xác thực có 1 dòng (email + thời gian + IP). Không có dòng nào = Access chưa từng chặn request nào |

---

## Lưu ý về phạm vi bảo vệ

- **KHÔNG** tạo Access cho `thoitrangmoyn.id.vn` (catalogue) — khách phải vào tự do.
- Access là lớp **thứ nhất**; sau khi qua OTP vẫn phải đăng nhập bằng tài khoản phần mềm. Hai lớp độc lập, đúng như thiết kế.
- Muốn máy trong văn phòng không bị hỏi OTP: thêm policy thứ hai, Action **Bypass**, Include → **IP ranges** → IP tĩnh của công ty. Đặt policy này **trên** policy Allow.
