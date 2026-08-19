# BƯỚC 2.87 — Ép HTTPS + OTP mỗi thiết bị + Giao gia công không cần khai giá trước (v5.68)

> Thuộc `HUONG_DAN_CAI_DAT.md`, chèn trước "BƯỚC 2.86".

---

## PHẦN 1 — Vào bằng http:// tự chuyển sang https://

Có **hai lớp**, nên bật cả hai.

### 1.1 Lớp Cloudflare (xử lý gần như toàn bộ)

Cloudflare dashboard → chọn `thoitrangmoyn.id.vn` → **SSL/TLS → Edge Certificates**:

| Mục | Đặt |
|---|---|
| **Always Use HTTPS** | **On** — mọi `http://...` bị chuyển sang `https://` ngay tại biên Cloudflare, chưa chạm tới máy chủ |
| **Automatic HTTPS Rewrites** | **On** — đường dẫn `http://` lỡ nằm trong nội dung trang cũng tự sửa |
| **Minimum TLS Version** | **1.2** |

Bật xong thử: gõ `http://thoitrangmoyn.id.vn` → thanh địa chỉ phải tự thành `https://`.

### 1.2 Lớp phần mềm (phòng khi request lọt qua)

Thêm vào `backend/.env`:

```
HTTPS_HOSTS=thoitrangmoyn.id.vn,pm.thoitrangmoyn.id.vn
```

`pm2 restart qlnoibo`.

Từ nay máy chủ tự trả lệnh chuyển hướng sang `https://` khi:

- request đi qua Cloudflare/tunnel mà báo `x-forwarded-proto: http`, **hoặc**
- tên miền nằm trong `HTTPS_HOSTS`.

**Cố ý KHÔNG chuyển hướng** trong 2 trường hợp:

- Vào LAN bằng `http://server:3000` — máy đó không có chứng chỉ, chuyển sang https là cả xưởng không vào được. Muốn ép cả LAN thì phải dựng chứng chỉ cho tên máy nội bộ (mkcert) trước, rồi mới thêm tên đó vào `HTTPS_HOSTS`.
- Request `POST/PUT/DELETE` — chuyển hướng các lệnh này làm **mất dữ liệu đang gửi**.

Dùng mã **302** (không phải 301) để sau này gỡ HTTPS thì trình duyệt không nhớ mãi.

---

## PHẦN 2 — OTP: máy mới hỏi một lần, máy cũ không hỏi lại

Đây là cấu hình trên Cloudflare, không phải mã nguồn.

### 2.1 Danh sách email được nhận OTP

Zero Trust → **Access → Applications → `QLNoiBo` → Policies → `Nhan vien` → Edit**:

- Action: **Allow**
- Include → **Emails** → thêm từng email (Enter sau mỗi email), ví dụ `nguyendlp@fpt.com`.
- Dùng chung đuôi công ty thì chọn **Emails ending in** → `@congty.com`.

Đây chính là "email đã lưu trong Cloudflare" — mã 6 số chỉ gửi về đúng các địa chỉ này. Người lạ gõ email khác sẽ bị từ chối ngay, không nhận được mã.

### 2.2 Chỉ hỏi lần đầu trên mỗi thiết bị

Access → Applications → `QLNoiBo` → **Configure → Session Duration → `1 month`** → Save.

- Cùng thiết bị + cùng trình duyệt: **30 ngày không hỏi lại**.
- Máy mới, trình duyệt khác, chế độ ẩn danh, hoặc vừa xoá cookie: **hỏi OTP một lần** rồi thôi.
- Nếu trong **policy** cũng có ô Session duration riêng, phải sửa cả ở đó — giá trị ở policy thắng.

Kiểm tra: Zero Trust → **Logs → Access** — mỗi lần ai đó nhập OTP sẽ có một dòng ghi email + thời gian + IP.

> **1 tháng là mức dài nhất Cloudflare Access cho phép** — không có tuỳ chọn "nhớ vĩnh viễn". Sau 30 ngày mỗi máy phải nhập lại một lần. Muốn một số máy **không bao giờ** bị hỏi thì thêm policy thứ hai: Action **Bypass**, Include → **IP ranges** → IP tĩnh của văn phòng. Máy trong dải IP đó vào thẳng, máy ngoài vẫn phải OTP.

**Thu hồi ngay một người:** xoá email khỏi policy → Access → **Revoke existing sessions**.

---

## PHẦN 3 — QLSX: giao gia công trước, khai giá sau

### Trước

Vào công đoạn **Giao gia công** khi chưa khai "Đơn giá Giao gia công" ở Kỹ thuật thì màn hình chỉ hiện dòng chữ *"Chưa khai … Vào Kỹ thuật khai trước, rồi quay lại đây"* — **không giao được cho ai**, dù thực tế hàng đã phải chuyển đi.

### Nay

- Hạng mục **đã khai giá** → hiện đơn giá như cũ.
- Hạng mục **chưa khai giá** → vẫn giao được, cột đơn giá ghi **"chưa khai"** kèm nhắc rằng khai sau giá sẽ tự áp vào.
- Đơn hàng chưa khai gì cả → có ô **"Giao thêm hạng mục khác"**: chọn hạng mục trong danh mục → bấm **"+ Mở hạng mục"** → thêm nhà gia công + số lượng → **Lưu**.
- Hạng mục đã lỡ giao từ trước luôn hiện ra để sửa/xoá, kể cả khi chưa có giá.

### Vì sao khai giá sau vẫn đúng tiền

Dòng giao gia công **không lưu bản sao đơn giá**. Mỗi lần đọc dữ liệu, backend tra giá hiện hành của hạng mục trong bảng đơn giá của đơn (`getNhaGiaCongChiTiet` → `OUTER APPLY … DonHangHangMucGiaCong`). Nên khi Kỹ thuật khai giá muộn, **mọi dòng đã giao tự có giá** — không phải giao lại, không phải sửa tay.

> Riêng **công đoạn May** vẫn giữ nguyên quy tắc cũ: phải khai "Đơn giá công đoạn may" ở *Tài liệu may/Đóng gói* rồi mới giao cho nhân viên được. Lý do khác về bản chất: mỗi dòng đơn giá **chính là** một công đoạn may của đơn — chưa khai thì chưa có công đoạn nào tồn tại để mà giao. Với gia công thì hạng mục nằm sẵn trong danh mục dùng chung nên giao trước được.

---

**Cài:** sửa `backend/.env` (thêm `HTTPS_HOSTS`) → copy `backend/server.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` → **`pm2 restart qlnoibo`** → bật 3 công tắc SSL/TLS trên Cloudflare → đặt Session Duration = 1 month → Purge cache Cloudflare + Ctrl+F5.
