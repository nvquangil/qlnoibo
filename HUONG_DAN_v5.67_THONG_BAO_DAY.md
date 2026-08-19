# BƯỚC 2.86 — THÔNG BÁO ĐẨY (Web Push) + sửa OTP chỉ hỏi lần đầu mỗi thiết bị (v5.67)

> Nội dung này thuộc `HUONG_DAN_CAI_DAT.md` (chèn ngay TRƯỚC "BƯỚC 2.85"). Lúc tạo, tệp chính đang bị khoá nên tách ra đây; anh có thể dán vào sau, hoặc giữ nguyên tệp riêng này.

---

## PHẦN 1 — Cloudflare Access: không thấy màn OTP / muốn chỉ hỏi lần đầu

### 1.1 Vì sao không thấy OTP

Kiểm tra lần lượt, sai ở đâu sửa ở đó:

| # | Kiểm tra | Đúng phải là |
|---|---|---|
| 1 | Đang mở địa chỉ nào? | Phải là `https://pm.thoitrangmoyn.id.vn`. Vào bằng LAN (`http://server:3000`) hoặc bằng IP thì **Access không can thiệp** — đây là thiết kế, không phải lỗi |
| 2 | Zero Trust → Access → Applications | Có ứng dụng với hostname **đúng** `pm.thoitrangmoyn.id.vn` (sai một ký tự là không khớp) |
| 3 | Policy của ứng dụng đó | Action = **Allow**, Include = **Emails**. Lỡ chọn **Bypass** hoặc Include = *Everyone* thì Cloudflare cho qua thẳng, không hỏi gì |
| 4 | Zero Trust → Settings → Authentication → Login methods | **One-time PIN** đang bật |
| 5 | Máy này đã từng đăng nhập Access chưa? | Access nhớ phiên theo `Session Duration` — mở **cửa sổ ẩn danh** để thử lại cho chắc |
| 6 | Bản ghi DNS của `pm` | CNAME của tunnel, **đám mây CAM**. Xám = không đi qua Cloudflare = không có Access |

### 1.2 Đặt "chỉ hỏi lần đầu trên thiết bị mới"

Access → Applications → `QLNoiBo` → **Configure → Session Duration → `1 month`**.

- Cùng thiết bị + cùng trình duyệt: 30 ngày không hỏi lại.
- Máy lạ / trình duyệt khác / xoá cookie: hỏi OTP lại.
- Nếu **policy** cũng có ô Session duration riêng thì phải sửa cả ở đó — giá trị ở policy thắng.

> Thu hồi quyền của một người ngay lập tức: xoá email khỏi policy → Access → **Revoke existing sessions**.

---

## PHẦN 2 — Web Push: thông báo nổi trên màn hình kể cả khi không mở phần mềm

Đã hiện thực đúng yêu cầu **`requireInteraction: true`**: trên Windows/macOS popup **nằm yên** trên desktop tới khi người dùng bấm hoặc đóng, không tự biến mất sau vài giây.

### 2.1 Cài đặt trên máy chủ (làm 1 lần)

```bat
:: 1) Chạy migration trong SSMS:  database/migration_v659.sql

:: 2) Cài thư viện + sinh khoá VAPID
cd D:\QLSX\backend
npm install web-push
node utils/taoVapidKeys.js
```

Lệnh cuối in ra 3 dòng — **dán vào `backend/.env`**:

```
VAPID_PUBLIC_KEY=BNc...
VAPID_PRIVATE_KEY=xLk...
VAPID_SUBJECT=mailto:nguyendlp@fpt.com
```

```bat
pm2 restart qlnoibo
```

Log phải hiện `[push] Web Push da san sang.`
Nếu hiện cảnh báo thiếu thư viện/khoá thì tính năng **tự tắt**, phần mềm vẫn chạy bình thường.

> **Đổi khoá VAPID = mọi thiết bị phải bật lại thông báo.** Sinh một lần rồi giữ nguyên. Khoá private không đưa lên GitHub, không gửi ai.

### 2.2 Người dùng bật thông báo (mỗi thiết bị một lần)

1. Vào phần mềm bằng **địa chỉ HTTPS**: `https://pm.thoitrangmoyn.id.vn`
2. Bấm chuông 🔔 trên thanh trên cùng → dòng mới **"🔔 Bật trên máy này"**
3. Trình duyệt hỏi quyền → **Cho phép / Allow**
4. Bấm **Gửi thử** — thông báo phải hiện ở góc màn hình

Bấm lại nút đó để **tắt** trên máy đang dùng. Mỗi máy/trình duyệt là một đăng ký riêng: máy công ty, máy ở nhà, điện thoại đều phải bật riêng.

### 2.3 Riêng từng nền tảng

| Nền tảng | Cách làm | Ghi chú |
|---|---|---|
| **Windows (Chrome/Edge)** | Bật như trên | `requireInteraction` **có tác dụng**: popup nằm yên tới khi bấm. Phải tắt **Focus Assist / Không làm phiền** của Windows |
| **Android (Chrome)** | Bật như trên; nên "Thêm vào MH chính" | Android **bỏ qua** `requireInteraction` (đúng chuẩn W3C) — thông báo vẫn nằm trong khay tới khi vuốt bỏ |
| **iPhone/iPad (iOS 16.4+)** | **Bắt buộc**: Safari → nút Chia sẻ → *Thêm vào MH chính* → mở app từ biểu tượng → rồi mới bấm Bật | Safari mở trong tab thường **không** hỗ trợ push |
| **LAN `http://server:3000`** | **Không bật được** | Trình duyệt chỉ cho push trên HTTPS hoặc localhost. Nút sẽ báo rõ lý do. Máy trong xưởng muốn nhận thông báo thì vào bằng `https://pm.thoitrangmoyn.id.vn` (đi ra Cloudflare rồi quay về, vẫn chạy tốt) |

### 2.4 Khi nào có thông báo đẩy

| Sự kiện | Ai nhận | Bấm vào mở |
|---|---|---|
| Đơn hàng chuyển sang công đoạn mới | Người được phân công công đoạn đó (trừ người vừa ghi nhận) | Ghi nhận tiến độ |
| Khách đặt hàng trên web công khai | Người có quyền Thẻ kho hàng hóa + Admin | Đơn khách đặt hàng |

Nếu phần mềm đang mở sẵn ở một tab thì bấm thông báo sẽ chuyển sang tab đó thay vì mở tab mới.

### 2.5 Không nhận được thông báo — kiểm tra theo thứ tự

1. `pm2 logs qlnoibo` có dòng `[push] Web Push da san sang.` không?
2. Bấm **Gửi thử**, đọc thông báo lỗi:
   - *"Máy chủ chưa cấu hình Web Push"* → thiếu `npm install web-push` hoặc thiếu khoá VAPID trong `.env`
   - *"Chưa có thiết bị nào đăng ký"* → chưa bấm Bật, hoặc bấm ở địa chỉ HTTP
3. Windows: Settings → System → Notifications → Chrome/Edge phải **On**; tắt **Focus assist**
4. Trình duyệt: biểu tượng ổ khoá trên thanh địa chỉ → Notifications → **Allow** (nếu trước đó lỡ bấm Block)
5. Sau khi copy `sw.js` mới: **Purge cache Cloudflare** → Ctrl+F5. Service worker cũ sống dai: F12 → Application → Service Workers → **Unregister** → tải lại trang

### 2.6 Thành phần kỹ thuật (để sau này bảo trì)

| Tệp | Vai trò |
|---|---|
| `database/migration_v659.sql` | Bảng `PushSubscription` (1 dòng = 1 thiết bị của 1 người) |
| `backend/utils/webpush.js` | `guiPush(pool, userIds, {title, body, url, tag})`; tự xoá đăng ký chết (404/410); thiếu cấu hình thì tự tắt, **không bao giờ làm hỏng nghiệp vụ chính** |
| `backend/utils/taoVapidKeys.js` | Sinh khoá VAPID (chạy 1 lần) |
| `backend/routes/notifications.js` | `GET /push/config`, `POST /push/subscribe`, `POST /push/unsubscribe`, `POST /push/test` |
| `frontend/sw.js` | Bắt sự kiện `push` → `showNotification(..., { requireInteraction: true })`; `notificationclick` → mở đúng màn hình |
| `frontend/js/common.js` | `initWebPush()` — nút bật/tắt trong bảng chuông, xin quyền đúng lúc người dùng bấm |

---

**Cài (mã nguồn):** chạy `database/migration_v659.sql` → `npm install web-push` + sinh khoá → copy `backend/utils/webpush.js`, `backend/utils/taoVapidKeys.js`, `backend/routes/notifications.js`, `backend/routes/public.js`, `frontend/sw.js`, `frontend/js/common.js`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Purge cache Cloudflare + Ctrl+F5.
