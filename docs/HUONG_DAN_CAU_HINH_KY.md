# Hướng dẫn cấu hình ký — phân hệ Hợp đồng mua bán (v9.61 / v9.62)

*Dành cho người vận hành máy chủ (Nguyen). Làm theo thứ tự. Mọi mật khẩu / PIN / API key gõ thẳng vào `D:\QLSX\backend\.env` trên máy chủ — không dán vào chat, email, Zalo.*

Cấu hình ký nằm ở **ba chỗ**, mỗi chỗ một việc:

| Chỗ | Ai sửa | Chứa gì | Sau khi sửa |
|---|---|---|---|
| **A.** `D:\QLSX\backend\.env` | anh, trên máy chủ | kỹ thuật: bộ ký số của MOYN, dấu thời gian, email/SMS gửi OTP, địa chỉ công khai, ký từ xa | **`pm2 restart qlnoibo`** |
| **B.** Phần mềm → *Hợp đồng mua bán* → tab **Cấu hình ký** | kế toán / anh | nghiệp vụ: thông tin bên bán in vào hợp đồng, hạn link, kênh gửi, email kế toán, nhắc hạn | có hiệu lực ngay |
| **C.** *Quản trị* → **Phân quyền** | anh | ai được dùng phân hệ, ai được **ký số phía MOYN** | người đó **đăng xuất / đăng nhập lại** |

---

## 1. Quyết định trước: MOYN ký số bằng cách nào?

Sau khi khách xác nhận (OTP hoặc chữ ký số), hệ thống tạo bản PDF cuối và **chữ ký số của MOYN** phải được gắn vào. Có 3 cách — chọn **một**, khai ở dòng `HOPDONG_KY_TU_DONG` trong `.env`:

| Cách | `HOPDONG_KY_TU_DONG=` | Cần gì | Khi nào chọn |
|---|---|---|---|
| **Tắt — ký tay** (mặc định) | *(để trống)* | không cần gì thêm | **Bắt đầu bằng cách này** để chạy thử toàn luồng. Hợp đồng dừng ở trạng thái *Chờ MOYN ký số*; người có năng lực **kyso** vào chi tiết hợp đồng và ký bằng một trong ba nút: **Ký bằng USB token máy này** (cắm token + mở công cụ *MOYN Ký số*), **Tải lên bản đã ký** (tải PDF chờ ký về → ký bằng Adobe Reader / phần mềm của CA → tải lên), hoặc **Ký từ xa** (v9.62, khi có tài khoản SmartCA). |
| **PFX — tự động** | `pfx` | file chứng thư `.pfx/.p12` + mật khẩu, đặt trên máy chủ | Khi CA cấp được chứng thư **dạng file** cho công ty (hỏi CA: *"chứng thư số lưu PKCS#12 để ký tự động trên máy chủ"* — một số CA chỉ cấp token cứng hoặc bắt dùng dịch vụ ký từ xa; khi đó dùng cách dưới). Ký xong trong vài giây, không ai phải bấm. |
| **PKCS#11 — tự động, token cắm ở máy chủ** | `pkcs11` | USB token cắm **cố định** vào máy chủ + thư viện DLL của token + PIN; `npm install pkcs11js` (module native, cần Visual Studio Build Tools) | Khi không xin được file PFX nhưng công ty sẵn token. 🔴 Token đó không còn rút ra dùng cho eTax / hóa đơn ở máy khác. 🔴 PIN sai là phần mềm **không thử lại** (token khóa sau vài lần sai). |

Khuyến nghị: **Tắt → chạy thử §22.3 → đổi sang `pfx`** khi CA cấp file. `pkcs11` là phương án cuối.

### 1b. Anh đã chọn (14/11): "MOYN ngồi máy cắm USB token ký" = cách **Tắt**

Không khai gì về bộ ký trong `.env` (`HOPDONG_KY_TU_DONG` để trống). Không cần PFX, không cần `pkcs11js`. Việc còn lại:

**Trên máy chủ (một lần):**
1. `.env` chỉ cần nhóm §2.1 (PUBLIC_BASE_URL, SMTP, tên công ty). TSA để mặc định.
2. Build công cụ *MOYN Ký số* (máy nào có .NET 8 SDK — không cần là máy chủ): `cd tools\MoynKySo && dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true` → chép `MoynKySo.exe` vào `D:\QLSX\frontend\tools\MoynKySo\`. Từ v1.0.1 công cụ tự nhận mọi địa chỉ **mạng nội bộ** (10.x / 172.16–31.x / 192.168.x / localhost) nên nhân viên mở phần mềm qua IP LAN ký được, không phải sửa mã; tên miền khác thì ghi thêm vào file `origins.txt` đặt cạnh `MoynKySo.exe`.
3. Phân quyền: tick **Ký số phía MOYN** cho người ký (§5) → người đó đăng nhập lại.

**Trên máy người ký (giám đốc / kế toán trưởng — Windows):**
1. Cài driver + phần mềm token của CA (như vẫn dùng ký hóa đơn / thuế). Cắm token, kiểm trong *certmgr.msc → Personal → Certificates* thấy chứng thư công ty.
2. Tải `MoynKySo.exe` từ `https://thoitrangmoyn.id.vn/tools/MoynKySo/` (hoặc chép tay), mở lên — biểu tượng khiên ở khay hệ thống. Cần .NET 8 Desktop Runtime (thiếu thì Windows tự chỉ link tải). Có thể cho chạy cùng Windows (chép lối tắt vào `shell:startup`).
3. Mỗi lần ký: phần mềm → *Hợp đồng mua bán* → hợp đồng ở trạng thái **Chờ MOYN ký số** → **🔐 Ký bằng USB token máy này** → chọn chứng thư (nếu token có nhiều) → cửa sổ *MOYN Ký số* hỏi xác nhận (ghi rõ trang nào gọi) → bấm Yes → token hỏi PIN → xong trong vài giây; máy chủ tự ghép dấu thời gian → hợp đồng **Đã ký**, khách nhận email bản cuối.

**Khi công cụ không chạy được** (máy không cài được, trình duyệt chặn localhost): nút **📄 PDF chờ MOYN ký** → tải về → ký bằng phần mềm ký PDF của CA hoặc *Adobe Acrobat Reader* (Tools → Certificates → Digitally Sign, ký lên ĐÚNG file vừa tải, không "Save as" sang file mới) → **⬆ Tải lên bản đã ký**. Máy chủ kiểm: phần đầu file phải khớp bản gửi, chữ ký hợp lệ, chứng thư còn hạn, MST khớp.

⚠️ Điều tôi chưa thử được: Chrome/Edge trên máy người ký có cho trang **http://\<IP LAN\>:cổng** gọi `http://localhost:8765` hay không (chính sách "Private Network Access"; công cụ đã trả đúng header `Access-Control-Allow-Private-Network`). Nếu bị chặn, F12 → Console sẽ ghi rõ "private network" — khi đó dùng đường tải về / tải lên ở trên, hoặc mở phần mềm nội bộ qua HTTPS.

---

## 2. Khai `.env` (chỗ A)

Mở `D:\QLSX\backend\.env` bằng Notepad (chạy với tài khoản **Admin** — máy chủ chạy pm2 dưới tài khoản này). Mẫu đầy đủ có chú thích ở `backend\.env.example`, mục *HOP DONG MUA BAN*. Dưới đây là những dòng cần, theo nhóm.

### 2.1 Bắt buộc — không có thì không gửi được link / OTP

```
# Tên ngắn in trong tin OTP / tiêu đề email (tên đầy đủ khai ở màn Cấu hình ký)
HOPDONG_TEN_CONG_TY=MOYN

# Địa chỉ CÔNG KHAI mà khách mở được từ ngoài — link ký ghép từ đây. Đúng là tên miền qua Cloudflare Tunnel, KHÔNG phải địa chỉ nội bộ.
PUBLIC_BASE_URL=https://thoitrangmoyn.id.vn

# Email gửi link + OTP (dùng chung với cảnh báo trễ hạn / sao lưu). Gmail: bật 2-Step Verification → tạo "App password" 16 ký tự → dán vào SMTP_PASS.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<email gửi>
SMTP_PASS=<app password 16 ký tự>
SMTP_FROM=MOYN <email gửi>
```

Kiểm: trong phần mềm, tab **Cấu hình ký** → dòng *Kênh gửi link / OTP* phải hiện **Email ● sẵn sàng**. Dòng *Địa chỉ công khai* phải hiện đúng tên miền.

### 2.2 Bộ ký số MOYN (chọn ở §1)

**Tắt** — không khai gì (hoặc `HOPDONG_KY_TU_DONG=`).

**PFX:**
```
HOPDONG_KY_TU_DONG=pfx
HOPDONG_PFX_PATH=D:\QLSX\backend\chungthu\moyn.pfx
HOPDONG_PFX_PASS=<mật khẩu file pfx>
```
- Tạo thư mục `D:\QLSX\backend\chungthu\`, chép file `.pfx` vào. **Không** để trong `uploads\` (thư mục đó phục vụ ảnh công khai).
- Chuột phải thư mục → *Properties* → *Security*: chỉ **Admin** (tài khoản chạy pm2) và SYSTEM; bỏ *Users*.
- Giữ một bản sao file `.pfx` + mật khẩu ở nơi an toàn ngoài máy chủ (mất file = xin CA cấp lại, mất phí).

**PKCS#11:**
```
HOPDONG_KY_TU_DONG=pkcs11
HOPDONG_PKCS11_DLL=C:\Windows\System32\ShuttleCsp11_3003.dll
HOPDONG_PKCS11_PIN=<PIN token>
HOPDONG_PKCS11_SLOT=0
HOPDONG_PKCS11_SERIAL=
```
- DLL theo hãng token (kiểm bằng cách tìm file trong thư mục cài phần mềm token): SafeNet eToken `eTPKCS11.dll`; Feitian ePass3003 (token VNPT/Viettel/FPT hay dùng) `ShuttleCsp11_3003.dll`; ePass2003 `eps2003csp11.dll`; Watchdata `WDPKCS.dll`. Tên nào có thật trên máy thì khai tên đó.
- Cài thêm: `cd D:\QLSX\backend && npm install pkcs11js`. Lỗi biên dịch ⇒ thiếu *Visual Studio Build Tools* (workload C++) — hoặc bỏ cách này, dùng PFX.
- Token có nhiều chứng thư thì khai `HOPDONG_PKCS11_SERIAL` (số serial hex, xem ở bước kiểm §3) — để trống là lấy chứng thư còn hạn xa nhất.

### 2.3 Dấu thời gian (TSA)

```
HOPDONG_TSA_URL=http://timestamp.digicert.com
```
- Mặc định (không khai) = DigiCert công cộng, miễn phí — anh đã chốt 14/11. Máy chủ phải ra được internet tới địa chỉ này.
- Muốn TSA được cấp phép tại Việt Nam (VNPT / Viettel / FPT / NewCA — có phí) thì đặt URL họ cấp.
- `HOPDONG_TSA_URL=` (để trống hẳn) = **tắt** dấu thời gian. TSA lỗi lúc ký ⇒ vẫn ký, nhật ký ghi "không có dấu thời gian", có nút **Ký số lại** để ghép lại sau.

### 2.4 Tùy chọn — SMS / Zalo gửi OTP (mã đã sẵn, chờ tài khoản)

```
SMS_PROVIDER=esms            # esms | speedsms
SMS_API_KEY=
SMS_SECRET=
SMS_BRANDNAME=MOYN           # brandname đã đăng ký với nhà cung cấp
SMS_TYPE=2

ZALO_ZNS_TEMPLATE_OTP=       # ID mẫu ZNS OTP đã được Zalo duyệt (tham số {otp})
ZALO_ZNS_TEMPLATE_LINK=      # ID mẫu gửi link ({so_hop_dong}, {link})
```
Chưa khai ⇒ nút kênh đó **mờ** trên trang ký của khách, không lỗi.

### 2.5 Tùy chọn v9.62 — ký từ xa qua CA (SmartCA / chuẩn CSC)

Chỉ khai khi **đã ký hợp đồng dịch vụ tích hợp** với CA và có tài khoản SP. Xem mục `KYTUXA_*` trong `.env.example`. Không khai = mục "Ký từ xa" không hiện ở đâu cả. Lần gọi thật đầu tiên xem `pm2 logs` dòng `[kyTuXa]` — mã viết theo tài liệu công khai, chưa đối chiếu với tài khoản thật.

### 2.6 Sau khi sửa `.env`

```
cd D:\QLSX
pm2 restart qlnoibo
pm2 logs qlnoibo --lines 30
```
Phải thấy `[hopdong] Lịch nhắc hạn ký: …` (v9.62) và **không** có dòng `Cannot find module`.

---

## 3. Kiểm bộ ký trên máy chủ TRƯỚC khi dùng cho hợp đồng thật

Chạy trong `D:\QLSX` (đọc đúng `backend\.env`):

```
node backend\utils\thu_ky_so.js --chungthu
```
→ in bộ ký đang dùng (`pfx` / `pkcs11` / `tat`), URL TSA, và chứng thư: `CN` (tên công ty), `MST`, `serial`, `denNgay`. Sai tên công ty / hết hạn / "Không thấy file PFX" / "Không thấy USB token" — sửa `.env` rồi chạy lại. Lệnh này **không** nhập PIN với PKCS#11.

```
node backend\utils\thu_ky_so.js D:\thu\bat_ky.pdf D:\thu\ra.pdf
```
→ ký thật một PDF bất kỳ (+ TSA). Mở `ra.pdf` bằng **Adobe Acrobat Reader** → bảng *Signatures*: chữ ký hợp lệ, tên MOYN, có dòng *timestamp*. Adobe báo "certificate not trusted" là bình thường với CA Việt Nam — bấm *Add to Trusted Certificates* một lần.

```
node backend\utils\thu_ky_so.js --kiem D:\thu\ra.pdf
```
→ máy chủ tự kiểm: `hopLe: true`, `coDauThoiGian: true`.

Hai việc này cũng làm được trong phần mềm: tab **Cấu hình ký** → nút **🔎 Kiểm bộ ký** và **🧪 Ký thử một PDF** (cần năng lực kyso).

---

## 4. Màn "Cấu hình ký" trong phần mềm (chỗ B)

*Hợp đồng mua bán* → tab **Cấu hình ký** (cần quyền *Sửa* ở chức năng *Cấu hình*). Phần đầu màn là **thông tin hệ thống chỉ đọc** (lấy từ `.env`) — đối chiếu với §2. Phần nhập:

| Ô | Dùng vào đâu |
|---|---|
| Tên pháp nhân, Mã số thuế, Địa chỉ, Điện thoại, Email, Số tài khoản | điền biến `{{BenBan_*}}` trong mẫu hợp đồng + trang *Chứng nhận ký điện tử* cuối PDF |
| Người ký (đại diện), Chức vụ | tên người ký phía MOYN mặc định (mỗi hợp đồng vẫn gõ đè được ở form tạo) |
| Địa điểm ký (mặc định) | `{{DiaDiemKy}}` khi form để trống |
| Ghi chú thuế trên giá | `{{GhiChuThue}}`, vd "đã bao gồm VAT" |
| Hạn link ký (ngày), 1–90 | link gửi khách sống bao lâu; quá hạn → hợp đồng *Hết hạn* |
| Kênh mặc định | email / sms / zalo — kênh OTP được chọn sẵn trên **trang ký của khách** và kênh nhắc hạn tự động dùng (kênh chưa sẵn sàng thì tự rơi về email). Lúc *Xuất bản* vẫn chọn kênh gửi link ngay trong hộp thoại. |
| Email kế toán nhận báo "đã ký xong" | nhận email báo ký xong (kèm link tra cứu công khai — bản PDF cuối tải trong phần mềm, không gửi đính kèm) + email báo hợp đồng hết hạn (v9.62) |
| **Nhắc hạn ký tự động** (v9.62): Bật, Nhắc trước hạn (ngày), Giờ chạy | mỗi ngày đúng giờ (giờ VN): sắp hết hạn → gửi lại link cho khách (1 lần/ngày/hợp đồng, **không dời hạn**); quá hạn → *Hết hạn* + email kế toán. Nút **▶ Chạy nhắc ngay** để thử không đợi giờ. |

Bấm **💾 Lưu cấu hình** — có hiệu lực ngay, không restart. Đổi giờ nhắc cũng không cần restart.

---

## 5. Phân quyền (chỗ C)

*Quản trị* → *Phân quyền*:
1. Cấp phân hệ **HOPDONG (Hợp đồng mua bán)** cho nhóm kinh doanh / kế toán: Xem, Thêm, Sửa (Xóa chỉ xóa được bản *Nháp*). Ba chức năng: *Danh sách hợp đồng*, *Mẫu hợp đồng*, *Cấu hình ký* — khóa riêng tab nào thì bỏ tick tab đó.
2. **Ký số phía MOYN** (`kyso`) là **năng lực mặc định TẮT** — phải tick riêng cho giám đốc / kế toán trưởng. Chỉ người này thấy các nút *Ký số lại*, *Ký bằng USB token*, *Tải lên bản đã ký*, *Ký từ xa*, *Ký thử một PDF*.
3. Người vừa được cấp **đăng xuất rồi đăng nhập lại** (quyền nạp một lần lúc đăng nhập).

Lưu ý: phân hệ không tự cấp cho nhóm nào khi chạy migration — không cấp thì không ai thấy menu.

---

## 6. Chứng thư CA gốc — kiểm chuỗi tin cậy (v9.62, nên làm)

Để phần mềm tự xác nhận chữ ký của khách (và của MOYN) nối được tới CA gốc hợp pháp và chưa bị thu hồi:
1. Tải file chứng thư **CA gốc quốc gia** + các **CA công cộng** (VNPT-CA, Viettel-CA, FPT-CA, MISA-CA, NewCA, BKAV-CA…) dạng `.cer` / `.crt` / `.pem` — từ cổng NEAC `rootca.gov.vn` hoặc trang hỗ trợ của từng CA. Tối thiểu: CA cấp chứng thư cho MOYN + CA của khách hay ký.
2. Chép vào `D:\QLSX\backend\chungthu_goc\` (thư mục tự tạo khi mở tab Cấu hình ký; chưa có thì tạo tay).
3. Không cần restart — tab Cấu hình ký, dòng *Chứng thư CA gốc* liệt kê file đã đọc được. File hỏng được báo đỏ ngay dòng đó.

Chưa có file nào ⇒ cột 🔗 ở bảng *Các bên ký* ghi "Chưa kiểm chuỗi tin cậy" — vẫn ký được; kiểm bằng Adobe Reader. CRL được tải từ địa chỉ ghi trong chứng thư (máy chủ cần ra internet), đệm 6 giờ.

---

## 7. Công cụ "MOYN Ký số" (cho đường ký tay bằng USB token — cách Tắt)

- Mã nguồn `tools\MoynKySo\` (C#, .NET 8). Build trên máy có .NET 8 SDK:
  `cd tools\MoynKySo && dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true`
  → chép `MoynKySo.exe` vào `D:\QLSX\frontend\tools\MoynKySo\`. Trang tải cho khách: `https://thoitrangmoyn.id.vn/tools/MoynKySo/`.
- Chạy trên máy người ký (Windows, đã cài driver token của CA), nằm ở khay hệ thống, lắng nghe `localhost:8765` (dự phòng 8766). Trang web đưa dữ liệu cần ký → công cụ hỏi xác nhận (ghi rõ trang nào gọi) → Windows hỏi PIN → trả chữ ký về máy chủ. Khóa riêng không rời token; công cụ không gửi gì ra ngoài máy.
- Trang nào được gọi: `thoitrangmoyn.id.vn` và tên miền con, mọi địa chỉ **mạng nội bộ** (10.x / 172.16–31.x / 192.168.x / localhost — nhân viên MOYN dùng), cộng các dòng trong `origins.txt` đặt cạnh `MoynKySo.exe` (mỗi dòng một origin, vd `https://ten-mien-moi.vn`). Bị từ chối thì trang web báo đúng câu "công cụ đang chạy nhưng từ chối trang này" kèm địa chỉ cần thêm.

---

## 8. Danh sách kiểm "đã cấu hình xong"

- [ ] `.env`: `PUBLIC_BASE_URL`, `SMTP_*`, `HOPDONG_TEN_CONG_TY` — tab Cấu hình ký hiện *Email ● sẵn sàng* + đúng tên miền.
- [ ] `.env`: `HOPDONG_KY_TU_DONG` theo §1; `thu_ky_so.js --chungthu` in đúng tên công ty, còn hạn.
- [ ] `thu_ky_so.js <pdf>` → Adobe Reader: chữ ký hợp lệ + timestamp.
- [ ] Cấu hình ký: bên bán đủ (tên pháp nhân, MST, địa chỉ, người ký, chức vụ), email kế toán, nhắc hạn bật.
- [ ] Phân quyền: nhóm có HOPDONG; giám đốc / kế toán trưởng có **kyso**; đã đăng nhập lại.
- [ ] `backend\chungthu_goc\` có .cer của CA MOYN và CA khách hay dùng.
- [ ] Chạy thử trọn luồng với **email/SĐT của chính anh** (TRIEN_KHAI §22.3) trước khi gửi khách thật.

## 9. Lỗi hay gặp

| Thấy gì | Nguyên nhân | Sửa |
|---|---|---|
| Cấu hình ký: *Email ○ chưa cấu hình* | thiếu `SMTP_HOST` hoặc chưa `pm2 restart` sau khi sửa `.env` | §2.1, §2.6 |
| Link trong email là `/ky.html?t=…` không có tên miền | thiếu `PUBLIC_BASE_URL` | §2.1 |
| Khách mở link báo "không tìm thấy" / trang catalogue | `server.js` trên D:\ chưa phải bản v9.61 (danh sách trắng cổng công khai) | copy `backend\server.js`, restart |
| Kiểm bộ ký: *Không thấy file PFX* | đường dẫn sai / file chưa chép / quyền NTFS | §2.2 |
| Kiểm bộ ký: *Không thấy USB token nào* | token chưa cắm, DLL sai, driver chưa cài trên máy chủ | §2.2 |
| *PIN token SAI hoặc token đã khóa* | PIN trong `.env` sai — **đừng sửa rồi thử liên tục**, mỗi lần sai là một lần đếm | kiểm PIN bằng phần mềm của CA trước |
| Hợp đồng dừng ở *Lỗi ký số*, nhật ký ghi lý do | bộ ký lỗi lúc đó (TSA, token rút, PFX hết hạn) | sửa → nút **Ký số lại** |
| Không thấy nút ký số nào trong chi tiết hợp đồng | chưa tick năng lực **kyso** hoặc chưa đăng nhập lại | §5 |
| Trang chứng nhận ghi "kiểm chuỗi tin cậy bằng Adobe Reader" | chưa có .cer trong `chungthu_goc\` | §6 |
