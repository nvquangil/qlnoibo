# BƯỚC 2.88 — Quét QR trong xưởng: HTTPS nội bộ + máy quét cầm tay (v5.71)

> Thuộc `HUONG_DAN_CAI_DAT.md`, chèn trước "BƯỚC 2.87".

## Vấn đề

Trình duyệt **chỉ cho phép truy cập camera trên HTTPS** (hoặc `localhost`). Máy trong xưởng vào bằng `http://server:3000` nên nút 📷 báo *"Trình duyệt CHẶN camera vì trang đang mở bằng http"*. Đây là quy định bảo mật của trình duyệt, không sửa được bằng mã nguồn.

Có **hai đường ra**. Cách A dùng được ngay, cách B là giải pháp gốc.

---

## CÁCH A — Máy quét mã vạch/QR CẦM TAY (USB). Dùng được ngay, không cần HTTPS

Máy quét cầm tay cắm USB hoạt động **như một bàn phím**: nó "gõ" nội dung mã rồi tự gửi Enter. Không dùng camera của trình duyệt nên **không cần HTTPS**.

Từ v5.71, ô **Mã cây (QR)** trong *Tạo phiếu nhập kho vải* đã hỗ trợ sẵn:

1. Bấm chuột vào ô **Mã cây (QR)** của dòng đang trống.
2. Quét tem — máy quét gõ mã + Enter.
3. Hệ thống tự: tra mã, **chặn nếu cây đã có trong kho**, điền Loại vải/Màu/khổ/KG/mét đọc được, rồi **mở dòng mới và đưa con trỏ vào đó** để quét cây tiếp theo.
4. Quét hết thì điền các ô còn thiếu → **Lưu nhập kho**.

Enter từ máy quét **không** làm submit phiếu giữa chừng (đã chặn có chủ ý).

> Máy quét loại rẻ (~300–600k) đọc được cả barcode 1D và QR 2D. Chọn loại **USB HID (keyboard wedge)**, cắm là chạy, không cần driver.

---

## CÁCH B — Bật HTTPS cho địa chỉ nội bộ (giải pháp gốc, dùng được camera điện thoại)

Ý tưởng: dùng tên miền thật `noibo.thoitrangmoyn.id.vn` nhưng **trỏ về IP LAN của máy chủ**, xin chứng chỉ Let's Encrypt bằng xác thực DNS (không cần mở cổng nào). Máy tính và điện thoại trong xưởng mở `https://noibo.thoitrangmoyn.id.vn` — ổ khoá xanh, camera hoạt động, **không phải cài gì lên từng máy**.

### B1. Tạo bản ghi DNS trỏ về IP nội bộ

Cloudflare → DNS → **Add record**:

| Ô | Giá trị |
|---|---|
| Type | `A` |
| Name | `noibo` |
| IPv4 address | **IP LAN của máy chủ**, ví dụ `192.168.1.10` |
| Proxy status | **DNS only** (đám mây XÁM — bắt buộc) |

Đặt IP LAN của máy chủ thành **IP tĩnh** (hoặc gán cố định trong DHCP của router), nếu không đổi IP là chứng chỉ trỏ sai máy.

> Đưa IP nội bộ lên DNS công khai là chuyện bình thường và **không hề mở cửa** cho ai từ internet — `192.168.x.x` chỉ tồn tại trong mạng nhà anh. Người ngoài phân giải ra IP đó cũng không đi tới đâu.

### B2. Xin chứng chỉ Let's Encrypt bằng win-acme (xác thực DNS-01)

Không cần mở cổng 80/443 ra internet.

1. Tạo **Cloudflare API Token**: dashboard → My Profile → API Tokens → Create Token → *Edit zone DNS* → Zone Resources = `thoitrangmoyn.id.vn` → Create → **copy token**.
2. Tải **win-acme** (`wacs.exe`) về máy chủ, chạy bằng **Run as Administrator**:
   - `M` (Create certificate — full options)
   - Nhập host: `noibo.thoitrangmoyn.id.vn`
   - Validation: chọn **DNS → Cloudflare** → dán API Token
   - CSR: RSA (mặc định)
   - Store: chọn **PEM encoded files**, thư mục: `D:\certs`
   - Installation: **None**
3. win-acme tự tạo tác vụ Windows gia hạn 60 ngày/lần — không phải làm gì thêm.

### B3. Khai vào `backend/.env`

```
SSL_CERT_PATH=D:\certs\noibo.thoitrangmoyn.id.vn-chain.pem
SSL_KEY_PATH=D:\certs\noibo.thoitrangmoyn.id.vn-key.pem
HTTPS_PORT=443
HTTPS_HOSTS=thoitrangmoyn.id.vn,pm.thoitrangmoyn.id.vn,noibo.thoitrangmoyn.id.vn
```

`pm2 restart qlnoibo` → log phải có `[Server] HTTPS đang chạy tại https://localhost:443`.

- Đặt `HTTPS_PORT=443` để địa chỉ gọn: `https://noibo.thoitrangmoyn.id.vn` (không phải gõ cổng). Trên Windows, Node bind cổng 443 không cần quyền admin.
- Nếu cổng 443 đã bị chương trình khác chiếm (`netstat -ano | findstr :443`), dùng `HTTPS_PORT=3443` **và** thêm `HTTPS_REDIRECT_PORT=3443` để lệnh chuyển hướng http→https đi đúng cổng; địa chỉ khi đó là `https://noibo.thoitrangmoyn.id.vn:3443`.
- Windows Firewall: mở cổng 443 (hoặc 3443) cho **Private (LAN)**.

### B4. Bảo hiểm khi mất internet

Tên `noibo.thoitrangmoyn.id.vn` phân giải qua DNS công khai — mất internet là không phân giải được, dù máy chủ vẫn ở ngay trong mạng. Chọn một trong hai:

- **Router**: thêm bản ghi DNS nội bộ (Local DNS / DNS Host Names) `noibo.thoitrangmoyn.id.vn` → `192.168.1.10`. Làm một lần cho cả mạng — nên chọn cách này.
- **Từng máy**: thêm dòng sau vào `C:\Windows\System32\drivers\etc\hosts` (mở Notepad bằng quyền Admin):

```
192.168.1.10   noibo.thoitrangmoyn.id.vn
```

### B5. Nghiệm thu

| Thử | Kết quả đúng |
|---|---|
| Máy tính trong xưởng mở `https://noibo.thoitrangmoyn.id.vn` | Vào được, **ổ khoá xanh**, không cảnh báo |
| Bấm 📷 Quét QR | Xin quyền camera → quét được |
| Điện thoại cùng wifi xưởng, mở địa chỉ trên | Camera sau hoạt động, quét tem cây vải |
| `http://noibo.thoitrangmoyn.id.vn` | Tự chuyển sang `https://` |
| Rút mạng internet, mở lại địa chỉ | Vẫn vào được (nếu đã làm B4) |

---

## Vì sao không dùng mkcert cho việc này

`mkcert` tạo chứng chỉ tự ký nên **phải cài chứng chỉ gốc lên TỪNG máy và TỪNG điện thoại** (iPhone còn phải vào Settings bật "Full Trust" thủ công). Điện thoại khách/nhân viên mới là phải làm lại. Cách B chỉ làm một lần trên máy chủ, mọi thiết bị vào là chạy — nên tôi khuyên cách B.

---

**Cài (mã nguồn v5.71):** copy `backend/server.js`, `frontend/js/module.khovai.js`, `frontend/js/common.js`, `frontend/index.html` → sửa `.env` nếu làm cách B → **`pm2 restart qlnoibo`** + Purge cache Cloudflare + Ctrl+F5.
