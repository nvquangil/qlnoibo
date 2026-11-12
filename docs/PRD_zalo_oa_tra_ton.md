# PRD — Zalo OA: khách tra tồn ngay trong chat + xem lịch sử đặt hàng

**Ngày:** 2026-11-05 · **Yêu cầu:** Nguyen · **Trạng thái:** CHỜ DUYỆT, chưa viết dòng code nào
**Thay thế** bản `PRD_zalo_miniapp_oa.md` (phạm vi cũ rộng hơn: có công nợ, có Mini App).

**Chốt từ Nguyen:**
- OA **đã xác thực** → không còn vướng thủ tục.
- Hiển thị **giá bán** + **màu còn hàng**, **y như catalogue hiện tại**.
- Khách chat **mã hàng hoặc ảnh** → bot trả tồn ngay.
- Khách **đăng nhập** → xem **lịch sử đặt hàng** của mình.
- Công nợ: **bỏ khỏi phạm vi** (xác nhận giúp — xem Q3).

---

## 1. Vấn đề

Cả ngày nhân viên trả lời cùng một câu: *"mã này còn màu gì không?"* — khách gửi mã hàng, hoặc gửi
lại chính tấm ảnh mình đã xem, rồi chờ người tra kho trả lời. Khách hỏi ngoài giờ thì đợi tới hôm sau.

Dữ liệu để trả lời đã nằm sẵn trong hệ thống và **đã công khai** qua trang catalogue. Việc còn lại
chỉ là cho máy trả lời thay người, ngay trong chat Zalo — nơi khách đã ở sẵn.

## 2. Nền đã có (không phải làm lại)

| Cần gì | Hiện trạng |
|---|---|
| OA xác thực | ✅ Nguyen đã có |
| Tên miền + HTTPS công khai để Zalo gọi webhook | ✅ `thoitrangmoyn.id.vn` (Cloudflare Tunnel) |
| API tra hàng công khai | ✅ `/api/public/catalogue`, `/catalogue-danhmuc`, `/danhmuc/:slug` |
| Tồn theo màu | ✅ `vw_TonTheoMau`, `vw_TonKhoHangHoa` |
| Lịch sử đơn của khách | ✅ `/api/public/khach/donhang`, `/khach/donhang/:id` |
| Tài khoản khách | ✅ `TaiKhoanKhach` (nhân viên tạo, có `KhachHangID`) |
| Xử lý ảnh phía server | ✅ `sharp` đã nằm trong `package.json` |

**Chưa có:** webhook OA, đối chiếu ảnh → mã hàng, và đăng nhập bằng Zalo.

## 3. 🔴 Luật hiển thị — giữ nguyên như catalogue, không nới

Catalogue hiện tại (`catalogue.js:471`) chỉ hiện **tên các màu còn hàng** + **giá bán**. **Không hiện
số lượng tồn.** Đây là chính sách có chủ ý từ khi mở tài khoản khách.

⇒ **Bot phải trả lời đúng mức đó**: *"Còn màu Trắng, Đen, Be — giá 185.000đ"*.
**Không bao giờ** trả *"còn 37 cái"*. Bot nói nhiều hơn web một chữ là lộ năng lực kho qua một kênh
mà bất kỳ ai nhắn OA cũng hỏi được.

Tương tự, chỉ trả lời mã hàng thuộc **danh mục đã bật `CongKhai`**. Mã ngoài danh mục đó → trả lời
như không tìm thấy, không tiết lộ là có tồn tại.

## 4. Tiêu chí thành công

| Đo cái gì | Mốc |
|---|---|
| Câu hỏi "còn màu gì / còn hàng không" nhân viên phải trả lời tay | giảm ≥ 70% sau 1 tháng |
| Bot trả lời đúng khi khách gửi **mã hàng** | ≥ 95% (sai = trả nhầm mã hoặc nói không có trong khi có) |
| Bot trả lời đúng khi khách gửi **ảnh chụp tem** (mã vạch **hoặc** mã chữ) | ≥ 80% — không đặt cao hơn, xem R3c |
| Bot trả lời đúng khi khách gửi **ảnh chụp lại từ catalogue/Zalo** | ≥ 80% |
| Bot trả lời đúng khi khách gửi **ảnh tự chụp sản phẩm** | **không đặt mốc** — bot đưa ứng viên cho khách chọn, không đoán |
| Khách tự xem được lịch sử đơn (không phải hỏi) | ≥ 50% khách sỉ dùng trong 2 tháng |
| **Trả số tồn, giá vốn, hoặc dữ liệu của khách khác** | **0 — tiêu chí chặn** |

## 5. Phạm vi

**Trong phạm vi**

1. Webhook OA: khách nhắn **mã hàng** → trả ảnh + giá bán + **màu còn hàng**.
2. Khách gửi **ảnh** → đối chiếu với kho ảnh sản phẩm → trả cùng nội dung trên.
3. Khách **đăng nhập** → xem **lịch sử đặt hàng** của chính mình.

**Ngoài phạm vi**

- Công nợ (bỏ theo yêu cầu mới).
- Đặt đơn trong chat — vẫn đặt trên trang catalogue như hiện nay.
- **Mini App** — xem §7, tôi đề nghị chưa làm.
- Số lượng tồn cụ thể (§3).

## 6. Kế hoạch

### Giai đoạn 1 — Bot OA tra tồn (5–8 ngày) — phần đáng giá nhất

1. Route mới `POST /api/zalo/webhook` (public, **có xác thực chữ ký của Zalo**, chống giả mạo).
2. Nhận tin nhắn **chữ**: bắt mã hàng trong câu (khách hay gõ kèm chữ: *"còn mã AB123 không shop"*).
   - Khớp **chính xác** một mã → trả lời.
   - Khớp **nhiều mã gần giống** → bot hỏi lại kèm 3 ứng viên, **không đoán**.
   - Không khớp → câu trả lời lịch sự + gợi ý gửi ảnh hoặc link catalogue.
3. Nhận **ảnh** — Nguyen chốt Q2: khách gửi **cả ba kiểu**, nên xử lý theo **thang rẻ → đắt, dừng
   ngay khi chắc**:

   | Thứ tự | Loại ảnh | Cách đọc | Độ tin cậy thực tế |
   |---|---|---|---|
   | ① | Ảnh chụp tem — **mã vạch 1D** (tem hiện có) | Giải mã bằng `@zxing/library` + `sharp` | **60–85%** — xem R3c, thấp hơn nhiều so với máy quét |
   | ①b | Ảnh chụp tem — **QR** (nếu thêm vào tem) | Giải mã QR | **90%+** — QR chịu được mờ/nghiêng/che nhờ tự sửa lỗi |
   | ② | Ảnh chụp tem — **mã sản phẩm dạng chữ** (tem đã có sẵn) | OCR đúng vùng đó | 70–85%, phụ thuộc ảnh |
   | ③ | **Ảnh lấy lại từ catalogue/Zalo** | **dHash** (`sharp`) so với bảng hash ảnh sản phẩm | cao — ảnh bị nén/resize vẫn khớp |
   | ④ | **Ảnh tự chụp sản phẩm ngoài đời** | dHash thường **trượt** | thấp — xem R3 |

   Mỗi bước thử **nhiều biến thể ảnh** (xoay 90/180/270°, tăng tương phản, cắt từng vùng) trước khi
   bỏ sang bước sau — ảnh chụp tay hay nghiêng và lóa.

   Hết cả bốn mà không chắc → bot gửi **3 ứng viên gần nhất kèm ảnh** để khách bấm chọn, **không
   đoán**. Lựa chọn của khách được ghi lại — đó là dữ liệu để cải thiện vòng sau.

### 6b. 🔴 Nên thêm QR vào tem — và một chỗ tôi tra không ra

Tem hiện có **mã sản phẩm (chữ) + mã vạch 1D** (Nguyen chốt Q4). Hai đường đọc đó dùng được ngay,
nhưng **mã vạch 1D chụp bằng điện thoại rồi gửi qua Zalo là trường hợp xấu** — xem R3c. Thêm một QR
nhỏ vào tem sẽ nâng đường đọc chắc nhất từ ~60–85% lên 90%+, và backend **đã có sẵn thư viện
`qrcode`** (đang dùng để in tem QR cho **vải cây** ở `module.khovai.js`).

⚠️ **Chỗ tôi tra không ra:** trong QLNoiBo **không có chức năng in tem cho hàng hóa**. `MaBarcode` chỉ
là **một ô nhập tay** ở form thẻ kho (`module.khohang.js:982`) và form nhập kho
(`module.nhapkho.js:654`) — hệ thống **lưu** mã vạch chứ không **in** tem. Chức năng in tem duy nhất
tìm thấy là của vải cây.

⇒ Nghĩa là tem sản phẩm đang in bằng **phần mềm khác** (phần mềm của máy in tem?), lấy giá trị từ
QLNoiBo. Nếu đúng vậy thì việc thêm QR nằm ở phần mềm đó, không phải ở đây. Xem **Q5**.
4. Nhật ký: lưu mọi câu hỏi + câu trả lời để đối chiếu khi khách báo "bot nói sai".

### Giai đoạn 2 — Lịch sử đặt hàng, đăng nhập không cần mật khẩu (3–5 ngày)

Nút trên menu OA → OA gửi **link một lần** (token hết hạn) → mở trang catalogue **đã đăng nhập sẵn**
→ khách thấy đơn của mình. Gắn `ZaloUserID` vào `TaiKhoanKhach` ở lần đầu, các lần sau nhận ra ngay.

Bỏ được việc nhân viên phát tay tên đăng nhập/mật khẩu cho từng khách — khách sỉ mất mật khẩu là
chuyện xảy ra liên tục.

### Giai đoạn 3 — Mini App (CHƯA làm)

Xem §7.

## 7. Vì sao tôi đề nghị CHƯA làm Mini App

Toàn bộ những gì Nguyen vừa mô tả — xem giá + màu còn hàng, tra tồn bằng chat, xem lịch sử đơn —
**làm trọn được bằng OA + trang catalogue đang chạy**. Mini App thêm vào đúng một thứ: khách không
phải nhảy sang trình duyệt. Đổi lại là 10–15 ngày viết lại giao diện bằng ZMP/React cộng thời gian
chờ Zalo duyệt.

Đề nghị: làm Giai đoạn 1 + 2 trước. Nếu khách kêu phải nhảy ra trình duyệt thì mới làm Mini App —
lúc đó API đã sẵn hết, Mini App chỉ còn là phần vỏ.

## 8. Rủi ro

| | Rủi ro | Hậu quả | Xử lý |
|---|---|---|---|
| **R1** 🔴 | Bot đoán nhầm mã gần giống | Khách đặt nhầm hàng, tin số sai | Chỉ trả lời khi khớp **chính xác**; mờ thì hỏi lại kèm ảnh, **cấm đoán** |
| **R2** 🔴 | Bot trả số tồn hoặc mã ngoài danh mục công khai | Lộ năng lực kho qua kênh ai cũng hỏi được | §3 là luật cứng; viết bộ tự kiểm ghim "không có số tồn trong câu trả lời" |
| **R3** | **Ảnh tự chụp sản phẩm ngoài đời** (đường ④) — nền khác, sáng khác, góc khác | dHash trượt; nếu cố đoán thì **trả nhầm mã** | Không hứa nhận ra. Bot đưa **3 ứng viên** cho khách chọn. Muốn nhận ra thật thì phải dùng mô hình so khớp đặc trưng (embedding) — **việc riêng, không nằm trong đợt này** |
| **R3b** | OCR tem (đường ②) đọc nhầm ký tự: `0`↔`O`, `1`↔`I`, `5`↔`S` | Trả tồn của **mã khác** | Chỉ chấp nhận kết quả OCR khi khớp **đúng một** mã có thật; mờ thì hỏi lại. Và ưu tiên dẹp hẳn rủi ro này bằng §6b (QR trên tem) |
| **R3c** 🔴 | **Mã vạch 1D qua ảnh chat** — vạch mảnh, ảnh nghiêng/lóa, **cộng thêm Zalo nén ảnh** | Đường ① trượt nhiều hơn kỳ vọng; đừng hứa 95% | Thử nhiều biến thể ảnh trước khi bỏ cuộc; **đo tỉ lệ thật sau 2 tuần** rồi mới quyết có thêm QR vào tem hay không. Nếu tỉ lệ thấp → §6b thành việc ưu tiên |
| **R4** | **Cửa sổ nhắn tin của OA**: OA chỉ được trả lời tư vấn trong một khoảng thời gian sau tin của khách | Tin ngoài cửa sổ không gửi được, phải dùng ZNS (có phí) | Bot **trả lời ngay** nên luôn trong cửa sổ. ⚠️ Con số hiện hành **tôi chưa xác minh được** (§10) |
| **R5** | Webhook là cửa mới mở ra Internet | Giả mạo, spam, dò mã hàng hàng loạt | Xác thực chữ ký Zalo; giới hạn tần suất theo `ZaloUserID`; chỉ đọc, không ghi gì vào kho |
| **R6** | Mọi thứ chạy qua Cloudflare Tunnel về **một máy Windows ở xưởng** | Bot kéo thêm tải, giờ cao điểm chậm | Cache kết quả tra mã trong ~1 phút; cache bảng hash ảnh trong bộ nhớ |

## 9. Câu hỏi mở

- ✅ **Q1 — Giá: CHỐT — khách thấy GIÁ CHUNG** (`TheKhoHangHoa.GiaBan`), đúng như catalogue hiện nay.
  Bot **không** tính chiết khấu riêng của từng khách. Hệ quả: bot trả lời được cho **cả người chưa
  đăng nhập**, vì giá không phụ thuộc khách là ai — đây là lý do phần tra tồn làm được trước, độc
  lập hoàn toàn với phần đăng nhập ở Giai đoạn 2.
- ✅ **Q2 — Ảnh: CHỐT — cả ba kiểu** (ảnh từ Zalo/catalogue, ảnh tự chụp, **và ảnh chụp tem có mã**).
  Xử lý theo thang bốn bước ở §6.3. Ảnh chụp tem là kiểu **chắc nhất** và ta tự quyết được → §6b.
- ✅ **Q3 — Công nợ: CHỐT — chưa cần.** Ra khỏi phạm vi. Kéo theo: **không phải** backfill
  `KhachHangID` (nợ Track B v8.07) trong đợt này — đó là rủi ro lớn nhất của bản PRD cũ, nay biến mất.
- ✅ **Q4 — Tem: CHỐT — tem có mã sản phẩm (chữ) + mã vạch, in từ phần mềm.** ⇒ làm được **cả đường ①
  (giải mã vạch) lẫn đường ② (OCR mã chữ)** ngay, không phải sửa tem trước.
- 🔴 **Q6 — MÃ NHÀ CUNG CẤP** *(mới, từ ảnh ③)*: khách gửi poster của NCC với mã `BD26C072`. Mã
  hàng của mình (`A26C1121`) **cùng kiểu đặt** — có phải mã trong thẻ kho **chính là** mã NCC đặt
  cho mẫu đó không? Nếu đúng thì chỉ cần OCR là tra được luôn, khỏi thêm gì. Nếu khác thì hệ thống
  **có lưu mã NCC ở đâu không** (`GhiChu`? `MaBarcode`? không lưu?) — không lưu thì ảnh kiểu này
  mãi mãi không tra được, phải trả lời bằng cách dẫn khách sang catalogue.
- **Q5 — Hai điều về tem, cần xác nhận trước khi code phần ảnh:**
  1. **Mã vạch đang mã hóa giá trị gì** — `TheKhoHangHoa.MaBarcode` hay chính `MaHang`? (Quyết định
     tra bảng nào. Nếu là `MaBarcode` thì phải kiểm: có mã nào **để trống** hoặc **trùng nhau** không
     — trùng là bot trả nhầm hàng.)
  2. **Tem in bằng phần mềm nào?** Tôi **không tìm thấy** chức năng in tem hàng hóa trong QLNoiBo
     (§6b) — nên đoán là phần mềm của máy in tem. Cần biết để tính chuyện thêm QR sau này.

## 9b. Thứ tự làm — và chỗ tôi bị chặn

| Việc | Cần gì từ Zalo | Trạng thái |
|---|---|---|
| **1. Lớp tra cứu**: mã hàng / mã vạch → ảnh + giá bán + màu còn hàng, lọc theo `CongKhai` | không | ✅ **ĐÃ VIẾT (v9.25)** — §9d |
| **2. Bảng hash ảnh sản phẩm** (`sharp` → dHash) + hàm so khớp | không | ✅ **ĐÃ VIẾT (v9.28)** — §9e |
| **3. Giải mã vạch / QR từ ảnh** | `@zxing/library` — Nguyen **đã `npm install` trên máy chủ** | ✅ **ĐÃ VIẾT (v9.28)** — §9e |
| **4. Webhook OA** (nhận tin, xác thực chữ ký, gửi trả lời) | **App ID + Secret + OA Access Token**, đăng ký URL webhook trên `oa.zalo.me` | ❌ chờ Nguyen |
| **5. Đăng nhập bằng Zalo + lịch sử đơn** | App ID/Secret | ❌ chờ Nguyen |

Việc 1–3 là **phần ruột**, kiểm thử được mà không cần Zalo. Việc 4 chỉ là lớp vỏ nối vào.

## 9d. v9.25 — đã viết (2026-11-06)

**Chốt thêm từ Nguyen:** *"mã vạch tự làm là số riêng, mã hàng cột mã hàng ở thẻ kho hàng hóa"*
⇒ tra được **cả hai**: `TheKhoHangHoa.MaHang` và `TheKhoHangHoa.MaBarcode`. Mã vạch chỉ dùng để
**tìm**, không bao giờ hiện ra cho khách.

| File | Việc |
|---|---|
| `backend/utils/traCuuHangCongKhai.js` | **MỚI** — chuẩn hóa mã, tách mã khỏi câu khách nhắn, tìm theo mã hàng → mã vạch → gần đúng, lấy thông tin **đúng mức catalogue** |
| `backend/routes/public.js` | **MỚI**: `GET /api/public/tracuu?q=…` + chống dò theo IP (30 lần/phút → 429) |
| `backend/utils/kiem_tracuu_ma_cong_khai.js` | **MỚI** — bộ tự kiểm chạy hành vi thật trên pool giả (không copy sang D:\) |

**Backend thuần — không đụng file JS của trình duyệt, nên KHÔNG phải bump `?v=`.**

Ba điều hàm này cố ý làm:

1. 🔴 **Không bao giờ trả số tồn**, mã vạch, hay ID nội bộ — đúng mức catalogue đang cho xem (§3).
   Bộ tự kiểm có phép ghim `!/tonCai|tongTon|TonCai|SoLuong/i` trên chính chuỗi JSON trả về.
2. 🔴 **Không đoán.** Mã gần đúng (`AB12` khớp cả `AB123` lẫn `AB124`) → trả `nhieu` để bot hỏi lại
   kèm ảnh. Trả nhầm mã là khách đặt nhầm hàng; hỏi lại một câu rẻ hơn nhiều.
3. 🔴 **Mã không công khai trả lời y như mã không tồn tại** — nói "có nhưng không được xem" là đã
   tiết lộ nó tồn tại.

Thêm hai điều về vận hành: chỉ mục mã (`MaHang`/`MaBarcode`) **giữ trong bộ nhớ 60 giây** — một tin
nhắn nhiều từ chỉ nạp **một** lần thay vì mỗi từ một câu SQL; và điều kiện công khai **dùng lại
đúng hàm của catalogue** (`dieuKienCongKhaiMH` / `dieuKienCongKhaiDM` / `layHangDangGiu`), không
viết lại — viết lại là có ngày hai nơi lệch nhau, mà lệch ở đây nghĩa là rò dữ liệu.

**Kiểm thử ngay (chưa cần Zalo):**

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\public.js
node --check backend\utils\traCuuHangCongKhai.js
node backend\utils\kiem_tracuu_ma_cong_khai.js
```

Rồi sau khi copy sang `D:\QLSX` + `pm2 restart`, mở thử trên trình duyệt:
`https://thoitrangmoyn.id.vn/api/public/tracuu?q=<một mã hàng thật>` — và thử luôn với **mã vạch**,
với **cả câu** kiểu `còn mã XXX không shop`, và với **một mã nội bộ chưa bật công khai** (phải ra
`"trangThai":"khong"`).

## 9c. Thư viện mới phải thêm

| Thư viện | Dùng để | Lý do chọn |
|---|---|---|
| `@zxing/library` | Giải mã **mã vạch 1D + QR** từ ảnh | **Thuần JS**, không cần biên dịch native — quan trọng vì máy chủ là Windows ở xưởng. (`zbar` nhanh hơn nhưng phải build native) |
| *(tuỳ)* OCR cho đường ② | Đọc mã chữ trên tem | Chốt sau khi đo đường ① — có thể không cần |

`sharp` và `qrcode` **đã có sẵn**, không phải thêm.

⚠️ Chưa cài thử được (sandbox hỏng cả phiên) — phải `npm install` và chạy thử trên **một tấm ảnh tem
thật chụp bằng điện thoại, gửi qua Zalo** trước khi tin con số nào ở §6.3.

## 9e. v9.28 — tra bằng ẢNH (2026-11-06)

✅ **v9.25 đã chạy thật trên máy chủ.** Nguyen thử `?q=A26C1121` → trả đúng tên hàng, giá 89.000,
**8 màu còn hàng**, **không có số tồn**, không lộ mã vạch. Luật hiển thị giữ nguyên.

| File | Việc |
|---|---|
| `backend/utils/anhHashSanPham.js` | **MỚI** — dHash bằng `sharp`; chỉ mục hash **lưu xuống đĩa** (`uploads/.hash-anh.json`, khóa theo mtime+size); `timTheoAnh`; lệnh `--dung` dựng sẵn chỉ mục |
| `backend/utils/docMaTuAnh.js` | **MỚI** — giải mã vạch/QR bằng `@zxing/library`, **nạp lười** (chưa cài thì đường này tắt, phần khác vẫn chạy); thử 7 biến thể ảnh (xoay EXIF, xoay 90/180/270, tăng tương phản + làm nét) |
| `backend/routes/public.js` | **MỚI**: `POST /api/public/tracuu-anh` (multipart, trường `anh`) |
| `backend/package.json` | ghim `@zxing/library` — **kẻo lần deploy sau đè mất bản vừa cài trên máy chủ** |
| `backend/utils/kiem_tracuu_anh.js` | **MỚI** — bộ tự kiểm, tự dựng ảnh rồi chạy dHash thật |

**Thang xử lý, rẻ → đắt, dừng ngay khi chắc:**

1. **Mã vạch / QR trên tem** → ra thẳng mã, tra như khách gõ tay.
2. *(chưa làm)* OCR mã chữ trên tem — bật sau khi đo tỉ lệ của bước 1.
3. **dHash** — ảnh khách lấy lại từ catalogue/Zalo (bị nén, bị đổi cỡ vẫn khớp).
4. Không chắc → trả **tối đa 3 ứng viên** cho khách bấm chọn.

Ba chỗ cố ý làm chặt:

- 🔴 **Ảnh người lạ giữ trong BỘ NHỚ**, không ghi xuống `uploads/` — thư mục đó đang được phục vụ
  công khai ra internet (xem `laDuongDanCong` trong `server.js`).
- 🔴 **Chỉ băm ảnh của hàng đang công khai.** Băm cả ảnh mã nội bộ thì khách gửi ảnh trúng là bot
  lộ mã đó.
- 🔴 **Đọc được mã nhưng không ra hàng → không nói "đọc được mã X"**, mà rơi tiếp xuống dHash. Nói ra
  là xác nhận mã đó có thật.

**Chạy sau khi deploy** (lần đầu băm vài nghìn ảnh mất vài phút — làm trước để khách đầu tiên không
phải chờ):

```powershell
cd C:\QLSX\backend   # hoặc D:\QLSX\backend
node utils\anhHashSanPham.js --dung
```

**Thử:**

```powershell
curl.exe -F "anh=@C:\duong\dan\anh-chup-tem.jpg" https://thoitrangmoyn.id.vn/api/public/tracuu-anh
```

Kết quả có thêm `duong` (`ma-vach` hay `anh`) và `thuVienMaVach` (true/false) để biết đường nào đã
chạy. 🔴 **Thử bằng ảnh THẬT chụp bằng điện thoại rồi gửi qua Zalo**, không phải ảnh tải từ máy tính
— Zalo nén ảnh, đó mới là điều kiện thật.

## 9f. 🔴 ẢNH THẬT KHÁCH GỬI — và điều nó đánh đổ (2026-11-06)

Nguyen gửi 3 ảnh mẫu. Chúng cho thấy giả định của §6.3 **lạc quan quá mức**:

| Ảnh | Thực tế | Đường nào ăn? |
|---|---|---|
| ① Hai quần nỉ trên sàn gỗ, có tay người, **tem vàng treo ở giữa khung** | Tem chiếm **~1/20 chiều rộng ảnh**, nghiêng, có bóng. Mã vạch chỉ vài chục pixel | ① mã vạch **chỉ nếu quét theo ô**; dHash **trượt** |
| ② Hai áo + một quần trên nền gạch, tem trắng mờ | Tem nhỏ hơn nữa, chữ không đọc nổi bằng mắt | gần như **không đường nào** |
| ③ **Ảnh poster của NHÀ CUNG CẤP** (BB ANGEL), mã **BD26C072**, giá 185.000, size 2-7Y (RI6) | Chữ **to, rõ, đọc được bằng mắt** | **OCR** ăn chắc — nhưng đó là **mã của NCC**, không phải mã trong thẻ kho |

**Ba kết luận, không tô hồng:**

1. 🔴 **dHash gần như vô dụng với ảnh ①②.** Nó so ảnh với ảnh studio trong catalogue; ảnh chụp cả
   đống hàng trên sàn thì bố cục khác hoàn toàn. Giữ lại chỉ để phục vụ ca "khách gửi lại đúng ảnh
   của shop" — đúng như R3 đã cảnh báo, nhưng tỉ trọng thực tế **thấp hơn** tôi tưởng.
2. 🔴 **Giải mã trên ảnh toàn cảnh chắc chắn trượt.** Thu ảnh về 1600px thì vạch mã còn vài pixel.
   ⇒ **đã sửa (v9.29)**: quét theo lưới **3×3 rồi 5×5, ô chồng mép 25%, mỗi ô phóng to 900px** rồi
   mới giải mã. Đây mới là thứ có cơ may đọc được tem trong ảnh ①.
3. 🔴 **Ảnh ③ mở ra một nhu cầu KHÁC**: khách gửi **poster của nhà cung cấp** và hỏi "có hàng này
   không". Mã trên đó là **mã NCC** (`BD26C072`), không phải `MaHang`. Xem Q6.

**Và điều quan trọng nhất — nhiều ảnh KHÔNG xác định được một mã duy nhất.** Ảnh ① có 2 quần + 1 áo;
ảnh ② có 3 món. Bot trả lời "mã này còn màu X" là sai bản chất câu hỏi. Khi không chắc, câu trả lời
đúng là **dẫn khách đi tiếp**, không phải xin lỗi:

> *"Ảnh có nhiều mẫu nên shop chưa nhận ra chính xác. Bạn chụp **cận cái tem** (chỗ có mã vạch) gửi
> lại giúp, hoặc gõ mã trên tem — shop trả lời ngay. Hoặc xem toàn bộ hàng còn tại: …"*

Dạy khách chụp cận tem là **đòn bẩy rẻ nhất** trong cả dự án: không tốn dòng code nào mà kéo tỉ lệ
đọc lên nhiều hơn mọi cải tiến thuật toán.

### 🔴 Việc PHẢI làm trước khi viết webhook: ĐO trên chính ba ảnh này

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo\backend
node utils\docMaTuAnh.js "C:\duong\dan\anh1.jpg" "C:\duong\dan\anh2.jpg" "C:\duong\dan\anh3.jpg"
```

In ra mã đọc được, đọc qua **đường nào** (`ca-anh` / `quet-o-3` / `quet-o-5`) và **mất bao lâu**.
🔴 Dùng đúng file **tải về từ Zalo**, không phải ảnh gốc trong máy — Zalo nén ảnh.

Kết quả quyết định cách soạn câu trả lời của bot:

- Đọc được **≥2/3** → bot cứ thử ảnh trước, trượt mới xin mã.
- Đọc được **≤1/3** → bot **xin mã/ảnh cận tem ngay từ câu đầu**, đừng bắt khách chờ vài giây rồi
  vẫn "không nhận ra".

## 10. Điều tôi chưa kiểm chứng được

Không tải được tài liệu Zalo trong phiên này (trang dựng bằng JS, browser pane bị chặn). Nên **quy
định cửa sổ nhắn tin của OA, giới hạn số tin, và phí ZNS chưa được xác nhận** — phải lấy từ
`oa.zalo.me`, đừng lấy theo trí nhớ của tôi. Phần kiến trúc ở trên **không phụ thuộc** mấy con số đó;
chúng chỉ ảnh hưởng tới việc bot có được chủ động nhắn lại sau nhiều giờ hay không.

## 11. Đề xuất

Duyệt **Giai đoạn 1**, chạy thử với 5–10 khách sỉ, đọc nhật ký hỏi–đáp sau 2 tuần rồi mới mở rộng.
Giai đoạn 2 làm song song được vì không đụng gì tới Giai đoạn 1.
