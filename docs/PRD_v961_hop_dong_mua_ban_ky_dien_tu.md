# PRD v9.61 — Phân hệ HỢP ĐỒNG MUA BÁN + KÝ ĐIỆN TỬ qua link (OTP / chữ ký số)

*Nguyen yêu cầu 14/11/2026. Trạng thái: **GIAI ĐOẠN 1 ĐÃ VIẾT (14/11, chưa `node --check`, chưa deploy)** — hồ sơ triển khai + nghiệm thu: `docs/TRIEN_KHAI_v936_v940.md` §22.*

**Nguyen đã chốt (14/11):** (1) USB token — "đã cài môi trường ký, khách ký trực tiếp trên web": làm bằng công cụ **MOYN Ký số** chạy trên máy người ký (`tools/MoynKySo`) + đường tải về/ký/tải lên cho ai không cài; (2) **TSA công cộng miễn phí** (DigiCert mặc định); (3) hợp đồng **soạn riêng, không gắn đơn hàng sỉ**; mẫu **tải file lên** (.docx) hoặc soạn, biến `{{...}}` thành **ô nhập** khi tạo hợp đồng; (4) **OTP = email ngay, SMS + Zalo ZNS làm sẵn** (bật bằng `.env`). MOYN ký tự động: PFX hoặc PKCS#11 (token ở máy chủ) — để trống là người có năng lực `kyso` ký bằng công cụ / tải lên.

---

## 0. Năm điểm anh phải chốt trước khi tôi viết

*(Đã gộp hai tin nhắn bổ sung 14/11: trang quản trị / portal khách, và luồng "đối tác OTP qua SĐT → hệ thống TỰ ĐỘNG tạo PDF + ký số MOYN + dấu thời gian".)*

| # | Điểm | Đề xuất của tôi | Vì sao phải hỏi |
|---|---|---|---|
| 1 | **MOYN ký số TỰ ĐỘNG ở máy chủ** — anh ghi "file chứng thư số / HSM / USB Token sẵn có": **cái nào MOYN thật sự có?** | **Chỉ chứng thư dạng FILE (.pfx/.p12) hoặc HSM/ký từ xa có API** mới ký tự động được ổn định. USB token cắm vào máy chủ thì về lý thuyết ký được (PKCS#11, PIN), nhưng cần module native biên dịch trên máy chủ, PIN lưu trong `.env`, token rút ra là đứng — **tôi không khuyên** dùng cho máy chạy thật không có bản chạy thử. Việc anh làm: hỏi CA đang cấp chứng thư cho MOYN xin **chứng thư ký tự động** (dạng PFX hoặc dịch vụ HSM) — các CA đều có gói này cho hóa đơn điện tử. | Token USB giữ khóa riêng không xuất ra được; "tự động" nghĩa là máy chủ phải tự dùng khóa lúc 2 giờ sáng không ai gõ PIN. Chi tiết §4.2. |
| 2 | **Dấu thời gian (Timestamp) chống chối bỏ** — dùng TSA nào? | Giai đoạn 1: nối TSA theo chuẩn RFC 3161, địa chỉ cấu hình trong `.env`. Chọn **TSA Việt Nam có giấy phép** (VNPT/Viettel/FPT… có phí, giá trị pháp lý trong nước) hoặc tạm **TSA công cộng miễn phí** (DigiCert/Sectigo) để chạy thử. | Dấu thời gian là dịch vụ của bên thứ ba — không tự sinh ở máy chủ được (tự sinh thì không chống chối bỏ). |
| 3 | **"Khách có chữ ký số thì ký trực tiếp trên web"** | Giai đoạn 1: khách ký **OTP** (luồng chính anh mô tả); khách muốn ký số thì **cách C** (tải PDF về → ký bằng phần mềm CA của khách → tải lên, máy chủ kiểm). Giai đoạn 2 nối **MỘT** CA ký từ xa (VNPT SmartCA / Viettel MySign / FPT.eSign) để ký ngay trên web. | Trình duyệt **không** đọc được USB token; ký ngay trên web cần (A) app cài trên máy khách hoặc (B) tài khoản ký từ xa ở CA — §4.1. |
| 4 | **"Đơn hàng sỉ hiện có"** để "Tạo hợp đồng nhanh" | = **Phiếu bán hàng** (`PhieuBanHang`, bán sỉ cho shop/NPP, có CK, VAT, công nợ). "Chưa thanh toán" = `TongThanhToan` − đã thu ở Công nợ > 0. | Hệ thống còn "Đơn khách đặt" (catalogue) và "Lệnh SX". |
| 5 | **OTP về SĐT đã đăng ký** = SMS là kênh chính → **nhà cung cấp SMS**? + **điều khoản pháp lý** trong mẫu | Anh đăng ký brandname SMS (eSMS.vn / SpeedSMS / VNPT…) rồi dán API key vào `.env`; email là kênh dự phòng, chạy được ngay. Mẫu HĐ có điều "các bên thỏa thuận ký bằng phương thức điện tử (OTP/chữ ký số) và công nhận giá trị pháp lý" — kế toán/luật sư rà. | Không có SMS gateway nào trong hệ thống; Zalo OA đang kẹt gói, ZNS có phí. Tôi không phải luật sư: Luật Giao dịch điện tử 2023 phân biệt chữ ký số với chữ ký điện tử khác (OTP hợp lệ khi các bên **thỏa thuận**). |

**Thứ tự ký đã rõ từ tin nhắn của anh:** khách OTP trước → hệ thống tự chuyển trạng thái → tự tạo PDF hoàn chỉnh → ký số MOYN + dấu thời gian sau cùng (khóa toàn bộ hồ sơ, kể cả bằng chứng OTP). Đúng cách tôi định đề xuất.

Anh trả lời 5 dòng (tối thiểu: điểm 1 và 5) là tôi bắt đầu giai đoạn 1. Chưa có PFX/HSM thì tôi vẫn viết được toàn bộ phần còn lại, chừa **một chỗ cắm** cho bộ ký (PFX trước, HSM sau) và thử bằng chứng thư tự ký.

---

## 1. Vấn đề và mục tiêu

**Vấn đề.** MOYN bán sỉ cho công ty và hộ kinh doanh, hợp đồng đang ký giấy / gửi file qua lại: chậm, thất lạc, không biết ai đã xem, không có bằng chứng thời điểm ký. Khách là hộ kinh doanh phần lớn **không có chữ ký số**.

**Mục tiêu.** Từ phần mềm: soạn hợp đồng (từ mẫu hoặc tải PDF soạn sẵn, hoặc **tạo nhanh từ phiếu bán hàng**), gửi **link ký** cho khách qua email (SMS/Zalo khi có tài khoản dịch vụ); khách mở trên điện thoại, xem bảng hàng, **ký bằng OTP** hoặc **ký số**; MOYN **ký số bằng USB token**; lưu PDF cuối có đủ chữ ký + trang chứng nhận; theo dõi trạng thái, nhật ký (ai xem, lúc nào, IP, OTP xác nhận lúc nào).

**Tiêu chí hoàn thành (giai đoạn 1).**
1. Kế toán tạo hợp đồng từ phiếu bán hàng trong ≤ 2 phút, gửi link; khách ký OTP trên điện thoại trong ≤ 3 phút không cần cài gì.
2. PDF cuối: nội dung **không đổi** so với bản gửi (hash SHA-256 khớp), có trang "Chứng nhận ký điện tử" (ai, lúc nào, IP, kênh OTP, mã tra cứu + QR), và chữ ký số MOYN kiểm tra được bằng Adobe Reader.
3. Nhật ký không sửa được từ màn hình (chỉ thêm), xem được theo từng hợp đồng.
4. Link ký không lộ dữ liệu khác, hết hạn, OTP có giới hạn thử; cổng công khai chỉ mở đúng các đường dẫn cần.
5. Bộ tự kiểm chạy xanh với CSDL giả cho toàn bộ luồng OTP + kiểm chữ ký số trên file mẫu.

---

## 2. Hiện trạng kỹ thuật (đã đọc mã)

| Có sẵn | Dùng cho |
|---|---|
| Cloudflare Tunnel → `localhost:80` (cổng công khai), `PUBLIC_BASE_URL=https://thoitrangmoyn.id.vn`; cửa chặn `duocPhepCongKhai()` trong `server.js` | Link ký cho khách: `https://thoitrangmoyn.id.vn/ky.html?t=…` — chỉ cần thêm `/ky.html`, `/js/ky.js`, `/api/public/ky/*` vào danh sách trắng. HTTPS do Cloudflare lo. |
| SMTP qua `.env` (`SMTP_HOST/PORT/USER/PASS`, đang dùng cho cảnh báo sao lưu) | Gửi link + OTP email. **Chưa chắc máy chủ thật đã khai SMTP** — anh kiểm. |
| `puppeteer` (v8.36.3, GDT) | HTML → PDF cố định ở máy chủ (bản để ký). |
| `MauVanBanHRM` + lịch sử phiên bản + biến `{{…}}` (HĐLĐ) | Mẫu hợp đồng mua bán: bảng riêng `MauHopDongMB` cùng cơ chế. |
| `KhachHang` đã có `TenHoaDon`, `MaSoThue`, `DiaChiHoaDon`, `EmailHoaDon` | Bên mua. Thêm: loại đối tác (Công ty / Hộ KD / Cá nhân), người đại diện, chức vụ, CCCD (chủ hộ), số + ngày + nơi cấp ĐKKD, SĐT/email **người ký** (nhận OTP). |
| `PhieuBanHang` + `PhieuBanHangChiTiet` (mã hàng, màu, SL, đơn giá, CK, VAT, tổng) | "Tạo hợp đồng nhanh": phụ lục hàng hóa lấy thẳng từ phiếu. |
| Công nợ khách (phiếu thu theo `TenKhach`/`KhachHangID`) | Bộ lọc "Chưa thanh toán". |
| Zalo OA (v9.30) — **kẹt gói dịch vụ**, chỉ gửi được cho người đã nhắn OA | **Không** gửi OTP/link Zalo được bây giờ (cần ZNS, có phí, duyệt mẫu). |
| Không có SMS gateway, không nối CA nào, không có TSA | Phải mua/đăng ký nếu muốn. |

---

## 3. Pháp lý — tóm tắt để chọn phương án (không phải tư vấn luật)

- **Chữ ký số** (chứng thư do CA công cộng cấp: VNPT, Viettel, FPT, MISA, BKAV…): giá trị pháp lý như chữ ký tay của người ký và con dấu của tổ chức. Kiểm tra được độc lập bằng Adobe Reader / cổng NEAC.
- **Chữ ký điện tử khác (OTP + đồng ý trên web)**: hợp lệ khi (a) các bên **thỏa thuận** dùng, (b) gắn được với người ký và (c) phát hiện được thay đổi sau ký. Phần mềm bảo đảm (b) bằng OTP đến đúng email/SĐT đã khai trong hợp đồng + nhật ký IP/thời gian, (c) bằng hash + chữ ký số MOYN khóa sau cùng. (a) nằm ở điều khoản trong mẫu (§0 điểm 4).
- **"Dấu xác thực"** anh nhắc: giai đoạn 1 là **trang chứng nhận do phần mềm sinh** (mã tra cứu, QR dẫn tới trang kiểm tra công khai, hash, dấu thời gian máy chủ) — **không phải** dấu thời gian của tổ chức cấp dấu thời gian (TSA) được cấp phép. Muốn TSA thì thuê (giai đoạn 3).
- Khuyến nghị thực dụng: hợp đồng giá trị lớn / khách là công ty → ưu tiên khách ký số; hộ KD → OTP.

---

## 4. Ký số — điểm phải nói thẳng

### 4.1 Phía KHÁCH: ba cách để "ký số"

| Cách | Khách cần gì | MOYN cần gì | Làm được khi nào | Phí |
|---|---|---|---|---|
| **A. Ứng dụng ký cài trên máy người ký** (như "WeSign Tool", "VNPT Plugin"): trang web gửi hash xuống app ở `localhost`, app gọi USB token qua kho chứng thư Windows, trả chữ ký | Cài app Windows, cắm token, gõ PIN | Phải **viết và phát hành** app Windows (C#/.NET), ký số app để Windows không chặn | ≥ 1 đợt riêng | 0đ/lượt, nhưng công viết + hỗ trợ cài |
| **B. Ký từ xa qua CA** (VNPT SmartCA, Viettel MySign, FPT.eSign): trang web gọi API CA, người ký xác nhận trên app điện thoại | Có tài khoản ký từ xa ở đúng CA đó | Hợp đồng + API key với **từng** CA muốn hỗ trợ | Ngay khi có tài khoản; tôi làm khung chung + 1 CA | Theo lượt / gói |
| **C. Tải về → ký bằng phần mềm CA sẵn có → tải lên**; máy chủ kiểm: hash phần nội dung khớp bản gửi, chữ ký hợp lệ, chứng thư còn hạn, MST/tên trên chứng thư khớp bên ký | Có token + phần mềm CA (đã có vì dùng cho thuế/hóa đơn) | Không | **Ngay** | 0đ |

Câu anh chốt *"khách có chữ ký số thì ký trực tiếp trên web"* chỉ đạt được bằng A hoặc B. **Đề xuất: giai đoạn 1 khách ký OTP (luồng chính) + cách C cho khách muốn ký số**, **giai đoạn 2 làm B với một CA anh chọn** (hỏi 5–10 khách lớn xem họ dùng SmartCA hay MySign). A chỉ đáng làm nếu nhiều khách có token mà từ chối cách C.

### 4.2 Phía MOYN: ký số TỰ ĐỘNG ở máy chủ (theo tin nhắn bổ sung của anh)

| Nguồn khóa | Tự động được? | Cách nối | Nhận xét |
|---|---|---|---|
| **Chứng thư dạng file .pfx/.p12** (CA cấp "chứng thư ký tự động" / chứng thư mềm) | **Có, ổn định** | `@signpdf/signpdf` + `@signpdf/signer-p12` + `@signpdf/placeholder-pdf-lib` (thuần JS); file PFX để ngoài `uploads/`, mật khẩu trong `.env` (`HOPDONG_PFX_PATH`, `HOPDONG_PFX_PASS`) | **Đề xuất cho giai đoạn 1.** Ai đọc được máy chủ + `.env` thì ký được thay MOYN — cùng mức rủi ro với mật khẩu GDT (HOADON_SECRET) đã chấp nhận. |
| **HSM / dịch vụ ký từ xa có API** (VNPT-CA HSM, FPT.eSign HSM, Viettel-CA HSM, MISA…) | **Có, an toàn nhất** | Máy chủ gửi hash → dịch vụ trả chữ ký CMS → ghép vào PDF. Mỗi CA một API | Giai đoạn 2; cần hợp đồng + phí. Bộ ký viết dạng **chỗ cắm**: `kySo({ hash }) → chuKy` để thay PFX bằng HSM không đụng phần còn lại. |
| **USB token cắm vào máy chủ** | Có thể, **không khuyên** | PKCS#11 (`pkcs11js`, module native phải biên dịch trên máy chủ Windows) + PIN trong `.env`; nhiều token chặn gọi PIN tự động hoặc bật hộp thoại | Token rút/khởi động lại máy là đứng; không có bản chạy thử để tìm lỗi. Chỉ làm nếu CA từ chối cấp PFX/HSM. |

**Dấu thời gian (RFC 3161):** sau khi ký, máy chủ băm chữ ký → gửi tới TSA (`HOPDONG_TSA_URL`) → nhận token dấu thời gian → ghép vào chữ ký (thuộc tính không ký `signature-time-stamp`). Adobe Reader hiện "Signature is timestamped". TSA Việt Nam có giấy phép (VNPT/Viettel/FPT/NewCA…) có phí; chạy thử bằng TSA công cộng. TSA lỗi/không tới được ⇒ **vẫn ký, ghi nhật ký "thiếu dấu thời gian"** và cho ký lại dấu sau — không chặn hợp đồng.

**Thứ tự:** khách OTP → tự chuyển trạng thái → dựng PDF hoàn chỉnh (hợp đồng + phụ lục hàng + trang chứng nhận OTP) → ký số MOYN + TSA → "Đã ký" → email/SMS khách link tải bản cuối. Không còn bước "tải về/ký/tải lên" cho MOYN (bỏ lựa chọn "luôn ký USB token" anh chọn lúc đầu — tin nhắn sau đã thay).

---

## 5. Phạm vi giai đoạn 1 (viết khi anh "proceed")

### 5.1 Trang quản trị (phân hệ mới **HOPDONG** "Hợp đồng mua bán", quyền riêng; tab: Danh sách · Mẫu hợp đồng · Cấu hình ký)
- **Danh sách** hợp đồng: lọc trạng thái **Chờ ký / Đã ký / Chưa thanh toán** (+ Nháp, Từ chối, Hết hạn, Hủy), theo khách, theo kỳ; ô tìm dùng chung (`themOTimTuDong`).
- **Tạo hợp đồng**: (a) từ mẫu + chọn khách Danh mục + bảng hàng nhập tay; (b) **Tạo nhanh từ phiếu bán hàng** (chọn phiếu → điền bên mua + phụ lục hàng: mã sản phẩm, màu, SL, đơn giá, thành tiền, CK, VAT, tổng; gắn `PhieuBHID` để lọc "chưa thanh toán"); (c) **tải PDF soạn sẵn** (phần mềm chỉ lo ký).
- **Xem trước + Xuất bản để ký**: máy chủ dựng PDF cố định (puppeteer), tính SHA-256, khóa nội dung (muốn sửa = tạo phiên bản mới, hủy link cũ).
- **Gửi link ký**: email (SMTP) ngay; **SMS** viết sẵn khung eSMS/SpeedSMS (bật khi anh có API key); Zalo ZNS để giai đoạn 2. Nút **Gửi lại link / Gửi lại OTP**. Link hết hạn mặc định 7 ngày (chỉnh được).
- **MOYN ký số TỰ ĐỘNG**: ngay khi khách OTP xong, máy chủ dựng PDF hoàn chỉnh, ký số bằng chứng thư MOYN (PFX; chỗ cắm HSM) + dấu thời gian TSA (§4.2) — không ai phải bấm. Nút **"Ký số lại / ghép dấu thời gian"** cho trường hợp lỗi tạm (TSA không tới, hết hạn chứng thư…), gác bằng chức năng `HOPDONG/kyso`. Cấu hình ký (đường dẫn PFX, TSA, ảnh dấu) ở tab Cấu hình ký — mật khẩu PFX chỉ ở `.env`, không bao giờ lên màn hình.
- **Nhật ký (Audit trail)** từng hợp đồng: tạo, sửa, xuất bản, gửi link (kênh, tới đâu), **khách mở link (lúc, IP, thiết bị)**, gửi OTP (kênh, 4 số cuối/đuôi email), **nhập OTP đúng/sai lúc nào**, ký, từ chối (lý do), MOYN ký số (tên chứng thư), tải PDF. Chỉ thêm, không sửa; mỗi dòng có hash nối dòng trước (phát hiện sửa tay trong CSDL).
- **Tải PDF cuối**: PDF gốc + trang "CHỨNG NHẬN KÝ ĐIỆN TỬ" (các bên, cách ký, thời điểm, IP, mã tra cứu, QR → trang kiểm tra công khai, SHA-256 bản gốc) + chữ ký số MOYN bao trùm tất cả.
- **Trạng thái**: Nháp → Chờ khách ký → Đang ký số (tự động, vài giây) → Đã ký · nhánh: Từ chối / Hết hạn / Hủy · "Lỗi ký số" (giữ bằng chứng OTP, chờ ký lại) .

### 5.2 Trang khách (public portal, responsive, `ky.html`)
- Mở link: tên hợp đồng, hai bên, **bảng chi tiết hàng** (mã sản phẩm, màu, SL, đơn giá, thành tiền, tổng), xem PDF (nhúng), tải PDF bản chưa ký.
- Chọn cách ký: **OTP** (chọn kênh email / SMS khi có) hoặc **Ký số** (tải PDF về → ký → tải lên).
- OTP: gửi về **SĐT đã đăng ký** (SMS; email dự phòng khi chưa có SMS hoặc khách chọn), ô 6 số to, đếm ngược, "Gửi lại" sau 60 s; **ô tick đồng ý pháp lý** + nút to **"Tôi đồng ý ký kết / Xác nhận đơn hàng"** (câu bên cạnh: "Thao tác này ghi nhận ý chí giao kết hợp đồng điện tử theo Luật Giao dịch điện tử"); tùy chọn vẽ chữ ký trên màn cảm ứng hoặc gõ tên (ảnh đưa vào trang chứng nhận).
- Sau ký: thông báo thành công; máy chủ ký số MOYN ngay (vài giây) → **tải PDF cuối** (đủ chữ ký số + dấu thời gian) ngay trên trang; đồng thời gửi email/SMS link tải. Ký số lỗi tạm thì trang vẫn báo "đã ghi nhận ký, bản PDF có chữ ký số sẽ gửi sau".
- Từ chối ký: nhập lý do → về quản trị.
- Trang kiểm tra công khai `/ky.html?tra=<mã>`: nhập mã tra cứu / quét QR → thấy trạng thái + hash, **không** lộ nội dung.

### 5.3 An toàn
- Token link 32 byte ngẫu nhiên, chỉ lưu hash trong CSDL; hết hạn; vô hiệu khi hủy/đổi phiên bản.
- OTP 6 số, hạn 5 phút, sai 5 lần → khóa 15 phút; gửi lại tối đa 5 lần/giờ; giới hạn theo IP ở `/api/public/ky/*` (dùng lại cơ chế `chongDoMatKhau`).
- Email/SĐT nhận OTP lấy **từ hợp đồng** (do MOYN khai), khách không tự đổi trên trang ký.
- File PDF ở `backend/uploads_hopdong/` (như `uploads_hr/`: **không** có `express.static`), đọc qua route có kiểm quyền hoặc token hợp lệ. Không PII trên URL.
- Cổng công khai chỉ mở thêm `/ky.html`, `/js/ky.js`, `/api/public/ky/*`.

### 5.4 Kiểm chữ ký số khi KHÁCH tải lên (cách C — chỉ cho khách chọn ký số)
1. Phần đầu file tải lên **phải bằng đúng** bản PDF đã gửi (chữ ký số chuẩn ghi thêm "incremental update", không ghi lại file) → nội dung không đổi.
2. Đọc `/ByteRange` + `/Contents` của chữ ký, băm đúng vùng, so với `messageDigest` trong CMS; xác minh chữ ký bằng khóa công khai chứng thư (`pkijs`/`asn1js`, thuần JS).
3. Chứng thư còn hạn tại thời điểm ký; đọc tên/MST trên chứng thư (CN, SERIALNUMBER "MST:…") so với bên ký → cảnh báo nếu lệch (cho người có quyền chấp nhận có ghi lý do).
4. Chưa kiểm chuỗi tin cậy tới gốc NEAC/thu hồi (CRL/OCSP) ở giai đoạn 1 — ghi rõ trên trang chứng nhận "kiểm tra chuỗi tin cậy bằng Adobe Reader". Giai đoạn 2 bổ sung.

### 5.5 Dữ liệu (migration_v893)
- `KhachHang` + cột: `LoaiDoiTac` (CongTy/HoKD/CaNhan), `NguoiDaiDien`, `ChucVuNDD`, `SoCCCD`, `SoDKKD`, `NgayCapDKKD`, `NoiCapDKKD`, `SDTNguoiKy`, `EmailNguoiKy`.
- `MauHopDongMB` (+`_LichSu`): mã, tên, nội dung HTML với `{{Bien}}`, phiên bản.
- `HopDongMB`: số HĐ (HĐ<yy><4 số>), tên, `KhachHangID`, snapshot bên mua (JSON), `PhieuBHID` (null nếu tự soạn), nguồn (Mau/PDF), `MauMa`+`PhienBanMau`, HTML đã điền, đường dẫn PDF gốc, SHA-256 gốc, PDF đã ký khách, PDF cuối, SHA-256 cuối, trạng thái, hạn link, thứ tự ký, `NguoiTaoID`, mốc thời gian, `MaTraCuu`.
- `HopDongMBHang`: dòng hàng (mã hàng, màu, SL, ĐVT, đơn giá, CK, thành tiền) — chép từ phiếu hoặc nhập tay.
- `HopDongMBBenKy`: mỗi bên ký (MOYN / Khách): tên, chức danh, email, SĐT, cách ký (OTP/KySo), trạng thái, thời điểm ký, IP, UA, ảnh chữ ký, thông tin chứng thư (CN, MST, serial, hạn), lý do từ chối.
- `HopDongMBLink`: hash token, bên, hết hạn, lần mở cuối, vô hiệu.
- `HopDongMBOTP`: hash OTP, kênh, đích (che), hết hạn, số lần sai, dùng lúc.
- `HopDongMBNhatKy`: hành động, chi tiết JSON, IP, UA, `UserID` (nếu nội bộ), thời điểm, `HashTruoc`, `Hash`.
- `ChucNang` HOPDONG: `danhsach`, `mau`, `cauhinh`, `kyso` (MacDinhCho=0 — phải cấp mới có).
- `CauHinh`: `HOPDONG_KY` (tên công ty, người ký MOYN, chức vụ, ảnh dấu/chữ ký để in trang chứng nhận, hạn link, kênh OTP bật).

### 5.6 Mã nguồn
- Backend: `routes/hopdong.js` (nội bộ) + `routes/publicKy.js` (công khai, gắn ở `/api/public/ky`), `utils/hopDongPdf.js` (HTML→PDF bằng puppeteer, ghép trang chứng nhận bằng `pdf-lib`), `utils/kySoPdf.js` (**bộ ký MOYN**: chỗ cắm `kySo({hash})` — PFX giai đoạn 1, HSM sau; dấu thời gian RFC 3161), `utils/kiemChuKySo.js` (§5.4 + tự kiểm lại bản MOYN vừa ký), `utils/guiOtp.js` (email / SMS eSMS-SpeedSMS / stub Zalo), `utils/nhatKyHopDong.js` (hash nối), `server.js` (danh sách trắng cổng công khai).
- Frontend: `frontend/js/module.hopdong.js` (quản trị), `frontend/ky.html` + `frontend/js/ky.js` (khách, không dùng `common.js` nội bộ), `app.js` (+ phân hệ HOPDONG), `index.html`.
- CSDL: `database/migration_v893.sql` + `tao_file_cai_dat.js`.
- Thư viện cần cài trên máy chủ (anh chạy `npm install` trong `backend\`): `pdf-lib`, `@signpdf/signpdf`, `@signpdf/signer-p12`, `@signpdf/placeholder-pdf-lib`, `pkijs`, `asn1js`, `node-forge` (TSA/CMS). (`puppeteer`, `nodemailer`, `qrcode` đã có.)
- `.env` mới: `HOPDONG_PFX_PATH`, `HOPDONG_PFX_PASS`, `HOPDONG_TSA_URL`, `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SECRET`, `SMS_BRANDNAME`, `HOPDONG_LINK_HAN_NGAY` (mặc định 7).
- Bộ kiểm: `kiem_hop_dong_ky_dien_tu.js` (luồng OTP với CSDL giả, hết hạn/khóa, hash nhật ký; ký số bằng **chứng thư tự ký** sinh lúc chạy rồi tự kiểm lại; kiểm chữ ký số trên 1 file PDF mẫu đã ký thật — anh gửi tôi 1 file PDF do token MOYN ký để làm mẫu).
- Ước lượng: ~4.000 dòng, 3 phiên làm việc; **không chạy thử được ở đây** (sandbox chết) → anh `node --check` + bộ kiểm + thử tay theo TRIEN_KHAI. Phần ký số + TSA là phần **rủi ro nhất** vì không thử được với PFX thật trước khi lên máy chủ: sẽ có lệnh `node utils\thu_ky_so.js <pdf>` để anh thử ký một file bất kỳ trước khi bật cho hợp đồng.

---

## 6. Luồng chi tiết

**Ký OTP (khách):** mở link → nhật ký "đã xem" (IP/UA) → bấm "Ký bằng OTP" → chọn kênh (SMS mặc định) → máy chủ sinh OTP, lưu hash, gửi → khách nhập OTP + tick đồng ý + bấm "Tôi đồng ý ký kết / Xác nhận đơn hàng" (+ vẽ chữ ký tùy chọn) → máy chủ kiểm (hạn, số lần, khớp) → ghi bên ký = đã ký (thời điểm, IP, UA, kênh, ảnh) → **tự động**: ghép trang chứng nhận → ký số MOYN (PFX/HSM) + dấu thời gian → "Đã ký" → trang khách hiện nút tải PDF cuối; email/SMS khách + email kế toán.

**Ký số (khách, cách C):** bấm "Ký số" → tải PDF → ký ngoài → tải lên → kiểm §5.4 → đạt: ghi chứng thư, rồi tự động ký số MOYN + TSA như trên; không đạt: báo lý do cụ thể (file bị ghi lại / chữ ký không hợp lệ / chứng thư hết hạn / MST lệch).

**Ký số MOYN lỗi (TSA không tới, PFX hết hạn, file khóa):** trạng thái "Lỗi ký số", bằng chứng OTP đã lưu, nhật ký ghi lỗi; người có `HOPDONG/kyso` bấm "Ký số lại" sau khi sửa cấu hình. Không mất gì của khách.

**Từ chối / hết hạn:** khách bấm từ chối (lý do) hoặc quá hạn → quản trị thấy, sửa và xuất bản phiên bản mới (link cũ chết).

---

## 7. Giai đoạn sau
- **GĐ2 — ĐÃ VIẾT v9.62 (14/11, "làm luôn giai đoạn 2"; TRIEN_KHAI §23):**
  - ✅ **Phụ lục / thanh lý**: `HopDongMB.LoaiVanBan` (HopDong|PhuLuc|ThanhLy) + `HopDongChaID` (chỉ trỏ tới HĐ **Đã ký**, loại HopDong); số `PL<yy>####` / `TL<yy>####`; mẫu `PHULUC_CHUAN` / `THANHLY_CHUAN`; biến `{{HopDongCha_So}}`, `{{HopDongCha_Ten}}`, `{{HopDongCha_Ngay}}`, `{{LoaiVanBan}}`; nút "Tạo phụ lục / Tạo biên bản thanh lý" trên HĐ đã ký; ký y như hợp đồng. (PRD cũ xếp GĐ3 — kéo lên vì anh gộp vào GĐ2.)
  - ✅ **Hóa đơn**: `SoHoaDon` / `NgayHoaDon` ghi tay (PUT `/:id/hoa-don`), hiện 🧾 ở danh sách; **không** tự xuất HĐĐT.
  - ✅ **Nhắc hạn ký tự động**: `utils/nhacHanKy.js` (node-cron, giờ VN; cấu hình `batNhac` / `nhacTruocNgay` / `gioNhac` trong "Cấu hình ký"; nút "Chạy nhắc ngay"); quá hạn → HetHan + email kế toán; sắp hạn → gửi lại link (1 lần/ngày/HĐ), **không dời hạn**.
  - ✅ **Chuỗi tin cậy + CRL**: `utils/chuoiTinCay.js` (pkijs `CertificateChainValidationEngine`, gốc tin cậy = file trong `backend/chungthu_goc/`, CRL từ điểm phân phối, đệm 6 giờ); kết quả vào `HopDongMBBenKy.ChuoiTinCay` + nhật ký `CHUOI_TIN_CAY` + trang chứng nhận. OCSP: chưa.
  - ✅ **Ký từ xa qua CA** — khung `utils/kyTuXa.js` với 2 bộ chuyển đổi: `vnptsmartca` (SP769, bất đồng bộ — xác nhận trên app) và `csc` (Cloud Signature Consortium v1 — OTP/PIN, dùng cho Viettel MySign / FPT.eSign nếu họ theo chuẩn CSC). Dùng **đúng đường ký ngoài 2 bước** của `kySoPdf` (hash → CA ký → ghép CMS + TSA). Cho cả khách (portal, Cách 0) lẫn MOYN (nút "Ký từ xa"). ⚠️ **Chưa đối chiếu với tài khoản thật** — cần hợp đồng tích hợp với CA; mã log `[kyTuXa]` để chỉnh tên trường.
  - ⏸ SMS OTP / Zalo ZNS: mã đã sẵn từ GĐ1, chờ anh đăng ký brandname / nâng gói OA.
- **GĐ3:** OCSP; ký nhiều bên / nhiều người ký mỗi bên; hợp đồng nguyên tắc nhiều đơn; nhiều CA ký từ xa cùng lúc (hiện 1 nhà/`.env`); dấu thời gian TSA có giấy phép VN (hiện DigiCert công cộng).

---

## 8. Việc anh cần chuẩn bị (song song với tôi viết)
1. **Chứng thư ký tự động cho MOYN**: hỏi CA đang dùng xin chứng thư dạng PFX (hoặc gói HSM có API). File PFX đặt ngoài `uploads/` (vd `D:\QLSX\backend\chungthu\moyn.pfx`), mật khẩu gõ thẳng vào `backend\.env` — **đừng dán vào chat**.
2. **SMS**: đăng ký brandname ở eSMS.vn / SpeedSMS (hoặc nhà mạng); dán API key vào `.env`. Chưa có thì OTP đi email trước.
3. **TSA**: chọn nhà cung cấp dấu thời gian VN (có phí) hoặc tạm TSA công cộng để chạy thử; cho tôi URL.
4. Khai SMTP trên máy chủ thật (`SMTP_HOST/PORT/USER/PASS`) và kiểm `PUBLIC_BASE_URL`.
5. Thông tin bên bán: tên pháp nhân, MST, địa chỉ, người ký, chức vụ; ảnh con dấu + chữ ký (PNG nền trong) để in lên PDF.
6. Một file PDF đã ký bằng token MOYN (bất kỳ) để tôi làm mẫu kiểm chữ ký số của khách.
7. Mẫu hợp đồng mua bán đang dùng (Word) — tôi chuyển thành mẫu `{{Bien}}`; kế toán/luật sư rà điều khoản ký điện tử.
8. Quyết định GĐ2: CA ký từ xa cho khách (hỏi khách lớn dùng gì) — **v9.62 đã viết khung cho VNPT SmartCA + chuẩn CSC; cần anh ký hợp đồng tích hợp với CA để có tài khoản SP (`KYTUXA_*` trong `.env`) rồi mới thử được.**
9. **v9.62:** tải file .cer CA gốc + CA trung gian (NEAC Root, VNPT-CA, Viettel-CA, FPT-CA…) chép vào `D:\QLSX\backend\chungthu_goc\` để phần mềm kiểm chuỗi tin cậy; chạy `migration_v894.sql`.

---

## 9. Rủi ro và giả định
- **Giả định:** khách mở link bằng điện thoại, có email thật (hộ KD hay dùng Zalo hơn email — không có SMS/ZNS thì tỷ lệ ký qua email có thể thấp; đây là lý do nên đăng ký SMS sớm).
- **Rủi ro pháp lý:** bản ký OTP phụ thuộc điều khoản thỏa thuận; tranh chấp thì bằng chứng là nhật ký + email/SMS gửi tới địa chỉ do khách cung cấp. Giảm rủi ro: hợp đồng lớn yêu cầu ký số.
- **Rủi ro kỹ thuật:** phần mềm ký của khách ghi lại toàn bộ file (không incremental) → kiểm thất bại; xử lý: hướng dẫn dùng Adobe Reader/Foxit/plugin CA (đều incremental) + cho người có quyền chấp nhận thủ công có ghi lý do.
- **Khóa ký nằm trên máy chủ (PFX):** ai chiếm được máy chủ + `.env` là ký được thay MOYN. Giảm: file PFX ngoài thư mục công khai, quyền NTFS chỉ tài khoản chạy pm2, nhật ký mọi lần ký, sao lưu `.bak` không kèm PFX; lâu dài chuyển HSM.
- **Phụ thuộc TSA ngoài:** TSA chết thì chữ ký vẫn có nhưng thiếu dấu thời gian — hệ thống ghi rõ và cho ghép lại sau; không để hợp đồng kẹt.
- **Vận hành:** SMTP/SMS bị chặn/giới hạn; theo dõi lỗi gửi trong nhật ký, nút gửi lại.
- **Không chạy thử được ở sandbox**: bộ kiểm với CSDL giả + anh thử tay là lưới an toàn duy nhất, như mọi đợt.

---

## 10. Câu hỏi mở (ngoài §0)
- Một hợp đồng có thể gắn **nhiều** phiếu bán hàng không (hợp đồng nguyên tắc năm + nhiều đơn)? Giai đoạn 1 tôi làm 1 HĐ ↔ 0/1 phiếu; hợp đồng nguyên tắc để sau.
- Khách là **cá nhân** (không công ty, không hộ KD) có ký không? Tôi để `LoaiDoiTac = CaNhan` sẵn trong dữ liệu, mẫu dùng CCCD.
- Có cần khách **đăng nhập** (Tài khoản khách v8.07) để xem lại các hợp đồng đã ký? Giai đoạn 1: không, chỉ link + mã tra cứu.
