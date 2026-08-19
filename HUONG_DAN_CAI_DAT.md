# HƯỚNG DẪN CÀI ĐẶT — HỆ THỐNG QUẢN LÝ NỘI BỘ (SQL SERVER + NODE.JS) — v5.4

Hệ thống gộp 4 công cụ Google Sheets/Apps Script rời rạc trước đây (Quản lý sản xuất, Kho vải, Thẻ kho hàng hóa, Phụ kiện) thành **một web app duy nhất**, dùng chung **một database SQL Server**, có đăng nhập và phân quyền theo nhóm/bộ phận. Tài liệu này viết lại từ đầu, áp dụng cho cài đặt mới lẫn nâng cấp từ bản cũ.

**Kiến trúc:** SQL Server (dữ liệu) ← Node.js/Express (backend API + phục vụ giao diện) ← trình duyệt (HTML/JS thuần, không cần cài gì phía người dùng ngoài trình duyệt).

> Vì sao không dùng Google Sheets như trước? Yêu cầu ban đầu là dùng SQL Server và có phân quyền chi tiết theo phân hệ — điều Google Sheets không làm tốt ở quy mô nhiều bảng liên kết. Đánh đổi: hệ thống này cần một máy chủ chạy Node.js + một instance SQL Server (có thể cài miễn phí bản **SQL Server Express** trên cùng máy tính đang dùng làm server), thay vì "miễn phí hoàn toàn trên trình duyệt" như bản Apps Script.

**6 phân hệ (yêu cầu đăng nhập) trong bản v4.0:** Danh mục, Quản lý User, Quản lý sản xuất, Quản lý kho vải, Thẻ kho hàng hóa, Quản lý phụ kiện — cộng thêm **1 trang công khai `catalogue.html`** không cần đăng nhập, xem Bước 10.5.

> **Yêu cầu mới ở v4.0:** trình duyệt cần **kết nối Internet** khi mở trang (để tải thư viện quét mã QR `html5-qrcode` từ CDN `cdnjs.cloudflare.com`) — xem lưu ý ở Bước 2.3 nếu xưởng vận hành trong mạng LAN cách ly hoàn toàn không có Internet.

---

## PHẦN A — CÀI ĐẶT SQL SERVER

## BƯỚC 1 — Cài SQL Server (nếu chưa có)

1. Tải **SQL Server Express** (miễn phí, đủ dùng cho xưởng quy mô vừa/nhỏ): https://www.microsoft.com/sql-server/sql-server-downloads
2. Cài đặt theo chế độ **Basic**. Ghi nhớ tên instance (mặc định `localhost\SQLEXPRESS` hoặc `localhost`).
3. Cài thêm **SQL Server Management Studio (SSMS)** để thao tác database bằng giao diện: https://aka.ms/ssmsfullsetup
4. Trong SSMS, bật chế độ đăng nhập **SQL Server Authentication** (không chỉ Windows Authentication):
   - Chuột phải vào server → Properties → Security → chọn "SQL Server and Windows Authentication mode" → Restart dịch vụ SQL Server.
5. Tạo 1 tài khoản SQL (hoặc dùng `sa`) và đặt mật khẩu mạnh — sẽ dùng trong file `.env` ở Bước 4.

## BƯỚC 2 — Tạo database (cài đặt mới hoàn toàn)

Bỏ qua bước này nếu bạn đang **nâng cấp** từ bản đã cài trước đó — xem Bước 2.1 / 2.2.

1. Mở SSMS, kết nối vào SQL Server.
2. Mở file `database/schema.sql` (File → Open → File...).
3. Bấm **Execute (F5)**. Script tự tạo database `QLNoiBo`, toàn bộ ~34 bảng, 4 view báo cáo, và dữ liệu danh mục mẫu (bộ phận, nhóm quyền, công đoạn sản xuất, màu sắc, loại phụ kiện mẫu...).
4. Kiểm tra: mở rộng `QLNoiBo → Tables` trong SSMS.

## BƯỚC 2.1 — Nâng cấp từ v1.0 lên v2.0 (bỏ qua nếu cài mới, hoặc đã từng chạy bước này)

Áp dụng nếu bạn đã chạy `schema.sql` bản v1.0 (chưa có phân hệ Kho vải nâng cao / Phụ kiện) và đã có dữ liệu thật:

1. Mở file `database/migration_v2.sql` trong SSMS, bấm **Execute (F5)**.
2. Script thêm cột `PhieuXuatVai.DonHangID` (dùng cho tính năng cấp phát vải theo đơn hàng). Idempotent — chạy lại nhiều lần không lỗi.

## BƯỚC 2.2 — Nâng cấp từ v2.0 lên v3.0 (bỏ qua nếu cài mới)

Áp dụng nếu bạn đã có database v1.0 hoặc v2.0 (nếu từ v1.0, chạy migration_v2.sql ở Bước 2.1 **trước**, rồi mới chạy bước này):

1. Mở file `database/migration_v3.sql` trong SSMS, bấm **Execute (F5)**.
2. Script tạo phân hệ **Phụ kiện** (bảng `LoaiPhuKien`, `DanhMucPhuKien`, `PhieuPhuKien`, `PhieuPhuKienChiTiet`, view `vw_TonKhoPhuKien`), đăng ký module `PHUKIEN`, và cấp quyền **Xem** mặc định cho toàn bộ nhóm quyền hiện có (nhóm `Kho` được cấp thêm quyền Thêm/Sửa). Idempotent — chạy lại nhiều lần không lỗi, không đụng dữ liệu cũ.
3. Sau khi chạy migration xong, thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v3.0, khởi động lại server (`pm2 restart qlnoibo` hoặc `npm start`).
4. Vào **Quản lý User → Ma trận phân quyền** để tinh chỉnh lại quyền của từng nhóm trên module Phụ kiện nếu quyền mặc định (chỉ Xem, trừ nhóm Kho) chưa đúng nhu cầu thực tế.

## BƯỚC 2.3 — Nâng cấp từ v3.0 lên v4.0 (bỏ qua nếu cài mới)

Áp dụng nếu bạn đang chạy database v3.0 (nếu vẫn còn ở v1.0/v2.0, chạy `migration_v2.sql` và `migration_v3.sql` trước theo Bước 2.1/2.2, rồi mới chạy bước này):

1. Mở file `database/migration_v4.sql` trong SSMS, bấm **Execute (F5)**.
2. Script tạo 3 danh mục mới (`DanhMucDonViTinh`, `CongDoanMay`, `NhanVien`), bảng `ThongBao` (thông báo trong hệ thống), bảng `TienDoChiTietMauPhu` + `PhanCongMay` (chi tiết màu phụ và giao việc nội bộ cho công đoạn May), thêm cột `NhanVienTraiVaiID`/`NhanVienCatID` vào `TienDoSanXuat`, cột `DonGiaNhap` vào `VaiCay`, các cột `LoaiHang`/`DonHangID`/`DonViCoBan`/`DonViQuyDoi` vào `TheKhoHangHoa`, và cột `NCC_ID`/`SoHoaDon` vào `PhieuPhuKien`. Cấp thêm quyền **Sửa** cho nhóm `Kho` trên module QLSX (cần để nhóm Kho xác nhận "Kho nhập" trực tiếp trong QLSX). Idempotent — chạy lại nhiều lần không lỗi, không đụng dữ liệu cũ.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v4.0, khởi động lại server (`pm2 restart qlnoibo` hoặc `npm start`).
4. **Nếu xưởng KHÔNG có Internet tại máy trạm dùng để quét QR** (chức năng quét camera ở Kho vải dùng thư viện `html5-qrcode` tải từ CDN `cdnjs.cloudflare.com` khai báo trong `frontend/index.html`): tải file `html5-qrcode.min.js` (bản 2.3.8) về, đặt vào `frontend/js/vendor/html5-qrcode.min.js`, rồi sửa lại đường dẫn `<script src="...">` trong `frontend/index.html` để trỏ vào file nội bộ đó thay vì CDN. Nếu không có Internet và không tự host, các nút "Quét QR" vẫn hiển thị nhưng báo lỗi khi bấm — mọi tính năng khác của hệ thống không bị ảnh hưởng.
5. Khai báo dữ liệu ban đầu cho 2 danh mục mới **Công đoạn may** và **Nhân viên** (xem Bước 8) trước khi dùng tính năng "giao việc nội bộ" ở công đoạn May.
6. Kiểm tra lại **Quản lý User → Ma trận phân quyền**: nhóm `Kho` cần quyền Sửa trên QLSX (đã tự cấp ở bước 2, chỉ cần xác nhận), các nhóm khác giữ nguyên phân quyền cũ.

## BƯỚC 2.4 — Nâng cấp từ v4.0 lên v5.0 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v4.0 mô tả ở tài liệu này (nếu còn ở bản cũ hơn, chạy lần lượt `migration_v2.sql`/`migration_v3.sql`/`migration_v4.sql` theo Bước 2.1/2.2/2.3 **trước**, rồi mới làm bước này).

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc, vì đợt này đổi route nghiệp vụ ở cả 4 phân hệ đăng nhập cùng lúc (QLSX, Kho vải, Kho hàng, Phụ kiện).
2. Mở SSMS, chạy lần lượt đúng theo **thứ tự này** (file thứ 2 seed dữ liệu vào bảng do file thứ 1 tạo ra):
   1. `database/migration_v5_chucnang.sql` — tạo bảng `ChucNang`/`ChucNangPermissions` (hạ tầng phân quyền theo **từng tab con**, không chỉ theo phân hệ như trước), seed danh mục chức năng cho cả 6 phân hệ đăng nhập.
   2. `database/migration_v5_qlsx.sql` — bổ sung cột/bảng cho Quản lý sản xuất: tách "Ra lệnh sản xuất" khỏi "Thêm đơn hàng", màu phối lồng trong màu chính, phụ kiện chỉ định theo đơn, mã công đoạn may + đơn giá, giao vải sản xuất tạm, chi tiết cắt theo từng cây.

   Cả 2 file đều idempotent (dùng `IF NOT EXISTS`/`MERGE`) — chạy lại nhiều lần không lỗi, không mất dữ liệu. **Không cần** migration riêng cho Kho vải/Kho hàng (Phase 3/4) — các thay đổi ở 2 phân hệ này dùng lại đúng cột/bảng đã có.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.0 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/` (không đè các thư mục/file này).
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đề phòng có thêm dependency mới — bản v5.0 hiện tại chưa thêm gói nào so với v4.0, chạy lại vẫn an toàn, không mất thời gian).
5. Khởi động lại server: `pm2 restart qlnoibo` (hoặc tắt/mở lại `npm start`, hoặc restart Windows Service nếu dùng NSSM).
6. **Yêu cầu mọi tài khoản đang mở đăng xuất và đăng nhập lại** — quyền theo chức năng được tính 1 lần lúc đăng nhập, không tự cập nhật giữa phiên (giống nguyên tắc đã có từ v4.0 ở Bước 9).
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **Quản lý User → Ma trận phân quyền**: giờ mỗi phân hệ có thêm ô tick theo **từng tab con** (VD QLSX tách riêng Dashboard / Ra lệnh sản xuất / Danh sách đơn hàng / Đơn giá công đoạn may) — mặc định tất cả tab đang được xem (an toàn, không mất quyền nhóm cũ đã cấu hình), chỉnh lại nếu muốn giới hạn thêm theo đúng nhu cầu bộ phận.
   - **Kho vải → Nhập kho**: form giờ chọn **Loại vải + Màu** thay vì chọn thẳng 1 mã vải có sẵn — hệ thống tự tìm hoặc tự tạo mã vải tương ứng.
   - **Kho vải → Xuất kho**, chọn 1 đơn hàng sản xuất: danh sách cây vải chọn được chỉ gồm cây đã "Giao vải sản xuất" cho đúng đơn đó (từ QLSX) — nếu đơn chưa từng giao vải sản xuất, danh sách sẽ trống kèm hướng dẫn; vào **QLSX → đơn hàng đó → Giao vải sản xuất** trước rồi quay lại xuất kho.
   - **Kho hàng hóa → Đơn khách đặt hàng**: thử lên đơn với số lượng vượt tồn kho hiện có của 1 mã hàng-màu — hệ thống phải báo lỗi rõ (nêu cần bao nhiêu, còn bao nhiêu) và **không ghi đơn**, không trừ tồn.

## BƯỚC 2.5 — Nâng cấp từ v5.0 lên v5.1 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.0 (đã chạy xong Bước 2.4). Đợt này **không đổi cấu trúc dữ liệu ở Kho vải/Kho hàng/Phụ kiện** (chỉ thêm route/giao diện dùng lại đúng bảng đã có) — riêng phần **phân quyền theo từng user** cần 1 migration mới.

1. **Backup database trước khi chạy** (xem Phần D) — thói quen bắt buộc trước mọi migration, dù đợt này chỉ thêm bảng mới, không đụng dữ liệu cũ.
2. Mở SSMS, chạy file `database/migration_v5_userperm.sql`. File này **yêu cầu bảng `ChucNang` đã tồn tại** (tạo ở `migration_v5_chucnang.sql`, Bước 2.4) — nếu server của bạn đã qua Bước 2.4 thì luôn đã có sẵn, không cần làm gì thêm. Script tạo 2 bảng mới `UserPermissions` và `UserChucNangPermissions` (phân quyền ghi đè riêng theo từng tài khoản, xem Bước 9). Idempotent — chạy lại nhiều lần không lỗi, không mất dữ liệu.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.1 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Khởi động lại server: `pm2 restart qlnoibo`.
5. **Yêu cầu mọi tài khoản đang mở đăng xuất và đăng nhập lại** để nhận đúng quyền mới (phân quyền vẫn chỉ tính 1 lần lúc đăng nhập).
6. **File mẫu phiếu in (`mau_phieu.docx`) chưa nhận được** — xem cảnh báo quan trọng ngay dưới bảng kiểm tra này trước khi coi bước in ấn là đã xong.
7. Kiểm tra lại theo đúng thứ tự sau:
   - **Quản lý User → Ma trận phân quyền**: xuất hiện 2 lựa chọn **"Theo nhóm quyền"** (như cũ) và **"Theo từng user"** (mới) ở đầu trang. Chọn "Theo từng user", chọn 1 tài khoản bất kỳ, tick "Ghi đè riêng" ở 1 phân hệ bất kỳ và lưu thử — tài khoản đó phải áp dụng đúng quyền vừa tick (sau khi đăng xuất/đăng nhập lại) bất kể nhóm của họ quy định gì; bỏ tick "Ghi đè riêng" và lưu lại — tài khoản phải quay về đúng quyền theo nhóm như trước khi ghi đè.
   - **Giao diện chung**: menu bên trái và nội dung bên phải phải **cuộn độc lập** (cuộn menu không kéo theo nội dung và ngược lại); đăng nhập xong hoặc khi có thông báo mới phải thấy **popup nổi lên góc màn hình**, không chỉ tăng số trên chuông 🔔; mọi form dạng popup (thêm/sửa) phải **đóng được bằng phím Esc**.
   - **In phiếu bất kỳ** (nhập/xuất kho vải, phụ kiện...): phần đầu trang in phải có dòng **"CÔNG TY TNHH THỜI TRANG MOYN"** — xem cảnh báo về file mẫu thật ngay dưới đây.
   - **Kho vải → Tồn theo cây**: gõ thử 1 ký tự bất kỳ có trong mã cây/mã vải/loại vải/màu — bảng phải lọc ngay, không cần gõ đúng từ đầu.
   - **Kho vải → Quét QR** (ở Tồn theo cây hoặc form Xuất kho): nếu trình duyệt đang mở bằng **địa chỉ IP LAN qua HTTP** (không phải `localhost` hay HTTPS), hệ thống phải báo rõ lý do không mở được camera (thay vì lỗi chung chung) — xem mục cảnh báo HTTPS/camera bên dưới.
   - **Kho vải → Nhập kho / Xuất kho**: cả 2 tab giờ là **màn hình danh sách phiếu đã tạo**, có nút Xem/In, Sửa, Xóa (theo đúng phân quyền Sửa/Xóa của tài khoản đang đăng nhập) và nút "+ Tạo phiếu..." mở form nhập liệu trong popup; thử tạo 1 phiếu, sau khi lưu phải tự mở màn hình xem/in phiếu vừa tạo.
   - **Kho vải → In tem theo ngày nhập**: in thử 1 tem, so với bản cũ QR phải **to rõ rệt hơn** (khổ QR 75mm thay vì ~37mm trước đây), thông tin bên dưới đọc được dễ dàng hơn.
   - **Kho hàng hóa → Tạo thẻ kho mới**, chọn Loại hàng "Nhà sản xuất" rồi chọn 1 đơn hàng: danh sách màu hiện ra chỉ được **chọn trong số màu đã khai báo lúc ra lệnh sản xuất** (không đổi được sang màu khác), ô "Số cắt" phải **khóa không sửa được** (tự điền theo số liệu công đoạn Cắt), và nút "+ Thêm màu" phải **biến mất** với loại hàng này.
   - **Kho hàng hóa → bấm vào 1 mã hàng để xem chi tiết**: bảng "Chi tiết theo màu" có thêm cột **Ảnh** (bấm ảnh phải phóng to xem được), và mỗi dòng màu có nút **"Đặt hàng"** — thử bấm, phải mở form cho phép nhập **nhiều khách cùng lúc** cho đúng 1 mã hàng + 1 màu đó.
   - **Kho hàng hóa → Lên đơn đặt hàng**: ô "Mã hàng" chỉ liệt kê **mã còn tồn kho > 0**; chọn 1 mã hàng xong, ô "Màu" phải tự lọc lại chỉ còn **đúng những màu thuộc mã hàng đó** (không còn hiện tất cả màu trong danh mục).
   - **Quản lý phụ kiện → Phiếu Nhập / Phiếu Xuất**: cả 2 tab giờ là **màn hình danh sách phiếu**, có Xem/In, Sửa, Xóa theo phân quyền và nút tạo phiếu mới; trong form tạo Phiếu Nhập, chọn 1 "Loại PK" ở đầu 1 dòng phải lọc lại ô "Phụ kiện" ngay bên cạnh chỉ còn phụ kiện thuộc loại đó, và có nút "+ Thêm loại PK" thêm loại mới ngay tại form; trong form tạo Phiếu Xuất, chọn 1 đơn hàng sản xuất phải lọc ô "Phụ kiện" ở mọi dòng chỉ còn phụ kiện đã được **chỉ định NPL** cho đúng đơn đó.

> **⚠️ File mẫu phiếu in (`mau_phieu.docx`) chưa nhận được:** yêu cầu ghi "fomr phiếu như file mau phieu.docx kèm theo", nhưng khi rà lại toàn bộ file đính kèm trong phiên làm việc này, **không tìm thấy file nào tên `mau_phieu.docx`** (chỉ có 1 file cũ tên "CHỈ ĐỊNH SẢN XUẤT.docx" từ giai đoạn trước, không phải mẫu phiếu nhập/xuất kho). Toàn bộ tiêu đề in phiếu trong bản này đang dùng **placeholder**: dòng chữ "CÔNG TY TNHH THỜI TRANG MOYN" viết thường (không logo, không địa chỉ/mã số thuế, không định dạng đặc biệt) trong hàm `printPhieu()` (`frontend/js/common.js`). Nếu form mẫu thật có logo/địa chỉ/số điện thoại/mã số thuế hoặc bố cục khác, gửi lại đúng file `mau_phieu.docx` để chỉnh cho khớp — hiện tại chỉ có dòng tên công ty là đúng yêu cầu, phần còn lại là suy đoán hợp lý.

> **⚠️ Quét QR bằng camera trên điện thoại/máy khác qua mạng LAN:** trình duyệt chỉ cho phép mở camera (`getUserMedia`) khi trang chạy qua **HTTPS** hoặc qua **`localhost`** — đây là quy định bảo mật của bản thân trình duyệt, không phải lỗi của ứng dụng. Nếu xưởng đang truy cập bằng địa chỉ IP LAN qua HTTP thuần (VD `http://192.168.1.20:3000`), nút "Quét QR" sẽ luôn báo lỗi trên mọi máy trừ máy chủ (vì máy chủ mở bằng `localhost`), **kể cả khi đã cấp quyền camera cho trình duyệt**. Bản v5.1 đã cải thiện thông báo lỗi để nêu rõ nguyên nhân này thay vì báo chung chung, nhưng **chưa cấu hình HTTPS cho server** (nằm ngoài phạm vi yêu cầu đợt này) — nếu cần quét QR từ các máy trạm khác ngoài máy chủ, cần bổ sung chứng chỉ HTTPS (tự ký hoặc mua) cho `backend/server.js`, đây là một hạng mục hạ tầng riêng.

## BƯỚC 2.6 — Nâng cấp từ v5.1 lên v5.2 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.1 (đã chạy xong Bước 2.5). Đợt này **chỉ thay đổi phân hệ Quản lý sản xuất** (không đụng Kho vải/Kho hàng/Phụ kiện, ngoại trừ việc "phụ kiện cần dùng" nay ghi nhận muộn hơn — xem chi tiết ở mục 6 bên dưới) — cần 1 migration mới bổ sung bảng/cột và **2 công đoạn sản xuất mới**.

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc, vì đợt này chèn thêm 2 công đoạn vào giữa luồng sản xuất đang chạy.
2. Mở SSMS, chạy file `database/migration_v52_qlsx.sql`. Script này:
   - Tạo danh mục mới **`MaySanXuat`** (máy sản xuất, VD "1 kim", "Vắt sổ") + cột `NhanVien.MaySanXuatID` (gắn nhân viên với máy họ đang ngồi, phục vụ tính lương sau này).
   - Tạo bảng **`DonHangCongDoanMay`** — đơn giá/hệ số công đoạn may **riêng theo từng đơn hàng** (khác `DonGiaCongDoanMay` là giá mặc định toàn hệ thống), chọn và khai báo ngay tại công đoạn "Kỹ thuật".
   - Thêm cột **`DonHangChiTietVai.AnhMau`** — ảnh riêng cho từng màu chính trong cấu trúc vải.
   - **Chèn thêm 2 công đoạn sản xuất mới "Giao vải" và "Phụ kiện"** vào `CongDoanSanXuat`, đặt ngay trước công đoạn "Cắt" (tự dịch số thứ tự các công đoạn từ "Cắt" trở đi lùi lại, không ảnh hưởng đơn hàng đang chạy vì hệ thống lưu theo ID công đoạn chứ không theo số thứ tự). **Script chỉ chạy bước này nếu tìm thấy đúng tên công đoạn "Kỹ thuật" và "Cắt" đã có sẵn** — nếu trước đó bạn đã đổi tên 2 công đoạn này trong Danh mục, script sẽ bỏ qua và in cảnh báo; cần tự thêm 2 công đoạn này bằng tay qua **Danh mục → Công đoạn sản xuất** rồi chỉnh lại thứ tự cho đúng vị trí (trước "Cắt").
   - Thêm cột **`TienDoCatChiTietCay.SoKgMetSuDung`** (KG/mét vải đã dùng, ghi theo từng cây ở công đoạn Cắt) và bảng **`TienDoTraiVai`** (cho phép chọn nhiều — tối đa 2 — nhân viên trải vải/1 lần ghi nhận, thay vì chỉ 1 người như trước; cột đơn `NhanVienTraiVaiID` cũ **vẫn giữ lại** để tương thích ngược, ghi người đầu tiên trong danh sách).
   
   Idempotent (`IF NOT EXISTS`/`COL_LENGTH`) — chạy lại nhiều lần không lỗi, không mất dữ liệu.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.2 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Khởi động lại server: `pm2 restart qlnoibo`.
5. **Yêu cầu mọi tài khoản đang mở đăng xuất và đăng nhập lại.**
6. Khai báo dữ liệu ban đầu cho danh mục mới **Máy sản xuất** (Danh mục → Máy sản xuất) trước khi gán vào từng Nhân viên (Danh mục → Nhân viên → chọn Máy sản xuất).
7. **"Phụ kiện cần dùng" không còn khai báo lúc Ra lệnh sản xuất** — với các đơn hàng tạo TRƯỚC khi nâng cấp mà đã có sẵn phụ kiện chỉ định, dữ liệu đó vẫn còn nguyên (không bị xóa) và vẫn hiện trong "In lệnh sản xuất"/"In phiếu"; với đơn hàng tạo SAU khi nâng cấp, phải vào **Ghi tiến độ → chọn công đoạn "Phụ kiện"** để khai báo.
8. Kiểm tra lại theo đúng thứ tự sau:
   - **Dashboard**: bấm vào 1 dòng trong bảng "Đơn hàng đang sản xuất" — phải mở ra popup chi tiết đơn hàng đó (không phải chuyển tab).
   - **Danh mục → Máy sản xuất**: thêm/sửa/xóa được, có sẵn 2 dòng mẫu "1 kim"/"Vắt sổ". **Danh mục → Nhân viên**: form thêm/sửa có thêm ô chọn "Máy sản xuất", danh sách hiện thêm cột này.
   - **Ghi tiến độ, chọn công đoạn "Kỹ thuật"**: dưới 3 ô cũ (Mét sơ đồ/Khổ vải/Mã rập) phải có thêm bảng checklist các công đoạn may — tick chọn vài công đoạn, sửa đơn giá/hệ số khác với giá mặc định, bấm "Gửi"; mở lại đúng đơn đó, tick lại "Kỹ thuật" — các công đoạn đã tick và đơn giá vừa sửa phải còn nguyên (không về lại giá mặc định).
   - **Ra lệnh sản xuất**: mỗi khối "màu chính" trong Cấu trúc vải có thêm ô tải **Ảnh màu**; phần "Phụ kiện cần dùng" không còn hiện ở form này nữa (chỉ còn dòng ghi chú hướng dẫn qua Ghi tiến độ). Tạo thử 1 lệnh có ảnh màu, bấm "In lệnh sản xuất" — bảng Cấu trúc vải phải có thêm cột Ảnh hiện đúng ảnh vừa tải theo từng dòng màu chính (màu phối không có ảnh).
   - **Danh sách lệnh sản xuất** (tên tab đã đổi từ "Danh sách đơn hàng"): nút "Giao vải SX" không còn; có thêm nút **Sửa** và **Xóa** — nhưng CHỈ hiện với tài khoản có quyền Sửa/Xóa tương ứng trên QLSX (thử đăng nhập bằng tài khoản chỉ có quyền Xem để xác nhận các nút thao tác không cần thiết đều ẩn hết, không chỉ 2 nút này). Thử bấm Sửa — chỉnh vài thông tin chung, lưu lại thành công; thử Xóa 1 đơn TEST chưa có thẻ kho/xuất vải liên kết — phải xóa được; xóa 1 đơn đã có Thẻ kho hàng hóa liên kết — phải báo lỗi rõ, không cho xóa (tránh mất dữ liệu tồn kho).
   - **Ghi tiến độ, chọn công đoạn "Giao vải"** (mới, đứng trước "Cắt"): danh sách "Mã cây" khi thêm dòng CHỈ hiện cây vải còn tồn kho **đúng loại vải + màu** đã khai báo lúc Ra lệnh sản xuất (không hiện tất cả cây trong kho); mã cây trong bảng "Đã giao" hiển thị dạng thẻ bo góc, không bị cắt/giãn theo cột cố định dù mã cây dài hay ngắn. Lưu vài cây xong bấm "Gửi" — đơn hàng phải chuyển sang đúng công đoạn kế tiếp ("Phụ kiện").
   - **Ghi tiến độ, chọn công đoạn "Phụ kiện"** (mới): thêm được vài dòng phụ kiện, lưu, xóa thử 1 dòng — hoạt động độc lập với nút "Gửi" cuối form (nút Gửi chỉ dùng để chuyển công đoạn tiếp theo, sang "Cắt").
   - **Ghi tiến độ, chọn công đoạn "Cắt"**: mỗi cây vải hiện đủ nhãn cho từng ô (STT/SL lớp/Hệ số/KG-mét đã dùng/SL cái, không chỉ có placeholder mờ); ô "Nhân viên trải vải" đổi thành danh sách checkbox — tick thử người thứ 3 phải bị chặn kèm thông báo lỗi (chỉ chọn tối đa 2 người).
   - **Ghi tiến độ, chọn công đoạn "May"**: mục "Số lượng lũy kế theo màu" đã có sẵn cột tham khảo SL cắt theo từng màu (không đổi so với trước); dòng tổng phía trên có thêm "Tổng số bàn cắt"; nếu đơn hàng là "Nhà Làm", khối "Giao việc nội bộ" — dropdown "Công đoạn may" CHỈ liệt kê đúng các công đoạn đã tick chọn ở "Kỹ thuật" của đơn đó (không hiện toàn bộ danh mục công đoạn may); thêm được nhiều dòng cùng 1 công đoạn may nhưng khác nhân viên/số lượng.
   - **Các công đoạn sau Cắt khác** (Hoàn thiện, Đóng gói...): cột tham khảo "Cắt: X" theo từng màu vẫn hiện đúng như trước khi nâng cấp (không bị ảnh hưởng bởi 2 công đoạn mới chèn trước "Cắt").

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo, xác nhận lại nếu chưa đúng ý):**
> - **"Tổng số bàn cắt"** ở công đoạn May được định nghĩa là **số dòng cây vải** đã ghi nhận ở lần "Ghi tiến độ" gần nhất tại công đoạn Cắt (mỗi cây = 1 dòng = xem như 1 "bàn trải vải") — yêu cầu gốc không định nghĩa rõ "bàn" là gì, đây là cách hiểu hợp lý nhất theo đúng dữ liệu hệ thống đang có sẵn (STT cây/SL lớp theo từng cây). Nếu ý là số lượng khác (VD số lượt trải vải thực tế có thể nhiều bàn/1 cây), cần nêu rõ để điều chỉnh công thức.
> - **Sửa (PUT) lệnh sản xuất** chỉ sửa được các trường thông tin chung (tên SP, mã SP, size, khách hàng, ngày, số lượng, thiết kế, kỹ thuật rập, dòng hình in, ghi chú) — **không sửa lại được cấu trúc vải/phụ kiện** đã khai báo lúc tạo lệnh, vì các dữ liệu này đã được nhiều công đoạn tiến độ khác tham chiếu (đổi sẽ làm lệch số liệu đã ghi nhận). Cần điều chỉnh vải/phụ kiện thì dùng đúng công đoạn "Giao vải"/"Phụ kiện" tương ứng.
> - **Xóa lệnh sản xuất** sẽ tự xóa kèm toàn bộ dữ liệu phụ thuộc trực tiếp (cấu trúc vải, tiến độ, giao vải, phụ kiện, công đoạn may riêng của đơn) nhưng **sẽ báo lỗi và từ chối xóa** nếu đơn đã có Thẻ kho hàng hóa, phiếu xuất vải, hoặc thông báo hệ thống liên kết — đây là hành vi an toàn có chủ đích (tránh mất dấu vết tồn kho/thông báo đã phát sinh), không phải lỗi; nếu thực sự cần xóa đơn đó, phải xử lý/xóa các dữ liệu liên kết trước.
> - **Chưa nhận được thay đổi nào khác về file mẫu in `mau_phieu.docx`** — tình trạng placeholder tiêu đề in phiếu vẫn như đã disclose ở v5.1 (Bước 2.5), chưa có cập nhật gì thêm ở đợt này.
> - **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh, không dựa vào bản sao có thể lỗi thời trong môi trường chạy thử) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo đúng danh sách ở mục 8 phía trên trên môi trường test trước khi dùng cho dữ liệu thật.

## BƯỚC 2.7 — Nâng cấp từ v5.2 lên v5.3 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.2 (đã chạy xong Bước 2.6). Đợt này mở rộng phân quyền theo chức năng (Xem → Xem/Sửa/Xóa) cho **toàn bộ 6 phân hệ**, cải tiến popup dùng chung cho toàn hệ thống (kéo/resize/thu nhỏ), cùng nhiều chỉnh sửa nhỏ ở Kho vải/Kho hàng/Phụ kiện/Thông báo, và bổ sung HTTPS tuỳ chọn phục vụ quét QR trên nhiều máy.

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc, vì đợt này đổi cấu trúc bảng phân quyền dùng chung cho cả 6 phân hệ.
2. Mở SSMS, chạy file `database/migration_v53.sql`. Script này:
   - Thêm 2 cột **`CanEdit`, `CanDelete`** (mặc định `1` — cho phép, để không đột ngột khoá quyền của ai đang dùng tốt) vào cả 2 bảng `ChucNangPermissions` và `UserChucNangPermissions` — trước đây 2 bảng này chỉ có `CanView` (chỉ ẩn/hiện tab), từ v5.3 chặn được cả Sửa/Xóa theo từng tab con, không chỉ theo phân hệ như trước.
   - Thêm 1 chức năng mới **`KHOHANG: taomoi`** ("Tạo thẻ kho mới") — phục vụ việc tách nút tạo thẻ kho ra khỏi tab danh sách (xem Bước 10.3).

   Idempotent (`COL_LENGTH`/`MERGE`) — chạy lại nhiều lần không lỗi, không mất dữ liệu.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.3 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (bản v5.3 **không thêm gói phụ thuộc mới** so với v5.2 — HTTPS dùng module lõi `https`/`fs` có sẵn trong Node.js, chạy lại `npm install` vẫn an toàn, không mất thời gian).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. **Yêu cầu mọi tài khoản đang mở đăng xuất và đăng nhập lại** — quyền theo chức năng (Xem/Sửa/Xóa) chỉ được tính lại lúc đăng nhập.
7. Vào **Quản lý User → Ma trận phân quyền**: vì cột `CanEdit`/`CanDelete` mới mặc định là `1` (cho phép) cho MỌI chức năng đã có sẵn, hành vi phân quyền theo tab con **giữ nguyên như trước khi nâng cấp** — không có gì bị khoá đột ngột. Rà lại và **tick bớt** Sửa/Xóa ở từng tab nếu muốn siết chặt hơn theo đúng nhu cầu thực tế (VD: một nhóm chỉ nên xem tab "Đơn giá công đoạn may" nhưng không được sửa).

### (Tuỳ chọn) Bật HTTPS bằng mkcert — để quét QR bằng camera trên MỌI máy trong xưởng

Từ Bước 2.5, tài liệu đã ghi nhận: trình duyệt chỉ cho mở camera khi trang chạy qua **HTTPS** hoặc qua **`localhost`** — nên trước v5.3, chỉ máy chủ (mở bằng `localhost`) quét QR được, các máy khác trong xưởng (điện thoại, tablet, PC khác) luôn báo lỗi dù đã cấp quyền camera cho trình duyệt. Phần này **hoàn toàn tuỳ chọn** — nếu bỏ qua, hệ thống vẫn chạy HTTP như mọi bản trước, không ảnh hưởng gì; chỉ cần làm nếu muốn quét QR từ các máy khác ngoài máy chủ.

**mkcert** tạo chứng chỉ HTTPS "tự ký nhưng được máy tin cậy" — khác với chứng chỉ tự ký thông thường (luôn bị trình duyệt cảnh báo đỏ), mkcert cài thêm 1 "root CA" nội bộ vào từng thiết bị để thiết bị đó tự động tin cậy chứng chỉ, không cần mua chứng chỉ thật (Let's Encrypt) hay có tên miền công khai — phù hợp cho mạng LAN nội bộ xưởng, không cần Internet ra ngoài.

**a) Cài mkcert và tạo chứng chỉ (làm 1 lần, trên máy chủ hoặc máy admin bất kỳ):**

1. Tải bản Windows tại https://github.com/FiloSottile/mkcert/releases (file `mkcert-vX.X.X-windows-amd64.exe`) — đổi tên thành `mkcert.exe` cho gọn, để vào 1 thư mục bất kỳ (VD `C:\mkcert\`). (Nếu máy có sẵn Chocolatey, `choco install mkcert` cũng được.)
2. Mở Command Prompt tại thư mục đó, chạy `mkcert -install` — lệnh này tạo 1 "root CA" và tự cài vào máy đang chạy lệnh (máy này sẽ tin cậy chứng chỉ ngay, không cần làm gì thêm cho chính nó).
3. Xác định **địa chỉ IP LAN cố định** của máy chủ (gõ `ipconfig`, VD `192.168.1.20`) — nên đặt **IP tĩnh** cho máy chủ (hoặc "DHCP reservation" trên router) trước bước này, vì chứng chỉ chỉ hợp lệ cho đúng (các) địa chỉ đã khai lúc tạo; nếu IP đổi sau này, phải tạo lại chứng chỉ.
4. Tạo chứng chỉ: `mkcert 192.168.1.20 localhost 127.0.0.1` (thay đúng IP máy chủ) — lệnh tạo ra 2 file dạng `192.168.1.20+2.pem` (chứng chỉ) và `192.168.1.20+2-key.pem` (khoá riêng).
5. Copy 2 file này vào máy chủ, VD `backend/certs/` (tạo thư mục nếu chưa có).
6. Trong `backend/.env`, thêm:
   ```
   SSL_CERT_PATH=./certs/192.168.1.20+2.pem
   SSL_KEY_PATH=./certs/192.168.1.20+2-key.pem
   HTTPS_PORT=3443
   ```
   (đường dẫn tính từ thư mục `backend/`; sửa đúng tên file theo bước 4 ở trên).
7. `pm2 restart qlnoibo`. Log phải hiện thêm dòng `[Server] HTTPS đang chạy tại https://localhost:3443`. Mở Firewall Windows cho port `3443` (giống port 3000 đã mở ở Bước 6).
8. Từ chính máy vừa chạy `mkcert -install`, mở `https://192.168.1.20:3443` — phải vào được **không có cảnh báo đỏ**.

**b) Cho các máy KHÁC trong xưởng tin cậy chứng chỉ (làm 1 lần cho mỗi thiết bị cần quét QR):**

Chứng chỉ chỉ tự động được tin cậy trên máy đã chạy `mkcert -install` ở bước a.2. Các máy khác (điện thoại công nhân, PC khác...) cần cài **root CA** đó thủ công:

1. Tìm file root CA: trên máy đã cài mkcert, chạy `mkcert -CAROOT` để xem đường dẫn (thường trong thư mục `AppData\Local\mkcert\`), file cần lấy là `rootCA.pem`.
2. Gửi file `rootCA.pem` này cho từng thiết bị (email nội bộ, USB, hoặc chia sẻ qua mạng LAN).
3. Cài vào thiết bị:
   - **Windows**: double-click `rootCA.pem` → Install Certificate → **Local Machine** → "Place all certificates in the following store" → chọn **Trusted Root Certification Authorities** → Finish.
   - **Android**: Cài đặt → Bảo mật → Mã hoá & thông tin xác thực → Cài đặt chứng chỉ → CA certificate → chọn file `rootCA.pem` (đổi đuôi thành `.crt` nếu máy không nhận `.pem`).
   - **iPhone/iPad**: gửi file qua email/AirDrop → mở file → Cài đặt → Cài đặt hồ sơ (Profile) → **sau đó** vào Cài đặt → Cài đặt chung → Giới thiệu → Cài đặt về Chứng chỉ → **bật tin cậy hoàn toàn** cho chứng chỉ vừa cài (bước này rất hay bị bỏ sót — thiếu bước này iPhone vẫn báo không an toàn dù đã cài profile).
4. Sau khi cài, mở `https://192.168.1.20:3443` trên thiết bị đó — phải vào được không cảnh báo, và nút "📷 Quét QR" phải xin quyền camera bình thường.

> **⚠️ Cập nhật từ thực tế triển khai:** phần (b) — cài `rootCA.pem` vào từng thiết bị — **không phải là bước tuỳ chọn "cho sạch"**, mà thường là **bắt buộc** để camera hoạt động. Đã ghi nhận thực tế: thiết bị chỉ "bấm qua cảnh báo đỏ" (không cài rootCA.pem) vẫn **mở được trang** `https://<ip>:3443` bình thường, nhưng nút "📷 Quét QR" vẫn báo lỗi xin quyền camera — vì trang được trình duyệt cho là "secure context" ở mức hiển thị, nhưng bộ phận cấp quyền camera/microphone của trình duyệt áp dụng kiểm tra chặt hơn (đòi chứng chỉ được tin cậy thật sự) và từ chối. Vì vậy: **luôn làm đủ cả bước (a) và (b)** cho bất kỳ thiết bị nào cần quét QR — đừng dựa vào "bấm qua cảnh báo" như một phương án thay thế. Nếu sau khi cài `rootCA.pem` đầy đủ mà vẫn báo lỗi, kiểm tra thêm: (1) trên iPhone/iPad, bước "bật Tin cậy hoàn toàn" ở Cài đặt chung → Giới thiệu → Cài đặt về Chứng chỉ có hay bị bỏ sót; (2) quyền camera của trình duyệt cho riêng origin này (biểu tượng 🔒/ⓘ cạnh địa chỉ trang → Quyền của trang → Camera) có đang bị Chặn từ trước; (3) cài đặt quyền camera ở cấp hệ điều hành (Windows Settings → Privacy → Camera; Android Settings → Apps → trình duyệt → Permissions; iOS Settings → trình duyệt → Camera) có cho phép trình duyệt truy cập camera hay không. Từ v5.3, thông báo lỗi quét QR đã hiện kèm tên lỗi thật (`err.name`) và có nhánh riêng cho `SecurityError` gợi ý đúng nguyên nhân này.

### Kiểm tra sau khi nâng cấp lên v5.3

Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):

- **Quản lý User → Ma trận phân quyền → Theo nhóm quyền**: mỗi tab con giờ có 3 ô tick **Xem/Sửa/Xóa** thay vì chỉ 1 ô Xem như trước — bỏ tick "Sửa" ở 1 tab bất kỳ của 1 nhóm, lưu lại, đăng xuất/đăng nhập bằng tài khoản thuộc nhóm đó — nút Sửa/thao tác ghi ở đúng tab đó phải biến mất hoặc bị chặn (kể cả khi gọi thẳng API), trong khi phân hệ đó vẫn cấp quyền Sửa ở mức phân hệ chung.
- **Quản lý User → Ma trận phân quyền → Theo từng user**: bật "Ghi đè riêng" ở 1 tab của 1 tài khoản, tick khác với quyền nhóm của họ — quyền ghi đè phải **thay thế hoàn toàn** cả 3 ô Xem/Sửa/Xóa của tab đó cho tài khoản này (không cộng dồn với quyền nhóm).
- **Catalogue** (`/catalogue.html`): gõ vài ký tự bất kỳ để tìm, và thử lọc theo dropdown "Thẻ kho" mới — cả 2 phải lọc đúng ngay khi gõ/chọn.
- **Kho hàng hóa → Chi tiết mã hàng → Đặt hàng nhanh**: đặt xong, đóng popup đặt hàng — phải quay lại đúng màn hình Chi tiết mã hàng vừa xem (không phải quay về danh sách).
- **Kho hàng hóa**: đơn vị quy đổi hiển thị dạng "200 Cái (40 ri5)" — có chữ hệ số sau chữ "ri". Tab "Thẻ kho hàng hóa" không còn nút "+ Tạo thẻ kho mới" — nút này đã chuyển sang tab riêng **"Tạo thẻ kho mới"** ở cuối danh sách tab. Thử **Xóa** 1 mã hàng test chưa có đơn khách đặt hàng nào — phải xóa được; thử xóa 1 mã hàng đã có đơn đặt hàng — phải báo lỗi, không cho xóa.
- **Kho vải → Sửa phiếu Nhập/Xuất**: mở sửa 1 phiếu **đã có** phát sinh xuất kho/giao vải sản xuất ở 1 số dòng — các dòng đó vẫn sửa được KG/kho/GSM/giá nhưng **không đổi được** Loại vải/Màu và không giảm được KG xuống dưới mức đã phát sinh; dòng **chưa** phát sinh gì thì sửa/xóa tự do. Thử tìm mã cây ở phiếu Xuất không gắn đơn hàng bằng ký tự bất kỳ — phải ra kết quả kèm tên loại vải/màu, gồm cả vải chính lẫn vải phối.
- **Kho vải → Quét QR**: nếu đã làm phần mkcert ở trên, thử quét bằng điện thoại (không phải máy chủ) — camera phải mở được bình thường.
- **Kho vải → In tem khổ ngang**: in thử 1 tem — chữ không còn bị tràn/mất chữ như trước.
- **Kho vải → Nhập kho/Xuất kho, đang gõ dở form tạo phiếu (chưa Lưu)**: tắt tab trình duyệt (hoặc F5) rồi mở lại đúng form đó — dữ liệu vừa gõ phải còn nguyên (khôi phục từ nháp), không phải gõ lại từ đầu. Sau khi bấm Lưu thành công, mở lại form tạo mới — không được còn sót dữ liệu nháp cũ.
- **Thông báo**: chuông 🔔 và số đếm phải to, dễ thấy hơn hẳn so với trước; khi có thông báo mới, popup phải hiện **giữa màn hình** (không phải góc màn hình như v5.1) và tự thay nội dung mới nhất trong vòng khoảng 15 giây (không cần F5 trang) — xem lưu ý về polling ở mục disclose bên dưới, đây không phải cập nhật tức khắc theo thời gian thực.
- **Phụ kiện → Thẻ kho/Tồn kho**: gõ ký tự bất kỳ hoặc chọn "Lọc theo loại" — bảng phải tự lọc ngay, không cần nút "Xem dữ liệu" (nút này đã bỏ).
- **Phụ kiện → Phiếu Nhập/Phiếu Xuất, tạo mới**: ô chọn "Phụ kiện" ở mỗi dòng giờ gõ tự do được (không phải dropdown cố định); chọn xong ô "ĐVT" phải tự điền đúng theo phụ kiện vừa chọn. List Phiếu Nhập/Xuất đã có nút Xóa theo phân quyền (đã có từ v5.1, xác nhận lại còn hoạt động đúng).
- **Phụ kiện → Danh mục phụ kiện → bấm "Lịch sử"**: phải hiện **popup ngay tại chỗ** (không chuyển tab), hiển thị đúng lịch sử nhập/xuất của mã đó kèm cột Ngày/Loại phiếu/Đơn hàng/Nhập/Xuất/Tồn cuối/ĐVT.
- **Mọi popup form nói chung**: kéo được thanh tiêu đề để di chuyển popup, kéo góc để đổi kích thước, bấm nút thu nhỏ để đưa popup về góc màn hình dạng dải nhỏ (vẫn thao tác được phần phía sau), bấm lại để mở to trở lại. **Bấm ra ngoài popup (backdrop) sẽ KHÔNG còn đóng popup nữa** (khác hành vi trước v5.3) — phải bấm nút ✕ hoặc phím Esc mới đóng, để tránh mất dữ liệu đang nhập dở do lỡ tay bấm ra ngoài.

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - **Phân quyền theo chức năng dùng logic AND với phân quyền theo phân hệ**: quyền cuối cùng = quyền phân hệ **VÀ** quyền tab con — tab con chỉ có thể **thu hẹp thêm**, không thể cấp quyền vượt quá quyền phân hệ đã cấu hình.
> - **Tab con không có ô "Thêm" riêng** — theo đúng yêu cầu gốc chỉ nêu "xem, sửa, xóa", ô "Sửa" ở cấp tab con dùng chung cho cả hành vi Thêm mới lẫn Sửa (khác cấp phân hệ có 4 ô Xem/Thêm/Sửa/Xóa riêng biệt).
> - **Ghi đè riêng theo user ở cấp tab con thay thế toàn bộ 3 ô Xem/Sửa/Xóa cùng lúc**, không ghi đè từng ô riêng lẻ — giống nguyên tắc ghi đè theo phân hệ đã có từ v5.1.
> - **Sửa phiếu Nhập/Xuất kho vải/phụ kiện với dòng ĐÃ phát sinh downstream**: chọn cách **cho sửa số liệu không phá vỡ dữ liệu đã tham chiếu** (KG/kho/GSM/giá) thay vì khoá cứng toàn bộ dòng — vì khoá cứng sẽ không đáp ứng đúng yêu cầu "sửa hết các trường thông tin trong phiếu"; đổi lại, Loại vải/Màu và giảm KG dưới mức đã dùng vẫn bị chặn để không làm âm/lệch tồn kho đã xuất cho dòng khác.
> - **Thông báo "tự đẩy lên khi có cái mới, không cần F5"**: triển khai bằng **polling rút ngắn xuống 15 giây** (từ 45 giây ở bản trước), KHÔNG phải WebSocket/real-time tức khắc — đủ đáp ứng đúng yêu cầu "không cần F5 trang", nhưng vẫn có độ trễ tối đa ~15 giây, không phải tức thời tuyệt đối.
> - **Lưu nháp localStorage** chỉ áp dụng cho form **tạo mới** Phiếu Nhập/Xuất kho vải (đúng phạm vi yêu cầu "khi nhập liệu dở nếu chưa lưu... nhập lại từ đầu") — chưa áp dụng cho form Sửa hay các phân hệ khác (QLSX, Kho hàng, Phụ kiện).
> - **HTTPS qua mkcert là tuỳ chọn, không bắt buộc** — server tự chạy HTTP như cũ nếu không cấu hình `.env`; đây là chứng chỉ tự ký được tin cậy thủ công qua root CA, KHÔNG phải chứng chỉ thật do CA công cộng (Let's Encrypt...) cấp — chỉ phù hợp cho mạng LAN nội bộ xưởng, không dùng được nếu cần truy cập từ Internet công cộng bên ngoài xưởng.
> - **File mẫu phiếu in thật (`mau_phieu.docx`) vẫn chưa nhận được** — tình trạng placeholder giữ nguyên như đã disclose từ v5.1.
> - **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh, không dựa vào bản sao có thể lỗi thời trong môi trường chạy thử) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo đúng danh sách kiểm tra phía trên trên môi trường test trước khi dùng cho dữ liệu thật.

## BƯỚC 2.8 — Nâng cấp từ v5.3 lên v5.4 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.3 (đã chạy xong Bước 2.7). Đợt này bổ sung danh mục **"Loại hàng"** mới cho Thẻ kho hàng hóa, tách rời việc ghi nhận **"Kho nhập"** khỏi tự động tạo thẻ kho, thêm hiển thị hết hàng/ảnh phóng to ở Kho hàng, drilldown xem cây vải từ Tồn kho, mở rộng ô tìm mã cây, và dựng lại cả 4 mẫu phiếu in (Nhập/Xuất kho vải, Nhập/Xuất kho phụ kiện) theo đúng file `mau_phieu.docx` người dùng cung cấp.

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc như mọi lần, dù đợt này chỉ thêm bảng/cột mới, không xóa hay đổi kiểu dữ liệu cột cũ.
2. Mở SSMS, chạy file `database/migration_v54.sql`. Script này:
   - Tạo danh mục mới **`DanhMucNhomSanPham`** ("Loại hàng" hiển thị trên giao diện — VD "Quần bé trai", "Quần bé gái") + cột `TheKhoHangHoa.NhomSanPhamID` (gán tùy chọn, không bắt buộc). **Lưu ý**: trường `TheKhoHangHoa.LoaiHang` đã có sẵn từ v4.0 (Nhà sản xuất/Đặt ngoài) nay hiển thị trên giao diện là **"Nguồn hàng"** — 2 khái niệm khác nhau, xem thêm ở Bước 8.
   - Cập nhật view `vw_TonKhoHangHoa` (thêm cột `TenNhom`, dùng để lọc và hiển thị "Loại hàng" ở Catalogue/Kho hàng).
   - Thêm cột **`PhieuNhapVai.NgayHoaDon`** và **`PhieuPhuKien.NgayHoaDon`** (ngày hóa đơn nhập tay, tách riêng khỏi ngày lập phiếu — theo đúng mẫu `mau_phieu.docx`).
   - Thêm cột **`PhieuPhuKienChiTiet.DonGia`** (đơn giá theo từng dòng phụ kiện — chỉ hiện trên phiếu Nhập, theo đúng mẫu).

   Tất cả cột mới đều `NULL` được — phiếu/thẻ kho tạo trước v5.4 sẽ hiện trống ở các trường này, không mất dữ liệu cũ. Idempotent — chạy lại nhiều lần không lỗi.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.4 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đợt này **không thêm dependency mới**, chạy lại vẫn an toàn).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. **Không cần yêu cầu người dùng đăng xuất/đăng nhập lại** — khác các đợt trước, đợt này không đổi cấu trúc bảng phân quyền.
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **Thẻ kho hàng hóa → Tạo thẻ kho mới**: form đổi tên ô cũ từ "Loại hàng" thành **"Nguồn hàng"** (vẫn 2 lựa chọn Nhà sản xuất/Đặt ngoài như trước), và có thêm ô mới **"Loại hàng"** (chọn từ danh mục vừa tạo) — 2 ô độc lập nhau, không bắt buộc phải chọn ô mới.
   - **QLSX → Ghi tiến độ, chọn công đoạn "Kho nhập"** cho 1 đơn hàng **CHƯA** có Thẻ kho hàng hóa: lưu xong, vào Thẻ kho hàng hóa kiểm tra — **phải KHÔNG có thẻ kho nào được tự tạo** (khác hành vi mọi bản trước). Sau đó vào **Tạo thẻ kho mới**, chọn đúng đơn đó — ô "Nhập" phải tự điền đúng số lượng vừa ghi ở Kho nhập và bị khóa không sửa tay (giống ô "Số cắt"). Lưu thẻ kho, quay lại ghi thêm 1 lần Kho nhập nữa cho đơn này — lần này thẻ kho vừa tạo **phải được cộng dồn thêm đúng phần chênh lệch** (hành vi tự cộng dồn khi ĐÃ có thẻ kho vẫn giữ nguyên như trước).
   - **Thẻ kho hàng hóa (danh sách)**: 1 mã hàng test có tổng tồn kho ≤ 0 phải hiện dòng màu đỏ kèm nhãn "Hết hàng"/"Âm kho"; mở **Catalogue** kiểm tra lại — mã hàng đó vẫn KHÔNG hiện (theo đúng hành vi tự ẩn đã có từ v4.0, không phải đỏ).
   - **Thẻ kho hàng hóa → Chi tiết mã hàng**: bấm vào ảnh đại diện ở đầu trang — phải phóng to xem được; đóng ảnh phóng to — phải quay lại đúng màn hình Chi tiết mã hàng đang xem (không văng về danh sách).
   - **Kho vải → Tồn kho** (cả tab tổng hợp và tab Tồn theo cây): phải thấy thêm cột STT; bấm vào ô Trạng thái, Mã vải, Loại vải, hoặc Màu ở 1 dòng bất kỳ — phải mở popup danh sách cây vải liên quan đúng theo điều kiện vừa bấm.
   - **Kho vải → Xuất kho, mở form tạo/sửa phiếu**: ô tìm mã cây phải rộng rõ rệt (gấp đôi) so với trước.
   - **In thử cả 4 mẫu phiếu** (Nhập kho vải, Xuất kho vải, Nhập kho phụ kiện, Xuất kho phụ kiện) — đối chiếu trực tiếp với file `mau_phieu.docx`: đúng tên cột, đúng số vai ký, dòng Ngày/Số/Đơn vị bán hàng/Ngày hóa đơn tách riêng từng dòng. Phiếu Nhập (vải + phụ kiện): thử nhập "Ngày hóa đơn" khác ngày lập phiếu — bản in phải hiện đúng cả 2 ngày riêng biệt. Phiếu Nhập phụ kiện: nhập thử "Đơn giá" cho 1 dòng — cột này phải hiện đúng trên bản in. Phiếu Xuất (vải + phụ kiện) gắn với 1 đơn hàng đã có Giao vải/Chỉ định NPL: cột "SL theo chỉ định" phải hiện đúng số liệu đã chỉ định, không phải số 0/trống.

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - Đặt tên nội bộ bảng/cột danh mục mới là `DanhMucNhomSanPham`/`NhomSanPhamID`/`TenNhom` (khác với nhãn hiển thị "Loại hàng" trên giao diện) để tránh trùng tên với cột `TheKhoHangHoa.LoaiHang` đã có sẵn (nay hiển thị là "Nguồn hàng": Nhà sản xuất/Đặt ngoài) — 2 khái niệm hoàn toàn khác nhau, cần phân biệt rõ nếu sau này chỉnh sửa code hoặc dữ liệu.
> - Cột "Ghi chú" trên phiếu Xuất kho vải cố tình để trống trên bản in — mẫu `mau_phieu.docx` có cột này nhưng yêu cầu gốc không mô tả nguồn dữ liệu, hiểu là khoảng trống ghi tay sau khi in (thực tế phổ biến ở chứng từ giấy xưởng may) thay vì thêm 1 trường dữ liệu mới ngoài phạm vi yêu cầu.
> - Số hóa đơn (`SoHoaDon`, đã có từ trước) vẫn hiện thêm trên bản in phiếu Nhập cạnh "Ngày hóa đơn" mới dù mẫu chỉ ghi rõ dòng "Ngày hóa đơn" — giữ nguyên để không mất khả năng nhìn thấy dữ liệu đã có sẵn trong hệ thống.
> - Sửa 1 chỗ nghi là lỗi chính tả trong mẫu gốc: vai ký "NV chỉnh định NPL" → in ra thành **"NV chỉ định NPL"** (khớp đúng nghĩa "chỉ định NPL" dùng xuyên suốt các phần khác của hệ thống) — nêu lại nếu đây là tên gọi cố ý khác, không phải lỗi chính tả.
> - Đợt này **không đổi cấu trúc bảng phân quyền** — không cần yêu cầu người dùng đăng xuất/đăng nhập lại như các đợt trước (khác biệt so với thông lệ mọi bản trước, xem mục 6 ở trên).
> - Vấn đề quét QR/camera qua mkcert (disclose từ Bước 2.7) **vẫn chưa có xác nhận thực tế đã khắc phục triệt để trên mọi thiết bị của xưởng** — nêu lại để không quên theo dõi, có thể bỏ qua ghi chú này ở các bản sau nếu đã kiểm thử thực tế ổn thỏa.
> - **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh, không dựa vào bản sao có thể lỗi thời trong môi trường chạy thử) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo đúng danh sách kiểm tra phía trên trên môi trường test trước khi dùng cho dữ liệu thật — đặc biệt: in thử cả 4 mẫu phiếu và so trực tiếp với `mau_phieu.docx` gốc.

---

## BƯỚC 2.9 — Nâng cấp từ v5.4 lên v5.5 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.4 (đã chạy xong Bước 2.8). Đợt này gồm 3 nhóm: (1) sửa lỗi **"in phiếu hay bị treo trang"**, (2) cải tiến **Dashboard QLSX** (lọc theo trạng thái, cuộn riêng, drilldown nhà gia công/in thêu), (3) mở rộng **Ra lệnh sản xuất** (ảnh sản phẩm + ảnh hình in trên phiếu in, gộp màu chính/phối 1 ô, tải ảnh "Hình in") và **Ghi tiến độ** (công đoạn Kỹ thuật chọn nhà gia công + công đoạn may áp dụng, công đoạn May giao việc nhiều nhân viên/công đoạn có tìm kiếm, Admin sửa lại việc đã giao).

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc như mọi lần.
2. Mở SSMS, chạy file `database/migration_v55.sql`. Script này chỉ thêm 2 cột nullable vào `DonHangSanXuat`: **`AnhHinhIn`** (đường dẫn ảnh hình in tải lên) và **`DonGiaGiaCongNgoai`** (đơn giá khi giao cho nhà gia công KHÁC "Nhà Làm" — chưa dùng ở đâu, lưu sẵn cho phân hệ tính lương/thanh toán sau này). Additive, idempotent — chạy lại nhiều lần không lỗi, không mất dữ liệu cũ.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.5 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đợt này **không thêm dependency mới**, chạy lại vẫn an toàn).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. **Không cần yêu cầu người dùng đăng xuất/đăng nhập lại** — đợt này không đổi cấu trúc bảng phân quyền.
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **In phiếu** (Lệnh sản xuất, Phiếu báo cáo đơn hàng trong QLSX): bấm in nhiều lần liên tiếp — trang KHÔNG còn treo; nếu trình duyệt chặn popup, phải hiện thông báo lỗi rõ ràng (toast đỏ) thay vì im lặng không phản hồi.
   - **Dashboard QLSX**: bấm vào từng ô thống kê (Tổng/Hoàn thành/Đang sản xuất/Chưa bắt đầu/Trễ hạn) — phải mở popup đúng danh sách đơn hàng lọc theo đúng trạng thái đó. Bảng "Đơn hàng đang sản xuất" phải cuộn được riêng (không kéo cuộn cả trang Dashboard). Bấm vào 1 dòng trong bảng nhà gia công/nhà in thêu, hoặc vào số đếm theo công đoạn — phải mở popup đúng danh sách đơn liên quan. Cột "Số ngày xử lý TB" hiện **"Chưa đủ dữ liệu"** (không phải "-") khi đơn của nhà đó chưa có đủ cả Ngày giao lẫn Ngày nhận.
   - **Ra lệnh sản xuất**: phần chọn vải phối không còn bắt buộc nhập số lượng. Form Tạo mới và Sửa đơn đều có thêm ô tải **"Ảnh hình in"**. In thử 1 lệnh sản xuất có đủ ảnh sản phẩm + ảnh hình in + vải phối — bản in phải hiện đủ 2 ảnh, và cột Màu phải gộp đúng dạng "Tên màu chính (chính) - Tên màu phối (phối)" trong 1 ô duy nhất (không còn 2 dòng riêng như trước).
   - **Ghi tiến độ → công đoạn Kỹ thuật**: chọn nhà gia công — nếu để trống hoặc chọn nhà tên đúng "Nhà Làm", phải hiện lại đúng khối chọn công đoạn may (tìm bằng gõ ký tự bất kỳ) kèm đơn giá/hệ số; nếu chọn nhà gia công KHÁC "Nhà Làm", phải chuyển sang hiện 1 ô đơn giá gia công ngoài duy nhất (không hiện khối công đoạn may nữa). Lưu xong, mở lại đơn — phải giữ đúng lựa chọn đã lưu ở đúng nhánh tương ứng.
   - **Ghi tiến độ → công đoạn May** (chỉ áp dụng khi đơn không có nhà gia công hoặc = "Nhà Làm"): phải hiện đúng bảng công đoạn đã chọn ở Kỹ thuật cho đơn này (cuộn riêng nếu quá 7 dòng). Ở khối giao việc, chọn nhân viên bằng gõ ký tự bất kỳ, giao thử SL cho 2 nhân viên khác nhau CÙNG 1 công đoạn — cả 2 phải lưu được. Đăng nhập bằng tài khoản Admin, vào lại đơn đó — bảng "việc đã giao" phải có nút **Sửa**, sửa thử tên nhân viên/số lượng — phải lưu và hiện đúng ngay. Đăng nhập bằng tài khoản KHÔNG phải Admin — nút Sửa không được hiện.
   - Xác nhận không còn nhầm lẫn "2 công đoạn Giao vải": vào Kho vải, tìm 1 đơn chưa được chỉ định cây vải — dòng nhắc phải ghi rõ "vào Quản lý sản xuất → Ghi tiến độ → công đoạn 'Giao vải'" (không nhắc "tab Giao vải sản xuất" như bản cũ).

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - **"2 công đoạn Giao vải/Giao vải sx"**: rà soát danh mục công đoạn (`CongDoanSanXuat`) xác nhận hệ thống **chưa từng có 2 công đoạn riêng** — chỉ có 1 công đoạn "Giao vải" (gộp từ v5.2, thay cho nút "Giao vải SX" rời rạc trước đó). Nguồn gây nhầm lẫn là 1 dòng gợi ý (hint) còn sót ở Kho vải nhắc tên gọi cũ "tab Giao vải sản xuất" — đã sửa lại câu chữ cho đúng với luồng hiện tại, **không có thay đổi dữ liệu/cấu trúc bảng nào** ở mục này. Nêu lại nếu ý người dùng là 1 vấn đề khác chưa phát hiện ra.
> - **"Số ngày xử lý trung bình chưa hoạt động"**: xác nhận phép tính (cột computed `SoNgayGC`/`SoNgayIn` dùng `DATEDIFF`, có từ trước) **vẫn đúng, không phải lỗi code** — số liệu chỉ xuất hiện khi đơn đã nhập đủ CẢ Ngày giao lẫn Ngày nhận ở "Giao/nhận nhà gia công". Đợt này chỉ đổi nhãn hiển thị khi thiếu dữ liệu từ dấu "-" mơ hồ sang **"Chưa đủ dữ liệu"** cho rõ nguyên nhân. Nếu ý người dùng là số liệu tính sai (không phải thiếu dữ liệu đầu vào), cần cung cấp thêm ví dụ cụ thể để kiểm tra lại.
> - **Đơn giá gia công ngoài** (`DonGiaGiaCongNgoai`, cột mới) đặt ở cấp **ĐƠN HÀNG** (bảng `DonHangSanXuat`), không tách theo từng công đoạn may như `DonHangCongDoanMay` — vì gia công ngoài thường trả theo 1 đơn giá trọn gói/đơn hàng, không tách công đoạn nội bộ. Cột này **chưa dùng ở đâu khác**, chỉ lưu để xem lại, phục vụ phân hệ tính lương/thanh toán nhà gia công làm sau.
> - **Mặc định "Nhà Làm"**: khi CHƯA chọn nhà gia công ở công đoạn Kỹ thuật, hệ thống coi như thuộc nhánh "Nhà Làm" (hiện khối chọn công đoạn may) — nhất quán với logic tính công đoạn kế tiếp (`tinhNextStage()`) đã có sẵn từ trước, vốn cũng mặc định vậy khi chưa chỉ định nhà gia công.
> - **Nhãn màu trên phiếu in** rút gọn thành "(chính)/(phối)" thay vì "(vải chính)/(vải phối)" đầy đủ như câu chữ gốc trong yêu cầu — để ô bảng gọn hơn, ý nghĩa không đổi. Nêu lại nếu cần đúng nguyên văn.
> - **Công đoạn May** triển khai dạng danh sách dòng lặp lại (chọn nhân viên tìm-gõ + ô số lượng xuất hiện sau khi chọn, thêm/bớt dòng tự do) thay vì "1 nút cố định cho từng công đoạn" như mô tả — vẫn đáp ứng đủ toàn bộ yêu cầu con: giao nhiều nhân viên/1 công đoạn, cuộn riêng khi >7 dòng, hiển thị tổng SL bàn cắt quy đổi, Admin sửa lại được. Nêu lại nếu cần đúng bố cục "1 nút/công đoạn" như mô tả gốc.
> - **Đã rà soát toàn bộ các nơi in phiếu khác** trong hệ thống (Kho vải: phiếu Nhập/Xuất kho vải + in tem QR; Phụ kiện: phiếu Nhập/Xuất) để xác nhận **không bị lỗi treo trang tương tự** — tất cả đều in ngay lập tức khi bấm nút (dữ liệu đã fetch sẵn từ trước đó bằng 1 lần tải khác), không rơi vào tình huống "mở cửa sổ SAU khi chờ dữ liệu" gây lỗi — nên **không cần sửa thêm** ở các phiếu này.
> - **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh) và **đã cho 1 agent kiểm tra độc lập đối chiếu từng mục trong 13 yêu cầu** — tất cả đều đạt (PASS), không phát hiện lỗi chặn triển khai. Tuy nhiên **vẫn chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này — khuyến nghị kiểm thử đầy đủ theo đúng danh sách kiểm tra phía trên trên môi trường test trước khi dùng cho dữ liệu thật.

---

## BƯỚC 2.10 — Nâng cấp từ v5.5 lên v5.6 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.5 (đã chạy xong Bước 2.9). **Lưu ý quan trọng trước khi bắt đầu**: nhiều mục trong đợt phản hồi này (v5.6) hoá ra **đã được code từ các bản v5.1–v5.5** nhưng — theo rà soát lại — **có khả năng chưa từng được triển khai lên server thật** (vd: ô "Mã cây" gõ tìm được ở Giao vải là tính năng từ v5.2; hiển thị rõ mã cây/tên/KG còn ở Xuất kho là từ v5.3; cột "Trạng thái" click được ở Tồn theo cây là từ v5.4). Nếu đúng vậy, **việc hoàn tất Bước 2.5 → 2.9 (nâng cấp tuần tự) sẽ TỰ giải quyết phần lớn các phản hồi đó** — khuyến nghị xác nhận lại đã chạy đủ các bước trước khi kết luận đây là lỗi mới. Đợt v5.6 này bổ sung: hiển thị ngày ra lệnh trên phiếu in, cho sửa được cấu trúc vải khi sửa lệnh sản xuất (có khoá an toàn), bỏ bắt buộc chọn màu ở Giao việc may, hiển thị tên nhà gia công/nhà in trên phiếu báo cáo, mở rộng bảng "Đơn hàng đang sản xuất", tách phân quyền "Ghi nhận tiến độ" khỏi "Xem/Sửa lệnh sản xuất", drilldown trạng thái ở Tồn kho tổng hợp, ẩn đơn đã xuất kho hết khỏi danh sách xuất, và sửa lỗi quét QR làm mất phiếu đang mở.

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc như mọi lần.
2. Mở SSMS, chạy file `database/migration_v56.sql`. Script này:
   - Đổi cột **`PhanCongMay.MauSacID`** từ bắt buộc sang **cho phép để trống** (không còn bắt chọn màu khi giao việc may nội bộ).
   - Cập nhật view **`vw_TonKhoVai`** — thêm 3 cột đếm cây theo trạng thái (`SoCayNguyenCay`/`SoCayLe`/`SoCayHet`), dùng cho drilldown trạng thái ở tab Tồn kho tổng hợp.
   - Thêm chức năng phân quyền mới **`QLSX.tiendo`** ("Ghi nhận tiến độ"), tách khỏi `QLSX.orders` ("Xem/Sửa lệnh sản xuất") — **tự động sao chép quyền hiện có** từ `orders` sang `tiendo` cho mọi nhóm/user, đảm bảo **không ai bị mất quyền đang dùng** ngay sau khi nâng cấp (chỉ khi Admin chủ động vào "Ma trận phân quyền" tách riêng ra thì 2 quyền mới thực sự khác nhau).

   Additive, idempotent — chạy lại nhiều lần không lỗi, không mất dữ liệu cũ.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.6 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đợt này **không thêm dependency mới**, chạy lại vẫn an toàn).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. **Nên yêu cầu người dùng đăng xuất/đăng nhập lại** — khác các đợt gần đây: đợt này CÓ thêm 1 chức năng phân quyền mới (`tiendo`); dù quyền được sao chép tự động, phiên đăng nhập cũ có thể chưa nạp lại đúng danh sách chức năng mới cho tới khi đăng nhập lại.
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **In lệnh sản xuất**: phải thấy thêm "Ngày ra lệnh" ở phần thông tin đầu phiếu.
   - **Danh sách lệnh sản xuất → Sửa** 1 đơn đã có tiến độ (đã Giao vải/Cắt): phần "Cấu trúc vải" phải hiện đúng dữ liệu đã khai báo, các màu đã dùng phải có khoá 🔒 (không đổi được Loại vải/Màu, vẫn sửa được Số lượng/Ảnh); thử bấm "X" xoá 1 màu đã khoá — phải bị chặn kèm thông báo rõ ràng. Thêm 1 màu chính mới, lưu lại — phải thành công và hiện đúng khi mở lại.
   - **Ghi tiến độ → công đoạn May**: dòng giao việc không còn ô chọn Màu; bảng "Số lượng lũy kế theo màu (tham khảo SL cắt từng màu)" vẫn hiện ngay phía trên để đối chiếu; giao thử cho 2 nhân viên khác nhau — cả 2 phải lưu được.
   - **Ghi tiến độ → công đoạn Giao vải** (đơn CHƯA có cây vải phù hợp trong kho): phải thấy khung cảnh báo đỏ giải thích rõ lý do (không phải ô trống khó hiểu); đơn đã có cây phù hợp thì gõ tìm vẫn hoạt động bình thường như trước.
   - **In phiếu báo cáo đơn hàng** (đơn đã "Giao/nhận nhà gia công" hoặc "nhà in"): phải thấy dòng tên nhà gia công/nhà in ngay trên bảng "Lịch sử cập nhật tiến độ".
   - **Dashboard QLSX → bảng "Đơn hàng đang sản xuất"**: phải thấy CẢ đơn "Chưa bắt đầu" (chưa ghi tiến độ lần nào), không chỉ đơn "Đang sản xuất".
   - **Phân quyền**: vào Quản lý người dùng → Ma trận phân quyền, phải thấy 2 dòng riêng biệt cho QLSX: "Ghi nhận tiến độ" và "Xem/Sửa lệnh sản xuất" (tên chức năng cũ `orders`). Tạo thử 1 nhóm chỉ bật Sửa cho "Ghi nhận tiến độ" (tắt "Xem/Sửa lệnh sản xuất") — user thuộc nhóm đó phải thấy nút "Ghi tiến độ"/"Giao/nhận nhà gia công" nhưng KHÔNG thấy nút "Sửa" lệnh sản xuất.
   - **Kho vải → Tồn kho (tab tổng hợp)**: phải thấy thêm cột "Trạng thái" với các nhãn "Nguyên cây: X / Cây lẻ: Y / Hết: Z" bấm được, mở đúng danh sách cây vải khớp cả mã vải lẫn trạng thái đã bấm.
   - **Kho vải → Xuất kho, mở form tạo phiếu**: ô "Mã cây" phải thực sự rộng gấp đôi (không chỉ khoảng trống xung quanh ô); tạo 1 đơn hàng test, Giao vải rồi Xuất kho hết toàn bộ KG đã giao — đơn đó phải KHÔNG còn hiện trong danh sách "Đơn hàng sản xuất" ở form tạo phiếu xuất mới; đơn CHƯA từng Giao vải vẫn phải hiện bình thường.
   - **Kho vải → Xuất kho, quét QR**: đang mở form tạo/sửa phiếu xuất, bấm "📷 Quét QR", quét thử 1 mã cây — phiếu xuất đang mở phải KHÔNG biến mất, ô mã cây phải được điền đúng sau khi quét.
   - **Thẻ kho hàng hóa → Tạo thẻ kho mới**: nếu danh mục "Loại hàng" đang trống, phải thấy dòng gợi ý giải thích rõ (không phải ô trống không rõ lý do); vào Danh mục → Loại hàng thêm 1 mục mới, quay lại tab "Tạo thẻ kho mới" (không cần F5) — mục mới phải hiện ra ngay trong dropdown.

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - **Nhiều phản hồi trong đợt này thực chất là do CHƯA triển khai đủ v5.1–v5.5** (xem cảnh báo đầu Bước 2.10) — cụ thể: gõ tìm mã cây ở Giao vải (v5.2), hiện rõ tên/KG còn + ô tìm rộng ở Xuất kho (v5.3/v5.4), cột Trạng thái click được ở "Tồn theo cây" (v5.4). Đã kiểm tra code và xác nhận các tính năng này ĐÃ có sẵn từ các bản trước — nếu môi trường thật vẫn chưa thấy, ưu tiên kiểm tra lại đã nâng cấp đủ các Bước 2.5–2.9 chưa, trước khi tìm lỗi code mới.
> - **Khoá sửa màu đã dùng tiến độ**: khi sửa lệnh sản xuất, chỉ CHẶN xoá/đổi Loại vải+Màu của 1 khối màu chính đã có tiến độ (Giao vải/Cắt/May...) ghi nhận — vẫn cho sửa tự do Số lượng/Ảnh, và thêm màu mới/xoá màu phối tự do (màu phối không bị theo dõi tiến độ riêng). Kiểm tra "đã có tiến độ" dựa theo (Đơn hàng, Màu) chứ không theo từng dòng cấu trúc vải cụ thể.
> - **Đơn giá gia công ngoài, mặc định "Nhà Làm", nhãn màu rút gọn trên phiếu in, bố cục Công đoạn May dạng danh sách lặp lại**: các quyết định này đã disclose từ Bước 2.9 (v5.5), không đổi lại ở đợt này.
> - **Tên nhà gia công/nhà in trên phiếu báo cáo**: hiển thị dưới dạng 1 dòng thông tin RIÊNG (giá trị hiện tại + ngày giao/nhận gần nhất) ngay trên bảng lịch sử, KHÔNG chèn thành cột trong từng dòng lịch sử — vì việc giao/nhận nhà gia công không đi qua "Ghi tiến độ" (chỉ là 1 cột đơn trên đơn hàng, ghi đè mỗi lần lưu), không có "lịch sử nhiều lần" thật sự để gắn vào từng dòng. Nêu lại nếu cần xây dựng lịch sử giao/nhận nhà gia công đầy đủ theo từng lần (sẽ cần thêm bảng lưu vết mới).
> - **Tách phân quyền "Ghi nhận tiến độ"**: gộp chung TẤT CẢ thao tác trong màn "Ghi tiến độ" (giao vải, phụ kiện, công đoạn may, phân công may, giao/nhận nhà gia công, ép chuyển công đoạn) vào 1 chức năng `tiendo` duy nhất — không tách nhỏ hơn nữa (vd giao vải riêng, phụ kiện riêng) vì yêu cầu gốc chỉ nêu 2 nhóm "ghi nhận tiến độ" và "xem/sửa lệnh sản xuất".
> - **Rủi ro chưa xử lý (out of scope)**: `PUT /orders/:maDH` khi có sửa cấu trúc vải thực hiện XÓA rồi GHI LẠI `DonHangChiTietVai` bằng nhiều lệnh SQL rời rạc, không bọc transaction — giống hệt mẫu hình đã có sẵn ở `POST /orders` từ trước (không phải lỗi mới), nhưng đây là điểm ĐẦU TIÊN áp dụng mẫu XÓA+GHI LẠI này nên nếu 1 dòng lỗi giữa chừng có thể để lại thiếu dữ liệu. Không tự ý bọc transaction cho cả file vì ảnh hưởng rộng, ngoài phạm vi 13 yêu cầu gốc — khuyến nghị làm thành 1 đợt riêng.
> - **Đơn "đã xuất kho hết" bị ẩn khỏi Xuất kho**: định nghĩa là đơn ĐÃ từng được Giao vải VÀ toàn bộ cây đã giao đều hết KG còn lại — đơn CHƯA từng Giao vải vẫn hiện bình thường (không phải "đã xong", chỉ là "chưa tới lượt"). Nếu ý muốn là ẩn theo tiêu chí khác (vd theo trạng thái đơn hàng), cần nêu rõ lại.
> - **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ và cho 1 agent kiểm tra độc lập đối chiếu từng mục trong 13 yêu cầu gốc — phát hiện và đã sửa 1 lỗi thực sự (nút "Ghi tiến độ"/"Giao nhận nhà gia công" ban đầu vẫn gate theo quyền `orders` cũ thay vì `tiendo` mới, khiến tách quyền không có tác dụng trên giao diện — đã sửa lại đúng). Sau khi sửa, toàn bộ 13 mục đều đạt (PASS). Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — khuyến nghị kiểm thử đầy đủ theo đúng danh sách ở Bước 2.10 trên môi trường test trước khi dùng cho dữ liệu thật, đặc biệt là bước phân quyền và bước khoá sửa màu đã dùng tiến độ.

---

## BƯỚC 2.11 — Nâng cấp từ v5.6 lên v5.7 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.6 (đã chạy xong Bước 2.10). Đợt v5.7 là đợt refinement **lớn nhất từ trước tới nay** — 29 mục trải khắp mọi phân hệ, trong đó có 1 lỗi thực tế đã xảy ra trên môi trường thật (`UNIQUE KEY constraint 'UQ_DonHangCongDoanMay'` khi lưu công đoạn may) đã được xác định nguyên nhân gốc và sửa tận gốc (không chỉ vá triệu chứng).

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc như mọi lần.
2. Mở SSMS, chạy file `database/migration_v57.sql`. Script này (additive, idempotent — chạy lại nhiều lần không lỗi, không mất dữ liệu cũ):
   - Thêm cột **`CongDoanSanXuat.MaCongDoan`** (mã công đoạn sản xuất, VD "KT", "CAT", "MAY") — xem lưu ý quan trọng ở dưới về phạm vi áp dụng.
   - Thêm cột **`TienDoChiTietMau.DonViDaChon`** — lưu lại đơn vị tính (Cái/Ri) đã chọn lúc ghi nhận "Kho nhập", phục vụ hiển thị trên Lịch sử cập nhật tiến độ. Chỉ có giá trị cho dữ liệu ghi nhận **từ sau khi nâng cấp** — dữ liệu Kho nhập cũ hơn sẽ hiện trống ở cột này (không bịa lại lịch sử không có thật).
   - Thêm cột **`TienDoSanXuat.TenNhaGiaCongTaiThoiDiem`** — chụp lại (snapshot) tên nhà gia công tại đúng thời điểm ghi nhận tiến độ "May", phục vụ hiển thị trên Lịch sử cập nhật tiến độ. Cùng lưu ý: chỉ có giá trị cho dữ liệu **từ sau khi nâng cấp**.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.7 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đợt này **không thêm dependency mới**, chạy lại vẫn an toàn).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. Không cần yêu cầu người dùng đăng xuất/đăng nhập lại (đợt này không thêm chức năng phân quyền mới).
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **Toàn hệ thống — mở tab mới từ menu**: giữ Ctrl/Cmd hoặc Shift rồi bấm 1 mục menu bất kỳ (hoặc chuột phải → "Mở trong tab mới") — phải mở đúng đúng màn hình đó ở tab mới, không phải luôn quay về trang chủ.
   - **Đăng nhập**: mở lại trang đăng nhập — con trỏ phải tự nhảy vào ô "Tên đăng nhập" ngay, gõ được luôn không cần bấm chuột vào ô trước.
   - **In bất kỳ phiếu nào** (Lệnh sản xuất, Phiếu báo cáo, Phiếu nhập/xuất kho vải, phụ kiện): sau khi bấm in, tab/cửa sổ chính (không phải tab in) phải **vẫn dùng được ngay** (bấm nút khác, cuộn trang...), không bị "khoá" chờ tab in.
   - **Ra lệnh sản xuất → phần "Cấu trúc vải"**: dòng vải phối chỉ còn 2 ô (Loại vải + Màu), không còn ô Số lượng/Đơn vị; **In lệnh sản xuất** phải thấy đúng định dạng "Vải chính: loại - màu / Vải phối: loại - màu" (kể cả khi màu phối dùng LOẠI VẢI khác màu chính); bấm vào mục "Ra lệnh sản xuất" nhiều lần (kể cả bấm vào chính tiêu đề phân hệ "Quản lý sản xuất") — form phải luôn hiện trắng/trống, không giữ lại dữ liệu phiên trước.
   - **Ghi tiến độ → công đoạn Kỹ thuật (đơn "Nhà Làm")**: thêm 1 công đoạn may thứ 2 vào danh sách — không được có hiện tượng khung nhảy giật 2 dòng; nhập Đơn giá/Hệ số cho công đoạn A, sau đó thêm/xoá công đoạn B — dữ liệu vừa nhập cho A **phải còn nguyên**, không mất; thử **chọn nhanh liên tiếp 2 công đoạn khác nhau** trong ô gõ-tìm rồi Lưu — không được báo lỗi trùng khoá; ở cột mới "Nhân viên & SL", bấm "+ NV", chọn nhân viên + số lượng, Lưu — vào lại đơn đó ở công đoạn **May**, mục "Đã giao việc" phải thấy đúng người/số lượng vừa giao ở Kỹ thuật.
   - **Ghi tiến độ → công đoạn Giao vải**: ô tìm mã cây phải hiện thêm vị trí kho + ngày nhập (không chỉ mã/loại/màu/KG còn như trước).
   - **Ghi tiến độ → công đoạn Phụ kiện**: phải thấy dòng "Tham khảo" hiện Tổng SL cắt ngay phía trên; chọn 1 phụ kiện — ô "ĐVT" phải tự điền (nếu phụ kiện có 2 đơn vị, ô ĐVT phải cho chọn 1 trong 2); thử chọn "Loại PK" trước — ô phụ kiện bên cạnh chỉ còn phụ kiện đúng loại đó.
   - **Ghi tiến độ → công đoạn May**: "Tổng SL cắt (đã quy đổi)" phải chỉ tính tổng các màu CHÍNH, không cộng luôn màu phối (kiểm bằng 1 đơn có khai báo màu phối, đối chiếu lại bằng tay).
   - **In phiếu báo cáo đơn hàng**: phải thấy ảnh sản phẩm (nếu đơn có ảnh); "SL nhập kho thực tế" hiện thêm chữ "(đã quy đổi)" nếu đơn đã có Thẻ kho hàng hóa; mục "Xuất vải kèm đơn hàng" phải thấy dòng tóm tắt "Vải chính:.../Vải phối:..."; bảng "Phụ kiện xuất kèm đơn hàng" phải thấy thêm cột "SL chỉ định"; với đơn đã ghi tiến độ Kho nhập/May **sau khi nâng cấp**, dòng lịch sử tương ứng phải thấy thêm đơn vị tính / tên nhà gia công.
   - **Danh mục → Công đoạn sản xuất**: phải thấy thêm cột "Mã công đoạn", thêm/sửa được giá trị này.
   - **Kho vải → Xuất kho, mở form Sửa 1 phiếu đã có sẵn**: ô tìm mã cây phải hiện thêm vị trí kho + ngày nhập cho MỌI cây (kể cả cây đã có sẵn trong phiếu, không chỉ cây mới).
   - **Quản lý phụ kiện → Phiếu Xuất, xem chi tiết 1 phiếu có gắn đơn hàng**: bảng chi tiết trên màn hình (không chỉ bản in) phải thấy thêm cột "SL chỉ định".
   - **Trên điện thoại — quét mã QR** (Xuất kho vải hoặc Tồn kho): camera phải quét NHẬN được mã (không chỉ hiện hình ảnh camera mà không phản hồi).
   - **Thẻ kho hàng hóa → mở "Lên đơn đặt hàng"**: phải thấy ảnh sản phẩm bên cạnh ô "Mã hàng" và ảnh riêng theo màu bên cạnh ô "Màu", đổi mã hàng/màu thì ảnh phải đổi theo đúng.

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - **Nguyên nhân gốc lỗi `UNIQUE KEY constraint 'UQ_DonHangCongDoanMay'`** (lỗi thật đã xảy ra, đơn (1009, 6)): do 1 lỗi hiếm ở ô gõ-tìm công đoạn may — khi chọn xong 1 kết quả, hệ thống vẽ lại ngay khu vực đó trong lúc trình duyệt CÒN ĐANG xử lý sự kiện chọn, khiến trình duyệt tự phát sinh thêm 1 sự kiện phụ trên ô vừa bị gỡ khỏi trang, gọi lại đúng thao tác "chọn" đó lần 2 → đẩy trùng 1 công đoạn vào danh sách. Đã sửa 3 lớp: (1) hoãn việc vẽ lại sang "ngay sau đó" thay vì tức khắc, để sự kiện hiện tại xử lý xong hẳn trước; (2) chặn thêm trùng ngay tại danh sách đang hiển thị; (3) phía server cũng tự loại trùng + bọc toàn bộ thao tác lưu trong 1 giao dịch (transaction) — nếu có lỗi giữa chừng sẽ huỷ toàn bộ thay vì lưu dở dang (đây cũng là nguyên nhân giải thích vì sao "chọn 2 công đoạn nhưng sau đó chỉ thấy 1" — lưu dở dang do lỗi giữa chừng). Đây là **lần đầu tiên** dùng SQL transaction trong toàn bộ mã nguồn `qlsx.js` — cố ý chỉ áp dụng cho đúng route này (route duy nhất đã có lỗi thật được người dùng báo lại), KHÔNG áp dụng đại trà cho các route khác đang có cùng mẫu hình XÓA+GHI-LẠI-không-transaction (xem rủi ro đã disclose ở v5.6) — việc đó nên làm thành 1 đợt riêng có kiểm thử kỹ vì ảnh hưởng rộng.
> - **"Mã công đoạn" cho Công đoạn sản xuất — phạm vi CHỈ ở mức thêm cột + hiển thị trong danh mục**, KHÔNG mở rộng thành sửa lại toàn bộ các chỗ trong `qlsx.js` đang so sánh trực tiếp theo TÊN công đoạn (VD `renderStageFields`, hằng số `TEN_CONG_DOAN_MAY`, các câu lệnh `WHERE TenCongDoan=N'...'`) sang so sánh theo mã/StageID. Điều này có nghĩa: **đổi tên công đoạn "Kỹ thuật"/"Cắt"/"May"/"Kho nhập" hiện tại VẪN sẽ làm gián đoạn các form chuyên biệt tương ứng như trước** — mã công đoạn mới chỉ là bước đầu (có chỗ lưu/tra cứu ổn định), chưa phải fix triệt để toàn bộ điểm dễ vỡ đã nêu. Nếu cần fix triệt để, nên làm thành 1 đợt refactor riêng (rà soát và đổi khoảng 6-7 điểm trong `qlsx.js` sang so sánh theo mã/StageID), có kiểm thử kỹ vì ảnh hưởng luồng chuyển công đoạn cốt lõi.
> - **Lịch sử tiến độ hiện đơn vị tính (Kho nhập) / tên nhà gia công (May) — chỉ áp dụng cho dữ liệu MỚI**: đây là 2 thông tin **chưa từng được lưu lại** trong hệ thống trước v5.7 (không phải lỗi hiển thị/truy vấn đơn thuần mà là thiếu cột lưu trữ) — sau khi nâng cấp, các dòng lịch sử ghi nhận MỚI sẽ có đủ thông tin này, còn dữ liệu cũ hơn sẽ hiện trống (không bịa thêm lịch sử không có thật). Tên nhà gia công vẫn còn hiện dưới dạng 1 dòng thông tin hiện tại riêng phía trên bảng lịch sử (từ v5.6) — nên thông tin không mất hoàn toàn với dữ liệu cũ, chỉ là không gắn được vào đúng dòng lịch sử cụ thể.
> - **"Giao việc nội bộ" tại Kỹ thuật — chọn cách ít rủi ro nhất**: thêm 1 cột mới "Nhân viên & SL" ngay trong khối chọn công đoạn may đã có sẵn ở Kỹ thuật (mỗi công đoạn có ô riêng để thêm nhiều nhân viên + số lượng), KHÔNG di chuyển toàn bộ khối "Giao việc nội bộ" đang có sẵn ở công đoạn May sang Kỹ thuật — vì khối ở May vẫn còn hữu ích (có "Tổng SL cắt" để đối chiếu, dữ liệu này chưa tồn tại ở thời điểm Kỹ thuật). Backend nhận dữ liệu này mà **không cần sửa gì thêm** — route ghi nhận tiến độ vốn không kiểm tra tên công đoạn khi lưu "giao việc", chỉ cần frontend gửi đúng định dạng ở nhánh Kỹ thuật.
> - **SL nhập kho thực tế "đã quy đổi"**: chỉ tính được khi đơn hàng ĐÃ có Thẻ kho hàng hóa (từ v5.4, hệ thống không còn tự tạo Thẻ kho) — nếu chưa có, phiếu in vẫn hiện số liệu theo cách tính cũ (tổng thô, có thể lẫn đơn vị Cái/Ri nếu từng ghi Kho nhập bằng "Ri") mà không có chữ "(đã quy đổi)", còn hơn không hiện gì.
> - **Kho vải — "ô gõ tìm rộng gấp đôi"**: xác nhận đã đúng từ v5.6 (CSS `.ss-input { width:100% }`); đợt này không sửa lại độ rộng, chỉ bổ sung THÊM thông tin trong nội dung gợi ý (vị trí kho, ngày nhập) — vì danh sách gợi ý là `<datalist>` nguyên sinh của trình duyệt, không có cách tuỳ chỉnh độ rộng RIÊNG của popup gợi ý bằng CSS.
> - **Kho vải — "tạo phiếu xuất ngay sau khi cắt"**: rà soát không thấy có ràng buộc nào trong code chặn theo công đoạn "Cắt" — điều kiện thực tế duy nhất là đơn phải đã qua bước "Giao vải" (một thao tác riêng trong Ghi tiến độ QLSX, không phụ thuộc đã cắt hay chưa). Dòng gợi ý giải thích rõ điều này đã có sẵn từ v5.5 tại form Xuất kho — không có gì để sửa thêm ở đây, có thể đây là vướng mắc về cách dùng hơn là lỗi.
> - **Kho vải — "đơn đã xuất hết bị ẩn khỏi danh sách xuất"**: đã rà soát lại và xác nhận vẫn đúng như đã làm ở v5.6, không phát hiện thêm lỗ hổng nào.
> - **Lưu ý kiểm thử**: đây là đợt refinement lớn nhất từ trước tới nay (29 mục) — đã rà soát logic/cấu trúc code kỹ theo từng mục, tự kiểm tra lại các đoạn code trọng yếu sau khi sửa (đặc biệt là luồng lưu công đoạn may và luồng ghi nhận tiến độ Kỹ thuật/May). Trong lúc rà soát cũng phát hiện và tự sửa 1 lỗi gõ nhầm ký tự chú thích (không ảnh hưởng chức năng, chỉ ảnh hưởng khả năng đọc code). Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — với số lượng thay đổi lớn của đợt này, **đặc biệt khuyến nghị** kiểm thử đầy đủ theo đúng danh sách ở Bước 2.11 trên môi trường test trước khi dùng cho dữ liệu thật, nhất là luồng Ghi tiến độ Kỹ thuật/May (thay đổi nhiều nhất) và luồng lưu công đoạn may (đã từng có lỗi thật).

---

## BƯỚC 2.12 — Nâng cấp từ v5.7 lên v5.8 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.7 (đã chạy xong Bước 2.11). Đợt v5.8 giải quyết dứt điểm 2 vấn đề cấu trúc còn tồn đọng qua nhiều đợt trước (in phiếu khoá tab chính, gợi ý mã cây bị trình duyệt tự cắt bớt chữ) bằng cách thay cơ chế nền tảng thay vì vá thêm — cộng với việc chuyển hẳn khối "Giao việc nội bộ" sang công đoạn May cho đơn Nhà Làm.

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc như mọi lần.
2. Mở SSMS, chạy file `database/migration_v58.sql`. Script này (additive, idempotent — chạy lại nhiều lần không lỗi, không mất dữ liệu cũ) chỉ thêm đúng 1 cột: **`NhaGiaCong.LaNoiBo`** (BIT, mặc định 0) — đánh dấu chính xác dòng "Nhà Làm" trong danh mục Nhà gia công bằng cờ thay vì so sánh chuỗi tên, script tự set `LaNoiBo = 1` cho dòng "Nhà Làm" hiện có.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.8 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đợt này **không thêm dependency mới**, chạy lại vẫn an toàn).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. Không cần yêu cầu người dùng đăng xuất/đăng nhập lại (đợt này không thêm chức năng phân quyền mới).
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **In BẤT KỲ phiếu nào** (Lệnh sản xuất, Phiếu báo cáo đơn hàng, Phiếu nhập/xuất kho vải, Phiếu nhập/xuất phụ kiện, In tem QR hàng loạt ở Kho vải): sau khi bấm in, tab/cửa sổ chính phải **vẫn dùng được ngay lập tức** — không bị trình duyệt tự chuyển sang tab/cửa sổ in, không có cảm giác "đơ" dù chỉ 1 nhịp. Đây là phép thử quan trọng nhất của đợt này vì đã đổi hẳn cơ chế in (xem khung cảnh báo bên dưới).
   - **Ra lệnh sản xuất**: tạo xong 1 lệnh, bấm "Tạo lệnh mới" — form phải hiện trắng/trống hoàn toàn, không còn thấy card "Ra lệnh sản xuất" cũ lộ ra bên cạnh khung "Đã tạo lệnh sản xuất...".
   - **Ghi tiến độ → công đoạn Giao vải**: gõ vào ô tìm mã cây — danh sách gợi ý hiện ra phải là 1 khung tuỳ chỉnh (không phải khung liệt kê mặc định của trình duyệt), hiện **đầy đủ** thông tin từng dòng (mã cây, loại vải, màu, KG còn, vị trí kho, ngày nhập) mà không bị cắt bớt chữ, kể cả với cây có tên loại vải/màu dài.
   - **Ghi tiến độ → công đoạn May, đơn hàng Nhà Làm (chưa chọn nhà gia công, hoặc đã chọn đúng "Nhà Làm" ở Kỹ thuật)**: phải thấy bảng "Công đoạn may đã chọn cho đơn hàng này" **giống hệt** bảng ở Kỹ thuật — Đơn giá/Hệ số sửa được ngay tại đây, thêm/bớt công đoạn may được (ô "+ Thêm công đoạn may" gõ để tìm, nút "X" để bỏ), và cột "Nhân viên & SL" thao tác được (bấm "+ NV", chọn nhân viên + nhập số lượng). Sửa Đơn giá/Hệ số ở đây rồi Gửi — quay lại Kỹ thuật phải thấy giá trị mới (cùng 1 dữ liệu, sửa ở đâu cũng ra cùng 1 kết quả). Giao việc ghi ở đây và giao việc đã ghi trước đó ở Kỹ thuật phải **cùng xuất hiện chung** trong "Lịch sử giao việc nội bộ đã ghi nhận" bên dưới (vì cùng ghi vào 1 bảng `PhanCongMay`). Thử thêm 1 công đoạn may mới rồi gõ vài số vào "Số lượng lũy kế theo màu" bên dưới trước khi Gửi — số vừa gõ **không được mất** (đây là lỗi đã từng xảy ra ở khối tương tự bên Kỹ thuật, nay áp dụng đúng cách fix tương tự cho May).
   - **Ghi tiến độ → công đoạn May, đơn hàng giao gia công ngoài (đã chọn 1 nhà gia công KHÁC "Nhà Làm" ở Kỹ thuật)**: KHÔNG được thấy khối "Công đoạn may đã chọn.../Nhân viên & SL" nói trên — chỉ thấy bảng công đoạn may dạng thông tin (không sửa được) như trước v5.8, đúng logic "giao ngoài thì không theo dõi giao việc nội bộ".
   - **In Phiếu báo cáo đơn hàng → mục "Xuất vải kèm đơn hàng"**: dòng tóm tắt cấu trúc vải phải hiện đúng dạng "**Vải chính:** loại vải - màu" và (nếu có màu phối) xuống dòng "**Vải phối:** loại vải - màu, loại vải - màu, ..." — có màu đi kèm TỪNG loại vải (kể cả từng dòng phối), không gộp màu chính thành 1 cụm riêng ở cuối câu. So sánh với mục "Cấu trúc vải" ở phiếu Lệnh sản xuất — 2 phiếu phải hiện **cùng 1 định dạng**.
   - **Kho vải → Nhập kho và Xuất kho** (cả tạo mới lẫn sửa phiếu đã có): ô tìm mã cây hiện đầy đủ thông tin không bị cắt chữ, giống hệt phép thử ở Giao vải trên.
   - **Quản lý phụ kiện → mọi ô tìm phụ kiện** (Phiếu nhập, Phiếu xuất, chỉ định NPL...): gõ tìm vẫn lọc đúng, chọn "Loại PK" trước vẫn thu hẹp đúng danh sách, không bị cắt chữ.
   - **Quản lý phụ kiện → Phiếu Xuất → Tạo mới, có gắn đơn hàng**: chọn 1 đơn hàng đã "Chỉ định NPL" từ trước, rồi chọn 1 phụ kiện ở ô tìm trong từng dòng — ngay cạnh nhãn "Số lượng" phải hiện thêm chữ "— chỉ định: X" (X đúng bằng số lượng đã chỉ định NPL cho phụ kiện đó). Đổi sang đơn hàng khác hoặc bỏ chọn đơn hàng, dòng chỉ định phải cập nhật lại hoặc biến mất đúng theo lựa chọn mới. Form Phiếu Nhập KHÔNG được hiện dòng chữ này (không có khái niệm "chỉ định NPL").
   - **Danh mục → Công đoạn may / Đơn giá công đoạn may** (Kỹ thuật): ô tìm "+ Thêm công đoạn may" vẫn hoạt động bình thường như trước (dùng chung cơ chế gợi ý mới).
   - **Trên điện thoại — Thẻ kho hàng hóa → "Lên đơn đặt hàng"**: mở form, gõ 1 tên khách bất kỳ rồi Huỷ (không lưu) — mở lại form lần 2, ô "Tên khách" phải trống, trình duyệt không gợi ý lại tên vừa gõ.
   - **Danh mục → Nhà gia công**: xác nhận dòng "Nhà Làm" vẫn hoạt động đúng như trước (không cần sửa gì ở màn hình này) — có thể đối chiếu bằng SQL `SELECT TenNha, LaNoiBo FROM NhaGiaCong` trong SSMS, chỉ đúng 1 dòng "Nhà Làm" có `LaNoiBo = 1`.

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - **In phiếu — đổi hẳn cơ chế, không phải vá thêm**: nguyên nhân gốc khiến "in phiếu khoá tab chính" (dù v5.7 đã cải thiện 1 phần) là `window.open()` — mỗi lần gọi, trình duyệt **tự động** chuyển focus sang tab/cửa sổ mới mở, đây là hành vi gốc của trình duyệt mà JavaScript **không có cách nào chặn được**, kể cả v5.7 cũng chỉ bỏ được 1 phần nguyên nhân (lệnh `.focus()` gọi thêm ở code, không phải hành vi tự động của trình duyệt khi mở cửa sổ). Đợt này đổi hẳn sang in qua 1 khung `<iframe>` ẩn ngay trong trang hiện tại — không mở tab/cửa sổ mới nên trình duyệt không có gì để tự chuyển focus sang, dứt điểm vấn đề thay vì giảm bớt. Tác dụng phụ tích cực: không còn cần "mẹo" mở cửa sổ trước khi gọi API (kỹ thuật giữ "transient activation" từ v5.5) vì `<iframe>` không bị trình chặn popup (popup blocker) can thiệp như `window.open()`.
> - **Ô tìm mã cây/phụ kiện — thay hẳn `<datalist>` bằng khung tự dựng**: `<datalist>` là thành phần trình duyệt tự vẽ, không có cách nào tuỳ chỉnh được độ rộng/cách ngắt dòng bằng CSS (đã disclose rõ ở v5.6, v5.7) — đây là giới hạn của TRÌNH DUYỆT chứ không phải thiếu sót ở nội dung nhãn hiển thị (nội dung đã đầy đủ từ v5.7). Đợt này thay bằng 1 khung `<div>` tự vẽ, tự định vị bằng JavaScript, chèn thẳng vào `<body>` (không nằm lồng trong modal nên không bị `overflow:auto` của modal cắt mất) — nhờ vậy tự do tuỳ chỉnh CSS, cho chữ tự xuống dòng thay vì bị cắt. Giữ nguyên 100% cách gọi ở mọi nơi trong code (`searchableSelectHtml`/`wireSearchableSelect`/`getSearchableValue` — tên hàm, tham số, ID phần tử `_text`/`_val` đều không đổi) nên không phải sửa lại bất kỳ màn hình nào khác đang dùng 3 hàm này. Hành vi mới: gõ để lọc theo TỪ CHỨA (không chỉ theo ký tự đầu), tối đa hiện 50 kết quả gợi ý cùng lúc (để tránh chậm nếu danh mục quá lớn), dùng được phím mũi tên lên/xuống + Enter để chọn, phím Escape hoặc bấm ra ngoài để đóng khung gợi ý.
> - **Riêng 1 ô tìm KHÔNG đổi**: khung "Thẻ kho" ở Quản lý phụ kiện (tra cứu nhanh 1 phụ kiện theo mã) dùng 1 cặp `<input list>`/`<datalist>` độc lập, không đi qua `searchableSelectHtml`/`wireSearchableSelect` — vẫn còn giới hạn bị cắt chữ như trước. Cố ý chưa đổi vì đây là màn hình tra cứu phụ, không nằm trong các luồng nhập liệu người dùng nêu ra lần này; có thể gộp vào cùng cơ chế mới ở 1 đợt sau nếu cần.
> - **"Nhà Làm" — đổi từ so chuỗi tên sang cờ `LaNoiBo`**: trước v5.8, hệ thống nhận diện dòng "Nhà Làm" bằng cách so sánh `TenNha === 'Nhà Làm'` ở 3 nơi (2 ở giao diện, 1 ở server) — nếu ai đó vào Danh mục sửa lại tên dòng này (kể cả chỉ thêm/bớt 1 khoảng trắng) hoặc thêm dòng "Nhà làm" viết hoa/thường khác, toàn bộ logic bỏ qua công đoạn May cho hàng nội bộ sẽ sai mà không có cảnh báo gì. Đợt này thêm hẳn 1 cột cờ `LaNoiBo` không phụ thuộc tên hiển thị — nhưng **Danh mục Nhà gia công vẫn CHƯA có giao diện để tự đổi cờ này cho dòng khác** (chỉ dòng "Nhà Làm" gốc được đánh dấu sẵn qua migration) — nếu sau này cần thêm 1 dòng "nhà làm nội bộ" thứ 2 (VD 2 xưởng nội bộ khác nhau), cần chạy thêm 1 câu UPDATE thủ công qua SSMS hoặc bổ sung giao diện quản lý cờ này ở 1 đợt sau.
> - **Bảng "Công đoạn may đã chọn" ở May — dùng lại Y NGUYÊN cả bảng đã có ở Kỹ thuật (đã sửa lại sau phản hồi trực tiếp)**: bản đầu tiên của v5.8 chỉ đưa cột "Nhân viên & SL" sang May, còn Đơn giá/Hệ số vẫn hiện dạng chỉ đọc — theo phản hồi trực tiếp ngay sau đó ("y nguyên bảng ở công đoạn Kỹ Thuật"), đã đổi sang dùng lại **đúng 2 hàm** `congDoanMayChonHtml()`/`wireCongDoanMayChon()` mà Kỹ thuật đang dùng (không còn bản chỉ-đọc riêng) — nên ở May giờ sửa được Đơn giá/Hệ số, thêm/bớt công đoạn may, y hệt Kỹ thuật, không phải dựng riêng 1 cơ chế khác. Vì dùng chung 1 dữ liệu (`DonHangCongDoanMay`) nên sửa ở May rồi Gửi sẽ ghi đè luôn giá/hệ số đang áp dụng — quay lại Kỹ thuật sẽ thấy đúng giá trị vừa sửa (không phải 2 nguồn dữ liệu tách biệt). Giao việc ghi ở Kỹ thuật và ở May cùng ghi vào 1 bảng `PhanCongMay`, cùng hiện chung trong 1 danh sách lịch sử duy nhất (không tách riêng theo "ghi ở bước nào"). Khối "Giao việc nội bộ" kiểu tự do trước đây riêng cho công đoạn May (1 dòng chọn nhân viên + công đoạn + SL tự do, không gắn với bảng công đoạn may đã chọn) vẫn đã được **gỡ bỏ hẳn** như bản đầu của v5.8 — nếu đơn hàng có công đoạn may cần giao việc mà CHƯA được chọn, có thể thêm ngay tại May (không bắt buộc quay lại Kỹ thuật nữa, vì màn May giờ cho thêm/bớt công đoạn y như Kỹ thuật).
> - **Vì sao khối này ở May KHÔNG dùng chung `renderStageFields('May')` làm hàm vẽ-lại**: thêm/bớt 1 công đoạn may tại May cần vẽ lại đúng đúng khu vực bảng đó — nếu dùng `renderStageFields('May')` (vẽ lại TOÀN BỘ khối May) sẽ xoá trắng luôn các ô "Số lượng lũy kế theo màu" đang gõ dở bên dưới (đây là ô nhập không lưu tạm trạng thái) — cùng loại lỗi đã từng xảy ra và được sửa riêng cho Kỹ thuật (khối Mét sơ đồ/Khổ vải/Mã rập) ở v5.7. Đã dùng đúng pattern tương tự: 1 khu vực con riêng (`#mayCongDoanMayArea`) chỉ vẽ lại đúng bảng đó, không đụng tới phần còn lại của form.
> - **Đính chính 1 kết luận SAI ở bản v5.8 gốc**: mục ngay dưới đây từng viết "4 mục bổ sung dữ liệu trên phiếu in ... đã đúng từ v5.7, không có gì để sửa thêm" — kết luận đó **sai** cho riêng phần định dạng vải chính/phối. Rà soát lại (sau phản hồi trực tiếp "hiển thị rõ Vải chính: loại vải, mầu / Vải phối: loại vải, mầu, giống như Cấu trúc vải trong in lệnh sx") phát hiện phiếu "Phiếu báo cáo đơn hàng" (`openPrint()` trong `module.qlsx.js`), mục "Xuất vải kèm đơn hàng", CHỈ hiện loại vải cho vải phối (thiếu màu riêng từng dòng phối) và gộp màu của vải CHÍNH thành 1 cụm "(màu ...)" rời ở cuối câu thay vì gắn liền vào đúng dòng — khác hẳn định dạng "Vải chính: loại - màu / Vải phối: loại - màu" mà `printLenhSanXuat()` (Lệnh sản xuất) đã làm đúng từ v5.7. Đã sửa bằng cách dùng lại Y HỆT công thức `chinhLine`/`phoiLine` của `printLenhSanXuat()` (cùng nguồn dữ liệu `getChiTietVaiNested()`, không cần đổi backend) — 2 phiếu nay hiện nhất quán 1 định dạng. Bài học: lần kiểm tra trước dựa nhiều vào so khớp chuỗi/grep thay vì đối chiếu từng ký tự đầu ra — với các mục có "định dạng hiển thị" (không chỉ "có hay không có dữ liệu"), cần đọc kỹ TOÀN BỘ chuỗi HTML sinh ra, không chỉ xác nhận biến đúng tên đã được dùng.
> - **Phiếu xuất phụ kiện — form Tạo mới bổ sung "SL chỉ định" tham khảo (phát hiện thêm sau phản hồi trực tiếp "Phiếu xuất phụ kiện chưa hiển thị số lượng chỉ định của từng phụ kiện")**: khác với mục đính chính ngay trên (đó là 1 kết luận SAI), mục này là 1 khoảng trống THẬT SỰ chưa từng được làm, nằm ngoài phạm vi đã rà soát ban đầu — kết luận gốc "cột SL chỉ định đã đúng từ v5.7" (xem mục (1) ngay dưới đây) chỉ đúng cho **bản in và màn xem chi tiết phiếu đã lưu**, chưa từng bao gồm **form Tạo mới**. Rà soát cho thấy API cấp danh sách phụ kiện cho form tạo mới (`GET /api/phukien/donhang/:id/npl`) chưa từng trả về số lượng đã chỉ định (chỉ trả về thông tin danh mục để lọc dropdown, không có cột số lượng nào) — nay bổ sung số liệu này (gộp nhóm + cộng dồn theo phụ kiện qua 1 subquery, đề phòng 1 phụ kiện lỡ bị "Chỉ định NPL" nhiều dòng cho cùng 1 đơn vì `DonHangChiTietPhuKien` không có ràng buộc UNIQUE chặn việc này), và form Tạo phiếu Xuất (khi có gắn đơn hàng) nay hiện thêm "— chỉ định: X" ngay cạnh nhãn "Số lượng" mỗi khi chọn 1 phụ kiện ở 1 dòng. Phiếu Nhập không có khái niệm "chỉ định NPL" nên không hiện dòng chữ này.
> - **3 mục người dùng nêu ra ở batch gốc không cần sửa code** (đã rà soát lại kỹ, xác nhận đúng như hiện trạng — không phải bỏ sót): (1) 3 mục còn lại trong nhóm "bổ sung dữ liệu trên phiếu in" (cột SL chỉ định trên **bản in và màn xem chi tiết phiếu đã lưu** — KHÔNG bao gồm form Tạo mới, xem mục bổ sung ngay trên; đơn vị tính; tên nhà gia công) — đã đúng từ v5.7, không có gì để sửa thêm (riêng định dạng vải chính/phối thì SAI, xem đính chính ngay trên); (2) Kho vải "cho xuất bất kỳ cây nào còn tồn nếu chưa chọn đơn hàng" — code hiện tại đã đúng vậy từ trước, danh sách cây mặc định là TOÀN BỘ cây còn tồn kho khi chưa chọn đơn; (3) phần lớn các màn hình "tạo mới" khác đã tự làm mới đúng cách (state cục bộ reset lại mỗi lần mở, modal cũ bị dỡ bỏ hoàn toàn trước khi mở modal mới) — chỉ phát hiện đúng 2 lỗ hổng thật sự: Ra lệnh sản xuất (đã sửa, xem trên) và ô "Tên khách" ở mobile bên dưới.
> - **Mobile "Tên khách" — nguyên nhân là trình duyệt tự động điền lại (autofill), không phải lỗi mã nguồn**: đã rà soát kỹ state JavaScript của form "Lên đơn đặt hàng" — biến cục bộ đã reset đúng mỗi lần mở, modal cũ bị dỡ bỏ hoàn toàn (không phải lỗi giữ lại giá trị cũ trong code). Nguyên nhân khả dĩ nhất là trình duyệt trên điện thoại tự gợi ý/điền lại giá trị đã gõ trước đó cho 1 ô nhập không có cờ `autocomplete="off"` — đã thêm cờ này. Rà soát thêm phát hiện form "Đặt hàng nhanh" (mở từ màn "Chi tiết mã hàng", không được nêu tên trực tiếp trong yêu cầu gốc) có ô "Tên khách" với cùng lỗ hổng — đã thêm cờ tương tự cho nhất quán, vì đây rõ ràng thuộc phạm vi yêu cầu "tại tất cả các hàm tạo mới". Nếu người dùng vẫn còn gặp lại sau khi nâng cấp, đây nhiều khả năng là hành vi autofill của TRÌNH DUYỆT/điện thoại cụ thể (ngoài tầm kiểm soát của mã nguồn), cần mô tả rõ hơn (trình duyệt gì, có thấy gợi ý màu xám hiện ra không hay ô tự có sẵn chữ) để chẩn đoán tiếp.
> - **Khối "khôi phục nháp" (draft) ở Kho vải — CỐ Ý không đụng tới**: form "Xuất kho vải" và "Nhập kho vải" có sẵn 1 tính năng lưu tạm nội dung đang gõ dở (qua `saveDraft`/`loadDraft`, dùng khi lỡ đóng nhầm form) — đây là tính năng có chủ đích, KHÔNG phải lỗi "giữ lại dữ liệu phiên trước" mà yêu cầu "tại tất cả các hàm tạo mới" muốn sửa. Không tắt/sửa tính năng này để tránh mất tác dụng khôi phục nháp hữu ích của nó; nếu người dùng thực sự muốn bỏ hẳn tính năng khôi phục nháp ở riêng 2 form này, cần nêu rõ để xử lý riêng (khác bản chất với các lỗi "tạo mới bị giữ dữ liệu cũ" đã sửa ở đợt này).
> - **Khung gợi ý (`.ss-dropdown`) tự đóng khi modal đóng, kể cả đóng "bất thường"**: khung gợi ý được chèn thẳng vào `<body>` (không nằm trong modal — xem lý do ở trên), nên nếu modal đóng lại đúng lúc khung gợi ý đang mở MÀ KHÔNG qua 1 cú bấm chuột ra chỗ khác trước đó (đường thoát bình thường), khung gợi ý có thể bị "mồ côi" — trôi nổi vĩnh viễn trên màn hình. Trường hợp này có thể xảy ra vì gõ Enter trong ô tìm kiếm khi CHƯA chọn/tô sáng gợi ý nào sẽ theo hành vi mặc định của trình duyệt là nộp (submit) cả biểu mẫu đang chứa ô đó — đã thêm 1 lệnh gọi đóng khung gợi ý ngay trong hàm `closeModal()` dùng chung (thay vì sửa riêng từng nơi) để đảm bảo dọn dẹp đúng trong MỌI trường hợp modal đóng, bất kể lý do gì.
> - **Lưu ý kiểm thử**: đã rà soát lại toàn bộ 3 hàm lõi bị thay thế (`printHtml`, `searchableSelectHtml`/`wireSearchableSelect`/`getSearchableValue`) và từng điểm gọi tương ứng trên cả 4 file module (`module.qlsx.js`, `module.khovai.js`, `module.phukien.js`) lẫn backend (`qlsx.js`) sau khi sửa, cộng thêm 1 lượt kiểm tra ĐỘC LẬP (agent khác, không tham gia viết code) đối chiếu lại toàn bộ các điểm trên — không phát hiện lỗi chức năng nào, chỉ phát hiện thêm đúng 1 lỗ hổng nhỏ (ô "Tên khách" ở "Đặt hàng nhanh" nêu trên) đã được sửa ngay. Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — đợt này đổi 2 cơ chế nền tảng dùng chung ở RẤT NHIỀU màn hình (in phiếu và ô tìm kiếm), nên **đặc biệt khuyến nghị** kiểm thử đầy đủ theo danh sách ở Bước 2.12 trên môi trường test trước khi dùng cho dữ liệu thật — ưu tiên kiểm tra in phiếu (mọi loại phiếu, không chỉ 1 loại) và Ghi tiến độ May (cả 2 nhánh Nhà Làm / gia công ngoài) trước tiên.

---

## BƯỚC 2.13 — Nâng cấp từ v5.8 lên v5.9 (bỏ qua nếu cài mới)

Áp dụng nếu server đang chạy đúng bản v5.8 (đã chạy xong Bước 2.12). Đợt v5.9 fix triệt để rủi ro đã disclose từ v5.7 (Bước 2.11): "Mã công đoạn" (`CongDoanSanXuat.MaCongDoan`, thêm ở v5.7) trước đây chỉ dùng để hiển thị/tra cứu trong Danh mục — mọi logic thật sự (chuyển công đoạn kế tiếp, ghi nhận tiến độ, phân quyền theo công đoạn, báo cáo năng suất Cắt/Nhập kho) vẫn so sánh trực tiếp theo TÊN công đoạn hiển thị (`TenCongDoan`), nghĩa là đổi tên 1 công đoạn trong Danh mục (kể cả chỉ thêm/bớt khoảng trắng) vẫn âm thầm làm gián đoạn các luồng này mà không có cảnh báo gì. Đợt này chuyển TOÀN BỘ các điểm so sánh đó sang dùng Mã công đoạn/StageID (ổn định), đồng thời khóa Mã công đoạn của 8 công đoạn hệ thống để không lặp lại đúng vấn đề này ở chỗ khác.

1. **Backup database trước khi chạy** (xem Phần D) — bắt buộc, đợt này thêm cột mới + gán lại dữ liệu cho 8 dòng công đoạn hệ thống.
2. Mở SSMS, chạy file `database/migration_v59.sql`. Script này:
   - Thêm cột **`CongDoanSanXuat.LaHeThong`** (BIT, mặc định 0) — đánh dấu 8 công đoạn hệ thống gốc (Kỹ thuật/Giao vải/Phụ kiện/Cắt/May/Hoàn thiện/Kho nhập/Đóng gói).
   - Gán lại **Mã công đoạn chuẩn** (`KT`/`GV`/`PK`/`CAT`/`MAY`/`HT`/`KN`/`DG`) + `LaHeThong=1` cho đúng 8 dòng đó, khớp theo TÊN công đoạn HIỆN TẠI. Script tự in cảnh báo nếu không khớp đủ 8 dòng (khả năng 1 tên đã bị đổi trước khi nâng cấp) — xem khung cảnh báo bên dưới.
   - Thêm unique index cho phép nhiều dòng Mã công đoạn để trống, nhưng không cho 2 dòng trùng cùng 1 mã.

   Additive, idempotent — chạy lại nhiều lần không lỗi, không mất dữ liệu cũ.
3. Thay toàn bộ thư mục `backend/` và `frontend/` bằng bản v5.9 — **giữ lại** `backend/.env`, `backend/uploads/`, `backend/node_modules/`.
4. Mở Command Prompt tại `backend/`, chạy `npm install` (đợt này **không thêm dependency mới**, chạy lại vẫn an toàn).
5. Khởi động lại server: `pm2 restart qlnoibo`.
6. **Nên yêu cầu người dùng đăng xuất/đăng nhập lại** — phiên đăng nhập cũ đang giữ `user.congDoan` (mảng tên) trong session; sau khi nâng cấp, việc kiểm tra quyền ghi nhận tiến độ theo công đoạn (`canUpdateStage`) chuyển sang dùng `user.congDoanIds` (mảng StageID, trường mới) — đăng nhập lại để phiên nạp đúng trường này (Admin không bị ảnh hưởng; user thường có thể tạm thời bị từ chối ghi tiến độ cho tới khi đăng nhập lại).
7. Kiểm tra lại theo đúng thứ tự sau (nếu sai ở bước nào, dừng và báo lại trước khi cho người dùng thật vào):
   - **Kiểm tra migration đã khóa đủ 8 dòng**: chạy `SELECT TenCongDoan, MaCongDoan, LaHeThong FROM CongDoanSanXuat ORDER BY ThuTu` trong SSMS — đúng 8 dòng Kỹ thuật/Giao vải/Phụ kiện/Cắt/May/Hoàn thiện/Kho nhập/Đóng gói phải có `LaHeThong=1` và đúng mã KT/GV/PK/CAT/MAY/HT/KN/DG tương ứng.
   - **Ghi tiến độ (lần lượt từng công đoạn)**: đúng bộ field tương ứng vẫn hiện đúng như trước khi nâng cấp (Kỹ thuật: Mét sơ đồ/Khổ vải/Mã rập + chọn nhà gia công; Giao vải/Phụ kiện: đúng màn hình cũ; Cắt: bảng theo cây; May: bảng công đoạn may + giao việc; Kho nhập: bảng số lượng thực nhập theo màu) — ghi thử cho vài công đoạn, xác nhận vẫn chuyển đúng sang công đoạn kế tiếp như trước.
   - **Danh mục → Công đoạn sản xuất**: 8 dòng hệ thống hiện thêm biểu tượng 🔒 cạnh Mã công đoạn; bấm Sửa 1 dòng trong số đó — ô "Mã công đoạn" phải là **readonly** (không gõ được) kèm dòng chú thích giải thích lý do; vẫn sửa được Tên công đoạn/Thứ tự bình thường, lưu lại thành công. Thử gọi thẳng API `PUT /api/danhmuc/congdoan/:id` với Mã công đoạn khác cho 1 dòng hệ thống (vd qua công cụ test API, bỏ qua giao diện) — phải bị từ chối (400).
   - **Thử ĐỔI TÊN 1 công đoạn hệ thống** (vd đổi "Cắt" thành "Cắt vải" tạm thời để test) rồi quay lại Ghi tiến độ — công đoạn đó vẫn hoạt động đúng (hiện đúng field, chuyển đúng công đoạn kế tiếp, báo cáo năng suất Cắt/Nhập kho ở phiếu báo cáo đơn hàng vẫn tính đúng số liệu, không về 0) — đổi tên lại như cũ sau khi test xong. Đây là phép thử cốt lõi của đợt này.
   - **Phân quyền theo công đoạn**: 1 user chỉ được phân công đúng 1 công đoạn cụ thể — đổi TÊN công đoạn đó trong Danh mục, đăng nhập lại bằng user này — vẫn thấy đúng đơn hàng đang ở công đoạn đó và vẫn ghi tiến độ được (trước v5.9 sẽ bị mất quyền ngay khi đổi tên, không có cảnh báo gì).
   - **Dashboard → báo cáo nhà gia công**: đơn đang ở công đoạn "May" giao ngoài — badge trạng thái vẫn hiện kèm tên nhà gia công như trước.

> **⚠️ Quyết định thiết kế cần lưu ý (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", xác nhận lại nếu chưa đúng ý):**
> - **Phạm vi: bảng `CongDoanSanXuat` (công đoạn SẢN XUẤT — Kỹ thuật/Cắt/May...), KHÔNG phải `CongDoanMay`** (danh mục các THAO TÁC MAY — vd "Ráp cổ", "Vắt sổ", dùng ở khối "Giao việc nội bộ") — bảng thứ 2 này đã dùng `CongDoanMayID` làm khóa mọi nơi từ trước (không có vấn đề so sánh theo tên), không cần sửa gì thêm; chỉ nêu rõ để tránh nhầm lẫn giữa 2 khái niệm có tên rất giống nhau.
> - **Khóa Mã công đoạn bằng cột `LaHeThong`, không phải "khóa mọi công đoạn có mã"**: công đoạn tự thêm sau này qua Danh mục vẫn đặt/sửa Mã công đoạn tự do — chỉ 8 dòng hệ thống gốc (đánh dấu qua migration) bị khóa, vì chỉ 8 dòng này có logic code THẬT SỰ phụ thuộc đúng giá trị mã. Nếu sau này 1 công đoạn tự thêm cũng cần logic riêng, cần bổ sung đánh dấu `LaHeThong` cho dòng đó ở 1 đợt riêng.
> - **Tên công đoạn/Thứ tự KHÔNG bị khóa, kể cả với 8 công đoạn hệ thống** — đổi tên hiển thị giờ an toàn (đúng mục tiêu đợt này); đổi Thứ tự (thay đổi trình tự chuyển công đoạn) KHÔNG thuộc phạm vi yêu cầu lần này (yêu cầu chỉ nêu vấn đề so sánh theo TÊN, không phải vấn đề đổi THỨ TỰ) — tự ý đổi thứ tự các công đoạn hệ thống vẫn có thể gây rối loạn luồng xử lý dù không còn liên quan lỗi so sánh tên; nêu rõ nếu cần khóa/cảnh báo thêm cho việc đổi thứ tự.
> - **`stageCounts` ở Dashboard (đếm số đơn theo từng công đoạn) CỐ Ý giữ nguyên theo TÊN công đoạn**, không đổi sang mã — đây là khóa nhóm ĐỘNG (nhóm = tên công đoạn tại thời điểm đọc dữ liệu, cả nhóm lẫn dữ liệu đơn hàng đều đọc TRONG CÙNG 1 request nên luôn khớp nhau) chứ không phải so sánh với 1 chuỗi hằng cố định — không thuộc đúng loại lỗi "so sánh với TÊN hằng cố định" mà yêu cầu nêu ra, đổi sang mã ở đây chỉ tăng độ phức tạp mà không sửa được lỗi thật nào.
> - **`user.congDoan` (mảng TÊN công đoạn) vẫn giữ trong session/`loadUserContext.js`**, song song với `user.congDoanIds` (mảng StageID, trường mới, dùng cho toàn bộ logic phân quyền từ nay) — giữ trường cũ để tương thích ngược nếu sau này có chỗ khác cần hiển thị tên, không phải sót lại do quên sửa.
> - **Đăng nhập lại sau khi nâng cấp là khuyến nghị, không phải bắt buộc cứng**: session cũ vẫn hoạt động bình thường (không lỗi/crash), nhưng quyền ghi tiến độ theo công đoạn của user thường chỉ dùng đúng dữ liệu mới sau khi đăng nhập lại (do `congDoanIds` được tính lúc đăng nhập, giống mọi thay đổi phân quyền khác từ trước tới nay).
> - **Unique index mới trên `MaCongDoan` có thể ném lỗi khi nhập trùng mã** (vd đặt mã `CAT` cho 1 công đoạn tự thêm trong khi công đoạn "Cắt" đã dùng mã này) — trước v5.9 nhập trùng vẫn được chấp nhận (không khóa gì), nay bị chặn ở tầng CSDL. Đã bọc try/catch cho `POST/PUT /danhmuc/congdoan` (`backend/routes/danhmuc.js`) để trả về đúng thông báo "Mã công đoạn này đã được dùng cho công đoạn khác..." thay vì để lỗi rớt thành unhandled rejection (Express 4 không tự bọc async route, có thể làm crash tiến trình Node) — phát hiện qua agent kiểm tra độc lập, đã fix ngay do đây là rủi ro vận hành mới phát sinh trực tiếp từ unique index thêm ở đợt này. Lưu ý: toàn bộ các route khác trong `danhmuc.js` (ngoài 3 route công đoạn) vẫn chưa có try/catch — đây là khoảng trống có từ trước, không thuộc phạm vi đợt v5.9, không fix trong đợt này.
> - **Lưu ý kiểm thử**: đã rà soát toàn bộ điểm so sánh theo TÊN công đoạn dạng chuỗi trong `qlsx.js`, `khohang.js`, `middleware/auth.js`, `loadUserContext.js`, `module.qlsx.js`, `module.danhmuc.js`, `common.js` (đọc lại từng file sau khi sửa) và cho 1 agent kiểm tra ĐỘC LẬP đối chiếu lại toàn bộ các điểm này (12 hạng mục kiểm tra, kết quả PASS toàn bộ). Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — đây là đợt sửa đúng vào luồng lõi (chuyển công đoạn, ghi tiến độ, phân quyền), **đặc biệt khuyến nghị** kiểm thử đầy đủ theo danh sách ở Bước 2.13 trên môi trường test trước khi dùng cho dữ liệu thật, ưu tiên phép thử "đổi tên 1 công đoạn hệ thống rồi kiểm tra lại toàn bộ luồng" ở mục kiểm tra phía trên.

---

## BƯỚC 2.14 — Nâng cấp từ v5.9 lên v5.9.1 (bỏ qua nếu cài mới) — ƯU TIÊN CAO, có thể đã ảnh hưởng dữ liệu thật đang chạy

**Đây không phải 1 refinement thông thường như các bước trên — đây là sửa 1 lỗi số liệu tồn kho có khả năng đã và đang xảy ra trên bản v5.0 hiện đang chạy thật.** Nên đọc kỹ mục kiểm tra dữ liệu cũ ở bước 3 bên dưới TRƯỚC khi nâng cấp, kể cả khi chưa sẵn sàng nâng cấp toàn bộ lên v5.1-v5.9.

**Lỗi**: màn "Thẻ kho hàng hóa" (Kho hàng → Thẻ kho / Tồn kho), 2 cột "Số cắt" và "Nhập" (theo từng màu) — khi Tạo mới VÀ khi Sửa, backend (`backend/routes/khohang.js`, cả `POST /items` lẫn `PUT /items/:id`) nhân số người dùng nhập với "Tỷ lệ quy đổi" (`LoaiRi`, VD "5 Cái = 1 Ri") trước khi lưu — trong khi form Sửa lại điền sẵn ĐÚNG số đang lưu (đơn vị Cái, không quy đổi) vào các ô này. Hậu quả: mỗi lần mở Sửa rồi bấm Lưu (kể cả không đổi gì) nhân số lượng lên thêm 1 lần `LoaiRi` — với hàng có LoaiRi=5, sau 1 lần Sửa số liệu tăng gấp 5, sau 2 lần tăng gấp 25... Với hàng có LoaiRi=1 (mặc định) thì không thấy lỗi (nhân 1 = không đổi), đây có thể là lý do lỗi chưa bị phát hiện sớm hơn.

**Bằng chứng đây là lỗi, không phải thiết kế**: comment gốc ngay tại cột `LoaiRi` trong `database/schema.sql` ghi rõ "*cong thuc SoCatCai/NhapCai/XuatCai KHONG doi, chi doi nhan hien thi*" (công thức không đổi, Tỷ lệ quy đổi chỉ dùng để đổi NHÃN hiển thị) — đúng như hàm `fmtDualUnit()` (`module.khohang.js`) đã làm từ trước (chỉ tính lại CÁCH HIỂN THỊ, không đụng tới số đã lưu). Đối chiếu thêm 3 chỗ KHÁC trong hệ thống có nhân `LoaiRi` hợp lệ (`POST /khohang/orders`, `PUT /khohang/orders/:id/status`, đoạn cộng dồn Kho nhập trong `qlsx.js`) — cả 3 đều chỉ nhân khi có 1 lựa chọn đơn vị TƯỜNG MINH do người dùng chọn là "Ri" (`item.donVi==='Ri'`/`row.DonVi==='Ri'`/`m.donViDaChon===DonViQuyDoi`) — 2 ô "Số cắt"/"Nhập" trong form Thẻ kho KHÔNG có lựa chọn đơn vị nào để người dùng chỉ định, nên nhân vô điều kiện ở đây là sai, không nhất quán với toàn bộ phần còn lại của hệ thống.

**Đã sửa**: bỏ hẳn phép nhân `* (loaiRi || 1)` ở cả 2 route (`POST /items`, `PUT /items/:id` trong `backend/routes/khohang.js`) — số nhập vào 2 ô "Số cắt"/"Nhập" nay được lưu thẳng, không quy đổi, khớp với cách các nơi khác trong hệ thống đọc/hiển thị 2 cột này. Không cần migration (không đổi schema, chỉ đổi logic tính toán).

1. Thay `backend/` bằng bản v5.9.1 (không cần chạy migration nào thêm cho riêng bước này — nếu đang nâng cấp cả gói v5.1-v5.9 cùng lúc thì chạy đủ các migration ở Bước 2.1-2.13 như bình thường, bước này không có file migration riêng).
2. `pm2 restart qlnoibo`.
3. **Kiểm tra dữ liệu CŨ trước khi coi đây là xong** — vì bản v5.0 đang chạy thật rất có thể đã bị lỗi này (cột `LoaiRi` có từ schema gốc, không phải thêm ở bản nào gần đây). Chạy câu lệnh sau trong SSMS để liệt kê MỌI mã hàng có Tỷ lệ quy đổi khác 1 (chỉ nhóm này có nguy cơ bị ảnh hưởng) kèm số liệu hiện tại:
   ```sql
   SELECT h.MaHang, h.TenHang, h.LoaiRi, ms.TenMau,
          ct.SoCatCai, ct.NhapCai, ct.XuatCai, (ct.NhapCai - ct.XuatCai) AS TonCai,
          ct.SoCatCai / h.LoaiRi AS NeuChiaMotLan_SoCat,
          ct.NhapCai / h.LoaiRi AS NeuChiaMotLan_Nhap
   FROM TheKhoHangHoa h
   JOIN TheKhoChiTietMau ct ON ct.MaHangID = h.MaHangID
   JOIN MauSac ms ON ms.MauSacID = ct.MauSacID
   WHERE h.LoaiRi <> 1
   ORDER BY h.MaHang, ms.TenMau;
   ```
   Đây là câu lệnh CHỈ ĐỌC (SELECT), không tự sửa gì. Đối chiếu cột `SoCatCai`/`NhapCai` với số lượng thực tế đã cắt/đã nhập ngoài kho (sổ sách giấy, hoặc trí nhớ người phụ trách) cho từng mã hàng: nếu số trong hệ thống lớn hơn thực tế theo đúng 1 hoặc nhiều lần `LoaiRi`, đó là dấu hiệu đã bị lỗi này. **Không tự động chạy 1 câu UPDATE chia lại** — vì không có bảng log lịch sử số lần đã Sửa mỗi mã hàng, nên không thể biết chắc đã bị nhân bao nhiêu lần để chia lại đúng 1 lần duy nhất; 2 cột `NeuChiaMotLan_...` ở trên chỉ là GỢI Ý tham khảo (đúng nếu mã hàng đó mới chỉ bị nhân đúng 1 lần), cần đối chiếu thực tế rồi tự sửa tay qua màn hình Sửa thẻ kho (sau khi đã nâng cấp lên v5.9.1) cho từng mã hàng bị ảnh hưởng.
4. Kiểm tra lại (sau khi nâng cấp code):
   - Tạo 1 thẻ kho mới với Tỷ lệ quy đổi > 1 (VD 5), nhập "Số cắt: 10", "Nhập: 8" cho 1 màu — lưu xong vào Sửa lại ngay, xác nhận vẫn hiện đúng "10"/"8" (không phải 50/40).
   - Sửa lại thẻ kho đó thêm 1 lần nữa mà KHÔNG đổi số cắt/nhập (chỉ đổi Tên hàng chẳng hạn) — lưu xong, xác nhận số cắt/nhập vẫn giữ nguyên "10"/"8" (đây là phép thử cốt lõi của lỗi này).
   - Thẻ kho loại "Nhà sản xuất" (tạo qua "Chọn đơn hàng sản xuất" — Số cắt/Nhập điền sẵn readonly từ tiến độ Cắt/Kho nhập) — xác nhận số điền sẵn khớp đúng số lượng lũy kế thật ở tiến độ (không bị nhân thêm).
   - Thẻ kho có Tỷ lệ quy đổi = 1 (mặc định) — xác nhận vẫn hoạt động bình thường như trước (không có gì đổi, vì nhân với 1 trước đây vốn không gây lệch).
   - Lên đơn khách đặt hàng (`POST /orders`) và hủy đơn (`PUT /orders/:id/status`) cho 1 mã hàng có Tỷ lệ quy đổi > 1 — 2 luồng này KHÔNG bị đụng tới trong đợt sửa này (đã xác nhận vẫn dùng đúng cơ chế nhân có điều kiện theo lựa chọn đơn vị từ trước), chỉ kiểm tra lại cho chắc không có hồi quy.

> **⚠️ Phạm vi đã xác nhận KHÔNG bị ảnh hưởng (nhân `LoaiRi` ở đây là ĐÚNG, có điều kiện theo đơn vị người dùng chọn, không sửa)**: `POST /khohang/orders` (lên đơn khách đặt hàng), `PUT /khohang/orders/:id/status` (hủy đơn, hoàn lại XuatCai), và đoạn cộng dồn `NhapCai` theo tiến độ "Kho nhập" trong `backend/routes/qlsx.js` (`POST /orders/:maDH/tiendo`) — cả 3 đều dùng đúng công thức cộng DỒN (delta) hoặc có kiểm tra đơn vị tường minh trước khi nhân, không có kiểu lỗi "điền sẵn số đã lưu rồi nhân lại" như 2 route vừa sửa.

---

## BƯỚC 2.15 — Nâng cấp từ v5.9.1 lên v5.10 (bỏ qua nếu cài mới)

Đợt v5.10: thêm ô tìm kiếm cho mọi danh sách trong Danh mục, và đóng nốt 1 chỗ `<datalist>` nguyên sinh còn sót lại từ v5.8. Thuần frontend (chỉ sửa `common.js`/`module.danhmuc.js`/`module.phukien.js`), không đổi schema, không có migration.

- **Danh mục — mọi tab (Bộ phận, Loại vải, Màu sắc, Vải, Phụ liệu, Nhà gia công, Nhà cung cấp, Khách hàng, Danh mục thẻ kho, Loại hàng, Công đoạn sản xuất, Đơn vị tính, Công đoạn may, Máy sản xuất, Nhân viên) đều có thêm 1 ô "Gõ để tìm..." phía trên bảng** — gõ bất kỳ ký tự nào lọc ngay các dòng có chứa ký tự đó (không phân biệt hoa/thường, không cần khớp từ đầu), khớp trên TOÀN BỘ nội dung dòng (mọi cột cùng lúc, không giới hạn 1 cột cụ thể). Lọc thuần phía trình duyệt (danh mục là dữ liệu nhỏ, đã tải hết 1 lần, không gọi lại API mỗi lần gõ). Riêng tab "Cấu hình hệ thống" không có ô này (là 1 form cài đặt, không phải danh sách). Đã mở rộng thêm cho tab "Danh mục phụ kiện" (trong phân hệ Phụ kiện, không nằm trong mục Danh mục nhưng cùng bản chất danh sách danh mục) cho nhất quán — các màn danh sách khác (VD Thẻ kho / Tồn kho ở Kho hàng, Kho phụ kiện) KHÔNG nằm trong phạm vi yêu cầu lần này (không phải danh sách "danh mục", mà là danh sách tồn kho/giao dịch) nên chưa thêm, có thể mở rộng thêm nếu cần.
- **Đóng nốt `<datalist>` nguyên sinh cuối cùng còn sót từ v5.8**: ô "Chọn mã" ở tab Thẻ kho / Tồn kho (Phụ kiện) — trước đây cố ý để nguyên (xem changelog v5.8, coi là "màn tra cứu phụ") — nay đổi sang dùng đúng khung gợi ý tự dựng dùng chung toàn hệ thống (`.ss-dropdown`), khớp CHỨA (substring) khi gõ thay vì phụ thuộc hành vi lọc riêng của từng trình duyệt. Giữ nguyên tính năng "để trống để xem TẤT CẢ".
- Kiểm tra: mọi tab Danh mục gõ vài ký tự bất kỳ (không chỉ ký tự đầu tên) vẫn lọc đúng ra dòng chứa ký tự đó; gõ ký tự không khớp dòng nào hiện đúng dòng "Không tìm thấy kết quả phù hợp." (căn đúng độ rộng bảng); xóa hết ô tìm kiếm hiện lại đầy đủ. Tab Thẻ kho/Tồn kho phụ kiện: gõ 1 phần mã hoặc tên phụ kiện hiện đúng danh sách gợi ý, chọn 1 dòng hiện đúng lịch sử nhập/xuất của đúng mã đó; để trống ô này vẫn hiện đúng bảng tổng hợp tất cả phụ kiện như trước.

1. Thay `frontend/` bằng bản v5.10 (không có migration, không cần backup DB riêng cho bước này).
2. `pm2 restart qlnoibo` (nếu chỉ đổi frontend thì thực chất không bắt buộc restart backend, nhưng làm theo đúng quy trình chung cho nhất quán).
3. Có thể cần xóa cache trình duyệt hoặc Ctrl+F5 một lần để chắc chắn nạp đúng bản JS mới (file tĩnh có thể bị trình duyệt cache lại bản cũ).

---

## BƯỚC 2.16 — Nâng cấp từ v5.10 lên v5.11 (bỏ qua nếu cài mới)

Phản hồi trực tiếp: "sửa thẻ kho phần ảnh Ảnh đại diện chung vẫn bị mất mặc dù không sửa". Đã rà soát toàn bộ luồng lưu (`backend/routes/khohang.js`, `PUT /items/:id`) — câu lệnh `AnhDaiDien=ISNULL(@AnhDaiDien, AnhDaiDien)` chỉ ghi đè cột này khi thực sự có chọn ảnh mới, còn không thì giữ nguyên giá trị đang lưu trong CSDL — **logic lưu vốn đã đúng, không tìm thấy điểm nào thực sự làm mất dữ liệu**. Nguyên nhân nhiều khả năng nhất: form Sửa trước đây KHÔNG hiện ảnh đang lưu cho ô "Ảnh đại diện chung" (khác với "Ảnh màu" từng dòng, vốn đã hiện sẵn thumbnail cũ từ trước) — mở Sửa thấy ô chọn file trống trơn, dễ hiểu nhầm là ảnh đã mất dù dữ liệu thật vẫn còn nguyên.

Đã sửa: thêm thumbnail hiện đúng ảnh đang lưu (nếu có) ngay cạnh ô chọn file, kèm dòng chú thích "để trống để giữ nguyên", và cập nhật ảnh xem trước ngay khi chọn ảnh mới — để việc giữ nguyên/thay ảnh nhìn thấy rõ ràng ngay trên màn hình, không phải tin suông vào logic phía sau. Thuần frontend (`frontend/js/module.khohang.js`), không đổi backend/schema, không có migration.

> **⚠️ Lưu ý quan trọng nếu sau khi nâng cấp vẫn còn thấy mất ảnh thật sự (không chỉ là không thấy hiện ra)**: đây là dấu hiệu cho thấy phỏng đoán trên chưa đúng hoàn toàn và có 1 lỗi khác thật sự đang làm mất dữ liệu — cần báo lại kèm chi tiết cụ thể (VD: mã hàng nào, có bấm "Lưu" mà không đổi gì hay có thao tác gì khác, kiểm tra trực tiếp cột `AnhDaiDien` trong bảng `TheKhoHangHoa` qua SSMS trước/sau khi Sửa để xác nhận CSDL có thực sự bị ghi đè hay không) để điều tra tiếp — chưa thể loại trừ hoàn toàn khả năng này vì chưa kiểm thử được trên môi trường có SQL Server thật.
>
> **Cập nhật 2026-07-14 — phản hồi lặp lại y nguyên**: người dùng báo lại đúng câu trên. Đã rà soát lại LẦN 2, mở rộng phạm vi ra ngoài những gì đã kiểm tra ở v5.11 (INSERT/UPDATE + submit handler): xác nhận `crudFactory.js` (CRUD ghi đè trắng, không ISNULL) KHÔNG được gắn cho bảng `TheKhoHangHoa`; view `vw_TonKhoHangHoa` group theo đúng khóa chính nên JOIN sang màu không làm sai `AnhDaiDien`; endpoint `/items/:maHang/history` SELECT thẳng không JOIN/aggregate; danh sách luôn `apiGet` lại sau khi Lưu (không cache); `apiPut`/`apiPost` luôn gửi `JSON.stringify` (không phải FormData) nên `null` không bị biến thành chuỗi `"null"`. Vẫn KHÔNG tìm thêm được lỗi nào. Vì v5.11 (và toàn bộ v5.1–v5.12) **tính đến 2026-07-14 vẫn chưa deploy**, khả năng cao nhất là người dùng đang test trên bản production v5.0 — ô Sửa vẫn trống trơn y như trước khi có bản vá này, nên "vẫn bị mất" là hiện tượng cũ lặp lại, không phải lỗi mới. Câu lệnh kiểm tra nhanh (chạy trước và sau khi Sửa, không đổi gì, bấm Lưu):
> ```sql
> SELECT MaHangID, MaHang, AnhDaiDien FROM TheKhoHangHoa WHERE MaHang = N'<mã hàng>';
> ```
> Nếu giá trị `AnhDaiDien` đổi thành NULL sau bước này dù không chọn ảnh mới → xác nhận là bug thật, báo lại kèm kết quả để điều tra hướng khác. Nếu giữ nguyên → xác nhận đây là vấn đề CHƯA DEPLOY, không phải bug.
>
> **🔴 XÁC NHẬN 2026-07-14 — ĐÂY LÀ BUG THẬT, ĐANG SỐNG TRÊN PRODUCTION**: kiểm tra trên mã hàng `DH2607002` — trước khi Sửa `AnhDaiDien = /uploads/anh_1783926855117.jpg`, sau khi Sửa (không đổi ảnh) `AnhDaiDien = NULL`. Code trong thư mục dự án hiện tại (đã đọc lại nhiều lần, kỹ) dùng đúng `ISNULL(@AnhDaiDien, AnhDaiDien)` nên PHẢI giữ nguyên — nghĩa là bản đang chạy thật trên server (`D:\QLSX`, pm2 `qlnoibo`) đang thực thi 1 phiên bản CŨ HƠN của `backend/routes/khohang.js` không có bảo vệ ISNULL này, tức là ghi đè `AnhDaiDien=NULL` vô điều kiện mỗi khi Sửa mà không chọn lại ảnh. Không xác định được chính xác từ version nào bắt đầu có ISNULL (không có lịch sử git để tra), nhưng không quan trọng — bản trong thư mục dự án (tính đến v5.12) đã đúng, chỉ cần deploy. **Đây là lỗi mất dữ liệu đang diễn ra REAL-TIME, độ nghiêm trọng ngang hoặc hơn v5.9.1** (khác v5.9.1 ở chỗ: sai số lượng còn tính lại được, còn mất link ảnh gần như không phục hồi được nếu không còn cách nào khác để nối lại đúng ảnh với đúng mã hàng). Deploy `backend/` (ít nhất) ngay để chặn đứng, không chờ gộp đủ cả batch v5.1–v5.12. Có thể đã có thêm mã hàng khác bị mất ảnh tương tự — nên rà soát bằng `SELECT MaHangID, MaHang, TenHang FROM TheKhoHangHoa WHERE AnhDaiDien IS NULL;` để khoanh vùng (lưu ý: không phân biệt được NULL "chưa từng có ảnh" và NULL "bị bug xóa mất" chỉ bằng câu này — cần đối chiếu thêm với file thực tế còn nằm trong thư mục `uploads` trên server, nếu muốn cố phục hồi).

1. Thay `frontend/` bằng bản v5.11 (không có migration).
2. `pm2 restart qlnoibo`, Ctrl+F5 để nạp đúng bản JS mới.
3. Kiểm tra: mở Sửa 1 thẻ kho đã có "Ảnh đại diện chung" — phải thấy thumbnail ảnh hiện tại; không chọn ảnh mới, chỉ sửa 1 trường khác (VD Tên hàng) rồi Lưu; mở lại Sửa — ảnh vẫn hiện đúng như trước.

---

## BƯỚC 2.17 — Nâng cấp từ v5.11 lên v5.12 (bỏ qua nếu cài mới)

Phản hồi trực tiếp (3 yêu cầu trong 1 lượt): (1) "khi làm phiếu nhập cây vải lúc trước có phần in tem các cây mới nhập, hiện tại không thấy có chức năng đó"; (2) "ở công đoạn giao vải sx (mã: GV) khi quét QR tìm kiếm cây vải, cho phép khi quét QR liên tục tự thêm cây tìm thấy"; (3) "Phiếu xuất kho vải: khi quét QR tìm kiếm cây vải, cho phép khi quét QR liên tục tự thêm cây tìm thấy".

- **Mục (1) — khôi phục nút in tem**: màn "Xem" 1 phiếu nhập kho vải (mở từ nút "Xem/In" ở danh sách Nhập kho) nay có thêm nút **"🏷️ In tem các cây vừa nhập"** bên cạnh "🖨️ In phiếu" — dùng lại nguyên hàm in tem sẵn có của tab "In tem theo ngày nhập" (không tạo mẫu tem riêng, tránh lệch mẫu về sau nếu tab kia đổi). Mặc định khổ tem "dọc" (giống mặc định của tab kia) — không thêm lựa chọn dọc/ngang ngay tại đây để màn Xem gọn; cần khổ ngang vẫn dùng được tab "In tem theo ngày nhập" riêng (không đổi).
- **Mục (2)+(3) — quét QR liên tục tự thêm cây**: nâng cấp hàm quét QR dùng chung (`openQrScanner`) thêm chế độ tuỳ chọn "liên tục" — camera không tự tắt sau mỗi lần quét được, cho phép đưa lần lượt nhiều cây vải vào camera mà không cần bấm mở lại mỗi lần. Thêm nút mới **"📷 Quét QR liên tục"** tại 3 nơi: Ghi tiến độ → công đoạn Giao vải (khối "Thêm cây vải giao"), Phiếu xuất kho vải → Tạo phiếu, và Phiếu xuất kho vải → Sửa phiếu. Mỗi cây quét được tự thêm 1 dòng mới vào danh sách (không cần bấm "+ Thêm..." trước), tự bỏ qua nếu cây đó đã có sẵn trong danh sách (tránh thêm trùng do rung tay/quét lại cùng 1 mã), báo rõ nếu mã quét được không khớp cây nào còn phù hợp (đúng loại vải/màu của đơn, hoặc còn tồn kho, tuỳ màn). Tự bấm "Đóng" (hoặc Esc) trên camera khi quét xong.
- **Không đổi**: nút "📷 Quét QR" quét-1-lần trên từng dòng (dùng khi cần sửa/điền lại đúng 1 dòng cụ thể, camera vẫn tự tắt như trước); nút "📷 Quét QR tìm cây" ở tab "Tồn theo cây" (đây là ô lọc tìm kiếm 1 kết quả, không phải danh sách nhiều dòng nên không áp dụng "tự thêm").

**Xác minh độc lập**: đã rà soát riêng bằng 1 lượt kiểm tra độc lập, PASS toàn bộ — kể cả rủi ro cụ thể đã lường trước (dòng tự thêm qua QR có thể hiện `value="undefined"` ở ô KG nếu quên khai báo giá trị rỗng — đã tránh đúng), và đồng bộ ẩn/hiện nút "Quét QR liên tục" theo đơn hàng đang chọn ở Tạo phiếu xuất kho vải (ẩn/hiện cùng lúc với nút "+ Thêm cây vải" khi đổi đơn hàng).

Thuần frontend (`common.js`, `module.khovai.js`, `module.qlsx.js`), không đổi backend/schema, không có migration.

1. Thay `frontend/` bằng bản v5.12 (không có migration, không cần backup DB riêng cho bước này).
2. `pm2 restart qlnoibo`, Ctrl+F5 để chắc chắn nạp đúng bản JS mới.
3. Kiểm tra: (a) mở 1 phiếu nhập kho vải cũ qua "Xem/In" — thấy nút "In tem các cây vừa nhập", bấm ra đúng tem QR của các cây trong phiếu đó (đúng mã cây/loại vải/màu/KG/ngày nhập); (b) Ghi tiến độ → công đoạn Giao vải, bấm "Quét QR liên tục", quét lần lượt 2-3 mã cây khác nhau — mỗi lần quét tự thêm đúng 1 dòng mới, không cần đóng/mở lại camera giữa các lần quét; quét lại đúng 1 mã đã có sẵn — phải báo "đã có trong danh sách", không thêm trùng dòng; (c) lặp lại kiểm tra tương tự ở Phiếu xuất kho vải, cả màn Tạo phiếu và Sửa phiếu.

---

## BƯỚC 2.18 — Nâng cấp từ v5.12 lên v5.13 (bỏ qua nếu cài mới)

Đợt refinement lớn theo yêu cầu 12 mục con, chia 2 nhóm: **1.1 Ra lệnh sản xuất** (4 mục) và **1.2 Ghi nhận tiến độ** (8 mục: Kỹ thuật 3 mục + Cắt 2 mục, còn lại là hệ quả trực tiếp). Thêm 2 bảng mới (`DonHangChiTietSoDo`, `DonHangChiTietNhaGiaCong`), 2 cột mới (`DonHangSanXuat.HeSoQuyDoi`, `TienDoSanXuat.SoDoID`) — xem `database/migration_v513.sql`.

### 1.1 Ra lệnh sản xuất

- **1.1.1 + 1.1.2 — Bỏ "Tổng số lượng" nhập tay, thêm "Hệ số quy đổi"**: `Tổng số lượng` không còn là ô nhập tay — hệ thống tự tính từ tổng số lượng các dòng màu CHÍNH trong Cấu trúc vải mỗi khi Lưu (tạo mới hoặc sửa). Thay vào đó thêm ô **"Hệ số quy đổi (Cái / 1 Ri)"** — cùng khái niệm với hệ số vốn nhập ở công đoạn Cắt trước đây, nay khai báo 1 LẦN DUY NHẤT tại đây và dùng chung cho toàn bộ đơn hàng (xem mục 1.2.2.2).
- **1.1.3.1 — Hàng "Tổng cộng" trong Cấu trúc vải**: bảng Cấu trúc vải nay tự cộng dồn và hiện 1 hàng "Tổng cộng" theo cột số lượng từng màu vải chính, kèm cột "Số lượng sau quy đổi" (= tổng số lượng × Hệ số quy đổi vừa thêm ở trên) — cập nhật ngay khi gõ, không cần lưu mới thấy.
- **1.1.3.2 — Thêm loại vải/màu vải ngay tại chỗ**: ô chọn Loại vải và Màu vải (từng dòng màu chính/màu phối) nay có nút "+ Mới" — gõ tên loại vải hoặc màu chưa có trong danh mục, xác nhận là lưu thẳng vào Danh mục vải (dùng lại đúng API `POST /danhmuc/loaivai` và `/danhmuc/mausac` đã có sẵn) và chọn luôn giá trị vừa thêm cho dòng đó, không phải rời màn hình sang Danh mục rồi quay lại.
- **1.1.3.3 — Gõ tìm loại vải/màu vải**: ô chọn Loại vải/Màu vải đổi từ dropdown cố định sang gõ ký tự bất kỳ để lọc (dùng lại đúng cơ chế `searchableSelectHtml` dùng chung toàn hệ thống).
- **1.1.3.4 — Ảnh từng màu tự co giãn**: khung ảnh từng dòng màu đổi từ kích thước cố định 32×32 sang tự co giãn theo đúng kích thước ảnh đã tải lên (tối đa 100px), không còn bị bó cứng/méo ảnh.
- **1.1.4 — Bỏ "Phụ kiện cần dùng (NPL)" khỏi phiếu in Lệnh sản xuất**: giai đoạn Ra lệnh/In lệnh sản xuất chưa có dữ liệu NPL thật (NPL chỉ được ghi nhận sau, ở công đoạn "Phụ kiện" trong Ghi tiến độ) nên mục này bị bỏ khỏi phiếu **Lệnh sản xuất**. Phiếu **Báo cáo đơn hàng** (in riêng, sau khi đã có tiến độ) vẫn giữ nguyên đầy đủ mục "Phụ kiện xuất kèm đơn hàng" — không đổi.

### 1.2 Ghi nhận tiến độ

- **1.2.1.1 — Sơ đồ nay là danh sách nhiều dòng**: 3 ô "Mét sơ đồ / Khổ vải sơ đồ / Mã rập" (trước đây chỉ 1 bộ giá trị duy nhất, gắn cứng vào lần Ghi tiến độ Kỹ thuật gần nhất) nay chuyển thành khối **"Sơ đồ"** — danh sách nhiều dòng, thêm cột **Ghi chú**, lưu riêng qua nút "💾 Lưu sơ đồ" (giống hệt cơ chế Giao vải/Phụ kiện đã có: lưu ngay, độc lập với nút "Gửi" chính của form). Công đoạn Cắt đọc lại danh sách này (xem mục 1.2.2.1).
- **1.2.1.2 — Nhà gia công chi tiết (nhiều nhà gia công + ghi chú)**: thêm khối **bổ sung** "Nhà gia công chi tiết", cho ghi nhận NHIỀU nhà gia công + ghi chú cho cùng 1 đơn hàng (cùng cơ chế lưu-ngay như Sơ đồ). **Quan trọng**: đây là danh sách bổ sung để theo dõi/ghi nhận — ô chọn "Giao nhà gia công" gốc (1 lựa chọn duy nhất) VẪN GIỮ NGUYÊN, không bị thay thế, vì đó là nguồn dữ liệu duy nhất quyết định có bỏ qua công đoạn May hay không (`tinhNextStage()`) và hiện trên Dashboard/báo cáo theo nhà cung cấp — đổi thành nhiều giá trị ở CHÍNH ô đó sẽ phá vỡ logic điều hướng 1-đổi-1 này.
- **1.2.1.3 — Ẩn "Nhân viên & SL" tại Kỹ thuật**: khối "Chọn công đoạn may áp dụng cho đơn hàng này + đơn giá riêng" tại Kỹ thuật nay ẩn cột "Nhân viên & SL" (giao việc nội bộ/Nhà Làm) — cột này chỉ còn hiện ở đúng công đoạn May như trước v5.7 (bản v5.7 từng đưa thêm 1 bản sao lên Kỹ thuật cho tiện nhập liệu, nay bỏ lại đúng theo yêu cầu). Chọn/thêm/xoá/sửa Đơn giá/Hệ số công đoạn may vẫn hoạt động bình thường ở Kỹ thuật như trước — chỉ ẩn đúng 1 cột.
- **1.2.2.1 — Chọn sơ đồ tại công đoạn Cắt**: nếu đơn hàng có NHIỀU HƠN 1 sơ đồ (khai báo ở Kỹ thuật, mục 1.2.1.1), công đoạn Cắt hiện thêm ô chọn "Sơ đồ đang cắt" để gắn đúng lần Ghi tiến độ này với đúng sơ đồ đang dùng. Đơn hàng chỉ có 1 sơ đồ thì tự động dùng luôn, không cần chọn; chưa khai báo sơ đồ nào thì bỏ qua (không bắt buộc).
- **1.2.2.2 — Hệ số tại Cắt lấy thẳng từ Ra lệnh sản xuất**: ô nhập "Hệ số" trên từng cây vải ở công đoạn Cắt (trước đây tự nhập, mặc định 1) nay bỏ hẳn ô nhập — hiện tham khảo đúng **Hệ số quy đổi** đã khai báo 1 lần ở Ra lệnh sản xuất (mục 1.1.2), dùng chung cho mọi cây vải của đơn hàng đó. Backend cũng đổi theo: tính "SL cái" luôn lấy hệ số từ `DonHangSanXuat.HeSoQuyDoi`, không còn tin theo giá trị hệ số client gửi lên nữa (tránh sai lệch nếu giao diện/máy chủ không đồng bộ).

> **⚠️ Quyết định thiết kế đã đưa ra không hỏi lại (theo đúng chỉ đạo "làm lần lượt từng mục, không cần hỏi lại")**:
> 1. Nhà gia công chi tiết (1.2.1.2) là danh sách BỔ SUNG, không thay thế ô chọn gốc — xem giải thích ở trên.
> 2. Mét sơ đồ/Khổ vải sơ đồ/Mã rập không còn gửi kèm lần "Gửi" chính của Ghi tiến độ Kỹ thuật nữa (đã chuyển hẳn sang danh sách Sơ đồ, lưu riêng) — cột `TienDoSanXuat.MetSoDoDai/KhoVaiSoDo/MaRap` gốc vẫn giữ nguyên trong schema (không xoá, để không ảnh hưởng dữ liệu lịch sử trước bản này) nhưng từ nay các lần Ghi tiến độ Kỹ thuật MỚI sẽ để trống 3 cột này (dữ liệu thật đã chuyển sang bảng `DonHangChiTietSoDo`).
> 3. **Hệ quả cần biết**: phiếu **"Báo cáo đơn hàng"** (mục "Lịch sử cập nhật tiến độ") vẫn đọc trực tiếp 3 cột cũ này trên `TienDoSanXuat` — nghĩa là các lần Ghi tiến độ Kỹ thuật ghi nhận SAU khi nâng cấp lên v5.13 sẽ hiện TRỐNG ở 3 cột đó trên phiếu in (dữ liệu ghi nhận TRƯỚC v5.13 hiện đúng như cũ, không mất). Đây là phạm vi NGOÀI 12 mục yêu cầu gốc nên chưa xử lý trong đợt này — có thể bổ sung thêm 1 mục "Sơ đồ đã khai báo" riêng trên phiếu đó (giống mục "Phụ kiện xuất kèm đơn hàng" đã có) nếu cần, xin yêu cầu thêm.
> 4. Ô chọn "Sơ đồ đang cắt" (1.2.2.1) và khối "Nhà gia công chi tiết"/"Sơ đồ" (1.2.1.1/1.2.1.2) đều KHÔNG bắt buộc nhập — để trống vẫn Gửi được bình thường, đúng tinh thần "bổ sung thêm thông tin" chứ không phải điều kiện chặn của các mục này.

**Lưu ý kiểm thử**: đã tự rà soát lại toàn bộ code liên quan (đọc lại từng hàm đã sửa/thêm bằng công cụ đọc file trực tiếp, KHÔNG dựa vào kết quả `node --check`/`wc -l` qua dòng lệnh terminal cho lần rà soát cuối — terminal cho thấy file bị cắt cụt ở đúng điểm vừa sửa dù đã đợi hơn 20 giây, mtime báo trễ hơn ~3 phút so với giờ thật; đây là hiện tượng môi trường đã ghi nhận nhiều lần trước đây — terminal/mount đọc file bị trễ sau khi sửa, KHÔNG phải lỗi cú pháp thật, đã xác nhận lại bằng cách đọc trực tiếp toàn bộ đoạn code đã sửa). Mục 1.1.1–1.1.4 đã kiểm tra ở phiên làm việc trước; mục 1.2.1.1–1.2.2.2 kiểm tra trong phiên này. Vẫn **chưa chạy được trên một instance SQL Server thật** — đây là đợt thêm 2 bảng mới, **đặc biệt khuyến nghị** kiểm thử đầy đủ theo danh sách dưới đây trên môi trường test trước khi dùng cho dữ liệu thật.

1. Chạy `database/migration_v513.sql` trong SSMS (idempotent — an toàn chạy lại nhiều lần nếu chưa chắc đã chạy).
2. Thay `backend/` và `frontend/` bằng bản v5.13.
3. `pm2 restart qlnoibo`, Ctrl+F5 để chắc chắn nạp đúng bản JS mới.
4. Kiểm tra:
   - Ra lệnh sản xuất (tạo mới VÀ sửa): không còn ô "Tổng số lượng"; có ô "Hệ số quy đổi"; Cấu trúc vải hiện đúng hàng "Tổng cộng" + số lượng sau quy đổi, tự cập nhật khi gõ; gõ loại vải/màu vải bất kỳ ký tự lọc đúng; bấm "+ Mới" thêm được loại vải/màu chưa có, chọn luôn được cho dòng đó, và thấy xuất hiện trong Danh mục vải sau đó; ảnh từng màu hiện đúng kích thước ảnh đã tải, không méo/cắt.
   - In "Lệnh sản xuất": không còn mục "Phụ kiện cần dùng (NPL)"; in "Báo cáo đơn hàng" (đơn đã có tiến độ) vẫn hiện đủ "Phụ kiện xuất kèm đơn hàng" như cũ.
   - Ghi tiến độ → Kỹ thuật: khối "Sơ đồ" thêm/xoá được nhiều dòng, lưu riêng qua "Lưu sơ đồ"; khối "Nhà gia công chi tiết" thêm/xoá được nhiều nhà gia công + ghi chú; ô chọn "Giao nhà gia công" gốc vẫn hoạt động như trước (vẫn quyết định có nhảy qua May hay không); khối "Công đoạn may áp dụng..." KHÔNG còn cột "Nhân viên & SL" nhưng vẫn thêm/xoá/sửa đơn giá-hệ số được.
   - Ghi tiến độ → Cắt: đơn hàng có > 1 sơ đồ hiện ô chọn "Sơ đồ đang cắt"; đơn có đúng 1 sơ đồ thì không hiện ô chọn (tự dùng luôn); không còn ô nhập "Hệ số" trên từng cây, chỉ hiện đúng hệ số đã khai báo ở Ra lệnh sản xuất, SL cái tính đúng theo hệ số đó.
   - Ghi tiến độ → May: xác nhận cột "Nhân viên & SL" VẪN hiện đầy đủ như trước (không bị ẩn nhầm sang May).

---

## BƯỚC 2.19 — Nâng cấp từ v5.13 lên v5.14 (bỏ qua nếu cài mới)

Thêm chức năng con **"Tài liệu kỹ thuật"** trong phân hệ Quản lý sản xuất (menu QLSX → tab mới), gồm 4 chức năng con: **Tài liệu kỹ thuật chung**, **Thông số đo**, **Chỉ định NPL** (tách ra khỏi Ghi nhận tiến độ), **Mô tả sản phẩm**. Cả 4 đều: lấy danh sách đơn hàng từ Danh sách lệnh sản xuất, mỗi đơn hàng = 1 hồ sơ riêng, lưu xong đều có nút in (tên file in tự đặt theo đúng Mã ĐH). Thêm 7 bảng mới (`TaiLieuKyThuatChung/Muc/Dong`, `TaiLieuThongSoDo/Cot/Dong/GiaTri`, `TaiLieuMoTaSanPham/O`) + 1 dòng `ChucNang` mới (`QLSX/tailieukythuat`) — xem `database/migration_v514.sql`. Backend mới: `backend/routes/tailieukythuat.js` (mount tại `/api/tailieukythuat`). Frontend mới: `frontend/js/module.tailieukythuat.js`.

### 1. Tài liệu kỹ thuật chung

Form nhập theo đúng mẫu `tieuchuankythuatchung.docx` — nhiều **mục** (mỗi mục có tiêu đề in đậm + nhiều **dòng** nội dung bên dưới), thêm/xoá được cả mục lẫn dòng. Có thêm màn hình **"📑 Quản lý tài liệu mẫu"** (nút riêng cạnh sub-nav) để soạn sẵn các mẫu tiêu chuẩn dùng chung nhiều đơn hàng (không gắn Mã hàng/Diễn giải/Ngày cập nhật — chỉ có Tên mẫu + nội dung); khi soạn tài liệu cho 1 đơn hàng cụ thể có nút "Tải mẫu này" để nạp nội dung mẫu vào (THAY THẾ toàn bộ nội dung đang soạn, có xác nhận trước khi tải).

### 2. Thông số đo

Bảng dạng lưới **Size × Vị trí đo** theo đúng mẫu `thongsodo.docx` — thêm/xoá được cả dòng (Size) lẫn cột (Vị trí đo). Lưu = ghi đè toàn bộ lưới mỗi lần (không cộng dồn).

### 3. Chỉ định NPL

Tách khối "Phụ kiện" ra khỏi Ghi nhận tiến độ (công đoạn "Phụ kiện" trong Ghi tiến độ trước đây) thành 1 màn hình riêng trong Tài liệu kỹ thuật. **Không đổi bảng/route** — vẫn dùng nguyên `DonHangChiTietPhuKien` + 3 API `GET/POST/DELETE /api/qlsx/orders/:maDH/phukien` đã có từ trước, chỉ chuyển giao diện. Tại công đoạn "Phụ kiện" trong Ghi nhận tiến độ nay chỉ còn 1 dòng thông báo + nút "Mở Chỉ định NPL" dẫn sang màn hình mới.

### 4. Mô tả sản phẩm

Lưới các ô "Khoảng trống" theo đúng mẫu `motasanpham.docx` — mỗi ô dán được ảnh trực tiếp bằng **Ctrl+V** (hoặc nút "Chọn file" dự phòng) kèm ô chú thích, thêm/xoá được cả dòng lẫn cột. Có thêm ô "Chú ý" tự do (khớp khung ghi chú viền đỏ trong mẫu).

> **⚠️ Quyết định thiết kế đã đưa ra không hỏi lại (theo đúng chỉ đạo "làm tuần tự các yêu cầu trên, không cần hỏi lại")**:
> 1. **3 loại tài liệu mới (Tài liệu kỹ thuật chung/Thông số đo/Mô tả sản phẩm) lưu = GHI ĐÈ TOÀN BỘ** mỗi lần bấm Lưu (khác hẳn Giao vải/Phụ kiện/Sơ đồ — vốn chỉ cộng dồn thêm dòng) — vì đây là soạn 1 văn bản hoàn chỉnh (như sửa file Word), không phải liên tục bổ sung theo thời điểm khác nhau.
> 2. **Chỉ định NPL gate quyền theo `tiendo`, KHÔNG phải `tailieukythuat`** — vì dùng lại nguyên route cũ của Ghi nhận tiến độ. Hệ quả: 1 người cần CẢ 2 quyền (`tailieukythuat` để thấy menu/danh sách đơn; `tiendo` để thực sự xem/lưu/xoá NPL) mới dùng trọn vẹn được màn hình này — **cần kiểm tra lại Ma trận phân quyền** cho các nhóm cần dùng Chỉ định NPL. Trong thực tế, ai trước đây chỉ định được NPL qua Ghi nhận tiến độ thì đã sẵn có `tiendo` rồi nên không phát sinh việc cấp quyền mới, chỉ cần cấp thêm `tailieukythuat` (mặc định KHÔNG bị chặn nếu Admin chưa từng cấu hình dòng ma trận riêng cho chức năng này — xem cơ chế "mặc định cho phép" ở Bước 9).
> 3. Do kiến trúc chỉ cho 1 popup tồn tại cùng lúc, bấm "Mở Chỉ định NPL" từ Ghi nhận tiến độ sẽ **đóng luôn popup Ghi nhận tiến độ đang mở**. Sau khi chỉ định xong, cần vào lại Danh sách lệnh sản xuất → Ghi tiến độ cho đúng đơn đó để bấm "Gửi" chuyển công đoạn — màn hình đã có dòng hướng dẫn này.
> 4. **Bỏ dòng "Tổng SL cắt (đã quy đổi)" tham khảo** (từng có trong khối Phụ kiện cũ) khỏi màn hình Chỉ định NPL mới — tính lại số này cần gọi API chi tiết đơn hàng (`GET /api/qlsx/orders/:maDH`), vốn gate theo quyền `orders` (khác `tiendo`), sẽ chặn nhầm người chỉ có `tiendo`. Có thể bổ sung lại sau nếu cần, nhưng cần thêm route/dữ liệu hỗ trợ đúng quyền `tiendo`.
> 5. **Mô tả sản phẩm — lưới suy ra kích thước (số dòng/cột) từ toạ độ các ô ĐÃ CÓ NỘI DUNG** khi tải lại (vì bảng lưu dạng thưa, chỉ lưu ô có ảnh hoặc chú thích). Hệ quả: nếu dòng/cột cuối cùng hoàn toàn trống (chưa dán ảnh, chưa ghi chú) thì sau khi lưu và tải lại, khung trống đó sẽ không còn — lưới tự "co gọn" về đúng phần có nội dung. Không mất nội dung thật, chỉ mất khung trống chưa dùng tới.
> 6. **Dán ảnh Ctrl+V là thao tác hoàn toàn mới**, chưa từng có tiền lệ trong hệ thống trước đây — đã kiểm tra kỹ, hoạt động độc lập trên từng ô (bấm/focus vào đúng ô muốn dán trước khi Ctrl+V); có nút "Chọn file" làm phương án dự phòng cho các trường hợp không dán được (di động, trình duyệt chặn clipboard...).
> 7. Quyền Sửa/Xoá của cả Tài liệu kỹ thuật chung + Quản lý tài liệu mẫu + Thông số đo + Mô tả sản phẩm đều theo đúng 1 chức năng mới `QLSX/tailieukythuat` — tự xuất hiện trong Ma trận phân quyền (menu Quản lý User) ngay sau khi chạy migration, không cần sửa gì thêm ở giao diện phân quyền.

**Lưu ý kiểm thử**: đã tự đọc lại toàn bộ code mới/đã sửa bằng công cụ đọc file trực tiếp (không dựa vào `node --check` qua terminal cho lần rà soát cuối — lặp lại đúng hiện tượng đã ghi ở Bước 2.18: terminal báo cú pháp lỗi ở 2 file vừa sửa, cắt cụt file giữa chừng dù đã đợi hơn 25 giây; đã xác nhận lại bằng cách đọc trực tiếp đúng những đoạn terminal báo lỗi — nội dung thật hoàn toàn hợp lệ, đây là độ trễ môi trường, không phải lỗi cú pháp thật). **Chưa chạy được trên một instance SQL Server thật và chưa thao tác thử trên trình duyệt thật** — đây là đợt thêm 7 bảng mới + 1 tương tác hoàn toàn mới (dán ảnh), **đặc biệt khuyến nghị** kiểm thử đầy đủ theo danh sách dưới đây trên môi trường test trước khi dùng cho dữ liệu thật.

1. Chạy `database/migration_v514.sql` trong SSMS (idempotent).
2. Thay `backend/` và `frontend/` bằng bản v5.14.
3. `pm2 restart qlnoibo`, Ctrl+F5.
4. Vào Quản lý User → Ma trận phân quyền: xác nhận chức năng mới "Tài liệu kỹ thuật" xuất hiện dưới QLSX; cấp quyền Xem/Sửa/Xoá cho các nhóm cần dùng; với nhóm cần dùng **Chỉ định NPL**, xác nhận nhóm đó cũng có quyền ở chức năng "Ghi tiến độ" (nếu ma trận đã từng cấu hình hạn chế riêng cho 2 chức năng này).
5. Kiểm tra:
   - Menu QLSX xuất hiện tab "Tài liệu kỹ thuật", 4 nút chuyển chức năng con hoạt động, mỗi tab hiện đúng danh sách lệnh sản xuất kèm trạng thái "Đã có"/"Chưa có".
   - Tài liệu kỹ thuật chung: tạo mới, thêm/xoá mục và dòng, Lưu, Mở lại đúng nội dung vừa lưu, In ra đúng tiêu đề "TIÊU CHUẨN KỸ THUẬT"; "Quản lý tài liệu mẫu" tạo/sửa/xoá được mẫu; "Tải mẫu này" nạp đúng nội dung mẫu vào tài liệu đang soạn (có hỏi xác nhận trước khi ghi đè).
   - Thông số đo: thêm/xoá được cả dòng (Size) lẫn cột (Vị trí đo), giá trị từng ô lưu đúng vị trí sau khi thêm/xoá cột ở giữa bảng (không bị lệch cột); In ra đúng bảng 2 tầng tiêu đề như mẫu.
   - Chỉ định NPL: mở từ danh sách trong Tài liệu kỹ thuật hoạt động; mở từ nút "Mở Chỉ định NPL" tại công đoạn Phụ kiện trong Ghi nhận tiến độ cũng hoạt động (và đóng đúng popup Ghi nhận tiến độ); thêm/xoá phụ kiện lưu đúng vào `DonHangChiTietPhuKien`; dữ liệu hiện GIỐNG HỆT dữ liệu công đoạn Phụ kiện cũ từng ghi (nếu đơn hàng đã có từ trước v5.14); In ra đúng danh sách NPL.
   - Mô tả sản phẩm: dán ảnh Ctrl+V vào 1 ô hoạt động (ảnh hiện ngay sau khi tải lên xong); nút "Chọn file" cũng tải ảnh lên được; thêm/xoá dòng/cột không làm lệch ảnh/chú thích của các ô còn lại; Lưu + Mở lại đúng ảnh/chú thích/Chú ý đã nhập; In ra đúng ảnh + chú thích + khung "Chú ý" viền đỏ.
   - Xác nhận công đoạn "Phụ kiện" trong Ghi nhận tiến độ (menu cũ) không còn ô nhập inline nữa, chỉ còn thông báo + nút dẫn sang Chỉ định NPL; bấm "Gửi" (không cần mở NPL) vẫn chuyển công đoạn bình thường như trước.

---

## BƯỚC 2.20 — Nâng cấp từ v5.14 lên v5.15 (bỏ qua nếu cài mới)

Đợt v5.15: thêm chức năng **in Tài liệu kỹ thuật ngay từ Danh sách lệnh sản xuất** (menu "Quản lý sản xuất"), theo đúng yêu cầu "thêm chức năng in Tài liệu kỹ thuật, lựa chọn in tất cả hoặc từng loại". Thuần frontend (chỉ sửa `module.qlsx.js`/`module.tailieukythuat.js`), không đổi schema, không có migration.

- Mỗi dòng lệnh sản xuất trong Danh sách lệnh sản xuất nay có thêm nút **"In tài liệu KT"** (chỉ hiện với người có quyền Xem chức năng "Tài liệu kỹ thuật") — bấm vào hiện 1 popup nhỏ để chọn: **"In tất cả"** (gộp mọi loại tài liệu ĐÃ CÓ dữ liệu của đơn hàng đó vào 1 lần in duy nhất, mỗi loại tách trang riêng, tự bỏ qua loại chưa có gì) hoặc in đúng **1 trong 4 loại** (Tài liệu kỹ thuật chung / Thông số đo / Chỉ định NPL / Mô tả sản phẩm).
- Không đổi hành vi nút "In" sẵn có bên trong từng màn hình soạn tài liệu (vẫn hoạt động như v5.14) — đây chỉ là 1 lối vào MỚI, nhanh hơn, ngay từ danh sách lệnh sản xuất, không cần mở tab "Tài liệu kỹ thuật" trước.
- Nếu lệnh sản xuất chưa có dữ liệu ở loại được chọn (hoặc chưa có gì ở cả 4 loại khi bấm "In tất cả"), hệ thống báo lỗi bằng thông báo nổi (toast), không mở hộp thoại in trống.

**Quyết định thiết kế**: chức năng in gộp dùng lại đúng 4 hàm đọc/dựng nội dung đã có từ v5.14 (chỉ tách phần "dựng HTML" ra khỏi phần "gọi lệnh in" để dùng lại được cho cả in-riêng-từng-loại và in-gộp) — không đọc/tính toán gì mới, nên thừa hưởng nguyên các gate quyền đã có của v5.14 (mục Chỉ định NPL trong lần in gộp vẫn gate theo quyền `tiendo`, sẽ tự bỏ qua — không báo lỗi — nếu người in không có quyền đó, để không chặn in 3 loại còn lại).

**Lưu ý kiểm thử**: đã tự đọc lại toàn bộ vùng code sửa/thêm bằng Read (không dựa vào `node --check` qua terminal — tái diễn đúng hiện tượng đã ghi ở Bước 2.19, terminal báo cú pháp lỗi ngay giữa 1 dòng `<th>` hoàn toàn hợp lệ khi đọc trực tiếp). Chưa bấm thử trên trình duyệt thật.

1. Thay `frontend/` bằng bản v5.15 (không có migration, không cần backup DB riêng cho bước này).
2. Ctrl+F5.
3. Kiểm tra: Danh sách lệnh sản xuất hiện nút "In tài liệu KT" (ẩn nếu tài khoản không có quyền Xem "Tài liệu kỹ thuật"); bấm vào hiện đúng popup 5 lựa chọn; "In tất cả" cho 1 đơn đã có đủ cả 4 loại ra đúng 4 trang tách biệt; "In tất cả" cho 1 đơn CHƯA có gì báo lỗi bằng toast, không mở hộp thoại in; chọn đúng 1 loại chưa có dữ liệu báo lỗi đúng tên loại đó; chọn đúng 1 loại đã có dữ liệu in ra giống hệt như bấm nút "In" bên trong màn hình soạn loại đó.

---

## BƯỚC 2.21 — Nâng cấp từ v5.15 lên v5.16 (bỏ qua nếu cài mới)

Đợt v5.16 gồm 9 yêu cầu rời rạc trong Quản lý sản xuất (Lệnh sản xuất, Ghi nhận tiến độ, Danh sách lệnh sản xuất) + 1 yêu cầu ở Danh mục:

1. **In Lệnh sản xuất — hàng "Tổng cộng" cuối bảng Cấu trúc vải**: hiện `<Tổng số lượng> Cái (<SL sau quy đổi> Ri)` (dùng `HeSoQuyDoi` đã khai báo ở Ra lệnh sản xuất) — chỉ hiện khi đơn hàng đã khai báo ít nhất 1 dòng cấu trúc vải.
2. **Ra lệnh sản xuất / Sửa lệnh sản xuất — dòng tổng cộng dưới Cấu trúc vải đổi sang cùng định dạng "X Cái (Y Ri)"** (trước đây tách 2 cụm "Tổng cộng (SL các màu chính)" / "SL sau quy đổi" riêng biệt) — chỉ đổi CHỮ hiển thị, không đổi cách tính hay các `id` đang được script đọc.
3. **Ghi nhận tiến độ — Kỹ thuật/May, khối "Công đoạn may đã chọn"**:
   - Đổi được **công đoạn** của 1 dòng đã thêm (trước đây chỉ sửa được Đơn giá/Hệ số, tên công đoạn là chữ cố định) — đổi công đoạn sẽ nạp lại Đơn giá/Hệ số theo mặc định của công đoạn mới.
   - Thêm nút **"💾 Lưu công đoạn"** — lưu ngay danh sách công đoạn đã chọn, không cần bấm "Gửi" của cả form (giống nút "Lưu nhà gia công"/"Lưu sơ đồ" đã có).
   - Thêm nút **"+ Mới"** cạnh ô "+ Thêm công đoạn may" — tạo nhanh 1 công đoạn may CHƯA CÓ trong danh mục "Đơn giá công đoạn may" và tự chọn luôn cho đơn hàng đang mở (giống nút "+ Mới" của Loại vải/Màu sắc).
4. **Ghi nhận tiến độ — Kỹ thuật, khối "Nhà gia công chi tiết"**: các dòng ĐÃ ghi nhận nay có thêm nút **"Sửa"** (sửa nhà gia công + ghi chú tại chỗ, có Lưu/Hủy) — trước đây chỉ Thêm/Xóa được. (Việc ghi nhận nhiều nhà gia công cùng lúc đã có sẵn từ v5.13, không cần đổi gì.)
5. **Ghi nhận tiến độ — Cắt, khi đơn hàng khai báo ≥ 2 sơ đồ**: form nhập liệu tách thành **N khối riêng biệt (1 khối/sơ đồ)**, mỗi khối tự có STT sổ cắt / Nhân viên trải vải (tối đa 2 người) / Nhân viên cắt / bảng số lượng theo từng cây vải đã giao — thay vì trước đây chỉ có 1 ô chọn "đang cắt sơ đồ nào" dùng chung 1 form phẳng cho tất cả. Bấm "Gửi" 1 lần sẽ lưu **tất cả các khối có nhập dữ liệu** cùng lúc (mỗi khối = 1 lần ghi nhận tiến độ riêng trong lịch sử). "Tổng SL cái" cộng dồn qua mọi khối. Đơn hàng có 0 hoặc 1 sơ đồ: **giữ nguyên 100%** form phẳng như v5.13, không đổi gì.
6. **"Tổng số bàn cắt"** (hiện tham khảo ở công đoạn May): khi 1 lần Ghi nhận tiến độ Cắt tạo ra nhiều bản ghi (mục 5 ở trên), số này nay **cộng dồn đúng qua tất cả các bản ghi cùng 1 lần Gửi** (trước đây chỉ tính đúng khi có 1 sơ đồ) và **chỉ tính cây thuộc màu chính** (loại cây thuộc màu phối ra khỏi số này, vẫn lưu dữ liệu bình thường).
7. **Danh sách lệnh sản xuất → "In tài liệu kỹ thuật"**: đóng hộp thoại in xong, màn hình chọn-loại-in **không tự đóng nữa** — ở lại nguyên đó để in tiếp loại khác nếu cần (trước đây đóng ngay khi bấm 1 lựa chọn in).
8. **Danh mục → Nhân viên**: đã kiểm tra lại — cột **"Mã NV"** đã có sẵn đầy đủ cả ở giao diện danh sách, form thêm/sửa, lẫn cột `MaNhanVien` trong bảng `NhanVien` từ trước; không cần sửa gì thêm cho mục này.

**Migration**: `database/migration_v516.sql` — thêm 1 cột `TienDoSanXuat.NhomTienDoID` (INT NULL, tự tham chiếu chính bảng đó) dùng để "gộp nhóm" các bản ghi tiến độ Cắt tạo ra từ CÙNG 1 lần Gửi khi đơn hàng có ≥ 2 sơ đồ (mục 5/6 ở trên) — NULL cho mọi bản ghi cũ và mọi trường hợp chỉ có 1 sơ đồ (không đổi hành vi). Idempotent — chạy lại nhiều lần không lỗi.

**Quyết định thiết kế đáng chú ý**:
- Mục 3 (đổi công đoạn của 1 dòng đã thêm): khi đổi, Đơn giá/Hệ số **nạp lại theo mặc định của công đoạn MỚI** (không giữ số cũ) — tránh nhầm "tưởng giá cũ vẫn đúng cho công đoạn mới".
- Mục 4 (sửa nhà gia công chi tiết): **không** giới hạn chỉ Admin mới sửa được — vì Thêm/Xóa ở chính danh sách này vốn đã không giới hạn theo vai trò, nên đồng bộ cùng 1 mức quyền (khác với "Sửa" ở lịch sử Giao việc nội bộ công đoạn May, nơi có chủ đích chỉ dành cho Admin).
- Mục 5/6 (Cắt nhiều sơ đồ): mỗi khối sơ đồ tạo **1 bản ghi `TienDoSanXuat` riêng** (không gộp thành 1 bản ghi duy nhất) — đúng với thực tế mỗi sơ đồ có thể cắt vào ngày khác/người khác, và giữ nguyên quy ước "1 bản ghi tiến độ = 1 lần ghi nhận" đã dùng xuyên suốt hệ thống. Việc chuyển sang công đoạn kế tiếp (May) chỉ chạy **đúng 1 lần** sau khi lưu xong tất cả các khối, không phải N lần.

**Lưu ý kiểm thử**: `node --check` qua terminal báo lỗi cú pháp ở nhiều vị trí hoàn toàn không liên quan tới các đoạn vừa sửa (và ở cả những dòng có từ nhiều phiên bản trước) — tái diễn đúng hiện tượng đã ghi ở Bước 2.19/2.20 (terminal/mount đọc bản cache cũ, số dòng file báo qua `wc -l` còn thấp hơn hẳn thực tế). Đã xác nhận lại bằng cách đọc trực tiếp toàn bộ các vùng code sửa/thêm (không qua terminal) — cấu trúc dấu ngoặc/backtick khớp, không phát hiện lỗi thật. Chưa bấm thử trên trình duyệt thật hay chạy migration trên SQL Server thật.

1. Backup database (đề phòng), chạy `database/migration_v516.sql` trong SSMS (Execute/F5).
2. Thay `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js` bằng bản v5.16.
3. `pm2 restart qlnoibo` (hoặc khởi động lại Node theo cách bạn đang chạy) + Ctrl+F5 trên trình duyệt.
4. Kiểm tra lần lượt đúng 9 mục ở trên, đặc biệt mục 5/6 (đơn hàng có ≥ 2 sơ đồ ở Ghi nhận tiến độ Cắt) — đây là thay đổi lớn nhất, nên thử với 1 đơn hàng thật có khai báo 2 sơ đồ trở lên trước khi dùng đại trà.

---

## BƯỚC 2.22 — Nâng cấp từ v5.16 lên v5.17 (bỏ qua nếu cài mới)

Đợt v5.17 là yêu cầu mới cho phân hệ **Thẻ kho hàng hóa**: thêm 2 trường mới trong Tạo/Sửa thẻ kho, và thêm hẳn 1 chức năng con mới **"Báo giá Aloha"** (thiết kế theo file mẫu Excel người dùng cung cấp).

1. **Tạo/Sửa thẻ kho mới — thêm 2 trường**: **"Giá Aloha"** (số, độc lập với "Giá bán" nội bộ hiện có) và **"Mã Barcode"** (chữ) — nằm ngay sau ô "Giá bán" trong form.
2. **Tab mới "Báo giá Aloha"** trong phân hệ Thẻ kho hàng hóa, gồm 2 chức năng con theo đúng yêu cầu:
   - **Tạo báo giá**: chọn nhiều mã hàng từ danh sách Thẻ kho hàng hóa (kèm ô tìm kiếm lọc theo mã/tên) để đưa vào 1 báo giá, mỗi mã hàng có ô nhập riêng **% VAT** (mặc định 8%). Kèm 4 trường chung cho cả báo giá: Tên báo giá, Tên Công ty Sản Xuất/Nhập Khẩu, Mã NCC, Tên NCC, Ghi chú.
   - **Danh sách báo giá**: liệt kê mọi báo giá đã tạo (tên, ngày tạo, NCC, số mã hàng, người tạo), mỗi dòng có nút **"⬇️ Xuất Excel"** riêng (tải đúng định dạng theo file mẫu) và nút Xóa (theo phân quyền).
   - **Quy tắc quan trọng**: 1 mã hàng chỉ được đưa vào **ĐÚNG 1 báo giá trong toàn bộ hệ thống, vĩnh viễn** — mã hàng đã có trong 1 báo giá bất kỳ (không chỉ báo giá gần nhất) sẽ **không còn hiện ra** trong danh sách chọn của báo giá mới nữa, trừ khi báo giá chứa nó bị xóa (xóa báo giá sẽ "trả lại" các mã hàng đó).

**Migration**: `database/migration_v517.sql` — thêm 2 cột `TheKhoHangHoa.GiaAloha` (DECIMAL NULL) và `TheKhoHangHoa.MaBarcode` (NVARCHAR NULL); cập nhật lại view `vw_TonKhoHangHoa` để trả về 2 cột này; thêm 2 bảng mới `BaoGiaAloha` (header) và `BaoGiaAlohaChiTiet` (chi tiết từng mã hàng, ràng buộc UNIQUE trên `MaHangID` để ép đúng quy tắc "1 mã hàng chỉ 1 báo giá" ngay ở tầng dữ liệu); thêm 1 chức năng phân quyền mới `KHOHANG/baogiaaloha`. Idempotent — chạy lại nhiều lần không lỗi. **Thêm thư viện mới**: `backend/package.json` đã thêm `exceljs` (dùng để xuất Excel có định dạng — font/viền/gộp ô — mà thư viện `xlsx` cũ trong dự án không hỗ trợ) — nhớ chạy lại `npm install` trong `backend/` sau khi thay file.

**Giả định thiết kế cần biết trước khi dùng** (vì file mẫu người dùng cung cấp không có đủ chú thích cho mọi trường hợp, các điểm sau là quyết định của người viết code — kiểm tra lại nếu không đúng ý):
- **Cột "Sau VAT"** tính theo công thức chuẩn **giá trước VAT × (1 + %VAT)** (file mẫu ghi tắt là "giá trước VAT x % VAT", được hiểu là công thức đầy đủ này).
- **"Tên Công ty Sản Xuất/Nhập Khẩu", "Mã NCC", "Tên NCC"** là 3 trường áp dụng **chung cho cả 1 báo giá** (không đổi theo từng dòng mã hàng) — dựa theo bằng chứng file mẫu có gộp ô (merge) 2 cột "Tên Công ty..." và "Tên NCC" xuyên suốt các dòng hàng; cột "Mã NCC" cũng được gộp theo cùng logic dù file mẫu gốc không gộp sẵn cột này (để đồng bộ, vì bản chất cùng là thông tin NCC).
- **Cột "Hình ảnh sp"** trong file Excel xuất ra để **trống** (không nhúng ảnh thật vào file) — chỉ lấy đúng dữ liệu có nguồn trong hệ thống (giá, mã vạch, số màu, số cái/1 ri...), các cột không có nguồn dữ liệu tương ứng (Giá bán đề xuất, 3 cột tỷ lệ, 11 cột chi nhánh/huyện, Tổng cộng) để trống đúng theo chú thích "bỏ trống" trong file mẫu.
- **Quy tắc loại trừ mã hàng** hiểu theo nghĩa "loại trừ vĩnh viễn khỏi mọi báo giá trong tương lai", không phải "chỉ loại trừ khỏi báo giá gần nhất" — vì câu yêu cầu gốc có thể hiểu theo cả 2 cách, đã chọn cách chặt hơn (ép bằng UNIQUE ở CSDL). Nếu thực tế cần hiểu theo nghĩa khác (VD 1 mã hàng được phép xuất hiện lại ở báo giá sau khi đã có ở báo giá cũ), cần báo lại để sửa ràng buộc này.

**Lưu ý kiểm thử**: `node --check`/`wc -l` qua terminal tiếp tục cho kết quả sai lệch với nội dung file thật (hiện tượng đã ghi nhận nhiều lần ở các Bước trước — terminal/mount đọc bản cache cũ). Đã xác nhận cấu trúc code đúng bằng cách đọc trực tiếp toàn bộ vùng code mới/sửa. Thư viện `exceljs` đã được kiểm thử độc lập (ngoài dự án) để xác nhận hỗ trợ đúng font/viền/gộp ô/độ rộng cột cần dùng. **Chưa** chạy migration trên SQL Server thật, chưa bấm thử trên trình duyệt thật, và chưa xuất thử 1 file Excel thật để so khớp trực quan với file mẫu — nên kiểm tra kỹ các mục sau khi triển khai:

1. Backup database, chạy `database/migration_v517.sql` trong SSMS (Execute/F5).
2. Thay `backend/routes/khohang.js` + `frontend/js/module.khohang.js` bằng bản v5.17; thay `backend/package.json` rồi chạy `npm install` trong `backend/` (để cài `exceljs`).
3. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
4. Kiểm tra: Tạo/Sửa thẻ kho có 2 ô "Giá Aloha"/"Mã Barcode" mới, lưu và sửa lại đọc đúng giá trị đã lưu. Tab "Báo giá Aloha" hiện đúng danh sách mã hàng khi Tạo báo giá; sau khi lưu 1 báo giá, các mã hàng đó **biến mất** khỏi danh sách chọn của báo giá tiếp theo. Bấm "⬇️ Xuất Excel" tải về đúng file, mở bằng Excel/LibreOffice kiểm tra bố cục (dòng tiêu đề công ty, tiêu đề báo cáo, header 28 cột, dữ liệu, dòng ký tên) so với file mẫu gốc. Xóa 1 báo giá rồi vào lại Tạo báo giá — mã hàng của báo giá vừa xóa phải **xuất hiện lại** trong danh sách chọn.

---

## BƯỚC 2.23 — Nâng cấp từ v5.17 lên v5.18 (bỏ qua nếu cài mới)

Đợt v5.18 gồm 2 nhóm yêu cầu: **Quản lý sản xuất** (Danh sách lệnh sản xuất + Ghi nhận tiến độ) và **Thẻ kho hàng hóa** (Báo giá Aloha).

1. **Danh sách lệnh sản xuất — sửa lỗi ẩn nhầm**: user chỉ được phân quyền "Xem" (không được gán công đoạn nào) trước đây bị lọc ra **danh sách rỗng** thay vì thấy toàn bộ đơn hàng — lỗi ở logic lọc `GET /orders`, không phải ở bảng phân quyền (đã kiểm tra kỹ, các mặc định phân quyền theo chức năng vẫn đúng). Đã sửa: user không được gán công đoạn nào (`congDoanIds` rỗng) nay được coi như "xem tất cả", giống admin/Quản lý/Giao nhận.
2. **Ghi nhận tiến độ — bỏ 2 công đoạn khỏi luồng nhập liệu**: **"Chỉ định phụ kiện"** (PK) và **"Giao vải"** (GV) không còn hiện trong ô chọn Công đoạn nữa — luồng nhảy thẳng từ Kỹ thuật sang Cắt. 2 công đoạn này **không bị xóa** khỏi Danh mục công đoạn sản xuất (vẫn là hệ thống, `LaHeThong=1`) để không ảnh hưởng dữ liệu lịch sử/báo cáo cũ — chỉ không còn là điểm dừng của đơn hàng mới.
3. **Điều kiện mới cho công đoạn "Cắt"**: đơn hàng phải **đã có Phiếu xuất kho vải** (Kho vải → Xuất kho vải) mới ghi nhận được tiến độ Cắt — chặn cả ở backend (từ chối rõ ràng nếu bấm "Gửi" lúc chưa có) lẫn ở màn hình (hiện cảnh báo thay vì form nhập liệu nếu chưa có phiếu xuất nào).
4. **Công đoạn Cắt — chọn cây vải tường minh**: trước đây màn hình tự hiện SẴN toàn bộ cây vải đã "giao tạm" cho đơn hàng (cơ chế Giao vải cũ) thành các dòng nhập liệu có sẵn. Nay: (a) nguồn cây vải đổi sang cây **đã thực sự xuất kho** cho đơn hàng qua Phiếu xuất kho vải (không còn là "giao tạm" chưa trừ kho); (b) người dùng phải **chủ động chọn** từng cây vải cần đưa vào (gõ tìm mã cây, giống thao tác "Giao vải" cũ) qua nút "+ Thêm dòng", thay vì bị hiện sẵn hết.
5. **Đơn hàng ≥ 2 sơ đồ ở Cắt — đổi cách nhập**: thay vì hiện cùng lúc N khối form xếp chồng (cách làm v5.16), nay có **1 ô chọn "Sơ đồ đang nhập liệu"** (dropdown) + **1 khu vực nhập liệu duy nhất** cho đúng sơ đồ đang chọn. Dữ liệu của các sơ đồ khác (đã nhập nhưng đang không hiện trên màn hình) vẫn được giữ tạm trong bộ nhớ của form, gộp lại đầy đủ khi bấm "Gửi" — không cần cuộn qua nhiều khối để nhập.
6. **Báo giá Aloha — Danh sách báo giá**: thêm nút **"Xem/In"** mỗi dòng (mở màn hình xem chi tiết đầy đủ + nút "🖨️ In" ra bản in nhanh dạng bảng, tách biệt với "⬇️ Xuất Excel" theo file mẫu đã có từ v5.17).
7. **Báo giá Aloha — Xuất Excel**: cột **"Hình ảnh sp"** nay **nhúng ảnh đại diện thật** của mã hàng (trước đây để trống — xem giả định đã ghi ở Bước 2.22). Ảnh được **chuẩn hóa qua thư viện `sharp`** thành PNG trước khi nhúng — nhận diện và giải mã được hầu hết định dạng thực tế (JPEG/PNG/WEBP/GIF/TIFF/SVG/HEIF...), không còn giới hạn chỉ PNG/JPEG/GIF như bản đầu (giới hạn gốc của riêng `exceljs`). Việc đổi sang PNG là **đổi "vỏ" định dạng, không làm giảm chất lượng** — PNG vốn không mất dữ liệu (lossless), ảnh chỉ được giải mã rồi mã hóa lại nguyên vẹn, không co giãn/cắt/nén mất chi tiết. Ảnh lỗi/không đọc được vẫn chỉ bỏ qua từng ô riêng lẻ, không làm hỏng cả file xuất.

**Migration**: `database/migration_v518.sql` — **không có thay đổi schema** (không thêm bảng/cột mới), chỉ xử lý DỮ LIỆU: đơn hàng nào đang "đứng" ở công đoạn Giao vải/Chỉ định phụ kiện tại thời điểm nâng cấp sẽ được chuyển thẳng con trỏ (`DonHangSanXuat.CongDoanHienTaiID`) sang "Cắt" (tính lại luôn % hoàn thành cho khớp vị trí mới) — không đụng đến lịch sử `TienDoSanXuat` đã ghi nhận trước đó. An toàn chạy lại nhiều lần (lần 2 trở đi không còn đơn nào ở GV/PK nên không làm gì thêm). **Yêu cầu tiên quyết**: đã chạy `migration_v59.sql` và `migration_v52_qlsx.sql` từ trước (script sẽ báo lỗi và dừng nếu chưa đủ 3 mã công đoạn GV/PK/CAT). **Thêm thư viện mới**: `backend/package.json` đã thêm `sharp` (chuẩn hóa ảnh trước khi nhúng vào Excel, mục 7 ở trên) — nhớ chạy lại `npm install` trong `backend/` sau khi thay file. **Lưu ý riêng cho `sharp`**: đây là thư viện native (kèm binary biên dịch sẵn theo hệ điều hành/kiến trúc CPU máy chủ) — `npm install` cần có kết nối mạng để tải đúng bản binary cho máy chủ đang chạy; nếu máy chủ không có Internet lúc cài, cần tải trước bản phù hợp hoặc dùng `npm install --build-from-source` (yêu cầu sẵn thư viện hệ thống `vips`) — xem tài liệu chính thức của `sharp` nếu gặp lỗi cài đặt.

**Quyết định/giả định thiết kế cần biết**:
- Bảng `GiaoVaiSanXuat` và route `GET/POST/DELETE /orders/:maDH/giaovai` (backend) **không bị xóa** — chỉ không còn được UI mới gọi tới nữa (không có đường nào ghi thêm dữ liệu mới vào bảng này). Giữ lại để không ảnh hưởng dữ liệu lịch sử; có thể dọn dẹp sau nếu chắc chắn không cần.
- Yêu cầu gốc "List chọn sơ đồ cắt... khi chọn sơ đồ mới có màn hình nhập liệu" được hiểu là: đổi từ "hiện tất cả sơ đồ cùng lúc" (v5.16) sang "chọn 1 sơ đồ tại 1 thời điểm, form nhập liệu đổi theo lựa chọn" — nếu ý định thực tế khác (VD vẫn muốn thấy tổng quan nhiều sơ đồ cùng lúc), cần phản hồi để điều chỉnh lại cách hiển thị.
- Hàm nội bộ `getMauSacsWithProgress()` (khóa sửa/xóa màu chính đã có tiến độ, dùng ở "Sửa lệnh sản xuất") được bổ sung thêm 1 nguồn dữ liệu mới (Phiếu xuất kho vải) song song với nguồn cũ (`GiaoVaiSanXuat`, nay không còn được ghi mới) + nguồn tiến độ Cắt sẵn có — để tính năng khóa/cảnh báo này tiếp tục hoạt động đúng cho các đơn hàng mới (không còn đi qua "Giao vải" nữa) giống như trước.

**Lưu ý kiểm thử**: đã đọc lại toàn bộ vùng code mới/sửa bằng tay để xác nhận cú pháp/cấu trúc đúng (`backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `backend/routes/khohang.js`, `frontend/js/module.khohang.js`) — `node --check`/`wc -l` qua terminal tiếp tục cho kết quả sai lệch với nội dung file thật ở đợt này (hiện tượng mount/cache cũ đã ghi nhận nhiều lần ở các Bước trước, lần này còn xảy ra cả khi copy file ra thư mục khác trước khi kiểm tra), nên không dùng làm căn cứ, chỉ tin kết quả đọc trực tiếp. Việc nhúng ảnh vào Excel qua `sharp` → `exceljs Workbook#addImage({buffer,...})` đã được kiểm thử riêng trong sandbox độc lập (ngoài dự án): chuyển đổi thành công 1 ảnh JPEG mẫu sang PNG rồi nhúng vào file `.xlsx`, mở lại xác nhận đúng là ảnh PNG hợp lệ. **Chưa** chạy migration trên SQL Server thật, chưa bấm thử trên trình duyệt thật (đặc biệt là luồng chọn sơ đồ/chọn cây vải mới ở Cắt), và chưa xuất thử 1 báo giá thật có ảnh đại diện (đặc biệt ảnh không phải JPEG/PNG gốc) để xem trực quan trong Excel — kiểm tra kỹ các mục sau khi triển khai:

1. Backup database, chạy `database/migration_v518.sql` trong SSMS (Execute/F5) — đọc kỹ dòng PRINT báo số đơn hàng đã được chuyển sang Cắt.
2. Thay `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js` + `backend/routes/khohang.js` + `frontend/js/module.khohang.js` + `backend/package.json` bằng bản v5.18, rồi chạy `npm install` trong `backend/` (để cài `sharp` — xem lưu ý riêng ở mục 7 phía trên nếu máy chủ không có Internet).
3. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
4. Kiểm tra: đăng nhập bằng 1 tài khoản chỉ có quyền "Xem" QLSX (không gán công đoạn nào) — Danh sách lệnh sản xuất phải hiện đầy đủ, không còn rỗng. Mở Ghi nhận tiến độ 1 đơn hàng — ô chọn Công đoạn không còn "Chỉ định phụ kiện"/"Giao vải". Với đơn hàng CHƯA có Phiếu xuất kho vải, chọn công đoạn Cắt phải thấy cảnh báo (không phải form nhập liệu) và bấm "Gửi" phải bị từ chối nếu cố tình gửi. Xuất kho vải cho đơn hàng đó xong, quay lại Cắt phải chọn được cây vải qua ô "gõ tìm" (không còn tự hiện sẵn). Với đơn hàng có ≥ 2 sơ đồ, đổi qua lại giữa các sơ đồ trong ô chọn, nhập dữ liệu ở nhiều sơ đồ rồi bấm "Gửi" 1 lần — kiểm tra tất cả sơ đồ đều được lưu (không mất dữ liệu sơ đồ không đang hiện). Ở Báo giá Aloha, bấm "Xem/In" ra đúng thông tin, bấm "In" ra bản in xem được; xuất Excel 1 báo giá có mã hàng đã có ảnh đại diện, mở bằng Excel/LibreOffice kiểm tra cột "Hình ảnh sp" có ảnh thật.

---

## BƯỚC 2.24 — Vá lỗi v5.18 → v5.18.1: ảnh đại diện không nhúng được vào Excel Báo giá Aloha

**Triệu chứng thực tế đã xảy ra**: sau khi triển khai đủ v5.18 (copy code + `npm install` cho `sharp` + `pm2 restart`), xuất Excel 1 báo giá có mã hàng đã có ảnh đại diện — cột "Hình ảnh sp" **vẫn trống**, không có lỗi/crash nào hiện ra.

**Nguyên nhân gốc (lỗi thật trong code, không phải do triển khai thiếu bước nào)**: giả định ban đầu về định dạng lưu trữ của `TheKhoHangHoa.AnhDaiDien` — "luôn là 1 chuỗi data URL (`data:image/...;base64,...`)" — là **SAI**. Giả định này được suy ra từ cách HIỂN THỊ ảnh ở frontend (`<img src="${AnhDaiDien}">`) — nhưng cả 2 dạng dữ liệu (chuỗi data URL và đường dẫn tương đối tới file) đều hiển thị đúng y hệt nhau qua `<img src>`, nên không thể phân biệt chỉ bằng cách đọc màn hình hiển thị — phải truy ngược đúng luồng GHI mới thấy rõ. Truy lại luồng ghi (`module.khohang.js` gọi `uploadFile()` → `common.js` POST multipart tới `/api/upload` → `backend/routes/upload.js` dùng `multer` lưu file THẬT xuống đĩa tại `backend/uploads/` và chỉ trả về `data.url = "/uploads/<tên file>"`) mới xác nhận: **`AnhDaiDien` là 1 đường dẫn tương đối tới file trên đĩa, không phải chuỗi ảnh nhúng sẵn**. Với giả định sai, hàm `anhToPngBuffer()` không khớp được biểu thức chính quy của data URL, rơi vào nhánh "coi như chuỗi base64 thuần" và giải mã base64 NGUYÊN VĂN chuỗi `"/uploads/xxx.jpg"` — ra dữ liệu rác — `sharp()` luôn báo lỗi — bị khối `try/catch` (vốn thiết kế để 1 ảnh lỗi không làm hỏng cả file) bắt và bỏ qua trong im lặng cho **mọi ảnh, mọi lần** — đúng khớp triệu chứng đã gặp.

**Đã sửa**: `anhToPngBuffer()` trong `backend/routes/khohang.js` nay đọc đúng: nếu giá trị bắt đầu bằng `/uploads/`, đọc file thật từ `backend/uploads/<tên file>` (dùng `path.basename()` để chặn path traversal, không cho chuỗi dữ liệu đọc file ngoài ý muốn) rồi mới đưa qua `sharp` chuẩn hóa như thiết kế ban đầu. Nhánh xử lý chuỗi data URL vẫn được giữ lại làm dự phòng (không dùng trong thực tế hiện tại, nhưng vô hại nếu giữ).

**Triển khai**: **không có migration, không có thư viện mới** — chỉ thay `backend/routes/khohang.js` bằng bản mới nhất rồi `pm2 restart qlnoibo` (không cần `npm install` lại).

**Kiểm tra sau khi vá**: xuất Excel 1 báo giá có ít nhất 1 mã hàng đã có ảnh đại diện (đúng mã hàng đã dùng để test trước đó) — mở file, cột "Hình ảnh sp" phải có ảnh thật. Thử thêm với 1 mã hàng KHÔNG có ảnh đại diện — ô đó vẫn trống bình thường (không lỗi).

---

## BƯỚC 2.25 — Nâng cấp từ v5.18/v5.18.1 lên v5.19 (bỏ qua nếu cài mới)

Đợt lớn, nhiều mục, trải khắp 3 phân hệ (Quản lý sản xuất / Thẻ kho hàng hóa / Kho vải) + 2 yêu cầu xuyên suốt toàn hệ thống. Tóm tắt theo đúng thứ tự yêu cầu gốc:

**1.1.1 — Nhà gia công chi tiết (Kỹ thuật) — thêm Đơn giá**: mỗi dòng "Nhà gia công chi tiết" (Ghi nhận tiến độ → Kỹ thuật, cho phép khai nhiều nhà gia công 1 lúc) nay có thêm ô **Đơn giá** (tùy chọn, không bắt buộc) — dùng làm giá tham chiếu để tính lương/thanh toán sau này. Không ảnh hưởng đến ô chọn "Nhà gia công" chính (`ktNhaGiaCong`, vẫn là nguồn duy nhất quyết định bỏ qua công đoạn May).

**1.1.2 — Giao nhà gia công / Nhận nhà gia công (2 chức năng con MỚI)**: **quyết định thiết kế quan trọng cần biết** — màn hình "Giao/nhận nhà gia công" CŨ (nút 🚚 trong Danh sách lệnh sản xuất, `openVendorForm`) **được GIỮ NGUYÊN, không xóa/không đổi** — nó vẫn là nơi duy nhất set `DonHangSanXuat.NhaGiaCongID`/`NgayGiaoGC`/`NgayNhanGC` (nguồn duy nhất quyết định bỏ qua công đoạn May, xem `tinhNextStage()`). 2 chức năng con MỚI ("Giao nhà gia công", "Nhận nhà gia công", 2 tab riêng trong menu Quản lý sản xuất) là **sổ ghi chép bổ sung** (nhiều lần giao/nhận, mỗi lần có Số lượng + Đơn giá + Ghi chú + Ngày), gắn theo TỪNG dòng "Nhà gia công chi tiết" (mục 1.1.1) — dùng khi 1 đơn có NHIỀU nhà gia công cần tách riêng số lượng/đơn giá để tính lương, đúng ngữ cảnh mục 1.1.1 vừa thêm Đơn giá. Đơn giá của mỗi lần giao/nhận **mặc định lấy từ** Đơn giá đã khai ở "Nhà gia công chi tiết" nhưng **sửa được riêng** cho từng lần. Đã thêm 2 dòng `ChucNang` mới (`giaonhagiacong`, `nhannhagiacong`) — ẩn/hiện qua Ma trận phân quyền như mọi tab khác.

**1.2 — Sửa lỗi đơn vị "Tổng cộng" ở In lệnh sản xuất + bỏ mục thừa**: bảng "Cấu trúc vải" trên phiếu in trước đây tính sai (`SL × Hệ số quy đổi` ra 1 con số quy đổi liên tục, không đúng cách đọc "N Ri dư M" đã dùng ở nơi khác trong hệ thống) — nay dùng đúng công thức chia lấy thương/dư (`fmtDualUnit()`, chuyển từ `module.khohang.js` sang `common.js` để dùng chung), ra định dạng đúng ví dụ yêu cầu (`"25 Cái (5 Ri5)"` kiểu). Đã bỏ mục **"Số lượng"** thừa hiển thị riêng bên dưới bảng (trùng với hàng Tổng cộng đã có).

**1.3 — Sửa cùng lỗi định dạng ở Ra lệnh sản xuất (Tạo mới + Sửa)**: hàng "Tổng cộng" trên màn hình (không phải bản in) dùng cùng công thức sai — đã sửa dùng chung `fmtDualUnit()`. Vị trí hàng Tổng cộng (ngay dưới bảng cấu trúc vải, cạnh cột số lượng từng màu) **đã đúng vị trí yêu cầu từ trước** (không cần di chuyển) — chỉ định dạng số bị sai, nay đã sửa.

**1.4 — Chỉ định vải SX (chức năng con MỚI)**: tái sử dụng CHÍNH bảng cấu trúc vải đã khai ở Ra lệnh sản xuất (`DonHangChiTietVai`, không tạo danh mục riêng) — thêm 2 cột mới (ĐVT vải yêu cầu, Số KG yêu cầu) cho từng dòng Loại vải/Màu, tách riêng Vải chính/Vải phối. Màn hình mới liệt kê tất cả đơn hàng, bấm "Chỉ định" mở form nhập KG yêu cầu theo từng dòng, có 2 hàng Tổng cộng cuối bảng (Vải chính riêng, Vải phối riêng) như yêu cầu. Đã thêm `ChucNang` mới (`chidinhvaisx`).

**2.1 — Báo giá Aloha — thêm chức năng Sửa**: nút "Sửa" mới cạnh "Xem/In" trong Danh sách báo giá — mở lại đúng form Tạo với dữ liệu cũ điền sẵn (kể cả các mã hàng đã chọn, dù mã hàng chỉ được phép thuộc 1 báo giá duy nhất trong toàn hệ thống — endpoint `GET /baogia/candidates` được bổ sung tham số `excludeBaoGiaId` để không "giấu" nhầm các mã hàng đang thuộc chính báo giá đang sửa). Lưu qua `PUT /baogia/:id` (thay header + toàn bộ chi tiết, cùng cơ chế transaction như Tạo mới).

**2.2 — Excel: ảnh đại diện co giãn theo kích thước ô**: đã xác nhận qua đọc mã nguồn `exceljs` (thư viện cài trong dự án) rằng thiếu tham số `editAs` sẽ tự mặc định thành `'oneCell'` (ảnh CHỈ di chuyển theo ô, KHÔNG co giãn khi đổi cỡ cột/hàng) — dù tài liệu README của chính `exceljs` gọi đây là "mặc định" nhưng đó là mặc định RIÊNG của thư viện này, khác mặc định `twoCell` của chuẩn OOXML gốc. Đã sửa: truyền thẳng `editAs: 'twoCell'` khi nhúng ảnh — đã kiểm thử độc lập trong sandbox (tạo file thật, giải nén, đọc XML `xl/drawings/drawing1.xml`) xác nhận thuộc tính `editAs="twoCell"` được ghi đúng.

**3.1 — Phiếu xuất kho vải — hiển thị tham khảo theo Chỉ định vải SX**: khi lập phiếu xuất kho vải VÀ chọn gắn theo 1 đơn hàng cụ thể, màn hình hiện thêm 1 dòng thông tin tham khảo: tổng KG yêu cầu (Vải chính / Vải phối riêng, lấy từ mục 1.4) + tổng KG đã xuất thực tế cho đơn đó — CHỈ để tham khảo, không chặn/khóa việc xuất kho.

**Phát hiện phụ (không thuộc yêu cầu lần này, chỉ để lưu ý)**: màn hình Phiếu xuất kho vải vẫn đang dựa vào cơ chế "Giao vải" cũ (`GiaoVaiSanXuat`) để xác định "cây vải được phép xuất" cho 1 đơn hàng — cơ chế này đã **không còn đường nhập liệu mới** kể từ v5.18 (công đoạn "Giao vải" đã bị bỏ khỏi luồng Ghi nhận tiến độ). Nghĩa là với đơn hàng tạo SAU v5.18, màn hình này nhiều khả năng sẽ báo "chưa được giao vải sản xuất" dù thực tế đơn hàng hoàn toàn hợp lệ. Đây là một khoảng trống thiết kế còn sót lại từ đợt v5.18 (không phải lỗi mới của v5.19) — không thuộc phạm vi yêu cầu lần này nên **chưa sửa**, nhưng nên đưa vào đợt kế tiếp vì sẽ ảnh hưởng thao tác Xuất kho vải thực tế.

**4 — Excel export cho mọi màn hình Thẻ kho / Tồn kho**: thêm nút "⬇️ Xuất Excel" (dùng `exceljs`, xuất đơn giản — không phải file mẫu có định dạng phức tạp như Báo giá Aloha) cho: Kho vải → Tồn kho (tổng hợp theo mã vải), Kho vải → Tồn theo cây (Thẻ kho vải cây), Thẻ kho hàng hóa → Thẻ kho/Tồn kho, Phụ kiện → Thẻ kho/Tồn kho. Báo giá Aloha đã có Xuất Excel từ v5.17 nên không đổi.

**5 — Cột "Số phiếu" cho mọi phiếu nhập/xuất kho**: thêm cột **Số phiếu** (định dạng `NK-00001`/`XK-00001` cho Kho vải, `NPK-00001`/`XPK-00001` cho Phụ kiện — số ghép từ khóa chính IDENTITY sẵn có, đã tự tăng dần từ trước, chỉ hiển thị thêm dạng có tiền tố dễ đọc) vào Danh sách phiếu nhập kho vải, Danh sách phiếu xuất kho vải, Danh sách phiếu nhập phụ kiện, Danh sách phiếu xuất phụ kiện.

**Migration**: `database/migration_v519.sql` — thêm cột `DonHangChiTietNhaGiaCong.DonGia`; 2 bảng mới `GiaoNhaGiaCongChiTiet`/`NhanNhaGiaCongChiTiet`; thêm cột `DonHangChiTietVai.DVTVaiYeuCau`/`SoKGYeuCau`; seed 3 dòng `ChucNang` mới (`giaonhagiacong`/`nhannhagiacong`/`chidinhvaisx` thuộc QLSX). Idempotent — chạy lại nhiều lần an toàn. **Yêu cầu tiên quyết**: đã chạy `migration_v513.sql` (tạo `DonHangChiTietNhaGiaCong`) và `migration_v5_chucnang.sql` (tạo bảng `ChucNang`) từ trước — script sẽ báo lỗi và dừng nếu thiếu. **Không có thư viện mới** (vẫn dùng `exceljs`/`sharp` đã có từ v5.17/v5.18).

**Lưu ý kiểm thử**: đã đọc lại toàn bộ vùng code mới/sửa bằng Read tool (không dùng `node --check`/`wc -l` qua terminal làm căn cứ — hiện tượng mount/cache cũ lại tái diễn ở đợt này, terminal báo sai lệch dòng/nội dung dù file thật đã đúng, đã xác nhận bằng cách đọc trực tiếp phần đầu/cuối từng file). Riêng phần `editAs: 'twoCell'` đã kiểm thử thực tế trong sandbox độc lập (cài `exceljs`+`sharp` riêng, tạo file `.xlsx`, giải nén, đọc XML xác nhận thuộc tính đúng). **Chưa** chạy migration trên SQL Server thật, **chưa** bấm thử trên trình duyệt thật bất kỳ màn hình nào trong đợt này — kiểm tra kỹ theo trình tự sau khi triển khai:

1. Backup database, chạy `database/migration_v519.sql` trong SSMS (Execute/F5).
2. Thay `backend/routes/qlsx.js`, `backend/routes/khohang.js`, `backend/routes/khovai.js`, `backend/routes/phukien.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khohang.js`, `frontend/js/module.khovai.js`, `frontend/js/module.phukien.js`, `frontend/js/common.js` bằng bản v5.19. Không cần `npm install` (không có thư viện mới).
3. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
4. Vào Ma trận phân quyền, cấp quyền Xem/Sửa cho 3 chức năng mới (Giao nhà gia công, Nhận nhà gia công, Chỉ định vải SX) cho các nhóm cần dùng — mặc định mọi nhóm đều thấy được (an toàn) cho tới khi Admin chủ động giới hạn.
5. Ghi nhận tiến độ Kỹ thuật 1 đơn hàng, thêm Nhà gia công chi tiết kèm Đơn giá — lưu, kiểm tra Đơn giá hiển thị đúng khi mở lại.
6. Vào tab "Giao nhà gia công" — chọn 1 dòng, ghi nhận 1 lần giao (Ngày/SL/Đơn giá — kiểm tra Đơn giá tự điền từ bước 5, sửa lại được), lưu, mở lại xem đúng trong bảng lịch sử; thử Xóa 1 dòng. Lặp lại tương tự cho tab "Nhận nhà gia công".
7. In lệnh sản xuất 1 đơn có cấu trúc vải — kiểm tra hàng "Tổng cộng" hiện đúng dạng "N Cái (M Ri...)" (không còn phép nhân sai), không còn mục "Số lượng" thừa bên dưới. Mở Ra lệnh sản xuất (Tạo mới và Sửa) — kiểm tra Tổng cộng hiển thị đúng định dạng tương tự, cập nhật khi đổi Số lượng hoặc Đơn vị.
8. Vào tab "Chỉ định vải SX", bấm "Chỉ định" 1 đơn có cấu trúc vải — nhập Số KG yêu cầu cho vài dòng, lưu, mở lại xác nhận đúng; kiểm tra 2 hàng Tổng cộng (Chính/Phối) cộng đúng.
9. Kho vải → Xuất kho → chọn 1 đơn hàng đã Chỉ định vải SX ở bước 8 — kiểm tra dòng tham khảo KG yêu cầu/đã xuất hiện đúng phía trên danh sách cây vải.
10. Xuất Excel thử cả 4 màn hình mới có nút (Tồn kho vải, Tồn theo cây, Thẻ kho hàng hóa, Tồn kho phụ kiện) — mở file kiểm tra dữ liệu đúng, không lỗi.
11. Xuất Excel 1 báo giá Aloha có ảnh đại diện — mở file, kéo giãn/thu nhỏ cột "Hình ảnh sp", kiểm tra ảnh co giãn theo (khác trước đây chỉ di chuyển, không co giãn).
12. Bấm "Sửa" 1 báo giá Aloha đã tạo — kiểm tra header + danh sách mã hàng đã chọn hiện đúng, thêm/bớt mã hàng rồi lưu, kiểm tra không bị lỗi trùng mã hàng (đặc biệt với chính mã hàng đã thuộc báo giá đang sửa).
13. Kiểm tra cột "Số phiếu" hiện đúng (dạng NK-00001/XK-00001/NPK-00001/XPK-00001) trên cả 4 danh sách phiếu nhập/xuất kho vải/phụ kiện.

---

## BƯỚC 2.26 — Nâng cấp từ v5.19 lên v5.20 (bỏ qua nếu cài mới)

Đợt lớn nhất từ trước tới nay — **định nghĩa lại toàn bộ luồng "Ghi nhận tiến độ sản xuất"** theo yêu cầu gốc:

> Ra lệnh sản xuất → Tài liệu kỹ thuật → Kỹ Thuật → Chỉ định vải sx → Xuất vải → Cắt → Chỉ định phụ kiện → Xuất phụ kiện → Giao nhà in thêu → Nhận nhà in thêu → Giao nhà gia công → Nhận nhà gia công → May → Nhặt chỉ → QC → Là → Đóng gói → Kho Nhập.

**Quyết định thiết kế quan trọng nhất (đọc trước khi triển khai)**: không phải toàn bộ 18 bước trên đều trở thành 1 "công đoạn" (StageID) riêng cần bấm "Ghi tiến độ" thủ công. Các bước đã có sẵn màn hình/cơ chế riêng vẫn giữ nguyên màn hình đó, chỉ được **thừa nhận** trong luồng tổng thể thay vì tạo trùng lặp:

- **Ra lệnh sản xuất**: điểm bắt đầu, không phải công đoạn.
- **Tài liệu kỹ thuật**: chức năng riêng có sẵn từ v5.14 (menu riêng), không đổi.
- **Chỉ định vải SX**: chức năng riêng có sẵn từ v5.19 (menu riêng) — từ bản này **còn là nguồn dữ liệu chính** cho "Xuất vải" (xem mục 4/4.1 dưới).
- **Xuất vải**: chính là Phiếu xuất kho vải (Kho vải) — đã là điều kiện bắt buộc trước "Cắt" từ v5.18, không đổi.
- **Chỉ định phụ kiện**: chính là khối "Phụ kiện cần dùng (NPL)" đã có sẵn ở Ra lệnh sản xuất — không đổi.
- **Xuất phụ kiện**: chính là Phiếu xuất phụ kiện (phân hệ Phụ kiện) — không đổi.

4 công đoạn THẬT SỰ mới được thêm vào danh mục Công đoạn sản xuất (có StageID riêng, hiện trong Ghi nhận tiến độ và trong danh sách "công đoạn được phép cập nhật" khi phân quyền user — Bước 9): **Giao nhà in thêu**, **Nhận nhà in thêu**, **Giao nhà gia công**, **Nhận nhà gia công**. Cả 4 đều **tự động bỏ qua** cho đơn hàng không cần dùng đến — hệ thống không bắt nhân viên phải bấm qua các bước này nếu không có nhu cầu thật:
- "Giao/Nhận nhà in thêu" chỉ bắt buộc khi đơn hàng **có chọn nhà in/thêu** (khai ngay ở công đoạn "Kỹ thuật" — thêm 1 ô chọn mới cạnh ô chọn nhà gia công đã có).
- "Giao/Nhận nhà gia công" chỉ bắt buộc khi đơn hàng **đã giao cho 1 nhà gia công khác "Nhà Làm"** (đúng điều kiện đã dùng để bỏ qua công đoạn May từ v5.0 — nếu là "Nhà Làm" hoặc chưa giao ai, đơn đi thẳng qua May như bình thường, không phải dừng ở 2 công đoạn này).

3 công đoạn mới khác, đơn giản (dùng chung 1 form "Số lượng lũy kế theo màu" như "Hoàn thiện" cũ, không cần màn hình riêng): **Nhặt chỉ**, **QC**, **Là** — chèn giữa May và Đóng gói.

**"Hoàn thiện" (HT)** — công đoạn hệ thống gốc — **không còn trong danh sách người dùng liệt kê** nên được đưa vào diện bỏ qua không điều kiện (giống "Giao vải"/"Chỉ định phụ kiện" đã bỏ qua từ v5.18) — **KHÔNG xóa** dòng này khỏi danh mục (giữ nguyên dữ liệu lịch sử Ghi nhận tiến độ cũ), chỉ không còn là điểm dừng của đơn hàng MỚI. Đơn hàng nào đang đứng ở "Hoàn thiện" tại thời điểm nâng cấp sẽ được chuyển sang "Nhặt chỉ" (công đoạn kế tiếp thực sự trong danh mục mới).

**"Đóng gói" chuyển ra TRƯỚC "Kho nhập"** (đổi thứ tự so với trước — trước đây Kho nhập đứng trước Đóng gói) — đúng thứ tự yêu cầu "...Đóng gói → Kho Nhập". Đơn hàng đang đứng ở "Kho nhập" tại thời điểm nâng cấp: lần ghi nhận tiến độ tiếp theo tại đúng công đoạn này sẽ được xem là **Hoàn thành** (vì Kho nhập nay là công đoạn cuối cùng) thay vì tự chuyển tiếp sang Đóng gói như trước — nếu đơn đó thực tế còn cần đóng gói, người phụ trách cần chọn công đoạn "Đóng gói" trong Ghi nhận tiến độ trước khi ghi Kho nhập.

**Mục 2 (tách "Giao/nhận nhà in thêu" thành chức năng riêng, cập nhật phân quyền)**: được thỏa mãn **hoàn toàn miễn phí** nhờ mục 1 ở trên — vì "Giao nhà in thêu"/"Nhận nhà in thêu" nay là 2 công đoạn thật trong danh mục, cơ chế phân quyền theo công đoạn đã có sẵn từ trước (tick chọn "công đoạn được phép cập nhật" khi Sửa 1 tài khoản, xem Bước 9) tự động áp dụng được cho 2 công đoạn mới này — **không cần thêm tab/chức năng con/dòng ChucNang nào**. Muốn 1 nhân viên chỉ phụ trách riêng "Giao nhà in thêu" (khác người phụ trách "Nhận nhà in thêu"), chỉ cần tick đúng công đoạn tương ứng cho từng người.

**Mục 3 (xóa chức năng Giao/nhận nhà gia công + in thêu trong Danh sách lệnh sản xuất)**: đã xóa hẳn nút 🚚 "Giao/nhận nhà gia công" và màn hình modal cũ (`openVendorForm`) khỏi Danh sách lệnh sản xuất, cùng route backend `POST /orders/:maDH/vendor` đứng sau nó. 4 cột dữ liệu cũ (`NhaGiaCongID`/`NgayGiaoGC`/`NgayNhanGC`/`NhaInID`/`NgayGiaoIn`/`NgayNhanIn`) **không đổi schema** — nay được ghi trực tiếp qua chính Ghi nhận tiến độ tại đúng công đoạn tương ứng (Kỹ thuật ghi `NhaGiaCongID`/`NhaInID` sớm; Giao/Nhận nhà in thêu và Giao/Nhận nhà gia công ghi ngày giao/ngày nhận) thay vì 1 form tự do tách biệt.

**Mục 4/4.1 (bỏ điều kiện chặn "chưa được giao vải sản xuất"; lấy thông tin vải từ Chỉ định vải SX)**: đây chính xác là khoảng trống đã phát hiện nhưng chưa sửa ở v5.19 (mục 3.1 phụ). Đã xóa hẳn thông báo chặn cũ nhắc đến công đoạn "Giao vải" (không còn tồn tại trong luồng từ v5.18); màn hình Phiếu xuất kho vải (Kho vải → Xuất kho vải) nay xác định "cây vải được phép xuất" cho 1 đơn hàng bằng cách khớp trực tiếp **Loại vải + Màu** đã khai ở Cấu trúc vải/Chỉ định vải SX của đơn đó với tồn kho cây vải hiện có (không còn phụ thuộc cơ chế "Giao vải" (`GiaoVaiSanXuat`) cũ đã mất đường nhập liệu từ v5.18). Bảng `GiaoVaiSanXuat` **không bị xóa** (vẫn còn dữ liệu lịch sử, vẫn được các kiểm tra "đã phát sinh giao dịch" ở Nhập kho vải tham chiếu) — chỉ không còn là cơ chế xác định cây vải cho phép xuất nữa.

**Migration**: `database/migration_v520.sql` — không tạo bảng/cột mới (dùng lại 100% cột đã có sẵn trên `DonHangSanXuat`) — chỉ đánh số lại `ThuTu` các công đoạn hệ thống hiện có (giãn cách 10 đơn vị, không đổi StageID) + thêm 7 dòng `CongDoanSanXuat` mới (GNIT/NNIT/GNGC/NNGC/NCH/QC/LA) + chuyển đơn hàng đang đứng ở "Hoàn thiện" sang "Nhặt chỉ". Idempotent. **Yêu cầu tiên quyết**: đã chạy `migration_v59.sql` và `migration_v518.sql` từ trước.

**Lưu ý kiểm thử**: đã đọc lại toàn bộ vùng code mới/sửa bằng Read tool (không dùng terminal/`node --check`/`wc -l` làm căn cứ cuối cùng — hiện tượng mount/cache cũ tái diễn lần nữa ở đợt này). **Chưa** chạy migration trên SQL Server thật, **chưa** bấm thử trên trình duyệt thật bất kỳ màn hình nào trong đợt này — đây là đợt thay đổi sâu nhất vào luồng lõi (công đoạn/tiến độ) từ trước tới nay, **khuyến nghị mạnh** nên thử trên môi trường test/bản sao database trước khi áp dụng lên dữ liệu thật. Kiểm tra kỹ theo trình tự sau khi triển khai:

1. Backup database (bắt buộc — đợt này đổi cấu trúc luồng công đoạn), chạy `database/migration_v520.sql` trong SSMS (Execute/F5), đọc kỹ các dòng PRINT để xác nhận không có RAISERROR.
2. Thay `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khovai.js` bằng bản v5.20. Không cần `npm install`.
3. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
4. Danh mục → Công đoạn sản xuất: kiểm tra thứ tự mới hiện đúng (Kỹ thuật, Cắt, Giao nhà in thêu, Nhận nhà in thêu, Giao nhà gia công, Nhận nhà gia công, May, Nhặt chỉ, QC, Là, Đóng gói, Kho nhập) — "Giao vải"/"Chỉ định phụ kiện"/"Hoàn thiện" vẫn còn trong danh mục nhưng nằm cuối danh sách (không ảnh hưởng).
5. Vào Ma trận phân quyền / Quản lý User → Sửa 1 tài khoản: xác nhận 4 công đoạn mới (Giao/Nhận nhà in thêu, Giao/Nhận nhà gia công) đã hiện trong danh sách "công đoạn được phép cập nhật" để phân công đúng người.
6. Tạo 1 đơn hàng mới, KHÔNG chọn nhà gia công/nhà in ở Kỹ thuật — ghi nhận tiến độ lần lượt: Kỹ thuật → Cắt (cần Phiếu xuất kho vải trước, xem bước 8) → xác nhận hệ thống **tự động nhảy thẳng qua May** (bỏ qua cả 4 công đoạn GNIT/NNIT/GNGC/NNGC vì đơn không dùng dịch vụ nào) → May → Nhặt chỉ → QC → Là → Đóng gói → Kho nhập (Hoàn thành).
7. Tạo 1 đơn khác, ở Kỹ thuật chọn cả "Nhà gia công" (khác "Nhà Làm") lẫn "Nhà in/thêu" — ghi nhận tiến độ qua Cắt — xác nhận lần lượt hiện đủ 4 công đoạn Giao nhà in thêu/Nhận nhà in thêu/Giao nhà gia công/Nhận nhà gia công (mỗi công đoạn cho nhập Ngày giao hoặc Ngày nhận) — xác nhận sau "Nhận nhà gia công" đơn nhảy thẳng qua May sang "Nhặt chỉ" (không dừng ở May, giữ đúng quy ước từ v5.0).
8. Kho vải → Xuất kho vải → chọn đơn hàng ở bước 6/7 (đã khai Cấu trúc vải ở Ra lệnh sản xuất) — xác nhận hiện đúng danh sách cây vải cùng Loại vải/Màu, không còn thông báo "chưa được giao vải sản xuất".
9. Với 1 đơn hàng CŨ (tạo trước khi nâng cấp) đang đứng ở "Hoàn thiện" hoặc "Kho nhập" trước migration — xác nhận sau migration đã tự chuyển đúng theo mô tả ở mục "Hoàn thiện"/"Đóng gói" phía trên.
10. Xác nhận nút 🚚 "Giao/nhận nhà gia công" đã biến mất khỏi Danh sách lệnh sản xuất.

---

## BƯỚC 2.27 — Nâng cấp từ v5.20 lên v5.21 (bỏ qua nếu cài mới)

Đợt sửa/tinh chỉnh lại 1 phần của v5.20, theo 8 mục yêu cầu:

**Mục 1 (Danh mục "Đơn vị quy đổi")**: bảng mới `DanhMucDonViQuyDoi` — mỗi dòng là 1 **cặp** đơn vị (Đơn vị chính → Đơn vị quy đổi, Phép tính Nhân/Chia, Hệ số), cho phép khai báo **nhiều cặp** cùng lúc. Quản lý qua Danh mục (tab mới "Đơn vị quy đổi"), dùng chung cơ chế CRUD sẵn có.

**Mục 2 (dòng "Tổng cộng" ở Cấu trúc vải)**: sửa lại đúng bản chất — dòng này trước đây luôn CHIA (`fmtDualUnit()`, vốn dùng cho Thẻ kho hàng hóa), nay đổi sang hàm mới `fmtQuyDoi()` NHÂN hoặc CHIA tuỳ Phép tính đã chọn ở "Đơn vị quy đổi". Cột mới `DonHangSanXuat.DonViQuyDoiID` chỉ dùng để định dạng hiển thị; `HeSoQuyDoi` (đã có từ v5.13) vẫn là số thật dùng cho tính toán ở Cắt.

**Mục 3 (Kỹ thuật — tách bạch "Giao nhà làm"/"Giao gia công")**: thêm 1 ô chọn tường minh (radio) tại công đoạn Kỹ thuật — cột mới `DonHangSanXuat.KenhSanXuat` (`NhaLam`/`GiaCong`), tách khỏi việc chọn nhà gia công cụ thể. "Nhận nhà gia công" chỉ liệt kê nhà đã thực sự được giao việc (mục 5).

**Mục 6 (Phiếu xuất kho vải)**: đơn hàng phải đã khai Chỉ định vải SX mới hiện trong danh sách chọn; hiển thị số lượng chỉ định riêng từng màu; in phiếu lấy cột "Kg chỉ định" đúng từ Chỉ định vải SX.

**Mục 7 (Tổng SL cắt cộng sai)**: sửa lỗi chỉ cộng tổng của 1 bàn cắt thay vì tất cả các bàn cho đơn hàng ≥ 2 sơ đồ.

**Mục 8 (Giao/Nhận nhà in thêu tách riêng)**: 2 công đoạn này không còn là công đoạn thật trong Ghi nhận tiến độ — thay bằng 2 chức năng độc lập, tab riêng trong Quản lý sản xuất, có phân quyền riêng (`giaonhaintheu`/`nhannhaintheu`).

**Bảng/cột mới**: `DanhMucDonViQuyDoi`; `DonHangSanXuat.DonViQuyDoiID`, `DonHangSanXuat.KenhSanXuat`. **ChucNang mới** (QLSX): `giaonhaintheu`, `nhannhaintheu`.

**Migration**: `database/migration_v521.sql`. **Lưu ý**: xem thêm BƯỚC 2.28 ngay dưới đây — v5.22 sửa tiếp phần "Giao/Nhận nhà gia công" của đợt này, nên khuyến nghị nâng cấp thẳng lên v5.22, không dừng ở v5.21.

---

## BƯỚC 2.28 — Nâng cấp từ v5.21 lên v5.22 (bỏ qua nếu cài mới)

Đợt sửa/tinh chỉnh tiếp theo, theo 4 mục yêu cầu (đều thuộc "Quản lý sản xuất"):

**Mục 1.1 (xóa Giao/Nhận nhà in thêu, Giao/Nhận nhà gia công khỏi Ghi nhận tiến độ)**: "Giao/Nhận nhà in thêu" đã tách riêng từ v5.21. Đợt này áp dụng **đúng cách đó** cho "Giao nhà gia công"/"Nhận nhà gia công" (GNGC/NNGC) — 2 công đoạn này **không còn** là công đoạn thật trong `CongDoanSanXuat`/Ghi nhận tiến độ nữa (đã bị xóa khỏi `migration_v520.sql`, an toàn vì migration đó chưa từng triển khai). Việc giao/nhận nhà gia công vốn đã có sẵn 1 cơ chế riêng, đầy đủ hơn nhiều từ v5.19 (nhiều nhà gia công, nhiều lần giao/nhận, giá/số lượng riêng từng lần) qua 2 tab độc lập "Giao nhà gia công"/"Nhận nhà gia công" — không cần thêm ChucNang mới (đã có từ v5.19).

**Mục 1.2 (đơn "Giao gia công" không hiện ở Ghi nhận tiến độ Công đoạn May)**: hệ thống đã tự động bỏ qua "May" cho đơn Giao gia công từ v5.0 (đơn nhảy thẳng qua công đoạn tiếp theo). Đợt này còn ẩn hẳn "May" khỏi chính ô chọn công đoạn trong form Ghi nhận tiến độ khi đơn ở kênh "Giao gia công" — không ai có thể chọn thủ công "May" cho đơn này nữa.

**Mục 1.3 (1 công đoạn may có thể giao nhiều nhân viên)**: đã có sẵn từ trước (khối "Nhân viên & SL" ở công đoạn May cho phép bấm "+ NV" thêm nhiều dòng nhân viên/số lượng cho cùng 1 công đoạn may) — không cần sửa gì, xác nhận vẫn hoạt động đúng sau đợt này (chỉ những đơn "Nhà Làm" mới vào được màn hình này, theo đúng mục 1.2).

**Mục 1.4 (Giao/Nhận nhà gia công: chọn lệnh sản xuất trước, rồi mới thêm nhà gia công)**: xây lại 2 tab theo mô hình danh sách-đơn-hàng-trước (giống Giao/Nhận nhà in thêu) — mở tab "Giao nhà gia công" hiện danh sách lệnh sản xuất (ở kênh "Giao gia công"), chọn 1 đơn mới hiện màn hình quản lý (thêm/sửa/xóa nhà gia công + ghi nhận từng lần giao). "Nhận nhà gia công" tương tự nhưng chỉ đọc (không thêm nhà gia công mới), chỉ hiện đơn đã có ít nhất 1 nhà gia công được giao.

**Không có bảng/cột mới** — toàn bộ đợt này dùng lại nguyên schema đã có từ v5.19/v5.21 (`DonHangChiTietNhaGiaCong`, `GiaoNhaGiaCongChiTiet`, `NhanNhaGiaCongChiTiet`, `KenhSanXuat`), chỉ đổi logic/giao diện. **Không có migration riêng** — chỉ cần đã chạy `migration_v521.sql` (bản đã sửa, không còn tạo GNGC/NNGC).

> **Lưu ý**: xem thêm BƯỚC 2.29 ngay dưới đây — v5.23 sửa lại **vị trí** của toggle "Kênh sản xuất"/nhà gia công đại diện mô tả ở mục 1.2 (chuyển từ Kỹ thuật sang 1 công đoạn thật mới "Giao gia công", đứng sau Cắt) theo đúng phản hồi của người dùng. Khuyến nghị nâng cấp thẳng lên v5.23, không dừng ở v5.22.

**Lưu ý kiểm thử**: đã đọc lại toàn bộ vùng code mới/sửa bằng Read tool. **Chưa** bấm thử trên trình duyệt thật màn hình nào trong đợt này. Kiểm tra theo trình tự:

1. Thay `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js` bằng bản v5.22 (đã bao gồm sửa của v5.21 — copy đè lên bản v5.21 nếu đang ở giữa chừng). Không cần `npm install`, không cần chạy migration mới (nếu đã chạy `migration_v521.sql`).
2. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
3. Quản lý sản xuất → xác nhận 2 tab "Giao nhà gia công"/"Nhận nhà gia công" nay hiện **danh sách lệnh sản xuất** (không phải danh sách nhà gia công phẳng như trước) — chọn 1 đơn để vào màn hình chi tiết.
4. Trong màn hình chi tiết "Giao nhà gia công": thêm 1 nhà gia công mới cho đơn hàng, sửa/xóa 1 dòng đã có, bấm "Ghi nhận" để mở màn hình ghi nhận từng lần giao — xác nhận nút "← Quay lại" đưa về đúng màn hình chi tiết (không đóng hẳn).
5. "Nhận nhà gia công" → xác nhận CHỈ hiện đơn đã có ít nhất 1 nhà gia công được giao, KHÔNG có nút thêm nhà gia công mới.
6. Ghi nhận tiến độ ở công đoạn Kỹ thuật: chọn "Giao gia công" — xác nhận công đoạn "May" KHÔNG còn xuất hiện trong ô chọn công đoạn của Ghi nhận tiến độ cho đơn này.
7. Với 1 đơn "Nhà làm": xác nhận vẫn ghi nhận tiến độ bình thường qua May, khối "Nhân viên & SL" vẫn cho thêm nhiều dòng nhân viên/số lượng cho cùng 1 công đoạn may.
8. In lệnh sản xuất (Lịch sử cập nhật tiến độ): xác nhận vẫn thấy các dòng "Giao nhà gia công"/"Nhận nhà gia công" đã ghi nhận (tổng hợp từ 2 tab độc lập, không còn là công đoạn thật nhưng vẫn hiện trong lịch sử).

---

## BƯỚC 2.29 — Nâng cấp từ v5.22 lên v5.23 (bỏ qua nếu cài mới)

Đợt sửa **đúng lại vị trí** của 1 quyết định trong luồng Ghi nhận tiến độ, theo phản hồi trực tiếp của người dùng sau khi dùng thử thiết kế v5.21/v5.22:

> *"Sau công đoạn cắt có công đoạn giao gia công. Khi đó sẽ chọn giao nhà làm hay giao gia công. Nếu giao gia công bên chức năng Giao gia công sẽ hiển thị lệnh sx như hiện tại. Nếu giao nhà làm thì chuyển sang công đoạn may trong ghi nhận tiến độ. Trong công đoạn may ở các công đoạn chi tiết có chọn giao cho nhân viên (1 công đoạn chọn nhiều nhân viên) số lượng, hiển thị đơn giá từ công đoạn kỹ thuật đã nhập."*

**Vấn đề với thiết kế v5.21**: toggle "Kênh sản xuất" (Giao nhà làm/Giao gia công) đặt tại công đoạn **Kỹ thuật** — đúng yêu cầu gốc lúc đó, nhưng người dùng phản hồi lại là **sai vị trí**: quyết định này phải là **1 công đoạn thật riêng**, đứng **ngay sau Cắt**, không phải một phần của Kỹ thuật.

**Thay đổi chính**:

- Thêm 1 công đoạn thật **mới** trong `CongDoanSanXuat`: **"Giao gia công"** (mã `GC`), đứng ngay sau **Cắt**, trước **May**. **Đây KHÔNG phải hồi sinh lại GNGC/NNGC** (ledger nhiều nhà gia công/nhiều lần giao-nhận của v5.19 vẫn giữ nguyên, vẫn qua đúng 2 tab độc lập "Giao/Nhận nhà gia công", không đổi) — "Giao gia công" ở đây **chỉ là 1 điểm quyết định kênh** (Nhà Làm/Gia công) + 1 nhà gia công đại diện/đơn giá tham khảo, đúng y hệt vai trò/giao diện mà Kỹ thuật từng đảm nhiệm ở v5.21, chỉ đổi **vị trí** trong luồng.
- **Kỹ thuật**: bỏ hẳn toggle Kênh sản xuất + chọn nhà gia công — từ nay chỉ còn Sơ đồ + chọn công đoạn may áp dụng cho đơn hàng (luôn ở dạng dùng cho "Nhà Làm", việc giao nhân viên/số lượng vẫn chỉ làm ở May như trước).
- **May**: bảng "Công đoạn may đã chọn" đổi từ **sửa được** (đơn giá/hệ số, thêm/xóa công đoạn — y hệt Kỹ thuật, từ v5.8.1) sang **chỉ đọc** — đơn giá/hệ số hiển thị **đúng những gì Kỹ thuật đã nhập/lưu**, không sửa lại được tại May nữa. Cột **"Nhân viên & SL"** (giao việc cho nhiều nhân viên/1 công đoạn may) **không đổi**, vẫn sửa được như trước.
- Đơn hàng đã từng mở Kỹ thuật và chọn kênh trước khi nâng cấp **không bị ảnh hưởng** — giá trị `KenhSanXuat`/nhà gia công đã lưu vẫn giữ nguyên, chỉ lần **chọn/sửa lại tiếp theo** mới thực hiện ở công đoạn "Giao gia công" thay vì Kỹ thuật.

**Không đổi schema** — dùng lại 100% cột đã có (`DonHangSanXuat.KenhSanXuat`/`NhaGiaCongID`/`DonGiaGiaCongNgoai` từ v5.5/v5.21), chỉ thêm **1 dòng danh mục** `CongDoanSanXuat` (mã `GC`, thứ tự 30 — giữa Cắt=20 và May=70, đúng chỗ trống để lại từ khi GNGC bị rút ở v5.22) và đổi **công đoạn nào được phép ghi** vào các cột đó.

**Migration**: `database/migration_v523.sql` (chỉ thêm 1 dòng `CongDoanSanXuat`, an toàn chạy lại nhiều lần). **Yêu cầu tiên quyết**: đã chạy `migration_v520.sql` (đã sửa qua các bản trước).

**Lưu ý kiểm thử**: đã đọc lại toàn bộ vùng code mới/sửa bằng Read tool, `node --check` qua cú pháp thành công cho cả 2 file backend/frontend. **Chưa** bấm thử trên trình duyệt thật màn hình nào trong đợt này. Kiểm tra theo trình tự:

1. Chạy `database/migration_v523.sql`.
2. Thay `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js` bằng bản v5.23. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
3. Danh mục → Công đoạn sản xuất: xác nhận thấy dòng mới **"Giao gia công"** (mã GC), nằm giữa Cắt và May theo đúng thứ tự.
4. Ghi nhận tiến độ 1 đơn hàng mới: xác nhận công đoạn **Kỹ thuật** chỉ còn Sơ đồ + chọn công đoạn may (không còn toggle Kênh sản xuất/chọn nhà gia công).
5. Ghi nhận tiến độ tiếp đến **Cắt**, rồi đến **Giao gia công**: xác nhận thấy toggle "Giao nhà làm"/"Giao gia công" + (khi chọn Giao gia công) ô chọn nhà gia công đại diện, Nhà gia công chi tiết, đơn giá gia công — đúng y hệt giao diện Kỹ thuật từng có ở v5.21.
6. Chọn **"Giao gia công"** ở bước trên → xác nhận đơn KHÔNG hiện công đoạn "May" trong ô chọn tiếp theo (nhảy thẳng qua, giống hành vi cũ); xác nhận đơn này hiện đúng trong tab "Giao nhà gia công".
7. Với 1 đơn khác chọn **"Giao nhà làm"** ở "Giao gia công" → xác nhận đơn **có** hiện công đoạn "May"; vào ghi nhận tiến độ May, xác nhận bảng "Công đoạn may đã chọn" hiện đúng đơn giá/hệ số đã nhập ở Kỹ thuật nhưng **không sửa được** (chỉ đọc), cột "Nhân viên & SL" vẫn thêm được nhiều nhân viên/số lượng cho cùng 1 công đoạn như trước.
8. In lệnh sản xuất: xác nhận lịch sử cập nhật tiến độ hiện đúng dòng "Giao gia công" (nay là công đoạn thật, đi qua đường ghi nhận tiến độ bình thường, không cần logic tổng hợp riêng như GNGC/NNGC cũ).

> **Lưu ý**: xem thêm BƯỚC 2.30 ngay dưới đây — v5.24 sửa tiếp thiết kế công đoạn "Giao gia công" (mục 6/7 ở trên), theo phản hồi "có những công đoạn trùng nhau" của người dùng: đổi toggle 1-chọn-1 (radio) thành 2 ô tick độc lập, bỏ hẳn "nhà gia công đại diện" + tab "Giao nhà gia công" riêng. Khuyến nghị nâng cấp thẳng lên v5.24, không dừng ở v5.23.

---

## BƯỚC 2.30 — Nâng cấp từ v5.23 lên v5.24 (bỏ qua nếu cài mới)

Đợt sửa tiếp công đoạn "Giao gia công" (v5.23), sau khi người dùng phản hồi trực tiếp rằng thiết kế v5.19–v5.23 đã tạo ra **nhiều nơi trùng nhau cho cùng 1 nghiệp vụ** (chọn kênh sản xuất, gán nhà gia công):

> *"Hãy kiểm tra kỹ và xử lý triệt để, bạn đang làm nhầm lẫn có những công đoạn trùng nhau... Công đoạn Giao gia công. Có thể chọn Giao nhà làm và giao gia công, tích chọn cả 2 hoặc 1 trong 2. Nếu chọn Giao gia công: bỏ phần Nhà gia công (đại diện...); Trường thêm nhà gia công thêm cột số lượng (để căn cứ tính lương sau này)... Bỏ chức năng Giao nhà gia công ở chức năng con... Nếu chọn Giao nhà làm thì hiển thị bảng công đoạn đã được nhập liệu ở công đoạn kỹ thuật... Trong nhận nhà gia công không hiện tổng đã nhận."*

**Thay đổi chính**:

- **Công đoạn "Giao gia công"**: đổi từ **radio** (chọn 1 trong 2 "Nhà làm"/"Gia công") sang **2 ô tick độc lập** "Giao nhà làm"/"Giao gia công" — có thể tick **cả hai** (đơn hàng chia một phần làm nội bộ, một phần thuê ngoài). Ô "Nhà gia công (đại diện)" + ô "Đơn giá gia công" riêng (của v5.21–v5.23) đã **bỏ hẳn**.
  - Tick **"Giao gia công"**: chỉ còn hiện **"Nhà gia công chi tiết"** (chọn từng nhà + đơn giá + **số lượng** — cột mới, dùng tính lương sau này) — đây là nơi **duy nhất** để gán nhà gia công, nhập ngay tại công đoạn này.
  - Tick **"Giao nhà làm"**: hiện **bảng tham khảo** các công đoạn may đã khai báo ở Kỹ thuật (tên/đơn giá/hệ số) — việc chọn **nhân viên & số lượng** vẫn **chỉ làm ở công đoạn May** như trước, không lặp lại ở đây (đã xác nhận lại với người dùng trước khi code).
- **Bỏ hẳn tab "Giao nhà gia công"** (chức năng con riêng trong Quản lý sản xuất, có từ v5.19) — việc giao nhà gia công giờ hoàn toàn làm tại công đoạn "Giao gia công" ở trên, không còn 2 nơi làm cùng 1 việc.
- **"Nhận nhà gia công"**: giữ lại nhưng viết lại thành **màn hình chỉ xem** — bỏ hẳn nút "Ghi nhận" và cột "Tổng đã nhận" (đúng yêu cầu "không hiện tổng đã nhận"). Chọn 1 lệnh sản xuất → xem đúng danh sách nhà gia công + số lượng đã gán ở công đoạn "Giao gia công", không sửa được ở đây.
- **Kỹ thuật**: thêm mục mới **"Đơn giá Giao gia công"** — danh mục nhiều dòng (hạng mục + đơn giá + hệ số), giao diện mirror y hệt "Đơn giá công đoạn may" đã có (thêm tab riêng "Đơn giá gia công" để khai báo danh mục chung). Đây là khai báo giá **tham khảo/kế hoạch** theo hạng mục công việc, **độc lập** với "Nhà gia công chi tiết" (chọn từng nhà cụ thể, nhập ở công đoạn "Giao gia công") — 2 cơ chế không liên kết với nhau.

**Đổi mô hình dữ liệu**: `DonHangSanXuat.KenhSanXuat` (chuỗi đơn giá trị 'NhaLam'/'GiaCong', thêm ở v5.21) **mồ côi** từ nay (không xóa cột, không còn nơi nào ghi/đọc) — thay bằng 2 cột BIT độc lập **`DaGiaoNhaLam`**/**`DaGiaoGiaCong`** (đã backfill 1 lần từ dữ liệu cũ). `GiaoNhaGiaCongChiTiet`/`NhanNhaGiaCongChiTiet` (bảng ghi chép nhiều-lần-giao-nhận của v5.19) cũng **mồ côi** — không còn tab nào dùng nữa.

**Bảng/cột mới**: `HangMucGiaCong` (danh mục "hạng mục gia công"), `DonHangHangMucGiaCong` (đơn giá riêng từng đơn hàng — mirror `CongDoanMay`/`DonHangCongDoanMay` đã có); `DonHangSanXuat.DaGiaoNhaLam`, `DonHangSanXuat.DaGiaoGiaCong`; `DonHangChiTietNhaGiaCong.SoLuong`. ChucNang mới: `dongiagiacong` (mirror `dongiamay`).

**Migration**: `database/migration_v524.sql` (an toàn chạy lại nhiều lần). **Yêu cầu tiên quyết**: đã chạy `migration_v513.sql`, `migration_v521.sql`, `migration_v523.sql` (đã sửa qua các bản trước).

**Lưu ý kiểm thử**: đã đọc lại toàn bộ vùng code mới/sửa bằng Read tool, `node --check` qua cú pháp thành công cho cả 2 file backend/frontend. **Chưa** bấm thử trên trình duyệt thật màn hình nào trong đợt này. Kiểm tra theo trình tự:

1. Chạy `database/migration_v524.sql`.
2. Thay `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js` bằng bản v5.24. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
3. Xác nhận tab **"Giao nhà gia công"** không còn hiện trên thanh menu Quản lý sản xuất; tab **"Đơn giá gia công"** mới xuất hiện (khai báo được hạng mục + đơn giá + hệ số mặc định).
4. Ghi nhận tiến độ 1 đơn hàng mới đến công đoạn **Kỹ thuật**: xác nhận thấy thêm mục "Đơn giá Giao gia công" (chọn hạng mục, sửa đơn giá/hệ số riêng đơn này, nút "💾 Lưu đơn giá gia công").
5. Đến công đoạn **"Giao gia công"**: xác nhận thấy **2 ô tick** (không còn radio) "Giao nhà làm"/"Giao gia công", không còn ô "Nhà gia công (đại diện)"/ "Đơn giá gia công" riêng. Tick **"Giao gia công"** → xác nhận hiện "Nhà gia công chi tiết" với cột **Số lượng** mới, lưu được qua "💾 Lưu nhà gia công". Tick **"Giao nhà làm"** → xác nhận hiện bảng tham khảo công đoạn may (chỉ đọc). Thử tick **cả 2** cùng lúc → xác nhận cả 2 khối đều hiện.
6. Với đơn tick **"Giao gia công"** (không tick "Giao nhà làm"): xác nhận đơn **không** hiện công đoạn "May" trong ô chọn tiếp theo. Với đơn tick **"Giao nhà làm"** (dù có tick thêm "Giao gia công" hay không): xác nhận đơn **có** hiện công đoạn "May", vào ghi nhận tiến độ May vẫn gán nhân viên/SL được như trước.
7. Vào tab **"Nhận nhà gia công"**: xác nhận danh sách lệnh sản xuất **không còn cột "Tổng đã nhận"**; bấm "Xem" 1 đơn → xác nhận chỉ hiện bảng đọc (nhà gia công/đơn giá/số lượng/ghi chú), **không có** nút "Ghi nhận" hay ô nhập liệu nào.

---

## BƯỚC 2.31 — Sửa tiếp v5.24 → v5.25 (bỏ qua nếu cài mới)

Đợt sửa nhỏ ngay sau khi thử v5.24, theo phản hồi trực tiếp của người dùng — 1 lỗi thật (không bao giờ tạo được hạng mục gia công đầu tiên) + 2 điểm làm rõ:

> *"1 Đơn giá Giao gia công (đơn hàng này): Đơn giá sẽ được nhập liệu ở chỗ này không cần thêm chức năng đơn giá gia công (xóa chức năng đơn giá gia công trong Quản lý sản xuất). 1.2 Tại công đoạn Giao gia công: Nếu tích vào Giao nhà làm thì lệnh sản xuất chuyển sang công đoạn may luôn. Nếu tích vào Giao gia công thì lệnh sản xuất nhảy sang công đoạn Nhận nhà gia công. 1.3 Bỏ công đoạn Giao nhà gia công, Giao nhà in thêu, nhận nhà in thêu, nhận nhà gia công vì đã có ở chức năng riêng (chức năng riêng vẫn phải cập nhật vào trong theo dõi lệnh sản xuất)."*

**Lỗi đã sửa**: tab **"Đơn giá gia công"** (thêm ở v5.24) chưa từng có màn hình thật đứng sau (bấm vào sẽ báo lỗi `ReferenceError` trên console trình duyệt) — thêm nữa, ngay cả khi có màn hình, hàm dựng giao diện tại Kỹ thuật (`hangMucGiaCongChonHtml()`) trả về sớm và **ẩn mất nút "+ Mới"** khi danh mục đang rỗng, nghĩa là **không có cách nào tạo được hạng mục gia công đầu tiên**.

**Thay đổi chính**:

- **Bỏ hẳn tab "Đơn giá gia công"** — đúng yêu cầu, đơn giá hạng mục gia công giờ chỉ khai báo/thêm mới ("+ Mới") ngay tại mục "Đơn giá Giao gia công" trong Kỹ thuật, không còn màn hình danh mục riêng nào nữa. Sửa nốt lỗi ẩn nút "+ Mới" khi danh mục rỗng — giờ luôn bấm được, kể cả lần đầu tiên chưa có hạng mục nào trong toàn hệ thống.
- Bỏ 2 route backend chỉ phục vụ màn hình danh mục đó (`GET /dongiagiacong`, `PUT /dongiagiacong/:id`); route thêm hạng mục mới (`POST /hangmucgiacong`, dùng bởi nút "+ Mới") vẫn giữ, đổi quyền kiểm soát sang `tiendo` (Ghi nhận tiến độ) cho đúng nơi thực sự dùng nó. `migration_v524.sql` (chưa từng deploy, sửa trực tiếp) bỏ luôn dòng khai báo quyền `dongiagiacong` không cần dùng nữa.
- **Xác nhận** (không đổi code): "Giao nhà làm" tích → đơn luôn chuyển tiếp sang công đoạn May bình thường (logic có sẵn từ v5.24, đã kiểm tra khớp đúng yêu cầu).
- **"Giao nhà gia công"/"Giao nhà in thêu"/"Nhận nhà in thêu"/"Nhận nhà gia công"**: xác nhận **không** trở thành công đoạn thật trong Ghi nhận tiến độ (đúng như thiết kế hiện tại — chỉ "Nhận nhà gia công" tồn tại, dưới dạng tab riêng thuần xem, các mục còn lại là tab riêng độc lập không đổi). Điểm này được hiểu là: dù các chức năng đó đứng độc lập, **dữ liệu của chúng vẫn phải phản ánh vào phần theo dõi lịch sử tiến độ của lệnh sản xuất** — mục "Nhận nhà gia công" (nhà gia công/đơn giá/số lượng) đã được thêm lại vào báo cáo "Lịch sử cập nhật tiến độ" khi in lệnh sản xuất (đọc trực tiếp từ Nhà gia công chi tiết còn sống, không qua sổ ghi chép cũ đã mồ côi) — cùng cách "Giao/Nhận nhà in thêu" đã làm từ trước.
  > **Lưu ý diễn giải**: câu "nhảy sang công đoạn Nhận nhà gia công" trong yêu cầu được hiểu là *ý nghĩa vận hành* (bước tiếp theo cần theo dõi là tab "Nhận nhà gia công"), **không phải** tạo lại 1 công đoạn thật tên "Nhận nhà gia công" trong luồng Ghi nhận tiến độ — vì câu ngay sau đó (mục 1.3) yêu cầu rõ **không** làm vậy. Nếu cách hiểu này chưa đúng ý, xin phản hồi lại.

**Không có migration mới** — chỉ sửa `migration_v524.sql` tại chỗ (bỏ 1 đoạn seed quyền).

**Kiểm thử**:

1. Thay `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`. `pm2 restart qlnoibo` + Ctrl+F5.
2. Xác nhận tab "Đơn giá gia công" không còn trên thanh menu.
3. Vào Ghi nhận tiến độ 1 đơn mới đến Kỹ thuật, với hệ thống **chưa có hạng mục gia công nào**: xác nhận mục "Đơn giá Giao gia công" hiện nút "+ Mới" ngay (không bị ẩn), tạo được hạng mục đầu tiên thành công.
4. In lệnh sản xuất 1 đơn đã gán nhà gia công chi tiết ở công đoạn "Giao gia công": xác nhận "Lịch sử cập nhật tiến độ" hiện dòng "Giao gia công" kèm tên nhà + số lượng + đơn giá trong ghi chú.

> **Lưu ý**: xem thêm BƯỚC 2.32 ngay dưới đây — v5.26 sửa tiếp: tab "Nhận nhà gia công" (còn giữ ở đây dưới dạng màn hình chỉ xem) đã bị **xóa hẳn**, và dropdown "Công đoạn" ở Ghi nhận tiến độ có thêm ngoại lệ cho người có quyền Sửa/Xóa. Khuyến nghị nâng cấp thẳng lên v5.26, không dừng ở v5.25.

---

## BƯỚC 2.32 — Sửa tiếp v5.25 → v5.26 (bỏ qua nếu cài mới)

Đợt sửa tiếp theo ngay sau v5.25, bắt đầu từ 1 yêu cầu rất ngắn gọn:

> *"Ghi nhận tiến độ. bỏ công đoạn giao nhà gia công, nhận nhà gia công."*

Vì câu này có thể hiểu theo nhiều cách khác nhau (kể cả cách hiểu "bỏ hẳn công đoạn 'GC' — Giao gia công", một thay đổi kiến trúc lớn đã bị đảo ngược qua lại nhiều lần ở các bản trước), đã hỏi lại người dùng 2 câu hỏi làm rõ trước khi sửa code. Câu trả lời xác nhận (trích nguyên văn):

> *"Giữ lại Giao gia công (mã GC, sau cắt) bỏ hẳn 'Giao nhà gia công'/'Nhận nhà gia công'. Gán nhà gia công chi tiết (chọn nhà + đơn giá + số lượng) ở phần giao gia công — nếu tích vào Giao gia công sẽ hiện ra để thêm nhà gia công, đơn giá và số lượng luôn. Nếu chọn Giao nhà làm thì chuyển luồng sang công đoạn MAY luôn."* — và riêng cho dropdown công đoạn: *"Luôn hiện MAY đối với quyền sửa, xóa, admin. Không hiện lệnh sản xuất ở công đoạn may nếu ở công đoạn Giao gia công không tích vào Giao nhà làm."*

**Thay đổi chính**:

- **Xóa hẳn tab "Nhận nhà gia công"** (`renderNhanNhaGiaCong()`/`openNhanNhaGiaCongDetail()` ở frontend, `GET /nhannhagiacong/orders` ở backend — toàn bộ đã xóa, không chỉ ẩn) — công đoạn "Giao gia công" (GC) **giữ nguyên y hệt thiết kế hiện tại** (2 ô tick độc lập "Giao nhà làm"/"Giao gia công", gán nhà gia công chi tiết ngay tại chỗ khi tích "Giao gia công"). Từ nay **không còn tab/chức năng riêng nào** cho nghiệp vụ nhà gia công — toàn bộ chỉ còn ở đúng 1 nơi để nhập (công đoạn "Giao gia công" trong Ghi nhận tiến độ) và 1 nơi để xem lại (báo cáo "Lịch sử cập nhật tiến độ" khi in lệnh sản xuất, đã có từ v5.25, đọc trực tiếp từ Nhà gia công chi tiết còn sống).
- **Dropdown "Công đoạn" trong Ghi nhận tiến độ — thêm ngoại lệ theo quyền**: người dùng có quyền **Sửa** hoặc **Xóa** lệnh sản xuất (hoặc admin) nay **luôn thấy "May"** trong danh sách chọn công đoạn, kể cả với đơn **chỉ** gia công ngoài (trước đây "May" bị ẩn tự động khỏi dropdown cho **mọi** người dùng khi đơn chỉ thuê ngoài — logic có từ v5.22). Người chỉ có quyền Ghi nhận tiến độ ('tiendo', không có quyền Sửa/Xóa ở chức năng "Danh sách lệnh sản xuất") **vẫn bị ẩn như cũ** — mục đích: cho phép người có quyền cao hơn tự xử lý ngoại lệ/sửa nhầm thủ công khi cần, không mở rộng cho tất cả.
- `ChucNang` **'nhannhagiacong'** (khai báo từ `migration_v519.sql`) **mồ côi** — giữ nguyên làm 1 ô quyền "chết" trong ma trận phân quyền (không xóa dòng khai báo, theo đúng quy ước chung của dự án), giống hệt cách **'giaonhagiacong'** đã mồ côi từ v5.24.

**Không có migration mới.**

**Kiểm thử**:

1. Thay `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`. `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
2. Xác nhận tab "Nhận nhà gia công" không còn trên thanh menu (với mọi người dùng, kể cả người trước đây được cấp quyền `nhannhagiacong`).
3. Đăng nhập user **chỉ** có quyền Ghi nhận tiến độ (không có quyền Sửa/Xóa ở "Danh sách lệnh sản xuất"), mở Ghi nhận tiến độ 1 đơn **chỉ** gia công ngoài (đã tích "Giao gia công", **không** tích "Giao nhà làm") → xác nhận "May" vẫn **bị ẩn** khỏi dropdown công đoạn, như hành vi gốc.
4. Đăng nhập user có quyền Sửa hoặc Xóa lệnh sản xuất (hoặc admin), mở lại **cùng đơn** đó → xác nhận "May" nay **hiện** trong dropdown công đoạn.
5. In lệnh sản xuất 1 đơn đã gán nhà gia công chi tiết ở công đoạn "Giao gia công" → xác nhận "Lịch sử cập nhật tiến độ" vẫn hiện đầy đủ tên nhà/số lượng/đơn giá (không đổi so với v5.25 — đây là nơi xem lại duy nhất còn tồn tại).

---

## BƯỚC 2.33 — Cài phân hệ MỚI "Quản lý nhân sự" (HRM v6.0 — Phase 1)

**Đây là phân hệ HOÀN TOÀN MỚI** (không phải bản vá QLSX), là **Phase 1** của bộ HRM + Tính lương (Payroll). Phase 1 chỉ gồm phần **Quản lý nhân sự**; phần Tính lương (4 mô hình) sẽ ở các Phase sau.

**Phạm vi Phase 1**: hồ sơ nhân sự đầy đủ (mở rộng bảng `NhanVien` đã có — **không** tạo bảng nhân viên mới, dùng chung với Danh mục › Nhân viên), Hợp đồng lao động, Phụ lục hợp đồng, Quyết định nhân sự (tăng lương/khen thưởng/kỷ luật/bổ nhiệm/điều chuyển), Thanh lý hợp đồng. Mỗi loại văn bản đều **in được** (mẫu chuẩn: Quốc hiệu + thông tin Cty MOYN + chữ ký) qua cơ chế in iframe sẵn có.

**Các bước nâng cấp**:

1. Chạy migration: `sqlcmd -S <server> -d QLNoiBo -i database/migration_v600.sql` (hoặc mở bằng SSMS chạy). Idempotent — chạy lại không lỗi. Migration này: (a) thêm ~17 cột hồ sơ vào `NhanVien` (ngày sinh, giới tính, CCCD, email, chức vụ, trạng thái lao động, số TK ngân hàng, MST, số sổ BHXH...); (b) thêm cột `Users.NhanVienID` (nền cho self-service xem lương ở Phase sau); (c) tạo 4 bảng `HopDongLaoDong`, `PhuLucHopDong`, `QuyetDinhNhanSu`, `ThanhLyHopDong`; (d) seed Module `HRM` + 5 chức năng + hàng phân quyền (mặc định chỉ Admin thấy).
2. Copy các file: `backend/routes/hrm.js` (mới), `backend/server.js` (đã thêm mount `/api/hrm`), `frontend/js/module.hrm.js` (mới), `frontend/js/app.js` (đã thêm HRM vào menu), `frontend/index.html` (đã thêm thẻ script). `pm2 restart qlnoibo` + Ctrl+F5 trên trình duyệt.
3. **Cấp quyền**: mặc định chỉ tài khoản Admin thấy phân hệ "Quản lý nhân sự" (dữ liệu nhân sự nhạy cảm). Để nhóm khác (VD nhóm "Quản lý"/HR) dùng: vào **Quản lý User › Ma trận phân quyền**, tick quyền Xem/Thêm/Sửa/Xóa cho module HRM cho nhóm đó, rồi user thuộc nhóm đăng nhập lại.

**Kiểm thử**:

1. Đăng nhập Admin → thấy menu "👥 Quản lý nhân sự" với 5 tab.
2. Tab "Hồ sơ nhân sự" → "Thêm nhân viên": để trống Mã NV → lưu → xác nhận hệ thống tự sinh mã dạng `NV001`. Sửa/tìm kiếm/xem hồ sơ hoạt động.
3. Tab "Hợp đồng lao động" → tạo 1 HĐ cho nhân viên vừa thêm (nhập Lương CB), bấm "🖨 In" → xác nhận ra bản HĐLĐ có Quốc hiệu + thông tin Cty + điều khoản + chữ ký.
4. Tạo 1 Quyết định + 1 Phụ lục + 1 Thanh lý; xác nhận in được. Sau khi tạo Thanh lý → xác nhận nhân viên tự chuyển trạng thái "Đã nghỉ việc".
5. Mở lại "Hồ sơ nhân sự" › "Hồ sơ" của 1 nhân viên → xác nhận thấy tóm tắt HĐ/Phụ lục/Quyết định/Thanh lý của người đó, có nút thêm nhanh.

> **Lưu ý**: chức năng "In" hiện xuất **bản in HTML** (in trực tiếp hoặc lưu PDF từ hộp thoại in) — giống mọi bản in khác trong hệ thống. Nếu cần **tải file .docx** để chỉnh tay, báo lại để bổ sung ở Phase sau.

---

## BƯỚC 2.34 — Cài phân hệ "Tính lương" (Payroll v6.1 — Phase 2)

**Phase 2** của bộ Payroll: **Cấu hình lương** (hằng số BH/giảm trừ/giờ chuẩn/hệ số tăng ca + biểu thuế TNCN 5 bậc + công chuẩn từng tháng — tất cả **cấu hình được**, không hard-code), **Chấm công** (kết nối máy chấm công theo IP/Port + tổng hợp + sửa tay), **Lương công nhật** (tính theo đúng công thức file lương → xem/sửa tạm ứng → chốt → xuất Excel + xuất file chuyển khoản CK theo mẫu BIDV).

**Các bước**:

1. Chạy `database/migration_v610.sql` (idempotent). Tạo: `CauHinhLuong` (seed mặc định theo file), `CongChuanThang` (seed 2026), `BacThueTNCN` (seed 5 bậc), `MayChamCong`, `NhanVien.MaChamCong`, `ChamCongRaw`, `ChamCongNgay`, `BangLuong` + `BangLuongChiTiet`; seed Module `PAYROLL` + 3 chức năng + phân quyền (mặc định chỉ Admin).
2. **Cài thư viện kết nối máy chấm công** (chỉ cần nếu dùng máy vân tay): trong thư mục `backend`, chạy `npm install node-zklib`. Nếu chưa cài, mọi chức năng khác của Payroll vẫn chạy — chỉ nút "Kết nối & kéo dữ liệu" báo lỗi nhắc cài.
3. Copy: `backend/routes/payroll.js` (mới), `backend/server.js` (mount `/api/payroll`), `frontend/js/module.payroll.js` (mới), `frontend/js/app.js` (thêm menu Tính lương), `frontend/index.html` (thẻ script). `pm2 restart qlnoibo` + Ctrl+F5.
4. Cấp quyền PAYROLL cho nhóm cần dùng (mặc định chỉ Admin thấy — như HRM).

**Cấu hình máy chấm công**: Tab Chấm công › Thêm máy → nhập **IP + Port** (mặc định 4370, giao thức ZKTeco). Ở Hồ sơ nhân sự, điền trường **"Mã chấm công"** (Enroll ID trên máy) cho từng nhân viên để hệ thống map đúng khi kéo dữ liệu. Máy chấm công phải **cùng mạng LAN** với máy chủ chạy hệ thống.

**Quy trình chạy lương tháng**:

1. (Nếu dùng máy) Chấm công › Kết nối & kéo dữ liệu → Tổng hợp từ máy → bảng công. Hoặc sửa tay từng ngày.
2. Cấu hình lương: kiểm tra biểu thuế/giảm trừ/công chuẩn tháng đúng chưa.
3. Lương công nhật: chọn kỳ → **Tính lương** → kiểm tra, nhập **Tạm ứng** nếu có → **Xuất Excel** / **Xuất file CK** → **Chốt**.

> **Lưu ý quan trọng**:
> - Lương công nhật lấy **Lương CB + phụ cấp từ hợp đồng đang hiệu lực** (module HRM) và **tổng công từ Chấm công**. Vậy nên mỗi nhân viên cần có 1 hợp đồng "Hiệu lực" với Lương CB thì mới tính ra lương.
> - Kết nối máy chấm công cần **máy thật trong mạng LAN** để kiểm thử — không thể test trên máy không có thiết bị.
> - Thưởng doanh thu + gộp tiền tăng ca vào thực lĩnh chưa bật trong Phase 2 (tính riêng ở phiên bản sau).

---

## BƯỚC 2.35 — Payroll Phase 3 (Lương khoán may + "Bảng lương của tôi")

**Phase 3** bổ sung: **Lương khoán may** (tab trong Tính lương) + phân hệ **"🧾 Bảng lương của tôi"** cho mọi nhân viên tự xem lương của mình.

**Các bước**:

1. Chạy `database/migration_v620.sql` (idempotent) — thêm chức năng PAYROLL `luongmay`; thêm Module `MYPAY` (cấp quyền Xem cho **tất cả các nhóm** — mọi nhân viên đều thấy); thêm chức năng `luongcuatoi`. (Không thêm bảng mới — dùng lại `Users.NhanVienID` đã có từ v6.0.)
2. Copy: `backend/routes/payroll.js`, `backend/routes/users.js`, `backend/utils/loadUserContext.js`, `frontend/js/module.payroll.js`, `frontend/js/module.mypay.js` (mới), `frontend/js/module.users.js`, `frontend/js/app.js`, `frontend/index.html`. `pm2 restart qlnoibo` + Ctrl+F5.
3. **Liên kết tài khoản ↔ nhân viên** (bắt buộc để nhân viên tự xem lương): Quản lý User → sửa từng tài khoản → chọn **"Liên kết nhân viên"**. Sau khi liên kết, người đó đăng nhập sẽ thấy menu "🧾 Bảng lương của tôi" với lương công nhật + khoán may của chính mình (không thấy của người khác).

**Lương khoán may** (Tính lương → tab "Lương khoán may"): tự tổng hợp từ **Ghi nhận tiến độ công đoạn May** — số lượng từng nhân viên hoàn thành × đơn giá khoán công đoạn may của đơn hàng (ưu tiên đơn giá theo đơn, fallback đơn giá hệ thống), lọc theo tháng ghi nhận. Có bảng tổng hợp theo nhân viên + chi tiết theo đơn hàng + xuất Excel.

> **Lưu ý**:
> - "Được nghiệm thu" hiện hiểu là **đã ghi nhận ở công đoạn May** (bảng `PhanCongMay`) — chưa có bước duyệt nghiệm thu riêng. Nếu cần thêm bước duyệt, báo lại.
> - Nhân viên không có nhóm quyền nào sẽ không thấy "Bảng lương của tôi" (hiếm — hầu hết tài khoản đều thuộc ít nhất 1 nhóm).

---

## BƯỚC 2.36 — Sửa Ra lệnh SX + bỏ Chỉ định vải/NPL (v5.27, nhánh QLSX)

Đợt sửa **Quản lý sản xuất** (nhánh v5.x, làm sau các đợt HRM/Payroll v6.x). Gồm 2 nhóm:

**1.1 — Ra lệnh sản xuất**:
- **Bỏ trường "Mã SP"** → hiện **Mã đơn hàng** (vốn tự sinh `DH`+YYMM+STT): form tạo hiện "(tự động sinh khi lưu)", form sửa + bản in hiện Mã ĐH. (Cột `MaSanPham` giữ nguyên trong DB, chỉ ngưng nhập.)
- **Khách hàng**: thêm nút **"+ Mới"** thêm nhanh khách hàng ngay trên form.
- **Nhân viên thiết kế / ra rập**: thêm ô chọn **"↧ NV"** lấy từ danh sách nhân viên (HRM) — chọn để điền vào ô tên, vẫn **gõ tự do** tên khác được.
- **Loại vải (chính + phối) → gõ tự do** (bỏ chọn từ danh mục). **Màu vẫn chọn từ danh mục** (vì `MauSacID` là khóa theo dõi tiến độ Cắt/May/Kho nhập theo màu — gõ tự do màu sẽ hỏng phần đó). Hệ quả: **không còn ràng buộc xuất vải theo lệnh SX** — Phiếu xuất kho vải nay liệt kê **mọi đơn hàng** và cho chọn **mọi cây vải còn tồn** (bỏ cổng lọc theo Chỉ định vải SX cũ).
- **Ảnh màu** trong Cấu trúc vải: thêm **dán ảnh (Ctrl+V)** — bấm vào ô ảnh rồi dán, hoặc vẫn "Chọn file" như cũ.

**1.2 — Bỏ 2 chức năng**: **"Chỉ định vải SX"** (tab + route backend, đã nới cổng Phiếu xuất vải) và **"Chỉ định NPL"** (tab trong Tài liệu kỹ thuật). Dữ liệu nền (`DonHangChiTietPhuKien`, cột `DVTVaiYeuCau/SoKGYeuCau`) + các ChucNang **giữ nguyên (mồ côi)** — không xóa, đúng quy ước.

**Các bước cài**: chạy `migration_v527.sql` (chỉ thêm 1 cột `DonHangChiTietVai.TenLoaiVaiTuDo`). Copy `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.tailieukythuat.js`. `pm2 restart qlnoibo` + Ctrl+F5.

**Kiểm thử**: (1) Ra lệnh SX mới — không còn ô Mã SP, gõ loại vải tự do, dán ảnh màu, "+ Mới" khách hàng, "↧ NV" thiết kế; lưu + in xem Mã ĐH + loại vải hiện đúng. (2) Sửa 1 đơn cũ — loại vải cũ vẫn hiện (từ danh mục), sửa được. (3) Xác nhận 2 tab "Chỉ định vải SX" + "Chỉ định NPL" không còn. (4) Phiếu xuất kho vải — chọn 1 đơn bất kỳ + chọn cây vải bất kỳ còn tồn (không còn bị chặn).

> **Cập nhật v5.27.1**: **màu** trong Cấu trúc vải nay cũng **gõ tự do** (chỉ để tham khảo, không ảnh hưởng công đoạn khác). Theo dõi tiến độ per-màu ở Cắt/May/Kho nay lấy màu **thật** từ cây vải đã xuất (qua Phiếu xuất Vật tư — xem BƯỚC 2.37) nên không phụ thuộc màu gõ tay. Kèm: mỗi hàng màu chính có cột ghi chú; Mã ĐH hiện ngay khi mở form (chỉ ghi DB khi Lưu); "+ Mới" khách hàng có thêm SĐT + địa chỉ.

---

## BƯỚC 2.37 — HOÀN TÁC bản gộp: trả lại 2 phiếu xuất riêng, xuất tự do (v5.29, nhánh QLSX)

> **Lưu ý:** bản gộp "Phiếu xuất Vật tư" (v5.28) đã bị **hoàn tác** theo yêu cầu. Nếu bạn **chưa** chạy `migration_v528.sql` thì **bỏ qua cả 2.37 lẫn migration_v528** — hệ thống vốn đã có 2 phiếu xuất riêng. Nếu bạn **đã** chạy `migration_v528.sql`, làm theo bước dưới để trả về trạng thái cũ.

**Mục tiêu:** giữ **Xuất kho vải** và **Phiếu xuất phụ kiện** là **2 màn hình riêng như cũ**, nhưng **xuất tự do** — ô "Đơn hàng sản xuất" chỉ để gắn tham khảo (tùy chọn), **không lọc/ràng buộc** cây vải hay phụ kiện; xuất được mà không cần chọn đơn. Riêng Phiếu xuất phụ kiện: chọn đơn hàng **không còn lọc theo "Chỉ định NPL"** (chức năng đó đã bỏ từ v5.27).

**Các bước cài (nếu đã lỡ chạy migration_v528):**

1. Chạy `database/migration_v528_rollback.sql` (tạo lại 2 view tồn về gốc → drop 3 bảng `PhieuXuatVatTu*` → xóa Module `VATTU`/ChucNang/Permissions). Idempotent.
2. Copy backend: `backend/routes/qlsx.js` + `backend/server.js` (bỏ tham chiếu bảng gộp). **Xóa** `backend/routes/vattu.js` trên máy chủ.
3. Copy frontend: `frontend/js/module.khovai.js` + `frontend/js/module.phukien.js` (khôi phục nút "+ Tạo phiếu xuất" + xuất tự do) + `frontend/js/app.js` + `frontend/index.html` (gỡ menu "Xuất vật tư"). **Xóa** `frontend/js/module.vattu.js` trên máy chủ.
4. `pm2 restart qlnoibo` + Ctrl+F5.

> ⚠️ Nếu đã tạo phiếu xuất vật tư thử nghiệm trước khi hoàn tác: dữ liệu các phiếu đó sẽ mất, tồn kho vải/phụ kiện trả về như trước khi xuất (đúng — vì các phiếu đó không còn).

**Kiểm thử:** (1) Kho vải → tab **Xuất kho**: nút "+ Tạo phiếu xuất kho" + nút "Xuất kho" trên từng cây (tab Tồn theo cây) hoạt động lại; để trống đơn hàng vẫn xuất được. (2) Phụ kiện → tab **Phiếu Xuất**: "+ Tạo phiếu xuất" hoạt động; chọn/không chọn đơn hàng đều chọn được mọi phụ kiện. (3) Không còn menu "Xuất vật tư". (4) Công đoạn Cắt vẫn lấy cây vải từ phiếu xuất kho vải như cũ.

---

## BƯỚC 2.38 — Gia công theo hạng mục + công đoạn "Nhận gia công" + In thêu tổng SL (v5.30, nhánh QLSX)

**6 thay đổi ở Ghi nhận tiến độ:**

1. **Kỹ thuật** — "Đơn giá Giao gia công": **bỏ cột Hệ số** (chỉ còn đơn giá theo hạng mục).
2. **Giao gia công (công đoạn GC)** — tick "Giao gia công" → mỗi **hạng mục gia công** (khai ở Kỹ thuật) là 1 khối, hiện **đơn giá lấy từ Kỹ thuật (chỉ xem)**; dưới mỗi hạng mục thêm **nhiều nhà gia công + số lượng** từng nhà.
3. **Giao/Nhận nhà in thêu** — thêm cột **"Tổng SL (màu chính)"** = tổng SL từ tất cả sơ đồ Cắt của đơn.
4. **May** — "Lịch sử giao việc nội bộ": thêm nút **Xóa** cạnh nút Sửa (Admin).
5. **Bỏ "Giao nhà gia công" riêng** — việc giao gia công chỉ nằm trong công đoạn "Giao gia công" (đã đúng từ trước, không còn màn riêng).
6. **Công đoạn mới "Nhận gia công" (NGC)** ngay sau "Giao gia công": hiện các nhà đã giao + hạng mục + SL giao, nhập **SL nhận** từng nhà. NGC chỉ hiện với đơn có giao gia công.

**Các bước cài:**

1. Chạy `database/migration_v530.sql` (thêm cột `DonHangChiTietNhaGiaCong.HangMucGiaCongID` + `SoLuongNhan`; thêm công đoạn `NGC` "Nhận gia công"). Idempotent.
2. Copy backend `backend/routes/qlsx.js`; frontend `frontend/js/module.qlsx.js`. `pm2 restart qlnoibo` + Ctrl+F5.

> ⚠️ Các dòng "nhà gia công chi tiết" cũ (trước v5.30) chưa gắn hạng mục sẽ không hiện trong khối hạng mục — thêm lại nếu cần. Đơn giá gia công nay lấy **chung theo hạng mục** (từ Kỹ thuật), không nhập đơn giá riêng từng nhà.

**Kiểm thử:** (1) Kỹ thuật: "Đơn giá Giao gia công" không còn cột Hệ số. (2) Giao gia công: tick → thấy từng hạng mục + đơn giá (chỉ xem) + thêm nhiều nhà/SL. (3) Sau khi tick Giao gia công + Gửi → dropdown công đoạn có "Nhận gia công"; vào nhập SL nhận từng nhà, Lưu. (4) Giao/Nhận thêu: thấy cột Tổng SL. (5) May: nút Xóa (Admin) hoạt động.

---

## BƯỚC 2.39 — Sửa lỗi tạo đơn + Kiểu vải phiếu xuất kho + luồng công đoạn (v5.31, nhánh QLSX)

**FIX LỖI QUAN TRỌNG** "Invalid column name 'GhiChu'" khi lưu lệnh sản xuất — DB thiếu các cột v5.27.1 của `DonHangChiTietVai`. Chạy `migration_v531.sql` là hết (idempotent, tự thêm các cột còn thiếu).

**Các thay đổi:**

1. **Phiếu xuất kho vải** (Kho vải → tab Xuất kho): mỗi cây thêm ô **Kiểu (Chính/Phối)** — hiện ở tạo/sửa/xem/in phiếu.
2. **Bỏ 2 công đoạn cũ GNGC/NNGC** (Giao/Nhận nhà gia công) khỏi dropdown Ghi nhận tiến độ (đã thay bằng GC/NGC). Dòng DB cũ được **ẩn ở tầng code** (không xóa để tránh lỗi khóa ngoại/mất lịch sử).
3. **Luồng công đoạn**: đơn **chỉ gia công ngoài** → sau "Nhận gia công" (NGC) nhảy thẳng **QC** (bỏ qua May + Nhặt chỉ). Đơn có **Giao nhà làm** → May → Nhặt chỉ → QC (như thường).

**Cài:** chạy `migration_v531.sql`; copy `backend/routes/qlsx.js` + `backend/routes/khovai.js` + `backend/utils/vaiXuatService.js` + `frontend/js/module.qlsx.js` + `frontend/js/module.khovai.js`; `pm2 restart qlnoibo` + Ctrl+F5.

**Kiểm thử:** (1) Tạo lệnh SX mới — lưu được (hết lỗi GhiChu). (2) Xuất kho vải — chọn Chính/Phối từng cây, in phiếu thấy cột Kiểu. (3) Dropdown Ghi nhận tiến độ không còn GNGC/NNGC. (4) Đơn gia công ngoài: NGC → QC; đơn nhà làm: May → Nhặt chỉ.

> *Đang chờ chốt (chưa làm): chuyển "Giao nhà in thêu" thành công đoạn (nhiều nhà + SL giao) + bỏ 2 tab in thêu — cần xác nhận thiết kế.*

---

## BƯỚC 2.40 — In thêu thành 2 công đoạn (Giao/Nhận), bỏ 2 tab in thêu (v5.32, nhánh QLSX)

**Mục tiêu:** "Giao nhà in thêu" + "Nhận nhà in thêu" chuyển từ 2 tab riêng thành **2 công đoạn** trong Ghi nhận tiến độ, **chèn sau Cắt, trước Giao gia công** (luồng: Cắt → Giao in thêu → Nhận in thêu → Giao gia công → …). Mỗi đơn **chọn nhiều nhà in thêu**, mỗi nhà có **SL giao** (công đoạn Giao) + **SL nhận** (công đoạn Nhận). Công đoạn Giao hiện **tổng SL bàn cắt màu chính** (tham khảo). **Bỏ 2 tab** "Giao/Nhận nhà in thêu" cũ.

**Cài:**

1. Chạy `migration_v532.sql` (bảng `DonHangNhaInTheu` + 2 công đoạn `GIT`/`NIT`). Idempotent.
2. Copy `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js`; `pm2 restart qlnoibo` + Ctrl+F5.

**Kiểm thử:** (1) Ghi nhận tiến độ — sau Cắt có công đoạn "Giao in thêu": chọn nhiều nhà + SL giao, thấy tổng SL bàn cắt màu chính; Lưu. (2) "Nhận in thêu": thấy nhà đã giao + SL giao, nhập SL nhận; Lưu. (3) Menu QLSX không còn 2 tab "Giao/Nhận nhà in thêu". (4) Luồng: Cắt → Giao in thêu → Nhận in thêu → Giao gia công.

> ⚠️ Mọi đơn giờ đi qua 2 bước in thêu (đơn không in thêu chỉ cần bấm "Gửi" để chuyển tiếp). Muốn để tùy chọn (chỉ đơn có in thêu) thì báo lại.

---

## BƯỚC 2.41 — Cờ "Có in thêu" + chỉ thấy công đoạn phụ trách + khống chế SL May (v5.33, nhánh QLSX)

1. **Cờ "Có in thêu"** ở Ra lệnh SX (tạo/sửa đơn): đơn **không** in thêu sẽ **bỏ qua** 2 công đoạn Giao/Nhận in thêu — sau Cắt chuyển thẳng Giao gia công. Mặc định: không in thêu (bỏ trống).
2. **Chỉ thấy công đoạn mình phụ trách**: dropdown "Công đoạn" ở Ghi nhận tiến độ chỉ hiện công đoạn user được phân công (bảng `UserCongDoan`, gán trong Quản lý User). User chưa được gán công đoạn nào → thấy tất cả (như cũ). Admin thấy tất cả.
3. **Bỏ trùng in thêu**: ẩn công đoạn "Giao/Nhận nhà in thêu" cũ (GNIT/NNIT hoặc tên "…nhà in thêu") khỏi dropdown — chỉ còn "Giao in thêu"/"Nhận in thêu" (GIT/NIT) mới.
4. **Công đoạn May**: tổng SL giao cho nhân viên trong **1 công đoạn** không vượt quá **tổng SL cắt màu chính** (chặn khi bấm Gửi).

**Cài:** chạy `migration_v533.sql` (thêm cột `DonHangSanXuat.CoInTheu`); copy `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js`; `pm2 restart qlnoibo` + Ctrl+F5.

> Chẩn đoán công đoạn in thêu trùng (nếu vẫn còn sau khi cài): chạy `SELECT StageID, TenCongDoan, MaCongDoan, ThuTu FROM CongDoanSanXuat WHERE TenCongDoan LIKE N'%in thêu%';` — chỉ nên còn "Giao in thêu" (GIT) + "Nhận in thêu" (NIT).

**Kiểm thử:** (1) Ra lệnh SX: tick/bỏ "Có in thêu". Đơn bỏ tick → Ghi nhận tiến độ không hiện Giao/Nhận in thêu, luồng Cắt → Giao gia công. (2) Đăng nhập user chỉ phụ trách 1 công đoạn → dropdown chỉ hiện công đoạn đó. (3) May: giao nhân viên vượt tổng SL cắt → báo lỗi, không lưu.

---

## BƯỚC 2.42 — Đổi tên "Chỉ định sản xuất" + Bảng kê bán thành phẩm (v5.34 — Giai đoạn A)

- **Mục 1:** tab "Ra lệnh sản xuất" → **"Chỉ định sản xuất"** (nhãn tab + tiêu đề form; key route giữ nguyên).
- **Mục 3 — Bảng kê bán thành phẩm** (tab mới trong Quản lý sản xuất): bảng lưới cột **Size** (thêm tự do như Thông số đo) × hàng **màu vải chính**. Nút **"↧ Điền màu từ Cắt"** tự lấy màu chính + **số lớp** (tổng cột "SL lớp" của các cây **Chính** cùng màu ở công đoạn Cắt — cộng dồn nếu 1 màu nhiều mã cây). Có Tổng cộng theo hàng + tổng chung, Xem/In, Tạo/Áp mẫu (mẫu lưu danh sách cột size).

**Cài:** chạy `migration_v534.sql`; copy `backend/routes/bangke.js` (mới) + `backend/server.js` + `frontend/js/module.bangkebtp.js` (mới) + `frontend/js/module.qlsx.js` + `frontend/index.html`; `pm2 restart qlnoibo` + Ctrl+F5. Cấp quyền chức năng "Bảng kê bán thành phẩm" (QLSX) nếu cần.

> **Các mục 4, 5, 6, 7 làm ở Giai đoạn B & C tiếp theo:** Tài liệu may/Đóng gói (Thông số kỹ thuật / Mô tả đường may / Đơn giá công đoạn may + Giao gia công / Quy cách đóng gói), bỏ 2 khối khỏi Kỹ thuật, công đoạn May theo đơn giá mới, Tài liệu in thêu. Lương khoán may sẽ đổi sang **SL × Thành tiền**.

---

## BƯỚC 2.43 — Tài liệu may/Đóng gói + Tài liệu in thêu (v5.34 — Giai đoạn B)

Gộp 3 lần cài (B1+B2). Chạy **theo thứ tự**: `migration_v534b.sql` (bảng Đơn giá công đoạn may), `migration_v534c.sql` (cột `Loai` cho Mô tả sản phẩm + bảng Đơn giá in thêu).

- **Mục 4 — tab mới "Tài liệu may/Đóng gói"** (Quản lý sản xuất): **Thông số kỹ thuật** (= Thông số đo, chuyển từ Tài liệu kỹ thuật) · **Mô tả đường may** (= Mô tả sản phẩm, chuyển) · **Quy cách đóng gói** (lưới ảnh giống Mô tả) · **Đơn giá công đoạn may** (model mới: Tên / Giây giờ / Hệ số công đoạn / Hệ số công nhân (mặc định 4) / **Thành tiền = Giây giờ × Hệ số CĐ × Hệ số CN**) · **Đơn giá giao gia công** (chuyển từ Kỹ thuật; chọn hạng mục + đơn giá).
- **Mục 5 (phần đơn giá):** Kỹ thuật đã **bỏ khối "Đơn giá Giao gia công"** (nay nhập ở Tài liệu may). *(Khối "Chọn công đoạn may" ở Kỹ thuật giữ tạm tới Giai đoạn C.)*
- **Mục 7 — tab mới "Tài liệu in thêu"**: **Hình ảnh mô tả in/thêu** (lưới ảnh) + **Đơn giá in thêu** (nhiều dòng Tên / Đơn giá).
- Mỗi tài liệu đều có **Xem / In**; Thông số kỹ thuật / Mô tả đường may / Quy cách đóng gói thêm **Tạo mẫu / Áp mẫu / Quản lý mẫu** (xem BƯỚC 2.45).

**Cài:** chạy `migration_v534b.sql` rồi `migration_v534c.sql`; copy `backend/routes/tailieukythuat.js` + `frontend/js/module.tailieukythuat.js` + `frontend/js/module.qlsx.js`; `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.44 — Công đoạn May theo đơn giá mới + lương khoán may = SL × Thành tiền (v5.34 — Giai đoạn C)

Chạy **`migration_v534d.sql`** (thêm cột `PhanCongMay.DonGiaCongDoanMayID`).

- **Mục 6:** công đoạn **May** (Ghi nhận tiến độ) nay lấy danh sách công đoạn từ **"Đơn giá công đoạn may"** mới (khai ở *Tài liệu may/Đóng gói*) — hiển thị **Thành tiền/cái** (chỉ xem) + ô **Nhân viên & SL** (nhập). Khống chế tổng SL/công đoạn ≤ tổng SL cắt màu chính (giữ như v5.33).
- **Mục 5 (hoàn tất):** Kỹ thuật đã **bỏ hẳn** khối "Chọn công đoạn may" — Kỹ thuật giờ chỉ còn **Sơ đồ**.
- **Lương khoán may** viết lại: **lương = Σ(SL × Thành tiền)** với *Thành tiền = Giây giờ × Hệ số CĐ × Hệ số CN* của từng công đoạn. Dùng **dual-path** (đơn hàng khai đơn giá mới → dùng đơn giá mới; đơn cũ → công thức cũ) nên không mất dữ liệu và không ra lương 0. Màn hình *Lương khoán may* + *Bảng lương của tôi* + Excel giữ nguyên bố cục.

**Cài:** chạy `migration_v534d.sql`; copy `backend/routes/qlsx.js` + `backend/routes/payroll.js` + `frontend/js/module.qlsx.js`; `pm2 restart qlnoibo` + Ctrl+F5.

> **Kiểm thử bắt buộc sau deploy:** ra 1 đơn → khai *Đơn giá công đoạn may* (Tài liệu may) → giao việc ở công đoạn May → mở *Lương khoán may* và xác nhận lương = SL × Thành tiền (khác 0).

---

## BƯỚC 2.45 — Tạo/Áp/Quản lý mẫu cho tài liệu may (v5.34 — hoàn tất Giai đoạn B)

Chạy **`migration_v534e.sql`** (thêm `LaMau`/`TenMau` + cho `DonHangID` NULL trên `TaiLieuThongSoDo` và `TaiLieuMoTaSanPham`, đổi unique index sang lọc `WHERE LaMau=0`).

- **Thông số kỹ thuật**, **Mô tả đường may**, **Quy cách đóng gói** (và Hình ảnh mô tả in/thêu) nay có trong màn soạn: **Lưu thành mẫu** (đặt tên, lưu bảng/lưới hiện tại làm mẫu dùng lại), **Áp mẫu** (chọn mẫu → thay thế nội dung đang soạn), **Quản lý mẫu** (xem + xóa mẫu).
- Mẫu là bản ghi không gắn đơn hàng (`LaMau=1`, `DonHangID` NULL). Mô tả/Quy cách/Hình ảnh in thêu có **danh sách mẫu riêng theo loại**.

**Cài:** chạy `migration_v534e.sql`; copy `backend/routes/tailieukythuat.js` + `frontend/js/module.tailieukythuat.js`; `pm2 restart qlnoibo` + Ctrl+F5.

> **Toàn bộ v5.34 (A+B+C+mẫu) đã hoàn tất về code.** Thứ tự migration cả batch: `v534` → `v534b` → `v534c` → `v534d` → `v534e`.

---

## BƯỚC 2.46 — Sổ cắt xem lại/In + sửa số bàn cắt + bỏ tab đơn giá may trùng + in A4 (v5.35)

**Không có migration** — chỉ copy file + `pm2 restart qlnoibo` + Ctrl+F5.

- **Công đoạn Cắt:** khi mở lại (kể cả sau khi đã ghi tiến độ) hiện khối **"Sổ cắt đã ghi nhận (lần Cắt gần nhất)"** (chỉ xem) + nút **"🖨️ In sổ cắt"**.
- **Sửa lỗi "Tổng số bàn cắt"** (ở công đoạn May): trước đếm nhầm **số cây** (2 bàn × 2 cây → hiện 4), nay đếm đúng **số bàn/sơ đồ** (→ 2). Số "cái" (đã quy đổi) giữ nguyên.
- **Xóa tab "Đơn giá công đoạn may"** cũ (danh mục hệ thống) — trùng với "Đơn giá công đoạn may" trong *Tài liệu may/Đóng gói*. Bảng dữ liệu cũ giữ lại (lương vẫn dùng làm dự phòng), chỉ ẩn màn hình.
- **Tất cả tài liệu khi In đều tràn khổ A4** (thêm quy tắc @page A4, bỏ lề thừa) — áp cho toàn bộ bản in (tài liệu, lệnh SX, bảng kê, sổ cắt, thẻ kho...). Tem QR và hợp đồng HRM giữ khổ riêng của chúng.

**Cài:** copy `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js` + `frontend/js/common.js`; `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.47 — Màu chính + tự điền mã hàng + tìm/lọc thẻ kho + tồn cây + lương gia công/in thêu (v5.36)

Chạy **`migration_v630.sql`** (chỉ thêm quyền chức năng "Lương gia công / In thêu", không đổi cấu trúc dữ liệu).

- **Mọi công đoạn + tổng đơn hàng chỉ tính MÀU CHÍNH:** Ghi nhận tiến độ chỉ hiển thị + cập nhật số lượng theo màu chính (bỏ màu phối); tổng số lượng đơn hàng cộng dồn màu chính.
- **Tài liệu (kỹ thuật / may-đóng gói / in thêu):** trường **Mã hàng** tự điền mã của đơn (Mã ĐH).
- **Thẻ kho hàng hóa:** thêm ô **tìm ký tự bất kỳ** + lọc **Loại hàng** + **Danh mục**; khi Tạo/Sửa, ô chọn **màu gõ tìm** (searchable).
- **Tồn cây vải:** chỉ hiện cây **còn tồn**, tự ẩn cây đã hết (In tem vẫn thấy đủ).
- **Lương gia công / In thêu (mới):** tab trong Tính lương — gia công = SL nhận × đơn giá hạng mục; in thêu = SL nhận × tổng đơn giá in thêu của đơn; tổng hợp theo từng nhà + In. *(Đơn giá in thêu lấy theo tổng đơn giá của đơn — nếu cần đơn giá riêng từng nhà in thêu, báo tôi để thêm.)*
- **Lương khoán may:** bấm 1 nhân viên → xem chi tiết lương + **In chi tiết**; thêm nút **In tổng hợp**.

**Cài:** chạy `migration_v630.sql`; copy `backend/routes/qlsx.js` + `backend/routes/payroll.js` + `frontend/js/module.tailieukythuat.js` + `frontend/js/module.khohang.js` + `frontend/js/module.khovai.js` + `frontend/js/module.payroll.js`; `pm2 restart qlnoibo` + Ctrl+F5. Cấp quyền chức năng "Lương gia công / In thêu" cho nhóm cần.

---

## BƯỚC 2.48 — Tính lương: công chuẩn tự tính + chi tiết GC/in thêu + máy chấm công (v5.37)

**KHÔNG có migration SQL**, nhưng **PHẢI chạy `npm install`** trong thư mục `backend` (thêm thư viện `node-zklib` để kết nối máy chấm công).

- **Cấu hình lương:** nút **"📅 Tự tính theo lịch (trừ Chủ nhật)"** điền công chuẩn 12 tháng theo lịch (tự trừ Chủ nhật; **lễ/tết chỉnh tay** rồi bấm Lưu — hệ thống chưa có bảng ngày lễ).
- **Lương GC/In thêu:** bấm 1 **nhà** để xem + **In chi tiết** riêng nhà đó; nút **"In"** giờ **chỉ in phần tổng hợp theo nhà** (không in từng đơn hàng).
- **Lương khoán may — In phiếu:** cột **Ngày** chuyển sang vị trí thứ 2 (ngay sau Mã đơn hàng).
- **Máy chấm công** (sửa lỗi "không tải được dữ liệu về" + thêm chức năng):
  - **Tải nhân viên từ máy:** nút "👥 Tải NV từ máy" lấy danh sách người đăng ký trên máy → gán vào nhân viên (lưu "Mã chấm công"). *Đây là bước còn thiếu khiến trước đây kéo được nhưng bảng công trống (dữ liệu không map được vào ai).*
  - **Kéo theo khoảng thời gian + theo mã NV/tất cả:** nhập Từ ngày / Đến ngày / Mã chấm công (rỗng = tất cả) trước khi bấm "Kéo dữ liệu".
  - **Tải lên file chấm công (Excel):** dùng khi máy không kết nối được (2 cột `MaChamCong`, `ThoiGian`).
  - Sau khi kéo/tải, bấm **"Tổng hợp từ máy → bảng công"**.

> **Vì sao trước đây "không tải được dữ liệu về":** (1) máy chủ chưa cài `node-zklib` → nay thêm vào, **phải `npm install`**; (2) chưa có nơi lưu "Mã chấm công" của nhân viên nên dữ liệu kéo về không gán được cho ai → nay có "Tải NV từ máy" để gán. **Kiểm thử thật cần máy chấm công trong mạng LAN** (ZKTeco, cổng 4370). Nếu vẫn lỗi: thông báo sẽ hiện IP:port + lý do cụ thể để dò mạng/tường lửa.

**Cài:** trong `backend` chạy `npm install`; copy `backend/package.json` + `backend/routes/payroll.js` + `frontend/js/module.payroll.js`; `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.49 — HRM/chấm công tải file + Lương là/đóng gói (v5.38)

Chạy **`migration_v640.sql`** (2 bảng: đơn giá là/đóng gói + phân công là/đóng gói theo màu; + quyền "Lương là / đóng gói").

- **Hồ sơ nhân sự:** nút **"⬇️ File mẫu"** + **"⬆️ Tải lên (file có sẵn)"** — nhập/cập nhật nhân sự hàng loạt từ Excel (khớp theo **Mã NV**; Bộ phận khớp theo tên, chưa có thì tự tạo; cột "Mã chấm công" nhập luôn cũng được).
- **Chấm công:** khu tải lên có thêm nút **"⬇️ File mẫu"** (2 cột Mã chấm công, Thời gian).
- **Tài liệu may/Đóng gói:** thêm mục **"Đơn giá là/đóng gói"** — nhập đơn giá LÀ (ủi) và ĐÓNG GÓI theo đơn (dùng tính lương).
- **Công đoạn Là (LA) + Đóng gói (DG)** (Ghi nhận tiến độ): mỗi **màu chính** có ô thêm **nhân viên + số lượng**; hệ thống **khống chế tổng SL giao mỗi màu ≤ SL cắt màu đó**. (Lưu vào bảng riêng, không ảnh hưởng lương khoán may.)
- **Tính lương → tab "Lương là / đóng gói"**: SL giao ở LA/DG × đơn giá là/đóng gói; tổng hợp theo nhân viên + chi tiết + In.

**Cài:** chạy `migration_v640.sql`; copy `backend/routes/` (hrm.js, payroll.js, tailieukythuat.js, qlsx.js) + `frontend/js/` (module.hrm.js, module.tailieukythuat.js, module.payroll.js, module.qlsx.js); `pm2 restart qlnoibo` + Ctrl+F5. Cấp quyền chức năng "Lương là / đóng gói" cho nhóm cần. *(multer/xlsx đã có sẵn — không cần cài thêm.)*

---

## BƯỚC 2.50 — Đưa 2 tab "Tài liệu may/Đóng gói" + "Tài liệu in thêu" vào Phân quyền (v5.39)

Chạy **`migration_v641.sql`** (thêm 2 chức năng QLSX: `tailieumay` = "Tài liệu may/Đóng gói", `tailieuinthe` = "Tài liệu in thêu"). MERGE idempotent — chạy lại nhiều lần không sao.

- 2 tab này (thêm từ v5.34) trước đây gate CHUNG chức năng "Tài liệu kỹ thuật" nên **không hiện** trong màn Phân quyền. Sau bản này, cả 2 hiện thành 2 dòng riêng trong ma trận phân quyền (module QLSX) → admin cấp/ẩn **từng tab**.
- **Backend gate theo loại tài liệu:** ẩn quyền "Tài liệu kỹ thuật" **không còn** khoá nhầm 2 tab may/in thêu (và ngược lại). Mỗi nhóm route (tlkt / tlmay / tlinthue) kiểm tra đúng chức năng của nó.
- **Frontend:** nút Tạo/Sửa/Xoá trong mỗi tab tôn trọng đúng quyền của tab đó (view-only thì ẩn nút sửa).

**Cài:** chạy `migration_v641.sql`; copy `backend/routes/tailieukythuat.js` + `frontend/js/module.tailieukythuat.js`; `pm2 restart qlnoibo` + Ctrl+F5. Sau đó vào **Phân quyền** cấp 2 chức năng mới cho nhóm cần (mặc định chưa seed dòng quyền = ai cũng xem/sửa được như cũ, chỉ khi bạn đặt CanView/CanEdit=false mới khoá).

---

## BƯỚC 2.51 — Sửa lỗi quyền "chỉ xem" vẫn thấy nút tạo (Tài liệu + Kho hàng hóa) (v5.39b)

Chỉ sửa **frontend** (`module.tailieukythuat.js` + `module.khohang.js`), **không có migration**.

- **Tài liệu (kỹ thuật / may-đóng gói / in thêu):** trước đây danh sách đơn, đơn **chưa có tài liệu** luôn hiện nút **"+ Tạo"** bất kể quyền → user chỉ được **Xem** (bỏ tích Sửa) vẫn thấy nút Tạo. Sau bản này: không có quyền Sửa thì đơn **đã có** hiện **"Xem"** (mở chỉ để xem), đơn **chưa có** hiện dấu **"—"**. Có quyền Sửa mới thấy **"Mở" / "+ Tạo"**.
- **Kho hàng hóa → Thẻ kho → mở lịch sử/chi tiết theo màu:** nút **"Đặt hàng"** (đặt hàng nhanh theo màu) trước đây luôn hiện → user chỉ-xem vẫn đặt được đơn. Sau bản này chỉ hiện khi có quyền **Tạo** (canCreate) ở Kho hàng hóa.
- **Lệnh SX (Tổng quan):** nút "🔔 Kiểm tra & gửi cảnh báo trễ hạn ngay" (gửi email) chỉ hiện với user có quyền **Sửa**.
- **Bảng kê BTP:** khi mở bảng kê mà user không có quyền **Sửa**, các nút sửa lưới (Điền màu từ Cắt / + Thêm size / Áp mẫu / xóa cột / xóa dòng / + Màu) bị ẩn và các ô nhập thành chỉ-đọc — chỉ còn Xem + In.
- *(Backend vốn đã chặn 403 khi tạo/sửa không có quyền — bản này bỏ nút gây hiểu nhầm trên giao diện. Đã rà soát toàn bộ 11 module; các màn còn lại (Kho vải, Phụ kiện, HRM, Tính lương, Danh mục, Người dùng) đã khoá đúng.)*
- *(CHƯA đổi — chờ quyết định: (a) màn Người dùng chưa chặn cứng theo admin; (b) Tính lương nút Xuất Excel/CK chưa khoá theo quyền.)*

**Cài:** copy `frontend/js/module.tailieukythuat.js` + `module.khohang.js` + `module.qlsx.js` + `module.bangkebtp.js` → Ctrl+F5 (không cần chạy SQL; nếu server chạy pm2 chỉ cần hard-refresh trình duyệt).

---

## BƯỚC 2.52 — In "Chỉ định sản xuất" theo 2 mẫu Excel, tự chọn theo số màu (v5.40)

Chỉ sửa **frontend** (`frontend/js/module.qlsx.js`), **không migration**.

- Nút **"In lệnh SX"** (tab Chỉ định sản xuất) giờ in theo bố cục file **FORM CHỈ ĐỊNH SẢN XUẤT.xlsx**, **tự chọn form theo số màu chính** của đơn:
  - Đơn **1 màu chính** → in **"Form 1 màu"** (bố cục dọc: mã SP, kỹ thuật rập, tên SP, thiết kế, size, deadline, vải chính/phối, số lượng, hình in, phụ liệu, ghi chú).
  - Đơn **nhiều màu chính** → in **"Form nhiều màu"** (bảng vải theo từng màu: dòng Vải chính / Vải phối / Số lượng cho mỗi màu, kèm ảnh màu).
- Tiêu đề **CHỈ ĐỊNH SẢN XUẤT** căn giữa; **Mã ĐH** dòng riêng, **căn phải** dưới tiêu đề.
- Các trường thông tin (Tên SP / Mã SP / Size / Thiết kế / Kỹ thuật rập / Deadline…) trình bày dạng **bảng kẻ ô** như mẫu cũ.
- **Ảnh sản phẩm + ảnh hình in** đặt **trước bảng màu** (form nhiều màu), cỡ ảnh lớn (~375px). Ảnh màu vải trong bảng ~**100px, hiện đầy đủ (không cắt xén)**. Cả 2 form có khối ký **Duyệt sản xuất / Người lập phiếu**. *(v5.44.2: bổ sung dòng **Khách hàng** vào cả 2 mẫu in.)*
- **Đã bỏ** bố cục in .docx cũ và **bỏ trường "Nhà in"** khỏi phiếu.
- Ô **"Phụ liệu"** (form 1 màu) không có nguồn dữ liệu → để **trống cho ghi tay**. Mẫu Excel tách "Vải áo (in tràn)" / "Vải quần + cổ + túi" theo vị trí sử dụng — hệ thống chưa có trường vị trí nên tổng quát thành **Vải chính / Vải phối**.

**Cài:** copy `frontend/js/module.qlsx.js` → Ctrl+F5.

---

## BƯỚC 2.53 — Thẻ kho/Tồn kho: gộp nút Tạo + cột đơn vị + giữ giá trị cũ khi sửa (v5.41)

Sửa **frontend `module.khohang.js`** + **backend `routes/khohang.js`**, **không migration** (dùng cột `DonViCoBan`/`DonViQuyDoi`/`LoaiRi` sẵn có).

- **Nút "+ Tạo thẻ kho mới"** giờ nằm ngay trong thanh công cụ tab **Thẻ kho / Tồn kho** (đã **bỏ tab "Tạo thẻ kho mới" riêng**).
- Danh sách có **2 cột đơn vị: "ĐVT (Cái)"** và **"ĐVT (Ri)"** — **cả 2 cột đều hiện tồn** (quy đổi qua lại): cột Cái = số cái, cột Ri = số ri kèm hệ số dạng **"Ri{hệ số}"**. *(v5.41.5)*
  - Hàng đơn vị **Cái**, tồn 60, hệ số 6 → ĐVT (Cái) = "60", ĐVT (Ri) = "10 Ri6" (lẻ: 62 → "10 Ri6 dư 2 Cái").
  - Hàng đơn vị **Ri**, tồn 10, hệ số 6 → ĐVT (Cái) = "60", ĐVT (Ri) = "10 Ri6" (hệ số 5 → "10 Ri5").
  - Hệ số ≤ 1 (không có ri) → cột ĐVT (Ri) hiện "—". Badge "Âm kho"/"Hết hàng" đi kèm cột ĐVT (Cái).
- Khi **tạo/sửa** thẻ kho: **Đơn vị chính** và **Đơn vị quy đổi** chọn từ **dropdown (Cái / Ri)** thay vì gõ tay (vẫn chỉ hiện với hàng "Đặt ngoài" như cũ; "Tỷ lệ quy đổi/hệ số" vẫn nhập số).
- **Khi Sửa: các trường không thay đổi được giữ nguyên giá trị cũ, kể cả ảnh.** Form đã điền sẵn mọi trường từ dữ liệu cũ; backend PUT giữ ảnh đại diện + ảnh màu (ISNULL) và nay giữ luôn Ghi chú (không bị xóa khi lưu).

> Lưu ý: chọn đúng "Đơn vị tính chính" (Cái/Ri) + hệ số cho mặt hàng — cột ĐVT (Cái)/ĐVT (Ri) hiện tồn đúng cột theo đơn vị đó.

**Cài:** copy `frontend/js/module.khohang.js` + `backend/routes/khohang.js` → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.54 — Sửa lỗi MẤT dữ liệu khi Sửa thẻ kho (Danh mục / Giá Aloha / Loại hàng / Ảnh) (v5.41.1)

Chạy **`migration_v642.sql`** + copy **`backend/routes/khohang.js`**. **`pm2 restart qlnoibo`**.

- **Nguyên nhân gốc:** form "Sửa thẻ kho" điền sẵn dữ liệu từ view `vw_TonKhoHangHoa`. View này qua các lần sửa bị **thiếu cột**: chưa bao giờ trả `TheKhoDanhMucID` (chỉ có tên danh mục), và bản mới nhất còn bỏ mất `NhomSanPhamID`/`GiaAloha`. Thiếu cột ⇒ ô Danh mục / Loại hàng / Giá Aloha khi Sửa không điền lại được ⇒ lưu xuống NULL ⇒ mất dù không đụng vào.
- **`migration_v642.sql`** dựng lại view đầy đủ cột (thêm `TheKhoDanhMucID` + `NhomSanPhamID`/`TenNhom` + giữ `GiaAloha`/`MaBarcode`/`AnhDaiDien`). Idempotent, không đổi dữ liệu.
- **Backend PUT** giờ giữ nguyên giá trị cũ (ISNULL) cho **Danh mục, Loại hàng (nhóm SP), Giá Aloha, Mã Barcode** (Ảnh đại diện + Ghi chú đã ISNULL từ trước). Nghĩa là: **để trống / không nhập mới một trường khi Sửa ⇒ giữ nguyên giá trị cũ**, không bị xóa.
- Hệ quả phụ (tốt): cột **"Loại hàng"** trong danh sách Thẻ kho lại hiển thị đúng (trước có thể bị trống do view thiếu `TenNhom`).
- **Ảnh đại diện chung (v5.41.2):** khi Sửa mà **không chọn ảnh mới**, form giờ **gửi thẳng đường dẫn ảnh cũ** (giống cách ảnh màu vẫn làm) thay vì gửi rỗng — nên ảnh **không bị mất** kể cả khi cơ chế giữ ảnh phía backend không ăn. Sửa ở `frontend/js/module.khohang.js`.

> Lưu ý: vì "để trống ⇒ giữ cũ", muốn **xóa hẳn** giá trị một trường (vd bỏ Danh mục, xóa Barcode) thì hiện chưa làm được qua màn Sửa — báo nếu cần, sẽ thêm nút "xóa giá trị".

**Cài:** chạy `migration_v642.sql` → copy `backend/routes/khohang.js` **+ `frontend/js/module.khohang.js`** → `pm2 restart qlnoibo` + **Ctrl+F5** (phải hard-refresh để lấy frontend mới, nếu không ảnh vẫn mất do chạy JS cũ).

---

## BƯỚC 2.55 — Quản lý sản xuất: Mác + Phụ kiện, Ảnh SP ở danh sách, Cắt ẩn cây đã chọn, sửa ảnh SP (v5.42)

Chạy **`migration_v643.sql`** (thêm 2 cột `Mac` + `PhuLieu` vào `DonHangSanXuat`) + copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/js/common.js`.

- **Chỉ định sản xuất — thêm 2 trường:** **Mác** (nhập tự do, 1 dòng) và **Phụ kiện** (nhập tự do, **thêm được nhiều dòng**). Có ở cả form Tạo và form Sửa; in ra ở cả 2 mẫu in ("Form 1 màu" và "Form nhiều màu").
- **Danh sách lệnh sản xuất:** thêm **cột "Ảnh SP"** hiển thị ảnh sản phẩm (bấm ảnh mở ảnh lớn ở tab mới).
- **Công đoạn Cắt (Ghi tiến độ):** khi chọn cây vải cho sơ đồ, **cây nào đã chọn rồi sẽ không xuất hiện lại** trong danh sách chọn của cây/sơ đồ khác (chống chọn trùng). Áp dụng cả trong 1 sơ đồ lẫn giữa nhiều sơ đồ.
- **Form Sửa lệnh sản xuất:** bổ sung **sửa Ảnh sản phẩm** (trước đây chỉ form Tạo mới có) — không chọn ảnh mới thì giữ nguyên ảnh cũ.

*(Kỹ thuật: `common.js` — `wireSearchableSelect` nay nhận `list` là mảng HOẶC hàm trả mảng, tương thích ngược 100%; dùng để lọc động danh sách cây vải.)*

**Cài:** chạy `migration_v643.sql` → copy `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js` + `frontend/js/common.js` → `pm2 restart qlnoibo` + **Ctrl+F5**.

---

## BƯỚC 2.56 — In tài liệu KT (5 loại) + bố cục đầu phiếu xuất/nhập kho (v5.43)

**Chỉ frontend, KHÔNG migration/backend.** Copy: `module.qlsx.js`, `module.tailieukythuat.js`, `module.bangkebtp.js`, `common.js`.

**A. Danh sách lệnh SX → "In tài liệu KT":** menu chọn in giờ gồm đúng 5 loại: **Thông số kỹ thuật, Mô tả đường may, Quy cách đóng gói, Hình ảnh mô tả in/thêu, Bảng kê BTP** — thêm nút **"In tất cả"** (gộp mỗi loại 1 trang). **Biên bản nào chưa có dữ liệu thì bỏ qua, không in ra** (in 1 loại mà chưa có → báo "chưa có"; in tất cả → chỉ in loại đã có). *(Bỏ 2 nút cũ "Tài liệu kỹ thuật chung" + "Chỉ định NPL" khỏi menu theo danh sách yêu cầu — báo nếu cần thêm lại.)*

**B. In phiếu Xuất/Nhập kho vải & phụ kiện (cả 4 phiếu):** **Tên phiếu căn giữa** trang; dòng ngay dưới: **ngày tháng căn giữa** + **Số phiếu căn phải** cùng 1 dòng. Dùng chung 1 hàm `phieuHeaderHtml` trong `common.js` cho cả 4 phiếu.

**Cài:** copy 4 file frontend trên → **Ctrl+F5** (không cần chạy SQL / restart backend, nhưng restart cũng không sao).

---

## BƯỚC 2.57 — Catalogue + Đơn khách đặt hàng (v5.44)

**KHÔNG migration.** Copy: `backend/routes/public.js`, `frontend/catalogue.html`, `frontend/js/catalogue.js`, `frontend/js/module.khohang.js` → `pm2 restart qlnoibo` + **Ctrl+F5**.

**Catalogue (trang công khai):**
- **Bỏ bộ lọc "Danh mục thẻ kho".**
- **Tự sắp xếp hàng mới lên trên cùng** (v5.44.1): danh sách sản phẩm tự sắp theo **ngày tạo thẻ kho** giảm dần (mới nhất ở trên); kèm badge đỏ "MỚI" cho sản phẩm tạo trong vòng 3 ngày. *(Dùng ngày TẠO — CreatedAt; chưa lưu "ngày cập nhật" riêng nên sửa thẻ kho cũ không đẩy lên đầu.)* Không còn checkbox lọc "Hàng mới".
- **Xem ảnh:** bấm ảnh 1 màu → mở lớn; giờ có nút **‹ ›** (và phím ← →) để **chuyển sang ảnh khác trong cùng sản phẩm mà không phải đóng/mở lại**.

**Đơn khách đặt hàng (Kho hàng hóa → tab Đơn khách đặt hàng):**
- Thêm **lọc theo khách** (dropdown tên khách).
- **Xuất phiếu (in giấy/PDF) "Phiếu giao hàng"** theo 2 cách: **theo khách** (nút trên thanh công cụ — in gộp các đơn "Chờ xử lý" của khách đang chọn) hoặc **theo từng đơn** (nút "🖨️ In phiếu" trên mỗi dòng Chờ xử lý).
- **Xuất phiếu xong → tự chuyển các đơn đó sang "Đã giao".** (Đơn đã giao/đã hủy không đưa vào phiếu; đơn đã hủy giữ nguyên.)

**Cài:** chạy không cần SQL; copy `backend/routes/public.js` (cho "hàng mới") + 3 file frontend → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.58 — Sửa lỗi lưu Thông số đo + ẩn tab "Tài liệu kỹ thuật" (v5.44.3 / v5.44.4)

**KHÔNG migration.** Copy `backend/routes/tailieukythuat.js` + `frontend/js/module.qlsx.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **Sửa lỗi lưu Thông số đo** (v5.44.3): lỗi *"The DELETE statement conflicted with the REFERENCE constraint ...TaiLieuThongSoDoGiaTri...CotID"*. Nguyên nhân: khi lưu lại, code **xóa Cột trước** trong khi bảng **Giá trị** vẫn tham chiếu Cột → vi phạm khóa ngoại. Sửa: **xóa Giá trị (bảng con) TRƯỚC**, rồi mới xóa Cột/Dòng — áp dụng ở cả 2 chỗ (lưu lại lưới + xóa cả tài liệu).
- **Ẩn tab "Tài liệu kỹ thuật"** (v5.44.4): bỏ tab **"Tài liệu kỹ thuật"** (tài liệu chung) khỏi menu Quản lý sản xuất. **Giữ** các tab "Tài liệu may/Đóng gói", "Tài liệu in thêu", "Bảng kê BTP" để vẫn nhập/sửa (thông số đo, mô tả đường may, quy cách...). Vẫn **in tài liệu KT** từ Danh sách lệnh SX như cũ.

**Cài:** copy `backend/routes/tailieukythuat.js` (fix lưu) + `frontend/js/module.qlsx.js` (ẩn tab) → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.59 — Nút "In tài liệu KT" luôn hiện + Bảng kê BTP tự lấy cột size từ Thông số đo (v5.44.5)

**KHÔNG migration.** Copy `backend/routes/bangke.js` + `frontend/js/module.qlsx.js` + `frontend/js/module.bangkebtp.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **Nút "In tài liệu KT" luôn hiện** ở Danh sách lệnh SX (bỏ điều kiện quyền "Tài liệu kỹ thuật" — trước đây quyền đó bị ẩn nên nút cũng biến mất). Nay mọi trường hợp đều thấy nút.
- **Bảng kê BTP — cột size TỰ NHẢY từ Thông số đo:** khi mở Bảng kê BTP của một đơn **chưa có** bảng kê, các **cột size** **tự điền** đúng theo các **Size** (vd 2, 3, 4 — là các **dòng "Size"** trong bảng Thông số đo, KHÔNG phải cột "Vị trí đo") của đơn đó (nếu đơn đã khai Thông số đo). Nếu chưa khai thì mặc định S/M/L như cũ. Đơn **đã lưu** bảng kê thì giữ nguyên cột đã lưu (không ghi đè).
- Thêm nút **"↧ Cột size từ Thông số đo"** trong màn Bảng kê BTP để lấy/đồng bộ lại cột size bất kỳ lúc nào (chỉ hiện khi đơn có Thông số đo và người dùng có quyền sửa).

**Cài:** copy 3 file trên → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.60 — Quản lý mẫu tài liệu (Sửa/Xóa + căn giữa) + Áp mẫu BTP chọn từ danh sách + ảnh bản in full A4 (v5.44.6)

**KHÔNG migration.** Copy `backend/routes/tailieukythuat.js` + `frontend/js/module.tailieukythuat.js` + `frontend/js/module.bangkebtp.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **Quản lý mẫu** (Thông số kỹ thuật / Mô tả đường may / Quy cách đóng gói / Hình ảnh in thêu): màn "Quản lý mẫu" thêm nút **Sửa** (đổi TÊN mẫu) cạnh nút **Xóa**; **tên mẫu căn giữa ô**. (Sửa = đổi tên; muốn đổi nội dung cột/dòng thì "Lưu thành mẫu" bản mới rồi xóa bản cũ.)
- **Bảng kê BTP — Áp mẫu:** thay ô gõ ID bằng **danh sách mẫu (dropdown)** để chọn trực tiếp rồi bấm "Áp mẫu".
- **Bản in ảnh full khổ A4:** 3 loại tài liệu ảnh — **Mô tả đường may, Quy cách đóng gói, Hình ảnh mô tả in/thêu** — khi in ảnh phóng **hết chiều ngang khổ A4** (trước tối đa 220px). Áp dụng cho cả in lẻ lẫn "In tài liệu KT (In tất cả)".

**Cài:** copy 3 file trên → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.61 — BTP Quản lý mẫu (Sửa/Xóa) + Tem cây vải thêm khổ vải + Máy in tem qua mạng (v5.45)

**CÓ migration.** Chạy `database/migration_v644.sql` (thêm cột Khổ vải vào view cây vải + tạo bảng CauHinh). KHÔNG cần `npm install` (dùng module `net` sẵn có của Node).

Copy: `backend/routes/bangke.js`, `backend/routes/khovai.js`, `frontend/js/module.bangkebtp.js`, `frontend/js/module.khovai.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **Bảng kê BTP — Quản lý mẫu:** trong màn Bảng kê BTP thêm nút **"Quản lý mẫu"** (cạnh "Lưu thành mẫu"), mở danh sách mẫu BTP để **Sửa (đổi tên)** / **Xóa** — giống Quản lý mẫu tài liệu.
- **Tem cây vải — thêm Khổ vải:** tem QR cây vải (In tem theo ngày nhập / In lại theo mã cây) hiển thị thêm dòng **Khổ vải (cm)** — lấy khổ thực tế của cây, nếu trống lấy khổ khai báo của mã vải.
- **In tem qua máy in mạng (mới):** nút **"⚙️ Cài đặt máy in mạng"** trong tab In tem — nhập **IP + cổng (9100) + khổ (A6 dọc/ngang) + loại lệnh (TSPL/ZPL)** + bật/tắt. Sau đó dùng nút **"🖨️ In qua máy in mạng"** để server in thẳng ra máy in tem qua socket 9100 (không qua hộp thoại in trình duyệt).
  - Chữ trên tem tự **bỏ dấu tiếng Việt** (máy in tem thường không có font Unicode); mã cây/QR không ảnh hưởng.
  - ⚠ **CẦN TEST TRỰC TIẾP với máy in trong mạng LAN.** Nếu in ra sai ký tự/không ra (máy không dùng TSPL) → mở "Cài đặt máy in mạng" đổi **Loại lệnh** sang **ZPL** (hoặc ngược lại) rồi in lại. Có thể cần tinh chỉnh toạ độ/khổ theo model máy.

**Cài:** migration_v644 + 4 file trên → `pm2 restart qlnoibo` + Ctrl+F5.

> **Sửa lỗi v5.45.1** — tab "In tem theo ngày nhập" báo *"lỗi tải dữ liệu: perm is not defined"* (mobile: *"can't find variable: perm"*). Do hàm `renderTem` dùng biến `perm` nhưng chưa được truyền vào. Đã sửa. **Chỉ cần chép lại `frontend/js/module.khovai.js`** + Ctrl+F5 (trên điện thoại: đóng hẳn app/trình duyệt mở lại hoặc xóa cache để nạp file mới). KHÔNG cần chạy lại migration.
>
> **Sửa lỗi v5.45.2** — tem in **từ điện thoại/iPad bị lệch** so với in trên máy tính. Do CSS tem dùng `min-height:100vh` (Safari iOS tính `vh` theo màn hình, không theo trang A6). Đã đổi sang **chiều cao cố định theo mm** (bằng vùng in A6 trừ lề) → in trên điện thoại KHỚP máy tính. Cũng **chỉ chép lại `frontend/js/module.khovai.js`** + tải lại (mobile: xóa cache/mở lại).
>
> **v5.45.3** — (a) Tem QR **phóng cân đối cho đầy khổ A6** (giữ đủ thông tin): QR to hơn (88mm dọc / 80mm ngang), chữ lớn hơn, dùng đơn vị mm/pt cố định để mobile khớp máy tính. (b) Phần **xem phiếu nhập kho vải** thêm nút **"🖨️ In tem qua máy in mạng"** (cạnh nút In tem máy tính). Chỉ chép lại `frontend/js/module.khovai.js` + tải lại.
> **Mẹo in trên iPad/điện thoại:** trong hộp thoại in của Safari, chọn đúng **khổ giấy A6** và để **Scale = 100%** (tắt "fit to page") thì bản in mới khớp máy tính. Muốn chắc chắn giống nhau tuyệt đối trên mọi máy, nên dùng **In qua máy in mạng** (server in, không phụ thuộc thiết bị).
>
> **v5.45.4 — Sửa bố cục tem IN QUA MÁY IN MẠNG** (trước bị QR nhỏ ở góc, chữ dồn 1 bên, trống gần hết tem). Viết lại lệnh **TSPL/ZPL** cho giống bản trình duyệt: **QR to (~74mm) căn giữa phía trên, mã cây + thông tin chữ to xếp giữa bên dưới**, tràn đầy khổ A6 (khổ ngang: QR trái – chữ phải). Thêm chọn **DPI (203/300)** trong "Cài đặt máy in mạng" — nếu bản in bị **to/nhỏ sai kích thước** thì đổi DPI cho khớp máy (đa số máy in tem là **203 dpi**). Copy `backend/routes/khovai.js` + `frontend/js/module.khovai.js` → `pm2 restart qlnoibo` + Ctrl+F5. KHÔNG migration.
> - Lưu ý: máy in tem (TSPL/ZPL) dùng **font in sẵn không có tiếng Việt có dấu** nên chữ trên tem là **không dấu** (mã QR/mã cây không ảnh hưởng). Muốn tem in mạng có **tiếng Việt có dấu y hệt bản trình duyệt** thì phải render tem thành **ảnh** rồi gửi máy in — là thay đổi lớn hơn, báo nếu cần.
> - Máy **ZPL (Zebra)** giới hạn phóng QR (tối đa ~36mm); nếu QR vẫn nhỏ, dùng máy/loại lệnh **TSPL**. Sau khi sửa **in thử lại**; lệch thì đổi DPI hoặc báo tôi tinh chỉnh toạ độ.
>
> **v5.45.7 — IN TEM DẠNG ẢNH (chữ TIẾNG VIỆT CÓ DẤU, phông đẹp, TSPL = ZPL).** Máy in tem không có font tiếng Việt sẵn ⇒ nay máy chủ **vẽ cả tem thành ảnh** (QR to căn giữa + chữ có dấu, mã cây dài tự thu vừa khổ) rồi gửi máy in in đồ hoạ (TSPL `BITMAP` / ZPL `^GFA`). TSPL và ZPL in ra **giống hệt nhau**. Đã kiểm chứng bố cục bằng render thử (QR ~98mm, đủ dấu). **BẮT BUỘC cài 2 gói mới:** vào thư mục `backend` chạy **`npm install qrcode pureimage`** → copy `backend/routes/khovai.js` + `backend/package.json` → **`pm2 restart qlnoibo`**. Font mặc định `C:\Windows\Fonts\arial.ttf` (đổi bằng biến môi trường `TEM_FONT_PATH` nếu muốn font khác). Nếu in ra **âm bản** (nền đen chữ trắng) → báo tôi đảo cực bit (TSPL bit0=đen / ZPL bit1=đen). Frontend không đổi (vẫn nút "In qua máy in mạng").
>
> **v5.45.6 — QUAN TRỌNG về triển khai + chẩn đoán timeout.** Lệnh in tem chạy ở **BACKEND**, nên sau khi sửa **BẮT BUỘC copy `backend/routes/khovai.js` lên máy chủ + `pm2 restart qlnoibo`**; chỉ Ctrl+F5 trên trình duyệt thì tem KHÔNG đổi (đó là lý do "vẫn như cũ"). Lỗi *"Hết thời gian kết nối máy in (timeout)"* = **máy chủ không mở được kết nối tới máy in** (không liên quan TSPL/ZPL). Đã thêm nút **"🔌 Kiểm tra kết nối"** trong Cài đặt máy in để thử riêng phần mạng. Chẩn đoán: (1) In 1 tem self-test từ chính máy in để biết IP thật; (2) nhập đúng IP + cổng 9100 → bấm Kiểm tra kết nối; (3) nếu **kết nối OK mà không ra tem** → do lệnh in (đổi TSPL↔ZPL); nếu **kết nối lỗi** → máy in chưa bật / sai IP-cổng / khác mạng LAN với máy chủ / firewall chặn 9100. Copy `backend/routes/khovai.js` + `frontend/js/module.khovai.js` → `pm2 restart qlnoibo` + Ctrl+F5.
>
> **v5.45.5 — QR 100mm + sửa lỗi font chữ tem in mạng.** (a) Chữ tem in mạng (TSPL) bị **lỗi font/không đọc được** do lệnh `BLOCK` (v5.45.4) không hợp máy → **quay lại lệnh `TEXT`** (đã in tốt trước đó) nên chữ hiện rõ lại. (b) **QR phóng lên ~100mm** cho cả in mạng lẫn in máy tính: bản in mạng tự tính số ô QR theo độ dài mã để canh ~100mm và **căn giữa**; bản trình duyệt QR 100mm (dọc) / 88mm (ngang), chữ thu gọn cho vừa phần còn lại. Copy `backend/routes/khovai.js` + `frontend/js/module.khovai.js` → `pm2 restart qlnoibo` + Ctrl+F5. KHÔNG migration. (ZPL vẫn cap QR ~36mm — nên dùng TSPL nếu cần QR to.)

---

## BƯỚC 2.62 — Thẻ kho hàng hóa: Màu tự do + Xóa đơn đặt hàng + sửa quy đổi Ri (v5.46)

**KHÔNG migration.** Copy `backend/routes/khohang.js` + `frontend/js/module.khohang.js` + `frontend/js/common.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **Tạo thẻ kho — Màu tự do hoặc chọn sẵn:** ô Màu (chi tiết theo màu) nay **gõ tự do HOẶC chọn màu có sẵn** (có gợi ý danh sách màu). Gõ tên màu mới → hệ thống **tự tạo màu** trong danh mục (tự sinh mã màu). Dòng màu của hàng "Nhà sản xuất" vẫn dùng dropdown ràng buộc như cũ.
- **Danh sách đơn đặt hàng — nút Xóa:** mỗi đơn có nút **Xóa** (cần quyền Xóa). Xóa đơn sẽ **hoàn lại tồn kho** nếu đơn đang trừ tồn (chưa ở trạng thái "Đã hủy").
- **Sửa quy đổi ở "Lịch sử & chi tiết theo màu":** trước hiển thị sai *"50 Ri (8 Cái6 dư 2 Ri)"*. Nay: đơn vị chính = **Ri** → **"50 Ri (= 300 Cái)"** (nhân hệ số); đơn vị chính = Cái → "N Cái (M Ri{hệ số} dư D Cái)". Khớp với bảng Thẻ kho/Tồn kho.

**Cài:** copy 3 file trên → `pm2 restart qlnoibo` + Ctrl+F5.

> **Sửa lỗi v5.46.1 — Đặt hàng trừ tồn SAI đơn vị (cột Xuất trong chi tiết màu).** Khi tạo đơn cho mã có **đơn vị chính = Ri**, hệ thống trừ tồn **gấp hệ số** (nhân số Ri × hệ số rồi coi như số Ri). Đã sửa: số lượng đặt được quy đúng về **đơn vị chính** trước khi trừ/hoàn tồn (áp cho tạo đơn, hủy, xóa). Copy `backend/routes/khohang.js` → `pm2 restart qlnoibo`. KHÔNG migration.
> **Lưu ý dữ liệu cũ:** các đơn đã tạo TRƯỚC bản sửa (trên mã đơn vị chính = Ri) đã trừ tồn sai → cột Xuất/Tồn hiện tại có thể chưa đúng. Bản sửa chỉ đảm bảo đơn MỚI đúng. Nếu cần, báo tôi cung cấp script tính lại XuatCai cho các mã bị ảnh hưởng.

---

## BƯỚC 2.63 — In lệnh SX ghi chú màu + KHÔI PHỤC "Chỉ định vải SX" & "Chỉ định NPL" (v5.47)

**CÓ migration (v5.47.1):** chạy `database/migration_v645.sql` (tạo bảng `ChiDinhVaiSX` — "Chỉ định vải SX" nay là bảng RIÊNG, độc lập cấu trúc vải của Ra lệnh SX). Copy: `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.tailieukythuat.js`, `frontend/js/module.phukien.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **In lệnh SX — ghi chú theo màu vải chính:** bản in "Chỉ định sản xuất" nay hiện GHI CHÚ của từng màu vải chính (form 1 màu: kèm sau "Vải chính"; form nhiều màu: thêm hàng "Ghi chú").
- **Chỉ định vải SX (khôi phục — BẢNG RIÊNG, độc lập Ra lệnh SX):** tab mới trong Quản lý sản xuất — mỗi đơn khai **nhiều dòng**: **Loại vải + Màu gõ để tìm trong danh mục HOẶC gõ tên mới** (vải chưa có — chỉ định trước, mua sau; hệ thống tự thêm vào danh mục để sau này nhập cây khớp được), rõ **Chính/Phối**, SL yêu cầu + ĐVT; **thêm/xóa dòng, Sửa + Xóa**. Không liên quan cấu trúc vải của Ra lệnh SX. (Ẩn/hiện theo phân quyền chức năng "Chỉ định vải SX".)
- **Khóa xuất kho vải theo chỉ định:** Phiếu xuất kho vải nay chỉ cho chọn **đơn ĐÃ "Chỉ định vải SX"** + chỉ **cây vải khớp Loại vải/Màu** đã chỉ định (khớp theo mã danh mục). Lưu ý: kho phải có cây vải đúng Loại vải/Màu đã chỉ định thì mới hiện ra để xuất.
- **Chỉ định NPL (khôi phục):** trong tab "Tài liệu may/Đóng gói" thêm mục **"Chỉ định NPL"** — khai phụ kiện theo đơn (thêm/xóa/in). (Sửa 1 dòng = xóa rồi thêm lại.)
- **Khóa xuất phụ kiện theo chỉ định:** Phiếu xuất phụ kiện khi **chọn đơn** chỉ hiện phụ kiện đã "Chỉ định NPL" cho đơn đó; **không gắn đơn** thì vẫn xuất tự do.

⚠ **Cần test thực tế** luồng xuất kho vải + xuất phụ kiện sau khi bật lại khóa (đây là ràng buộc mới bật lại trên luồng đang chạy tự do).

**Cài:** copy 5 file trên → `pm2 restart qlnoibo` + Ctrl+F5. KHÔNG migration.

---

## BƯỚC 2.64 — Cắt bổ sung nhiều đợt: cộng dồn theo sơ đồ + không kéo lùi công đoạn (v5.48)

**KHÔNG migration.** Copy `backend/routes/qlsx.js` → `pm2 restart qlnoibo` (backend-only, không cần Ctrl+F5).

Phục vụ tình huống: 1 sản phẩm nhiều sơ đồ, chạy trước một số; **vải về từng đợt mới cắt bổ sung** các sơ đồ còn lại.

- **Số liệu cắt CỘNG DỒN theo từng sơ đồ:** trước đây "SL cắt / số bàn cắt / SL cắt theo màu" chỉ tính **LẦN GHI gần nhất** → cắt bổ sung ở lần Gửi khác bị bỏ sót. Nay hệ thống lấy **bản ghi cắt mới nhất của MỖI sơ đồ rồi cộng lại** → cắt bổ sung nhiều đợt vẫn đúng tổng; cắt lại cùng 1 sơ đồ thì lấy lần mới nhất (không nhân đôi). Các công đoạn khác (May/Kho nhập) giữ nguyên cách tính cũ.
- **Không kéo lùi công đoạn:** ghi cắt (hay công đoạn đã qua) khi đơn đã sang công đoạn sau (vd đang ở May) **KHÔNG còn kéo đơn tụt về sau Cắt** — con trỏ tiến độ giữ nguyên, chỉ tiến khi ghi đưa đơn tiến lên.

Quy trình khi vải về: mở lại đơn → **Kỹ thuật** thêm sơ đồ mới (khổ vải) → chọn **Cắt** ghi bổ sung → làm tiếp các công đoạn. Tổng cắt tự cộng dồn, đơn không bị tụt công đoạn.

**Cài:** copy `backend/routes/qlsx.js` → `pm2 restart qlnoibo`.

---

## BƯỚC 2.65 — Đơn khách đặt hàng: Sửa đơn + giữ bộ lọc + lọc theo mã hàng + khách gõ tự do (v5.49)

**KHÔNG migration.** Copy `backend/routes/khohang.js` + `frontend/js/module.khohang.js` → `pm2 restart qlnoibo` + Ctrl+F5.

- **Sửa đơn:** mỗi đơn có nút **Sửa** (sửa Tên khách / Mã hàng / Màu / SL / Đơn vị). Lưu xong tồn kho **tự tính lại** (hoàn số cũ, trừ số mới, kiểm đủ tồn trước khi ghi). Đơn "Đã hủy" chỉ sửa thông tin, không đụng tồn.
- **Giữ bộ lọc khi thao tác:** đổi trạng thái / giao xong / xóa / in phiếu **KHÔNG còn reset** bộ lọc — vẫn giữ đúng khách (và mã hàng) đang lọc.
- **Lọc theo mã hàng:** thêm ô lọc "mã hàng" — chọn 1 mã sẽ hiện **tất cả khách** đã đặt mã đó. Kết hợp được với lọc khách.
- **Khách gõ tự do / chọn danh sách:** ô Tên khách ở cả form Lên đơn và Sửa đơn cho **gõ tự do** hoặc **chọn từ danh sách khách đã có** (gợi ý).

**Cài:** copy 2 file trên → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.66 — Tách "Chỉ định NPL" ra tab riêng + cột Số mét (nhập/xuất vải + Chỉ định vải SX) (v5.50)

**CÓ migration: `migration_v646.sql`.** Chạy 1 lần (an toàn chạy lại). Sau đó copy 6 file + `pm2 restart qlnoibo` + Ctrl+F5.

**migration_v646.sql:**
- (1) Thêm ChucNang QLSX `chidinhnpl` → "Chỉ định NPL" thành 1 tab riêng trong Quản lý sản xuất (admin ẩn/hiện qua Phân quyền).
- (2) Thêm cột `SoMet` cho `VaiCay`, `PhieuXuatVaiChiTiet`, `ChiDinhVaiSX`.
- (3) Dựng lại view `vw_TonCayVai` (+SoMet — giữ nguyên KhoVai của v644).

**Thay đổi:**
1. **Chỉ định NPL = tab riêng:** trước nằm trong "Tài liệu may/Đóng gói", nay là 1 tab độc lập (cạnh "Chỉ định vải SX"). Chức năng bên trong (chọn đơn → thêm/xóa/in NPL) không đổi; quyền sửa vẫn theo ChucNang `tiendo`.
2. **Phiếu NHẬP vải + Số mét:** form tạo/sửa thêm ô "Số mét" mỗi cây; danh sách phiếu thêm cột "Tổng mét"; chi tiết + bản in + tồn theo cây hiển thị Số mét.
3. **Phiếu XUẤT vải + Số mét:** form tạo/sửa thêm ô "Số mét" mỗi dòng (tùy chọn); danh sách + chi tiết + bản in thêm cột Số mét.
4. **Chỉ định vải SX + Số mét:** form thêm ô "Số mét" mỗi dòng (lưu cùng SL yêu cầu/ĐVT).

**Cài:**
1. Chạy `database/migration_v646.sql`.
2. Copy: `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `backend/utils/vaiXuatService.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khovai.js`, `frontend/js/module.tailieukythuat.js`.
3. `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.67 — Combobox gõ-tìm toàn hệ thống + Chỉ định vải (In/Xem, kg+mét) + Số mét (xuất/tem) + tài liệu xuống dòng + đơn khách theo mã hàng (v5.51)

**KHÔNG migration mới** (dùng cột SoMet đã thêm ở v5.50/`migration_v646.sql` — nếu chưa chạy v646 thì chạy trước). Copy 7 file + `pm2 restart qlnoibo` + Ctrl+F5.

1. **Mọi ô chọn (dropdown) → gõ để tìm:** mọi `<select>` trong các form/hộp thoại giờ cho **gõ ký tự để lọc nhanh** trong danh sách (Loại vải, Màu ở Nhập kho vải & Danh mục vải, mã hàng, đơn hàng, NCC...). Vẫn chọn được như cũ; giá trị lưu KHÔNG đổi. Muốn tắt cho 1 ô: thêm thuộc tính `data-nosearch`. (Áp dụng cho các ô trong hộp thoại; ô lọc ngoài danh sách giữ nguyên.)
2. **Chỉ định vải SX:** thêm nút **Xem** + **In**; **bỏ ĐVT**; tách 2 cột **SL yêu cầu (kg)** + **SL yêu cầu (mét)**.
3. **Phiếu xuất kho vải:** bảng "Chỉ định vải SX (tham khảo)" thêm cột **Mét chỉ định** (+ tổng mét ở dòng tóm tắt); ô **Mã cây** hiển thị thêm **khổ vải + số mét**.
4. **Tem cây vải:** QR về **74mm** (in máy tính & in qua mạng) + thêm dòng **Số mét**. (In qua mạng ở backend → phải `pm2 restart`.)
5. **Phiếu tài liệu:** các ô nội dung (Tài liệu chung: tiêu đề/nội dung; Mô tả đường may/Quy cách/Hình ảnh: chú thích) cho **nhấn Enter xuống dòng** và giữ đúng khi in.
6. **Thẻ kho – Đơn khách đặt hàng:** thêm **Xuất phiếu theo mã hàng** (liệt kê mọi khách của mã đó, tự chuyển các đơn Chờ xử lý → Đã giao như xuất theo khách); **Chi tiết mã hàng → Lịch sử đặt hàng** nay có đủ **Sửa / Đổi trạng thái / In phiếu / Xóa**.

**Cài:** copy `frontend/js/common.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khovai.js`, `frontend/js/module.tailieukythuat.js`, `frontend/js/module.khohang.js`, `backend/routes/khovai.js`, `backend/routes/khohang.js` → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.68 — Sửa quyền Chỉ định NPL + Mã Rập + tem khổ vải + Thẻ kho (sửa mã hàng, ghi chú màu) (v5.52)

**CÓ migration: `migration_v647.sql`** (thêm cột GhiChu cho TheKhoChiTietMau — an toàn chạy lại). Copy 7 file + `pm2 restart qlnoibo` + Ctrl+F5.

**⚠️ LƯU Ý deploy v5.51:** "Tem QR 74mm" và "tem có Số mét" ĐÃ nằm trong code v5.51 — nếu chưa chạy v5.51 (đặc biệt **pm2 restart** cho phần in mạng) thì QR vẫn 100mm và tem chưa hiện số mét. Bản v5.52 này đã gồm cả v5.51.

1. **Chỉ định NPL — user được phân quyền TẠO/SỬA/XÓA được (không chỉ Admin):** trước modal NPL khóa theo quyền "Ghi tiến độ" (tiendo). Nay theo đúng ChucNang **"Chỉ định NPL" (chidinhnpl)**; route phụ kiện backend chấp nhận CẢ `tiendo` LẪN `chidinhnpl` (không ảnh hưởng công đoạn Phụ kiện trong Ghi tiến độ).
2. **Tem cây vải in máy tính có khổ vải + số mét:** khi in tem từ chi tiết phiếu nhập, bổ sung **khổ vải** (trước thiếu do dữ liệu phiếu nhập không trả khổ). Số mét đã có.
3. **Mã Rập:** Danh sách lệnh SX thêm cột **Mã Rập** (gộp từ mã rập các sơ đồ ở công đoạn Kỹ thuật — TỰ cập nhật khi Kỹ thuật nhập/sửa mã rập trong sơ đồ). Các phiếu lệnh SX thêm dòng **Mã rập**: In lệnh SX (1 màu/nhiều màu), Chỉ định vải SX (Xem/In), Phiếu báo cáo.
4. **Thẻ kho hàng hóa:** khi **Sửa** sửa được luôn **Mã hàng** (kiểm tra không trùng thẻ khác); Chi tiết theo màu thêm **Ghi chú** từng màu (sau ảnh) — ở form Tạo/Sửa và màn Lịch sử & chi tiết theo màu.

**Cài:**
1. Chạy `database/migration_v647.sql`.
2. Copy: `backend/middleware/auth.js`, `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `backend/routes/khohang.js`, `frontend/js/module.tailieukythuat.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khohang.js`.
3. `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.69 — Tên SP+Mã Rập ở form tài liệu + click Mã ĐH mở In lệnh SX + Chỉ định vải đơn vị + Tồn cây (mét) + đơn khách lọc trạng thái (v5.53)

**CÓ migration: `migration_v648.sql`** (dựng lại view vw_TonCayVai +MetDaXuat+MetCon — an toàn chạy lại). Copy 7 file + `pm2 restart qlnoibo` + Ctrl+F5.

**⚠️ Deploy quan trọng:** tem in QUA MẠNG (QR 74mm) là thay đổi **BACKEND** từ v5.51 — bắt buộc `pm2 restart` mới có hiệu lực (Ctrl+F5 không đủ). Tem in MÁY TÍNH có khổ vải + số mét cần bản này (bổ sung KhoVai) + Ctrl+F5.

1. **Tên sản phẩm + Mã Rập** hiển thị ở form Tạo/Sửa của: Chỉ định vải SX, Chỉ định NPL, tất cả bảng Tài liệu may/đóng gói + Tài liệu in thêu (Thông số đo, Mô tả đường may, Quy cách, Hình in thêu, 4 bảng Đơn giá), Bảng kê BTP. (Mã Rập gộp từ sơ đồ Kỹ thuật, tự cập nhật.)
2. **Click vào Mã ĐH** (ở các danh sách Tài liệu / Chỉ định vải SX / Bảng kê BTP) → mở phiếu **In lệnh sản xuất** để xem.
3. **Chỉ định vải SX:** thêm cột **Đơn vị** (chọn theo list: Kg / Mét / Cái / Bộ / Cuộn / Yard) cạnh "SL yêu cầu (kg)".
4. **Kho vải – Tồn theo cây:** thêm cột **Khổ vải, Số mét đã xuất, Số mét còn**. **Danh sách phiếu xuất + form tạo/sửa phiếu xuất:** bỏ **Chuyền** và **Mục đích**.
5. **Đơn khách đặt hàng:** thêm **lọc theo Trạng thái** (kết hợp với lọc khách + mã hàng).

**Cài:**
1. Chạy `database/migration_v648.sql`.
2. Copy: `backend/routes/tailieukythuat.js`, `backend/routes/bangke.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.tailieukythuat.js`, `frontend/js/module.bangkebtp.js`, `frontend/js/module.khovai.js`, `frontend/js/module.khohang.js`.
3. `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.70 — Chỉ định vải SX: nhiều bản có TÊN cho 1 đơn + hiển thị đơn vị (v5.54, đợt 1)

**CÓ migration: `migration_v649.sql`** (thêm cột `TenPhieu` cho `ChiDinhVaiSX` + `DonHangChiTietPhuKien` — an toàn chạy lại; NPL dùng cột này ở đợt sau). Copy 2 file + `pm2 restart` + Ctrl+F5.

- **Chỉ định vải SX — 1 đơn NHIỀU bản:** mở đơn → **danh sách các bản chỉ định** (mỗi bản 1 tên tự đặt, vd Áo / Quần / Đợt 1); nút **+ Thêm chỉ định** tạo bản mới; mỗi bản **Xem / In / Sửa / Xóa** riêng. Dữ liệu cũ gom thành 1 bản "(không tên)".
- **Hiển thị đơn vị:** bản Xem/In hiện "SL yêu cầu: 50 (kg)" hoặc "1 (cây)" theo đơn vị đã chọn ở chỉ định (cột SL mét vẫn riêng).

**Cài:** chạy `database/migration_v649.sql` → copy `backend/routes/qlsx.js` + `frontend/js/module.qlsx.js` → `pm2 restart qlnoibo` + Ctrl+F5.

**Đợt kế (nhân bản y hệt pattern "nhiều bản có tên"):** Chỉ định NPL; Tài liệu chung / Thông số đo / Mô tả / Quy cách / Hình in thêu; 4 bảng Đơn giá; Bảng kê BTP; + hiển thị đơn vị ở bảng "Chỉ định vải SX (tham khảo)" trong phiếu xuất; + chức năng **bổ sung sơ đồ** (chọn Mã ĐH → vào công đoạn Kỹ thuật → lưu sơ đồ → chạy tiếp luồng).

---

## BƯỚC 2.71 — Chỉ định NPL nhiều bản + đơn vị ở phiếu xuất + Bổ sung sơ đồ + fix cột "Chỉ định" (v5.54, đợt 2)

**KHÔNG migration mới** (dùng cột `TenPhieu` của `migration_v649.sql` — chạy nếu chưa). Copy 4 file + `pm2 restart` + Ctrl+F5.

1. **Chỉ định NPL — 1 đơn NHIỀU bản có tên** (giống Chỉ định vải SX): mở đơn → danh sách bản → **+ Thêm chỉ định NPL** / **Mở-Sửa** / **Xóa bản**. Dữ liệu cũ gom 1 bản "(không tên)".
2. **Đơn vị ở "Chỉ định vải SX (tham khảo)"** trong phiếu xuất kho: cột đổi thành **SL chỉ định** hiện kèm đơn vị (vd 50 (kg) / 1 (Cây)).
3. **Bổ sung sơ đồ:** tab mới **"Bổ sung sơ đồ"** — chọn Mã ĐH → mở thẳng Ghi tiến độ ở **công đoạn Kỹ thuật** (có ô Sơ đồ); lưu sơ đồ + bấm **Gửi** để chạy tiếp luồng.
4. **Fix:** cột "Chỉ định" ở danh sách Chỉ định vải SX nay hiện "Đã chỉ định" khi có **bất kỳ bản nào** (trước chỉ tính khi có SL kg > 0 nên bản khai theo mét/đơn vị khác bị coi là "Chưa").

**Cài:** copy `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.tailieukythuat.js` → `pm2 restart qlnoibo` + Ctrl+F5.

**Đợt cuối còn lại (cùng pattern "nhiều bản có tên"):** Tài liệu chung / Thông số đo / Mô tả / Quy cách / Hình in thêu / 4 bảng Đơn giá / Bảng kê BTP (các loại header-based: đổi lưu upsert-theo-đơn → nhiều bản + thêm cột Tên; migration bỏ unique index BTP).

---

## BƯỚC 2.72 — Fix Bảng kê BTP không mở được + phân quyền (bosungsodo) + BTP nhiều bản có tên (v5.55)

**CÓ migration: `migration_v650.sql`** (seed ChucNang `bosungsodo` + thêm cột `TenPhieu` cho tài liệu header + BTP + BỎ unique index "1 bản/đơn"). Copy 2 file + `pm2 restart` + Ctrl+F5.

1. **Fix "Bảng kê BTP — user thường không click/mở được":** route XEM của BTP không còn bắt buộc quyền chức năng riêng `bangkebtp` (đồng bộ với các tab tài liệu) → tài khoản có quyền **Xem** phân hệ QLSX là mở được; nếu bị chặn sẽ hiện thông báo thay vì trắng tab. **Nếu TAB BTP đang bị ẩn với 1 nhóm:** vào Phân quyền chức năng, tích "Xem — Bảng kê bán thành phẩm" cho nhóm đó rồi **đăng nhập lại**.
2. **Phân quyền:** thêm chức năng **"Bổ sung sơ đồ"** (bosungsodo) vào ma trận phân quyền. **v5.55.1:** tab "Bổ sung sơ đồ" trước bị chặn bởi quyền **TẠO** cấp phân hệ (nên cấp xem/sửa/xóa cho chức năng vẫn không hiện) — nay đẩy tab KHÔNG điều kiện, chỉ ẩn/hiện theo ChucNang 'bosungsodo' như các tab khác (copy `frontend/js/module.qlsx.js`).

> **LƯU Ý QUAN TRỌNG (áp dụng cho CẢ 2 lỗi trên):** quyền được **cache theo phiên đăng nhập**. Sau khi copy file + `pm2 restart` + tích quyền cho nhóm, user đó **phải ĐĂNG XUẤT / ĐĂNG NHẬP LẠI** thì tab + quyền mới có hiệu lực. Riêng lỗi Bảng kê BTP: bắt buộc **`pm2 restart`** (sửa nằm ở backend `bangke.js`) — nếu chưa restart thì vẫn 403/không mở được dù đã tích quyền.
3. **Bảng kê BTP — 1 đơn NHIỀU bản có tên:** mở đơn → **danh sách bản** → **+ Thêm bảng kê** / **Mở-Sửa** / **Xóa bản**; mỗi bản đặt tên riêng (dữ liệu cũ = 1 bản "(không tên)").
4. **Bổ sung sơ đồ — hiện HẾT lệnh đã qua Kỹ thuật (v5.55.2):** danh sách trước lấy theo công đoạn được phân của user (chỉ thấy đơn đang ở KT) → nay đổi nguồn sang route mới `GET /api/qlsx/orders-quakythuat` = **mọi lệnh SX đã từng ghi tiến độ công đoạn Kỹ thuật**, KHÔNG lọc theo công đoạn user (xuyên công đoạn), kèm cột **Số sơ đồ**. Chọn đơn → vào lại Kỹ thuật thêm sơ đồ (vd vải về đợt sau) → lưu sơ đồ + **Gửi**; con trỏ công đoạn KHÔNG bị kéo lùi (logic v5.48) nên đơn **vẫn giữ/đi tiếp** các công đoạn sau, sơ đồ mới cộng dồn xuống Cắt/May. **Điều kiện thao tác:** người bấm phải là **Admin/Quản lý** hoặc **được phân công công đoạn Kỹ thuật** (backend `canUpdateStage` chặn ghi tiến độ KT nếu không thuộc KT) — đây là chốt bảo mật, giữ nguyên.

**Cài:** chạy `database/migration_v650.sql` → copy `backend/routes/bangke.js`, `backend/routes/qlsx.js`, `frontend/js/module.bangkebtp.js`, `frontend/js/module.qlsx.js` → `pm2 restart qlnoibo` + Ctrl+F5.

---

## BƯỚC 2.73 — WAVE CUỐI "nhiều bản có tên": 3 loại tài liệu header + 4 bảng đơn giá; fix Bảng kê BTP không mở được form (v5.56)

**CÓ migration: `migration_v651.sql`** (thêm `TenPhieu` cho 4 bảng đơn giá + BỎ 2 ràng buộc UNIQUE `UQ_DonHangHangMucGiaCong`, `UQ_DGLaDongGoi` đang chặn nhiều bản). An toàn chạy lại nhiều lần.

1. **FIX "Bảng kê BTP: bấm + Thêm bảng kê / Mở / Sửa KHÔNG có gì xảy ra":** form BTP khi mở có gọi thêm API `/api/bangke/mau/list` (danh sách tài liệu mẫu) — route này VẪN còn khóa theo quyền chức năng `bangkebtp`, nên nhóm bị tắt "Xem – Bảng kê BTP" bị **403 giữa lúc mở form** → hàm mở form dừng lại **im lặng, không báo lỗi**. Đã sửa 3 lớp: (a) 2 route XEM mẫu bỏ khóa chức năng (giống các route xem khác từ v5.55); (b) lỗi lấy danh sách mẫu không còn chặn việc mở form; (c) mọi nút Thêm/Mở/Sửa nay **bọc bắt lỗi + hiện thông báo cụ thể** thay vì im lặng.
2. **"1 đơn — NHIỀU bản có tên" cho nốt 7 loại còn lại:** Tài liệu kỹ thuật chung, Thông số đo, Mô tả đường may, Quy cách đóng gói, Hình ảnh in/thêu, Đơn giá công đoạn may, Đơn giá giao gia công, Đơn giá là/đóng gói, Đơn giá in thêu. Bấm nút ở danh sách đơn → **danh sách BẢN** (Tên bản / Mở-Sửa / Xóa bản / **+ Thêm**); trong form có ô **Tên bản** (đổi tên tại đây = đổi tên bản). Dữ liệu cũ = **1 bản "(không tên)"**, không cần chuyển đổi gì.
3. **Danh sách đơn KHÔNG bị lặp dòng:** cột "Đã có" của 3 loại header trước dùng `LEFT JOIN` — có nhiều bản thì mỗi bản sẽ nhân thành 1 dòng đơn trùng; đã đổi sang `EXISTS` + `MAX(UpdatedAt)`.
4. **QUAN TRỌNG — tính LƯƠNG không đổi:** 4 bảng đơn giá là dữ liệu đầu vào tính lương (khoán may, gia công, in thêu, là/đóng gói). Nếu để nguyên các câu JOIN cũ thì có bao nhiêu bản sẽ nhân lên bấy nhiêu dòng → **tiền sai (gấp n lần)**. Đã sửa toàn bộ chỗ tiêu thụ (`payroll.js` lương gia công / in thêu / là-đóng gói; `qlsx.js` ô chọn công đoạn khi giao việc May, bảng hạng mục gia công, danh sách giao nhà gia công) sang lấy **DUY NHẤT 1 BẢN — "bản đầu tiên"** (ưu tiên bản không tên, sau đó theo thứ tự tên). ⇒ Với dữ liệu hiện tại (1 bản không tên) **kết quả lương y hệt trước khi nâng cấp**; các bản thêm về sau chỉ để tham khảo/đối chiếu, KHÔNG tự động vào lương.
   - **Quy ước cần biết:** muốn bản nào tính lương thì để bản đó là **bản KHÔNG TÊN**. Nếu muốn đổi quy tắc (vd chọn bản tính lương bằng 1 ô tích "Dùng tính lương"), báo lại để bổ sung.
   - Màn **Kỹ thuật → Hạng mục gia công** chỉ quản lý **bản không tên**; lưu ở đó không còn xóa mất các bản có tên tạo từ tab Tài liệu may.
5. **In tài liệu (In tất cả / in từng loại):** vẫn in **bản đầu tiên** của mỗi loại (chưa có chọn bản khi in) — nếu cần in theo từng bản, báo để bổ sung.

**Cài:** chạy `database/migration_v651.sql` → copy `backend/routes/tailieukythuat.js`, `backend/routes/bangke.js`, `backend/routes/qlsx.js`, `backend/routes/payroll.js`, `frontend/js/module.tailieukythuat.js`, `frontend/js/module.bangkebtp.js`, `frontend/js/module.qlsx.js` → **`pm2 restart qlnoibo`** + Ctrl+F5.

---

## BƯỚC 2.75 — TỰ CHỮA lỗi BTP (migration_v652) + nút In theo từng bản + Mã rập trên bản in + đơn đặt hàng 1 mã hàng nhiều màu (v5.57)

**CÓ migration: `migration_v652.sql`** — bổ sung các cột còn THIẾU (`LaMau`/`TenMau` của `TaiLieuThongSoDo`, `Loai`/`LaMau`/`TenMau`/`ChuY` của `TaiLieuMoTaSanPham`, v.v.). **Đây là nghi phạm số 1 của lỗi "Bảng kê BTP bấm Thêm/Mở/Sửa không hoạt động":** form BTP đọc cột size từ Thông số đo bằng `ISNULL(t.LaMau,0)=0`; nếu DB chưa có cột `LaMau` (chưa chạy `migration_v534e`) thì câu SQL lỗi → route async ném lỗi → **sập tiến trình backend** → request không có phản hồi → nút "không có gì xảy ra". Cuối script có bảng báo cáo trạng thái cột — gửi lại nếu còn lỗi.

1. **Nút In cho TỪNG BẢN (mọi loại tài liệu):** trong danh sách bản của Tài liệu kỹ thuật chung / Thông số đo / Mô tả đường may / Quy cách đóng gói / Hình in thêu / **4 loại Đơn giá** / **Bảng kê BTP** — mỗi bản có bộ nút **Mở-Sửa · 🖨️ In · Xóa bản**; in được ngay không cần mở form.
2. **Mã rập trên MỌI bản in tài liệu:** thêm khối thông tin dùng chung (Mã hàng / Ngày cập nhật / **Mã rập** / Người lập / Diễn giải / **Bản**) cho tài liệu chung, thông số đo, mô tả·quy cách·hình in thêu. Bảng kê BTP thêm dòng **Tên sản phẩm + Mã rập + Bản**. 4 loại đơn giá nay **in được** kèm Mã lệnh SX / Tên SP / Mã rập / Bản.
3. **Lên đơn đặt hàng — 1 mã hàng thêm được NHIỀU MÀU:** mỗi dòng có nút **"+ Màu"** → chèn dòng mới ngay dưới, **giữ nguyên mã hàng**, tự chọn màu chưa dùng của mã hàng đó (hết màu thì báo). Có chặn trùng (cùng mã hàng + cùng màu) và chặn dòng chưa chọn màu. Không đổi API/backend.

**Cài:** chạy `database/migration_v652.sql` → copy `frontend/js/module.tailieukythuat.js`, `frontend/js/module.bangkebtp.js`, `frontend/js/module.khohang.js` (+ các file ở BƯỚC 2.74 nếu chưa copy) → **`pm2 restart qlnoibo`** + Ctrl+F5.

---

## BƯỚC 2.86 — THÔNG BÁO ĐẨY (Web Push) — v5.67

**CÓ migration: `migration_v659.sql`** (bảng `PushSubscription`). **Cần `npm install web-push`** + sinh khoá VAPID (`node backend/utils/taoVapidKeys.js`, dán vào `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) → `pm2 restart qlnoibo`.

Chi tiết đầy đủ (kể cả vì sao **bắt buộc HTTPS** nên máy LAN dùng `http://` không bật được, và 2 điểm duy nhất trong hệ thống sinh thông báo): xem **`HUONG_DAN_v5.67_THONG_BAO_DAY.md`**.

---

## BƯỚC 2.87 — ÉP HTTPS + OTP 1 THÁNG/THIẾT BỊ + GIAO GIA CÔNG TRƯỚC KHAI GIÁ SAU (v5.68) và các bản UI v5.69–v5.81

**Không migration.** Các mốc chính (mỗi mục có file hướng dẫn riêng khi cần):

| Bản | Nội dung | Ghi chú cài |
|---|---|---|
| v5.68 | Tự chuyển sang **https** (`HTTPS_HOSTS`, **không** ép LAN, không ép POST); Cloudflare Access Session Duration = **1 month** (OTP chỉ hỏi lần đầu/thiết bị); **bỏ chặn "phải khai Đơn giá giao gia công trước"** — khai giá sau vẫn tự áp vào việc đã giao | `HUONG_DAN_v5.68_HTTPS_OTP_GIACONG.md`, `pm2 restart` |
| v5.69 | Chỉ định vải SX → nút lập luôn **Phiếu xuất kho vải** | copy 2 file FE |
| v5.70 | Quét QR **tra cứu** cây vải; Chỉ định vải SX có trạng thái **Chưa/Một phần/Đã xuất kho** | route `tracuu-macay` |
| v5.71–5.73 | Quét QR bằng camera **chỉ chạy trên HTTPS** → hướng dẫn bật HTTPS nội bộ cho máy tính bảng | `HUONG_DAN_v5.71_HTTPS_NOI_BO_QUET_QR.md`, `HUONG_DAN_v5.72_QUET_QR_MAY_TINH_BANG.md` |
| v5.74–5.75 | Tem QR nhỏ còn **50%**; tem in qua **máy in mạng** không còn to chữ/mất chữ (tự co chữ vì `measureText` của pureimage không tin được) | `pm2 restart` (in ở backend) |
| v5.76–5.77 | Phiếu xuất tự điền **Đơn hàng sản xuất** + đổi "Mã đơn hàng" → **Mã rập**; Cloudflare 521 → đặt SSL **Flexible** | `CHAN_DOAN_CLOUDFLARE_521.md` |
| v5.78 | Phiếu nhập kho vải: **bỏ Mã cây (QR)** trở lại như cũ; Loại vải/Màu rộng ×3, các cột số thu hẹp | copy FE |
| v5.79–5.80 | Phiếu nhập/xuất vải: **bảng thật** (1 hàng tiêu đề + các dòng nhập), cỡ chữ tiêu đề bình thường, thêm dòng là **con trỏ nhảy vào cột đầu** | copy FE + CSS |
| v5.81 | Đơn khách đặt hàng: **ô lọc ngay trên tiêu đề cột** + ô tích chọn dòng + **In dòng đang hiện / In dòng đã chọn**; sửa "hàng đầu bị che" ở phiếu nhập/xuất/Bảng kê BTP; cuộn **trong** bảng nhập liệu | copy FE + CSS |

---

## BƯỚC 3.45 — Chuyển hết ĐVT chính "Ri" sang "Cái" + thêm ĐVT "Bộ" (v6.27)

**Copy 3 file**: `backend/utils/sua_don_vi_the_kho.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.27`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

### 1. Chuyển hết mã hàng đang quản theo Ri sang Cái

```
cd backend
node utils/sua_don_vi_the_kho.js --tat-ca-ri          (chạy thử — xem trước từng mã)
node utils/sua_don_vi_the_kho.js --tat-ca-ri --ghi
```

Lệnh tự chọn đúng cách cho từng mã: `LoaiRi > 1` thì đổi nhãn **và nhân số liệu** với hệ số; `LoaiRi ≤ 1` thì chỉ đổi nhãn (1 Ri = 1 Cái). Ri → Cái luôn là phép **nhân** nên không bao giờ vướng lỗi "không chia hết". Mỗi mã có file backup JSON riêng trong `backend/backup/` và chạy trong transaction riêng — mã nào lỗi thì các mã khác vẫn chạy tiếp.

**Sau khi chuyển:**

- Hết lỗi làm tròn khi bán lẻ vài cái (trước đây 7 cái ÷ ri 6 làm tròn thành 1 ri → trừ thiếu 1 cái).
- Hết cảnh báo lệch đơn vị ở phân hệ Báo cáo.
- **Màn hình vẫn xem được theo ri** — cột "ĐVT (Ri)" hiện `23 Ri6 dư 2` như cũ, vì `LoaiRi` không đổi.
- Đơn khách đặt / phiếu bán hàng cũ đã ghi "Ri" vẫn đúng, hệ thống tự quy đổi khi đọc. Không phải sửa tay.
- Giá bán không đổi — `GiaBan` vốn đã là giá 1 **cái**.

Kiểm lại sau khi chạy: `node utils/sua_don_vi_the_kho.js --liet-ke` và `node utils/kiem_ton_am.js`.

### 2. Thêm đơn vị tính "Bộ"

Ô **Đơn vị tính chính** và **Đơn vị quy đổi** khi tạo/sửa thẻ kho nay có thêm **Bộ**.

**Bộ là đơn vị GỐC, xử lý y hệt Cái** — tồn lưu 1:1, không nhân/chia hệ số. Khác với **Ri** là đơn vị GỘP (phải nhân/chia `LoaiRi`). Ví dụ: đặt ĐVT chính = Bộ, ĐVT quy đổi = Ri, tỷ lệ 5 → tồn 12 bộ hiện "2 Ri5 dư 2 Bộ".

Ô "Đơn vị" trên đơn khách đặt cũng tự đổi nhãn theo mã hàng đang chọn (Cái hay Bộ), thay vì luôn ghi "Cái".

### 3. Phiếu bán hàng ghi theo đơn vị tính chính

Trước đây phiếu bán hàng ghi cứng "Cái" ở mọi chỗ. Nay lấy theo **ĐVT chính của từng mã hàng**:

- **Form nhập**: ô số lượng có nhãn ĐVT ngay bên cạnh, tự đổi khi chọn mã hàng khác. Tiêu đề cột là "Số lượng" và "Giá bán lẻ (đ/ĐVT chính)".
- **Bản in**: cột ĐVT lấy đúng đơn vị từng dòng; tiêu đề giá ghi `(đ/Bộ)` hay `(đ/Cái)` theo phiếu.
- **Dòng TỔNG CỘNG**: chỉ ghi đơn vị khi cả phiếu cùng một ĐVT. Phiếu lẫn Cái với Bộ thì bỏ trống — cộng hai đơn vị khác nhau vào một con số là vô nghĩa.
- Màn chọn đơn khách đặt cũng hiện đúng ĐVT thay vì "Tồn kho (Cái)".

**Không phép tính nào thay đổi.** `SoLuongCai` và `GiaBanLe` vốn đã tính theo đơn vị gốc của mã hàng — với mã ĐVT chính = Bộ thì đó chính là số bộ và giá 1 bộ. Đây thuần túy là đổi nhãn hiển thị. Mã quản theo **Ri** vẫn ghi "Cái" vì Ri là đơn vị gộp, số lượng lưu vẫn là số cái.

---

## BƯỚC 3.75 — Báo giá Aloha lấy thẳng Giá bán, bỏ ô "Giá Aloha" ở Thẻ kho (v6.61)

```
Copy backend/routes/khohang.js, frontend/js/module.khohang.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration. **Cột `TheKhoHangHoa.GiaAloha` vẫn giữ nguyên trong CSDL** — dữ liệu cũ không mất, chỉ là không dùng và không cho nhập nữa.

- **Báo giá Aloha** (danh sách chọn mã hàng, xem/in, xuất Excel) nay đọc `h.GiaBan AS GiaAloha`. Giữ nguyên **alias** nên frontend, bản in và file Excel không phải sửa theo.
- **Form Tạo/Sửa thẻ kho**: bỏ ô "Giá Aloha". Không gửi trường này lên nữa; backend đã bọc `ISNULL(@GiaAloha, GiaAloha)` từ v5.41.1 nên giá trị cũ trong CSDL giữ nguyên.
- **Xuất Excel Thẻ kho**: bỏ cột "Giá Aloha".
- Nhãn "(chưa có Giá Aloha)" ở màn chọn mã hàng đổi thành "(chưa có Giá bán)".

**Vì sao đáng bỏ:** hai ô giá song song luôn lệch nhau. Sửa giá bán mà quên sửa giá Aloha là **báo giá gửi khách sai giá**, và không có gì báo — chỉ khách phát hiện.

---

## BƯỚC 3.74 — Bảng kê BTP lấy nhầm vải PHỐI (v6.60)

```
Copy backend/routes/bangke.js
pm2 restart qlnoibo
```

Không migration, không đụng frontend.

**Triệu chứng:** lệnh SX dùng **cùng một loại vải** cho cả vải chính lẫn vải phối → bảng kê BTP lấy luôn phần phối vào.

**Nguyên nhân:** điều kiện lọc "vải chính" chỉ xét **phiếu xuất kho** — cây nào có ít nhất một dòng `KieuVai = 'Chính'` thuộc đơn đó là được tính. Nhưng cùng loại vải thì kho hay **xuất chung một cây**, nên chỉ cần cây đó kèm một dòng 'Chính' là **toàn bộ số lớp cắt** của cây (gồm cả phần cắt cho phối) chảy vào bảng BTP.

**Sửa (v6.60.1):** **loại ra** màu nào được khai rõ là **Phối** trong Cấu trúc vải của chính đơn đó (`NOT EXISTS ... cv.Kieu = N'Phối'`). Cấu trúc vải mới là nơi khai rõ màu nào chính / màu nào phối — phiếu xuất chỉ nói cây đó được lấy ra làm gì trong một lần xuất.

⚠️ **Bản v6.60 đầu tiên viết ngược và làm hỏng nút "lấy màu từ sổ cắt"** — nó *bắt buộc* màu phải nằm trong danh sách màu Chính. Nhưng từ **v6.43** màu ở Ra lệnh SX gõ tự do được (lưu `TenMauTuDo`, `MauSacID = NULL`), nên lệnh nào khai màu tự do là không có `MauSacID` để khớp → lọc sạch → bảng kê trống trơn, nhìn như nút chết. Nay đảo thành `NOT EXISTS`: chỉ gạt màu **khai rõ là Phối**, lệnh không khai gì thì giữ nguyên hành vi cũ, không bao giờ ra bảng rỗng.

⚠️ **Giới hạn còn lại:** nếu vải chính và vải phối **trùng cả loại lẫn màu** thì không tách được — chúng là cùng một dòng trong mọi bảng. Trường hợp đó phải khai màu khác nhau (hoặc thêm hậu tố ở tên màu) mới phân biệt được.

---

## BƯỚC 3.73 — Sửa phiếu KHÔNG được đụng vào trường mình không sửa (v6.58)

```
Copy backend/routes/khovai.js, backend/routes/qlsx.js
pm2 restart qlnoibo
```

Không migration, không đụng frontend.

### Đã sửa

**① MẤT DỮ LIỆU — `VaiCay.ViTriKho` bị xóa trắng** (`khovai.js`, PUT `/nhap/:id`)

Form Sửa phiếu nhập vải **không có ô "Vị trí kho"**, nên `line.viTriKho` luôn `undefined`, mà câu UPDATE lại ghi `line.viTriKho || null` cho **mọi** cây trong phiếu. Chỉ cần mở phiếu, thêm 1 cây, bấm Lưu → vị trí kho của **tất cả** cây trong phiếu về NULL.

Dữ liệu này do nhập tồn đầu kỳ từ Excel đưa vào (`utils/nhap_ton_vai_excel.js`) — mất là không dựng lại được.

**Sửa:** cột nào client **không gửi** thì dùng `ISNULL(@x, Cot)` giữ nguyên giá trị cũ; cột nào có gửi thì ghi đè bình thường (kể cả ghi về rỗng). Muốn xóa thì gửi chuỗi rỗng, không phải bỏ trống.

**② SAI SỐ LIỆU — `TrangThai` cây vải không được tính lại** (`khovai.js`, PUT `/nhap/:id`)

Sửa KG nhập nhưng không tính lại trạng thái: cây đang `Hết` mà tăng KG lên vẫn nằm `Hết`; cây `Nguyên cây` giảm KG xuống dưới số đã xuất vẫn ghi `Nguyên cây`. `TrangThai` là **cột lưu sẵn**, mọi màn tồn / quét mã đọc theo nên sai theo.

Công thức này trước nằm rải rác **3 chỗ** (PUT `/xuat/:id`, DELETE `/xuat/:id`, `vaiXuatService.js`) và PUT `/nhap/:id` thì quên hẳn. Nay gom vào **một hàm `capNhatTrangThaiCay()`** — sau này sửa công thức chỉ phải sửa một lần.

**③ MẤT DỮ LIỆU — ghi chú dòng vải PHỐI** (`qlsx.js`, PUT `/orders/:maDH`)

Bảng `DonHangChiTietVai` bị xóa rồi chèn lại mỗi lần lưu lệnh. Dòng **Chính** có chèn lại cột `GhiChu`, dòng **Phối** thì thiếu → ghi chú vải phối bay sạch mỗi lần ai đó bấm Lưu lệnh.

### Đợt 2 (v6.59) — đã sửa nốt

```
Copy backend/routes/khovai.js, backend/routes/phukien.js, backend/routes/congno.js,
     frontend/js/module.khovai.js
pm2 restart qlnoibo  +  Ctrl+F5
```

**④ `VaiCay.NgayNhap` lệch đầu phiếu** — đổi ngày phiếu thì cây **cũ** giữ ngày cũ, cây **mới** lấy ngày mới → cùng một phiếu 2 dải mã cây khác ngày, bản in tem và báo cáo theo ngày nhập lệch. Nay mọi cây trong phiếu đồng bộ theo ngày ở đầu phiếu.

**⑤ Select Loại vải / Màu không có option rỗng** *(nguy hiểm nhất nhóm — đổi dữ liệu mà không báo)*. `opt()` không tự sinh option rỗng, nên nếu `LoaiVaiID` đã lưu **không còn trong danh mục** (loại vải bị xóa/gộp) thì `<select>` rơi về **mục đầu tiên**; bấm Lưu là đổi im lặng loại vải của dòng đó.

Sửa hai lớp: form có `<option value="">` + `required` (trình duyệt chặn ngay, người dùng thấy ô trống để chọn lại), và `resolveOrCreateVaiId()` **từ chối** khi thiếu loại vải/màu thay vì âm thầm đi tạo mã vải rác.

**⑥ `DonGia` phụ kiện bị ghi NULL** — xóa-rồi-chèn-lại, mà form Sửa phiếu **xuất** không có ô đơn giá. Nay đọc giá cũ theo `(PhieuID, PhuKienID)` **trước khi xóa**, client không gửi thì lùi về giá đó.

**⑧ `congno.js` PUT phiếu thu / phiếu chi** — trường nào client không gửi thì `ISNULL` giữ nguyên; gửi rồi mới ghi đè, kể cả ghi về rỗng.

### ⑦ — KHÔNG phải lỗi, không sửa

`qlsx.js` PUT `/dinhmuc/:maDH` ghi `MauHang = order.TenSanPham` là **cố ý**. Từ **v6.04** định mức khai theo LỆNH SX, không còn khớp chuỗi `MauHang ↔ TenSanPham` nữa; cột này chỉ giữ lại cho tương thích schema (`NOT NULL`) và route cũ. Không có ô nào cho người dùng gõ vào đó.

**Làm đúng chuẩn để noi theo:** `khovai.js` PUT `/xuat/:id` — validate toàn bộ trước khi ghi, dùng `hasOwnProperty` để không đụng cột không gửi, tính lại `TrangThai` cả trước lẫn sau. Và `banhang.js` PUT `/phieu/:id` — một transaction, kiểm tra tồn trước khi gỡ, `ISNULL` giữ giá trị cũ.

---

## BƯỚC 3.72 — Thống nhất SỐ PHIẾU kho vải: NKV- / XKV- (v6.57)

```
Copy backend/routes/congno.js, frontend/js/module.khovai.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration. Số phiếu chỉ là **cách hiển thị** từ khóa chính (`PhieuNhapID` / `PhieuXuatID`), không lưu trong CSDL — nên đổi tiền tố không đụng dữ liệu cũ, phiếu cũ tự hiện theo dạng mới.

| Chứng từ | Trước | Nay |
|---|---|---|
| Nhập kho vải | `NK-09126` | **`NKV-09126`** |
| Xuất kho vải | `XK-00042` | **`XKV-00042`** |
| Nhập kho phụ kiện | `NPK-00001` | giữ nguyên |
| Xuất kho phụ kiện | `XPK-00001` | giữ nguyên |

Vải để `NK-`/`XK-` trong khi phụ kiện là `NPK-`/`XPK-` thì hai loại phiếu nhìn na ná nhau, đối chiếu dễ lẫn — nhất là khi hai loại nằm chung một sổ công nợ nhà cung cấp.

Sổ công nợ NCC và tiêu đề popup chi tiết cũng đổi theo (`congno.js`) — sửa cùng lượt để hai màn hình không lệch nhau lần nữa.

---

## BƯỚC 3.71 — Xóa mã phụ kiện; phiếu thu/chi bấm số phiếu xem chi tiết + in (v6.56)

```
Copy frontend/js/module.phukien.js, frontend/js/module.congno.js, frontend/index.html
Ctrl+F5   (không cần restart pm2 — chỉ frontend)
```

Không migration.

### 1. Danh mục phụ kiện: nút Xóa

Backend **đã có sẵn** `DELETE /api/phukien/items/:id` từ trước, chỉ thiếu nút trên màn hình. Nút hiện theo quyền **Xóa** của phân hệ Phụ kiện, có hỏi lại kèm mã + tên.

Mã **đã phát sinh phiếu nhập/xuất** sẽ bị khóa ngoại của SQL Server chặn — backend bắt lỗi đó và trả câu giải thích. **Cố ý không xóa chứng từ theo:** xóa mã cho gọn danh mục mà mất luôn phiếu nhập/xuất thì tồn kho và công nợ lệch ngay.

Xóa xong đặt lại `dm = null` để lần vẽ sau tải lại danh mục. Chỉ gán `dm.phuKien = null` là hỏng — nhiều chỗ khác gọi thẳng `dm.phuKien.filter/.map`, gặp `null` là văng lỗi giữa chừng.

### 2. Phiếu thu / phiếu chi: bấm số phiếu

Ở tab **Phiếu thu** và **Phiếu chi**, cột Số phiếu bấm được → popup chi tiết, trong popup có **🖨️ In phiếu**.

Dùng lại đúng popup và hàm in đã có (`xemChungTu` + `inPhieuThuChi`) chứ không viết bản thứ hai — cùng một chứng từ mà hai chỗ hiển thị khác nhau là chuyện sớm muộn.

---

## BƯỚC 3.70 — Sổ công nợ: bấm số phiếu xem được MỌI loại chứng từ (v6.55)

```
Copy backend/routes/congno.js, frontend/js/module.congno.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration.

v6.52 mới cho bấm **phiếu bán hàng**. Nay bấm được cả:

| Sổ | Loại chứng từ bấm được |
|---|---|
| **Công nợ khách hàng** | Phiếu bán hàng · **Phiếu thu** |
| **Công nợ nhà cung cấp** | **Nhập vải** · **Nhập phụ kiện** · **Phiếu chi** |

Dòng **Điều chỉnh** vẫn để chữ thường — nó không phải chứng từ có màn chi tiết, cho bấm rồi báo lỗi thì tệ hơn.

**Cách làm:** backend trả kèm `CtLoai` (`PBH`/`PT`/`PC`/`PNV`/`PNPK`) + `CtID` trên từng dòng sổ, và có route mới `GET /api/congno/chungtu?loai=&id=` trả `{ tieuDe, header, dong[] }` cho 4 loại. Frontend gom vào **một hàm `oSoPhieu()` + một popup dùng chung** cho cả hai sổ — hai sổ dùng chung mã nên không trôi khỏi nhau như đã xảy ra với "Đặt hàng nhanh".

Phiếu nhập vải / phụ kiện hiện đủ bảng dòng (mã, tên, SL, ĐVT, đơn giá, thành tiền) + dòng tổng, để đối chiếu ngay với số phát sinh trên sổ.

**Quyền:** route chỉ cần `CONGNO/view`. Người xem sổ công nợ phải xem được chứng từ tạo ra số đó — không thể bắt họ phải có thêm quyền phân hệ Kho vải / Phụ kiện mới mở nổi dòng nợ của chính mình.

---

## BƯỚC 3.69 — Phiếu thu CHUYỂN THẲNG cho NCC / chi phí (v6.54)

```
1) Chạy database/migration_v675.sql
2) Copy backend/routes/congno.js, frontend/js/module.congno.js, frontend/index.html
3) pm2 restart qlnoibo  +  Ctrl+F5
```

**Nghiệp vụ:** khách trả tiền nhưng chuyển **thẳng** cho nhà cung cấp, hoặc trả hộ một khoản chi phí. Tiền không hề đi qua quỹ của mình.

### Dùng thế nào

Ở form **Tạo phiếu thu**, ô **Hình thức** chọn **"Chuyển thẳng (không qua quỹ)"** → hiện ô chọn **Nhà cung cấp** *hoặc* **Loại chi phí** (chọn một trong hai). Lưu xong hệ thống báo luôn số phiếu chi vừa tự tạo.

### Ghi sổ

| Chứng từ | Tác dụng |
|---|---|
| Phiếu thu | Giảm công nợ **khách hàng** |
| Phiếu chi (tự sinh, cùng ngày/số tiền) | Giảm công nợ **NCC**, hoặc ghi vào **loại chi phí** |

Sổ quỹ cộng phiếu thu rồi trừ phiếu chi → **số dư không đổi**, mà công nợ hai đầu đều đúng và vẫn còn đủ chứng từ để đối chiếu.

**Vì sao không chọn cách "1 phiếu thu, đánh dấu không qua quỹ":** công nợ NCC đang tính từ **phiếu chi** (`congNoNCC` trong `congno.js`). Nếu khoản này chỉ nằm ở phiếu thu thì phải sửa thêm ở mọi chỗ đọc công nợ NCC, sổ quỹ, báo cáo tài chính — sót một chỗ là lệch mà không ai biết.

### Ràng buộc để cặp phiếu không lệch nhau

| Thao tác | Kết quả |
|---|---|
| **Xóa** phiếu thu chuyển thẳng | Xóa luôn phiếu chi đi kèm |
| **Sửa** phiếu thu chuyển thẳng | Bị chặn — xóa rồi lập lại |
| **Sửa / xóa** phiếu chi được sinh ra | Bị chặn, chỉ rõ phải thao tác ở phiếu thu nào |

Để lại phiếu chi mồ côi là công nợ NCC bị giảm bởi một khoản không còn nguồn — kiểu lệch không ai tự tìm ra.

Nếu chọn "Chuyển thẳng" mà không chọn đối tượng nhận, backend **gỡ luôn phiếu thu vừa ghi** rồi báo lỗi — không để lại phiếu thu "chuyển thẳng" mà chẳng chuyển cho ai.

Chưa chạy `migration_v675.sql` thì phần mềm vẫn chạy bình thường, chỉ là chọn "Chuyển thẳng" sẽ không sinh phiếu chi (dò cột trước khi dùng, giống cách `coBangTKNH` / `coCotLoaiPhieu` đang làm).

---

## BƯỚC 3.68 — Sổ công nợ: bấm số phiếu xem chi tiết, Excel có đầu trang + tên khách trong tên file (v6.52)

```
Copy backend/routes/congno.js, frontend/js/module.congno.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration.

### 1. Bấm số phiếu trong sổ chi tiết

Dòng **Phiếu bán hàng** có số phiếu bấm được → mở popup chi tiết: đủ dòng hàng (mã, tên, màu, SL, ĐVT, giá bán lẻ, %CK shop, giá bán, thành tiền) + khối tổng và Đã thu. Đóng thì quay lại đúng sổ đang xem.

Dòng **Phiếu thu / Điều chỉnh / Nhập vải / Nhập phụ kiện / Phiếu chi** để chữ thường, không bấm được — chưa có màn chi tiết riêng cho chúng, làm cho bấm được rồi báo lỗi thì tệ hơn.

Popup tự dựng trong `module.congno.js` chứ không gọi sang màn Thẻ kho: hàm xem bên đó gắn với `perm` và bộ nút Sửa/Hủy/Xóa của chính nó — gọi chéo là kéo theo cả mớ nút mà người xem sổ công nợ có thể không có quyền dùng.

### 2. Excel có đầu trang

Mọi sheet công nợ giờ có khối đầu: **tên công ty · địa chỉ · tiêu đề · tên khách/NCC · ngày xuất**.

⚠️ Kèm theo phải sửa công thức tổng: có đầu trang thì dòng dữ liệu **không còn bắt đầu ở dòng 2**, nên `SUM` lấy mốc động (`ws.rowCount + 1` trước khi đổ dữ liệu). Để nguyên `SUM(...2:...)` là tổng cộng nhầm cả mấy dòng tiêu đề.

Tên công ty đang để cứng trong `congno.js` (`CONG_TY` / `DIA_CHI`), khớp với đầu phiếu in ở `common.js`. Đổi tên công ty thì sửa cả hai chỗ.

### 3. Tên file có tên khách hàng

Server vẫn đặt tên `cong_no_<tên khách>.xlsx` từ v6.47, nhưng **frontend ghi đè mất**: `taiFile()` gán cứng `a.download = ten`. Nay đọc tên từ header `Content-Disposition`, không đọc được mới lùi về tên chung.

---

## BƯỚC 3.67 — Dashboard: ô "Trễ hạn" luôn bằng 0 (v6.50)

```
Copy backend/routes/qlsx.js, frontend/js/module.qlsx.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration.

**Triệu chứng:** danh sách lệnh SX báo 19 lệnh quá hạn, Dashboard vẫn hiện **0**.

**Nguyên nhân:** Dashboard đếm `TrangThai === 'Trễ hạn'`. Nhưng **không có chỗ nào trong hệ thống ghi trạng thái đó vào CSDL** — `utils/checkOverdue.js` chỉ đọc ngày giao rồi **gửi email**, không `UPDATE TrangThai`. Nên ô này đứng im ở 0 từ đầu, kể cả khi cả chục lệnh đã quá hạn. Nút "🔔 Kiểm tra & gửi cảnh báo trễ hạn ngay" cũng chỉ gửi mail, bấm xong ô vẫn 0.

**Sửa:** đếm **sống từ `NgayGiaoDuKien`**, đúng cùng luật với danh sách lệnh SX (BƯỚC 3.65) — một định nghĩa duy nhất, hai màn hình không vênh nhau được nữa.

- Bấm ô **Trễ hạn** giờ lọc theo nhóm hạn tính sống, không lọc theo `TrangThai` (lọc theo trạng thái thì popup ra rỗng).
- Thêm ô **Sắp đến hạn (≤5 ngày)** cho khớp danh sách.
- Backend trả thêm `soonDue` và gắn `NhomHan` (`'qua'` / `'sap'` / `''`) vào từng đơn.

Trạng thái `'Trễ hạn'` vẫn còn trong danh mục màu badge — lệnh nào được đặt tay sang trạng thái đó vẫn hiển thị bình thường, chỉ là ô đếm không dựa vào nó nữa.

---

## BƯỚC 3.66 — Form Sửa lệnh bỏ khóa theo công đoạn, thanh cảnh báo dính, giữ màu khi rê chuột (v6.49)

```
Copy backend/routes/qlsx.js, frontend/js/module.qlsx.js,
     frontend/css/style.css, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration. **Danh sách lệnh SX vẫn CHỈ HIỂN THỊ** — muốn sửa thì bấm nút **Sửa** để mở form chi tiết.

### 1. Form Sửa lệnh: bỏ khóa theo công đoạn

Trước đây màu chính **đã có tiến độ** (Giao vải / Cắt / May…) bị khóa hai lớp: ô Loại vải để `readonly`, và nút xóa màu bị chặn cả ở frontend lẫn backend. Nay bỏ cả hai — **lệnh đang ở công đoạn nào cũng sửa được**.

⚠️ **Cái giá phải biết:** tiến độ đã ghi (`TienDoChiTietMau`, sổ cắt, lương khoán may) vẫn trỏ tới `MauSacID` vừa bị gỡ khỏi cấu trúc vải. Số liệu **không mất**, nhưng không còn dòng cấu trúc vải tương ứng để đối chiếu — bảng theo màu sẽ còn dòng "mồ côi".

Hai lớp giảm nhẹ:

- Xóa màu đã có tiến độ thì **hỏi lại một câu** nêu rõ hậu quả. Chặn cứng thì không sửa nổi lệnh khai sai màu; im lặng cho xóa thì số lệch mà không ai biết vì sao.
- Backend **ghi log cảnh báo** (`console.warn`) kèm mã lệnh, danh sách màu và người sửa — để còn lần ra khi số liệu lệch.

### 2. Thanh cảnh báo dính khi cuộn

Gói phần chú giải + 3 con số vào `<div class="toolbar">` để dùng luôn cơ chế thanh dính sẵn có (`capNhatThanhCongCuDinh` trong common.js): nó tự gắn `.sticky-bar` và đo chiều cao gán vào `--bar-h`, nhờ đó dòng tiêu đề bảng tự tụt xuống dưới. Tự viết `position:sticky` thì thanh và tiêu đề bảng dính cùng một mốc, tiêu đề chui xuống dưới mất hút.

### 3. Rê chuột không làm mất màu cảnh báo

Nền chuyển từ `<tr>` sang class `.dl-qua` / `.dl-sap` tô ở `<td>`. Quy tắc `:hover` của bảng cũng nhắm vào `<td>`, mà nền `<td>` nằm **đè lên** nền `<tr>` — nên đặt ở `<tr>` thì rê chuột vào là màu cảnh báo biến mất, đúng lúc đang nhìn. Dòng `:hover` lặp lại đúng màu đó để rê chuột không đổi gì.

---

## BƯỚC 3.65 — Danh sách lệnh SX: cột Ngày ra lệnh + cảnh báo deadline (v6.48)

**Chỉ frontend.** Copy `frontend/js/module.qlsx.js` + `frontend/index.html`, Ctrl+F5. Backend đã trả sẵn `NgayDat`, không phải sửa gì.

- Thêm cột **Ngày ra lệnh** (đặt trước cột Ngày giao).
- Tô màu dòng theo Ngày giao:

| Tình trạng | Màu | Nhãn dưới ngày giao |
|---|---|---|
| Còn ≤ 5 ngày | Vàng | `Còn N ngày` / `Đến hạn hôm nay` |
| Đã quá ngày giao | Đỏ | `Quá hạn N ngày` |

Hai điểm xử lý riêng:

**Lệnh Hoàn thành / Đã hủy KHÔNG tô màu.** Đơn giao xong đúng hạn mà vẫn đỏ thì cả bảng đỏ quạch, nhìn mãi thành quen rồi bỏ qua luôn lệnh đang trễ thật — đúng lúc cần nhìn nhất.

**So sánh cắt giờ về 00:00.** Để nguyên giờ thì lệnh giao đúng hôm nay bị tính là quá hạn ngay từ đầu ngày.

Có dòng chú giải màu ngay trên bảng.

### v6.48.1 — Dòng đếm + bấm để lọc

Ngay dưới dòng chú giải có 3 con số bấm được:

`Quá hạn: N` · `Sắp đến hạn (≤5 ngày): N` · `Tất cả: N`

Bấm một con số → bảng chỉ còn nhóm đó, chip đang lọc có viền xanh. **Bấm lại đúng chip đó thì bỏ lọc** — khỏi phải đi tìm nút "Tất cả".

Lọc bằng cách ẩn/hiện dòng (`data-dl`), không vẽ lại bảng — nếu vẽ lại thì mọi nút thao tác mất sự kiện đã gắn, bấm không ra gì.

---

## BƯỚC 3.64 — Xuất Excel từng phiếu / từng công nợ, sắp xếp cột, sổ chi tiết mới nhất lên trên (v6.47)

```
Copy backend/routes/banhang.js, backend/routes/congno.js,
     frontend/js/module.khohang.js, frontend/js/module.congno.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration.

### 1. Xuất Excel TỪNG phiếu bán hàng

Nút **⬇️ Excel** cạnh nút In ở mỗi dòng. Bố cục giống bản in: khối thông tin phiếu → bảng hàng → khối tổng theo **đúng thứ tự mẫu Word**: Tổng cộng → CK NPP → Tổng tiền TT → VAT → Tổng thanh toán → Đã thu → Còn nợ. Dòng "Tổng cộng" là công thức `SUM` để mở file ra vẫn kiểm tra lại được.

### 2. Xuất Excel công nợ — chi tiết từng người và tất cả

| Nơi bấm | Ra cái gì |
|---|---|
| Nút **⬇️ Xuất Excel** ở danh sách | 2 sheet: **Tổng hợp** + **Sổ chi tiết (tất cả)** — có cột Khách hàng/NCC ở đầu để lọc, pivot |
| Nút **⬇️ Xuất Excel sổ này** trong popup sổ chi tiết | 1 sheet sổ của riêng người đó |

Sổ chi tiết trong file Excel dùng **chung hàm** với màn hình xem (`soChiTietKH` / `soChiTietNCC`), nên không thể lệch nhau — trước đây mỗi bên tính một kiểu là mầm mống lệch số.

### 3. Sổ chi tiết công nợ: ngày mới nhất lên trên

Áp cho cả màn hình lẫn file Excel.

**Lũy kế vẫn tính từ cũ đến mới rồi mới lật ngược** — tính trong lúc đã đảo chiều thì cột "Còn nợ lũy kế" ra số vô nghĩa. Vì vậy cột lũy kế nay phải **đọc từ dưới lên**; file Excel có ghi sẵn một dòng nhắc điều này ngay dưới tiêu đề.

### 4. Bấm tiêu đề cột để sắp xếp

Áp cho **Công nợ khách hàng** và **Công nợ nhà cung cấp**. Bấm lần nữa để đảo chiều, mũi tên ▲▼ hiện ở cột đang sắp.

- Tự nhận kiểu dữ liệu: ngày `dd/mm/yyyy` sắp theo ngày, cột tiền sắp theo số (bỏ dấu chấm phân cách), còn lại sắp chữ theo tiếng Việt.
- Chỉ coi là số khi **toàn bộ ô** là số — "Cty ABC 123" mà nhặt ra 123 thì sắp xếp tên ra loạn.
- Dòng **TỔNG** đánh dấu `data-tong`, luôn nằm cuối; nếu để nó lẫn vào thì sắp theo cột tiền là dòng tổng nhảy lên đầu.

---

## BƯỚC 3.63 — Phiếu bán hàng: XUẤT EXCEL (v6.46)

```
Copy backend/routes/banhang.js, frontend/js/module.khohang.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration. Dùng `exceljs` đã có sẵn (khohang.js đang dùng), không cài thêm gói.

Trên thanh công cụ tab **Phiếu bán hàng**: ô **Từ** / **đến** + chọn trạng thái + nút **⬇️ Xuất Excel**. Để trống là lấy tất cả.

File ra có **2 sheet**:

| Sheet | Nội dung |
|---|---|
| **Phiếu bán hàng** | Mỗi phiếu 1 dòng: số phiếu, ngày, khách, số dòng, tổng SL, tiền hàng, %CK NPP + tiền, %GTGT + tiền, tổng thanh toán, đã thu, **còn nợ**, trạng thái, người tạo, ghi chú |
| **Chi tiết** | Mỗi dòng hàng 1 dòng: số phiếu, ngày, khách, mã hàng, tên hàng, màu, SL, ĐVT, SL quy về ĐVT chính, giá bán lẻ, %CK shop, giá bán, thành tiền |

Hai sheet trong **một** file là cố ý — kế toán cần cả hai, ghép tay từ hai lần xuất là chỗ hay lệch số.

Chi tiết đáng lưu ý:

- Phiếu **Đã hủy** thì Tổng thanh toán và Còn nợ ghi **0**, không ghi số gốc — để cột tổng cộng ra đúng doanh thu thực.
- Dòng TỔNG dùng công thức `SUM` với chữ cái cột lấy động (`getColumn().letter`), không viết cứng `F2:F99` — thêm bớt cột sau này không lệch.
- Route `/phieu/export` đặt **trước** `/phieu/:id`. Express khớp route theo thứ tự khai báo; để sau thì `export` rơi vào `:id` và chạy `WHERE PhieuBHID = 'export'` → lỗi ép kiểu khó hiểu.
- Nút tải bằng `fetch` + Blob, dò `content-type`: backend trả JSON lỗi thì hiện đúng thông báo, thay vì lưu cục JSON thành `.xlsx` hỏng.

---

## BƯỚC 3.62 — Điều chỉnh công nợ: thêm nút SỬA (v6.45)

```
Copy backend/routes/congno.js, frontend/js/module.congno.js, frontend/index.html
pm2 restart qlnoibo  +  Ctrl+F5
```

Không migration. Tab **Công nợ → Điều chỉnh công nợ** trước chỉ có **Thêm** và **Xóa** — gõ sai một con số là phải xóa rồi nhập lại, mất luôn tên người tạo và thứ tự bản ghi.

- Backend: thêm `PUT /api/congno/dieuchinh/:id`, quyền `CONGNO / edit`, **cùng bộ kiểm tra với POST**. Đổi loại đối tượng thì khóa nối của loại không được chọn được dọn về NULL — không còn dính đối tượng cũ.
- Frontend: nút **Sửa** ở mỗi dòng (hiện theo quyền Sửa), mở **chung một form** với Thêm, chỉ đổi tiêu đề và nút lưu.

Dùng chung một form là cố ý: hai form riêng cho Thêm/Sửa là đúng kiểu lỗi vừa gặp ở "Đặt hàng nhanh" (BƯỚC 3.60) — hai đường trôi khỏi nhau rồi ra kết quả khác nhau.

---

## BƯỚC 3.61 — Chỉ định SX: mọi ô GÕ TỰ DO, ô số nhận dấu phẩy (v6.44)

**Chỉ frontend.** Copy `frontend/js/module.qlsx.js` + `frontend/index.html`, Ctrl+F5.

**Triệu chứng:** gõ `1,5` vào ô Số lượng → *"Vui lòng nhập giá trị hợp lệ. Hai giá trị hợp lệ gần nhất là 1 và 2."*

**Nguyên nhân:** ô là `<input type="number" min="0">` — **không khai `step`**, mà mặc định của HTML là `step=1`, nên nó chặn mọi số lẻ. Thêm nữa `type="number"` chỉ hiểu dấu **chấm** thập phân, trong khi bàn phím tiếng Việt gõ dấu **phẩy**. Hai cái cộng lại: `1,5` sai, `1.5` cũng sai.

**Sửa:** các ô số ở màn chỉ định đổi sang ô chữ (`inputmode="decimal"` để điện thoại vẫn bật bàn phím số), đọc số bằng hàm `soTuDo()` hiểu cả hai kiểu gõ:

| Gõ vào | Hiểu là |
|---|---|
| `1,5` | 1.5 |
| `1.5` | 1.5 |
| `1.234,5` | 1234.5 (chấm = nghìn, phẩy = thập phân) |

Các ô đã mở tự do:

- **Ra lệnh SX → Cấu trúc vải:** Số lượng (màu chính), SL màu phối, Đơn vị, Loại vải, Màu
- **Chỉ định vải SX:** SL yêu cầu, SL yêu cầu (mét), **Đơn vị** (trước là danh mục, nay gõ tự do)

⚠️ **Cố ý KHÔNG mở:**

- **Hệ số quy đổi** — số này đi thẳng vào tính cắt, tồn kho, lương. Vẫn là ô số có `step="0.001"` nên `1.5` nhập được bình thường.
- **Định mức & hao hụt** — backend chỉ hiểu Kg/Mét, xem BƯỚC 3.59.

---

## BƯỚC 3.60 — Đặt hàng nhanh: đồng bộ với form Lên đơn đặt hàng (v6.44)

**Chỉ frontend.** Copy `frontend/js/module.khohang.js` + `frontend/index.html`, Ctrl+F5.

"Đặt hàng nhanh" (nút **Đặt hàng** trong Lịch sử mã hàng) lệch hẳn form đầy đủ ở 2 chỗ, **cả hai đều sai âm thầm — không báo lỗi gì**:

| | Trước | Từ v6.44 |
|---|---|---|
| Ô **Đơn vị** | Gõ cứng `Cái` / `Ri` | ĐVT chính + ĐVT quy đổi **của chính mã hàng đó**, kèm dòng quy đổi |
| Ô **Khách** | Gõ tự do | Chọn từ Danh mục khách hàng + nút "+ Khách mới" |

**Vì sao ô Đơn vị nguy hiểm:** mã hàng khai ĐVT quy đổi là `Bộ`, `Tá`… mà form lại chỉ cho chọn `Ri`. Chọn `Ri` thì backend (`laDonViGop`) không nhận ra đây là đơn vị gộp nên **không nhân hệ số** — đặt 10 (ý là 10 bộ = 60 cái) lại thành giữ 10 cái. Đúng họ lỗi vừa phải đi dọn ở BƯỚC 3.57.

**Vì sao ô Khách nguy hiểm:** tên khách là **khóa gom công nợ**. Gõ tay lệch một dấu là tách thành khách khác, công nợ vỡ làm hai. Form đầy đủ đã bỏ gõ tự do từ v6.23.2, chỗ này bị sót.

Kèm theo: `dsDonViCua()` / `dvGocCua()` chuyển ra ngoài `openOrderForm` để hai form dùng **chung một bản** — đây mới là lý do gốc khiến hai form trôi khỏi nhau.

---

## BƯỚC 3.59 — Ra lệnh SX: Khách hàng + Đơn vị GÕ TỰ DO (v6.43)

```
1) Chạy database/migration_v674.sql
2) Copy backend/routes/qlsx.js, frontend/js/module.qlsx.js, frontend/index.html
3) pm2 restart qlnoibo   +   Ctrl+F5
```

### Đơn vị (bảng Cấu trúc vải)

Từ ô chọn danh mục → **ô gõ tự do**, danh mục chỉ còn là gợi ý xổ xuống. Ra lệnh SX là bước chỉ định, chưa cần khớp danh mục.

**Không đụng** ô ĐVT ở **Định mức & hao hụt** — chỗ đó backend chỉ hiểu Kg/Mét, gõ "Yard" vào là nó lưu thành 'Kg' rồi tính hao hụt sai. Vẫn khóa 2 lựa chọn.

### Khách hàng

Từ ô chọn danh mục → **ô gõ tự do**. Lúc lưu hệ thống tự tách:

| Gõ vào | Lưu thế nào | Hệ quả |
|---|---|---|
| Trùng tên khách **có trong** danh mục | `KhachHangID` như cũ | Công nợ, lọc theo khách giữ nguyên liên kết |
| Tên **chưa có** trong danh mục | Cột chữ `TenKhachHangTuDo` của riêng lệnh đó | Hiện ở lệnh + mọi bản in. **Danh mục khách hàng không bị thêm gì** |

So khớp bỏ qua hoa/thường và khoảng trắng thừa, nên gõ `cty an bình` vẫn nối đúng vào `Cty An Bình`.

Tên hiển thị được gộp **ngay tại 4 câu đọc lệnh SX** trong `qlsx.js` (`ISNULL(NULLIF(TenKhachHangTuDo,''), kh.TenKhachHang)`) — nên danh sách lệnh, chi tiết lệnh, bản in, báo cáo tiến độ tự hiện đúng, không phải sửa từng nơi.

Nút **"+ Mới"** vẫn còn cho ai muốn thêm hẳn khách vào danh mục.

⚠️ **Đánh đổi phải biết:** tên gõ tự do không nối danh mục, nên gõ sai chính tả sẽ thành khách khác. Báo cáo gom theo khách sẽ tách 2 dòng. Đây là cái giá của "chưa cần đồng bộ với các phần khác" — chấp nhận được ở khâu ra lệnh, nhưng khi lệnh đó đi vào công nợ thì nên sửa lại cho trùng danh mục.

---

## BƯỚC 3.58 — Đơn khách đặt hàng: dòng TỔNG CỘNG + IN TỰ DO (v6.42)

**Chỉ frontend.** Copy `frontend/js/module.khohang.js` và `frontend/index.html`, rồi **Ctrl+F5**. Không migration, không restart pm2.

### 1. Dòng TỔNG CỘNG

Nằm **ngay đầu bảng** và **dính khi cuộn** (dùng lại `.row-tong` của v6.28). Cộng theo **đúng các dòng đang hiện** — đổi ô lọc là tổng đổi theo.

Số lượng **tách riêng từng đơn vị tính**, không cộng gộp: Ri, Cái, Bộ là ba thứ khác nhau, dồn vào một con số thì con số đó vô nghĩa. Có tích dòng thì hiện thêm một khối màu xanh = tổng của riêng phần đã tích.

### 2b. (v6.42.3) Hai nút in hàng loạt ra MỘT BẢNG KÊ, không xé theo khách

**Triệu chứng:** tích 14 dòng, nút ghi "(14)", in ra chỉ thấy 1 khách với 2 Ri.

**Nguyên nhân:** không mất dòng nào. Luật cũ (v5.81) là *mỗi khách một phiếu giao hàng, ngắt trang giữa các phiếu* — vì phiếu giao hàng phải của một khách để khách ký nhận. Chọn 14 dòng của 14 khách thì ra **14 tờ, mỗi tờ đúng 1 dòng**, và màn hình xem trước chỉ hiện trang 1. Đổi giữa "in đang hiện" và "in đã chọn" thì trang 1 rơi vào khách khác, nên thấy hai kết quả khác nhau.

**Sửa:** hai nút này nay in **một bảng kê duy nhất, khổ ngang**, có cột Khách + Trạng thái, tổng cuối bảng (tổng theo từng đơn vị · tổng quy ra Cái · tổng tiền). Đúng nghĩa "in cái đang nhìn".

Phiếu giao hàng từng khách vẫn còn — dùng nút **"🖨️ In phiếu"** ở từng dòng.

Trên phiếu có thêm một dòng chữ xám nhỏ ghi lần in gồm bao nhiêu đơn / mấy khách / mỗi trạng thái mấy đơn, để đối chiếu ngay với số trên nút.

### 2. In tự do — không còn đụng tồn kho hay trạng thái

Cả 3 nút in (**In các dòng đang hiện**, **In các dòng tích chọn**, **In phiếu** từng đơn) nay **chỉ in giấy**:

| | Trước v6.42 | Từ v6.42 |
|---|---|---|
| Lọc bỏ đơn theo trạng thái | Chỉ in được "Chờ xử lý" / "Đã giao" | In được **mọi** trạng thái |
| Sau khi in | Đơn "Chờ xử lý" → **"Đã giao"** | **Không đổi gì** |
| Tồn kho | Gián tiếp bị ảnh hưởng qua trạng thái | **Không đụng tới** |
| Dấu "(BẢN IN LẠI)" | Có, khi in lại đơn đã giao | Bỏ — không còn phân biệt |

**Lý do:** v5.44 gắn thao tác in với chuyển trạng thái vì lúc đó chưa có phiếu bán hàng — in phiếu giao hàng là mốc duy nhất đánh dấu hàng rời kho. Từ **v6.23**, `banhang.js` là **chỗ duy nhất ghi `XuatCai`**, tức phiếu bán hàng lo trừ tồn + công nợ. Để nút in tiếp tục đổi trạng thái là để **hai đường cùng tranh một việc** — đúng nguồn gốc kiểu lệch dữ liệu vừa phải đi dọn ở BƯỚC 3.57.

Nút **"🧾 Chuyển sang phiếu bán hàng"** không đổi — vẫn là đường trừ tồn.

Muốn đánh dấu đơn đã giao thì bấm nút trạng thái **"Đã giao"** như thường; việc đó vẫn thủ công và vẫn còn.

---

## BƯỚC 3.57 — QUY TRÌNH SỬA THẺ KHO ĐÚNG THỨ TỰ (v6.41)

**Copy `backend/utils/kiem_ton_am.js` và `backend/utils/sua_don_vi_the_kho.js`** trước khi chạy.

### Dữ liệu thật cho thấy 2 kiểu sai KHÁC NHAU

Chạy chẩn đoán trên 208 dòng có phát sinh, chỉ **39 dòng lệch**. Hai kiểu:

**Kiểu ① — cột XUẤT lẫn 2 đơn vị** (ví dụ `AD26C0301` màu Cam, tỷ lệ 5):

| Nguồn | Số thật | Đang lưu |
|---|---|---|
| Đơn khách cũ | 9 ri = **45 cái** | 9 ← chưa nhân |
| Phiếu bán hàng | **20 cái** | 20 ← đã đúng |
| | | `XuatCai = 29` |

Nhân cả cột thì phần 20 cái thành 100 — sai. Chia cũng sai. **Phải nắn theo từng chứng từ.**

**Kiểu ② — cột NHẬP còn để theo ri** (ví dụ `BD26C042` màu Cam, tỷ lệ 6): nhập lưu 45 (thực chất 45 ri = 270 bộ).

### Thứ tự bắt buộc

```
cd backend
node utils/kiem_ton_am.js --nan --tat-ca          ① CHẠY THỬ — xem mã nào sẽ âm
```

Bước ① in ra danh sách **mã sẽ âm kho sau khi nắn** — đó chính là nhóm có cột NHẬP còn để theo ri, kèm sẵn câu lệnh sửa. Làm tiếp:

```
node utils/sua_don_vi_the_kho.js --ma=<danh sách mã âm> --cot=nhap --nhan        ② chạy thử
node utils/sua_don_vi_the_kho.js --ma=<danh sách mã âm> --cot=nhap --nhan --ghi  ③ sửa cột NHẬP
node utils/kiem_ton_am.js --nan --tat-ca --ghi                                   ④ nắn cột XUẤT
```

**Làm ngược thứ tự là tồn âm.** Với `BD26C042` màu Cam: nắn xuất trước → tồn −111; nhân nhập trước rồi nắn xuất → tồn 114 bộ = 19 ri.

> Bước ④ vẫn chạy được ngay cả khi chưa làm ②③ — cột Xuất sẽ đúng, chỉ là tồn còn âm cho tới khi sửa xong cột Nhập.

---

## BƯỚC 3.56 — Cột Xuất lệch đơn vị: NẮN LẠI TỪ CHỨNG TỪ, đừng nhân hệ số (v6.40)

**Copy 2 file**: `backend/utils/kiem_ton_am.js`, `backend/utils/sua_don_vi_the_kho.js`.

### Vì sao KHÔNG nhân hệ số cả loạt

Chạy `--nhan-tat-ca --cot=xuat` trên dữ liệu thật cho kết quả: **26/52 mã âm kho**, tổng tồn **−22.185**.

Xuất thật sự đang là ri thì nhân lên không thể âm. Nghĩa là **phần lớn mã có cột Xuất đã đúng đơn vị** — chỉ một phần bị lệch. Cột Xuất được cộng dồn từ nhiều đơn qua nhiều thời điểm, mỗi đơn ghi đơn vị riêng, nên **cả cột không cùng một đơn vị** để nhân/chia.

Từ v6.40, lệnh `--nhan-tat-ca` **tự chặn `--ghi`** khi phát hiện mã sẽ âm kho, và chỉ sang cách đúng bên dưới.

### Cách đúng: tính lại cột Xuất từ chứng từ

```
cd backend
node utils/kiem_ton_am.js --nan --tat-ca           ① CHẠY THỬ — in trước/sau từng mã
node utils/kiem_ton_am.js --nan --tat-ca --ghi     ② ghi thật
```

Lệnh này **không đoán gì cả**: đọc từng phiếu bán hàng và từng đơn khách đã trừ tồn, quy đổi theo **đơn vị ghi trên chính chứng từ đó**, rồi đặt `XuatCai` = tổng. Mã nào đang đúng thì không bị đụng vào.

> ⚠️ Bản chạy thử in cảnh báo nếu **tổng số đã xuất GIẢM** sau khi nắn. Đó là phần xuất **không có chứng từ** — sửa tay trên màn hình Thẻ kho, hàng hỏng, xuất ngoài luồng. Nếu đó là xuất thật thì **đừng nắn**, phải bổ sung chứng từ trước.

Sau khi nắn xong, mã nào vẫn sai thì mới xử lý riêng từng mã:
```
node utils/sua_don_vi_the_kho.js --ma=MA1,MA2 --cot=xuat --nhan --ghi
```

---

## BƯỚC 3.55 — SỬA TOÀN BỘ thẻ kho bằng 1 lệnh (v6.39)

**Copy `backend/utils/sua_don_vi_the_kho.js`.** Không migration.

Dùng khi **hầu hết mã hàng** đều rơi vào cảnh "đã đổi nhãn ĐVT sang Cái/Bộ nhưng số liệu vẫn là ri".

### ⚠️ Chọn ĐÚNG cột trước khi chạy

Thường **chỉ cột Xuất lệch**, cột Nhập đã đúng. Nhân cả 3 cột khi đó sẽ **hỏng luôn cột Nhập** (270 thành 1.620).

```
cd backend
# CHỈ cột Xuất lệch — trường hợp hay gặp nhất:
node utils/sua_don_vi_the_kho.js --nhan-tat-ca --cot=xuat            ① CHẠY THỬ
node utils/sua_don_vi_the_kho.js --nhan-tat-ca --cot=xuat --ghi      ② ghi thật

# Lệch cả 3 cột:
node utils/sua_don_vi_the_kho.js --nhan-tat-ca                       ① CHẠY THỬ
node utils/sua_don_vi_the_kho.js --nhan-tat-ca --ghi                 ② ghi thật

# Bỏ qua mã đã đúng sẵn:
node utils/sua_don_vi_the_kho.js --nhan-tat-ca --cot=xuat --tru=MA1,MA2 --ghi
```

`--cot` nhận: `xuat` · `nhap` · `socat` · `tatca` (mặc định). Bảng chạy thử hiện **cả cột không sửa** để đối chiếu, và đánh dấu `<-- AM KHO!` nếu tồn sau khi sửa bị âm.

### Chọn mã nào

Điều kiện: **tỷ lệ quy đổi > 1** VÀ **ĐVT chính khác ĐVT quy đổi** (tức đang mang nhãn đơn vị gốc).

| Mã | ĐVT chính | Tỷ lệ | Có sửa? |
|---|---|---|---|
| BD26C042 | Bộ | 6 | ✔ nhập 45 → **270** |
| QD26C009 | Cái | 5 | ✔ nhập 120 → **600** |
| mã tỷ lệ = 1 | Cái | 1 | – không đụng |
| mã còn quản theo Ri | Ri | 6 | – không đụng |

### Việc lệnh làm

Nhân cả 3 cột (Số cắt · Nhập · Xuất) với tỷ lệ. **ĐVT chính giữ nguyên** — chỉ sửa số liệu cho khớp cái nhãn đã đổi trước đó. Ri → Cái/Bộ luôn là phép **nhân** nên không bao giờ vướng lỗi "không chia hết".

Bản chạy thử ① in bảng đầy đủ: từng mã kèm nhập/xuất/tồn trước và sau, cộng dòng TỔNG. **Kiểm cột "NHẬP mới" rồi mới chạy ②.**

Mỗi mã ghi riêng: backup JSON trong `backend/backup/` + transaction riêng, mã nào lỗi thì các mã khác vẫn chạy tiếp.

Đơn khách đặt và phiếu bán hàng cũ giữ nguyên đơn vị đã ghi trên từng đơn — hệ thống tự quy đổi khi đọc, không phải sửa tay.

Kiểm lại sau khi chạy: `node utils/sua_don_vi_the_kho.js --liet-ke` và `node utils/kiem_ton_am.js`.

---

## BƯỚC 3.54 — Thẻ kho: chọn đơn vị khi nhập chi tiết màu (v6.38)

**Copy 2 file**: `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.38`) → Ctrl+F5.

Đầu khối **Chi tiết theo màu** có một ô chọn:

> Nhập Số cắt / Nhập theo: **[ Bộ ▾ ]**  — Kho luôn lưu theo **Bộ**, dòng dưới mỗi ô hiện số đã quy đổi.

Chọn đơn vị nào thì gõ theo đơn vị đó, **một ô duy nhất**. Dòng nhỏ dưới ô luôn hiện số theo ĐVT chính:

| Chọn | Gõ | Ô hiện | Lưu xuống |
|---|---|---|---|
| Ri | 45 | `= 270 Bộ` | 270 |
| Bộ | 270 | `= 270 Bộ` | 270 |

**Chọn nhầm đơn vị không làm sai tồn kho** — con số lưu luôn theo ĐVT chính, đổi ô chọn chỉ đổi cách gõ và cách hiển thị.

Ô chọn tự ẩn khi mã không có tỷ lệ quy đổi (chỉ một đơn vị thì hiện ra chỉ tổ rối), và tự cập nhật khi đổi ĐVT chính / ĐVT quy đổi / tỷ lệ ngay trên form. Mở form luôn bắt đầu ở ĐVT chính.

> Thay cho cách làm ở v6.34 (hai ô song song ĐVT chính + ri/lẻ) — rối, đã bỏ.

---

## BƯỚC 3.53 — Cột STT đợt 3: QLSX (v6.37)

**Copy 2 file**: `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.37`) → Ctrl+F5.

Thêm STT cho 13 bảng của QLSX: xem/in phiếu xuất kho vải, xuất vải kèm đơn hàng (xem + bản in), lịch sử tiến độ (xem + bản in), phụ kiện xuất kèm đơn, ghi nhận May (SL lũy kế theo màu, giao việc, form sửa), đơn giá công đoạn may của đơn, lịch sử giao việc nội bộ, nhận/giao in thêu, nhận gia công.

### Tổng kết cột STT — 58/78 bảng

| Phân hệ | Bảng |
|---|---|
| Bảng lương | 20 |
| QLSX | 13 |
| Tài liệu kỹ thuật | 12 |
| Kho vải · Phụ kiện (phiếu nhập/xuất) | 8 |
| Bảng kê BTP · Phiếu lương cá nhân · Catalogue | 5 |

### Còn lại ~20 bảng — đều là FORM THÊM/XÓA DÒNG

Form nhập/sửa phiếu kho vải (4), form phiếu phụ kiện (2), chi phí chung, định mức vải, sơ đồ đã khai báo, giao gia công, báo cáo hao hụt, 7 bảng con của bảng tính giá thành.

Nhóm này khác hẳn: người dùng bấm "+ Thêm dòng" / "X" liên tục, nên **số thứ tự phải đánh lại sau mỗi lần thêm hoặc xóa** — chỉ chèn một ô `${i+1}` là sai ngay khi xóa dòng giữa. Cần một hàm đánh số lại dùng chung (giống `danhSoLaiSTT()` đã có ở phiếu bán hàng) rồi gắn vào tất cả các form đó. Làm riêng một đợt để test được từng form.

---

## BƯỚC 3.52 — SỬA SỐ LIỆU: đổi ĐVT trên form chỉ đổi NHÃN, không nhân số (v6.36)

**Copy `backend/utils/sua_don_vi_the_kho.js`.** Không migration.

### Triệu chứng

Mã `BD26C042` (tỷ lệ 6): thực tế nhập **45 ri = 270 bộ**, xuất 36 ri, tồn 9 ri. Màn hình hiện **45 Bộ · 7 Ri6 dư 3**, xuất 36 bộ, tồn 9 bộ.

### Nguyên nhân

Ô **"Đơn vị tính chính"** trên form Thẻ kho chỉ đổi **cái nhãn**, **không nhân số liệu**. Số trong kho vẫn là **45 (đang là ri)** trong khi nhãn đã thành "Bộ" — hệ thống đọc thành 45 bộ.

Khác với lệnh `--tat-ca-ri` (có nhân hệ số). Ai đổi đơn vị bằng tay trên form thì rơi vào trường hợp này.

### Cách sửa

```
cd backend
node utils/sua_don_vi_the_kho.js --soat-ri-con-sot     ① tìm hết các mã bị
node utils/sua_don_vi_the_kho.js --ma=BD26C042 --cot=tatca --nhan          ② chạy thử 1 mã
node utils/sua_don_vi_the_kho.js --ma=BD26C042 --cot=tatca --nhan --ghi    ③ ghi thật
```

Bước ① đối chiếu số Nhập trên thẻ kho với **lũy kế công đoạn "Kho nhập" của lệnh SX** (nguồn duy nhất có chứng từ). Mã nào thỏa `Nhập × tỷ lệ = lũy kế Kho nhập` thì chắc chắn số liệu đang là ri — lệnh in sẵn câu sửa cho từng mã và một câu sửa hết một lần.

Sau khi sửa `BD26C042`: nhập 270 bộ (= 45 ri), xuất 216 bộ (= 36 ri), tồn 54 bộ (= 9 ri).

> Mã không có chứng từ "Kho nhập" (hàng đặt ngoài) thì lệnh không kết luận được — phải đối chiếu tay. Có danh sách rồi thì sửa cả loạt bằng một lệnh:
> ```
> node utils/sua_don_vi_the_kho.js --ma=MA1,MA2,MA3 --cot=tatca --nhan          (chạy thử)
> node utils/sua_don_vi_the_kho.js --ma=MA1,MA2,MA3 --cot=tatca --nhan --ghi
> ```
> Mỗi mã chạy riêng, backup JSON và transaction riêng — mã nào lỗi thì các mã khác vẫn chạy tiếp.

### Chặn tại gốc (v6.36 — copy thêm `frontend/js/module.khohang.js`, `index.html` `?v=6.36`)

Từ nay đổi ô **"Đơn vị tính chính"** giữa đơn vị GỘP ↔ đơn vị GỐC trên mã **đang có số liệu**, hệ thống hỏi ngay:

- **OK** → quy đổi luôn số liệu (nhân hoặc chia tỷ lệ), ví dụ 45 Ri thành 270 Bộ.
- **Cancel** → chỉ đổi nhãn, giữ nguyên con số (hành vi cũ).

Hộp thoại ghi rõ hướng quy đổi và ví dụ bằng số thật, kèm câu nhắc "chọn sai là tồn kho lệch đúng &lt;tỷ lệ&gt; lần". Chiều chia mà có dòng không chia hết thì báo đã làm tròn để kiểm lại trước khi lưu.

---

## BƯỚC 3.51 — Cột STT đợt 2 + ô nhập theo 2 đơn vị (v6.34 / v6.35)

**Copy 8 file**: `frontend/js/module.khohang.js`, `module.payroll.js`, `module.tailieukythuat.js`, `module.bangkebtp.js`, `module.mypay.js`, `catalogue.js`, `frontend/catalogue.html`, `frontend/index.html` (`?v=6.35`) → Ctrl+F5. Không migration, không cần restart backend.

### Thẻ kho hàng hóa — ô Số cắt / Nhập có 2 cách gõ

Trong phần **chi tiết màu**, mỗi ô nay có hai cách nhập, **luôn đồng bộ với nhau**:

| Ô trái | Ô phải |
|---|---|
| Theo **ĐVT chính** — đơn vị kho thật sự lưu (Cái / Bộ) | Theo **ĐVT quy đổi** — [số ri] + [lẻ] |

Gõ bên nào bên kia tự đổi; dòng dưới ghi rõ `= 600 Cái = 100 Ri6`. Nhãn lấy **đúng tên đơn vị của mã hàng**, và đổi ĐVT ngay trên form thì nhãn đổi theo liền.

Trước đây ô này **luôn** hiện dạng ri + lẻ và ghi cứng chữ "Cái" ở dòng tổng — nên mã quản theo Ri có số 100 (nghĩa là 100 ri) bị chia thành "16 Ri6 dư 4", vô nghĩa. Đây là nguồn gốc của việc nhìn số nhập thấy sai.

### Cột STT — đã xong 45/78 bảng

| Phân hệ | Số bảng |
|---|---|
| Kho vải (phiếu nhập/xuất — xem + in) | 4 |
| Phụ kiện (phiếu nhập/xuất — xem + in) | 4 |
| Tài liệu kỹ thuật (chỉ định NPL, 3 loại đơn giá — form + in nhanh + bản in) | 12 |
| Bảng lương (công nhật, khoán may, gia công/in thêu, là-đóng gói, lương cắt — màn hình + bản in) | 20 |
| Bảng kê BTP (lưới nhập + bản in) | 2 |
| Phiếu lương cá nhân | 1 |
| Catalogue (giỏ hàng, đơn của khách) | 2 |

**Còn lại ~33 bảng**: QLSX (23), thẻ kho hàng hóa (2), và 4 form nhập liệu của kho vải/phụ kiện — form cần đánh số lại mỗi khi thêm/xóa dòng nên làm riêng.

> Cách kiểm: mỗi bảng sau khi sửa phải tăng **đúng 1 `<th>` và 1 `<td>`**; dòng tổng được chèn thêm một ô trống thay vì sửa `colspan` — nhờ vậy không phải tính lại con số nào, tránh lệch cột.

---

## BƯỚC 3.50 — Bấm mã / tài khoản để xem chi tiết + cột STT (v6.33)

**Copy 5 file**: `backend/routes/baocao.js`, `frontend/js/module.baocao.js`, `frontend/js/module.khovai.js`, `frontend/js/module.phukien.js`, `frontend/index.html` (`?v=6.33`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

### 1. Báo cáo tồn kho — bấm mã để xem chi tiết xuất nhập

Ở cả 3 tab (**tồn kho hàng hóa · tồn kho vải · tồn kho phụ kiện**), cột mã trở thành **liên kết**. Bấm vào mở cửa sổ liệt kê từng chứng từ trong kỳ, xếp theo ngày, có **tồn lũy kế sau mỗi dòng** và in được:

- **Hàng hóa**: nhập từ tiến độ "Kho nhập" của lệnh SX · xuất từ phiếu bán hàng (và đơn khách đã trừ tồn trực tiếp — dữ liệu trước v6.23).
- **Vải**: từng cây nhập (kèm nhà cung cấp) · từng dòng xuất (kèm người nhận / lệnh SX).
- **Phụ kiện**: từng phiếu nhập/xuất, kèm đơn giá và ghi chú.

Dòng "Tồn đầu kỳ" trong cửa sổ chi tiết **lấy từ chính hàm tính của báo cáo**, nên số ở đây luôn khớp bảng tổng hợp.

### 2. Báo cáo tài chính — bấm tài khoản để xem chi tiết thu chi

Bấm được ở **hai chỗ**:

| Bấm vào | Hiện ra |
|---|---|
| Dòng quỹ ở bảng A (tiền mặt / từng tài khoản ngân hàng) | Từng phiếu thu/chi của quỹ đó, có **số dư đầu kỳ và số dư sau mỗi phiếu** |
| Dòng loại tài khoản ở bảng C | Từng phiếu thu/chi thuộc loại đó, cột cuối là cộng dồn trong kỳ |

Loại tài khoản là khoản mục chi tiêu nên **không có số dư** — cột cuối chỉ cộng dồn, khác với quỹ.

### 3. Cột STT — đợt 1

Đã thêm cột STT cho các phiếu kho vải và phụ kiện (cửa sổ xem + bản in): phiếu nhập vải, phiếu xuất vải, phiếu nhập phụ kiện, phiếu xuất phụ kiện — **8 bảng**.

Còn khoảng **70 bảng** sẽ làm tiếp: form nhập liệu của kho vải/phụ kiện (cần đánh số lại mỗi khi thêm/xóa dòng), các bảng in của QLSX, tài liệu kỹ thuật, bảng lương, bảng kê BTP, phiếu lương cá nhân, catalogue.

---

## BƯỚC 3.49 — Tồn kho phụ kiện: cột "Tồn quy đổi" (v6.32)

**Copy 3 file**: `backend/routes/phukien.js`, `frontend/js/module.phukien.js`, `frontend/index.html` (`?v=6.32`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

Màn hình **Quản lý phụ kiện → Thẻ kho / Tồn kho** có thêm cột **Tồn quy đổi**, hiện tồn theo **ĐVT quy đổi** khai ở Danh mục phụ kiện. File Excel xuất ra cũng có 2 cột mới (Tồn quy đổi + ĐVT quy đổi).

Quy ước: `1 <ĐVT quy đổi> = <tỷ lệ> × <ĐVT cơ bản>` → **tồn quy đổi = tồn ÷ tỷ lệ**.

| Danh mục khai | Tồn (ĐVT cơ bản) | Tồn quy đổi |
|---|---|---|
| 1 Bó = 0,18 Kg | 9 Kg | 50 Bó |
| 1 Thùng = 20 Cái | 100 Cái | 5 Thùng |
| 1 Cuộn = 50 Mét | 125 Mét | 2,5 Cuộn |

Mã chưa khai ĐVT quy đổi hoặc tỷ lệ thì cột hiện dấu **—**, không đoán bừa.

> Kỹ thuật: view `vw_TonKhoPhuKien` không có 2 cột `DonViQuyDoi`/`TyLeQuyDoi` nên 3 truy vấn tồn kho JOIN thẳng `DanhMucPhuKien` — không phải sửa view, chạy được trên mọi trạng thái CSDL.

---

## BƯỚC 3.48 — Danh mục hóa đơn vị tính + bỏ chuỗi "Ri" khỏi phép tính (v6.31)

### Thứ tự làm — ĐỌC HẾT TRƯỚC KHI CHẠY

**1. Chạy `database/migration_v673.sql`** (SSMS, database QLNoiBo). Migration này **không sửa một số liệu tồn kho nào** — chỉ thêm cột vào danh mục đơn vị, nới một cột, và **in ra 3 truy vấn chẩn đoán**.

**2. Đọc kết quả 3 truy vấn chẩn đoán:**

| Truy vấn | Rỗng nghĩa là | Có dòng thì phải làm gì |
|---|---|---|
| [1/3] Mã thiếu "ĐVT quy đổi" | — | Vào Thẻ kho → sửa mã hàng → khai **ĐVT quy đổi** trước khi copy code |
| [2/3] Mã có ĐVT quy đổi khác "Ri" | — | Kiểm các đơn cũ ghi "Ri" của những mã đó |
| [3/3] Đơn có đơn vị lạ | — | Sửa đơn vị của các đơn đó cho khớp mã hàng |

**Cả 3 rỗng = đổi quy tắc không làm đổi bất kỳ con số nào.**

**3. Copy code** — backend: `routes/banhang.js`, `routes/khohang.js`, `routes/public.js`, `routes/baocao.js`, `routes/danhmuc.js`, `utils/hoan_ton_don_cho_xu_ly.js`, `utils/kiem_ton_am.js`; frontend: `js/common.js`, `js/module.khohang.js`, `js/module.phukien.js`, `js/module.qlsx.js`, `js/module.tailieukythuat.js`, `js/module.danhmuc.js`, `js/catalogue.js`, `index.html` + `catalogue.html` (`?v=6.31`) → `pm2 restart qlnoibo` → Ctrl+F5.

### Thay đổi gì

**Quy tắc nhân/chia tỷ lệ quy đổi:**

| | Trước | Nay |
|---|---|---|
| Câu hỏi hệ thống đặt ra | "đơn vị này **tên là Ri** phải không?" | "đơn vị này **có phải ĐVT quy đổi của chính mã hàng đó** không?" |

Trước đây khai một đơn vị gộp tên khác — "Tá", "Thùng", "Lố" — là hệ thống **không nhân tỷ lệ**: đặt 3 Tá (1 Tá = 12) chỉ trừ kho 3 cái thay vì 36, **không báo lỗi gì**. Nay khai tên gì cũng chạy đúng.

Mã hàng chưa khai ĐVT quy đổi thì vẫn hiểu "Ri" như cũ (nhánh tương thích ngược), nên dữ liệu hiện tại không đổi.

**Danh mục Đơn vị tính là nguồn duy nhất** cho mọi ô chọn đơn vị: Thẻ kho (ĐVT chính / quy đổi), đơn khách đặt, phiếu bán hàng, danh mục phụ kiện (trước gõ tự do bằng ô chữ), chỉ định vải SX, định mức vải, tài liệu kỹ thuật, catalogue công khai.

Danh mục có thêm 2 cột: **Là đơn vị gộp** (đánh dấu Ri/Tá/Thùng — chỉ để gợi ý trên giao diện) và **Thứ tự hiện ra**. Migration bổ sung sẵn các đơn vị đang bị gõ cứng trong code (Yard, Bó, Túi, Thùng, Đôi, Tá, Lố) và **tự thêm mọi đơn vị đang có trong dữ liệu thật**.

> **An toàn dữ liệu:** ô chọn đơn vị **luôn giữ giá trị đang lưu** kể cả khi giá trị đó không còn trong danh mục. Nếu không có điều này, mở form sửa mã hàng chỉ để đổi giá bán rồi bấm Lưu là đơn vị bị đổi âm thầm sang dòng đầu danh sách, kéo theo toàn bộ tồn kho của mã đó bị diễn giải sai gấp `<tỷ lệ>` lần.

### Lưu ý vận hành

- Ô đơn vị chỉ hiện **2 lựa chọn của chính mã hàng đó** (ĐVT chính + ĐVT quy đổi), không còn là danh sách Cái/Ri cố định. Mã chưa khai ĐVT quy đổi thì chỉ có 1 lựa chọn.
- **Định mức vải** vẫn chỉ cho chọn Kg/Mét — công thức tính hao hụt ở backend chỉ hiểu 2 đơn vị này.
- Người dùng **không có quyền xem phân hệ Danh mục** sẽ thấy thông báo và ô đơn vị chỉ hiện giá trị đang lưu.

---

## BƯỚC 3.47 — Phiếu nhập/xuất phụ kiện: cột Quy đổi & Giá quy đổi (v6.30)

**Copy 3 file**: `backend/routes/phukien.js`, `frontend/js/module.phukien.js`, `frontend/index.html` (`?v=6.30`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

Quy tắc quy đổi lấy từ **Danh mục phụ kiện**: `1 <ĐVT quy đổi> = <tỷ lệ> × <ĐVT cơ bản>` (ví dụ 1 Bó = 0,18 Kg).

| | Phiếu NHẬP | Phiếu XUẤT |
|---|---|---|
| Cột **Quy đổi** (số lượng) | ✔ | ✔ |
| Cột **Giá quy đổi** | ✔ | — (phiếu xuất không có tiền) |

- Gõ 9 Kg, giá 100.000/Kg → hiện `50 Bó` và `18.000 /Bó`.
- Chọn ĐVT là Bó thì quy ngược lại về Kg.
- Hai cột này có ở **form nhập liệu, cửa sổ xem phiếu và bản in**.

**Hai cột này CHỈ ĐỂ ĐỐI CHIẾU, không lưu vào CSDL.** Hệ thống vẫn lưu đúng số lượng + đơn giá theo ĐVT chọn ở cột ĐVT. Mã nào chưa khai ĐVT quy đổi / tỷ lệ trong danh mục thì cột để trống.

> ⚠️ **Một lỗi có sẵn cần biết**: tồn kho phụ kiện đang cộng thẳng `SoLuong` của mọi dòng **bất kể ĐVT** — `TyLeQuyDoi` chưa từng được dùng trong phép tính nào. Nếu phiếu này nhập theo Kg còn phiếu kia theo Bó thì tồn kho là số vô nghĩa. Kiểm bằng:
> ```sql
> SELECT dm.MaPhuKien, dm.DonViCoBan, ct.DonVi, COUNT(*) AS SoDong
> FROM PhieuPhuKienChiTiet ct JOIN DanhMucPhuKien dm ON dm.PhuKienID = ct.PhuKienID
> WHERE LTRIM(RTRIM(ct.DonVi)) <> LTRIM(RTRIM(dm.DonViCoBan))
> GROUP BY dm.MaPhuKien, dm.DonViCoBan, ct.DonVi ORDER BY dm.MaPhuKien;
> ```
> Rỗng = mọi phiếu đều ghi theo ĐVT cơ bản, tồn kho đúng.

---

## BƯỚC 3.46 — Dòng TỔNG CỘNG lên đầu bảng và đứng yên khi cuộn (v6.28)

**Copy 3 file**: `frontend/js/module.baocao.js`, `frontend/css/style.css`, `frontend/index.html` (`?v=6.28`) → Ctrl+F5. Không cần restart backend, không migration.

Trong phân hệ Báo cáo kinh doanh, dòng TỔNG chuyển từ cuối bảng lên **dòng đầu tiên ngay dưới tiêu đề cột**, và **dính lại khi cuộn** — kéo xuống giữa bảng vài trăm dòng vẫn thấy số tổng.

Áp cho 6 bảng: tồn kho hàng hóa · tồn kho vải · tồn kho phụ kiện · quỹ · dòng tiền theo loại tài khoản · chi tiết chi phí kinh doanh. Bảng **lãi gộp theo mã hàng** trước đây không có dòng tổng, nay được thêm (tổng SL bán, doanh thu, giá vốn, lãi gộp, tỷ lệ lãi).

Vị trí dính được đo bằng **chiều cao thật của phần tiêu đề** chứ không phải hằng số, nên bảng tồn kho vải (2 dòng tiêu đề) vẫn đúng, và thu hẹp cửa sổ làm tiêu đề xuống dòng thì tự đo lại. Khi in, dòng tổng trở lại bình thường (không dính).

---

## BƯỚC 3.44.1 — Sửa lỗi SQL ở báo cáo tồn kho hàng hóa (v6.26.1)

Nếu tab **Tồn kho hàng hóa** báo `Multiple columns are specified in an aggregated expression containing an outer reference`: copy lại `backend/routes/baocao.js` → `pm2 restart qlnoibo`. Không migration.

Nguyên nhân: truy vấn tính "nhập từ công đoạn Kho nhập" đặt hàm `SUM()` trong một subquery tương quan, mà biểu thức bên trong `SUM()` vừa dùng cột của bảng trong (`TienDoChiTietMau`) vừa dùng cột của bảng ngoài (`TheKhoHangHoa.DonViQuyDoi`, `.LoaiRi`) — SQL Server cấm (lỗi 8124). Đã đổi sang `JOIN` + `GROUP BY` để cả hai bảng nằm trong cùng một truy vấn. Kết quả tính ra không đổi.

Chỗ nạp giá vốn từ lệnh SX dùng đúng khuôn đó nên cũng đã sửa cùng lượt.

---

## BƯỚC 3.44 — PHÂN HỆ BÁO CÁO KINH DOANH (v6.26)

**Chạy `database/migration_v672.sql`** (SSMS, database QLNoiBo) → copy `backend/routes/baocao.js` (file MỚI), `backend/routes/qlsx.js`, `backend/server.js`, `frontend/js/module.baocao.js` (file MỚI), `frontend/js/app.js`, `frontend/index.html` (`?v=6.26`) → `pm2 restart qlnoibo` → Ctrl+F5.

### Sau khi chạy migration — 3 việc BẮT BUỘC

1. **Cấp quyền**: Quản lý User → Ma trận phân quyền → phân hệ **Báo cáo kinh doanh** + 6 chức năng con.
2. **Nạp giá vốn**: vào *Báo cáo kinh doanh → Giá vốn hàng hóa → nút “Lấy giá thành từ lệnh SX”*. Không có bước này thì giá vốn = 0 và báo cáo lãi/lỗ sẽ **báo lãi ảo**.
3. **Khai giá vốn tay** cho hàng **đặt ngoài** (không có lệnh SX) — lọc bằng ô “Chỉ hiện mã CHƯA khai giá vốn”.

### 6 tab

| Tab | Nội dung |
|---|---|
| Tồn kho hàng hóa | Nhập – Xuất – Tồn thành phẩm theo kỳ |
| Tồn kho vải | NXT theo KG (kèm số mét), đơn giá bình quân, giá trị tồn |
| Tồn kho phụ kiện | NXT theo đơn vị chính của từng mã |
| Báo cáo tài chính | Quỹ tiền mặt + từng tài khoản ngân hàng, công nợ phải thu/phải trả cuối kỳ, dòng tiền theo loại tài khoản |
| Kết quả kinh doanh | Doanh thu thuần − Giá vốn = Lãi gộp; − Chi phí KD = Lợi nhuận. Kèm lãi gộp theo từng mã hàng |
| Giá vốn hàng hóa | Khai / nạp giá vốn 1 cái |

Mọi tab đều chọn kỳ **từ ngày – đến ngày** (có nút nhanh Tháng này / Tháng trước / Quý này / Năm nay), in được và xuất Excel.

### Cách tính tồn đầu kỳ — đọc để khỏi hiểu nhầm

Hệ thống **không lưu lịch sử tồn theo thời điểm** (thẻ kho chỉ có số lũy kế, không có ngày). Nên báo cáo suy ngược từ tồn hiện tại:

```
Tồn cuối kỳ = Tồn hiện tại − Nhập(sau kỳ) + Xuất(sau kỳ)
Tồn đầu kỳ  = Tồn cuối kỳ  − Nhập(trong kỳ) + Xuất(trong kỳ)
```

Nhờ vậy **Tồn đầu + Nhập − Xuất = Tồn cuối luôn khớp tuyệt đối**. Hệ quả cần biết: phần **nhập/sửa tay trực tiếp trên thẻ kho** không có ngày nên được coi là số dư đầu và nằm trong cột “Tồn đầu kỳ”.

### ⚠️ Chi phí kinh doanh KHÔNG được trùng giá vốn

`LỢI NHUẬN = (Doanh thu − Giá vốn) − Chi phí KD`. Giá vốn (giá thành lệnh SX) **đã gồm** vải, phụ kiện, gia công, in thêu, may, cắt. Nếu tài khoản “Chi mua nguyên phụ liệu” / “Chi gia công” vẫn để cờ *tính chi phí KD* thì cùng một khoản tiền bị trừ **hai lần** → báo lỗ ảo đúng bằng tiền mua nguyên phụ liệu trong kỳ.

`migration_v672.sql` **tự tắt cờ** cho 2 loại đó. Riêng **“Chi lương”** phải tự quyết: lương may/cắt đã nằm trong giá thành, lương văn phòng thì không — nên tách thành 2 loại tài khoản ở *Danh mục → Loại tài khoản*.

Tab Kết quả kinh doanh luôn hiện danh sách loại tài khoản đang được tính là chi phí KD để đối chiếu.

---

## BƯỚC 3.43 — SỬA phiếu bán hàng (v6.25.5)

**Copy 3 file**: `backend/routes/banhang.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.25.5`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

Danh sách phiếu bán hàng có thêm nút **Sửa**. Mở ra là form quen thuộc, đã nạp sẵn khách hàng, ngày, %CK NPP, %thuế GTGT, ghi chú và toàn bộ dòng hàng — sửa số lượng, giá, chiết khấu, thêm/bớt dòng như lúc lập phiếu.

### Cách hệ thống xử lý khi lưu

Trong **một transaction duy nhất**: hoàn tồn theo phiếu cũ → trả các đơn khách đặt về "Chờ xử lý" → ghi lại dòng mới → trừ tồn theo số mới → gắn lại đơn. **Số phiếu giữ nguyên**. Lỗi bất kỳ ở giữa thì **quay lui toàn bộ**, phiếu y như trước khi sửa.

Dữ liệu sai (thiếu tồn, chưa chọn màu, đơn đã lên phiếu khác…) được **kiểm trước khi đụng vào phiếu** — báo lỗi và không thay đổi gì.

### Không sửa được khi

- Phiếu **đã hủy** → lập phiếu mới.
- Phiếu **đã có phiếu thu** gắn vào → xóa phiếu thu trước (sửa tiền sẽ lệch với số đã thu). Nút Sửa tự ẩn với các phiếu này.

> Số "khả dụng" trong form sửa đã **cộng bù** phần mà chính phiếu đang giữ, nên tăng số lượng trong phạm vi tồn cũ + tồn còn lại đều được.

---

## BƯỚC 3.42 — Lập phiếu bán hàng: nút thêm dòng + gộp đơn cùng mã/màu (v6.25.3 / v6.25.4)

**CÓ MIGRATION** → chạy `database/migration_v671.sql` → copy `backend/routes/banhang.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.25.4`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. Nút thêm dòng nằm ngay dưới dòng cuối

- **"+ Thêm dòng hàng"** chuyển vào **trong bảng**, ngay dưới dòng cuối cùng — không phải cuộn qua chân phiếu để tìm.
- Mỗi dòng có nút **"+"**: chèn dòng mới **ngay dưới dòng đó** (thêm xen giữa).
- Dòng mới tạo xong con trỏ tự nhảy vào ô Mã hàng; STT tự đánh lại sau mỗi lần thêm/xóa.

### 2. Gộp nhiều đơn của cùng mã hàng + màu

Lấy từ đơn khách đặt: cùng **1 khách**, cùng **mã hàng + màu** mà khách đặt **nhiều lần** → **gộp thành 1 dòng** trên phiếu, số lượng cộng lại. Dòng ghi rõ nguồn: *"gộp 3 đơn: #11 2 Ri + #14 6 Cái + #19 1 Ri"*.

Ví dụ 4 đơn (3 đơn màu Đen + 1 đơn màu Ghi) → phiếu chỉ còn **2 dòng**.

Hủy/xóa phiếu vẫn trả **đúng tất cả** các đơn trong nhóm về "Chờ xử lý" — cột `DonIDs` (migration_v671) lưu danh sách đơn của từng dòng; phiếu cũ dùng cột `DonID` cũ vẫn chạy bình thường.

---

## BƯỚC 3.41 — In phiếu thu / phiếu chi (v6.25.2)

**Copy 2 file**: `frontend/js/module.congno.js`, `frontend/index.html` (`?v=6.25.2`) → Ctrl+F5. Không migration, không cần restart.

Mỗi dòng ở tab **Phiếu thu** và **Phiếu chi** có thêm nút **🖨️**. Bản in theo khuôn chứng từ kế toán:

- Đầu phiếu có **logo** + tên công ty; tiêu đề **PHIẾU THU** / **PHIẾU CHI**, ngày tháng căn giữa, **số phiếu căn phải**.
- Họ tên người **nộp** / **nhận** tiền · Lý do · Tài khoản · Hình thức (kèm ngân hàng + số TK nếu chuyển khoản) · phiếu xuất kho liên quan (nếu phiếu thu có gán).
- **Số tiền** + dòng **bằng chữ**, dòng "Kèm theo … chứng từ gốc".
- Hàng chữ ký: Giám đốc · Kế toán · Thủ quỹ · Người nộp/nhận tiền · Người lập phiếu.

Số tiền trên 2 bảng và bản in đều **bỏ số sau dấu phẩy** như phiếu bán hàng.

---

## BƯỚC 3.40 — Phiếu bán hàng: logo đầu phiếu, bỏ số lẻ, TỔNG CỘNG căn giữa (v6.25.1)

**Copy 4 file**: `backend/routes/banhang.js`, `frontend/js/common.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.25.1`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

### 1. Logo đầu phiếu

Bản in phiếu bán hàng có **logo bên trái**, tên công ty + địa chỉ ở giữa (đúng khuôn mẫu Word).

**Đặt logo của công ty**: chép file ảnh tên **`logo.png`** vào thư mục `D:\QLSX\frontend\` (cùng chỗ `index.html`). Chưa có file đó thì phiếu tự dùng icon phần mềm nên không bao giờ vỡ bố cục. Ảnh nên cao khoảng 120–200px, nền trong (PNG).

> Chỉ phiếu bán hàng bật logo; các phiếu in khác giữ nguyên đầu phiếu như cũ.

### 2. Tiền không còn số sau dấu phẩy

Tiền VND không có xu nên **làm tròn về đồng**: giá bán lẻ · giá bán · thành tiền · các dòng tổng · công nợ, ở cả bản in, màn hình xem, form nhập và danh sách phiếu. Phiếu **tạo mới** cũng lưu số tròn đồng ngay từ đầu; phiếu cũ đã lỡ lưu số lẻ vẫn hiện tròn.

### 3. Chữ **TỔNG CỘNG** căn giữa ô.

---

## BƯỚC 3.39 — Loại tài khoản phân theo phiếu thu / phiếu chi (v6.25)

**CÓ MIGRATION** → chạy `database/migration_v670.sql` → copy `backend/routes/congno.js`, `frontend/js/module.congno.js`, `frontend/js/module.danhmuc.js`, `frontend/js/app.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.25`) → `pm2 restart qlnoibo` → Ctrl+F5.

### Khai báo

**Danh mục → Loại tài khoản** có thêm cột **"Dùng cho phiếu"**: `Phiếu thu` · `Phiếu chi` · `Cả hai`.

Migration tự đoán cho dữ liệu đang có: loại tên bắt đầu bằng **"Thu"** → *Phiếu thu*, còn lại → *Phiếu chi*. **Kiểm lại một lượt** sau khi chạy, sửa loại nào đoán sai.

### Khi lập phiếu

- **Phiếu thu** chỉ hiện tài khoản thuộc loại *Phiếu thu* (+ loại *Cả hai*).
- **Phiếu chi** chỉ hiện tài khoản thuộc loại *Phiếu chi* (+ loại *Cả hai*).
- Không có loại nào phù hợp thì ô chọn ghi rõ cần vào Danh mục khai trước.
- **Backend chặn lại khi lưu**, không chỉ ẩn trên form — gửi tài khoản sai loại sẽ báo lỗi rõ ràng.

Chưa chạy migration thì mọi loại coi như *Cả hai* (giữ nguyên hành vi cũ, không lỗi).

---

## BƯỚC 3.38 — Phiếu thu lọc theo khách + hoàn thiện bản in phiếu xuất (v6.24.5)

**Copy 4 file**: `backend/routes/banhang.js`, `backend/utils/kiem_ton_am.js`, `frontend/js/module.khohang.js`, `frontend/js/module.congno.js`, `frontend/index.html` (`?v=6.24.5`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

### 1. Phiếu thu chỉ hiện phiếu xuất **của khách đang chọn**

Ô "Phiếu bán hàng" đổi thành **"Phiếu xuất kho của khách này"** — chỉ liệt kê phiếu của đúng khách đang chọn (bỏ phiếu đã hủy), kèm ngày và **số tiền còn phải thu** của từng phiếu. Đổi khách thì danh sách cập nhật ngay; chưa chọn khách thì nhắc chọn.

### 2. Bản in phiếu xuất

- **Tiêu đề cột căn giữa** — phải đặt inline trên từng `<th>` vì CSS bản in có `th,td{text-align:left}` đè lên thẻ `<tr>`.
- **Không còn mất cột bên phải**: bảng dùng `table-layout:fixed` với bề rộng khai theo **%** (tổng đúng 100%), chữ trong ô tự xuống dòng, cỡ chữ/đệm nhỏ lại cho vừa khổ A4 lề 10mm.
- **TỔNG TIỀN TT → TỔNG TIỀN HÀNG** (cả bản in và form nhập).
- **Công nợ trước phiếu** và **TỔNG CÔNG NỢ** chuyển xuống **dưới dòng "Số tiền bằng chữ"**, đóng khung riêng bên phải.

### 3. Số phiếu `PX26001`

`PX` + **2 số năm** + **3 số thứ tự** (`PX26001`, `PX26002`…). Sang 2027 tự thành `PX27001`. Vẫn quét cả số cũ `PBH…` nên thứ tự chạy tiếp, không trùng.

### 4. Nút **"Lập phiếu bán hàng"** (trước là "Lên phiếu bán hàng mới").

---

## BƯỚC 3.37 — Lên đơn: đơn vị mặc định là RI + hiện quy đổi tại chỗ (v6.24.4)

**Copy 2 file**: `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.24.4`) → Ctrl+F5. Không migration.

### Vì sao "đặt 12 ri mà xuất ra 12 cái"

Ô **Đơn vị** ở form Lên đơn đặt hàng trước đây mặc định **"Cái"**. Gõ `12` (ý là 12 ri) mà quên đổi ô đơn vị → đơn lưu **12 Cái**. Từ đó mọi thứ phía sau đều "đúng theo dữ liệu sai": trừ tồn 12 cái, phiếu bán hàng hiện `12 Cái (2 Ri5 dư 2)`.

### Đã sửa

- Mã hàng có hệ số quy đổi > 1 → ô Đơn vị **mặc định là Ri**, nhãn ghi rõ hệ số (`Ri5`, `Ri6`).
- Ngay dưới ô Số lượng hiện **quy đổi tức thì**: gõ `12` + đơn vị Ri → `= 60 Cái`; chọn Cái → `= 2 Ri5 dư 2`. Nhìn là biết ngay có nhầm đơn vị không.
- Đổi mã hàng giữa chừng → đơn vị và nhãn hệ số tự đặt lại theo mã mới.
- Form **Sửa đơn đặt hàng** cũng có dòng quy đổi này.

### Đơn đã lỡ lưu sai đơn vị

Vào **Đơn khách đặt hàng → Sửa**, đổi ô Đơn vị sang Ri (dòng quy đổi sẽ xác nhận `= 60 Cái`) rồi lưu — hệ thống tự tính lại phần giữ hàng / tồn kho.

---

## BƯỚC 3.36 — Bản in phiếu bán hàng: bố cục + Thuế GTGT + công nợ + đổi số phiếu sang PX (v6.24.3)

**Copy 3 file**: `backend/routes/banhang.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.24.3`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

### Bố cục bản in

- **Ngày tháng căn giữa** ngay dưới tiêu đề; **Số phiếu căn phải** ở dòng riêng.
- Cột **ĐVT QUY ĐỔI** chuyển lên **ngay cạnh cột SỐ LƯỢNG** (trước nằm cuối bảng, đọc rời rạc).
- Cột **TÊN HÀNG rộng 26%** (gấp đôi các cột số); tiêu đề cột căn giữa, nền xám nhạt.
- **VAT → THUẾ GTGT** ở bản in, form nhập và danh sách phiếu.

### 2 dòng công nợ cuối phiếu

| Dòng | Nội dung |
|---|---|
| **Công nợ trước phiếu PX26xxxx** | Mọi chứng từ của khách phát sinh **trước** phiếu này: phiếu bán hàng cũ + điều chỉnh − phiếu thu |
| **TỔNG CÔNG NỢ** | Công nợ trước **+** tổng tiền phiếu này |

Backend tính (`GET /banhang/phieu/:id`) nên khớp tuyệt đối với màn hình **Công nợ khách hàng** — cùng khóa nhóm theo TÊN KHÁCH.

### Số phiếu: `PBH` → `PX`

Phiếu mới mang số **`PX26xxxx`**. Hàm sinh số **quét cả tiền tố cũ** nên số thứ tự chạy tiếp (PBH260003 → PX260004), không quay về 0001 và không thể trùng mã.

> **Vẫn giữ 2 số năm** trong mã (`PX26` + 4 số). Nếu bỏ năm thành `PX0001` thì sang năm số thứ tự về 1 và **trùng mã với năm nay** — muốn bỏ hẳn thì nói, nhưng nên giữ.

---

## BƯỚC 3.35 — Thẻ kho: LƯU theo Cái nhưng HIỆN & NHẬP theo Ri (v6.24.2)

**Copy 2 file**: `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.24.2`) → Ctrl+F5. Không migration, không cần restart.

Tách bạch 2 thứ trước giờ hay lẫn:

| | |
|---|---|
| **Lưu trong CSDL** | theo **Cái** — bắt buộc, để bán lẻ được và không bị làm tròn (v6.24.1) |
| **Hiện & nhập trên màn hình** | theo **Ri** — đúng cách xưởng nghĩ |

### Bảng Thẻ kho

Ba cột **Tổng nhập · Tổng xuất · Khả dụng** giờ hiện **số Ri là số chính** (`19 Ri6`, lẻ thì `18 Ri6 dư 5`), số Cái để nhỏ bên dưới. Cột *Tồn quy ra Cái* giữ nguyên cho ai cần đối chiếu.

### Form Sửa / Tạo thẻ kho

Mỗi màu, ô **Số cắt** và **Nhập** tách thành **[số Ri] + [số cái lẻ]**, ngay dưới hiện `= 114 Cái` (số thật sẽ lưu). Nhập 19 ri → lưu 114 cái; mở lại vẫn thấy đúng 19 Ri + 0 lẻ. Hàng lẻ (bán 1 cái) không bị mất: `19 Ri + 5 lẻ = 119 Cái`.

Đổi **Tỷ lệ quy đổi** thì các ô này tự tính lại theo hệ số mới, giữ nguyên tổng số cái.

Mã không có ri (hệ số ≤ 1) vẫn 1 ô như cũ.

---

## BƯỚC 3.34 — ⚠️ Mã BÁN LẺ theo cái thì đơn vị chính PHẢI là Cái (v6.24.1)

**Copy**: `backend/routes/banhang.js`, `backend/routes/khohang.js`, `backend/utils/sua_don_vi_the_kho.js` → `pm2 restart qlnoibo`. Không migration.

### Vì sao xuất 1 cái lại báo lỗi

Tồn kho lưu **số nguyên theo đơn vị chính**. Mã quản theo **Ri** thì bán lẻ vài cái không biểu diễn được:

| Bán | Quy ra Ri | Làm tròn | Hậu quả |
|---|---|---|---|
| 1 Cái | 0,17 Ri | **0** | bán mà kho **không giảm** |
| 7 Cái | 1,17 Ri | **1** | trừ thiếu **1 cái**, sai âm thầm |
| 12 Cái | 2 Ri | 2 | đúng |

Trước đây hệ thống **làm tròn im lặng** → tồn lệch dần mà không ai biết. Nay **chặn hẳn** ở cả lên đơn đặt lẫn lên phiếu bán hàng, kèm hướng dẫn ngay trong thông báo lỗi.

### Cách xử lý: chuyển mã đó sang quản kho theo **CÁI**

```
cd D:\QLSX\backend
node utils/sua_don_vi_the_kho.js --ma=QD26C026 --den=Cai --quy-doi          :: chạy thử (nhân hệ số)
node utils/sua_don_vi_the_kho.js --ma=QD26C026 --den=Cai --quy-doi --ghi
```

**Không mất gì khi chuyển**: số liệu tự nhân hệ số (19 Ri → 114 Cái), màn hình vẫn có cột **Tồn quy ra Ri** hiện `18 Ri6 dư 5 Cái`, đơn khách đặt / phiếu bán hàng cũ ghi "Ri" vẫn quy đổi đúng — không phải sửa tay đơn nào.

> **Nguyên tắc**: mã nào **có bán lẻ theo cái** thì đơn vị chính để **Cái**. Chỉ để **Ri** với mã luôn bán nguyên ri.

---

## BƯỚC 3.33 — Sổ quỹ tiền mặt / ngân hàng + số tài khoản trên phiếu thu-chi (v6.24)

**CÓ MIGRATION** → chạy `database/migration_v669.sql` → copy `backend/routes/congno.js`, `frontend/js/module.congno.js`, `frontend/js/module.danhmuc.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.24`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. Danh mục **Tài khoản ngân hàng** (Danh mục → Tài khoản ngân hàng)

Khai các số tài khoản của công ty: Tên ngân hàng · Số tài khoản · Chủ TK · Chi nhánh · **Số dư đầu kỳ**.

### 2. Phiếu thu / Phiếu chi: chọn **Chuyển khoản** → hiện ô **Số tài khoản**

- Chọn *Chuyển khoản* mà chưa chọn số tài khoản thì **không lưu được** (sổ quỹ ngân hàng cần biết tiền vào/ra tài khoản nào).
- Chọn lại *Tiền mặt* thì ô số tài khoản tự ẩn **và xóa giá trị** (tránh gửi nhầm id cũ).
- Danh sách phiếu hiện thêm dòng nhỏ *"BIDV — 123456789"* dưới cột Hình thức.

### 3. Tab **Sổ quỹ** (phân hệ Quản lý công nợ)

- Thẻ tóm tắt từng quỹ: **Quỹ tiền mặt** và **từng tài khoản ngân hàng**, kèm số dư hiện tại lớn, dòng giải thích *"Đầu kỳ … + thu … − chi …"*, và **Tổng tiền đang có** ở đầu trang.
- Bấm vào thẻ → **sổ chi tiết**: từng phiếu thu/chi theo thời gian với **số dư lũy kế** sau mỗi phiếu.
- Số dư **luôn tính lại từ phiếu thu/chi** (không có bảng sổ quỹ riêng) nên không bao giờ lệch với chứng từ.
- Số dư đầu kỳ: tiền mặt khai ở **Danh mục → Cấu hình hệ thống → `QUY_TIEN_MAT_DAU_KY`**; ngân hàng khai ở từng dòng tài khoản.
- Phiếu chuyển khoản cũ (trước v6.24) chưa gán tài khoản sẽ gom vào một thẻ **"Chuyển khoản (chưa gán tài khoản)"** — vào sửa từng phiếu để gán, thẻ đó sẽ tự biến mất.
- Nhớ **cấp quyền** chức năng *Sổ quỹ* của phân hệ Quản lý công nợ.

### 4. Phiếu bán hàng — nhập liệu gọn hơn

- **Chân phiếu nằm ngay trong bảng** dòng hàng: TỔNG CỘNG → CK NPP (có nút *Áp 17%*) → TỔNG TIỀN TT → VAT → **TỔNG TIỀN SAU VAT** → dòng *Bằng chữ*, đúng khuôn mẫu Word.
- **Thêm dòng hàng = chèn thêm 1 dòng** vào bảng đang có, không vẽ lại cả bảng nên không mất số đang gõ; xóa dòng thì STT tự đánh lại.
- Tiêu đề cột của bản in **căn giữa**, có nền xám nhạt.

---

## BƯỚC 3.32 — Phiếu bán hàng: kẻ bảng, khách từ danh mục, SL theo Cái + ⚠️ SỬA LỖI "Khả dụng không trừ đơn chờ" (v6.23.2)

**Copy**: `backend/routes/khohang.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.23.2`) → `pm2 restart qlnoibo` → Ctrl+F5. Thêm công cụ `backend/utils/sua_datruton_don_moi.js`.

### ⚠️ 1. LỖI QUAN TRỌNG: cột "Khả dụng" không trừ đơn đang chờ

**Nguyên nhân**: cột `DonKhachDatHang.DaTruTon` có **mặc định = 1** (từ migration_v657, thời còn trừ tồn ngay khi lên đơn). Từ v6.23 đơn chỉ giữ hàng nhưng route "Lên đơn đặt hàng" nội bộ không ghi rõ cột này → đơn mới bị đánh dấu "đã trừ tồn" ⇒

- cột **Khả dụng KHÔNG trừ** các đơn đang chờ (lỗi bạn thấy),
- và nặng hơn: **hủy/xóa đơn sẽ HOÀN TỒN một lượng chưa từng trừ → tồn kho phồng lên**.

**Đã sửa** trong `khohang.js` (đơn mới luôn ghi `DaTruTon = 0`). **Các đơn đã lỡ tạo từ lúc chạy v6.23 tới giờ phải sửa cờ bằng công cụ** (không đụng tồn kho, chỉ sửa cờ):

```
cd D:\QLSX\backend
node utils/sua_datruton_don_moi.js --tu-ngay=2026-08-07          (chạy thử — đổi ngày bạn cài v6.23)
node utils/sua_datruton_don_moi.js --tu-ngay=2026-08-07 --ghi
```

### 2. Phiếu bán hàng — nhập liệu

- Khu nhập dòng hàng nay **kẻ bảng** đủ tiêu đề: STT · Mã hàng · Màu · **SL (Cái)** · Quy đổi · Giá bán lẻ (đ/Cái) · % CK shop · Giá bán · Thành tiền.
- **Số lượng nhập theo CÁI**, cột **Quy đổi** hiện ngay số **Ri** tương ứng (lẻ thì ghi "dư N"). Dòng **lấy từ đơn đặt** cũng tự quy về Cái, có ghi chú *"từ đơn #… · đặt 10 Ri"* để đối chiếu.
- Dòng tổng dưới form thêm **Tổng SL (Cái)**.

### 3. Khách hàng lấy từ DANH MỤC (cả 2 nơi)

- **Lên đơn đặt hàng** và **Lên phiếu bán hàng**: chọn khách từ danh mục Khách hàng thay vì gõ tự do; chọn xong tự điền **tên · SĐT · địa chỉ** vào phiếu.
- Chưa có khách? Bấm **+ Khách mới** ngay tại form, nhập **Tên · SĐT · Địa chỉ · Email** → lưu thẳng vào danh mục và chọn luôn, không phải thoát ra vào Danh mục.
- Lý do bắt buộc: **công nợ khách hàng nhóm theo TÊN KHÁCH**, gõ tự do lệch một dấu là tiền vào nhầm sổ.

### 4. Bản in phiếu

Cột **SỐ LƯỢNG** in theo **Cái** (ĐVT ghi "Cái"), cột **ĐVT QUY ĐỔI** in theo **Ri** (`33 Ri5 dư 2 Cái`), dòng TỔNG CỘNG có cả tổng Cái và tổng Ri.

---

## BƯỚC 3.31 — Sửa mã hàng khai SAI đơn vị chính (số Cái bị hiểu là Ri) (v6.23.1)

**Copy 2 file**: `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.23.1`) → Ctrl+F5. Thêm 2 công cụ mới (chỉ chạy khi cần): `backend/utils/kiem_ton_am.js`, `backend/utils/sua_don_vi_the_kho.js`. Không migration, không cần restart nếu chỉ copy 2 file frontend.

### Triệu chứng

Một số mã hàng: số liệu trong CSDL đúng, nhưng Thẻ kho hiện **số lượng xuất/tồn sai** — số đang là **Cái** mà màn hình hiểu là **Ri** (nhân thêm hệ số quy đổi), có mã còn báo **Âm kho**.

### Nguyên nhân

Thẻ kho lưu Nhập/Xuất/Tồn theo **đơn vị chính của từng mã** (`Đơn vị tính chính` trong form). Mã nào khai *Ri* nhưng số liệu thực chất là *Cái* thì mọi chỗ quy đổi đều nhân sai theo. Chỉ những mã khai sai bị, không phải tất cả.

### Cách xử lý

1. **Nhìn thấy đơn vị ngay trên bảng**: cột Tổng nhập / Tổng xuất / Khả dụng nay ghi rõ đơn vị của từng dòng (`40 Ri`, `120 Cái`); 2 cột quy đổi đổi tên thành **Tồn quy ra Cái** / **Tồn quy ra Ri** cho khỏi nhầm.
2. **Tìm mã khai sai** (chỉ đọc, không sửa gì):

```
cd D:\QLSX\backend
node utils/sua_don_vi_the_kho.js --liet-ke --nghi-ngo
```

   Đánh dấu `??` các mã khai *Ri* mà: số liệu **không chia hết** cho hệ số quy đổi, hoặc **đơn khách đặt phần lớn ghi "Cái"**.

3. **Sửa** — chọn đúng 1 trong 2 cách (chạy thử trước, thêm `--ghi` mới thực hiện; có backup JSON):

```
:: A) Số liệu ĐÃ ĐÚNG, chỉ khai sai nhãn đơn vị  -> chỉ đổi nhãn, giữ nguyên số
node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Cái
node utils/sua_don_vi_the_kho.js --ma=ABC123,XYZ789 --den=Cái --ghi

:: B) Muốn chuyển hẳn sang quản theo Ri, quy đổi cả số liệu (100 Cái -> 20 Ri)
node utils/sua_don_vi_the_kho.js --ma=ABC123 --den=Ri --quy-doi --ghi
```

   Cách B từ chối chạy nếu số liệu **không chia hết** cho hệ số (tránh làm tròn mất hàng).

4. **Mã đang âm kho** — soi nguyên nhân (chỉ đọc):

```
node utils/kiem_ton_am.js               :: chỉ mã đang âm
node utils/kiem_ton_am.js --ma=ABC123   :: 1 mã
```

   In ra: đã xuất theo từng phiếu bán hàng + từng đơn cũ đã trừ tồn, **số "đã xuất đúng"** tính lại theo đơn vị chính hiện tại, và chênh lệch so với cột đang lưu — đủ để biết nên sửa đơn vị hay nắn lại số.

5. **Cột Xuất LẪN LỘN đơn vị** (một phần đơn ghi Ri, một phần ghi Cái) → lệnh `--cot=xuat --chia` sẽ **báo không chia hết** (đúng, vì cả cột không cùng một đơn vị). Trường hợp này phải **nắn theo chứng từ** — quy đổi RIÊNG từng đơn theo đơn vị ghi trên chính đơn đó rồi cộng lại:

```
node utils/kiem_ton_am.js --ma=ABC123 --nan          :: chạy thử, in trước/sau từng màu
node utils/kiem_ton_am.js --ma=ABC123 --nan --ghi    :: ghi thật (có backup JSON)
```

   ⚠️ Nếu trước đây có ai **sửa tay số Xuất** trên màn hình Thẻ kho (hàng hỏng, mất mát, xuất ngoài luồng) thì phần đó không có chứng từ nên **sẽ mất** sau khi nắn — bản chạy thử in rõ chênh lệch và cảnh báo để quyết định trước.

> Đơn khách đặt / phiếu bán hàng **cũ** giữ nguyên đơn vị đã ghi trên từng phiếu; hệ thống tự quy đổi khi trừ tồn nên không phải sửa tay từng đơn.

---

## BƯỚC 3.30 — BÁN HÀNG + QUẢN LÝ CÔNG NỢ (v6.23) ⚠️ ĐỔI MÔ HÌNH TRỪ TỒN

### Cài đặt — làm ĐÚNG THỨ TỰ

1. Chạy `database/migration_v668.sql`.
2. Copy: `backend/server.js`, `backend/routes/banhang.js` (mới), `backend/routes/congno.js` (mới), `backend/routes/khohang.js`, `backend/routes/public.js`, `backend/utils/hoan_ton_don_cho_xu_ly.js` (mới), `frontend/js/module.congno.js` (mới), `frontend/js/module.khohang.js`, `frontend/js/module.danhmuc.js`, `frontend/js/common.js`, `frontend/js/app.js`, `frontend/index.html` (`?v=6.23`).
3. `pm2 restart qlnoibo` → Ctrl+F5.
4. **BẮT BUỘC — hoàn tồn cho các đơn cũ** (nếu bỏ qua sẽ bị trừ tồn 2 lần):

```
cd D:\QLSX\backend
node utils/hoan_ton_don_cho_xu_ly.js          (chạy thử, KHÔNG ghi)
node utils/hoan_ton_don_cho_xu_ly.js --ghi    (ghi thật, có backup JSON)
```

5. Vào **Quản lý User → Ma trận phân quyền**: cấp phân hệ **Quản lý công nợ** (Phiếu thu / Phiếu chi / Công nợ KH / Công nợ NCC / Điều chỉnh) + chức năng **Phiếu bán hàng** của Thẻ kho hàng hóa + 2 chức năng **Loại tài khoản / Danh mục tài khoản** của Danh mục.

### 1. ⚠️ Đổi mô hình trừ tồn (điều quan trọng nhất)

| | Trước v6.23 | Từ v6.23 |
|---|---|---|
| Khách đặt hàng (nội bộ / web) | **trừ tồn ngay** | chỉ **GIỮ HÀNG**, tồn không đổi |
| Trừ tồn thật | lúc lên đơn | lúc xuất **PHIẾU BÁN HÀNG** |
| Trạng thái sau khi giao | "Đã giao" | **"Đã xuất hàng"** (tự động khi lên phiếu) |

- Thẻ kho có cột **Khả dụng** = tồn kho − hàng đang giữ cho đơn đang chờ, kèm dòng nhỏ *"đang giữ N"*.
- **Catalogue công khai** hiện số **còn lại** đã trừ đơn đang chờ; màu nào khách đặt hết thì ẩn khỏi catalogue.
- Nút chuyển trạng thái sang **"Đã giao"** bị chặn cho đơn chưa xuất hàng (nếu không thì hàng vừa không trừ khỏi kho, vừa thôi được tính "đang giữ" ⇒ bán được 2 lần). Đường đúng là **🧾 Chuyển sang phiếu bán hàng**.
- Hủy/xóa phiếu bán hàng → **hoàn tồn** + đơn trở về "Chờ xử lý".

### 2. Phiếu bán hàng (tab mới trong Thẻ kho hàng hóa)

In đúng mẫu Word **PHIẾU XUẤT KHO KIÊM BIÊN BẢN BÀN GIAO**: Mã+ảnh · Tên hàng · ĐVT · SL · Giá bán lẻ · %CK shop · Giá bán · Thành tiền · ĐVT quy đổi, chân phiếu Tổng cộng → CK NPP → Tổng tiền TT → VAT → Tổng sau VAT, **số tiền bằng chữ**, 3 ô ký.

- Lên phiếu **mới** hoặc **lấy từ đơn khách đặt** (nút trong tab Đơn đặt hàng hoặc "📋 Lấy từ đơn khách đặt"). Một phiếu = **một khách**.
- Số phiếu `PBH<yy><4 số>` chạy suốt cả năm (cùng quy tắc mã lệnh SX v6.22). Tương tự `PT…` cho phiếu thu, `PC…` cho phiếu chi.
- **%CK NPP mặc định = 0** (khách shop). Khách NPP thì bấm nút *"Áp 17%"* — vì CK shop đã áp ở từng dòng, CK NPP là mức **giảm thêm**.
- **Bắt buộc chọn màu** từng dòng (thẻ kho quản theo màu — không có màu thì không biết trừ tồn ở đâu).
- Trừ tồn bằng `UPDATE ... WHERE (NhapCai − XuatCai) >= SL`: 2 người lưu phiếu cùng lúc **không thể** bán vượt tồn.

### 3. Quản lý công nợ (phân hệ mới)

- **Phiếu thu**: thu của khách (giảm công nợ) hoặc thu khác. Gán được vào 1 phiếu bán hàng — khi gán, hệ thống **tự lấy đúng tên khách của phiếu** (công nợ nhóm theo TÊN KHÁCH nên gõ lệch dấu là mất tiền).
- **Phiếu chi**: trả NCC (giảm công nợ NCC) / nhà gia công / nhân viên / khác. Tài khoản chi quyết định khoản đó có **tính chi phí kinh doanh** hay không.
- **Công nợ khách hàng** = tổng phiếu bán hàng (chưa hủy) + điều chỉnh − phiếu thu. Bấm tên khách để xem **sổ chi tiết** lũy kế.
- **Công nợ nhà cung cấp** = **tự tính** từ phiếu nhập vải (KG × đơn giá từng cây) + phiếu nhập phụ kiện (SL × đơn giá) + điều chỉnh − phiếu chi. Bấm tên NCC để xem sổ chi tiết từng phiếu.
- **Điều chỉnh công nợ**: nhập tay các khoản không tự tính được — **nợ đầu kỳ**, tiền **gia công / in thêu**, giảm giá (số dương = tăng nợ, âm = giảm).
- Cả 2 bảng công nợ đều **xuất Excel** (có dòng TỔNG).

### 4. Danh mục mới (trong phân hệ Danh mục)

- **Loại tài khoản** — có cờ *"Tính chi phí KD"* (đã seed 8 loại mẫu).
- **Danh mục tài khoản** — mã + tên + thuộc loại nào (đã seed 9 tài khoản mẫu).

### 5. Chưa làm (theo yêu cầu)

**Báo cáo lãi lỗ** — để làm sau. Dữ liệu đã sẵn sàng: doanh thu từ phiếu bán hàng, chi phí từ phiếu chi có tài khoản thuộc loại *"tính chi phí KD"*.

---

## BƯỚC 3.29 — Số thứ tự lệnh sản xuất chạy suốt cả năm (v6.22)

**Chỉ sửa backend** → copy `backend/routes/qlsx.js` → `pm2 restart qlnoibo`. Không migration, không cần Ctrl+F5 (frontend không đổi).

Mã lệnh SX vẫn giữ nguyên định dạng **`DH` + `yy` + `mm` + số thứ tự** (vd `DH2608015`), chỉ đổi cách đếm:

| | Trước | Nay |
|---|---|---|
| Sau `DH2607014`, sang tháng 8 | `DH2608001` (về 1 mỗi tháng) | **`DH2608015`** (tiếp số) |
| Sang năm mới | về 001 | về 001 (đúng như mong đợi) |

- Đếm trong phạm vi **cả năm** (`DH<yy>%`) thay vì từng tháng.
- Chỉ đếm mã **đúng định dạng** `DH+yy+mm+số`; mã gõ tay lạ (vd `DH26-07-9`) bị bỏ qua thay vì làm nhảy số.
- Quá 999 lệnh/năm thì ra `DH26121000` — vẫn đúng thứ tự, không bị lặp mã.
- Ô "Mã ĐH (tự sinh)" xem trước trên form Ra lệnh dùng chung hàm này nên hiện đúng ngay, không cần sửa gì thêm.
- **Mã cũ không bị ảnh hưởng** — chỉ mã tạo MỚI đi theo cách đếm mới. Nếu tháng 8 đã có lệnh `DH2608001…` tạo theo cách cũ thì số tiếp theo sẽ nhảy qua số lớn nhất của cả năm (không trùng, chỉ hở số).

---

## BƯỚC 3.28 — Ghi nhận May: "lần giao" hiện đúng số lượng đã giao (v6.21.2)

**Copy 3 file**: `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.21.2`) → `pm2 restart qlnoibo` → Ctrl+F5. Không migration.

**Nguyên nhân**: nút **💾 Lưu giao việc (chưa Gửi)** (v6.18) chỉ ghi dòng giao việc (`PhanCongMay`), **không** ghi SL theo màu (`TienDoChiTietMau`) — đúng thiết kế, vì SL lũy kế theo màu là việc của nút **Gửi**. Nhưng ô chọn "Ghi nhận May đã gửi" lại chỉ cộng SL theo màu, nên lần đó luôn hiện **"0 cái"** — trông như lần giao không có số lượng.

**Nay**:

- Nhãn từng lần: có SL theo màu → `… · <tổng> cái`; chưa Gửi mà đã giao việc → `… · đã giao <tổng SL giao việc> cái (chưa Gửi)`. Không còn lần nào hiện ra mà không có số lượng.
- Khung xem chi tiết của lần đang chọn có thêm bảng **"Giao việc của lần này"**: Nhân viên · Công đoạn may · Màu · **SL**, kèm tổng — trước chỉ ghi "có N dòng giao việc" rồi bắt mò xuống bảng lịch sử.
- Bảng SL theo màu khi rỗng ghi rõ *"chưa Gửi — lần này chỉ có giao việc, chưa ghi SL theo màu"* thay vì "(không có dòng màu nào)".
- Hộp xác nhận xóa 1 lần ghi nhận nói rõ số dòng **và số cái** giao việc sẽ mất theo.

---

## BƯỚC 3.27 — CK đánh CHUNG 1 tỷ lệ + Xuất Excel đơn khách + gộp đơn cùng mã/màu/ngày (v6.21 / v6.21.1)

**Copy 3 file**: `backend/routes/khohang.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.21.1`) → `pm2 restart qlnoibo` → Ctrl+F5.
**Migration `database/migration_v667.sql` là TÙY CHỌN** (chỉ ghi sẵn 33/17 vào CSDL; không chạy thì hệ thống tự mặc định 33/17 và lần bấm "Lưu tỷ lệ" đầu tiên sẽ tự tạo). **Không cần chạy migration_v666 nữa** — cách khai % theo từng mã hàng của v6.20 đã bỏ (chạy rồi cũng không sao, 2 cột đó chỉ nằm im).

### 1. Tỷ lệ CK **đánh chung**, không khai từng mã hàng

Ngay đầu tab **Thẻ kho / Tồn kho** có hộp **"Tỷ lệ chiết khấu dùng chung"**: ô *CK shop*, ô *CK NPP*, nút **💾 Lưu tỷ lệ** (cần quyền Sửa). Đổi 1 chỗ là bảng, bảng kê in và file Excel đổi theo.

- **Chiết khấu CHỒNG**: Giá shop = Giá bán × (1 − CK shop). **Giá NPP = giá SHOP × (1 − CK NPP)** — không tính lại trên giá bán.
- VD giá bán 100.000, CK 33% / 17% → shop **67.000** → NPP **55.610**.
- Form Tạo/Sửa thẻ kho không nhập % nữa; gõ Giá bán là hiện luôn 2 giá bên dưới ô để soát.

### 2. **Xuất Excel** ở danh sách Đơn khách đặt hàng

Nút **⬇️ Xuất Excel** trên thanh công cụ tab Đơn khách đặt hàng. File xuất **theo đúng 5 bộ lọc đang áp** (thời gian / khách / mã hàng / màu / trạng thái), dữ liệu **đã gộp** như trên màn hình, kèm Giá bán · Giá sau CK shop · Giá sau CK NPP · 3 cột Thành tiền tương ứng + dòng TỔNG tiền cuối bảng.

### 3. **Gộp** đơn cùng mã hàng + màu + ngày

Khóa gộp: **NGÀY + KHÁCH + MÃ HÀNG + MÀU + ĐƠN VỊ**. Có Đơn vị trong khóa vì "10 Cái" và "10 Ri" không được cộng thành 20.

- Danh sách trên màn hình: 1 dòng = 1 nhóm, SL đã cộng dồn, ghi *"gộp N đơn"*. Nhóm nhiều đơn hiện nút **▾ N đơn** — bấm để mở từng đơn con và **Sửa / Xóa / đổi trạng thái / In phiếu vẫn theo TỪNG đơn** như trước (không mất thao tác nào).
- Ô tích ở dòng nhóm = chọn **tất cả** đơn trong nhóm; 2 nút In cũ vẫn chạy đúng.
- Nhóm có nhiều trạng thái thì hiện nhiều badge; lọc theo trạng thái sẽ khớp nếu **một trong** các đơn của nhóm mang trạng thái đó.
- Bộ đếm ghi cả 2 con số: *"Đang hiện X / Y dòng gộp (Z / T đơn)"*.

### 4. Bảng kê in thêm 3 cột giá

Phiếu giao hàng (1 khách hoặc nhiều khách) nay in: STT · Mã hàng · Màu · SL · Đơn vị · **SL (Cái)** · **Giá bán (đ/Cái)** · **Giá sau CK shop** · **Giá sau CK NPP** + dòng **Tổng SL (Cái)**, các dòng cũng **đã gộp** theo cùng khóa ở trên. Cần thêm cột **Thành tiền** trên bản in thì nói (Excel đã có).

### 5. v6.21.1 — sửa lỗi xuất Excel + giá tính THEO CÁI

- **Xuất Excel lỗi**: nút cũ dùng `<a download="">` nên trình duyệt hay lưu thành file tên `export` **không có đuôi .xlsx** → Excel mở không được; và nếu backend trả JSON lỗi thì cũng bị lưu thành "file Excel hỏng", không thấy nguyên nhân. Nay tải bằng `fetch` + Blob, **đặt thẳng tên file**, và nếu backend báo lỗi thì **hiện đúng câu lỗi** ra góc màn hình. Backend cũng đã bọc `try/catch` quanh chỗ đọc tỷ lệ CK để bảng `CauHinhHeThong` có vấn đề cũng không làm chết cả tab.
- **Giá theo CÁI**: giá bán là giá **1 Cái**, nên bản in và Excel thêm cột **SL quy đổi (Cái)** (đơn đặt theo *Ri* thì × tỷ lệ quy đổi của mã hàng) và **Thành tiền tính trên SL Cái** — trước đây đơn đặt theo Ri bị tính thiếu đúng bằng số lần quy đổi. Tiêu đề 3 cột giá ghi rõ **(đ/Cái)**. Dòng TỔNG của Excel cộng thêm **Tổng SL (Cái)**.

---

## BƯỚC 3.26 — Thẻ kho hàng hóa: 2 cột Giá sau CK shop / Giá sau CK NPP (nhập %) (v6.20 — ĐÃ THAY BẰNG v6.21)

> ⚠️ Cách khai % **theo từng mã hàng** dưới đây **đã bỏ ở v6.21** (BƯỚC 3.27): tỷ lệ nay đánh chung 1 lần cho mọi mã hàng và giá NPP tính chồng trên giá shop. Giữ lại đoạn này để tra lịch sử; **không cần chạy migration_v666**.

**CÓ MIGRATION** → chạy `database/migration_v666.sql` → copy `backend/routes/khohang.js`, `frontend/js/module.khohang.js`, `frontend/index.html` (`?v=6.20`) → `pm2 restart qlnoibo` → Ctrl+F5.

Danh sách **Thẻ kho / Tồn kho** có thêm 2 cột ngay sau **Giá bán**: **Giá sau CK shop** và **Giá sau CK NPP**. Trong form Tạo/Sửa thẻ kho chỉ nhập **% chiết khấu** (ô *% CK shop*, *% CK NPP*), giá hiện ngay bên dưới ô nhập để kiểm tra trước khi lưu.

- **CSDL chỉ lưu %**, giá sau CK **luôn tính lúc hiển thị** = `Giá bán × (1 − %/100)`. Nhờ vậy đổi Giá bán là 2 cột tự đúng theo — không bao giờ có chuyện "giá sau CK còn giá cũ".
- **Để trống** = *không áp chiết khấu* → cột hiện `—`. Khác hẳn nhập **0** (= CK 0%, cột hiện đúng bằng giá bán). Xóa trống lại được bình thường (2 cột này ghi thẳng, không bọc `ISNULL` như Giá Aloha/Mã Barcode).
- Nhập % là **số phần trăm** (20 = 20%). ⚠️ Khác `PhanTramVAT` của Báo giá Aloha (lưu dạng phân số 0.1 = 10%) — đừng sao chép công thức giữa 2 chỗ.
- **Xuất Excel** của tab này có thêm 4 cột: `% CK shop`, `Giá sau CK shop`, `% CK NPP`, `Giá sau CK NPP`.
- Chưa chạy migration_v666 thì màn hình **vẫn mở được**, 2 cột chỉ hiện `—` và ô % lưu không có tác dụng (backend dò cột bằng `COL_LENGTH` trước khi đọc/ghi).
- Không cần cấp quyền mới (dùng chức năng `KHOHANG/items` sẵn có).
- Chưa áp vào **Catalogue công khai** và **Đơn khách đặt hàng** — 2 chỗ đó vẫn dùng **Giá bán**. Nói nếu muốn đơn khách tự lấy giá theo loại khách (shop/NPP).

---

## BƯỚC 3.25 — Công đoạn May: người đã giao HIỆN NGAY tại ô Nhân viên & SL, sửa tại chỗ (v6.19)

**Chỉ sửa frontend** → copy `frontend/js/module.qlsx.js` + `frontend/index.html` (`?v=6.19`) → Ctrl+F5 (không cần restart pm2).

Trước đây lưu xong thì dòng nhân viên **biến mất** khỏi ô nhập, chỉ còn một dòng chữ xám *"Đã giao: Tên (SL)"*; muốn sửa phải xuống bảng "Lịch sử giao việc nội bộ" bên dưới.

Nay ngay trong ô **"Nhân viên & SL"** của từng công đoạn may, mỗi người đã giao là **một dòng sửa được tại chỗ**: ô chọn nhân viên + ô số lượng + **💾** (lưu sửa dòng đó) + **🗑️** (xóa dòng đó), nền xanh nhạt để phân biệt với dòng đang nhập mới.

- Bấm **💾 Lưu giao việc** xong: các dòng vừa lưu **đổi luôn thành dòng đã-lưu ngay tại đó** (không mất đi), bảng lịch sử bên dưới cũng tự làm mới. Dòng nhập tạm được dọn để bấm **Gửi** sau đó không ghi trùng.
- Xóa một dòng có xác nhận, kèm nhắc rằng **lương khoán may** của người đó giảm tương ứng.
- Nút 💾/🗑️ hiện theo **quyền Sửa/Xóa** của chức năng "Ghi nhận tiến độ" (v6.18). Không có quyền thì hiện dạng chữ `✔ Tên (SL)` như trước.

---

## BƯỚC 3.24 — Công đoạn May: sửa/xóa việc đã giao theo PHÂN QUYỀN + nút Lưu giao việc (v6.18)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.18`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. Sửa / xóa việc đã giao nay **phân quyền được**

Trước đây 2 route sửa/xóa `PhanCongMay` chặn cứng `isAdmin` (từ v5.5/v5.30) — cấp quyền trong Ma trận phân quyền **không có tác dụng**, admin phải tự làm hộ tổ May. Nay đi theo đúng ma trận như mọi chỗ khác:

- **Sửa** cần quyền **Sửa** của chức năng **Ghi nhận tiến độ** (`QLSX/tiendo`).
- **Xóa** cần quyền **Xóa** của chức năng đó.
- Nút Sửa/Xóa trên giao diện cũng hiện theo đúng 2 quyền này (trước chỉ hiện với admin).

Muốn giữ chặt như cũ thì **không cấp** quyền Sửa/Xóa chức năng "Ghi nhận tiến độ" cho nhóm đó.

### 2. Nút **💾 Lưu giao việc (chưa Gửi)**

Ngay dưới bảng "Nhân viên & SL" ở công đoạn May. Giao được ai thì lưu người đó; **"Gửi" để dành cho lúc chốt công đoạn** (chỉ Gửi mới đẩy con trỏ công đoạn sang bước sau).

- Lưu xong: các ô SL vừa lưu được **xóa trắng** để bấm Gửi sau đó không ghi trùng, và bảng **"Lịch sử giao việc nội bộ đã ghi nhận"** tự làm mới.
- Áp dụng **cùng khống chế** như lúc Gửi: tổng SL giao trong 1 công đoạn ≤ tổng SL cắt màu chính.
- Kỹ thuật: `PhanCongMay.TienDoID` là NOT NULL nên phải có bản ghi tiến độ May để gắn vào — route mới **dùng lại bản ghi tiến độ May của đúng ngày đó** nếu đã có, chưa có thì tạo 1 bản ghi. Bấm Lưu nhiều lần trong ngày vẫn chỉ **một** lần ghi nhận May, và **không** đụng tới công đoạn hiện tại / % hoàn thành.

---

## BƯỚC 3.23 — Giá thành thêm chi phí BỘ PHẬN CẮT + công đoạn Cắt lưu từng sơ đồ (v6.17)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.17`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. Giá thành: thêm nhóm **6. Bộ phận cắt (tiền bàn cắt)**

Tiền bàn cắt của từng sổ cắt = **mét sơ đồ × khổ vải × tổng số lớp × đơn giá** — **đúng công thức bảng lương trải vải cắt** (v5.91, đơn giá lấy từ cấu hình `LUONG_CAT`, mặc định 1100). Bảng chi tiết liệt kê từng sổ cắt (ngày, mét sơ đồ, khổ, tổng lớp, đơn giá, thành tiền). Sổ nào **chưa khai mét/khổ sơ đồ** thì tiền = 0 và có dấu ⚠️ ngay dòng đó.

Chi phí này vào tổng, nên **giá thành 1 SP đã bao gồm tiền bàn cắt ÷ tổng số lượng cái** (chia theo SL hoàn thành như các nhóm khác). Chi phí chung chuyển thành nhóm **7**.

> Cùng lưu ý như nhóm nhân công: công thức tiền cắt được **copy từ `payroll.js`**; sửa đơn giá/công thức lương cắt thì phải sửa đồng bộ ở `tinhGiaThanh()` trong `qlsx.js`.

### 2. Công đoạn Cắt: nút **💾 Lưu sơ đồ này**

- Mỗi sơ đồ trong form Cắt có nút lưu riêng — không phải nhập hết mọi sơ đồ rồi mới bấm "Gửi".
- **Sơ đồ đã có sổ cắt KHÔNG còn hiện trong ô "Sơ đồ đang nhập liệu"** nữa (kể cả khi mở lại form sau này) — hết chuyện ghi trùng sơ đồ đã cắt. Nhãn ô chọn ghi rõ `còn 2/3 sơ đồ chưa có sổ cắt`, và liệt kê những sơ đồ đã lưu ở dòng nhắc màu xanh bên dưới.
- Lưu xong: sơ đồ đó biến khỏi ô chọn, form nhảy sang sơ đồ còn lại, khối **"Sổ cắt đã ghi nhận"** tự làm mới để thấy ngay sổ vừa lưu.
- Cả 3 sơ đồ đã có sổ cắt → khu vực nhập liệu thay bằng thông báo xanh, hướng dẫn dùng nút **✏️ Sửa / thêm cây** ở khối "Sổ cắt đã ghi nhận" nếu cần chỉnh.
- Nút **Gửi** vẫn dùng được cho các sơ đồ còn lại (gửi nhiều sơ đồ một lần như trước).

---

## BƯỚC 3.22 — Sửa phiếu nhập phụ kiện: đổi bộ lọc loại KHÔNG còn mất dòng đã nhập (v6.16)

**Không migration, không sửa backend** → copy `frontend/js/module.phukien.js` + `frontend/index.html` (`?v=6.16`) → Ctrl+F5 (không cần restart pm2).

**Nguyên nhân**: hàm nạp lại danh sách phụ kiện cho các dòng (`refreshAllRowsPhuKienList`) **luôn xóa trắng ô chọn của mọi dòng** rồi mới nạp danh sách mới. Cách đó đúng cho phiếu **XUẤT** khi đổi đơn hàng gắn kèm (danh sách phụ kiện hợp lệ đổi hẳn, phải chọn lại), nhưng ô **"Loại phụ kiện" ở phiếu NHẬP chỉ là bộ lọc cho dễ tìm** (từ v6.10) — không liên quan gì tới nội dung phiếu, nên xóa dòng đã nhập là sai.

**Đã sửa**: đổi bộ lọc nay **giữ nguyên toàn bộ dòng đã nhập**, và món đang chọn của mỗi dòng vẫn nằm trong danh sách của dòng đó dù không thuộc loại đang lọc. Nhờ vậy **sửa phiếu để thêm phụ kiện thuộc loại khác** chỉ cần: đổi bộ lọc → bấm *+ Thêm dòng phụ kiện* → chọn mã mới → Lưu. Nhãn ô lọc đổi thành *"Lọc theo loại phụ kiện (chỉ để dễ tìm, không ảnh hưởng phiếu)"* kèm dòng nhắc ngay dưới.

Riêng phiếu **XUẤT** khi đổi **đơn hàng** gắn kèm thì vẫn xóa lựa chọn như cũ — chỗ đó gọi hàm với cờ `{ xoaLuaChon: true }`, có lý do nghiệp vụ rõ ràng.

---

## BƯỚC 3.21 — TÍNH GIÁ THÀNH SẢN PHẨM theo lệnh sản xuất (v6.15)

**CÓ MIGRATION** → chạy `database/migration_v665.sql`, rồi copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.15`) → `pm2 restart qlnoibo` → Ctrl+F5.

> ⚠️ Sau migration vào **Ma trận phân quyền** cấp chức năng **Quản lý sản xuất → Giá thành sản phẩm**, không thì tab không hiện.

Tab mới **Quản lý sản xuất → Giá thành sản phẩm**: chọn 1 lệnh SX → bảng bóc tách 6 nhóm chi phí → **giá thành 1 sản phẩm**. In được.

| Nhóm chi phí | Lấy ở đâu |
|---|---|
| **1. Vải** | với **từng cây đã cắt**: KG/mét đã dùng (khai ở sổ cắt) × **đơn giá nhập của chính cây đó** |
| **2. Phụ kiện** | SL đã **xuất cho lệnh** × đơn giá của **lần nhập gần nhất** (phiếu xuất không có cột đơn giá) |
| **3. Gia công ngoài** | SL nhận × đơn giá hạng mục gia công (đúng như bảng lương gia công) |
| **4. May nhà làm** | Σ(SL giao × thành tiền/cái) — **đúng công thức bảng lương khoán may** |
| **5. In thêu** | SL nhận × đơn giá hạng mục in thêu (quy tắc v6.01) |
| **6. Chi phí chung** | **nhập tay** tại đây (điện nước, vận chuyển, khấu hao...) — lưu theo từng lệnh |

**Giá thành 1 SP = tổng chi phí ÷ SL hoàn thành**, ưu tiên **SL nhập kho thực tế**; chưa nhập kho thì lấy **SL cắt** và ghi rõ đang lấy nguồn nào.

Chỗ nào thiếu số liệu thì **đánh dấu ⚠️ đỏ** ngay tại dòng đó chứ không âm thầm tính 0: cây vải **chưa khai KG/mét đã dùng** (tạm lấy KG đã xuất cho lệnh), cây **chưa có đơn giá nhập**, phụ kiện **chưa từng nhập có đơn giá**. Nhìn là biết phải đi khai thêm ở đâu.

> Chi phí nhân công ở nhóm 4 dùng lại **đúng biểu thức** của `payroll.js` (dual-path đơn giá mới/cũ). Nếu sau này sửa công thức lương khoán may thì **phải sửa đồng bộ** ở `tinhGiaThanh()` trong `qlsx.js`, kẻo 2 nơi ra 2 số khác nhau.

---

## BƯỚC 3.20 — Công cụ ĐỔI MÃ LOẠI VẢI (kéo theo mã vải + mã cây) (v6.14)

**Không migration, không sửa phần mềm đang chạy** → chỉ copy thêm 1 file: `backend/utils/doi_ma_loai_vai.js`. Không cần restart.

Hệ thống sinh mã dây chuyền: `MaVai = <MaLoai>-<MaMau>` và `MaCay = <MaVai><ddmmyy><số thứ tự>`. Nên đổi mã loại vải là phải đổi cả 3 chỗ mới nhất quán.

```
cd C:\...\QLNoiBo\backend
node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK                  (CHỈ XEM danh sách sẽ đổi)
node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --ghi            (đổi thật: mã loại + mã vải + mã cây)
node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --ghi --giu-ma-cay   (giữ nguyên mã cây đã in tem)
```

- Đổi `LoaiVai.MaLoai` → tất cả `DanhMucVai.MaVai` bắt đầu bằng mã cũ → tất cả `VaiCay.MaCay` bắt đầu bằng mã vải cũ (kèm **sinh lại QRCode**).
- Mã vải / mã cây **không** bắt đầu bằng mã cũ (nhập tay, mã tem cũ quét vào) thì **bỏ qua**, có liệt kê ra để biết.
- **Không hỏng dữ liệu liên kết**: sổ cắt, phiếu xuất, kiểm kê đều nối bằng `CayID` chứ không lưu mã dạng chữ.
- Kiểm **trùng mã mới** trước khi ghi (MaVai/MaCay đều là khóa duy nhất) — trùng thì dừng, không sửa gì. Ghi trong **một giao dịch**: lỗi giữa chừng là quay lui hết, không để mã vải một đằng mã cây một nẻo.
- Phải gõ đúng chữ `DOI` để xác nhận; sao lưu ra `backend\backup\doimaloaivai_<thời điểm>.json`.

> ⚠️ **TEM ĐÃ IN DÁN TRÊN CÂY VẢI vẫn mang mã cũ.** Đổi mã cây xong thì quét QR / gõ mã cũ sẽ không tra ra cây nữa ⇒ **phải in lại tem** cho các cây bị đổi (Kho vải → In tem theo ngày nhập, hoặc mở phiếu nhập → In tem). Không muốn đụng tem thì dùng `--giu-ma-cay`: chỉ đổi mã loại + mã vải, mã cây giữ nguyên (chấp nhận mã cây cũ không còn khớp tiền tố mã vải mới).

### v6.14.1 — xem danh sách loại vải + GỘP 2 loại vải

```
node utils/doi_ma_loai_vai.js --liet-ke                              (mã, tên, số mã vải, số cây của MỌI loại)
node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --gop             (xem trước khi GỘP)
node utils/doi_ma_loai_vai.js --tu=CT4CM --den=CTK --gop --ghi       (gộp thật)
```

Nếu mã mới **đã có loại vải khác dùng** thì công cụ không đổi mà **in ra bảng so sánh 2 loại** (tên, số mã vải, số cây) kèm 3 cách xử lý: gộp / đặt mã khác / đổi mã của loại kia trước.

**GỘP** = chuyển toàn bộ mã vải + cây vải của loại cũ sang loại đang giữ mã mới, đổi mã theo, chuyển luôn các tham chiếu (**Ra lệnh SX**, **Chỉ định vải SX**, **Định mức**), rồi **xóa loại cũ**. Mã vải nào **trùng màu** với loại đích thì gộp thẳng vào mã vải đó (cây chuyển sang, dòng mã vải cũ bị xóa) — nhờ vậy không bị 2 mã vải cùng loại+màu. Tất cả trong **một giao dịch**.

### v6.14.7 — XÓA HẲN 1 loại vải (kèm mã vải của nó)

```
node utils/doi_ma_loai_vai.js --liet-ke                          (lấy ID)
node utils/doi_ma_loai_vai.js --xoa-loai --id=130                (xem trước)
node utils/doi_ma_loai_vai.js --xoa-loai --id=130 --ghi          (xóa thật, gõ XOA)
```

Chỉ xóa khi loại đó **thực sự sạch**. Công cụ kiểm 4 chỗ có thể đang giữ loại vải lại và in số lượng từng chỗ:

| Đang dùng ở | Nếu còn thì |
|---|---|
| **Cây vải** (tồn kho thật) | DỪNG — chuyển cây sang loại khác bằng `--gop`, hoặc xóa cây bằng `xoa_cay_vai.js` |
| **Ra lệnh SX** (Cấu trúc vải) | DỪNG — dùng `--gop` để chuyển tham chiếu sang loại đích |
| **Chỉ định vải SX** | DỪNG — như trên |
| **Định mức** (theo loại hoặc theo mã vải) | DỪNG — như trên |

Sạch thì xóa **các mã vải của loại đó + dòng loại vải**, trong một giao dịch, có backup JSON. Vướng thì in ra đúng lệnh `--gop` cần chạy — không tự ý xóa dữ liệu lệnh SX / chỉ định của người khác.

### v6.14.5 — XÓA 1 loại vải, chuyển dữ liệu sang loại khác (chỉ định bằng TÊN)

Dùng khi một loại vải khai trùng/không dùng đến nhưng **vẫn còn mã cây thuộc nó** — xóa thẳng trong Danh mục sẽ vướng khóa ngoại.

```
node utils/doi_ma_loai_vai.js --gop --tu-ten="ZIP511B MẦU" --den-ten="ZIP511B" --giu-ma-cay
node utils/doi_ma_loai_vai.js --gop --tu-ten="ZIP511B MẦU" --den-ten="ZIP511B" --giu-ma-cay --ghi
```

- `--tu-ten` / `--den-ten` chỉ định loại vải bằng **tên**; `--tu-id` / `--den-id` chỉ định bằng **LoaiVaiID** (lấy ở `--liet-ke`) — **cách chắc ăn nhất**, xem ghi chú về dấu tiếng Việt bên dưới.

> **v6.14.6 — gõ tên có dấu vào CMD hay bị trượt.** Windows chuyển tham số sang bảng mã của console trước khi Node nhận, ký tự nào không biểu diễn được thành `?` (vd `"ZIP511B MẦU"` → `ZIP511B M?U`) nên so khớp chính xác luôn không tìm thấy. Đã sửa: so khớp tên **bỏ dấu, không phân biệt hoa/thường, gộp khoảng trắng**, coi `?` là *một ký tự bất kỳ*, và nếu vẫn không ra thì **liệt kê các loại gần giống kèm ID** để dùng `--tu-id`. `--liet-ke` nay in thêm cột **ID**.
- Chuyển hết mã vải + cây vải + tham chiếu (Ra lệnh SX / Chỉ định vải SX / Định mức) sang loại đích rồi **xóa loại nguồn**. Mã vải trùng màu với loại đích thì gộp vào mã đó.
- Nếu **cả hai loại đều có mã** thì mã vải khớp tiền tố sẽ đổi theo mã loại đích; loại nào **chưa có mã** thì mã vải **giữ nguyên tên**, chỉ chuyển loại.
- `--giu-ma-cay` để **không** đổi mã cây (tem đã dán vẫn dùng được) — thường là điều muốn khi chỉ đang dọn danh mục.
- Loại nguồn **không còn cây nào** thì lệnh vẫn chạy (chỉ xóa dòng loại vải).

### v6.14.4 — đổi thẳng MÃ VẢI theo tiền tố (`--ma-vai`)

Dùng khi mã vải **không** theo công thức `<MaLoai>-<MaMau>` (nhập tay / nhập từ Excel), chỉ muốn đổi chuỗi mã vải chứ không đụng bảng Loại vải:

```
node utils/doi_ma_loai_vai.js --ma-vai --tu=CTTAU_ --den=CTT4C_          (xem trước)
node utils/doi_ma_loai_vai.js --ma-vai --tu=CTTAU_ --den=CTT4C_ --ghi    (làm thật)
```

Đổi mọi mã vải **bắt đầu bằng** `CTTAU_` → `CTT4C_` (vd `CTTAU_TRANG` → `CTT4C_TRANG`), và mã cây theo sau (`CTTAU_TRANG010825001` → `CTT4C_TRANG010825001`) kèm sinh lại QR.

**CHỈ đổi mã vải, giữ nguyên mã cây và loại vải** (tem đã dán không phải in lại):
```
node utils/doi_ma_loai_vai.js --ma-vai --giu-ma-cay --tu=CTTAU_ --den=CTT4C_          (xem trước)
node utils/doi_ma_loai_vai.js --ma-vai --giu-ma-cay --tu=CTTAU_ --den=CTT4C_ --ghi    (làm thật)
```
Cây cũ vẫn tra cứu / xuất kho / vào sổ cắt bình thường (hệ thống nối bằng `CayID`, không nối bằng chuỗi mã). Điểm duy nhất mất đi: ở màn **Nhập kho**, khi quét tem **cũ** hệ thống suy ra loại vải + màu bằng cách khớp mã cây với tiền tố mã vải — mã cây cũ không còn khớp mã vải mới nên sẽ không tự đoán ra, lúc đó chọn tay loại vải + màu như bình thường.

> **Bẫy đã tránh:** không dùng SQL `LIKE 'CTTAU_%'` để lọc — trong LIKE thì **`_` là ký tự đại diện** (khớp 1 ký tự bất kỳ) nên sẽ dính nhầm cả `CTTAUXANH`. Công cụ lấy hết mã vải rồi lọc bằng so khớp chuỗi thật.

> **v6.14.3 — sửa lỗi `The DELETE statement conflicted with the REFERENCE constraint … DanhMucVai`.** Khi GỘP, những mã vải **không bắt đầu bằng mã cũ** (nhập tay / từ hệ thống cũ, vd `VAICU-01`) bị bỏ qua hẳn nên vẫn trỏ vào loại cũ ⇒ xóa loại cũ là vướng khóa ngoại, cả giao dịch quay lui (không mất dữ liệu, chỉ là không làm được). Nay khi GỘP thì **mọi** mã vải của loại cũ đều rời khỏi loại cũ: khớp tiền tố thì đổi tên, không khớp thì **giữ nguyên tên nhưng vẫn chuyển sang loại đích** (có liệt kê ra). Kèm 2 chốt: kiểm bảng tham chiếu tồn tại **trước** khi mở giao dịch, và trước khi xóa loại cũ thì kiểm còn mã vải nào sót không để báo tiếng Việt rõ ràng thay vì ném lỗi khóa ngoại.

> **v6.14.2 — tự tránh trùng mã cây khi gộp.** Hai loại vải có thể cùng nhập một ngày, cùng màu ⇒ đổi mã xong ra đúng mã cây đã có bên loại đích (vd `CTK-XANH010825001`). Trước đây gặp vậy là **dừng toàn bộ**, phải sửa tay từng cây. Nay công cụ tự thêm hậu tố `-2`, `-3`… cho những cây bị đụng và **in ra danh sách** cây nào bị thêm. Tem in lại theo mã mới nên không ảnh hưởng thực tế.

---

## BƯỚC 3.19 — Lịch sử nhập/xuất gắn theo từng mã cây vải & mã phụ kiện, bấm mở phiếu ngay (v6.13)

**Không migration**, **có sửa backend** → copy 5 file:

| File | Ghi chú |
|---|---|
| `backend/routes/khovai.js` | route mới `GET /cay/:cayId/lichsu` |
| `backend/routes/phukien.js` | trả thêm `PhieuID` ở lịch sử thẻ kho |
| `frontend/js/module.khovai.js` | popup lịch sử cây vải + mã cây bấm được + nút Sửa phiếu |
| `frontend/js/module.phukien.js` | lịch sử có cột Số phiếu bấm được + popup lịch sử theo mã + nút Sửa phiếu |
| `frontend/index.html` | `?v=6.13` |

→ `pm2 restart qlnoibo` → Ctrl+F5.

### Kho vải

- **Mọi chỗ hiện Mã cây đều bấm được**: tab *Tồn theo cây*, popup *Danh sách cây vải* (khi bấm mã vải/trạng thái), và bảng chi tiết trong *phiếu nhập* / *phiếu xuất*.
- Popup **Lịch sử cây vải** hiện đủ: **phiếu nhập** (số phiếu, ngày, NCC, hóa đơn), **các phiếu xuất** (số phiếu, ngày, đơn hàng, kiểu vải, KG/mét), **xuất vật tư phần vải** (nếu CSDL đã có bảng đó), **đã đưa vào sổ cắt** (ngày, lệnh SX, số lớp) và **kiểm kê** — nghĩa là đủ mọi nguồn làm đổi tồn, cộng lại khớp với tồn của cây.
- Bấm **số phiếu** trong popup → mở đúng phiếu đó ra xem, có nút **✏️ Sửa phiếu** và **🖨️ In phiếu** ngay trong cửa sổ. Đóng phiếu thì **quay lại popup lịch sử** (nhờ ngăn xếp modal v5.97), không bị thoát hết.

### Phụ kiện

- Bảng lịch sử nhập/xuất (Thẻ kho khi chọn 1 mã, và popup **Lịch sử** ở tab Danh mục) có thêm cột **Số phiếu** bấm được → mở phiếu nhập/xuất ra xem, kèm **✏️ Sửa phiếu** / **🖨️ In phiếu**.
- Ở bảng **Tồn kho tổng hợp**, bấm **Mã PK** là mở luôn popup lịch sử của mã đó, không phải gõ tìm lại.

> Nút "Sửa phiếu" chỉ hiện với người có quyền Sửa của phân hệ tương ứng; máy chủ vẫn kiểm tra lại quyền khi lưu.

---

## BƯỚC 3.18 — Công đoạn May: hiện đúng Tổng SL cắt + sửa/xóa được ghi nhận đã gửi (v6.12)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.12`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. "Tổng SL cắt (đã quy đổi, chỉ tính màu chính)" = 0 dù đã cắt 6 bàn

**Nguyên nhân**: điều kiện lọc màu chính (thêm ở v5.36) là `MauSacID **IN** (danh sách màu Chính của Cấu trúc vải)`. Nhưng từ v5.13 **màu ở Ra lệnh SX gõ tự do**, `DonHangChiTietVai.MauSacID` thường **NULL** ⇒ danh sách rỗng ⇒ lọc sạch mọi màu ⇒ SL = 0. Số bàn cắt vẫn hiện 6 vì chỗ đếm bàn không lọc theo màu — đúng cái nghịch lý anh thấy.

**Đã sửa**: đảo thành **loại trừ** đúng những màu được khai là **Phối** (có MauSacID thật). Dữ liệu đầy đủ thì kết quả y như cũ; dữ liệu thiếu MauSacID thì không còn bị xoá sạch. Áp cho cả `getCatMauList` (May/Kho nhập/Giao in thêu) và `getStageActualQtyByColor` (đối chiếu Kho nhập).

### 2. Hiện **số bàn cắt / tổng số bàn cắt** (vd `6/7`)

Dòng đó nay ghi `Số bàn cắt: 6/7 bàn`. Số đầu = số bàn của **đợt cắt đang được tính**, số sau = **tổng bàn cắt của cả đơn**. Đơn cắt nhiều đợt mà 2 số lệch nhau thì có thêm dòng nhắc màu cam "đơn cắt nhiều đợt — số trên chỉ tính đợt cắt gần nhất".

### 3. Công đoạn May **sửa được sau khi đã bấm Gửi** (giống công đoạn Cắt)

Trong form công đoạn May có thêm khối **"Ghi nhận May đã gửi (N lần)"**: chọn lần ghi nhận → xem SL lũy kế theo từng màu → **✏️ Sửa** (sửa SL từng màu, ngày, ghi chú của ĐÚNG lần đó) hoặc **🗑️ Xóa lần này**.

- Trước đây gõ nhầm SL ở May thì phải ghi thêm một lần "bù" — lịch sử rối và số lũy kế sai.
- Xóa **không kéo lùi** công đoạn hiện tại của đơn (giống xóa sổ cắt v5.99).
- ⚠️ Lần ghi nhận có **giao việc nội bộ** thì xóa là mất luôn các dòng đó ⇒ **lương khoán may** của nhân viên trong lần đó giảm theo. Hộp xác nhận nói rõ số dòng sẽ mất. Muốn sửa riêng từng dòng giao việc thì vẫn dùng bảng "Lịch sử giao việc nội bộ" (quyền Admin).
- May **không** đụng tới Thẻ kho hàng hóa (chỉ công đoạn Kho nhập mới cộng thẻ kho) nên sửa/xóa ở đây không làm lệch tồn thành phẩm.

---

## BƯỚC 3.17 — Công cụ XÓA CÂY VẢI THEO MÃ VẢI (v6.11)

**Không migration, không sửa phần mềm đang chạy** → chỉ copy thêm 1 file: `backend/utils/xoa_cay_vai.js`. Không cần restart.

```
cd C:\...\QLNoiBo\backend
node utils/xoa_cay_vai.js --mavai=V001,V002                        (CHỈ XEM: mỗi mã bao nhiêu cây, tồn, vướng gì)
node utils/xoa_cay_vai.js --mavai=V001 --ghi                       (xóa cây SẠCH; cây đang vướng thì giữ lại)
node utils/xoa_cay_vai.js --mavai=V001 --ghi --ke-ca-giao-dich     (xóa CẢ dòng giao dịch rồi xóa cây — RẤT NẶNG)
```
Tùy chọn: `--tatca` (mọi mã vải), `--chua-xuat`, `--xoa-ma` (xóa luôn mã vải nếu không còn cây), `--khong-hoi`, `--khong-backup`.

**Có 5 bảng tham chiếu tới cây vải** — cây đang bị bảng nào dùng thì không xóa thẳng được:

| Bảng | Nghĩa |
|---|---|
| `PhieuXuatVaiChiTiet` | đã xuất kho |
| `TienDoCatChiTietCay` | **đã đưa vào sổ cắt** — chỗ hay quên nhất |
| `KiemKeVai` | đã kiểm kê |
| `GiaoVaiSanXuat` | giao vải SX (dữ liệu cũ) |
| `PhieuXuatVatTuVai` | xuất vật tư (v5.28 — CSDL chưa chạy migration đó thì tự bỏ qua) |

Chức năng **Xóa phiếu nhập vải** sẵn có trong phần mềm chỉ kiểm 3 bảng đầu tiên **thiếu `TienDoCatChiTietCay`** — cây đã vào sổ cắt mà xóa phiếu nhập sẽ báo lỗi khóa ngoại khó hiểu. Công cụ này kiểm đủ cả 5.

**An toàn:** mặc định chỉ xem; phải `--ghi` + gõ đúng chữ `XOA`; riêng `--ke-ca-giao-dich` phải xác nhận **lần thứ hai** (gõ `DONG Y`) vì nó xóa cả dòng sổ cắt / phiếu xuất cũ ⇒ số liệu lịch sử và bảng lương liên quan đổi theo. Dữ liệu bị xóa ghi ra `backend\backup\cayvai_<thời điểm>.json`. Phiếu nhập không còn cây nào sẽ bị xóa theo. **Vẫn nên backup database bằng SSMS trước khi chạy.**

---

## BƯỚC 3.16 — Phiếu nhập phụ kiện: 1 phiếu được NHIỀU loại, bỏ bắt buộc chọn loại (v6.10)

**Không migration**, **có sửa backend** → copy `backend/routes/phukien.js`, `frontend/js/module.phukien.js`, `frontend/index.html` (`?v=6.10`) → `pm2 restart qlnoibo` → Ctrl+F5.

**Đảo ngược quy tắc của v5.95** ("mỗi phiếu nhập chỉ 1 loại phụ kiện"):

- Ô **"Loại phụ kiện của phiếu"** ở đầu phiếu nhập **không còn bắt buộc**, đổi tên thành **"Lọc theo loại phụ kiện (không bắt buộc)"** — nay chỉ để **thu gọn danh sách mã** cho dễ tìm. Để trống là tìm trong tất cả các loại; đổi qua lại thoải mái giữa các loại trong cùng một phiếu.
- Bỏ chặn ở **cả hai nơi**: form (hàm `canhBaoLanLoaiPK` đã xóa) **và backend** (`kiemTraCungLoaiPK` đã xóa, gỡ khỏi cả `POST /phieu` lẫn `PUT /phieunhap/:id`). Chỉ gỡ ở form thì bấm Lưu vẫn bị máy chủ từ chối kèm thông báo "Mỗi phiếu nhập chỉ được 1 loại phụ kiện" mà không hiểu vì sao.
- Phiếu **XUẤT** trước giờ vẫn cho nhiều loại ⇒ nay hai loại phiếu hành xử giống nhau.
- Dữ liệu cũ không ảnh hưởng gì: các phiếu 1 loại đã lưu vẫn nguyên vẹn, chỉ là từ nay không bị ép nữa.

---

## BƯỚC 3.15 — Công cụ XÓA TỒN KHO PHỤ KIỆN (v6.09)

**Không migration, không sửa phần mềm đang chạy** → chỉ copy thêm 1 file: `backend/utils/xoa_ton_phu_kien.js`. Không cần restart.

**Vì sao phải có công cụ riêng:** tồn kho phụ kiện KHÔNG phải một cột lưu sẵn — nó là số **tính ra** từ view `vw_TonKhoPhuKien`:
`Tồn = Tổng NHẬP (PhieuPhuKien 'Nhập') − Tổng XUẤT (PhieuPhuKien 'Xuất') − Tổng XUẤT VẬT TƯ (PhieuXuatVatTuPhuKien)`.
Muốn "xóa tồn" thì bắt buộc phải xóa các dòng phiếu sinh ra số đó, không có cách nào khác. Sửa tay trong SSMS dễ sót nguồn thứ 3 (xuất vật tư) nên số vẫn không về 0.

```
cd C:\...\QLNoiBo\backend
node utils/xoa_ton_phu_kien.js                                  (CHỈ XEM: liệt kê mã + tồn + số dòng sẽ xóa)
node utils/xoa_ton_phu_kien.js --ghi --xoa-phieu --con-ton      << CHỈ mã CÒN TỒN, tồn về 0, GIỮ NGUYÊN mã
node utils/xoa_ton_phu_kien.js --ghi --xoa-phieu                (làm với MỌI mã, kể cả mã tồn đã bằng 0)
node utils/xoa_ton_phu_kien.js --ghi --xoa-ma                   (xóa phiếu RỒI xóa luôn các mã trong danh mục)
```
Tùy chọn: `--con-ton` (chỉ mã còn tồn, gồm cả **tồn âm**), `--ma=PK001,PK002` (chỉ vài mã), `--khong-hoi`, `--khong-backup`.

**Vì sao có `--con-ton` riêng:** mã nào tồn đã bằng 0 thì lịch sử nhập/xuất của nó được **giữ nguyên**, chỉ những mã còn tồn mới bị xóa phiếu. Danh sách mã mục tiêu được **chốt ngay từ đầu** rồi mới xóa — nếu để câu lệnh xóa tự lọc "tồn khác 0" thì sau khi xóa bảng thứ nhất, tồn đã đổi và bước xóa thứ hai sẽ bỏ sót dòng.

**An toàn:**

- Mặc định **không sửa gì** — phải có `--ghi` **và** cờ hành động mới chạy thật; sau đó còn phải **gõ đúng chữ `XOA`**.
- Trước khi xóa, mọi dòng sắp xóa được ghi ra `backend\backup\phukien_<thời điểm>.json`.
- `--xoa-ma` **bỏ qua** (không xóa) những mã còn được **Chỉ định NPL** của đơn hàng tham chiếu, và liệt kê ra — xóa sẽ làm hỏng chỉ định cũ.
- Dòng **xuất vật tư** chỉ xóa phần **phụ kiện**; phiếu xuất vật tư và phần vải của nó giữ nguyên.
- **Vẫn nên backup database bằng SSMS trước khi chạy** — thao tác này không hoàn tác được.

> **v6.09.1 — sửa lỗi `Invalid object name 'PhieuXuatVatTuPhuKien'`.** CSDL đang chạy **chưa có** bảng này (chưa chạy `migration_v528.sql` — module "Xuất vật tư"), nên tồn phụ kiện ở đó chỉ tính từ **2 nguồn** (phiếu nhập + phiếu xuất). Script nay **tự dò bảng** (`OBJECT_ID`) trước khi dùng: thiếu bảng nào thì bỏ qua nguồn đó và ghi rõ ra màn hình, thay vì văng lỗi. Lỗi vừa rồi xảy ra ở bước **đếm**, trước mọi lệnh xóa — **dữ liệu chưa bị đụng tới**. Chạy lại lệnh cũ là được.

---

## BƯỚC 3.14 — Công đoạn Cắt: SỬA ĐƯỢC hệ số quy đổi từng cây (v6.08)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.08`) → `pm2 restart qlnoibo` → Ctrl+F5.

- Ô **Hệ số** ở mỗi dòng cây vải (công đoạn Cắt) từ ô **chỉ đọc** thành ô **nhập được**. Mặc định vẫn điền sẵn hệ số của lệnh SX; sửa dòng nào chỉ ảnh hưởng **SL cái của dòng đó**. Bỏ trống hoặc nhập ≤ 0 thì máy chủ tự dùng lại hệ số của lệnh (không bao giờ để hệ số 0 làm SL cái = 0).
- Có ở cả 3 nơi: form Cắt 1 sơ đồ, form Cắt nhiều sơ đồ (giữ hệ số riêng khi chuyển qua lại giữa các sơ đồ), và **Sửa / thêm cây vào sổ cắt** đã ghi.
- Không phải đổi CSDL: bảng `TienDoCatChiTietCay` vốn đã có cột `HeSoQuyDoi` **riêng cho từng cây** (cột `SoLuongCai` là cột tính sẵn = số lớp × hệ số). Trước đây v5.13 cố ý bỏ ô nhập và ép ghi hệ số của lệnh; nay chỉ thôi ghi đè.
- Bản in **Sổ cắt** vốn đã có cột Hệ số nên tự hiện đúng hệ số của từng cây.

> Lưu ý nghiệp vụ: đổi hệ số là **đổi SL cái** ⇒ kéo theo SL cắt theo màu (Kho nhập đối chiếu, báo cáo năng suất). Lương trải vải cắt **không đổi** vì tính theo mét × lớp × khổ.

---

## BƯỚC 3.13 — Ảnh: nén khi tải lên + ảnh xem trước cho danh sách/catalogue (v6.07)

**Không migration** → copy `backend/routes/upload.js`, **`backend/routes/anh.js` (FILE MỚI)**, `backend/server.js`, **`backend/utils/nen_anh_uploads.js` (FILE MỚI)**, `frontend/js/common.js`, `frontend/js/catalogue.js`, `frontend/js/module.khohang.js`, `frontend/index.html` + `frontend/catalogue.html` (`?v=6.07`) → `pm2 restart qlnoibo` → Ctrl+F5.
Dùng `sharp` — **đã có sẵn** trong `package.json` từ v5.18 (xuất Excel kèm ảnh), không phải cài thêm gì.

### Vì sao trước đây chậm

1. **Tải lên chậm**: ảnh được lưu **Y NGUYÊN** như điện thoại/máy ảnh xuất ra. Một ảnh 24 MB phải đẩy đủ 24 MB qua mạng rồi ghi 24 MB xuống ổ đĩa. Giới hạn cũ lại là 8 MB nên ảnh to còn bị **chặn** kèm thông báo lỗi khó hiểu.
2. **Catalogue / danh sách load ảnh lâu**: mọi ô ảnh — kể cả ô 40×40px trong bảng — đều trỏ vào **đúng file gốc**. Mở catalogue 30 sản phẩm, mỗi sản phẩm vài ảnh gốc vài MB là tải **hàng trăm MB**. Ảnh lại không đặt thời gian nhớ đệm nên mỗi lần mở trang là mỗi lần hỏi lại máy chủ từng ảnh.

### Đã sửa

- **Nén ngay khi tải lên**: xoay đúng chiều theo EXIF → thu nhỏ về cạnh dài tối đa **1600px** (không phóng to ảnh nhỏ) → JPEG q82. Ảnh nền trong suốt giữ PNG. Ảnh 24 MB còn khoảng **200–400 KB** ⇒ tải lên nhanh hơn hàng chục lần. Giới hạn nhận nâng lên **30 MB** kèm thông báo tiếng Việt rõ ràng nếu vượt. sharp không đọc được (định dạng lạ) thì **vẫn lưu nguyên bản** — không để người dùng mất ảnh.
- **Ảnh xem trước theo yêu cầu**: `GET /anh/<cạnh>/<tên file>` (80/160/320/640/800/1200) tạo bằng sharp lần đầu rồi **ghi đệm** vào `uploads/.thumb/<cạnh>/`, lần sau đọc thẳng file đệm. **Ảnh cũ cũng được hưởng ngay**, không phải sửa dữ liệu hay thêm cột nào. Lỗi thì trả ảnh gốc.
- Bảng thẻ kho, lịch sử theo màu, đơn khách và catalogue nay dùng ảnh xem trước + `loading="lazy"` (chỉ tải ảnh khi cuộn tới). **Bấm xem ảnh to vẫn là ảnh gốc**, không giảm chất lượng.
- `/uploads` được đặt nhớ đệm **1 năm** (`immutable`) — tên file có mốc thời gian nên không sợ đệm sai ảnh.

### Nén ảnh CŨ đang nằm trên ổ đĩa (nên làm 1 lần)

```
cd C:\...\QLNoiBo\backend
node utils/nen_anh_uploads.js                 (chỉ xem sẽ nén những gì, không sửa)
node utils/nen_anh_uploads.js --ghi           (nén thật — ảnh gốc chuyển vào uploads\_goc)
```
Giữ nguyên tên file nên **đường dẫn trong CSDL không đổi**. Kiểm tra xong có thể xóa `uploads\_goc` để lấy lại ổ đĩa; xóa cả `uploads\.thumb` để hệ thống tạo lại ảnh xem trước theo ảnh mới.

> **v6.07.1 — sửa lỗi `UNKNOWN: unknown error, open '...jpg'` khi nén ảnh cũ.** Bản đầu in ra "NEN ... 133 KB -> 32 KB" rồi báo lỗi ngay dòng sau, tức là nén xong mới lỗi — lỗi ở bước **GHI**. Nguyên nhân: đưa **đường dẫn** cho sharp thì libvips **giữ file đang mở** (và nhớ đệm nó); Windows không cho ghi/copy đè lên file đang bị giữ nên báo `UNKNOWN`. Đã sửa: `sharp.cache(false)` + **đọc file vào bộ nhớ trước** rồi mới đưa buffer cho sharp, và ghi ra `.tmp` rồi đổi tên đè lên (lỗi giữa đường thì ảnh cũ vẫn nguyên). Áp dụng cùng cách cho `routes/anh.js` và `routes/upload.js`. Chạy lại lệnh nén là được — file nào lần trước báo lỗi thì vẫn còn nguyên bản, không bị hỏng.

---

## BƯỚC 3.12 — Định mức & Hao hụt: mã rập hiện đủ + ĐVT lấy đúng theo lệnh SX (v6.06)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.06`) → `pm2 restart qlnoibo` → Ctrl+F5.

- **Mã rập không hiện**: mã rập có **2 nguồn** — bảng Sơ đồ (`DonHangChiTietSoDo.MaRap`, cách khai từ v5.13) và cột cũ `TienDoSanXuat.MaRap` (các lần Ghi tiến độ Kỹ thuật **trước** v5.13 ghi thẳng vào đây). Bản v6.05 chỉ đọc nguồn thứ nhất nên lệnh cũ hiện trống. Nay gộp **cả 2 nguồn** (`getMaRapCuaDon`), bỏ trùng, nối bằng dấu phẩy — cùng cách bản in sổ cắt lấy bù mã rập ở v5.89.
- **Đơn vị tính**: nay lấy **đúng ĐVT đã khai ở Ra lệnh sản xuất** (ĐVT của dòng Cấu trúc vải đầu tiên có khai — đúng nguồn mà bản in Lệnh SX đang dùng); thiếu thì lùi về "Đơn vị chính" của dòng Đơn vị quy đổi đã chọn, cuối cùng mới mặc định "Cái". Áp dụng cho cả cột Tổng SL / SL nhập kho ở danh sách, màn nhập liệu, bản in báo cáo định mức **và Phiếu báo cáo đơn hàng sản xuất** (chỗ này cũng đang mặc định "Cái", sửa luôn cho khỏi lệch).

---

## BƯỚC 3.11 — Định mức & Hao hụt: mã rập, ĐVT, ảnh, in ngay ở danh sách (v6.05)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.05`) → `pm2 restart qlnoibo` → Ctrl+F5.

Màn **Quản lý sản xuất → Định mức & Hao hụt**:

- Bấm vào **Mã ĐH** ở danh sách → mở luôn phiếu **In lệnh sản xuất** (giống Chỉ định vải SX).
- Cột **Mã hàng** đổi thành **Mã rập** — lấy từ bảng Sơ đồ do công đoạn **Kỹ thuật** cập nhật (gộp nhiều sơ đồ, cách nhau dấu phẩy). Chưa khai thì để trống.
- **Tổng SL** hiện kèm đơn vị tính + quy đổi; **SL nhập kho** kèm đơn vị.
- Nút **🖨️ In báo cáo** ngay ở cột Thao tác — in không cần mở màn nhập liệu.
- **Màn nhập liệu định mức** hiện thêm **ảnh sản phẩm** (bấm xem to) và **mã rập**, kèm Tổng SL có ĐVT và SL nhập kho — khai định mức không phải mở lệnh SX ra đối chiếu.
- **Bản in báo cáo định mức** thêm **mã rập, size và ảnh sản phẩm**, Tổng SL kèm ĐVT — cùng khuôn đầu phiếu (bảng nhãn–giá trị + ô ảnh bên phải) với bản in Sổ cắt và Phiếu báo cáo đơn hàng.

---

## BƯỚC 3.10 — Định mức & Hao hụt chuyển sang Quản lý SX + phiếu báo cáo bổ sung ĐVT/ảnh in thêu (v6.04)

**CÓ MIGRATION** → chạy `database/migration_v664.sql`, rồi copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khovai.js`, `frontend/index.html` (`?v=6.04`) → `pm2 restart qlnoibo` → Ctrl+F5.

> ⚠️ Sau khi chạy migration phải vào **Phân quyền → Ma trận phân quyền**, cấp chức năng **Quản lý sản xuất → Định mức & Hao hụt** cho nhóm/người dùng cần dùng, nếu không tab mới sẽ không hiện (kể cả khi trước đây họ đã có quyền ở Kho vải).

### 1. Phiếu báo cáo đơn hàng sản xuất (in phiếu)

- **Tổng SL** hiện kèm **đơn vị tính** và quy đổi nếu lệnh có khai đơn vị quy đổi (vd `600 Cái (÷6 = 100 Ri)`) — dùng chung công thức với dòng "Tổng cộng" của Cấu trúc vải nên 2 chỗ không thể hiện khác nhau.
- **Số lượng sơ đồ**: đếm sơ đồ của đúng lệnh đó. Lệnh cũ (trước v5.13) không có bảng Sơ đồ mà đã có sổ cắt thì lấy **số sổ cắt** làm số sơ đồ, không còn ghi "Chưa khai báo sơ đồ" trong khi thực tế đã cắt.
- **Ảnh in thêu** in ngay **dưới ảnh sản phẩm** (nhiều ảnh thì xếp dọc), mỗi khối có nhãn riêng.

### 2. "Định mức & Hao hụt" — chuyển sang phân hệ **Quản lý sản xuất**

Tab cũ ở **Kho vải đã bỏ hẳn** (chỉ còn 1 nơi làm, tránh 2 chỗ ra 2 con số). Bản mới khác 4 điểm:

1. **Chọn lệnh SX từ danh sách** — bảng liệt kê mọi lệnh kèm Tổng SL, **SL nhập kho**, đã khai mấy loại vải. Bỏ hẳn việc gõ "Tên mẫu hàng" phải khớp CHỮ với Tên sản phẩm: lệch một dấu cách là báo cáo trống trơn — đây là gốc của mọi sai sót của bản cũ.
2. **Định mức khai theo LOẠI VẢI** (không theo từng mã vải/mã cây), mỗi lệnh khai nhiều dòng, mỗi loại vải 1 dòng (khai trùng loại vải sẽ bị chặn).
3. **Chọn ĐVT cho định mức: Kg hoặc Mét.** Cột "Đã cấp" tự lấy đúng theo ĐVT của dòng đó (tổng KG hoặc tổng mét đã xuất kho cho lệnh, gom theo loại vải).
4. **SL hoàn thành = SL NHẬP KHO** thực tế (tiến độ công đoạn Kho nhập), thay cho `Tổng SL × % hoàn thành` của bản cũ. Lý thuyết = Định mức/SP × SL nhập kho; Hao hụt = Đã cấp − Lý thuyết; vượt `%` cho phép thì gắn nhãn đỏ **Vượt định mức**.

Loại vải **đã xuất kho nhưng chưa khai định mức** vẫn hiện một dòng riêng ghi "Chưa khai định mức" — để không tưởng là đã tính hết. Có nút **🖨️ In báo cáo** (đầu phiếu đủ mã ĐH, tên SP, Tổng SL, SL nhập kho).

`migration_v664.sql` thêm 3 cột vào `DinhMucVai` (`DonHangID`, `LoaiVaiID`, `DonViTinh`), **giữ nguyên dữ liệu cũ** và tự: gán ĐVT = Kg, suy `LoaiVaiID` từ mã vải cũ, và gán `DonHangID` cho dòng nào có tên mẫu hàng khớp **duy nhất 1** lệnh SX. Dòng khớp nhiều lệnh để trống (không đoán bừa) — mở lệnh tương ứng khai lại là xong.

---

## BƯỚC 3.09 — Phiếu báo cáo đơn hàng: đầu phiếu kẻ bảng + số lượng sơ đồ (v6.03)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.03`) → `pm2 restart qlnoibo` → Ctrl+F5.

Bản in **PHIẾU BÁO CÁO ĐƠN HÀNG SẢN XUẤT** (Quản lý SX → In phiếu):

- Tiêu đề **căn giữa** trang; **Mã ĐH** nằm riêng 1 dòng **căn phải** ngay dưới tiêu đề.
- Phần thông tin còn lại **kẻ bảng** nhãn–giá trị (Sản phẩm, Mã hàng, Khách hàng, Size, Mã rập, Số lượng sơ đồ, Ngày đặt, Ngày giao dự kiến, Tổng SL, Trạng thái, % hoàn thành) — trước là 3 dòng chữ dài ngăn nhau bằng dấu cách, in ra khó đọc. Ô nào không có dữ liệu thì bỏ hẳn dòng đó. **Ảnh sản phẩm** chuyển vào ô riêng bên phải bảng (bỏ `float:right` vì float làm lệch bảng khi in).
- Thêm dòng **Số lượng sơ đồ**: số sơ đồ đã khai + **đã có sổ cắt bao nhiêu** (vd `3 sơ đồ — đã có sổ cắt: 2/3`), chưa khai sơ đồ thì ghi rõ. Cùng nguồn số liệu với nhãn "✂️ Còn cắt" ở danh sách lệnh SX, nên đọc phiếu là biết ngay còn sơ đồ nào chưa cắt.

---

## BƯỚC 3.08 — Ra lệnh sản xuất: NHIỀU ảnh hình in thêu (v6.02)

**CÓ MIGRATION** → chạy `database/migration_v663.sql`, rồi copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=6.02`) → `pm2 restart qlnoibo` → Ctrl+F5.

- Ở **Ra lệnh sản xuất** và **Sửa lệnh sản xuất**, ô "Ảnh hình in thêu" nay **chọn được nhiều ảnh cùng lúc** (giữ Ctrl để chọn nhiều, hoặc bấm thêm lần nữa để thêm tiếp). Ảnh hiện thành dãy ô vuông, mỗi ảnh có nút **×** để xóa; bấm vào ảnh để xem to. Thêm/xóa chỉ đổi danh sách trên form — **chỉ ghi thật khi bấm Lưu**.
- **In lệnh sản xuất** in HẾT các ảnh hình in (trước chỉ in 1 ảnh); từ 2 ảnh trở lên thì ảnh tự thu nhỏ để nằm gọn trên cùng một hàng, tiêu đề ghi rõ số ảnh.
- Cách lưu: vẫn **đúng 1 cột** `DonHangSanXuat.AnhHinhIn`, nhiều đường dẫn nối bằng dấu xuống dòng — cùng quy ước với cột Phụ kiện (v5.42). Không tạo bảng con nên không chỗ nào phải sửa thành JOIN. **Dữ liệu cũ (1 ảnh) đọc ra vẫn đúng 1 ảnh, không cần chuyển đổi.**
- `migration_v663.sql` chỉ **nới rộng** cột từ `NVARCHAR(500)` lên `NVARCHAR(MAX)`. 500 ký tự chỉ chứa nổi khoảng 10 đường dẫn — không nới thì thêm nhiều ảnh sẽ bị cắt và **mất ảnh mà không báo gì**. Nới rộng cột là thao tác an toàn: không mất dữ liệu cũ.

---

## BƯỚC 3.07 — Sổ cắt có cột GIẬT CẤP + Giao in thêu có HẠNG MỤC IN THÊU (v6.01)

**CÓ MIGRATION** → chạy `database/migration_v662.sql` trong SSMS, rồi copy `backend/routes/qlsx.js`, `backend/routes/payroll.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.payroll.js`, `frontend/index.html` (`?v=6.01`) → `pm2 restart qlnoibo` → Ctrl+F5.

`migration_v662.sql` thêm 2 cột: `TienDoCatChiTietCay.SoCaiGiatCap` và `DonHangNhaInTheu.HangMucInThe`. Chạy nhiều lần không lỗi. Chưa chạy migration thì 2 chức năng mới im lặng không hiện (code có kiểm tra cột), phần còn lại vẫn chạy bình thường.

### 1. Công đoạn Cắt: cột **Giật cấp (cái)**

- Trong khu vực nhập cây vải có ô tích **"Có cắt giật cấp (ghi số CÁI — không tính vào số lớp)"**. Không tích thì cột không hiện ra (đa số bàn cắt không giật cấp). Tích vào mới hiện cột để gõ.
- **Giật cấp ghi bằng CÁI, không nhân hệ số quy đổi**, và **KHÔNG cộng vào số lớp**. Nó chỉ cộng vào **tổng SL cái của bàn cắt đó**: `SL cái = số lớp × hệ số + giật cấp`.
- Bỏ tích ô "Có cắt giật cấp" thì **số đã gõ bị xóa** (cố ý — để không lưu con số đang bị ẩn).
- Có ở cả 3 nơi: form Cắt 1 sơ đồ, form Cắt nhiều sơ đồ (mỗi sơ đồ giữ riêng số giật cấp khi chuyển qua lại), và **Sửa / thêm cây vào sổ cắt** đã ghi.
- **Bản in sổ cắt**: cột "Giật cấp (cái)" chỉ xuất hiện khi sổ đó **thực sự có** giật cấp; sổ không giật cấp in y như trước. Dòng Tổng cộng có tổng giật cấp và tổng SL cái đã gồm giật cấp.

**Ảnh hưởng có Ý ĐỊNH:** SL cắt theo màu (`TienDoChiTietMau` — Kho nhập đối chiếu, báo cáo năng suất) **tăng thêm** phần giật cấp.
**KHÔNG ảnh hưởng** (vì 2 chỗ này tính theo SỐ LỚP, mà giật cấp không phải lớp): Bảng kê BTP "Điền màu từ Cắt" và **Lương trải vải cắt** (mét sơ đồ × lớp × khổ × đơn giá).

> Sửa kèm 1 lỗi cũ từ v5.87: ở đơn **nhiều sơ đồ**, ảnh cây vải chụp xong bị **mất** khi Gửi (bộ nhớ tạm của sơ đồ không giữ đường dẫn ảnh). Đơn 1 sơ đồ không bị.

### 1b. v6.01.1 — "Tổng SL cái" ở form Cắt và nhãn "Sơ đồ" trên bản in

Chỉ sửa frontend → copy `frontend/js/module.qlsx.js` + `frontend/index.html` (`?v=6.01.1`) → Ctrl+F5 (không cần restart pm2).

- **Dòng "Tổng SL cái (tất cả sơ đồ)" luôn hiện 0** dù đơn đã cắt: gốc là ô này chỉ cộng những dòng **đang gõ** trong form, không cộng phần **đã ghi** ở các sổ cắt trước. Nay `Tổng = ĐÃ GHI + ĐANG NHẬP`, và dòng đó tách rõ 3 số: `Tổng SL cái … · Đang nhập: X cái · Đã ghi: Y cái · N/M sơ đồ · K sổ cắt`. Đơn chưa có sổ nào thì ghi "Đã ghi: chưa có sổ cắt nào" (trước để trống nên trông như bị lỗi). Có ở cả form 1 sơ đồ và form nhiều sơ đồ.
- **Bản in sổ cắt**: dòng dưới tiêu đề đổi **"Sổ số: 1"** → **"Sơ đồ: 1"** (lấy đúng số thứ tự sơ đồ của đơn, dạng `1/2`; sổ cũ không gắn sơ đồ thì dùng số hiệu sổ). Bảng thông tin bỏ dòng "STT sơ đồ" vì đã trùng. "STT sổ cắt" (số tự gõ) giữ nguyên.

### 2. Giao in thêu: cột **Hạng mục in thêu**

- Ở công đoạn **Giao in thêu (GIT)**, mỗi dòng nhà in thêu chọn thêm **Hạng mục in thêu** — danh sách lấy từ **Tài liệu kỹ thuật → Đơn giá in thêu** của đúng đơn đó (kèm đơn giá hiện trong ô chọn). Đơn chưa khai Đơn giá in thêu thì có dòng nhắc khai trước.
- Dòng **đã giao rồi** vẫn sửa được hạng mục ngay tại bảng (chọn là lưu luôn) — cần thiết vì các dòng giao từ trước v6.01 chưa có hạng mục. Công đoạn **Nhận in thêu (NIT)** hiện hạng mục để đối chiếu.
- Lưu **tên hạng mục** (không lưu khóa ngoại) vì màn Đơn giá in thêu khi Lưu là xóa hết dòng rồi chèn lại — khóa ngoại sẽ mồ côi.

### 3. Bảng lương gia công in thêu: cột Hạng mục in thêu + **đơn giá theo hạng mục**

- Bảng in thêu (và bản in chi tiết từng nhà) có thêm cột **Hạng mục in thêu**.
- Cách tính tiền: dòng **đã chọn** hạng mục → `SL nhận × đơn giá CỦA hạng mục đó`. Dòng **để trống** (dữ liệu cũ) → giữ nguyên cách cũ `SL nhận × TỔNG đơn giá in thêu của đơn`, cột hạng mục hiện "(tổng tất cả hạng mục)".
- Hạng mục đã chọn nhưng **không còn** trong Đơn giá in thêu (bị xóa/đổi tên) → đơn giá **0** kèm dấu **⚠️ thiếu đơn giá**. Cố ý không tự lấy tổng đơn giá thay thế: làm vậy ra một con số sai mà không ai biết.

> Kiểm tra nhanh: chọn hạng mục cho 1 dòng giao in thêu đã có SL nhận → mở Tính lương → Lương gia công/in thêu, đúng tháng tạo dòng giao: đơn giá phải bằng đơn giá của hạng mục đó ở Đơn giá in thêu (không phải tổng).

---

## BƯỚC 3.06 — Bảng kê BTP: "Điền màu từ Cắt" lấy TẤT CẢ sổ cắt, chỉ tính VẢI CHÍNH (v6.00)

**Không migration**, **có sửa backend** → copy `backend/routes/bangke.js`, `frontend/js/module.bangkebtp.js`, `frontend/index.html` (`?v=6.00`) → `pm2 restart qlnoibo` → Ctrl+F5.

Nút đổi tên thành **↧ Điền màu từ Cắt (tất cả sổ)**. Hai điểm được sửa:

1. **Gộp TẤT CẢ sổ cắt của lệnh** (mọi lần cắt, mọi sơ đồ). Trước đây chỉ lấy **lần cắt gần nhất**, nên đơn cắt nhiều đợt / nhiều sơ đồ chỉ điền được số lớp của đợt cuối — thiếu hẳn các đợt trước. Thông báo sau khi điền ghi rõ đã gộp bao nhiêu sổ cắt.
2. **Chỉ tính vải CHÍNH của chính đơn đó.** Trước đây chỉ cần cây từng được xuất với kiểu 'Chính' ở **bất kỳ phiếu nào** là được tính — một cây làm vải chính cho đơn A rồi cắt phối cho đơn B vẫn bị cộng vào. Nay bắt buộc dòng phiếu xuất kiểu 'Chính' phải thuộc **phiếu xuất của đúng đơn hàng đó**.

> Kiểm tra nhanh sau khi cài: mở một lệnh đã cắt nhiều đợt, bấm "Điền màu từ Cắt (tất cả sổ)" và so tổng số lớp với tổng ở các sổ cắt (khối "Sổ cắt đã ghi nhận" → In tất cả).

---

## BƯỚC 3.05 — Xóa sổ cắt + đơn nhiều sơ đồ chưa cắt đủ vẫn hiện ở tổ Cắt (v5.99)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=5.99`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. Xóa sổ cắt

Khối "Sổ cắt đã ghi nhận" có thêm nút **🗑️ Xóa sổ này** (xóa đúng sổ đang chọn trong ô chọn). Hộp xác nhận ghi rõ: sổ đó có bao nhiêu cây, bao nhiêu SL cái, và **hệ quả** — tổng SL cắt của đơn giảm đúng phần này nên đối chiếu *Kho nhập*, *lương trải vải cắt* và báo cáo năng suất sẽ đổi theo. **Không kéo lùi công đoạn hiện tại** của đơn (công đoạn sau vẫn đang làm phần đã cắt). Nút chỉ hiện với người có quyền **Xóa** ở chức năng Ghi nhận tiến độ.

### 2. Đơn từ 2 sơ đồ trở lên, chưa cắt đủ thì tổ Cắt vẫn thấy

**Nguyên nhân cũ:** người dùng được phân công đoạn chỉ thấy đơn có *công đoạn hiện tại* đúng bằng công đoạn của mình. Ghi sổ cắt sơ đồ 1 xong là con trỏ đi tiếp (sang giao in thêu, hoặc giao gia công nếu không có in thêu) — đúng như mong muốn để bên đó làm luôn phần đã cắt — nhưng đơn **biến mất** khỏi danh sách của tổ Cắt dù còn sơ đồ 2 chưa cắt.

**Nay:** đơn còn sơ đồ chưa có sổ cắt vẫn **hiện cho người được phân công đoạn Cắt**, đồng thời vẫn chuyển sang công đoạn sau như cũ. Trên *Danh sách lệnh sản xuất*, cột Công đoạn có thêm nhãn vàng **✂️ Còn cắt 1/2 sơ đồ** (đưa chuột vào xem đã ghi mấy sơ đồ). Nhãn này hiện cho mọi người xem danh sách, không chỉ tổ Cắt.

---

## BƯỚC 3.04 — Công đoạn Cắt: CHỌN sổ cắt để xem/in + đếm sơ đồ đã ghi / đang nhập (v5.98)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=5.98`) → `pm2 restart qlnoibo` → Ctrl+F5.

1. **Vào lại công đoạn Cắt là chọn được sổ cắt nào để xem / in.** Khối "Sổ cắt đã ghi nhận" nay:
   - Lấy **TẤT CẢ các lần cắt** của đơn. *(Trước đây chỉ lấy lần cắt gần nhất — cắt 3 hôm thì chỉ thấy hôm cuối, đây chính là lý do "vào lại không thấy sổ cũ".)*
   - Có **ô chọn sổ cắt** ghi rõ: `Sổ 2 · STT 5 · sơ đồ 1/2 · 29/07/2026 · 6 cây · 480 cái`. Mặc định mở **sổ mới nhất**.
   - Nút **🖨️ In sổ đang chọn**, **🖨️ In tất cả**, và **✏️ Sửa / thêm cây** áp dụng cho đúng sổ đang chọn.
   - Bản in/xem riêng 1 sổ vẫn ghi **"Sổ số 2/3"** để không lẫn giữa các sổ.
2. **Dòng tổng nói rõ tiến độ ghi sổ:** cạnh *Tổng SL cái (tất cả sơ đồ)* nay có thêm
   **Đang nhập tiếp: 1/2 sơ đồ** (sơ đồ đã gõ ít nhất 1 cây có số lớp > 0, tính cả sơ đồ đang gõ dở rồi chuyển sang sơ đồ khác) và **Đã ghi: 2/3 sơ đồ · 4 sổ cắt** (số liệu thật đã lưu). Form 1 sơ đồ cũng có dòng "Đã ghi".

---

## BƯỚC 3.03 — Cửa sổ lồng nhau: ĐÓNG THÌ QUAY VỀ BẢNG TRƯỚC + bấm phiếu xuất xem chi tiết ngay (v5.97)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/common.js`, `frontend/js/app.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.tailieukythuat.js`, `frontend/index.html` (`?v=5.97`) → `pm2 restart qlnoibo` → Ctrl+F5.

### 1. Toàn hệ thống: đóng bảng con là QUAY VỀ bảng trước

Trước đây mở bảng con là **xóa hẳn** bảng cha, nên đóng bảng con thì mất sạch, phải bấm lại từ đầu (danh sách bản → form → đóng là ra ngoài hết). Nay hệ thống giữ một **ngăn xếp cửa sổ**:

- Mở bảng con → bảng cha được **ẩn tạm**, giữ nguyên chỗ đang cuộn và dữ liệu đang gõ.
- Bấm **✕ / Esc / nút Đóng** ở bảng con → bảng cha **hiện lại y như cũ**. Nút ✕ đổi chú thích thành *"Quay lại bảng trước (Esc)"* khi bên dưới còn bảng cha.
- Chuyển sang phân hệ/màn hình khác → đóng sạch mọi cấp, không để cửa sổ treo lơ lửng.
- Các luồng "lưu xong vẽ lại danh sách" vẫn hoạt động như cũ (hệ thống tự nhận ra đó là *mở thay thế*, không xếp thêm tầng).

### 2. Chỉ định vải SX / Chỉ định NPL: bấm vào phiếu xuất để xem chi tiết ngay

Trong popup **"đã xuất kho"** (bấm vào trạng thái), mỗi dòng phiếu nay **bấm được**:

- *Vải*: mở chi tiết phiếu xuất kho vải — kiểu · mã cây · mã vải · loại vải · màu · khổ · KG xuất · số mét, có dòng **TỔNG CỘNG** và nút **🖨️ In phiếu**. Đầu phiếu có Mã rập + Tên SP.
- *NPL*: mở chi tiết phiếu xuất phụ kiện — ảnh · mã PK · loại · tên · ĐVT · SL chỉ định · SL xuất · ghi chú, có TỔNG CỘNG và nút In.
- Đóng chi tiết là **quay lại danh sách phiếu**, không phải mở lại từ đầu. Không còn phải sang *Quản lý kho vải → Xuất kho* hay *Quản lý phụ kiện → Phiếu Xuất*.

> Phân quyền: chi tiết phiếu xuất **vải** đọc qua route của chính phân hệ QLSX (gate `chidinhvaisx`) nên người chỉ làm QLSX vẫn xem được mà **không cần cấp thêm quyền Kho vải**; và chỉ trả về phiếu **thuộc đúng đơn hàng** đó, không thành cửa xem mọi phiếu trong kho. Chi tiết phiếu **phụ kiện** dùng lại route sẵn có nên vẫn cần quyền xem của phân hệ Quản lý phụ kiện.

---

## BƯỚC 3.02 — Công đoạn Cắt: SỬA / THÊM CÂY vào sổ cắt đã ghi (v5.96)

**Không migration**, **có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=5.96`) → `pm2 restart qlnoibo` → Ctrl+F5.

**Vì sao cần:** bàn cắt làm dở, hôm sau cắt tiếp cùng sổ cắt đó. Trước đây chỉ có 2 cách: ghi tiến độ mới (thành 2 sổ cắt rời) hoặc không sửa được gì.

Trong *Ghi nhận tiến độ → công đoạn Cắt*, khối **"Sổ cắt đã ghi nhận"** nay có nút **✏️ Sửa / thêm cây** (mỗi sổ một nút nếu đơn có nhiều sổ). Bấm vào mở bảng cây vải của đúng sổ đó:

- **Thêm cây vải** cắt tiếp (chỉ chọn trong các cây **đã xuất kho cho đơn** này; cây đã xuất qua nhiều phiếu chỉ hiện 1 lần).
- **Sửa được STT từng cây**, SL lớp, KG/mét đã dùng, ảnh cây vải — tiếp tục đánh số STT tiếp theo cho mạch cắt hôm sau.
- Sửa được **STT sổ cắt** ở đầu bảng. Có dòng tổng SL cái / tổng lớp tính ngay khi gõ.
- Chặn chọn **trùng cây** trong cùng một sổ.

> Quan trọng: khi lưu, hệ thống **tính lại tổng SL cái theo màu** của chính sổ cắt đó — đây là con số mà *Kho nhập* và các báo cáo năng suất đọc. Nhờ vậy sổ cắt và SL cắt luôn khớp nhau. Backend chỉ cho sửa bản ghi thuộc **đúng đơn hàng** và **đúng công đoạn Cắt**.

Nút chỉ hiện với người có quyền **Sửa** ở chức năng Ghi nhận tiến độ.

---

## BƯỚC 3.01 — Phiếu nhập NPL: MỖI PHIẾU CHỈ 1 LOẠI phụ kiện (v5.95)

**Không migration**, **có sửa backend** → copy `backend/routes/phukien.js`, `frontend/js/module.phukien.js`, `frontend/index.html` (`?v=5.95`) → `pm2 restart qlnoibo` → Ctrl+F5.

- Ô **"Loại phụ kiện của phiếu"** chuyển **lên đầu phiếu** (chọn 1 lần, bắt buộc) thay vì là ô lọc lặp ở từng dòng. Chọn loại nào thì **mọi dòng chỉ tìm được phụ kiện của loại đó** — không còn cửa để chọn lẫn loại khác. Trong cùng một loại thì thêm bao nhiêu **mã** cũng được.
- Dòng nhắc dưới ô loại cho biết loại đang chọn có bao nhiêu mã.
- Đổi loại giữa chừng → danh sách của mọi dòng nạp lại theo loại mới (phải chọn lại phụ kiện cho từng dòng).
- **Form Sửa phiếu nhập** cũng vậy: loại của phiếu suy ra từ dòng đầu tiên, đổi được nhưng phải chọn lại các dòng.
- Thêm loại PK mới ngay tại form (ô "Thêm Loại PK mới") thì ô loại đầu phiếu cập nhật ngay, không cần đóng mở lại.
- **Chặn cả ở backend**: gửi lên một phiếu nhập lẫn nhiều loại (kể cả từ form cũ còn trong cache hay gọi API trực tiếp) đều bị từ chối kèm thông báo liệt kê rõ các loại đang lẫn. Áp dụng cho cả tạo mới lẫn sửa phiếu.

> Quy tắc này **chỉ áp dụng cho phiếu NHẬP**. Phiếu **xuất** NPL vẫn xuất được nhiều loại trong một phiếu như cũ (một lần xuất cho chuyền thường gồm mác + dây + nhãn…).

---

## BƯỚC 3.00 — Phiếu xuất vải có Mã rập + phiếu nhập NPL có tổng số lượng (v5.94)

**Không migration**, **có sửa backend** → copy `backend/routes/khovai.js`, `frontend/js/module.khovai.js`, `frontend/js/module.phukien.js`, `frontend/index.html` (`?v=5.94`) → `pm2 restart qlnoibo` → Ctrl+F5.

1. **Phiếu xuất kho VẢI có Mã rập** (bản in + cửa sổ xem), gộp từ các sơ đồ của đơn hàng gắn kèm — giống cách Mã rập hiển thị ở các phiếu khác. Bản in còn kèm Tên sản phẩm cạnh Đơn hàng.
2. **Phiếu xuất PHỤ KIỆN đã có Mã rập từ v5.84** (bản in + cửa sổ xem + cột trong danh sách phiếu). Nếu chưa thấy thì kiểm tra đã copy `module.phukien.js` bản v5.84 trở lên và đã `pm2 restart` chưa.
3. **Phiếu nhập NPL có dòng TỔNG CỘNG số lượng** ở cửa sổ xem và bản in; bản in kèm thêm **Thành tiền** (tổng SL × đơn giá) nếu phiếu có khai đơn giá.

> Lưu ý nghiệp vụ: một phiếu NPL có thể gồm nhiều đơn vị tính khác nhau (cái / mét / kg), nên con số **tổng số lượng chỉ để đối chiếu nhanh**, không phải số liệu kế toán. Muốn cộng riêng theo từng ĐVT thì nói, tôi tách dòng tổng theo đơn vị.

---

## BƯỚC 2.99 — Phiếu nhập / xuất vải: dòng TỔNG CỘNG kg + mét (v5.93)

**Không migration, không sửa backend** → copy `frontend/js/module.khovai.js` + `frontend/index.html` (`?v=5.93`) → Ctrl+F5.

Thêm dòng **TỔNG CỘNG** (số kg và số mét) ở cuối bảng cây vải, áp dụng cho **cả 4 chỗ**: cửa sổ *Xem* phiếu nhập, *bản in* phiếu nhập, cửa sổ *Xem* phiếu xuất, *bản in* phiếu xuất. Cả 4 dùng chung một hàm cộng nên số liệu không bao giờ lệch nhau. Số mét để trống nếu cả phiếu không khai mét nào.

---

## BƯỚC 2.98 — Lệnh SX: nút XÓA ảnh hình in + ô chọn NV thiết kế/rập chỉ hiện bộ phận Kỹ thuật (v5.92.1)

**Không migration, không sửa backend** → chỉ copy `frontend/js/module.qlsx.js` + `frontend/index.html` (`?v=5.92.1`) → Ctrl+F5.

1. **Ảnh hình in có nút xóa ở CẢ 2 form:**
   - *Ra lệnh sản xuất (tạo mới)*: chọn file xong hiện **ảnh xem trước** + nút **🗑️ Xóa ảnh** để bỏ file vừa chọn.
   - *Sửa lệnh sản xuất*: cạnh ảnh đang có là nút **🗑️ Xóa ảnh**. Bấm chỉ **đánh dấu** xóa (hiện dòng chữ đỏ nhắc), ảnh thật sự mất **sau khi bấm Lưu** — bấm nhầm thì đóng form là xong, dữ liệu chưa đụng tới.
   - Quy tắc khi Lưu: chọn file mới → thay ảnh; chỉ bấm Xóa → bỏ ảnh; không làm gì → giữ nguyên. Vừa chọn file mới vừa bấm Xóa thì **ưu tiên file mới**.
2. **Ô chọn "Nhân viên thiết kế" và "Kỹ thuật rập" chỉ liệt kê nhân viên bộ phận Kỹ thuật** (trước đổ toàn bộ nhân viên công ty). Nhận diện theo tên bộ phận, bỏ dấu và không phân biệt hoa thường nên "Kỹ thuật", "Ky thuat", "Phòng Kỹ Thuật"… đều đúng. **Nếu chưa khai bộ phận nào tên kỹ thuật thì vẫn hiện toàn bộ như cũ** để không ai bị kẹt không nhập được lệnh. Ô tên vẫn **gõ tay tự do** được như trước.

---

## BƯỚC 2.97 — LƯƠNG TRẢI VẢI CẮT + rà soát bảng lương click ra chi tiết & in (v5.91)

**CÓ migration: `migration_v661.sql`** → chạy migration trước, rồi copy file, rồi `pm2 restart qlnoibo`, rồi Ctrl+F5.

Copy: `database/migration_v661.sql`, `backend/routes/payroll.js`, `frontend/js/module.payroll.js`, `frontend/index.html` (`?v=5.91`).

`migration_v661.sql` làm 3 việc: tạo bảng `CauHinhLuongCat` (hệ số lương từng nhân viên cắt), seed đơn giá `1100` vào bảng cấu hình, và seed chức năng phân quyền `PAYROLL/luongtraivaicat`. **Sau khi chạy, vào Phân quyền tích "Xem/Sửa – Lương trải vải cắt"** cho nhóm cần dùng (Admin thấy ngay).

### Tab mới: Tính lương → **Lương trải vải cắt**

Cách tính (đúng thứ tự anh mô tả):

1. **Tiền 1 sơ đồ** = mét sơ đồ × tổng số lớp của sơ đồ đó × khổ vải × **đơn giá (mặc định 1100đ)**. Lấy từ **tất cả sổ cắt** đã ghi trong tháng.
2. **Tiền 1 lệnh SX** = cộng các sơ đồ của lệnh đó. **Quỹ lương cắt tháng** = cộng tất cả lệnh.
3. **Giờ công** lấy từ Chấm công (cột *Số giờ làm*) của nhân viên **bộ phận "Cắt"** trong tháng.
4. **Lương 1 giờ** = quỹ ÷ tổng giờ công toàn bộ phận Cắt.
5. **Lương từng người** = giờ công × **hệ số lương** × lương 1 giờ.

> ⚠️ Theo phương án anh chọn (đúng nguyên văn mô tả), đơn giá giờ chia cho **tổng giờ chưa nhân hệ số**. Vì vậy nếu có ai hệ số ≠ 1 thì **tổng lương trả ra sẽ lệch so với quỹ**. Bảng luôn hiện dòng **"Chênh lệch so với quỹ"** — dương là trả vượt quỹ, âm là trả thiếu. Muốn tổng luôn khớp quỹ thì đổi sang chia theo giờ-đã-nhân-hệ-số (nói tôi một câu là đổi).

Trên tab có:

- **⚙️ Cấu hình đơn giá / hệ số** — sửa đơn giá (thay 1100) và hệ số từng nhân viên cắt ngay trong phần mềm, không cần sửa code.
- **Bảng lương nhân viên** — bấm 1 người ra **phiếu lương cá nhân** (giờ công, hệ số, quỹ, lương 1 giờ, lương tháng, kèm cơ sở tính quỹ) + nút **In**.
- **Bàn cắt theo lệnh sản xuất** — bấm 1 lệnh ra chi tiết **từng sơ đồ** (ngày cắt, STT sổ cắt, mã rập, mét sơ đồ, khổ, tổng lớp, người trải vải, người cắt, thành tiền) + nút **In**.
- **🖨️ In quỹ + bàn cắt** (chi tiết từng lệnh SX có bao nhiêu sơ đồ, thành tiền từng sơ đồ, tổng bàn cắt) và **🖨️ In bảng lương** (cả tháng + cơ sở tính quỹ).

### Rà soát các bảng lương khác (click nhân viên → chi tiết + in)

| Tab | Trước v5.91 | Sau v5.91 |
|---|---|---|
| Lương khoán may | Đã có click + in | giữ nguyên |
| Lương GC / In thêu | Đã có (theo nhà gia công) | giữ nguyên |
| **Lương công nhật** | **Không in được, không xem chi tiết được** | **thêm nút In bảng lương + bấm 1 dòng ra phiếu lương cá nhân có nút In** |
| **Lương là / đóng gói** | Chỉ in được cả bảng | **bấm 1 nhân viên ra phiếu lương riêng + nút In** |
| Lương trải vải cắt | — | có đủ (mới) |

Ở Lương công nhật, bấm vào ô **Tạm ứng** vẫn sửa được như cũ (không bị mở popup đè lên).

---

## BƯỚC 2.96 — Sổ cắt: đầu phiếu dạng BẢNG + ảnh đơn hàng + STT sơ đồ 1/2 + tổng số lớp (v5.90)

**Không migration.** **Có sửa backend** → copy `backend/routes/qlsx.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=5.90`) → `pm2 restart qlnoibo` → Ctrl+F5.

- **Đầu phiếu là BẢNG nhãn–giá trị** (2 cột, kẻ khung) thay cho một dòng dài ngăn bằng dấu chấm: Mã lệnh SX · Mã hàng · Tên sản phẩm · Khách hàng · Size · Tổng SL chỉ định · Ngày giao dự kiến · Ngày cắt · STT sơ đồ · Mét sơ đồ · Khổ vải · Mã rập · Người trải vải · Người cắt. Trường nào trống thì **bỏ hẳn dòng đó**, không để ô rỗng.
- **"Tổng SL" đổi thành "Tổng SL chỉ định"** cho khỏi nhầm với số cắt được.
- **Ảnh đơn hàng** (ảnh sản phẩm của lệnh SX) in ở góc phải đầu phiếu.
- **STT sơ đồ dạng `1/2`** — chỉ hiện khi đơn có từ 2 sơ đồ trở lên; thứ tự tính theo đúng thứ tự sơ đồ đã khai của đơn.
- **Dòng Tổng cộng nay cộng cả cột Số lớp** (trước chỉ cộng SL cái và KG/mét).

---

## BƯỚC 2.95 — Sổ cắt in đầy đủ + sửa ô tích trải vải chồng chữ + KG không còn bắt buộc (v5.89)

**Không migration.** **Có sửa backend** → copy file → `pm2 restart qlnoibo` → Ctrl+F5.

Copy: `backend/routes/qlsx.js`, `backend/routes/khovai.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.khovai.js`, `frontend/css/style.css`, `frontend/index.html` (`?v=5.89`).

**1. Bản in Sổ cắt dựng lại:**

- Tiêu đề **SỔ CẮT căn giữa** trang; số sổ / STT sổ cắt nằm **riêng một dòng, canh phải** bên dưới.
- Thêm khối **thông tin đơn hàng**: Mã lệnh SX · Mã hàng · Tên sản phẩm · Khách hàng · Size · Tổng SL · Ngày giao dự kiến.
- **Mét sơ đồ / Khổ vải / Mã rập nay hiện đủ.** Nguyên nhân cũ: 3 giá trị này nằm trên bản ghi tiến độ nhưng chỉ được ghi ở công đoạn Kỹ thuật — ghi tiến độ Cắt không ai điền nên luôn trống. Nay khi đọc sổ cắt, hệ thống **lấy bù từ chính sơ đồ đã chọn**, nên **các sổ cắt CŨ cũng hiện đủ ngay**, không phải nhập lại.
- Thêm **Người trải vải** (gộp đủ 2 người) và **Người cắt**.
- Bảng thêm cột **Loại vải** và **KG/mét đã dùng**, có dòng Tổng cộng cho cả SL cái lẫn KG/mét.

**2. Công đoạn Cắt — ô tích "Nhân viên trải vải" không còn chồng lên tên.** Nguyên nhân: danh sách nằm trong khối `.form-row`, mà quy tắc chung của phần mềm bắt *mọi* ô nhập trong đó rộng 100% — ô tích bị kéo dài bằng cả dòng nên chữ đè lên. Đã trả ô tích về đúng 16px và thêm vùng bấm dễ trên điện thoại.

**3. Phiếu nhập / phiếu xuất vải: KG KHÔNG còn bắt buộc.** Nhập/xuất được theo **KG, theo MÉT, hoặc cả hai**. Đổi lại khi Lưu hệ thống kiểm tra **mỗi dòng phải có ít nhất một trong hai** và báo rõ dòng số mấy.

> Sửa kèm một lỗi ngầm: trước đây khi **Sửa phiếu xuất**, dòng nào KG = 0 bị backend **bỏ qua im lặng** — dòng khai theo mét sẽ biến mất sau khi lưu. Nay chỉ bỏ qua khi cả KG lẫn mét đều trống.

---

## BƯỚC 2.94 — Ảnh phụ kiện hiện ở MỌI phiếu NPL + ảnh trong danh sách gõ-tìm + bỏ "Quy cách đóng gói" (v5.88)

**Không migration mới** (dùng cột `DanhMucPhuKien.AnhDaiDien` của `migration_v660` ở bước 2.93 — chưa chạy thì chạy trước). **Có sửa backend** → `pm2 restart qlnoibo` → Ctrl+F5.

Copy: `backend/routes/phukien.js`, `backend/routes/qlsx.js`, `frontend/js/common.js`, `frontend/js/module.phukien.js`, `frontend/js/module.tailieukythuat.js`, `frontend/css/style.css`, `frontend/index.html` (`?v=5.88`).

1. **Mọi phiếu liên quan NPL đều có cột Ảnh** — Phiếu nhập PK (xem + in), Phiếu xuất PK (xem + in), Chỉ định NPL (bảng "Đã chỉ định" + bản in), bảng "Chỉ định NPL (tham khảo)" trong form tạo phiếu xuất. Ảnh lấy từ **Danh mục phụ kiện** nên chỉ cần khai ảnh 1 lần ở đó là mọi phiếu đều có. Trong bảng trên màn hình bấm vào ảnh để xem to; bản in chèn ảnh trực tiếp.
2. **Gõ tìm NPL → danh sách xổ xuống có ảnh.** Ô "Phụ kiện (gõ để tìm)" ở Chỉ định NPL, Phiếu nhập và Phiếu xuất nay hiện **ảnh nhỏ bên trái mỗi dòng gợi ý** — nhìn ảnh chọn nhanh hơn đọc mã. Ô nào không có ảnh vẫn hiện chữ như cũ.
3. **Tài liệu may/Đóng gói: bỏ mục "Quy cách đóng gói".** Chỉ ẩn lối vào — **dữ liệu cũ vẫn còn nguyên** trong database và các route backend giữ nguyên; muốn dùng lại chỉ cần thêm 1 dòng vào danh sách mục con trong `module.tailieukythuat.js` (đã ghi chú sẵn tại chỗ).

---

## BƯỚC 2.93 — ẢNH cho đơn giá in thêu / phụ kiện / từng cây vải khi Cắt + ĐVT gõ tự do + lọc đơn có in thêu (v5.87)

**CÓ migration: `migration_v660.sql`** (thêm 3 cột ảnh) + **sửa backend** → chạy migration trước, rồi `pm2 restart qlnoibo`, rồi Ctrl+F5.

Copy: `database/migration_v660.sql`, `backend/routes/tailieukythuat.js`, `backend/routes/phukien.js`, `backend/routes/qlsx.js`, `frontend/js/module.tailieukythuat.js`, `frontend/js/module.phukien.js`, `frontend/js/module.qlsx.js`, `frontend/index.html` (`?v=5.87`).

1. **Đơn giá in thêu — ảnh cho từng dòng.** Mỗi hạng mục in/thêu có ô chọn ảnh; trên điện thoại bấm là **mở thẳng camera** (`capture`). Ảnh hiện thu nhỏ ngay trong bảng, bấm vào xem ảnh to, có nút **Xóa ảnh**. Bản in cũng có cột Ảnh.
2. **Chỉ định NPL — ĐVT gõ được ký tự bất kỳ.** Trước là ô chọn cứng đúng 2 đơn vị của phụ kiện đang chọn. Nay là **ô gõ tự do kèm danh sách gợi ý**: gom mọi ĐVT đang dùng trong danh mục phụ kiện + các đơn vị thường gặp (Cái, Bộ, Chiếc, Mét, Kg, Cuộn, Bó, Túi, Thùng, Yard), gõ ký tự bất kỳ để lọc, vẫn nhập được đơn vị hoàn toàn mới. Chọn phụ kiện xong hệ thống **tự điền ĐVT cơ bản** làm mặc định (chỉ điền khi ô còn trống — không đè lên thứ anh đã gõ).
3. **Danh mục phụ kiện — cột Ảnh.** Bảng danh mục có cột ảnh (bấm xem to); form Khai báo/Sửa có ô chọn ảnh (điện thoại chụp thẳng). Ở form Sửa: **không chọn file mới = giữ nguyên ảnh cũ**, muốn bỏ thì tích "Xóa ảnh hiện tại".
4. **Công đoạn Cắt — ảnh từng cây vải.** Mỗi dòng cây vải có ô chụp/tải ảnh; ảnh tải lên ngay khi chọn và hiện ảnh nhỏ để biết dòng nào đã có. Ảnh hiển thị trong **Sổ cắt** (cột Ảnh). Áp dụng cho cả đơn 1 sơ đồ lẫn đơn nhiều sơ đồ.
5. **Tài liệu in thêu & Đơn giá in thêu chỉ hiện đơn CÓ IN THÊU.** Đơn không tích ô "Có in thêu" lúc Ra lệnh SX sẽ không còn nằm trong 2 danh sách đó nữa.

> Ảnh chỉ lưu **đường dẫn** `/uploads/...` như mọi ảnh khác trong phần mềm (không nhồi ảnh vào database). Nếu chưa kịp chạy `migration_v660.sql`, các màn hình vẫn mở và lưu bình thường — chỉ riêng phần ảnh không được ghi (backend tự dò cột).

---

## BƯỚC 2.92 — NHẬP TỒN KHO VẢI TỪ FILE EXCEL (công cụ dòng lệnh) (v5.86)

**Không migration, không sửa backend đang chạy** — chỉ thêm 1 file: `backend/utils/nhap_ton_vai_excel.js`. Không cần `pm2 restart`.

Mở CMD/PowerShell, `cd` vào thư mục `backend` rồi chạy:

```
:: 1) XEM TRƯỚC — đọc file, dò cột, kiểm tra từng dòng. KHÔNG ghi gì vào database.
node utils/nhap_ton_vai_excel.js "D:\the_kho_vai_cay.xlsx"

:: 2) Thấy bảng dò cột + số liệu đúng rồi thì ghi thật:
node utils/nhap_ton_vai_excel.js "D:\the_kho_vai_cay.xlsx" --ghi
```

Tùy chọn thêm:

| Tham số | Ý nghĩa |
|---|---|
| `--ngay 2026-07-01` | ngày nhập của phiếu + của dòng không có cột "Ngày nhập" (mặc định: hôm nay) |
| `--ghichu "Tồn đầu kỳ"` | ghi chú đầu phiếu |
| `--sheet "Sheet1"` | chọn sheet khác (mặc định: sheet đầu tiên) |
| `--dung-kg-nhap` | lấy số lượng từ cột **KG nhập** (mặc định ưu tiên **KG còn** vì đây là nhập TỒN) |
| `--tao-danhmuc` | tự tạo Loại vải / Màu chưa có (mặc định: báo thiếu, không tự tạo) |
| `--bo-macay` | bỏ qua cột Mã cây trong file, để hệ thống tự sinh mã mới |
| `--taomau "D:\mau.xlsx"` | tạo một file Excel mẫu trống đúng chuẩn rồi thoát |

**Cách nhận cột:** công cụ đọc **dòng tiêu đề** và tự khớp tên cột (không phân biệt hoa/thường, có dấu hay không): *Mã cây · Mã vải · Mã loại · Mã PM · Loại vải · Màu · KG nhập · KG còn · Khổ vải · GSM · Số mét · Đơn giá · Vị trí kho · Ngày nhập* — tức là **đúng file Excel do chính phần mềm xuất ra** (`the_kho_vai_cay.xlsx`). Chỉ **bắt buộc** có: một cột số lượng (KG còn hoặc KG nhập) và (Loại vải + Màu) — hoặc cột Mã vải. Chạy xem trước sẽ in bảng "DO COT" cho biết cột nào đã khớp.

Ba quy tắc được cài riêng cho đúng định dạng file này:

- Cột **KG đã xuất** và **Trạng thái** nằm trong danh sách CẤM khớp — không bao giờ bị hiểu nhầm thành số lượng nhập.
- Số lượng lấy theo **từng dòng**: ưu tiên *KG còn*, dòng nào trống thì lấy *KG nhập* (file xuất có cả 2 cột, người dùng thường chỉ điền 1). Cuối bảng có báo bao nhiêu dòng phải dùng cột dự phòng.
- **Mã vải / Mã loại có sẵn trong file được giữ nguyên**: tra cứu theo mã trước (chính xác tuyệt đối), và nếu mã đó chưa có trong danh mục thì tạo mới **đúng mã đó** — nhờ vậy "Mã cây" sẵn trong file (vốn là `<Mã vải><ddmmyy><số>`) vẫn khớp với mã vải của nó khi nhập vào một database mới.

**Nguyên tắc an toàn đã cài sẵn:**

- Không có `--ghi` thì tuyệt đối không đụng vào database.
- **Mã cây đã có trong kho → bỏ qua dòng đó**, không bao giờ ghi đè lên cây đang có tồn/đã xuất. Trùng mã ngay trong file cũng bị chặn.
- Toàn bộ cây vào **cùng một phiếu nhập** → nhập sai chỉ cần vào *Kho vải → Nhập kho*, xóa đúng phiếu đó (số phiếu được in ra ở cuối). Xóa phiếu chỉ được khi các cây đó **chưa bị xuất**.
- Dùng lại **đúng logic của màn hình Nhập kho**: tự tìm/tạo Mã vải từ (Loại vải + Màu), sinh Mã cây theo quy tắc `<MaVai><ddmmyy><số thứ tự>`, sinh QR — dữ liệu nhập từ Excel giống hệt nhập tay.

---

## BƯỚC 2.91 — SỬA phiếu nhập/xuất phụ kiện được CẢ CÁC DÒNG + bấm trạng thái xem các phiếu đã xuất (v5.85)

**KHÔNG có migration**, **có sửa backend** → `pm2 restart qlnoibo`.

Copy: `backend/routes/phukien.js`, `backend/routes/qlsx.js`, `frontend/js/module.phukien.js`, `frontend/js/module.qlsx.js`, `frontend/js/module.tailieukythuat.js`, `frontend/index.html` (`?v=5.85`) → **`pm2 restart qlnoibo`** → Ctrl+F5.

1. **Sửa phiếu Nhập / Xuất phụ kiện nay sửa được danh sách dòng.** Trước đây form Sửa chỉ có đầu phiếu ("muốn đổi dòng thì xóa phiếu và tạo lại") — nay mở ra đúng bảng nhập liệu như form Tạo, **điền sẵn các dòng đã lưu** (phụ kiện, SL, ĐVT, đơn giá, ghi chú), thêm/xóa dòng thoải mái. Backend ghi đè toàn bộ dòng của phiếu (xóa cũ → ghi mới) — an toàn vì tồn kho phụ kiện luôn được **tính lại từ các dòng phiếu**, không có cột tồn lũy kế nào phải chỉnh tay. Phiếu bắt buộc còn **ít nhất 1 dòng** (kiểm tra TRƯỚC khi xóa dòng cũ).
   - Phiếu Xuất còn **đổi được đơn hàng gắn kèm** ngay trong form Sửa (như phiếu xuất kho vải từ v5.64). Lưu ý: đổi đơn thì danh sách phụ kiện nạp lại theo Chỉ định NPL của đơn mới nên **các dòng đang có phải chọn lại phụ kiện** — form có báo dòng chữ nhắc.
   - ĐVT cũ không còn trong danh mục vẫn được giữ (thêm tạm vào ô chọn) để không mất dữ liệu.
2. **Bấm vào trạng thái "Đã xuất kho" / "Xuất một phần" để xem CÁC PHIẾU ĐÃ XUẤT.**
   - *Chỉ định vải SX* → bảng phiếu xuất kho vải của đơn: số phiếu, ngày, người nhận, số cây, tổng KG, tổng mét, người lập.
   - *Chỉ định NPL* → bảng phiếu xuất phụ kiện của đơn: số phiếu, ngày, số dòng PK, tổng SL, người lập. Bấm được cả ở danh sách lẫn trong cửa sổ danh sách bản chỉ định.
   - Hai popup này đọc qua route của **chính phân hệ đang đứng** (`/api/qlsx/chidinhvaisx/:maDH/phieuxuat`) nên người chỉ có quyền QLSX vẫn xem được danh sách phiếu xuất vải mà không cần cấp thêm quyền phân hệ Kho vải. Riêng phiếu xuất phụ kiện vẫn cần quyền **xem** của phân hệ Quản lý phụ kiện (nếu không có sẽ hiện thông báo rõ ràng).

---

## BƯỚC 2.90 — PHIẾU XUẤT PK có Mã rập + bảng Chỉ định NPL tham khảo + trạng thái ĐÃ XUẤT ở Chỉ định NPL (v5.84)

**KHÔNG có migration**, nhưng **có sửa backend** → phải `pm2 restart qlnoibo`.

Copy: `backend/routes/phukien.js`, `backend/routes/tailieukythuat.js`, `frontend/js/module.phukien.js`, `frontend/js/module.tailieukythuat.js`, `frontend/index.html` (`?v=5.84`) → **`pm2 restart qlnoibo`** → Ctrl+F5.

1. **Mã rập trên Phiếu xuất phụ kiện.** Chọn đơn hàng là ô **Mã rập** tự điền (chỉ để xem). Mã rập cũng xuất hiện ở **danh sách phiếu xuất** (cột mới), **cửa sổ xem chi tiết** và **bản in**. Nguồn: gộp `DonHangChiTietSoDo.MaRap` theo đơn — y như các phiếu khác, nên khai sơ đồ xong là tự có.
2. **Bảng "Chỉ định NPL (tham khảo)" ngay trong form tạo phiếu xuất.** Trước đây chọn đơn xong chỉ có một dòng chữ "Chỉ hiện N phụ kiện đã chỉ định" — không thấy số liệu. Nay hiện bảng: **Mã PK · Tên phụ kiện · ĐVT · SL chỉ định · Đã xuất · Còn lại** (còn lại > 0 tô đỏ, hết tô xanh). "Đã xuất" là **lũy kế mọi phiếu xuất** của đơn đó.
3. **Chỉ định NPL có cột trạng thái "Xuất kho PK":** *Chưa xuất* / *Xuất một phần* / *Đã xuất kho*, kèm dòng nhỏ `3/5 phụ kiện · 2 phiếu`. Trạng thái này cũng hiện trong cửa sổ danh sách bản chỉ định.

> Cách tính (cố ý): **KHÔNG cộng tổng số lượng** vì mỗi phụ kiện một đơn vị (cái/mét/kg) — cộng lại vô nghĩa. Hệ thống **đếm theo phụ kiện**: một phụ kiện coi là xong khi tổng đã xuất ≥ tổng chỉ định của chính nó; đủ hết mới là "Đã xuất kho".

---

## BƯỚC 2.89 — PHỤ KIỆN (NPL): form nhập/xuất thành BẢNG THẬT + từ "Chỉ định NPL" xuất kho luôn (v5.83)

**KHÔNG có migration.** Copy `frontend/js/module.phukien.js`, `frontend/js/module.tailieukythuat.js`, `frontend/index.html` (`?v=5.83`) → **Ctrl+F5**.

Làm ĐÚNG như bên kho vải, để 2 phân hệ thao tác giống hệt nhau:

1. **Phiếu Nhập / Phiếu Xuất phụ kiện — bảng thật.** Trước đây mỗi dòng phụ kiện lặp lại đầy đủ nhãn ("Loại PK / Phụ kiện / Số lượng / ĐVT / Đơn giá / Ghi chú"), thêm vài dòng là rối mắt. Nay: **một hàng tiêu đề duy nhất** ở trên, bên dưới chỉ còn ô nhập; bề rộng cột cố định bằng `<colgroup>` nên tiêu đề luôn thẳng cột — **cột Phụ kiện rộng nhất** (tên dài), các cột số hẹp lại. Bảng **cuộn trong chính nó** (không kéo dài cả cửa sổ) và tiêu đề đứng yên khi cuộn. Bấm **"+ Thêm dòng phụ kiện"** thì con trỏ nhảy luôn vào ô đầu tiên của dòng mới. Riêng Phiếu Xuất có gắn đơn: dòng chữ *"chỉ định: X"* nay nằm ngay dưới ô Số lượng của đúng dòng đó.
2. **Chỉ định NPL → "📦 Xuất kho".** Xuất hiện ở **2 chỗ** (giống Chỉ định vải SX): trên **từng dòng đơn** trong danh sách Chỉ định NPL (khi đơn đã có chỉ định) và trong **cửa sổ danh sách bản** chỉ định NPL. Bấm là nhảy sang *Quản lý phụ kiện → Phiếu Xuất* với form mở sẵn và **đơn hàng đã chọn**, nên danh sách phụ kiện trong form chỉ còn những thứ đã chỉ định NPL cho đơn đó (khóa xuất theo chỉ định của v5.47 vẫn giữ nguyên). Nút chỉ hiện với người có quyền **Sửa** ở phân hệ Quản lý phụ kiện.

> Bẫy đã xử lý (giống lỗi v5.82.1 bên kho vải): khi đổi dòng từ `<div>` sang `<tr>`, **mọi** selector `#pkRows > div` phải đổi thành `#pkRows > [data-prow]` — gồm nút X xóa dòng, "+ Thêm dòng" và **hàm gom dữ liệu lúc Lưu**; sót chỗ gom dữ liệu là form báo "chưa nhập phụ kiện nào" dù đã điền đủ.

---

## BƯỚC 2.88 — RÀ SOÁT "CỐ ĐỊNH & CUỘN" TOÀN BỘ BẢNG BIỂU (điện thoại + máy tính) + lọc NGÀY bằng danh sách chọn (v5.82)

**KHÔNG có migration.** Chỉ frontend: `frontend/js/common.js`, `frontend/js/module.khohang.js`, `frontend/css/style.css`, `frontend/index.html` (`?v=5.82`) → copy 4 file → **Ctrl+F5** (không cần `pm2 restart`).

**Lỗi đã gặp (ảnh chụp trên điện thoại):** dòng tiêu đề bảng hiện **giữa bảng**, đè lên các dòng dữ liệu; thanh nút phủ kín gần hết bảng.

**Nguyên nhân (3 cái, đều là gốc rễ chứ không phải hiện tượng):**

1. **Cuộn ngang làm hở dải trong suốt.** Bảng rộng hơn màn hình nên vùng cuộn còn cuộn NGANG. Thanh tab / thanh công cụ chỉ rộng bằng khung nhìn, lại chỉ dính theo trục dọc → kéo sang phải là chúng trượt hẳn ra ngoài, chừa một dải trống ở trên. Dòng dữ liệu lộ ra ở dải đó, còn dòng tiêu đề bảng vẫn dính cách đỉnh đúng bằng chiều cao thanh → **trông như tiêu đề nằm giữa bảng**. → Đã thêm `left: 0` cho `.toolbar.sticky-bar` và `.tabs.sticky-tabs` (sticky dính được cả trục ngang).
2. **Điện thoại: thanh công cụ quá cao.** Trước đây mỗi nút chiếm 1 dòng full-width → thanh cao 150–250px; dính lại thì che gần hết bảng. → Từ v5.82, màn hình ≤900px: **các nút xếp cạnh nhau, tự xuống dòng**; và **KHÔNG dính** thanh tab/thanh công cụ nữa (chúng cuộn đi bình thường) — chỉ **dòng tiêu đề bảng** đứng yên, vì nó rộng bằng bảng nên cuộn ngang vẫn khít.
3. **Vùng cuộn lồng trong.** Nhiều màn hình bọc bảng bằng `div` có `overflow:auto` (bảng lương, chấm công, sổ cắt, phân công may, bảng kê...). Bảng dính vào chính `div` đó, nhưng 3 biến `--top0/--tabs-h/--bar-h` lại **thừa hưởng** của màn hình/cửa sổ bên ngoài → tiêu đề bị đẩy xuống 100–250px, đè lên dòng đầu. → `common.js` nay **tự tìm vùng cuộn gần nhất của mỗi bảng và đặt lại 3 biến = 0**, không phải sửa từng màn hình.

**Kèm theo:**

- Chiều cao dòng tiêu đề thứ 2 (hàng ô lọc) **đo bằng JS** (`--th-h`) thay vì đoán cứng 34px → không còn đè/hở 1 vạch.
- Cửa sổ bật lên trên điện thoại: thanh tiêu đề dính khớp `padding: 16px` (trước lệch 6px nên hé thấy dòng phía sau).
- `.bang-cuon` (vd lưới Bảng kê BTP) được giới hạn chiều cao (72vh máy tính / 68vh điện thoại) — `overflow:auto` mà chiều cao tự do thì vùng đó không bao giờ cuộn dọc nên tiêu đề **không có gì để dính**.
- Bảng nhập liệu `.lap-wrap` trên điện thoại cao 62vh (máy tính giữ 46vh).

**v5.82.1 — FIX: Phiếu nhập kho vải báo "Thiếu ngày nhập hoặc danh sách cây vải" dù đã điền đủ.** Từ v5.80 mỗi cây vải là một `<tr data-row>` (trước là `<div>`), nhưng hàm gom dữ liệu lúc **Lưu** của form *Nhập kho mới* còn sót `#rollRows > div` → gom được **0 dòng** → gửi `rolls: []` → backend chặn đúng luật. Đã đổi sang `#rollRows > [data-row]` (`frontend/js/module.khovai.js`). Các danh sách dòng khác (`#cRows`, `#qRows`, `#oRows`, `#pkRows`, `#kkRows`) **vẫn là `<div>`** nên giữ nguyên — đã rà lại toàn bộ.

**Đơn khách đặt hàng — lọc Thời gian nay là DANH SÁCH CHỌN (không gõ):** ô lọc ở cột *Thời gian* thành `<select>` gồm nhóm **Theo tháng** (mm/yyyy) và nhóm **Theo ngày** (dd/mm/yyyy), **chỉ liệt kê ngày CÓ THẬT trong dữ liệu**, mới nhất lên đầu. Chọn tháng = xem cả tháng. Trên điện thoại đây là danh sách chọn của hệ điều hành → bấm là xong.

---

## BƯỚC 2.84 — TÁCH CỔNG: gõ TÊN MÁY ra CATALOGUE, gõ TÊN MÁY:3000 vào PHẦN MỀM (v5.66)

**Không có migration.** Sửa `backend/.env` + copy 2 file + `pm2 restart`.

| Địa chỉ | Ra cái gì |
|---|---|
| `http://server` (cổng 80, không gõ cổng) | **Chỉ trang Catalogue** cho khách |
| `http://server:3000` | **Phần mềm nội bộ** (đăng nhập, mọi phân hệ) |

### Sửa `backend/.env` (BẮT BUỘC)

```
PORT=3000
PUBLIC_PORT=80
```

> Máy chủ hiện đang để `PORT=80` — **phải đổi thành `PORT=3000`**, nếu để nguyên thì hai cổng trùng nhau và hệ thống tự bỏ qua việc tách (mọi thứ vẫn dồn vào cổng 80 như cũ).
> `PUBLIC_PORT=0` = không mở cổng công khai. `PUBLIC_PORT` trùng `PORT` = quay lại kiểu cũ.

### Cổng công khai được phép truy cập những gì

Chỉ đúng những thứ trang catalogue cần: `/catalogue.html`, `/js/catalogue.js`, `/css/*`, `/icons/*`, `/uploads/*` (ảnh sản phẩm) và `/api/public/*`.

- Gõ `http://server/` → **tự chuyển sang** `/catalogue.html`.
- Gõ `http://server/index.html` hay `/login.html` → cũng bị đẩy về catalogue, **không vào được phần mềm**.
- Gọi bất kỳ API nội bộ nào (`/api/khohang/...`, `/api/qlsx/...`) qua cổng 80 → **403**, kể cả khi biết đúng đường dẫn.

### Sau khi restart, log phải hiện 2 dòng

```
[Server] NỘI BỘ  : http://localhost:3000  (đăng nhập, mọi phân hệ)
[Server] CÔNG KHAI: http://localhost:80  -> chỉ trang Catalogue (gửi link này cho khách)
```

Nếu thấy `KHÔNG mở được cổng công khai 80` thì cổng 80 đang bị chương trình khác chiếm (IIS, "World Wide Web Publishing Service", Skype…). Kiểm tra bằng `netstat -ano | findstr :80` rồi tắt dịch vụ đó (hoặc `sc stop W3SVC` với IIS). **Phần mềm nội bộ vẫn chạy bình thường** trong lúc đó — server không sập vì cổng bận.

### Link chia sẻ danh mục tự bỏ cổng

Nút **📋 Copy link** ở *Danh mục thẻ kho* nay sinh ra `http://server/catalogue.html?dm=...` (bỏ `:3000`), gửi khách là dùng được ngay. Nếu sau này đổi `PUBLIC_PORT` sang cổng khác 80 thì phải sửa hàm `linkCongKhai` trong `frontend/js/module.danhmuc.js`.

> **Firewall:** nhớ mở cổng 80 (và 3000) trên Windows Firewall của máy chủ; NAT/port-forward cổng 80 về máy chủ để khách ngoài internet xem catalogue.

### v5.66.1 — Nếu mở CẢ cổng 3000 ra ngoài để làm việc từ xa

Mở cổng nội bộ ra internet là chuyện làm được, nhưng phải bù lại bằng mấy lớp bảo vệ dưới đây — bot quét cổng sẽ tìm ra trang đăng nhập trong vài giờ.

**Đã làm sẵn trong mã nguồn (chỉ cần copy file + restart):**

- **Khoá tạm khi dò mật khẩu**: sai **8 lần liên tiếp** → khoá **15 phút**, đếm theo IP *và* theo IP+tên đăng nhập. Áp dụng cho cả đăng nhập nhân viên lẫn đăng nhập khách. Log ghi rõ IP: `pm2 logs qlnoibo` sẽ thấy `[login] SAI MAT KHAU "x" tu 1.2.3.4`. (Bộ đếm nằm trong bộ nhớ — `pm2 restart` là xoá sạch.)
- **Cookie phiên**: thêm `sameSite=lax` và tự bật cờ `Secure` khi chạy qua HTTPS.

**Anh phải tự làm (quan trọng nhất, theo thứ tự):**

1. **Đổi `SESSION_SECRET`** trong `.env` thành chuỗi ngẫu nhiên dài ≥ 32 ký tự. Để nguyên `change-me` thì phiên đăng nhập có thể bị giả mạo.
2. **Đổi hết mật khẩu yếu** của tài khoản nhân viên, nhất là `admin`. Khoá (`IsActive=0`) mọi tài khoản không dùng.
3. **Bọc HTTPS**. Hiện cổng 3000 chạy HTTP trần: **mật khẩu và cookie phiên đi qua internet ở dạng đọc được**, ai đứng giữa (wifi công cộng, nhà mạng) cũng lấy được phiên đăng nhập. Bắt buộc phải xử lý — chọn 1 trong 3 cách ở bảng dưới.
4. **Hạn chế IP nguồn** trong Windows Firewall nếu nơi truy cập từ xa có IP tĩnh (Scope → Remote IP address). Đây là biện pháp rẻ và hiệu quả nhất.
5. **Sao lưu database hằng ngày** và kiểm tra thật sự khôi phục được.

| Cách truy cập từ xa | Ưu | Nhược |
|---|---|---|
| **VPN (Tailscale / WireGuard)** — khuyên dùng | **Không mở cổng nào** ra internet; máy từ xa nhìn thấy máy chủ như trong LAN; cài 10 phút, bản miễn phí đủ dùng | Mỗi máy từ xa phải cài phần mềm VPN |
| **Cloudflare Tunnel** | Không mở cổng; có HTTPS + tên miền sẵn; thêm được lớp đăng nhập email OTP (Cloudflare Access) | Phụ thuộc dịch vụ ngoài; cần tên miền |
| **Giữ NAT cổng 3000 như hiện tại** | Không phải cài gì thêm | HTTP trần, lộ mật khẩu; toàn bộ dữ liệu nhân sự/lương/đơn hàng phơi ra internet; phải tự lo HTTPS + firewall |

**Cài:** copy `backend/utils/chongDoMatKhau.js` (file mới), `backend/routes/auth.js`, `backend/routes/public.js`, `backend/server.js` → **`pm2 restart qlnoibo`**.

---

## BƯỚC 2.85 — CẤU HÌNH AN TOÀN CHO thoitrangmoyn.id.vn (Cloudflare Tunnel + Access) (v5.66.2)

Hiện trạng: tên miền **thoitrangmoyn.id.vn** đã dùng DNS Cloudflare, khách vào được qua **NAT cổng 80** (HTTP trần).

Vấn đề của hiện trạng: (1) khách xem hàng qua HTTP, trình duyệt báo *"Không bảo mật"*; (2) **IP thật của công ty bị lộ**, bot quét được mọi cổng đang mở, kể cả 3000; (3) phần mềm nội bộ nếu NAT cổng 3000 thì mật khẩu và cookie phiên đi qua internet ở dạng đọc được.

### Kiến trúc đích — KHÔNG mở cổng nào ra internet

| Địa chỉ | Trỏ tới | Ai vào | Lớp bảo vệ |
|---|---|---|---|
| `https://thoitrangmoyn.id.vn` | tunnel → `localhost:80` | Khách xem/đặt hàng | HTTPS Cloudflare; chỉ phục vụ catalogue |
| `https://pm.thoitrangmoyn.id.vn` | tunnel → `localhost:3000` | Nhân viên từ xa | **OTP email Cloudflare** + đăng nhập phần mềm |
| `http://server:3000` | trực tiếp trong LAN | Nhân viên tại xưởng | Mạng nội bộ |

Sau khi xong: **đóng toàn bộ port-forward trên router (cả 80 lẫn 3000)**. Không còn cổng nào hở ra internet, IP công ty không còn lộ, mọi thứ đi qua HTTPS.

---

### BƯỚC 1 — Cài cloudflared trên máy chủ

1. Mở `https://one.dash.cloudflare.com` → chọn tài khoản → **Networks → Tunnels → Create a tunnel**.
2. Chọn **Cloudflared** → đặt tên `qlnoibo-moyn` → **Save tunnel**.
3. Màn hình tiếp theo chọn **Windows** + **64-bit**. Cloudflare hiện sẵn một dòng lệnh dạng:

```
cloudflared.exe service install eyJhIjoiXXXXXXXX....
```

4. Tải `cloudflared-windows-amd64.exe` (link ngay trên trang đó), đổi tên thành `cloudflared.exe`, để vào `C:\cloudflared\`.
5. Mở **PowerShell (Run as Administrator)**:

```powershell
cd C:\cloudflared
.\cloudflared.exe service install eyJhIjoiXXXXXXXX....
```

6. Kiểm tra dịch vụ chạy chưa:

```powershell
Get-Service cloudflared
```

Trạng thái phải là **Running**. Quay lại trang Cloudflare, tunnel hiện **HEALTHY**.

### BƯỚC 2 — Khai 2 địa chỉ công khai

Trong tunnel vừa tạo → tab **Public Hostname** → **Add a public hostname**, làm 2 lần:

**(a) Catalogue cho khách**

| Ô | Điền |
|---|---|
| Subdomain | *(để trống)* |
| Domain | `thoitrangmoyn.id.vn` |
| Path | *(để trống)* |
| Type | `HTTP` |
| URL | `localhost:80` |

**(b) Phần mềm nội bộ**

| Ô | Điền |
|---|---|
| Subdomain | `pm` |
| Domain | `thoitrangmoyn.id.vn` |
| Type | `HTTP` |
| URL | `localhost:3000` |

Cloudflare tự tạo bản ghi DNS (CNAME → `<id>.cfargotunnel.com`, đám mây **cam**). Nếu trong DNS còn bản ghi **A** cũ trỏ IP công ty thì **xóa đi** — còn nó là còn lộ IP.

> Ghi chú: `localhost:80` chỉ phục vụ catalogue vì cửa chặn tách cổng ở BƯỚC 2.84 đã khoá mọi thứ khác trên cổng 80. Tunnel không phá được lớp này.

### BƯỚC 3 — Cloudflare Access: chặn OTP email trước phần mềm

1. Zero Trust → **Access → Applications → Add an application → Self-hosted**.
2. Application name: `QLNoiBo`; Session Duration: `24 hours`.
3. Public hostname: Subdomain `pm`, Domain `thoitrangmoyn.id.vn`. **Next**.
4. Policy name `Nhan vien`; Action **Allow**; Include → **Emails** → thêm từng email được phép (vd `nguyendlp@fpt.com`, email của quản lý…). Hoặc **Emails ending in** nếu công ty dùng chung đuôi email.
5. Next → Add application.

Từ giờ mở `https://pm.thoitrangmoyn.id.vn` sẽ ra màn hình Cloudflare hỏi email → gửi mã 6 số về hộp thư → nhập đúng mới tới được trang đăng nhập phần mềm. **Hai lớp độc lập**: kẻ tấn công không có email trong danh sách thì không bao giờ chạm tới được trang đăng nhập.

> **KHÔNG** đặt Access cho `thoitrangmoyn.id.vn` (catalogue) — khách phải vào tự do.

### BƯỚC 4 — Cấu hình phần mềm (`backend/.env`)

```
PORT=3000
PUBLIC_PORT=80
TRUST_PROXY=loopback
PUBLIC_BASE_URL=https://thoitrangmoyn.id.vn
SESSION_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự, đổi ngay nếu đang là change-me>
```

Sinh nhanh chuỗi bí mật bằng PowerShell:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

`pm2 restart qlnoibo`.

- `TRUST_PROXY=loopback` — cloudflared chạy trên chính máy chủ nên request đến từ `127.0.0.1`; chỉ khi đó mới tin header IP. Log và bộ đếm khoá mật khẩu vì vậy hiện **IP thật của khách**.
- `PUBLIC_BASE_URL` — nút *Copy link* ở Danh mục thẻ kho sẽ sinh `https://thoitrangmoyn.id.vn/catalogue.html?dm=...` dù nhân viên đang làm việc ở `pm.` hay trong LAN.

### BƯỚC 5 — Đóng cổng trên router và firewall

1. **Router**: xóa port-forward cổng **80** và **3000** (nếu đã tạo). Tunnel đi ra từ trong nên không cần cổng vào nào.
2. **Windows Firewall**: cổng 80/3000/3443 chỉ cần mở cho **Private (LAN)**; bỏ hết ở **Public**.
3. Kiểm tra từ mạng 4G: `http://<IP-công-ty>` phải **không vào được nữa**, còn `https://thoitrangmoyn.id.vn` vẫn chạy.

### BƯỚC 6 — Vài công tắc nên bật trong Cloudflare (Free, 5 phút)

| Mục | Đặt | Vì sao |
|---|---|---|
| SSL/TLS → Overview | **Full (strict)** | Chuẩn hoá; với tunnel thì chặng tới máy chủ đã nằm trong nội bộ máy |
| SSL/TLS → Edge Certificates → **Always Use HTTPS** | Bật | Ai gõ `http://` tự nhảy sang `https://` |
| SSL/TLS → Edge Certificates → **Minimum TLS Version** | 1.2 | Loại bỏ TLS cũ |
| Security → **Bot Fight Mode** | Bật | Chặn bớt bot quét tự động |
| Security → WAF → Rate limiting rules | 1 rule: path chứa `/api/auth/login`, 10 request / 1 phút / IP → Block | Chặn dò mật khẩu ngay từ ngoài biên |
| Caching → Cache Rules | 1 rule: URI path bắt đầu `/api/` → **Bypass cache** | Không bao giờ để Cloudflare cache dữ liệu tồn kho/đơn hàng |

> **Sau mỗi lần copy file frontend mới: Caching → Configuration → Purge Everything.** Cloudflare cache file `.js`/`.css`; không purge thì khách vẫn thấy bản cũ dù đã Ctrl+F5. (Trong mã nguồn đã có `?v=` để giảm chuyện này, nhưng purge cho chắc.)

### BƯỚC 7 — Nghiệm thu

| Thử | Kết quả đúng |
|---|---|
| `https://thoitrangmoyn.id.vn` | Ra catalogue, **ổ khóa xanh**, khách đăng nhập/đặt hàng bình thường |
| `https://thoitrangmoyn.id.vn/index.html` | Bị đẩy về catalogue (không vào được phần mềm) |
| `https://thoitrangmoyn.id.vn/api/khohang/orders` | **403** |
| `https://pm.thoitrangmoyn.id.vn` | Màn OTP Cloudflare → nhập mã → tới trang đăng nhập phần mềm |
| `http://<IP công ty>` từ mạng 4G | **Không vào được** (đã đóng NAT) |
| `http://server:3000` trong xưởng | Bình thường |
| Sai mật khẩu 8 lần | "Sai quá nhiều lần. Vui lòng thử lại sau 15 phút." |
| `pm2 logs qlnoibo` | Dòng `[login] ... tu <IP thật>`, không phải `127.0.0.1` |

### Phụ lục — nếu vẫn muốn giữ một đường NAT trực tiếp cho cổng 3000

Chỉ làm khi thật sự cần (vd tunnel chết mà cần vào gấp). **Bắt buộc phải có HTTPS**, không NAT cổng HTTP trần.

1. DNS: thêm bản ghi **A** `truycap` → IP tĩnh công ty, **đám mây xám (DNS only)** — Cloudflare Free không proxy được cổng 3000. Chấp nhận lộ IP qua tên này.
2. Lấy chứng chỉ Let's Encrypt bằng **win-acme** (`wacs.exe`), xác thực **DNS-01 qua Cloudflare API Token** (Zone → DNS → Edit): `wacs.exe` → `M` → nhập `truycap.thoitrangmoyn.id.vn` → validation **DNS → Cloudflare** → dán token → store **PEM files** vào `D:\certs`. win-acme tự gia hạn.
3. `.env` thêm:

```
SSL_CERT_PATH=D:\certs\truycap.thoitrangmoyn.id.vn-chain.pem
SSL_KEY_PATH=D:\certs\truycap.thoitrangmoyn.id.vn-key.pem
HTTPS_PORT=3443
```

4. Router: NAT **cổng ngoài 3000 → cổng trong 3443**. Vào bằng `https://truycap.thoitrangmoyn.id.vn:3000` (giữ thói quen gõ `:3000` nhưng đã mã hoá). **Không** NAT 3000 → 3000.
5. Nếu nơi truy cập có IP tĩnh: Windows Firewall → rule cổng 3443 → Scope → Remote IP address → chỉ liệt kê đúng IP đó.

**Cài (phần mã nguồn):** copy `backend/server.js`, `backend/routes/public.js`, `backend/routes/auth.js`, `backend/utils/chongDoMatKhau.js`, `frontend/js/module.danhmuc.js`, `frontend/catalogue.html`, `frontend/index.html` → sửa `.env` → **`pm2 restart qlnoibo`** + Purge cache Cloudflare + Ctrl+F5.

**Cài:** sửa `backend/.env` → copy `backend/server.js`, `frontend/js/module.danhmuc.js`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Ctrl+F5.

---

## BƯỚC 2.83 — KHÁCH ĐẶT HÀNG TRỪ TỒN NGAY + SỬA/HỦY ĐƠN + THẺ KHO SẮP XẾP LẠI (v5.65)

**CÓ migration: `migration_v658.sql`** (thêm `TheKhoHangHoa.UpdatedAt`). Chạy trước khi copy file.

### 1. Trang catalogue công khai

| Trước | Nay |
|---|---|
| Mỗi lần chỉ chọn **1 màu** rồi bấm "+ Chọn" | **Mỗi màu một ô số lượng** — điền nhiều màu rồi bấm "+ Chọn" **một lần**, tất cả vào giỏ |
| Đơn vị mặc định **Cái** | Đơn vị mặc định **Ri** (vẫn đổi được sang Cái) |
| Cuộn xuống là mất tiêu đề + ô tìm kiếm | **Tiêu đề + thanh khách + ô lọc DÍNH trên đầu**; cuộn quá 40px thì tiêu đề tự thu gọn |

### 1b. Ảnh sản phẩm: xem được HẾT (v5.65.1)

- Ảnh lớn chuyển sang **`object-fit: contain`** — trước dùng `cover` nên **cắt mất phần trên/dưới** sản phẩm.
- Dưới ảnh lớn có **dải ảnh nhỏ** gồm **ảnh đại diện + ảnh của TỪNG MÀU**; bấm ảnh nhỏ để đổi ảnh lớn.
- Góc ảnh lớn có bộ đếm **"2/5"**; bấm ảnh lớn (hoặc ảnh trong chip màu) mở **xem toàn màn hình**, dùng ‹ › đi hết bộ ảnh.

### 2. Đặt hàng: TRỪ TỒN NGAY, không cần nhân viên xác nhận (đổi so với v5.63)

- Khách bấm **Gửi đơn** → **trừ tồn ngay**, đơn vào trạng thái **"Chờ xử lý"** (`DaTruTon = 1`).
- **v5.65.1 — đặt được đến đâu ghi đến đó:** màu nào **còn đủ thì đặt luôn**, không vì một màu thiếu mà bỏ cả đơn. (Bản v5.65 đầu tiên là "thiếu 1 dòng thì bỏ cả đơn" — đã bỏ.)
- **v5.65.2 — HỎI KHÁCH khi thiếu hàng:** đặt 10 mà kho còn 6 → hiện hộp thoại *"Bạn đặt 10 Ri, kho chỉ còn 6 Ri. OK để đặt 6 Ri / Cancel để bỏ màu này"*.
  - **OK** → hạ xuống 6 và **gửi tiếp ngay** (không phải bấm lại).
  - **Cancel** → bỏ màu đó khỏi giỏ.
  - Màu **hết sạch** (hoặc không còn bán trên trang) → tự bỏ khỏi giỏ, kể tên trong thông báo cuối.
  - Tối đa **3 lượt gửi** cho mỗi lần bấm, đề phòng người khác mua song song làm tồn thay đổi liên tục.
  - **Lưu ý:** cách này **có hiện số tồn còn lại** của đúng mã/màu khách đang đặt (bắt buộc, để hỏi được). Khác nguyên tắc "không hiện tồn" của v5.62–v5.65 — các thông tin khác (tồn tổng, giá Aloha, barcode…) vẫn không lộ.
- Hệ thống **không tự ý cắt số lượng** — chỉ hạ khi khách bấm OK.
- Nút **✔ Xác nhận** ở màn Đơn đặt hàng chỉ còn dùng cho các đơn cũ đang mắc ở trạng thái *"Chờ xác nhận"*; đơn mới không đi qua bước này nữa.

### 3. "Đơn của tôi": khách tự **Sửa số lượng** / **Hủy đơn**

- Chỉ đơn còn **"Chờ xử lý"** mới sửa/hủy được; đơn **Đã giao / Đã hủy** bị khóa (backend chặn lại lần nữa, không tin giao diện).
- **Sửa số lượng** → tồn kho cộng/trừ đúng phần chênh lệch ngay lập tức. **Hủy đơn** → hoàn tồn, đơn chuyển "Đã hủy" (**giữ lịch sử**, không xóa hẳn — nhân viên vẫn đối chiếu được).
- Khách **không đổi được mã hàng/màu** (muốn đổi thì hủy rồi đặt lại) — cố ý, để API công khai không thành đường ghi tùy ý vào thẻ kho.
- Mỗi lần khách đặt / sửa / hủy đều **gửi thông báo** cho người có quyền Thẻ kho hàng hóa + Admin.

### 4. Thẻ kho hàng hóa: thứ tự mới

- Mã **HẾT HÀNG (tồn ≤ 0) tụt xuống dưới cùng**.
- Trong nhóm còn hàng: **mã vừa tạo / vừa bấm Lưu nằm trên cùng** (theo `UpdatedAt`, migration_v658).
- Chưa chạy migration thì màn hình vẫn mở bình thường, chỉ xếp theo ngày tạo (backend tự dò cột).

### 5. Đơn khách đặt hàng (nội bộ)

- Thêm **cột Ảnh** (ảnh đại diện chung của mã hàng), bấm để phóng to.
- **In lại phiếu cho đơn ĐÃ GIAO**: nút *"🖨️ In phiếu lại"* hiện ở đơn đã giao — chỉ in, **không đổi trạng thái**, bản in có dòng *(BẢN IN LẠI — đơn đã giao)*. Hai nút xuất phiếu theo khách / theo mã hàng cũng gom cả đơn đã giao.

**Cài (đã gồm v5.65.1):** chạy `database/migration_v658.sql` → copy `backend/routes/public.js`, `backend/routes/khohang.js`, `frontend/js/catalogue.js`, `frontend/catalogue.html`, `frontend/js/module.khohang.js`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Ctrl+F5 (cả trang catalogue).

---

## BƯỚC 2.82 — PHIẾU XUẤT VẢI: GÁN LỆNH SẢN XUẤT SAU KHI ĐÃ XUẤT TỰ DO (v5.64)

**Không có migration** (cột `PhieuXuatVai.DonHangID` đã có sẵn từ lâu). Copy 2 file + `pm2 restart`.

**Trước đây:** xuất vải tự do (không gắn đơn) xong thì form *Sửa phiếu xuất* ghi rõ *"Không thể đổi đơn hàng gắn kèm ở đây — xóa phiếu và xuất lại nếu cần đổi đơn"*. Phải xóa phiếu làm lại, mất số phiếu và mất lịch sử.

**Nay:** trong **Sửa phiếu xuất** có ô **Lệnh sản xuất**:

- Đang để trống (xuất tự do) → chọn một lệnh SX để **gắn vào**.
- Đang gắn đơn → **đổi sang đơn khác**, hoặc chọn *"— Không gắn đơn (xuất tự do) —"* để **gỡ**.
- Mã đơn (`MaDon`) tự lấy đúng theo mã lệnh SX trong CSDL, không gõ tay nên không lệch.
- Sau khi gắn, **các cây vải của phiếu này sẽ hiện ở công đoạn Cắt của đơn đó** — đây là tác dụng chính, cũng là điều cần cân nhắc trước khi đổi đơn của phiếu đã dùng để cắt.

**Kèm 1 sửa lỗi liên quan:** danh sách lệnh SX cho phiếu xuất trước đây lọc theo điều kiện *"chỉ định vải có Số KG > 0"*, nên **đơn chỉ khai chỉ định theo SỐ MÉT (KG để 0)** — hợp lệ từ v5.51 — **không hiện ra và không lập được phiếu xuất**. Nay tính là đã chỉ định khi có **bất kỳ dòng chỉ định nào**, khớp với cột "Đã chỉ định" ở màn Chỉ định vải SX (đã sửa tương tự ở v5.54).

> Lưu ý: chỉ những lệnh SX **đã khai Chỉ định vải SX** mới xuất hiện trong ô chọn — đây là khóa nghiệp vụ có sẵn, tôi giữ nguyên. Nếu đơn chưa khai chỉ định thì khai trước rồi quay lại gán.

**Cài:** copy `backend/routes/khovai.js`, `frontend/js/module.khovai.js`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Ctrl+F5.

---

## BƯỚC 2.81 — KHÁCH ĐĂNG NHẬP ĐẶT HÀNG NGAY TRÊN WEB CÔNG KHAI (v5.63)

**CÓ migration: `migration_v657.sql`** (bảng `TaiKhoanKhach` + `DonKhachDatHang` thêm `TaiKhoanKhachID`, `NguonDat`, `GhiChuKhach`, **`DaTruTon`**, `NguoiXacNhanID`, `ThoiGianXacNhan` + quyền `KHOHANG/taikhoankhach`).

### Luồng hoạt động

1. **Nhân viên tạo tài khoản khách:** Thẻ kho hàng hóa → tab **Tài khoản khách** → *+ Tạo tài khoản khách* (tên đăng nhập, mật khẩu, tên khách, SĐT…). **Khách KHÔNG tự đăng ký được.**
2. **Gửi khách 2 thứ:** đường link danh mục công khai (Danh mục → Danh mục thẻ kho → 📋 Copy link) + tên đăng nhập/mật khẩu.
3. **Khách mở link** → bấm **Đăng nhập để đặt hàng** → mỗi sản phẩm hiện ô **chọn màu / số lượng / đơn vị** + nút **+ Chọn** → xem **🛒 Giỏ hàng** → **Gửi đơn đặt hàng** (kèm ghi chú). Khách còn có mục **Đơn của tôi** để tự theo dõi.
4. **Đơn về phần mềm** ngay trong **Đơn khách đặt hàng**, trạng thái **Chờ xác nhận**, có nhãn **Web** + ghi chú của khách. Đơn chờ xác nhận **luôn nằm trên đầu danh sách**.
5. **Thông báo** tự gửi tới **mọi tài khoản có quyền Thẻ kho hàng hóa + Admin** (chuông 🔔 trong phần mềm).
6. **Nhân viên bấm ✔ Xác nhận** → hệ thống **kiểm tra đủ tồn rồi mới TRỪ TỒN KHO** và chuyển sang *Chờ xử lý* (từ đây dùng tiếp luồng cũ: In phiếu → Đã giao).

### Điểm an toàn quan trọng nhất

- **Đơn khách đặt KHÔNG trừ tồn kho ngay.** Chỉ khi nhân viên xác nhận mới trừ — nên khách đặt thử/đặt nhầm không làm sai tồn kho. Nếu đến lúc xác nhận mà hàng đã bán hết, hệ thống **báo thiếu tồn và không cho xác nhận** (nêu rõ cần bao nhiêu, còn bao nhiêu).
- Cột **`DaTruTon`** đánh dấu đơn đã trừ tồn hay chưa. Nhờ nó, **hủy/xóa đơn "Chờ xác nhận" sẽ KHÔNG cộng trả tồn** (vì chưa từng trừ) — nếu thiếu cột này tồn kho sẽ bị thừa lên. Đơn cũ mặc định `DaTruTon=1` nên **hành vi với dữ liệu cũ không đổi**.
- Khách **chỉ đặt được hàng thuộc danh mục đang công khai**; mỗi dòng đều được kiểm tra lại ở máy chủ. **Không hiện số tồn** cho khách.
- Mật khẩu khách **mã hóa** (không xem lại được, chỉ đặt lại). Sai tên đăng nhập và sai mật khẩu báo **cùng một thông báo** để không dò được tài khoản. Tài khoản để **Tạm dừng** là không đăng nhập được.
- Phiên đăng nhập của khách **tách riêng** với phiên nhân viên — khách không chạm được vào bất kỳ chức năng nội bộ nào.

**Cài:** chạy `database/migration_v657.sql` → copy `backend/routes/public.js`, `backend/routes/khohang.js`, `frontend/js/module.khohang.js`, `frontend/js/catalogue.js`, `frontend/catalogue.html`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Ctrl+F5.

> **Phân quyền:** sau khi cài, vào Phân quyền chức năng tích **"Tài khoản khách"** (phân hệ Thẻ kho hàng hóa) cho nhóm được phép quản lý, rồi **đăng nhập lại** (quyền nạp lúc đăng nhập).

### v5.64.1 — SỬA lỗi "Đơn khách đặt hàng" trắng màn / *Máy chủ không phản hồi sau 30 giây*

**Nguyên nhân:** route `GET /api/khohang/orders` **không có try/catch**. Khi câu SELECT lỗi (thiếu cột do `migration_v657.sql` chưa chạy/chạy chưa xong) thì Express 4 không trả về gì → request treo → hết 30 giây báo *"Máy chủ không phản hồi"*, tab trắng.

**Đã sửa 3 lớp:**

1. `khohang.js` thêm **lưới an toàn cấp router** — mọi route trong file tự bắt lỗi và trả JSON kèm **nguyên văn thông báo SQL**, không bao giờ treo nữa.
2. `GET /orders` **tự kiểm tra cột trước khi chọn**: chưa có cột mới thì vẫn trả dữ liệu theo cột cũ (màn hình mở được bình thường) + kèm cảnh báo *"Chưa chạy migration_v657.sql…"*.
3. Giao diện tab **hiện thông báo lỗi cụ thể** thay vì trắng, và gợi ý luôn cách xử lý.

**Kiểm tra nhanh xem migration đã vào chưa** (chạy trong database QLNoiBo):

```sql
SELECT COL_LENGTH('DonKhachDatHang','DaTruTon')        AS DaTruTon,
       COL_LENGTH('DonKhachDatHang','NguonDat')        AS NguonDat,
       COL_LENGTH('DonKhachDatHang','GhiChuKhach')     AS GhiChuKhach,
       COL_LENGTH('DonKhachDatHang','TaiKhoanKhachID') AS TaiKhoanKhachID,
       COL_LENGTH('DonKhachDatHang','ThoiGianXacNhan') AS ThoiGianXacNhan,
       OBJECT_ID('TaiKhoanKhach')                      AS BangTaiKhoanKhach;
```

Cột nào trả **NULL** là **chưa có** → chạy lại `database/migration_v657.sql` (nhớ chọn đúng database, xem cửa sổ Messages có dòng `OK: them cot ...`).

**Cài bản .1:** copy `backend/routes/khohang.js`, `frontend/js/module.khohang.js` → **`pm2 restart qlnoibo`** + Ctrl+F5.

### v5.63.1 — Khách báo *"Sai tên đăng nhập hoặc mật khẩu"* dù nhập đúng

Thông báo này cố ý **giống nhau** cho cả 2 trường hợp (sai tên / sai mật khẩu) để người ngoài không dò được tài khoản nào có thật. Nay **log máy chủ ghi rõ nhánh nào sai** để quản trị chẩn đoán:

```
pm2 logs qlnoibo --lines 50
```

| Dòng log | Nghĩa | Cách xử lý |
|---|---|---|
| `KHONG TIM THAY tai khoan "..."` | Tên đăng nhập không khớp bản ghi nào | So lại chính tả/hoa-thường/khoảng trắng với tab **Tài khoản khách** |
| `SAI MAT KHAU cho tai khoan "..."` | Đúng tên, sai mật khẩu (**bcrypt phân biệt HOA/thường**) | Vào **Tài khoản khách → Sửa** → gõ mật khẩu mới → gửi lại khách |
| `MatKhauHash KHONG hop le` | Mật khẩu chưa lưu được lúc tạo | Sửa tài khoản, đặt lại mật khẩu (khách sẽ thấy thông báo riêng, không phải "sai mật khẩu") |

Kiểm tra nhanh bản ghi trong database (dấu `[ ]` để nhìn ra khoảng trắng thừa):

```sql
SELECT TaiKhoanKhachID, '[' + TenDangNhap + ']' AS TenDangNhap, LEN(TenDangNhap) AS DoDaiTen,
       LEFT(MatKhauHash, 7) AS DauHash, LEN(MatKhauHash) AS DoDaiHash, TrangThai
FROM TaiKhoanKhach;
```

`DauHash` phải là `$2a$10$` (hoặc `$2b$10$`) và `DoDaiHash` = **60**. Khác đi là mật khẩu chưa lưu đúng → đặt lại.

Bản này cũng **so tên đăng nhập có bỏ khoảng trắng đầu/cuối ở cả 2 phía**, nên tài khoản lỡ dính khoảng trắng (dán từ Excel/Zalo) vẫn đăng nhập được.

#### Công cụ chẩn đoán chạy thẳng trên máy chủ (khuyên dùng trước tiên)

`backend/utils/kiemtra_taikhoankhach.js` kiểm tra **không qua trình duyệt**, nên loại bỏ mọi nghi ngờ về cache / bản .js cũ / gõ nhầm:

```bash
cd <thư_mục_cài>/backend

node utils/kiemtra_taikhoankhach.js                       # liệt kê mọi tài khoản khách
node utils/kiemtra_taikhoankhach.js shopanh 123456        # kiểm tra đúng/sai mật khẩu
node utils/kiemtra_taikhoankhach.js shopanh matmoi123 --datlai   # ĐẶT LẠI mật khẩu
```

Kết quả in ra tên đăng nhập trong dấu `[ ]` (nhìn thấy khoảng trắng thừa), trạng thái, định dạng hash và **ĐÚNG/SAI MẬT KHẨU**. Nếu sai, thêm `--datlai` để đặt lại ngay — khách đăng nhập được liền, không cần restart.

**Cài:** copy `backend/routes/public.js` + `backend/utils/kiemtra_taikhoankhach.js` → **`pm2 restart qlnoibo`** (file utils chạy độc lập, không cần restart).

---

## BƯỚC 2.80 — CÔNG KHAI THẺ KHO THEO TỪNG DANH MỤC (link riêng gửi khách) (v5.62)

**CÓ migration: `migration_v656.sql`** (`TheKhoDanhMuc` + `CongKhai`, `Slug`, `TieuDeCongKhai`, `MoTaCongKhai` + tự sinh mã link cho danh mục đang có + chỉ mục duy nhất trên `Slug`).

### Cách dùng

1. Vào **Danh mục → Danh mục thẻ kho**. Mỗi dòng nay có cột **Công khai** và **Đường link cho khách**.
2. Bấm **Sửa** một danh mục → tích **"Công khai danh mục này"** → (tùy chọn) đặt **Mã đường link** (để trống = tự sinh không dấu từ tên), **Tiêu đề khách nhìn thấy**, **Mô tả ngắn** → Lưu.
3. Dòng đó hiện link dạng `http://<địa-chỉ-máy-chủ>:3000/catalogue.html?dm=hang-he-2026`, kèm nút **📋 Copy link** (dán vào Zalo/Messenger gửi khách) và nút **Xem** để tự kiểm tra.

### Nguyên tắc an toàn

- **Mặc định TẤT CẢ danh mục đều TẮT** sau khi chạy migration — không có gì bị công khai ngoài ý muốn. Phải bật thủ công từng danh mục.
- Danh mục **chưa bật** (hoặc link sai): khách mở ra chỉ thấy *"Đường link này không còn hiệu lực hoặc chưa được chia sẻ"* — **không hé tên danh mục, không hé có bao nhiêu danh mục**.
- Khách chỉ thấy **đúng danh mục trong link**, không thấy danh mục khác, không có ô chọn để dò sang danh mục khác.
- Nội dung công khai giữ đúng như catalogue hiện tại: **ảnh, tên hàng, giá bán, các màu còn hàng kèm ảnh màu**. **KHÔNG** hiện số lượng tồn, giá Aloha, barcode, ghi chú, đơn hàng sản xuất liên kết hay ID nội bộ. (Route mới còn bỏ hẳn `tonCai` từng màu ra khỏi dữ liệu trả về — chặt hơn route catalogue cũ.)
- Chỉ hàng **còn tồn > 0** mới hiện; hết hàng tự biến mất khỏi trang khách.
- Mã link do người ngoài gửi lên được **tham số hoá** trong câu truy vấn (không nối chuỗi vào SQL).

### Link cũ vẫn chạy

`/catalogue.html` (không kèm `?dm=`) giữ nguyên hành vi cũ: hiện tất cả hàng còn tồn của mọi danh mục. Nếu muốn **ngừng** link tổng này, chặn `/api/public/catalogue` ở tường lửa/reverse proxy như ghi chú ở mục bảo mật, hoặc bảo tôi thêm công tắc tắt riêng.

**Cài:** chạy `database/migration_v656.sql` → copy `backend/routes/public.js`, `backend/routes/danhmuc.js`, `frontend/js/module.danhmuc.js`, `frontend/js/catalogue.js`, `frontend/catalogue.html`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Ctrl+F5.

---

## BƯỚC 2.79 — DÒNG TIÊU ĐỀ BẢNG ĐỨNG YÊN KHI CUỘN (toàn phần mềm) (v5.61)

**Không có migration. Chỉ 2 file frontend.**

Mọi bảng trong phần mềm nay **giữ dòng tiêu đề cố định** khi kéo xuống — áp dụng đồng loạt bằng CSS, không phải sửa từng màn hình:

- Bảng ở **màn hình chính** (khung cuộn là vùng nội dung), bảng trong **cửa sổ bật lên (modal)**, và bảng trong **khung cuộn riêng** (vd "Chi tiết chấm công đã kéo về", lịch sử thẻ kho) — tất cả đều dính đúng vào khung cuộn gần nhất.
- Bảng có **2 dòng tiêu đề** (nhóm cột): dòng 2 dính ngay dưới dòng 1. Nếu chữ tiêu đề to/nhỏ khác làm lệch, sửa 1 chỗ duy nhất trong `style.css`: biến `--th-h` (mặc định `34px`).
- **Khi in**: tự động bỏ dính để tiêu đề không đè nội dung (bản in vẫn lặp tiêu đề mỗi trang như trước).
- Kỹ thuật: bảng dùng `border-collapse: collapse` nên viền ô tiêu đề bị cuộn mất khi dính → đã vẽ lại viền bằng `box-shadow inset`, nhìn không khác gì trước.

> ⚠️ **BẮT BUỘC đổi số phiên bản khi copy frontend.** `index.html` đã nâng `?v=5.56` → **`?v=5.61`** cho toàn bộ JS/CSS. Nếu quên bước này, trình duyệt vẫn chạy file cũ và "sửa rồi vẫn như cũ" (đúng lỗi đã gặp ở v5.56).

### Thanh công cụ (nút + bộ lọc) cũng đứng yên — v5.61.1

Thanh công cụ **ở đầu mỗi màn hình** (và ở đầu cửa sổ bật lên) nay dính lại khi cuộn, **dòng tiêu đề bảng tự nằm ngay dưới nó**, không chui vào sau.

- Chiều cao thanh công cụ thay đổi (nhiều nút thì xuống 2–3 dòng, màn hình hẹp càng xuống nhiều) nên **không đặt cứng bằng CSS được**: `common.js` đo chiều cao thật rồi gán biến `--bar-h` cho vùng cuộn, CSS lấy đó làm mốc cho tiêu đề bảng. Tự đo lại khi đổi tab, lọc lại dữ liệu, hoặc đổi kích thước cửa sổ.
- **Chỉ thanh nằm ở phần đầu vùng cuộn mới được dính** (cách đầu < 140px) — tránh dính nhầm mấy thanh nút nằm giữa form (vd "+ Thêm hạng mục" trong cửa sổ đơn giá).
- Khi in: bỏ dính, không ảnh hưởng bản in.

### Thanh TAB cũng đứng yên — v5.61.2 (chồng 3 lớp)

Khi cuộn xuống, phần đầu màn hình giữ nguyên theo đúng thứ tự:

```
[Thanh tiêu đề + chuông]   ← vốn đã cố định sẵn (nằm ngoài vùng cuộn)
[Thanh TAB: Danh sách lệnh SX | Ra lệnh SX | ...]   ← v5.61.2
[Thanh công cụ: nút + bộ lọc]                        ← v5.61.1
[Dòng tiêu đề bảng]                                  ← v5.61
──────── phần dữ liệu cuộn ở dưới ────────
```

- Chiều cao thanh tab / thanh công cụ đều được **đo bằng JS** rồi truyền cho CSS (`--tabs-h`, `--bar-h`) nên xuống 2–3 dòng vẫn xếp đúng, không đè nhau.
- Chỉ dính thanh **ở đầu vùng cuộn**; thanh nút giữa form (trong cửa sổ bật lên) vẫn cuộn bình thường.
- Áp cho **cả cửa sổ bật lên (modal)**: tab + thanh công cụ + tiêu đề bảng trong modal cũng đứng yên khi cuộn nội dung modal.
- **Thanh tiêu đề trên cùng (📦 tên màn hình + 🔔)** thực ra đã cố định từ trước: nó nằm NGOÀI vùng cuộn (`.topbar` trong `.main`, còn `.content` mới là vùng cuộn). Nếu ở máy nào thấy nó trôi, gửi ảnh + độ phân giải để tôi kiểm tra riêng.

### v5.61.3 — BỊT KHE HỞ phía trên các thanh dính (theo ảnh phản hồi)

Hiện tượng: thanh công cụ + tiêu đề bảng đã dính, nhưng **vẫn thấy một dòng dữ liệu chạy qua phía trên chúng**.

**Nguyên nhân:** vùng cuộn (`.content`) có **đệm trên 22px**. Khi vùng cuộn có đệm trên, phần tử dính bị ghim **thấp hơn mép trên đúng bằng khoảng đệm**, chừa lại một khe hở và dữ liệu chạy lọt qua khe đó — đúng bằng chiều cao một dòng bảng như trong ảnh.

**Đã sửa:**

1. `.content` bỏ đệm trên (`padding: 0 24px 22px`), khoảng trắng chuyển sang `::before` — nhìn y như cũ nhưng nó **cuộn đi** thay vì tạo khe hở. Áp cho cả màn hình hẹp (≤900px).
2. **Thanh tiêu đề cửa sổ bật lên** (chỗ kéo / thu nhỏ / ✕) nay **cũng dính** — vừa luôn bấm được nút Đóng khi cuộn form dài, vừa che kín khoảng đệm phía trên của cửa sổ.
3. Thứ tự chồng trong cửa sổ bật lên được tính lại theo chiều cao thanh tiêu đề (`--top0`) nên tab / thanh công cụ / tiêu đề bảng không bị nó che.

**Cài:** copy `frontend/css/style.css`, `frontend/js/common.js`, `frontend/index.html` → Ctrl+F5. `index.html` đã nâng `?v=5.61.3`. (Không cần `pm2 restart` vì không đổi backend.)

---

## BƯỚC 2.78 — CÀI ĐẶT CHẤM CÔNG (giờ vào/ra, 1 công, tăng ca) + xem chi tiết / xóa để kéo lại (v5.60)

**CÓ migration: `migration_v655.sql`** (bảng `CauHinh` nếu chưa có + `ChamCongNgay.SoGioLam` + tạo cấu hình mặc định).

### A. ⚙️ Cài đặt chấm công (nút mới ở tab Chấm công)

| Mục | Ý nghĩa | Mặc định |
|---|---|---|
| Giờ vào / Giờ ra | Khung giờ chuẩn — **chỉ giờ nằm trong khung này được tính CÔNG** | 08:00 – 17:00 |
| Nghỉ trưa từ / đến | Trừ khỏi giờ làm (để trống 2 ô = không trừ) | 12:00 – 13:00 |
| Số giờ = 1 công | Làm đủ số giờ này trong khung chuẩn = **1 công** | 8 |
| Làm tròn công | Khi **không đủ 1 công** thì chia theo tỉ lệ giờ rồi làm tròn **xuống**: Không / 0.25 / 0.5 | 0.5 |
| Tối thiểu tính công | Làm ít hơn (phút) = 0 công | 30 |
| Tăng ca: chỉ tính khi quá giờ ra | Về muộn dưới ngưỡng (phút) không tính OT | 30 |
| Làm tròn tăng ca | Làm tròn xuống theo giờ | 0.5 |
| Tăng ca tối đa/ngày | Chặn trên, tránh 1 lần quẹt sai thành OT vô lý | 6 |
| Tính cả phần đến sớm | Có tính giờ trước giờ vào là OT không | Không |
| Ngày lễ / Tết | Mỗi dòng 1 ngày `2026-09-02` → OT vào cột **Lễ/Tết** | (trống) |

**Cách tính (ví dụ, cài 08:00–17:00, nghỉ trưa 12–13, 8 giờ = 1 công):**

- Quẹt 07:50 → 17:30: giờ chuẩn = 8h → **1 công**; về muộn 30' → **0.5 giờ tăng ca thường**.
- Quẹt 08:00 → 12:00: giờ chuẩn = 4h → **0.5 công**, không OT.
- Quẹt 13:00 → 16:00: 3h → tỉ lệ 0.375 → làm tròn 0.5 → **0.5 công** (chọn "Không làm tròn" sẽ ra đúng 0.38).
- Chủ nhật quẹt 08:00 → 12:00 rồi 12:00 → 17:00: OT vào cột **Chủ nhật**.
- **Chỉ quẹt 1 lần trong ngày** (thiếu giờ ra): không đủ căn cứ → công = 0, đánh mã **`x?`** để sửa tay; sau khi Tổng hợp có cảnh báo *"Có N ngày chỉ quẹt 1 lần"*.

Sửa cài đặt → bấm **🔄 Tổng hợp từ máy → bảng công** để áp cho tháng đang xem. **Dòng đã sửa tay (Nguồn = ThuCong) không bị ghi đè.**

### B. 📄 Chi tiết đã kéo về (xem / xóa để kéo lại)

Nút mới mở danh sách **từng lần quẹt** (không gộp): Thời gian · Mã máy · Mã NV · Họ tên · Máy · Nguồn. Có lọc theo mã chấm công, **xóa 1 lần quẹt sai**, hoặc **🗑️ Xóa toàn bộ tháng để kéo lại** (xóa xong bấm "🔌 Kéo dữ liệu"). Bảng gộp giờ vào/giờ ra theo ngày vẫn nằm ở cuối tab như trước.

### C. 🗑️ Xóa bảng công tháng

Xóa bảng chấm công của tháng đang chọn — **chỉ xóa dòng do máy tổng hợp, giữ dòng sửa tay** — rồi Tổng hợp lại. Bảng chi tiết từng nhân viên ("Sửa chi tiết") nay hiện thêm **Giờ vào / Giờ ra / Giờ làm** để đối chiếu vì sao công là 0.5 hay 0.75.

**Cài:** chạy `database/migration_v655.sql` → copy `backend/routes/payroll.js`, `frontend/js/module.payroll.js` → **`pm2 restart qlnoibo`** + Ctrl+F5.

### D. v5.60.1 — SỬA 2 LỖI "lệch dữ liệu tải từ máy về"

1. **LỆCH 7 TIẾNG (nghiêm trọng, làm tính công sai).** Máy báo `08:40` nhưng hệ thống lưu `01:40`: khi ghi vào SQL, tham số kiểu `DateTime2` nhận một đối tượng thời gian nên driver **tự quy đổi sang UTC** (Việt Nam = UTC+7). Hậu quả đúng như đã thấy: ngày quẹt 08:40→20:33 chỉ ra **4,5 giờ** (vì bị hiểu là 01:40→13:33). **Đã sửa:** giờ chấm công nay ghi bằng **chuỗi giờ nguyên văn của máy** (`YYYY-MM-DD HH:mm:ss`), không qua quy đổi múi giờ — áp dụng cho **cả 3 đường**: máy Hikvision, máy ZKTeco và file Excel tải lên. Không còn phụ thuộc múi giờ của máy chủ.
2. **Cột "Giờ vào/Giờ ra" hiện `1970-`.** Cột kiểu TIME của SQL Server trả về dạng `1970-01-01T08:40:00.000Z`; chỗ hiển thị cắt sai. Đã có hàm lấy đúng `HH:mm`.
3. **Đổi mặc định "Làm tròn công" → "Không làm tròn".** Trước để 0.5 nên người làm 7,33 giờ (7h20) chỉ được 0,5 công. Nay chia đúng theo giờ: 7,33 / 8 = **0,92 công**. Muốn làm tròn thì chọn lại trong ⚙️ Cài đặt chấm công.

> **BẮT BUỘC làm sạch dữ liệu đã kéo bị lệch** (dữ liệu cũ vẫn sai 7 tiếng, sửa code không tự chữa được):
> **📄 Chi tiết đã kéo về** → **🗑️ Xóa toàn bộ tháng (để kéo lại)** → **🔌 Kéo dữ liệu** (chọn Từ ngày/Đến ngày) → **🗑️ Xóa bảng công tháng** → **🔄 Tổng hợp từ máy**. Sau đó đối chiếu: giờ vào/giờ ra trên phần mềm phải **khớp từng phút** với danh sách sự kiện trên máy chấm công.

**Cài bản .1:** copy `backend/utils/hikvision.js`, `backend/routes/payroll.js`, `frontend/js/module.payroll.js` → `pm2 restart qlnoibo` + Ctrl+F5 → rồi làm 5 bước làm sạch ở trên.

---

## BƯỚC 2.77 — KẾT NỐI MÁY CHẤM CÔNG HIKVISION + File mẫu thêm hàng loạt nhân viên (v5.59)

**CÓ migration: `migration_v654.sql`** (`MayChamCong` + `TenDangNhap`, `MatKhau`, `DungHTTPS`).

### A. Máy chấm công Hikvision (DS-K1T342MFWX)

Máy Hikvision **không** dùng giao thức ZKTeco (cổng 4370) mà dùng **ISAPI qua HTTP + xác thực Digest**. Đã bổ sung mà **không cần cài thêm thư viện nào** (dùng `fetch` + `crypto` có sẵn của Node 18+) — file mới `backend/utils/hikvision.js`.

**Khai báo máy:** Tính lương → Chấm công → **Thêm máy**:

| Trường | Giá trị cho Hikvision |
|---|---|
| Giao thức | **Hikvision** (chọn xong hệ thống tự đổi Port thành 80) |
| Địa chỉ IP | IP của máy trong mạng LAN, vd `192.168.1.201` |
| Port | **80** (hoặc cổng HTTP đã đổi trên máy) |
| Tài khoản / Mật khẩu | Tài khoản quản trị **của máy chấm công** (thường `admin`) |
| HTTPS | Bỏ trống (chỉ tích nếu máy đã bật HTTPS) |

> Khi **sửa** máy, để trống ô Mật khẩu = **giữ mật khẩu cũ**.

**Cách dùng:** Lưu xong bấm **🔎 Kiểm tra** (báo số nhân viên đang có trên máy) → **👥 Tải NV từ máy** để gán mã chấm công cho từng người → **🔌 Kéo dữ liệu** (chọn Từ ngày/Đến ngày) → **Tổng hợp từ máy**. Toàn bộ các bước sau khi kéo dữ liệu **giữ nguyên như máy ZKTeco** (chống trùng, gán nhân viên, tổng hợp công).

**Điều kiện:** máy chấm công và **máy chủ chạy phần mềm phải cùng mạng LAN**; trên máy Hik cần bật ISAPI/HTTP (mặc định đã bật).

### B. File mẫu thêm hàng loạt nhân viên (Quản lý nhân sự)

1. **SỬA LỖI: nút "⬇️ File mẫu" trước đây bấm không tải được** — route `/nhanvien/template` bị đặt **sau** `/nhanvien/:id` nên Express hiểu "template" là mã nhân viên → lỗi 500. Đã chuyển lên trước.
2. **File mẫu nâng cấp:** 24 cột (thêm Chuyên môn, Ngày/Nơi cấp CCCD, Chi nhánh NH, Ngày cấp MST…), 2 dòng ví dụ + **sheet "Huong dan"** ghi rõ quy tắc.
3. **Quy tắc nhập liệu:** chỉ **Họ tên** là bắt buộc; **Mã NV để trống = tự sinh NV001, NV002…**; điền Mã NV đã có = **cập nhật** người đó (không tạo trùng); **Bộ phận** chưa có sẽ tự tạo; đọc theo **tên cột** nên đổi thứ tự/bỏ bớt cột đều được.
4. **Cột "Mã chấm công"** trong file mẫu = ID của người đó **trên máy chấm công** → điền sẵn thì dữ liệu kéo từ máy Hik/ZK tự khớp đúng người, khỏi gán tay.
5. Form hồ sơ nhân viên nay **có ô "Mã chấm công"** (trước chỉ gán được qua màn Chấm công).

**Cài:** chạy `database/migration_v654.sql` → copy `backend/utils/hikvision.js` (file MỚI), `backend/routes/payroll.js`, `backend/routes/hrm.js`, `frontend/js/module.payroll.js`, `frontend/js/module.hrm.js` → **`pm2 restart qlnoibo`** + Ctrl+F5 (nhớ tăng số `?v=` trong `index.html` nếu trình duyệt còn giữ file cũ).

---

## BƯỚC 2.76 — BIỂU MẪU THÔNG SỐ ĐO MỚI theo file khách gửi (v5.58)

**CÓ migration: `migration_v653.sql`** (`TaiLieuThongSoDoDong` +`ViTriDo` +`DungSai`; `TaiLieuThongSoDo` +`YeuCauKyThuat` +`AnhGhiChu`).

**Thay đổi quan trọng — ĐẢO CHIỀU bảng:** mẫu cũ *dòng = size, cột = vị trí đo*; mẫu mới **dòng = 1 THÔNG SỐ** (Dài áo, Rộng ngang ngực, Chéo nách…) kèm **VỊ TRÍ ĐO** + **dung sai (+/-)**, **cột = SIZE** (80/90/100/110/120/130/140).

1. **Form soạn:** lưới `TT | THÔNG SỐ | VỊ TRÍ ĐO | <các size> | dung sai (+/-)`; nút **+ Thêm dòng (thông số)**, **+ Size**, **↧ Điền size chuẩn (80→140)**.
2. **Khối Ghi chú / YÊU CẦU KỸ THUẬT:** ô văn bản nhiều dòng + **ảnh minh hoạ** (dán Ctrl+V hoặc chọn nhiều file). Khi in, khối này nằm ở **cột "Ghi chú" gộp toàn bảng bên phải**, kèm ảnh — giống bản Excel.
3. **Bản in:** tiêu đề **THÔNG SỐ KĨ THUẬT** → dòng **1. BẢNG THÔNG SỐ + ngày** → bảng đúng thứ tự cột trên (vẫn có Mã hàng/Mã rập/Người lập ở đầu phiếu).
4. **Dữ liệu CŨ (đang ngược chiều):** mở bản ghi cũ rồi bấm **"⇄ Đổi chiều dòng/cột"** → kiểm tra → **Lưu**. Không tự động đổi để tránh sửa sai dữ liệu.
5. **Bảng kê BTP** lấy cột size từ **CỘT** của Thông số đo (mẫu mới); nếu đơn còn dữ liệu mẫu cũ (chưa có cột) thì tự **fallback về DÒNG** nên tiện ích "cột size từ Thông số đo" vẫn chạy.

**Cài:** chạy `database/migration_v653.sql` → copy `backend/routes/tailieukythuat.js`, `backend/routes/bangke.js`, `frontend/js/module.tailieukythuat.js` → **`pm2 restart qlnoibo`** + Ctrl+F5.

---

## BƯỚC 2.74 — NGUYÊN NHÂN GỐC "bấm nút không có gì xảy ra" (Bảng kê BTP) + chống sập server (v5.56b)

**Không có migration.** Copy `backend/server.js`, `backend/routes/bangke.js`, `backend/routes/tailieukythuat.js`, `frontend/js/common.js`, `frontend/index.html` → **`pm2 restart qlnoibo`** + Ctrl+F5.

**Nguyên nhân thật sự (đã kiểm chứng bằng thực nghiệm, không phải suy đoán):** Express 4 **không bắt lỗi** của handler `async`; từ Node 15 trở đi một Promise lỗi mà không ai bắt sẽ **làm SẬP CẢ TIẾN TRÌNH backend** (pm2 tự khởi động lại). Vì vậy khi 1 câu SQL trong `GET /api/bangke/:maDH` báo lỗi thì: server chết → request không có phản hồi nào → frontend `await` không bao giờ kết thúc → **không lỗi, không thông báo, nút trông như chết**. Đây là lý do sửa giao diện/phân quyền nhiều lần vẫn "y như cũ" — lỗi nằm ở tầng khác hẳn.

**Đã sửa 5 lớp:**

1. `bangke.js` — mọi route bọc `try/catch`, luôn trả JSON lỗi (không im lặng nữa).
2. `bangke.js GET /:maDH` — 3 phần **phụ trợ** (điền màu từ Cắt, gợi ý cột size từ Thông số đo, Mã rập) nay bọc riêng từng phần: hỏng phần nào thì **bỏ qua phần đó và VẪN MỞ ĐƯỢC form**.
3. `tailieukythuat.js` — thêm **lưới an toàn cấp router**: tự bọc mọi handler async (31 route) → lỗi chuyển sang error handler chung, trả JSON 500.
4. `server.js` — `process.on('unhandledRejection')`: một route lỗi **không còn làm sập server**, chỉ ghi log.
5. `common.js` — mọi lời gọi API có **timeout 30 giây**; quá hạn báo *"Máy chủ không phản hồi sau 30 giây… kiểm tra `pm2 logs qlnoibo`"* thay vì im lặng. `index.html` thêm `?v=5.56` cho toàn bộ JS/CSS để trình duyệt **không dùng lại file cũ trong cache** (đổi số này mỗi lần cập nhật).

**Nghi phạm cụ thể nhất — cột `LaMau` của bảng `TaiLieuThongSoDo`** (chỉ dùng ở route mở form BTP, không dùng ở route danh sách bản → khớp đúng triệu chứng "danh sách bản mở được, mở form thì chết"). Cột này do **`migration_v534e.sql`** tạo. Kiểm tra nhanh:

```sql
SELECT COL_LENGTH('TaiLieuThongSoDo','LaMau') AS LaMau_TonTai;   -- NULL = THIẾU -> chạy migration_v534e.sql
```

Sau khi cập nhật, nếu còn lỗi thì **bấm nút sẽ hiện thông báo đỏ nêu rõ nguyên nhân**, và `pm2 logs qlnoibo` ghi dòng `[bangke] ...` hoặc `[unhandledRejection] ...` — gửi tôi dòng đó là xử lý dứt điểm.

---

> ⚠️ **Nếu chạy migration báo `Msg 4902 ... Cannot find the object "DonHangDonGiaCongDoanMay" ...`:** gần như chắc chắn cửa sổ query đang nối vào **sai database** (SSMS mở New Query mặc định vào `master`). Cách xử lý: chọn đúng database QLNoiBo ở ô dropdown trên thanh công cụ SSMS, **hoặc** bỏ chú thích dòng `USE [QLNoiBo]; GO` ở đầu file (sửa đúng tên DB) rồi chạy lại. Bản `migration_v651.sql` hiện tại **tự phát hiện** trường hợp này: nếu không thấy bảng `DonHangSanXuat` nó sẽ in cảnh báo và dừng, không báo lỗi khó hiểu; cuối script có **bảng báo cáo trạng thái `TenPhieu`** của 8 bảng liên quan — nếu bảng nào không xuất hiện trong kết quả nghĩa là bảng đó thật sự chưa tồn tại (thiếu migration cũ: `v534b` đơn giá may, `v524` hạng mục gia công, `v534c` in thêu, `v640` là/đóng gói).

---

## PHẦN B — CÀI ĐẶT BACKEND (NODE.JS)

## BƯỚC 3 — Cài Node.js

1. Tải Node.js bản LTS (≥ 18): https://nodejs.org
2. Cài đặt như phần mềm thông thường (Next → Next → Finish).
3. Kiểm tra: mở Command Prompt, gõ `node -v` và `npm -v`, phải hiện số phiên bản.

## BƯỚC 4 — Cấu hình kết nối database

1. Vào thư mục `backend/`, copy file `.env.example` thành `.env`.
2. Mở `.env` bằng Notepad, sửa các dòng sau theo thông tin SQL Server của bạn — có **2 cách khai báo `DB_SERVER` tuỳ loại instance bạn cài ở Bước 1**:

   **Cách A — Instance mặc định (server không có tên riêng):**
   ```
   DB_SERVER=localhost
   DB_PORT=1433
   DB_NAME=QLNoiBo
   DB_USER=sa
   DB_PASSWORD=mật_khẩu_bạn_đã_đặt_ở_Bước_1
   ```

   **Cách B — Named instance (thường là trường hợp bạn cài SQL Server Express ở chế độ Basic — mặc định instance tên là `SQLEXPRESS`):**
   ```
   DB_SERVER=localhost\SQLEXPRESS
   DB_NAME=QLNoiBo
   DB_USER=sa
   DB_PASSWORD=mật_khẩu_bạn_đã_đặt_ở_Bước_1
   ```
   Với Cách B: **xoá hoặc bỏ trống dòng `DB_PORT`** — named instance không dùng cổng cố định 1433, hệ thống tự tìm đúng cổng qua dịch vụ **SQL Server Browser**. Vào `Services` (gõ `services.msc`) → tìm **SQL Server Browser** → click phải → Start, và đặt **Startup type = Automatic** để nó tự chạy mỗi lần khởi động máy. Nếu dịch vụ này không chạy, kết nối theo Cách B sẽ luôn thất bại dù `.env` đúng.

   Không biết mình đang dùng instance nào? Mở SSMS, xem tên bạn gõ lúc **Connect** ở Bước 2 — nếu là `localhost\SQLEXPRESS` thì dùng Cách B, nếu chỉ gõ `localhost` (hoặc `.`) thì dùng Cách A.
3. Đổi `SESSION_SECRET` thành một chuỗi ngẫu nhiên bất kỳ (dùng để mã hoá phiên đăng nhập).
4. (Tuỳ chọn) Nếu muốn bật cảnh báo email trễ hạn, điền thêm phần `SMTP_...` — xem hướng dẫn ở Bước 9.

> Nếu đăng nhập báo **"Lỗi máy chủ khi đăng nhập"** ngay từ lần đầu (sau khi đã chạy `seed:admin` thành công): 90% là do sai Cách A/B ở trên. Kiểm tra bằng cách xem log server (`pm2 logs qlnoibo --lines 50` nếu chạy pm2, hoặc xem trực tiếp cửa sổ Command Prompt nếu chạy `npm start`) — nếu thấy dòng `[DB] Loi ket noi SQL Server: ...` thì chắc chắn là lỗi kết nối, sửa lại `.env` theo đúng Cách A hoặc B rồi chạy lại `pm2 restart qlnoibo` (hoặc tắt/mở lại `npm start`).

## BƯỚC 5 — Cài thư viện & chạy thử

Mở Command Prompt tại thư mục `backend/`:

```bash
cd backend
npm install
npm run seed:admin admin admin123 "Quan Ly Tong"
npm start
```

- Lệnh `npm run seed:admin` tạo tài khoản quản trị đầu tiên: **username `admin`, mật khẩu `admin123`** (đổi ngay sau khi đăng nhập lần đầu — xem Bước 7).
- Lệnh `npm start` khởi động server. Nếu thấy dòng `[Server] Đang chạy tại http://localhost:3000` là thành công.
- Mở trình duyệt, truy cập **http://localhost:3000** → sẽ thấy màn hình đăng nhập.

> Nếu báo lỗi kết nối SQL Server: kiểm tra lại `.env`, kiểm tra dịch vụ SQL Server đang chạy (Services → SQL Server (SQLEXPRESS) → Running), và kiểm tra **TCP/IP đã được bật** trong SQL Server Configuration Manager (mặc định SQL Server Express tắt TCP/IP, cần bật thủ công + restart dịch vụ).

## BƯỚC 6 — Chạy nền lâu dài (khuyến nghị cho môi trường thật)

Chạy `npm start` chỉ tồn tại khi cửa sổ Command Prompt còn mở. Để chạy ổn định như một dịch vụ nền, dùng `pm2`:

```bash
npm install -g pm2
pm2 start server.js --name qlnoibo
pm2 save
```

`pm2 save` lưu lại danh sách tiến trình hiện tại (đã chạy thành công là xong phần này, không cần làm lại).

> **Trên Windows, KHÔNG chạy `pm2 startup`** — lệnh này chỉ hỗ trợ hệ init của Linux/macOS (systemd, upstart, launchd) và sẽ báo lỗi `Init system not found` trên Windows (pm2 không có cơ chế tương đương native cho Windows). Dùng 1 trong 2 cách sau để pm2 tự phục hồi tiến trình khi khởi động lại máy:
>
> **Cách 1 (đơn giản, đủ dùng cho hầu hết trường hợp):**
> ```bash
> npm install -g pm2-windows-startup
> pm2-startup install
> ```
> Lệnh này đăng ký `pm2 resurrect` tự chạy khi Windows khởi động, khôi phục đúng danh sách tiến trình đã `pm2 save` ở trên. Khởi động lại máy để kiểm tra: mở Command Prompt, gõ `pm2 list`, phải thấy `qlnoibo` đang ở trạng thái `online`.
>
> **Cách 2 (bền hơn cho máy chủ chạy production dài hạn):** dùng [NSSM](https://nssm.cc/) để chạy thẳng `node server.js` như một Windows Service thật sự, không phụ thuộc pm2 hay phiên đăng nhập nào. Lưu ý NSSM **không cài qua npm** — phải tải file `.exe` trực tiếp từ nssm.cc rồi giải nén, sau đó chạy bằng đường dẫn đầy đủ tới `nssm.exe` (hoặc thêm vào PATH):
> ```bash
> nssm install QLNoiBo "C:\Program Files\nodejs\node.exe" "D:\đường-dẫn-tới\backend\server.js"
> nssm set QLNoiBo AppDirectory "D:\đường-dẫn-tới\backend"
> nssm start QLNoiBo
> ```
> Windows Service quản lý bởi `services.msc` sẽ đáng tin cậy hơn cho môi trường vận hành 24/7 vì được hệ điều hành khởi động trực tiếp, không qua lớp trung gian pm2.

Nếu muốn nhiều máy trong xưởng cùng truy cập, thay vì mở `localhost:3000` trên máy chủ, các máy khác trong cùng mạng LAN truy cập bằng địa chỉ IP máy chủ, ví dụ `http://192.168.1.20:3000` (xem địa chỉ IP máy chủ bằng lệnh `ipconfig`). Cần mở port 3000 trên Firewall Windows nếu bị chặn.

---

## PHẦN C — SỬ DỤNG HỆ THỐNG

## BƯỚC 7 — Đăng nhập lần đầu & đổi mật khẩu admin

1. Truy cập `http://localhost:3000` (hoặc địa chỉ IP máy chủ).
2. Đăng nhập bằng `admin` / `admin123`.
3. Vào phân hệ **Quản lý User → Tài khoản → Sửa** tài khoản `admin` → nhập mật khẩu mới → Lưu.

## BƯỚC 8 — Khai báo danh mục ban đầu

Vào phân hệ **Danh mục**, lần lượt khai báo theo xưởng thực tế của bạn (đã có sẵn dữ liệu mẫu, bạn có thể sửa/xoá/thêm):

- **Bộ phận**: các phòng ban (Kỹ thuật, Cắt, May, Kho...).
- **Loại vải / Màu sắc / Danh mục vải**: mỗi "mã vải" = 1 loại vải + 1 màu cụ thể, kèm khổ vải, GSM, vị trí kho, tồn tối thiểu (dùng để cảnh báo sắp hết).
- **Phụ liệu**: thẻ bài, mác, chun, túi bóng (danh mục tổng quát dùng để phân loại — riêng để quản lý tồn kho chi tiết theo mã/size, dùng phân hệ **Quản lý phụ kiện** ở Bước 10.4).
- **Nhà gia công / In thêu**: danh sách xưởng gia công ngoài và xưởng in/thêu.
- **Nhà cung cấp**: nơi mua vải/phụ liệu.
- **Khách hàng**: khách đặt đơn sản xuất hoặc đặt hàng thành phẩm.
- **Danh mục thẻ kho**: nhóm sản phẩm thành phẩm (VD "Hàng hè 2026").
- **Loại hàng** *(mới, v5.4)*: nhóm sản phẩm thẻ kho hàng hóa theo kiểu dáng (VD "Quần bé trai", "Quần bé gái", "Áo thun") — dùng để lọc nhanh trong Thẻ kho hàng hóa và Catalogue (xem Bước 10.3/10.5). **Lưu ý đặt tên**: đây là trường HOÀN TOÀN KHÁC với ô "Nguồn hàng" (trước gọi là "Loại hàng") đã có sẵn trong form Thẻ kho hàng hóa — ô đó phân biệt Nhà sản xuất/Đặt ngoài (nguồn gốc hàng), còn danh mục mới này phân biệt kiểu dáng/dòng sản phẩm. Không bắt buộc phải gán cho mọi mã hàng.
- **Công đoạn sản xuất**: thứ tự công đoạn (Kỹ thuật → Cắt → May → Hoàn thiện → Kho nhập → Đóng gói...). **Thứ tự này quyết định luồng chuyển đơn hàng** khi ghi nhận tiến độ, và **quyết định form nhập liệu nào hiện ra** khi ghi tiến độ (xem Bước 10.1). Giữ nguyên đúng tên **"Kỹ thuật"**, **"Cắt"**, **"May"**, **"Kho nhập"** nếu muốn dùng đúng các form chuyên biệt và báo cáo năng suất tự động — đổi tên các công đoạn này sẽ làm hệ thống hiển thị form tổng quát (chỉ 1 ô số lượng lũy kế) thay vì form chuyên biệt, và báo cáo năng suất Cắt/Nhập kho trả về 0.
- **Đơn vị tính** *(mới, v4.0)*: danh sách đơn vị dùng cho ô "Đơn vị" khi tạo đơn hàng mới (VD Cái, Bộ, Mét, Kg, Cuộn, Ri, Chiếc — đã có dữ liệu mẫu, có thể thêm/sửa).
- **Công đoạn may** *(mới, v4.0)*: các công đoạn con trong May (VD May cổ, May tay, May thân, Vắt sổ, Tra khóa, Đính nút, May lai, Ủi hoàn thiện — đã có dữ liệu mẫu) — dùng khi "giao việc nội bộ" cho nhân viên tại công đoạn May (xem Bước 10.1). **Chỉ phục vụ ghi nhận ai làm công đoạn nào, KHÔNG tính lương/đơn giá** — nếu cần tính lương theo công đoạn may, đó là phạm vi mở rộng riêng, chưa có trong bản này.
- **Nhân viên** *(mới, v4.0)*: danh sách nhân viên theo bộ phận (Họ tên, Mã NV, Bộ phận, SĐT, Ngày vào, Trạng thái Đang làm/Đã nghỉ). Dùng để chọn "nhân viên trải vải"/"nhân viên cắt" ở công đoạn Cắt, và "giao việc nội bộ" ở công đoạn May. **Đây là danh mục nhân sự dùng cho QLSX, KHÔNG phải phân hệ chấm công/tính lương** — nếu sau này cần chấm công/bảng lương, sẽ cần module riêng dùng chung danh mục Nhân viên này.
- **Cấu hình hệ thống**: email nhận cảnh báo trễ hạn, số ngày cảnh báo trước hạn.

> Riêng **Loại phụ kiện** và **Danh mục phụ kiện** (mã mác/thẻ bài/chun/dây rút cụ thể) không khai báo ở đây — quản lý ngay trong phân hệ **Quản lý phụ kiện**, xem Bước 10.4.

## BƯỚC 9 — Tạo tài khoản & phân quyền cho từng bộ phận

Vào phân hệ **Quản lý User**:

1. Tab **Nhóm quyền**: tạo các nhóm tương ứng bộ phận (đã có sẵn mẫu: Kỹ thuật, Cắt, May, Kho, Giao nhận, Kinh doanh).
2. Tab **Ma trận phân quyền**: chọn **"Theo nhóm quyền"**, chọn từng nhóm, tick chọn Xem/Thêm/Sửa/Xóa cho từng phân hệ (Danh mục, Quản lý User, Quản lý sản xuất, Kho vải, Kho hàng, **Phụ kiện**). Nhóm **Admin** luôn có toàn quyền, không cấu hình được.
3. Tab **Tài khoản**: tạo tài khoản cho từng nhân viên, gán vào 1 hoặc nhiều nhóm quyền, và (nếu làm ở Quản lý sản xuất) tick chọn **công đoạn được phép cập nhật**.

> **Phân quyền theo từng chức năng (tab con) nay có đủ Xem/Sửa/Xóa (mở rộng từ v5.3, trước đó chỉ có Xem):** trong **Ma trận phân quyền**, mỗi phân hệ khi mở rộng ra sẽ thấy danh sách các tab con (VD QLSX: Dashboard / Ra lệnh sản xuất / Danh sách lệnh sản xuất / Đơn giá công đoạn may...), mỗi tab con có 3 ô tick riêng **Xem/Sửa/Xóa**. Quyền cuối cùng của 1 tài khoản trên 1 tab = quyền phân hệ **VÀ** quyền tab con (tab con chỉ thu hẹp thêm, không mở rộng vượt quyền phân hệ) — VD phân hệ Kho vải chỉ được cấp quyền Sửa (không Xóa), thì dù tab con "Nhập kho" có tick Xóa cũng không có tác dụng, tài khoản vẫn không xóa được.

> **Phân quyền riêng theo từng user (mới, v5.1):** vẫn ở tab **Ma trận phân quyền**, chọn **"Theo từng user"** thay vì "Theo nhóm quyền" — chọn đúng 1 tài khoản, tick **"Ghi đè riêng"** ở phân hệ hoặc chức năng nào muốn đặt quyền KHÁC với (các) nhóm mà người đó đang thuộc (VD: một nhân viên trong nhóm Kho nhưng cần thêm quyền Xóa ở Phụ kiện mà không muốn cấp Xóa cho cả nhóm Kho). Không tick "Ghi đè riêng" = tài khoản đó vẫn dùng đúng quyền tính theo nhóm như bình thường, không ảnh hưởng gì. Đây là lớp phân quyền **cao hơn** nhóm — dùng cho các trường hợp cá biệt, không nên dùng thay thế hoàn toàn cho việc quản lý theo nhóm (quản lý theo nhóm vẫn nên là cách chính, ghi đè riêng chỉ nên là ngoại lệ ít gặp, nếu không sẽ khó theo dõi ai đang có quyền gì).

> Quan trọng: nếu bạn đổi phân quyền của 1 nhóm (hoặc ghi đè riêng của 1 user) trong khi nhân viên đang đăng nhập, họ cần **đăng xuất và đăng nhập lại** để hệ thống nạp lại quyền mới (quyền được tính 1 lần lúc đăng nhập để tăng tốc độ, không truy vấn lại mỗi request).

> **Thông báo trong hệ thống (mới, v4.0):** khi có tiến độ đơn hàng chuyển sang công đoạn mà nhân viên đó được phân quyền cập nhật (bảng **công đoạn được phép cập nhật** ở trên), họ sẽ thấy số thông báo chưa đọc trên chuông 🔔 ở góc trên bên phải sau khi đăng nhập (hoặc trong vòng 45 giây kể từ lúc có tiến độ mới, do hệ thống tự kiểm tra định kỳ — không phải theo thời gian thực tức khắc).

### Cấu hình email cảnh báo trễ hạn (tuỳ chọn)

Trong `.env`, điền `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (với Gmail: bật xác thực 2 lớp rồi tạo "Mật khẩu ứng dụng" tại https://myaccount.google.com/apppasswords, dùng mật khẩu 16 ký tự đó, không dùng mật khẩu Gmail thường). Sau đó khởi động lại server. Hệ thống tự kiểm tra lúc 8:00 sáng mỗi ngày, hoặc bấm **"Kiểm tra & gửi cảnh báo ngay"** trong Dashboard của phân hệ Quản lý sản xuất.

## BƯỚC 10 — Sử dụng từng phân hệ

### 10.1 Quản lý sản xuất
- **Dashboard**: tổng quan số đơn theo trạng thái/công đoạn, **bảng "Đơn hàng đang sản xuất" (v4.0)** hiển thị trạng thái kèm đúng tên công đoạn hiện tại (VD "Đang sản xuất - May"), báo cáo tốc độ xử lý theo từng nhà gia công/nhà in. **Từ v5.2**: bấm vào 1 dòng trong bảng này để xem ngay chi tiết đơn hàng (báo cáo năng suất, xuất vải, lịch sử tiến độ) trong 1 popup, không cần chuyển sang tab Danh sách rồi tìm lại.
- **Ra lệnh sản xuất → Danh sách lệnh sản xuất** *(tab đổi tên từ "Danh sách đơn hàng" — v5.2)*: nhập tên sản phẩm, khách hàng, ngày đặt/giao, tổng số lượng, **đơn vị tính (chọn từ danh mục Đơn vị tính — v4.0)**, ảnh sản phẩm, và cấu trúc vải/màu (nhiều dòng loại vải + kiểu Chính/Phối + màu + số lượng, **mỗi màu chính có thêm 1 ảnh riêng — v5.2**). Chỉ tài khoản có quyền **Thêm** trên QLSX mới tạo được đơn mới. **Từ v5.2**, khối "Phụ kiện cần dùng" không còn ở form này — chuyển sang ghi nhận tại công đoạn "Phụ kiện" (xem dưới). Tab **Danh sách lệnh sản xuất** có thêm nút **Sửa** (chỉnh thông tin chung, không sửa cấu trúc vải/phụ kiện) và **Xóa** — cả 2 chỉ hiện với tài khoản có đúng quyền Sửa/Xóa; các nút thao tác khác (Ghi tiến độ, Giao/nhận nhà gia công) cũng chỉ hiện với quyền Sửa, In lệnh/In phiếu luôn hiện (chỉ xem).
- **Ghi tiến độ**: người phụ trách công đoạn chọn đơn, chọn đúng công đoạn mình phụ trách (hệ thống chặn nếu không đúng quyền). **Biểu mẫu nhập liệu thay đổi theo từng công đoạn:**
  - **Kỹ thuật**: Mét sơ đồ/Khổ vải sơ đồ/Mã rập như trước, cộng thêm **(mới, v5.2)** checklist chọn các **công đoạn may áp dụng cho đơn hàng này** kèm **đơn giá/hệ số RIÊNG của đơn** (khác giá mặc định toàn hệ thống ở tab "Đơn giá công đoạn may") — dùng để tính lương sau này; chỉ công đoạn đã tick ở đây mới xuất hiện trong dropdown "Giao việc nội bộ" ở công đoạn May.
  - **Giao vải** *(công đoạn mới, v5.2, đứng trước Cắt)*: thay cho nút "Giao vải SX" rời trước đây — chỉ hiện cây vải còn tồn kho **đúng loại vải + màu** đã khai báo ở Ra lệnh sản xuất (không hiện toàn bộ kho), ghi KG giao, hỗ trợ quét QR; **chưa trừ** Thẻ kho vải thật (là bước cấp tạm phục vụ Cắt, giống cơ chế cũ). Mã cây hiển thị dạng thẻ tự co giãn theo độ dài mã, không bị cắt/giãn theo cột cố định.
  - **Phụ kiện** *(công đoạn mới, v5.2, đứng sau Giao vải)*: thay cho khối "Phụ kiện cần dùng" trước đây ở form Ra lệnh sản xuất — ghi nhận từng dòng phụ kiện (mã, số lượng, đơn vị, ghi chú) ngay tại đây, thêm/xóa độc lập với việc chuyển công đoạn.
  - **Cắt**: mỗi ô nhập liệu theo từng cây vải (STT, SL lớp, Hệ số quy đổi, **KG/mét đã dùng — mới v5.2**, SL cái tự tính) đều có **nhãn rõ ràng** thay vì chỉ có chữ mờ gợi ý; **nhân viên trải vải** đổi từ 1 ô chọn sang **danh sách checkbox, chọn được tối đa 2 người** (v5.2 — hệ thống tự chặn nếu tick người thứ 3); **nhân viên cắt** vẫn 1 người như trước.
  - **May**: hiện Tổng SL cắt đã quy đổi kèm **Tổng số bàn cắt (mới, v5.2 — số dòng cây vải đã ghi ở Cắt)**, đơn giá công đoạn may tham khảo, số lượng lũy kế theo màu (kèm cột tham khảo SL cắt từng màu như trước). Nếu đơn hàng "Giao nhận" = **Nhà làm**, khối **"Giao việc nội bộ"** cho chọn nhân viên + công đoạn may + màu + số lượng — **từ v5.2, dropdown công đoạn may chỉ liệt kê đúng các công đoạn đã chọn ở "Kỹ thuật" của đơn này** (không còn hiện toàn bộ danh mục); 1 màu/1 công đoạn vẫn chia được cho nhiều nhân viên với số lượng khác nhau.
  - **Các công đoạn sau Cắt** (May, Hoàn thiện, Đóng gói, Kho nhập...): đều có cột tham khảo "Cắt: X" hiển thị SL đã quy đổi theo đúng từng màu (không đổi so với trước, 2 công đoạn mới Giao vải/Phụ kiện đứng TRƯỚC Cắt nên không ảnh hưởng phần này).
  - **Kho nhập**: hiện sẵn các màu chính đã khai báo lúc tạo đơn + tổng số lượng theo màu do Cắt đã ghi nhận; nhập số lượng **thực tế nhận** theo đơn vị cơ bản hoặc đơn vị quy đổi (VD 5 Cái = 1 Ri). **Lưu sẽ tự động cập nhật vào Thẻ kho hàng hóa** (tự tạo thẻ kho nếu đơn hàng chưa có, cộng đúng phần chênh lệch so với lần nhập trước — xem Bước 10.3).
  - Mỗi lần ghi nhận, đơn hàng **tự động chuyển sang công đoạn tiếp theo**, và **nhân viên được phân quyền cập nhật công đoạn kế tiếp sẽ nhận thông báo trong hệ thống (v4.0)** — xem chuông 🔔 ở Bước 9.
- *(Đã loại bỏ ở v4.0)* **Cấp vải**: tính năng cấp phát vải trực tiếp trong QLSX không còn nữa. Xuất vải cho một đơn hàng cụ thể nay thực hiện **duy nhất qua phân hệ Kho vải → Xuất kho vải, chọn đơn hàng** (xem Bước 10.2) — tránh 2 nơi cùng ghi nhận 1 nghiệp vụ.
- **Giao/nhận NCC**: ghi nhận ngày giao/nhận với nhà gia công và nhà in/thêu; số ngày xử lý tự tính.
- **In lệnh sản xuất**: bảng "Cấu trúc vải" **từ v5.2** có thêm cột **Ảnh** — hiện ảnh riêng của từng dòng màu chính (màu phối không có ảnh riêng, nằm lồng ngay dưới màu chính tương ứng).
- **In phiếu**: xuất phiếu báo cáo đơn hàng, gồm — (1) **Báo cáo năng suất Cắt/Nhập kho**: SL yêu cầu cắt, SL cắt thực tế, và **SL nhập kho thực tế (hiển thị "Chưa nhập kho" nếu bằng 0, thay vì số 0 — v4.0)**, cùng % hao hụt tự động; (2) **Xuất vải kèm đơn hàng (v4.0)**: lịch sử các lần xuất vải từ Kho vải gắn với đơn này; (3) **Phụ kiện xuất kèm đơn hàng**: tổng số lượng từng mã phụ kiện đã xuất gắn với đơn này (xem Bước 10.4); (4) lịch sử cập nhật tiến độ đầy đủ. Mở cửa sổ in của trình duyệt.
- **Danh mục → Máy sản xuất** *(mới, v5.2)*: khai báo các máy sản xuất (VD "1 kim", "Vắt sổ"); gán vào từng nhân viên ở **Danh mục → Nhân viên** để biết ai đang ngồi máy nào, phục vụ tính lương sau này.

### 10.2 Quản lý kho vải
- **Nhập kho** *(nay là màn hình danh sách — v5.1)*: vào tab hiện **danh sách các phiếu nhập đã tạo** (ngày, nhà cung cấp, số hóa đơn, số cây, tổng KG, người tạo), có nút **Xem/In**, **Sửa** (chỉ sửa thông tin đầu phiếu — ngày/nhà cung cấp/số hóa đơn/ghi chú, không sửa lại danh sách cây/KG đã nhập), **Xóa** (chỉ xóa được nếu các cây trong phiếu chưa phát sinh xuất kho/giao vải sản xuất/kiểm kê) — cả 3 nút hiện theo đúng phân quyền Sửa/Xóa của tài khoản. Nút **"+ Tạo phiếu nhập kho"** mở lại đúng form nhiều dòng như trước: chọn **Loại vải + Màu** (hệ thống tự tìm hoặc tự tạo mã vải tương ứng, không cần nhớ mã), **đơn giá nhập theo từng mã vải**, hệ thống tự sinh **mã cây** và **mã QR**; lưu xong tự mở luôn màn hình xem/in phiếu vừa tạo. **Từ v5.4**, form có thêm ô **"Ngày hóa đơn"** (nhập tay, độc lập với ngày lập phiếu — theo đúng mẫu `mau_phieu.docx`); bản in phiếu nhập đã dựng lại đúng theo mẫu này (Đơn vị bán hàng/Ngày hóa đơn tách dòng riêng, cột "Mã cây tự sinh" ở cuối bảng, 3 vai ký Người lập/QC Vải/Thủ kho).
- **Xuất kho** *(nay là màn hình danh sách — v5.1)*: tương tự Nhập kho — danh sách phiếu xuất đã tạo kèm Xem/In/Sửa/Xóa theo phân quyền (Xóa sẽ hoàn lại đúng số KG đã xuất vào tồn kho của các cây liên quan). Nút **"+ Tạo phiếu xuất kho"** mở form xuất nhiều cây như trước: có thể chọn **1 đơn hàng sản xuất** — khi đã chọn, hệ thống chỉ cho tìm/chọn cây vải đã được **"Giao vải sản xuất"** cho đúng đơn đó; tìm cây vải bằng cách gõ tự do hoặc **quét mã QR bằng camera**. **Từ v5.4**, ô tìm mã cây trong form rộng gấp đôi so với trước (dễ đọc mã cây dài); bản in phiếu xuất đã dựng lại đúng theo mẫu `mau_phieu.docx` — thêm cột **"SL theo chỉ định"** (lấy từ số liệu đã chỉ định ở công đoạn Giao vải trong QLSX) cạnh SL xuất thực tế, và 4 vai ký (Người lập/Bộ phận cắt/NV chỉ định NPL/Thủ kho) thay vì 2 như trước; cột "Ghi chú" trên bản in để trống, không có ô nhập liệu tương ứng — dành ghi tay sau khi in.
- **Tồn theo cây / Tồn kho**: xem tồn theo từng cây hoặc tổng hợp theo mã vải, có cảnh báo khi tồn dưới mức tối thiểu đã khai báo. Ô tìm kiếm hỗ trợ **gõ bất kỳ ký tự để lọc toàn bảng (v5.1: đã mở rộng lọc theo cả mã cây/mã vải/loại vải/màu, không chỉ 1 cột như trước)**. Nút **"📷 Quét QR tìm cây"** mở camera, quét xong tự lọc ra đúng cây đó — **nếu không mở được camera, hệ thống nay báo rõ lý do (v5.1)**: phổ biến nhất là do trình duyệt chặn camera khi trang không chạy qua HTTPS/`localhost` (xem cảnh báo ở Bước 2.5), còn lại mới là do người dùng chưa cấp quyền camera cho trình duyệt. Mỗi cây còn tồn có nút **"Xuất kho"** — nay sẽ mở thẳng form tạo phiếu xuất với cây đó đã chọn sẵn (do tab Xuất kho đã đổi thành danh sách — v5.1). **Từ v5.4**, cả 2 màn hình (Tồn kho tổng hợp và Tồn theo cây) có thêm cột **STT**; bấm vào ô Trạng thái, Mã vải, Loại vải, hoặc Màu ở bất kỳ dòng nào sẽ mở **popup danh sách các cây vải liên quan** (STT/Mã cây/Mã vải/Loại vải/Màu/KG nhập/KG còn/Trạng thái/Ngày nhập) — tiện tra nhanh không cần gõ lại ô tìm kiếm.
- **Định mức & Hao hụt**: khai báo định mức KG vải/sản phẩm theo mã hàng + tỷ lệ hao hụt cho phép; báo cáo tự đối chiếu KG đã cấp thực tế với KG lý thuyết, gắn cờ "Vượt định mức" khi vượt tỷ lệ cho phép.
- **In tem theo ngày nhập**: chọn ngày nhập kho → tải danh sách toàn bộ cây vải nhập ngày đó → in tem hàng loạt, khổ giấy A6, mỗi tem 1 trang riêng, chọn hướng in dọc hoặc ngang (mỗi tem gồm mã cây, mã QR, loại vải/màu, KG nhập, ngày nhập). **Từ v5.1, mã QR và chữ in to hơn hẳn (chiếm khoảng 80% khổ giấy thay vì một ô nhỏ ở giữa)** để dễ quét/đọc hơn khi dán lên cây vải thực tế. Mục "In lại tem theo mã cây": gõ tìm 1 cây vải cụ thể (đã nhập trước đó, không cần biết ngày nhập) để in lại đúng 1 tem đó.
- **Kiểm kê kho vải**: nhập KG đếm tay thực tế theo đợt; hệ thống tự lấy KG hệ thống tại thời điểm nhập để tính chênh lệch, lưu lại lịch sử các đợt kiểm kê trước.

### 10.3 Thẻ kho hàng hóa
- **Tạo thẻ kho**: chọn **Nguồn hàng** *(đổi tên từ "Loại hàng" — v5.4, xem danh mục "Loại hàng" MỚI và khác nghĩa ở Bước 8)* — "Nhà sản xuất" hoặc "Đặt ngoài":
  - **Nhà sản xuất**: chọn 1 đơn hàng sản xuất có sẵn trong hệ thống → hệ thống **tự gợi ý tên hàng, mã hàng (lấy từ mã rập của đơn, tự thêm hậu tố nếu trùng mã đã có), và các màu chính đã khai báo cho đơn đó**; bạn có thể chỉnh lại trước khi lưu. **Từ v5.1**, với loại hàng này: danh sách màu **chỉ còn đúng các màu đã chọn ở công đoạn ra lệnh sản xuất** (không đổi được sang màu khác ngoài danh sách đó), nút **"+ Thêm màu" bị ẩn** (không cho thêm màu ngoài danh sách), và ô **"Số cắt" tự điền theo số liệu công đoạn Cắt của đơn hàng và bị khóa không sửa tay được** — đảm bảo số liệu Thẻ kho luôn khớp với thực tế đã cắt, không lệch do gõ tay nhầm. *(Lưu ý: các ràng buộc này chỉ áp dụng khi **Tạo mới** — khi Sửa 1 thẻ kho Nhà sản xuất đã có sẵn, màu/số cắt vẫn sửa được tự do như trước, để không chặn việc chỉnh sửa dữ liệu cũ nếu cần.)* **Từ v5.4**, ghi nhận tiến độ "Kho nhập" **không còn tự động tạo thẻ kho này nữa** nếu chưa có (khác mọi bản trước) — phải tạo thủ công trước qua "Tạo thẻ kho mới"; sau khi đã tồn tại, thẻ kho vẫn **tự động được cộng thêm số lượng mỗi khi đơn hàng đó ghi nhận tiến độ "Kho nhập"** (xem Bước 10.1) như trước, không cần cập nhật tay. Nếu tạo thẻ kho SAU KHI đã có sẵn tiến độ Kho nhập cho đơn đó, ô "Nhập" sẽ tự điền và khóa theo đúng số liệu đã ghi (giống cơ chế ô "Số cắt").
  - **Đặt ngoài**: khai báo tay đơn vị tính chính + đơn vị quy đổi (VD 5 Cái = 1 Ri), và các màu (không giới hạn, thêm màu tự do như trước).
  - Cả 2 loại: có thể tải **ảnh đại diện chung** cho mã hàng và **ảnh riêng cho từng dòng màu**.
- **Từ v5.4**: có thể chọn thêm **"Loại hàng"** (danh mục mới, xem Bước 8, VD "Quần bé trai") — tùy chọn, dùng để lọc trong danh sách và Catalogue. Mã hàng nào **tổng tồn kho ≤ 0** hiện dòng màu đỏ kèm nhãn "Hết hàng"/"Âm kho" trong danh sách nội bộ này (Catalogue công khai không đổi, vẫn tự ẩn mã hết hàng như từ v4.0).
- **Lịch sử theo mã hàng**: bấm vào mã hàng để xem **chi tiết tồn theo từng màu** (nhập/xuất/tồn, hiển thị song song đơn vị cơ bản và đơn vị quy đổi, VD "23 Cái (4 Ri dư 3 Cái)"), cùng lịch sử đơn khách đặt hàng như trước. **Từ v5.1**: bảng chi tiết theo màu có thêm **cột Ảnh** (bấm vào ảnh để phóng to xem rõ), và mỗi dòng màu có nút **"Đặt hàng"** mở form **đặt hàng nhanh** — cố định đúng mã hàng + màu của dòng đó, cho phép khai báo **nhiều khách hàng cùng lúc** (mỗi khách 1 dòng tên + số lượng + đơn vị), hệ thống ghi lần lượt từng khách và đối chiếu tồn kho chính xác giữa các khách (khách sau sẽ thấy đúng tồn còn lại sau khi trừ cho khách trước, không cho vượt tồn dù đặt cùng lúc). **Từ v5.4**: ảnh đại diện chung ở đầu trang chi tiết cũng bấm phóng to được (giống ảnh theo màu); đóng ảnh phóng to (dù là ảnh đại diện hay ảnh theo màu) đều quay lại đúng màn hình Chi tiết mã hàng đang xem, không mất ngữ cảnh.
- **Đơn khách đặt hàng**: lên đơn theo mã hàng + màu + số lượng (Cái hoặc Ri), hệ thống tự trừ vào tồn kho; có thể chuyển trạng thái Chờ xử lý → Đã giao / Đã hủy (hủy đơn sẽ hoàn lại số lượng vào tồn kho). **Từ v5.1**: ô "Mã hàng" chỉ liệt kê **mã còn tồn kho > 0** (mã đã hết hàng sẽ không hiện ra để tránh lên đơn nhầm); sau khi chọn 1 mã hàng, ô "Màu" ở cùng dòng tự lọc lại chỉ còn **đúng những màu thuộc mã hàng đó** (trước đây hiện toàn bộ màu trong danh mục, dễ chọn nhầm màu không thuộc mã hàng).

### 10.4 Quản lý phụ kiện

Quản lý mác, thẻ bài, chun, dây rút, dây cổ... theo ledger nhập/xuất (giống cơ chế Kho vải), thay cho cách lưu 1 dòng phẳng của bản Apps Script gốc. Có 5 tab:

- **Phiếu Nhập** *(nay là màn hình danh sách — v5.1)*: vào tab hiện **danh sách các phiếu nhập đã tạo** (ngày, nhà cung cấp, số hóa đơn, số dòng phụ kiện, tổng số lượng, người tạo), có Xem/In, Sửa (chỉ sửa thông tin đầu phiếu, không sửa lại danh sách phụ kiện/số lượng), Xóa theo phân quyền. Nút **"+ Tạo phiếu nhập"** mở form nhiều dòng: ngày, nhà cung cấp, số hóa đơn — không cần/không có ô gắn đơn hàng sản xuất (phiếu Nhập không liên quan đơn hàng). **Từ v5.1**, mỗi dòng phụ kiện có thêm ô **"Loại PK"** — chọn 1 loại xong, ô "Phụ kiện" ngay bên cạnh tự lọc chỉ còn phụ kiện thuộc loại đó (dễ tìm hơn khi danh mục phụ kiện dài); có nút **"+ Thêm loại PK"** ngay tại form nếu loại cần dùng chưa có trong danh mục, không phải thoát ra khai báo riêng. **Từ v5.4**: form có thêm ô **"Ngày hóa đơn"** (nhập tay, độc lập với ngày lập phiếu) và mỗi dòng phụ kiện có thêm ô **"Đơn giá"** — theo đúng mẫu in `mau_phieu.docx`; bản in phiếu nhập đã dựng lại khớp mẫu này (cột Loại PK/Đơn giá, 2 vai ký Người lập/Thủ kho).
- **Phiếu Xuất** *(nay là màn hình danh sách — v5.1)*: tương tự Phiếu Nhập — danh sách phiếu xuất đã tạo kèm Xem/In/Sửa/Xóa theo phân quyền. Nút **"+ Tạo phiếu xuất"** mở form: ngày, tuỳ chọn **gắn với 1 đơn hàng sản xuất có sẵn trong hệ thống** (dùng khi xuất phụ kiện kèm đơn hàng — số liệu tự hiện trong "In phiếu" của đơn hàng đó, xem Bước 10.1) hoặc nhập mã đơn/ghi chú tự do nếu đơn không có trong hệ thống. **Từ v5.1**: khi đã chọn 1 đơn hàng, ô "Phụ kiện" ở mọi dòng tự lọc **chỉ còn phụ kiện đã được chỉ định NPL** cho đúng đơn đó (khai báo ở công đoạn ra lệnh sản xuất, xem Bước 10.1) — tránh xuất nhầm phụ kiện không thuộc đơn; nếu đơn hàng chưa được chỉ định NPL nào, hệ thống báo rõ và gợi ý vào "Chỉ định NPL" trước. **Từ v5.4**: bản in phiếu xuất đã dựng lại khớp mẫu `mau_phieu.docx` — thêm cột **"SL theo chỉ định"** (lấy từ số lượng đã chỉ định NPL cho đơn) cạnh SL thực tế, và 4 vai ký (Người lập/Bộ phận cắt/NV chỉ định NPL/Thủ kho) thay vì 2 như trước.
- **Thẻ kho / Tồn kho**: gõ mã hoặc tên để xem chi tiết từng lần nhập/xuất và tồn cuối luỹ kế theo đúng mã đó, hoặc để trống để xem tổng hợp tồn kho toàn bộ danh mục (có thể lọc theo loại). Cảnh báo "Âm kho" nếu tồn kho tính ra âm. **Bấm nút "Lịch sử" ngay tại danh mục phụ kiện (v4.0) sẽ tự chuyển sang tab này và tra đúng mã đó.**
- **Danh mục phụ kiện**: khai báo từng mã phụ kiện cụ thể — mã, tên, loại (chọn từ danh sách có sẵn hoặc gõ loại mới ngay trong form, hệ thống tự tạo loại nếu chưa có), size (nếu phụ kiện có nhiều size như mác quần 80–170), đơn vị tính cơ bản (VD Cái, Bó), đơn vị quy đổi và tỷ lệ quy đổi tuỳ chọn (VD 1 Bó = 0,18 Kg, dùng khi cân theo KG thay vì đếm cái).
- **Loại phụ kiện**: xem danh sách loại đã có (Dây cổ, Mác Áo, Mác Quần, Chun, Thẻ bài — dữ liệu mẫu) và thêm loại mới trực tiếp nếu cần, không bắt buộc phải thêm qua đây vì form Danh mục phụ kiện đã hỗ trợ tạo loại mới luôn.

> Lưu ý: nếu cùng 1 mã phụ kiện được xuất bằng nhiều đơn vị tính khác nhau ở các phiếu khác nhau (VD lần xuất theo Cái, lần khác theo Bó), báo cáo tổng hợp và báo cáo "Phụ kiện xuất kèm đơn hàng" sẽ liệt kê thành các dòng riêng theo từng đơn vị thay vì tự quy đổi cộng chung — quy đổi thủ công nếu cần đối chiếu tổng số lượng thực.

### 10.5 Catalogue công khai (mới, v4.0)

Trang `catalogue.html` (VD truy cập tại `http://<địa-chỉ-máy-chủ>:3000/catalogue.html`) hiển thị các mã hàng trong **Thẻ kho hàng hóa** đang **còn tồn kho > 0**, kèm ảnh đại diện, các màu còn hàng, và giá bán — **không cần đăng nhập**, dùng để gửi link trực tiếp cho khách hàng xem trên điện thoại hoặc máy tính.

- **Từ v5.4**: bấm vào ảnh đại diện hoặc ảnh theo từng màu để phóng to xem rõ hơn; thêm dropdown lọc theo **"Loại hàng"** (dùng kèm dropdown "Thẻ kho" và ô tìm kiếm đã có từ v5.3).
- Không cần cấu hình gì thêm — trang tự đọc dữ liệu từ Thẻ kho hàng hóa hiện có.
- Mã hàng nào tồn kho về 0 sẽ **tự động biến mất khỏi Catalogue** (không cần ẩn tay).
- Vì trang này công khai, **không hiển thị** thông tin nội bộ (số lượng nhập/xuất, đơn hàng sản xuất liên kết, ghi chú...) — chỉ hiển thị đúng những gì khách hàng cần thấy.
- Nếu muốn tạm ẩn hoàn toàn trang này (VD chưa muốn công khai), có thể yêu cầu bên kỹ thuật chặn route `/api/public` và `/catalogue.html` ở tầng reverse proxy/firewall — bản thân ứng dụng không có công tắc ẩn/hiện qua giao diện.

---

## PHẦN D — BẢO TRÌ & SAO LƯU

- **Sao lưu database định kỳ**: trong SSMS, chuột phải database `QLNoiBo` → Tasks → Back Up... → lưu file `.bak` ra ổ đĩa khác hoặc cloud. Nên đặt lịch tự động (SQL Server Agent, chỉ có ở bản không phải Express) hoặc chạy tay hàng tuần.
- **Sao lưu ảnh upload**: thư mục `backend/uploads/` chứa toàn bộ ảnh sản phẩm/thẻ kho — sao lưu cùng lúc với database.
- **Cập nhật code**: thay file trong `backend/` hoặc `frontend/`, chạy lại `pm2 restart qlnoibo` (nếu đổi backend) — frontend là file tĩnh nên chỉ cần tải lại trang trình duyệt.

---

## PHẦN E — NHẬT KÝ CẬP NHẬT (CHANGELOG)

### v5.34 — Giai đoạn A (bản hiện tại — nhánh QLSX) — Đổi tên "Chỉ định sản xuất" + Bảng kê bán thành phẩm

- Tab "Ra lệnh sản xuất" → **"Chỉ định sản xuất"** (mục 1).
- Chức năng mới **"Bảng kê bán thành phẩm"** (tab QLSX, mục 3): grid Size (thêm tự do) × màu chính từ Cắt; số lớp tự điền = tổng "SL lớp" cây Chính theo màu (cộng dồn); Tổng cộng; Xem/In; Tạo/Áp mẫu. Bảng `BangKeBanThanhPham` (lưu lưới JSON).
- DB: `migration_v534.sql`. Backend `bangke.js` (mới) + `server.js`. Frontend `module.bangkebtp.js` (mới) + `module.qlsx.js` + `index.html`. Xem Bước 2.42.
- **Đang làm tiếp (Giai đoạn B, C):** mục 4 (Tài liệu may/Đóng gói), mục 5 (bỏ khối khỏi Kỹ thuật), mục 6 (công đoạn May theo đơn giá mới + lương SL×Thành tiền), mục 7 (Tài liệu in thêu).

### v5.33 — Cờ "Có in thêu" + chỉ thấy công đoạn phụ trách + khống chế SL May

- **Cờ "Có in thêu"** (Ra lệnh SX, cột `DonHangSanXuat.CoInTheu`): đơn không in thêu bỏ qua công đoạn Giao/Nhận in thêu (Cắt → Giao gia công).
- **Chỉ thấy công đoạn phụ trách**: dropdown Công đoạn (Ghi nhận tiến độ) lọc theo `UserCongDoan` (`currentUser.congDoanIds`); chưa gán = thấy hết; admin thấy hết. (Trước đây thấy mọi công đoạn — nay khôi phục "chỉ thấy công đoạn mình phụ trách".)
- **Ẩn công đoạn in thêu cũ trùng** (GNIT/NNIT) khỏi dropdown. **May**: khống chế tổng SL giao/công đoạn ≤ tổng SL cắt màu chính.
- DB: `migration_v533.sql`. Backend `qlsx.js`, frontend `module.qlsx.js`. Xem Bước 2.41.

### v5.32 — In thêu thành 2 công đoạn (Giao/Nhận), bỏ 2 tab

- "Giao/Nhận nhà in thêu" từ 2 tab → **2 công đoạn** GIT/NIT trong Ghi nhận tiến độ, chèn **sau Cắt, trước Giao gia công**. Mỗi đơn chọn **nhiều nhà in thêu** + **SL giao** + **SL nhận**; công đoạn Giao hiện tổng SL bàn cắt màu chính. Bỏ 2 tab cũ (route/hàm cũ mồ côi).
- DB: `migration_v532.sql` (bảng `DonHangNhaInTheu` + công đoạn GIT/NIT). Backend `qlsx.js` (CRUD `/inthe`), frontend `module.qlsx.js`. Xem Bước 2.40.

### v5.31 — Fix lỗi tạo đơn (GhiChu) + Kiểu vải phiếu xuất kho + luồng công đoạn

- **FIX** "Invalid column name 'GhiChu'" khi lưu lệnh SX (DB thiếu cột v5.27.1 của `DonHangChiTietVai`) — `migration_v531.sql` tự thêm cột còn thiếu.
- **Phiếu xuất kho vải**: mỗi cây thêm ô **Kiểu (Chính/Phối)** (tạo/sửa/xem/in) — cột `PhieuXuatVaiChiTiet.KieuVai`.
- **Bỏ công đoạn cũ GNGC/NNGC** khỏi dropdown Ghi nhận tiến độ (đã thay bằng GC/NGC) — ẩn ở code, không xóa DB. **Luồng**: gia công ngoài → NGC → **QC** (bỏ May + Nhặt chỉ); nhà làm → May → Nhặt chỉ.
- DB: `migration_v531.sql`. Backend `qlsx.js`/`khovai.js`/`vaiXuatService.js`, frontend `module.qlsx.js`/`module.khovai.js`. Xem Bước 2.39. *(Chưa làm: in thêu thành công đoạn + bỏ 2 tab — chờ chốt.)*

### v5.30 — Gia công theo hạng mục + công đoạn "Nhận gia công" + In thêu tổng SL

- **Kỹ thuật**: "Đơn giá Giao gia công" bỏ cột **Hệ số**. **Giao gia công (GC)**: chọn hạng mục gia công (đơn giá từ Kỹ thuật, chỉ xem) → thêm **nhiều nhà + SL** cho từng hạng mục.
- **Công đoạn mới "Nhận gia công" (NGC)** sau GC: hiện nhà đã giao + SL giao, nhập **SL nhận** từng nhà (chỉ hiện với đơn có giao gia công). **In/Nhận thêu**: thêm cột **Tổng SL (màu chính)** từ sơ đồ Cắt. **May**: nút **Xóa** cạnh Sửa (Admin). "Giao nhà gia công" riêng đã bỏ (chỉ còn trong công đoạn GC).
- DB: `migration_v530.sql` (`DonHangChiTietNhaGiaCong` +HangMucGiaCongID +SoLuongNhan; công đoạn NGC). Backend `qlsx.js`, frontend `module.qlsx.js`. Xem Bước 2.38.

### v5.29 — Hoàn tác bản gộp, trả lại 2 phiếu xuất riêng (xuất tự do)

- Theo yêu cầu: **bỏ "Phiếu xuất Vật tư"** (bản gộp v5.28), **khôi phục 2 màn hình Xuất kho vải + Phiếu xuất phụ kiện riêng như cũ**, và làm cả hai **xuất tự do** — ô "Đơn hàng sản xuất" chỉ để gắn tham khảo (tùy chọn), không lọc/ràng buộc cây vải hay phụ kiện; xuất được mà không cần đơn.
- Phiếu xuất phụ kiện: chọn đơn hàng **không còn lọc phụ kiện theo "Chỉ định NPL"** (đã bỏ từ v5.27) — luôn chọn được mọi phụ kiện.
- DB: `migration_v528_rollback.sql` (tạo lại 2 view tồn về gốc → drop 3 bảng `PhieuXuatVatTu*` → xóa Module VATTU/ChucNang/Permissions). Backend `qlsx.js`/`server.js` (bỏ tham chiếu bảng gộp) + **xóa** `routes/vattu.js`. Frontend `module.khovai.js`/`module.phukien.js`/`app.js`/`index.html` (khôi phục nút tạo + gỡ menu "Xuất vật tư") + **xóa** `module.vattu.js`. Xem Bước 2.37.
- ⚠️ Nếu đã tạo phiếu xuất vật tư thử nghiệm: dữ liệu đó mất khi rollback, tồn kho trả về trước khi xuất (đúng).

### v5.28 (đã HOÀN TÁC ở v5.29) — Gộp Phiếu xuất Vải + NPL → "Phiếu xuất Vật tư"

- Phân hệ mới **"📤 Xuất vật tư"**: 1 phiếu xuất chung **vải chính + vải phối (theo cây, KG) + phụ kiện/NPL (số lượng)**. Màu vải chính trên phiếu = khóa theo dõi tiến độ Cắt/May/Kho theo màu (Cắt lấy cây vải đã xuất từ **cả** phiếu cũ lẫn phiếu mới).
- Gộp kiểu **Option 1 (bảng mới)**: `PhieuXuatVatTu` + `PhieuXuatVatTuVai` + `PhieuXuatVatTuPhuKien`; 2 view tồn (`vw_TonCayVai`, `vw_TonKhoPhuKien`) tạo lại để cộng thêm nguồn xuất mới (phiếu cũ vẫn trừ tồn). 2 tab cũ ("Xuất kho" ở Kho vải, "Phiếu Xuất" ở Phụ kiện) đổi thành **"(cũ)" chỉ-xem** (bỏ nút tạo mới), route/dữ liệu giữ nguyên.
- DB: `migration_v528.sql`. Backend `vattu.js` (mới) + `qlsx.js` + `server.js`. Frontend `module.vattu.js` (mới) + `module.khovai.js` + `module.phukien.js` + `app.js` + `index.html`. Xem Bước 2.37.

### v5.27 — Sửa Ra lệnh SX + bỏ Chỉ định vải/NPL

- **Ra lệnh SX**: bỏ ô "Mã SP" (hiện Mã ĐH tự sinh); khách hàng có nút "+ Mới" (kèm SĐT + địa chỉ); NV thiết kế/ra rập chọn từ danh sách nhân viên (HRM) hoặc gõ tự do; **loại vải + màu gõ tự do** (v5.27.1 — chỉ tham khảo; theo dõi per-màu lấy từ cây vải đã xuất); mỗi hàng màu chính có cột ghi chú; ảnh màu **dán được (Ctrl+V)**.
- Bỏ chức năng **"Chỉ định vải SX"** (+ nới cổng Phiếu xuất kho vải: liệt kê mọi đơn, chọn mọi cây vải còn tồn — không còn ràng buộc theo lệnh SX) và **"Chỉ định NPL"** (tab TLKT). Dữ liệu nền + ChucNang giữ mồ côi.
- DB: `migration_v527.sql` (+ cột `DonHangChiTietVai.TenLoaiVaiTuDo/TenMauTuDo/GhiChu`, `MauSacID` cho NULL). Xem Bước 2.36.

### v6.2 — Payroll Phase 3 (Lương khoán may + Bảng lương của tôi)

- **Lương khoán may** (tab trong `💰 Tính lương`): tự tổng hợp từ Ghi nhận tiến độ công đoạn May (SL từng nhân viên × đơn giá khoán công đoạn may của đơn hàng), bảng tổng hợp theo NV + chi tiết theo đơn hàng + xuất Excel. Chỉ đọc dữ liệu QLSX, không đổi schema.
- **Phân hệ mới `🧾 Bảng lương của tôi`** (MYPAY, hiện cho mọi nhân viên): mỗi người tự xem lương công nhật + khoán may của **chính mình**, lọc theo `Users.NhanVienID`. Thêm liên kết tài khoản ↔ nhân viên trong Quản lý User (`loadUserContext` trả về `nhanVienId`).
- DB: `migration_v620.sql` (seed ChucNang `luongmay` + Module MYPAY + ChucNang `luongcuatoi`; không bảng mới). Backend `payroll.js`/`users.js`/`loadUserContext.js`, frontend `module.payroll.js`/`module.mypay.js` (mới)/`module.users.js`. Xem Bước 2.35. Phase 4 (gia công ngoài + in thêu) tiếp theo.

### v6.1 — Phân hệ MỚI "Tính lương" (Payroll Phase 2)

- **Phân hệ mới PAYROLL** (`💰 Tính lương`): 3 chức năng — **Cấu hình lương** (BH/giảm trừ/giờ chuẩn/hệ số tăng ca + biểu thuế TNCN 5 bậc + công chuẩn từng tháng, tất cả cấu hình được), **Chấm công** (kết nối máy chấm công theo **IP/Port** — giao thức ZKTeco cổng 4370 — tổng hợp punch → bảng công + sửa tay), **Lương công nhật** (tính theo đúng công thức file lương, config-driven → sửa tạm ứng → chốt → **xuất Excel** + **xuất file chuyển khoản CK** mẫu BIDV).
- DB: `migration_v610.sql` — `CauHinhLuong`, `CongChuanThang` (seed 2026), `BacThueTNCN` (5 bậc), `MayChamCong`, `NhanVien.MaChamCong`, `ChamCongRaw`, `ChamCongNgay`, `BangLuong`+`BangLuongChiTiet`; seed Module PAYROLL + 3 chức năng. Backend `routes/payroll.js` (engine + xuất Excel/CK + kéo dữ liệu máy chấm công qua `node-zklib`), frontend `module.payroll.js`. Cần `npm install node-zklib` nếu dùng máy vân tay. Xem Bước 2.34.
- Lương công nhật lấy Lương CB + phụ cấp từ **hợp đồng hiệu lực** (HRM) + tổng công từ **Chấm công**. Thưởng doanh thu + gộp tăng ca vào thực lĩnh: bật ở phiên bản sau. Các mô hình lương khoán may / gia công / in thêu: Phase 3-4.

### v6.0 — Phân hệ MỚI "Quản lý nhân sự" (HRM Phase 1)

- **Phân hệ mới HRM** (`👥 Quản lý nhân sự`): 5 chức năng — Hồ sơ nhân sự (mở rộng bảng `NhanVien` đã có, tự sinh Mã NV `NVxxx`, không tạo bảng trùng), Hợp đồng lao động, Phụ lục hợp đồng, Quyết định nhân sự, Thanh lý hợp đồng. Mỗi văn bản in được theo mẫu chuẩn (Cty TNHH Thời Trang MOYN). Tạo Thanh lý tự chuyển nhân viên sang "Đã nghỉ việc".
- DB: `migration_v600.sql` — +17 cột hồ sơ trên `NhanVien`, `Users.NhanVienID`, 4 bảng văn bản, seed Module/ChucNang/Permissions (mặc định chỉ Admin thấy). Backend `routes/hrm.js`, frontend `module.hrm.js`. Đây là **Phase 1** của bộ HRM+Payroll; phần **Tính lương** (công nhật/khoán may/gia công/in thêu + bảng lương tổng + xuất CK) ở các Phase kế tiếp. Xem Bước 2.33.

### v5.26

- **Quản lý sản xuất**: xóa hẳn tab **"Nhận nhà gia công"** (v5.24/v5.25) — không còn tab/chức năng riêng nào cho nghiệp vụ nhà gia công nữa. Toàn bộ nay chỉ còn ở công đoạn **"Giao gia công"** (nhập, giữ nguyên thiết kế hiện tại — không đổi) + báo cáo "Lịch sử cập nhật tiến độ" khi in lệnh sản xuất (xem lại, đã có từ v5.25).
- Dropdown "Công đoạn" trong Ghi nhận tiến độ: người có quyền **Sửa/Xóa** lệnh sản xuất (hoặc admin) nay **luôn thấy "May"**, kể cả với đơn chỉ gia công ngoài — người chỉ có quyền Ghi nhận tiến độ vẫn bị ẩn như cũ.
- `ChucNang` 'nhannhagiacong' mồ côi (giữ nguyên, không xóa dòng khai báo), giống 'giaonhagiacong' đã mồ côi từ v5.24. Không có migration mới. Xem Bước 2.32 để biết chi tiết đầy đủ.

### v5.25

- **Quản lý sản xuất**: sửa lỗi thật — tab "Đơn giá gia công" (v5.24) chưa từng có màn hình, bấm vào sẽ lỗi; hàm dựng "Đơn giá Giao gia công" tại Kỹ thuật cũng ẩn mất nút "+ Mới" khi danh mục rỗng, nghĩa là không tạo được hạng mục đầu tiên. Bỏ hẳn tab "Đơn giá gia công" theo đúng yêu cầu — đơn giá khai báo trực tiếp tại Kỹ thuật, nút "+ Mới" nay luôn bấm được.
  > **Lưu ý**: tab "Nhận nhà gia công" (màn hình chỉ xem) mô tả ở đây đã **bỏ hẳn** ở v5.26 — nghiệp vụ nhà gia công nay chỉ còn ở công đoạn "Giao gia công" + báo cáo "Lịch sử cập nhật tiến độ".
- Xác nhận "Giao nhà làm" → chuyển May bình thường (không đổi code); "Nhận nhà gia công" thêm lại vào báo cáo "Lịch sử cập nhật tiến độ" (đọc từ Nhà gia công chi tiết còn sống) theo yêu cầu "chức năng riêng vẫn phải cập nhật vào trong theo dõi lệnh sản xuất".
- Không có migration mới — chỉ sửa `migration_v524.sql` tại chỗ. Xem Bước 2.31 để biết chi tiết đầy đủ + 1 lưu ý diễn giải cần người dùng xác nhận lại.

### v5.24

- **Quản lý sản xuất**: công đoạn "Giao gia công" đổi từ radio (1 chọn 1) sang **2 ô tick độc lập** "Giao nhà làm"/"Giao gia công" (chọn được cả 2) — theo phản hồi trực tiếp "có những công đoạn trùng nhau" của người dùng. Bỏ hẳn ô "Nhà gia công (đại diện)" + tab riêng **"Giao nhà gia công"**; việc gán nhà gia công (chọn nhà + đơn giá + **số lượng mới**) giờ chỉ làm tại công đoạn này. "Nhận nhà gia công" viết lại thành **màn hình chỉ xem** (bỏ nút "Ghi nhận" + cột "Tổng đã nhận"). Kỹ thuật thêm mục mới "Đơn giá Giao gia công" (danh mục nhiều dòng, mirror "Đơn giá công đoạn may").
  > **Lưu ý**: tab "Đơn giá gia công" mô tả ở đây thực ra **chưa từng hoạt động** (thiếu màn hình, lỗi ẩn nút "+ Mới") — đã **bỏ hẳn** ở v5.25, đơn giá khai báo thẳng tại Kỹ thuật.
- `DonHangSanXuat.KenhSanXuat` mồ côi, thay bằng 2 cột BIT `DaGiaoNhaLam`/`DaGiaoGiaCong`; bảng mới `HangMucGiaCong`/`DonHangHangMucGiaCong`; `DonHangChiTietNhaGiaCong` thêm cột `SoLuong`. Xem Bước 2.30 để biết chi tiết đầy đủ + trình tự kiểm thử.

### v5.23

- **Quản lý sản xuất**: sửa lại **vị trí** toggle "Kênh sản xuất" (Giao nhà làm/Giao gia công) theo phản hồi trực tiếp của người dùng — chuyển từ công đoạn Kỹ thuật (thiết kế v5.21) sang **1 công đoạn thật mới "Giao gia công"** (mã `GC`), đứng ngay sau Cắt, trước May. Kỹ thuật từ nay chỉ còn Sơ đồ + chọn công đoạn may; May đổi bảng "Công đoạn may đã chọn" từ sửa được sang **chỉ đọc** (đơn giá/hệ số hiển thị đúng Kỹ thuật đã nhập, chỉ cột "Nhân viên & SL" còn sửa được).
  > **Lưu ý**: toggle "Kênh sản xuất" (radio) + "Nhà gia công đại diện" mô tả ở đây đã bị **thay thế** ở v5.24 bằng 2 ô tick độc lập, và tab "Giao nhà gia công" nhắc tới ở Bước 2.29 mục 6 đã bị **xóa hẳn**. Đoạn changelog gốc dưới đây giữ nguyên để tham khảo lịch sử thiết kế.
- Không đổi schema, chỉ thêm 1 dòng danh mục `CongDoanSanXuat` (GC). Xem Bước 2.29 để biết chi tiết đầy đủ + trình tự kiểm thử.

### v5.22

- **Quản lý sản xuất**: "Giao nhà gia công"/"Nhận nhà gia công" (GNGC/NNGC) không còn là công đoạn thật trong Ghi nhận tiến độ nữa — đảo ngược đúng cách v5.21 đã làm cho Giao/Nhận nhà in thêu (mục 1.1); đơn ở kênh "Giao gia công" không còn hiện công đoạn "May" trong ô chọn Ghi nhận tiến độ (mục 1.2); xác nhận "1 công đoạn may giao được nhiều nhân viên" vẫn hoạt động đúng (mục 1.3, đã có sẵn); 2 tab "Giao/Nhận nhà gia công" xây lại theo mô hình chọn lệnh sản xuất trước rồi mới quản lý nhà gia công (mục 1.4).
  > **Lưu ý**: mục 1.2 mô tả toggle "Kênh sản xuất" đặt tại Kỹ thuật — vị trí này đã bị **sửa lại** ở v5.23 (chuyển sang công đoạn "Giao gia công" mới, đứng sau Cắt). Đoạn changelog gốc dưới đây giữ nguyên để tham khảo lịch sử thiết kế.
- Không có bảng/cột mới — dùng lại toàn bộ schema từ v5.19/v5.21. Xem Bước 2.28 để biết chi tiết đầy đủ + trình tự kiểm thử.

### v5.21

- **Quản lý sản xuất**: Danh mục "Đơn vị quy đổi" mới (nhiều cặp đơn vị chính/quy đổi, mục 1); dòng "Tổng cộng" ở Cấu trúc vải sửa lại đúng bản chất (nhân/chia theo đơn vị quy đổi thay vì luôn chia, mục 2); Kỹ thuật thêm toggle tường minh "Giao nhà làm"/"Giao gia công" tách khỏi việc chọn nhà gia công cụ thể (mục 3); "Nhận nhà gia công" chỉ hiện nhà đã thực sự được giao (mục 5); sửa lỗi "Tổng SL cắt" chỉ cộng 1 bàn thay vì tất cả các bàn (mục 7); Giao/Nhận nhà in thêu tách thành 2 chức năng độc lập, không còn là công đoạn trong Ghi nhận tiến độ (mục 8).
- **Kho vải**: Phiếu xuất kho vải yêu cầu lại Chỉ định vải SX trước khi hiện trong danh sách chọn; hiện số lượng chỉ định riêng từng màu; in phiếu lấy đúng cột "Kg chỉ định" (mục 6).
- Xem Bước 2.27 để biết chi tiết đầy đủ + trình tự kiểm thử.

### v5.20

- **Định nghĩa lại toàn bộ luồng Ghi nhận tiến độ sản xuất**: Ra lệnh SX → Tài liệu KT → Kỹ thuật → Chỉ định vải SX → Xuất vải → Cắt → Chỉ định phụ kiện → Xuất phụ kiện → Giao nhà in thêu → Nhận nhà in thêu → Giao nhà gia công → Nhận nhà gia công → May → Nhặt chỉ → QC → Là → Đóng gói → Kho nhập. 4 công đoạn thật sự mới (Giao/Nhận nhà in thêu, Giao/Nhận nhà gia công — tự động bỏ qua nếu đơn không dùng dịch vụ tương ứng) + 3 công đoạn đơn giản mới (Nhặt chỉ/QC/Là). "Hoàn thiện" ngừng hoạt động (giữ lại lịch sử); Đóng gói chuyển ra trước Kho nhập.
  > **Lưu ý**: 4 công đoạn "Giao/Nhận nhà in thêu"/"Giao/Nhận nhà gia công" mô tả ở đây đã bị **rút lại hoàn toàn** ở v5.21 (nhà in thêu) và v5.22 (nhà gia công) trước khi migration này từng được triển khai — bản deploy thực tế sẽ theo đúng Bước 2.27/2.28, không tạo 4 công đoạn này nữa. Đoạn changelog gốc dưới đây giữ nguyên để tham khảo lịch sử thiết kế.

- **Định nghĩa lại toàn bộ luồng Ghi nhận tiến độ sản xuất**: Ra lệnh SX → Tài liệu KT → Kỹ thuật → Chỉ định vải SX → Xuất vải → Cắt → Chỉ định phụ kiện → Xuất phụ kiện → Giao nhà in thêu → Nhận nhà in thêu → Giao nhà gia công → Nhận nhà gia công → May → Nhặt chỉ → QC → Là → Đóng gói → Kho nhập. 4 công đoạn thật sự mới (Giao/Nhận nhà in thêu, Giao/Nhận nhà gia công — tự động bỏ qua nếu đơn không dùng dịch vụ tương ứng) + 3 công đoạn đơn giản mới (Nhặt chỉ/QC/Là). "Hoàn thiện" ngừng hoạt động (giữ lại lịch sử); Đóng gói chuyển ra trước Kho nhập.
- Đã xóa hẳn màn hình "Giao/nhận nhà gia công & nhà in" cũ (nút 🚚, `openVendorForm`) khỏi Danh sách lệnh sản xuất — thay bằng chính 4 công đoạn mới ở trên; phân quyền theo công đoạn dùng lại cơ chế UserCongDoan có sẵn (không cần tab/ChucNang mới).
- **Kho vải**: đã sửa khoảng trống phát hiện từ v5.19 — bỏ hẳn điều kiện chặn "chưa được giao vải sản xuất" (cơ chế "Giao vải" cũ); Phiếu xuất kho vải nay xác định cây vải cho phép xuất bằng cách khớp trực tiếp Loại vải/Màu từ Chỉ định vải SX/Cấu trúc vải.
- Xem Bước 2.26 để biết chi tiết đầy đủ + giả định thiết kế + trình tự kiểm thử (khuyến nghị thử trên bản sao database trước — đợt thay đổi sâu nhất vào luồng lõi từ trước tới nay).

### v5.19

- **Quản lý sản xuất**: Nhà gia công chi tiết thêm Đơn giá (mục 1.1.1); 2 chức năng con mới "Giao nhà gia công"/"Nhận nhà gia công" — sổ ghi chép SL/đơn giá/ghi chú/ngày theo từng nhà gia công, dùng tính lương (mục 1.1.2); sửa lỗi đơn vị "Tổng cộng" (phép nhân sai → chia lấy thương/dư đúng) ở In lệnh sản xuất + Ra lệnh sản xuất, bỏ mục "Số lượng" thừa (mục 1.2/1.3); chức năng con mới "Chỉ định vải SX" — khai KG vải yêu cầu theo Loại vải/Màu, tách Chính/Phối (mục 1.4).
- **Thẻ kho hàng hóa**: Báo giá Aloha thêm chức năng Sửa (mục 2.1); ảnh đại diện trong Excel co giãn theo kích thước ô (`editAs: 'twoCell'`, mục 2.2).
- **Kho vải**: Xuất kho vải theo đơn hàng hiện thêm dòng tham khảo KG yêu cầu/đã xuất theo Chỉ định vải SX (mục 3.1).
- **Toàn hệ thống**: thêm Xuất Excel cho Tồn kho vải, Tồn theo cây, Thẻ kho hàng hóa, Tồn kho phụ kiện (mục 4); thêm cột "Số phiếu" cho mọi danh sách phiếu nhập/xuất kho vải/phụ kiện (mục 5).
- Xem Bước 2.25 để biết chi tiết đầy đủ + giả định thiết kế (đặc biệt mục 1.1.2 về việc giữ nguyên màn hình Giao/nhận nhà gia công cũ) + 1 phát hiện phụ chưa sửa (cơ chế "Giao vải" cũ ở Phiếu xuất kho vải đã mất đường nhập liệu từ v5.18) — **đã sửa ở v5.20**.

### v5.18.1

- **Vá lỗi**: ảnh đại diện không nhúng được vào cột "Hình ảnh sp" khi xuất Excel Báo giá Aloha (v5.18) — nguyên nhân là giả định sai về định dạng lưu trữ của `AnhDaiDien` (tưởng là chuỗi ảnh nhúng sẵn, thực tế là đường dẫn tới file trên đĩa `backend/uploads/`). Đã sửa `anhToPngBuffer()` để đọc đúng file từ đĩa. Không có migration/thư viện mới — chỉ thay `backend/routes/khohang.js` — xem Bước 2.24.

### v5.18

- **Danh sách lệnh sản xuất**: sửa lỗi user chỉ có quyền "Xem" (không gán công đoạn) bị hiện danh sách rỗng — nay thấy toàn bộ đơn hàng.
- **Ghi nhận tiến độ**: bỏ 2 công đoạn "Chỉ định phụ kiện" và "Giao vải" khỏi ô chọn (không xóa khỏi danh mục). Công đoạn "Cắt" nay **bắt buộc** đơn hàng đã có Phiếu xuất kho vải mới ghi nhận được; cây vải đưa vào Cắt lấy từ Phiếu xuất kho vải thật (không còn "giao tạm") và phải **chủ động chọn** (gõ tìm mã cây) thay vì tự hiện sẵn. Đơn hàng ≥ 2 sơ đồ đổi sang **1 ô chọn sơ đồ + 1 khu vực nhập liệu** (thay vì N khối xếp chồng của v5.16).
- **Báo giá Aloha**: Danh sách báo giá thêm nút "Xem/In"; Excel xuất ra nhúng ảnh đại diện thật vào cột "Hình ảnh sp" — ảnh được chuẩn hóa qua `sharp` thành PNG trước khi nhúng (nhận mọi định dạng phổ biến, không chỉ PNG/JPEG/GIF), không làm giảm chất lượng ảnh.
- Không có thay đổi schema — chỉ cập nhật dữ liệu (đơn hàng đang ở Giao vải/Chỉ định phụ kiện được chuyển sang Cắt) — xem `migration_v518.sql` + Bước 2.23. Thêm thư viện `sharp` (native, cần `npm install` sau khi cập nhật).

### v5.17

- **Thẻ kho hàng hóa — Tạo/Sửa**: thêm 2 trường mới "Giá Aloha" và "Mã Barcode".
- **Chức năng mới "Báo giá Aloha"** (tab riêng trong phân hệ Thẻ kho hàng hóa): Tạo báo giá (chọn nhiều mã hàng, %VAT theo dòng, các trường NCC/công ty dùng chung cho cả báo giá) + Danh sách báo giá (xuất Excel theo file mẫu, xóa). Mỗi mã hàng chỉ được báo giá đúng 1 lần trong toàn hệ thống — xem Bước 2.22 để biết đầy đủ các giả định thiết kế.
- Thêm 2 cột (`TheKhoHangHoa.GiaAloha`, `TheKhoHangHoa.MaBarcode`) + 2 bảng mới (`BaoGiaAloha`, `BaoGiaAlohaChiTiet`) + thư viện `exceljs` — xem `migration_v517.sql` + Bước 2.22.

### v5.16

- **In Lệnh sản xuất**: thêm hàng "Tổng cộng" cuối bảng Cấu trúc vải, dạng "X Cái (Y Ri)". **Ra lệnh SX/Sửa lệnh SX**: dòng tổng cộng trên màn hình đổi sang cùng định dạng này.
- **Ghi tiến độ Kỹ thuật/May — "Công đoạn may đã chọn"**: đổi được công đoạn của 1 dòng đã thêm (nạp lại giá/hệ số mặc định), thêm nút "💾 Lưu công đoạn" lưu ngay không cần Gửi cả form, thêm nút "+ Mới" tạo nhanh công đoạn chưa có trong danh mục.
- **Ghi tiến độ Kỹ thuật — "Nhà gia công chi tiết"**: các dòng đã ghi nhận nay sửa được (trước chỉ Thêm/Xóa).
- **Ghi tiến độ Cắt — đơn hàng ≥ 2 sơ đồ**: tách thành N form riêng (1/sơ đồ), mỗi form tự có STT/trải vải/cắt/số lượng cây riêng, Gửi 1 lần lưu tất cả. "Tổng số bàn cắt" cộng dồn đúng qua các form + chỉ tính vải chính. Đơn hàng 0/1 sơ đồ giữ nguyên như v5.13.
- **Danh sách lệnh sản xuất → In tài liệu kỹ thuật**: màn hình chọn loại in không tự đóng sau khi in nữa.
- **Danh mục Nhân viên**: đã có sẵn cột "Mã NV" đầy đủ (không cần sửa).
- Thêm 1 cột (`TienDoSanXuat.NhomTienDoID`) — xem `migration_v516.sql` + Bước 2.21.

### v5.15

- **Danh sách lệnh sản xuất — thêm nút "In tài liệu KT"**: in Tài liệu kỹ thuật (cả 4 loại của v5.14) ngay từ danh sách, không cần vào tab riêng. Chọn "In tất cả" (gộp mọi loại đã có dữ liệu, tự bỏ qua loại chưa có, mỗi loại 1 trang) hoặc in đúng 1 loại — xem Bước 2.20. Thuần frontend, không có migration.

### v5.14

- **Chức năng mới "Tài liệu kỹ thuật" trong Quản lý sản xuất** — 4 chức năng con: **Tài liệu kỹ thuật chung** (theo mẫu `tieuchuankythuatchung.docx`, có Quản lý tài liệu mẫu riêng để tái sử dụng), **Thông số đo** (lưới Size × Vị trí đo theo mẫu `thongsodo.docx`), **Chỉ định NPL** (tách từ công đoạn Phụ kiện trong Ghi nhận tiến độ, dùng lại nguyên dữ liệu/API cũ), **Mô tả sản phẩm** (lưới ảnh dán/paste theo mẫu `motasanpham.docx`) — xem Bước 2.19.
- Cả 4 chức năng: lấy danh sách từ Danh sách lệnh sản xuất, mỗi đơn hàng 1 hồ sơ riêng, lưu xong có nút in (tên file tự đặt theo Mã ĐH), 3 loại tài liệu mới đều thêm/xoá được dòng và ô/cột.
- Thêm 7 bảng mới + 1 chức năng phân quyền mới (`QLSX/tailieukythuat`) — xem `migration_v514.sql`. **Lưu ý cấu hình quyền**: Chỉ định NPL gate theo quyền `tiendo` sẵn có (không phải `tailieukythuat`) — xem chi tiết ở Bước 2.19.

### v5.13

- **Ra lệnh sản xuất — bỏ "Tổng số lượng" nhập tay (tự tính từ Cấu trúc vải), thêm "Hệ số quy đổi" khai báo 1 lần dùng chung cho cả đơn hàng** — xem Bước 2.18.
- **Cấu trúc vải — thêm hàng "Tổng cộng" + số lượng sau quy đổi, thêm loại vải/màu ngay tại chỗ (không cần qua Danh mục), gõ tìm loại vải/màu, ảnh từng màu tự co giãn đúng kích thước đã tải lên**.
- **In Lệnh sản xuất — bỏ mục "Phụ kiện cần dùng (NPL)"** (giai đoạn này chưa có dữ liệu NPL thật) — phiếu Báo cáo đơn hàng không đổi, vẫn hiện đủ.
- **Ghi tiến độ Kỹ thuật — Sơ đồ đổi thành danh sách nhiều dòng + ghi chú (lưu riêng), thêm khối bổ sung "Nhà gia công chi tiết" (nhiều nhà gia công + ghi chú, KHÔNG thay ô chọn gốc), ẩn cột "Nhân viên & SL" (chỉ còn hiện ở May)**.
- **Ghi tiến độ Cắt — thêm ô chọn Sơ đồ khi đơn hàng có nhiều hơn 1 sơ đồ; Hệ số lấy thẳng từ Ra lệnh sản xuất, bỏ ô nhập tay từng cây**.
- Thêm 2 bảng (`DonHangChiTietSoDo`, `DonHangChiTietNhaGiaCong`) + 2 cột (`DonHangSanXuat.HeSoQuyDoi`, `TienDoSanXuat.SoDoID`) — xem `migration_v513.sql`. Hệ quả đã biết: phiếu Báo cáo đơn hàng sẽ hiện trống Mét sơ đồ/Khổ vải sơ đồ/Mã rập cho các lần Ghi tiến độ Kỹ thuật MỚI (dữ liệu cũ trước v5.13 không đổi) — xem chi tiết ở Bước 2.18.

### v5.12

- **Phiếu nhập kho vải — khôi phục nút "In tem các cây vừa nhập"** trên màn Xem/In 1 phiếu (đã biến mất, dùng lại nguyên hàm in tem sẵn có của tab "In tem theo ngày nhập") — xem Bước 2.17.
- **Quét QR liên tục tự thêm cây** ở Ghi tiến độ → Giao vải, và Phiếu xuất kho vải (Tạo phiếu + Sửa phiếu) — camera không tự tắt sau mỗi lần quét, mỗi cây quét được tự thêm 1 dòng, tự bỏ qua cây đã có sẵn trong danh sách. Nút quét-1-lần trên từng dòng vẫn giữ nguyên như trước.

### v5.11

- **Thẻ kho hàng hóa — ô "Ảnh đại diện chung" khi Sửa nay hiện đúng ảnh đang lưu** (trước đây hiện trống, dễ hiểu nhầm là mất ảnh dù dữ liệu vẫn còn — xem Bước 2.16). Đã rà soát: logic lưu (`ISNULL`) vốn không có lỗi, đây là fix hiển thị/xác nhận trực quan, không phải fix dữ liệu.

### v5.10

- **Danh mục — thêm ô tìm kiếm (gõ ký tự bất kỳ) cho mọi tab danh sách** — xem Bước 2.15.
- **Đóng nốt `<datalist>` nguyên sinh cuối cùng còn sót lại (Thẻ kho/Tồn kho phụ kiện)** — chuyển sang khung gợi ý tự dựng dùng chung, khớp chứa (substring).

### v5.9.1 — ƯU TIÊN CAO

- **Thẻ kho hàng hóa — sửa lỗi "Số cắt"/"Nhập" nhân lên mỗi lần Sửa**: `POST/PUT /khohang/items` nhân sai số nhập vào với Tỷ lệ quy đổi (`LoaiRi`) dù form Sửa đã điền sẵn đúng số đang lưu — mỗi lần Sửa (kể cả không đổi gì) nhân số liệu lên thêm 1 lần `LoaiRi`. **Có thể đã ảnh hưởng dữ liệu tồn kho thật đang chạy trên bản v5.0** (cột `LoaiRi` có từ schema gốc) — xem Bước 2.14 để kiểm tra và tự đối chiếu/sửa tay số liệu bị ảnh hưởng (không có cách tự động sửa an toàn vì không lưu lịch sử số lần đã bị nhân).

### v5.9

- **Công đoạn sản xuất — dứt điểm rủi ro so sánh theo TÊN công đoạn**: mọi luồng lõi (chuyển công đoạn kế tiếp, ghi nhận tiến độ, phân quyền theo công đoạn, báo cáo năng suất Cắt/Nhập kho) trước đây so sánh trực tiếp theo `TenCongDoan` (tên hiển thị, tự do sửa trong Danh mục) — đổi tên 1 công đoạn (kể cả thêm/bớt khoảng trắng) sẽ âm thầm làm gián đoạn các luồng này. Nay chuyển toàn bộ sang so sánh theo `StageID`/`MaCongDoan` (ổn định).
- **Khóa Mã công đoạn của 8 công đoạn hệ thống** (cột `LaHeThong` mới) — ngăn tình trạng vừa fix xong lại lặp lại đúng vấn đề cũ ở `MaCongDoan` thay vì `TenCongDoan`; Tên công đoạn/Thứ tự vẫn tự do sửa được kể cả với công đoạn hệ thống.
- **Danh mục → Công đoạn sản xuất**: 8 dòng hệ thống hiện thêm biểu tượng 🔒, ô Mã công đoạn chuyển readonly kèm chú thích khi sửa dòng hệ thống; chặn xóa dòng hệ thống; chặn đổi Mã công đoạn qua API trực tiếp kể cả khi bỏ qua giao diện.
- **`POST/PUT /danhmuc/congdoan` bọc try/catch**, trả thông báo rõ khi nhập trùng Mã công đoạn (hệ quả của unique index mới) thay vì lỗi máy chủ chung chung.

### v5.8

Đợt refinement thứ 8 — trọng tâm là **giải quyết dứt điểm 2 vấn đề nền tảng** đã chỉ giảm nhẹ được ở các đợt trước (in phiếu khoá tab chính, ô tìm mã cây bị trình duyệt cắt chữ) bằng cách đổi hẳn cơ chế thay vì vá thêm, cộng với việc chuyển khối "Giao việc nội bộ" sang đúng công đoạn May cho đơn Nhà Làm theo yêu cầu. Cách nâng cấp từ v5.7: xem Bước 2.12. Thêm 1 cột (`NhaGiaCong.LaNoiBo`); không đổi cấu trúc phân quyền.

- **Toàn hệ thống — in phiếu dứt điểm không khoá tab chính**: đổi hẳn từ `window.open()` (hành vi trình duyệt tự chuyển tab, JS không chặn được) sang in qua `<iframe>` ẩn ngay trong trang — áp dụng cho MỌI phiếu in (Lệnh sản xuất, Phiếu báo cáo, Phiếu nhập/xuất kho vải, Phiếu nhập/xuất phụ kiện, In tem QR hàng loạt).
- **Toàn hệ thống — ô tìm mã cây/phụ kiện hiện đầy đủ, không bị cắt chữ**: thay hẳn `<datalist>` nguyên sinh của trình duyệt (không tuỳ chỉnh được bằng CSS) bằng 1 khung gợi ý tự dựng — giữ nguyên cách gọi ở mọi nơi đang dùng, không phải sửa lại các màn hình khác. Thêm khả năng dùng phím mũi tên + Enter để chọn, Escape để đóng.
- **Ra lệnh sản xuất — hết hẳn hiện tượng giữ lại dữ liệu phiên trước**: sau khi tạo lệnh, form vừa nộp được ẩn đi (trước đây vẫn hiện nguyên bên cạnh khung kết quả, dễ gây hiểu nhầm là "chưa làm mới").
- **Ghi tiến độ — công đoạn May: bảng "Công đoạn may đã chọn cho đơn hàng này" giống hệt bảng ở Kỹ thuật (đơn Nhà Làm)**: nay hiện ngay tại bước May, **giống hệt** bảng ở Kỹ thuật — sửa được Đơn giá/Hệ số, thêm/bớt công đoạn may, chọn nhân viên + số lượng, tất cả ngay tại May (không còn là bản chỉ xem giá như bản đầu tiên của v5.8) — dùng chung 1 dữ liệu với khối ở Kỹ thuật nên sửa ở đâu cũng ra cùng kết quả, lịch sử giao việc từ cả 2 bước hiện chung 1 danh sách. Đơn giao gia công ngoài không hiện khối này (giữ nguyên như trước).
- **Ghi tiến độ — Giao vải / Kho vải — mã cây hiện đầy đủ thông tin thật sự**: hệ quả trực tiếp của việc thay `<datalist>` — nội dung (mã cây, loại vải, màu, KG còn, vị trí kho, ngày nhập) đã đầy đủ từ v5.7 nhưng bị trình duyệt tự cắt bớt chữ, nay hiện được toàn bộ.
- **Mobile — Thẻ kho hàng hóa "Lên đơn đặt hàng" VÀ "Đặt hàng nhanh" — hết gợi ý lại tên khách cũ**: thêm cờ tắt tự động điền của trình duyệt cho ô "Tên khách" ở cả 2 form (rà soát thêm phát hiện "Đặt hàng nhanh" — mở từ màn "Chi tiết mã hàng" — có cùng lỗ hổng dù không được nêu tên trực tiếp trong yêu cầu gốc).
- **Danh mục — Nhà gia công**: thêm cờ nội bộ đánh dấu chính xác dòng "Nhà Làm" (thay cho so sánh tên hiển thị) — không đổi giao diện, chỉ đổi cách hệ thống nhận diện phía sau.
- **Phiếu báo cáo đơn hàng — sửa lại định dạng "Xuất vải kèm đơn hàng"** (đính chính 1 kết luận sai của bản v5.8 gốc — xem khung cảnh báo ở Bước 2.12): dòng tóm tắt cấu trúc vải trước đây thiếu màu riêng cho từng dòng vải phối và gộp màu vải chính thành 1 cụm rời ở cuối câu — nay dùng lại đúng định dạng "Vải chính: loại - màu / Vải phối: loại - màu, ..." y hệt mục "Cấu trúc vải" ở phiếu Lệnh sản xuất.
- **Quản lý phụ kiện — form Tạo phiếu Xuất bổ sung "SL chỉ định" tham khảo cho từng phụ kiện** (phát hiện thêm sau phản hồi trực tiếp, nằm ngoài phạm vi đã rà soát ban đầu — xem khung cảnh báo ở Bước 2.12): khi tạo Phiếu Xuất có gắn kèm đơn hàng, chọn 1 phụ kiện trong danh sách nay hiện luôn số lượng đã "Chỉ định NPL" cho phụ kiện đó ngay cạnh ô "Số lượng" (dạng "— chỉ định: 50") để đối chiếu khi nhập số lượng xuất thực tế — bản in và màn xem chi tiết phiếu đã lưu đã hiện đúng thông tin này từ v5.7, nhưng form Tạo mới thì chưa từng có, vì API cấp danh sách phụ kiện cho form này chưa từng trả về số liệu này.
- **2 mục người dùng nêu ra ở batch gốc xác nhận KHÔNG cần sửa** (đã rà soát lại, đúng như hiện trạng): Kho vải xuất kho khi chưa chọn đơn hàng đã cho chọn đúng toàn bộ cây còn tồn; phần lớn màn hình "tạo mới" khác đã tự làm mới đúng cách.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", cần xác nhận lại nếu chưa đúng ý): xem đầy đủ ở khung cảnh báo trong Bước 2.12, gồm: 1 ô tìm phụ kiện độc lập ở "Thẻ kho" chưa chuyển sang cơ chế mới; cờ `LaNoiBo` chưa có giao diện tự sửa cho dòng khác ngoài "Nhà Làm" gốc; khối "Giao việc nội bộ" tự do kiểu cũ ở May đã bị gỡ bỏ hẳn (thay bằng khối mới gắn với công đoạn đã chọn ở Kỹ thuật); tính năng khôi phục nháp ở Kho vải (Xuất/Nhập kho) cố ý giữ nguyên, không tính là lỗi "giữ dữ liệu phiên trước".
- **Lưu ý kiểm thử**: đã rà soát lại toàn bộ điểm gọi của 2 cơ chế lõi bị thay thế (in phiếu, ô tìm kiếm) trên cả 4 file module liên quan. Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — đây là đợt đổi cơ chế nền tảng dùng chung ở rất nhiều màn hình, **đặc biệt khuyến nghị** kiểm thử đầy đủ theo danh sách ở Bước 2.12 trên môi trường test trước khi dùng cho dữ liệu thật.

### v5.7

Đợt refinement thứ 7 — **lớn nhất từ trước tới nay** (29 mục), trải khắp Toàn hệ thống (mở tab mới từ menu, tự động focus ô đăng nhập, in phiếu không còn khoá tab chính), **Quản lý sản xuất** (đơn giản hoá vải phối, in đúng cấu trúc vải chính/phối, sửa 3 lỗi thật ở Ghi tiến độ Kỹ thuật gồm 1 lỗi UNIQUE KEY đã xảy ra trên thực tế, thêm "Giao việc nội bộ" ngay tại Kỹ thuật, làm rõ thông tin ở Giao vải/Phụ kiện/May, bổ sung nhiều dữ liệu còn thiếu trên các phiếu in), **Danh mục** (thêm mã công đoạn), **Quản lý kho vải** (làm rõ thông tin cây vải ở ô tìm), **Quản lý phụ kiện** (thêm cột SL chỉ định trên màn hình xem), và **Mobile** (sửa lỗi quét QR không nhận, thêm ảnh sản phẩm khi lên đơn). Cách nâng cấp từ v5.6: xem Bước 2.11. Thêm 3 cột nullable (`CongDoanSanXuat.MaCongDoan`, `TienDoChiTietMau.DonViDaChon`, `TienDoSanXuat.TenNhaGiaCongTaiThoiDiem`); không đổi cấu trúc phân quyền.

- **Toàn hệ thống — mở tab mới từ menu**: mọi mục menu nay là liên kết thật (`<a href>`) — giữ Ctrl/Cmd/Shift khi bấm hoặc chuột phải chọn "Mở trong tab mới" đều hoạt động đúng, mở đúng màn hình đã bấm (không phải luôn về trang chủ). Bấm chuột trái thường vẫn chuyển màn hình ngay trong trang như trước (không tải lại trang).
- **Toàn hệ thống — tự động focus ô đăng nhập**: mở trang đăng nhập là gõ được luôn vào ô "Tên đăng nhập", không cần bấm chuột vào ô trước.
- **Toàn hệ thống — in phiếu không còn khoá tab chính**: trước đây sau khi bấm in, cửa sổ/tab chính bị trình duyệt tự chuyển focus sang tab in và "đơ" cho tới khi đóng hộp thoại in — nay tab chính vẫn dùng được ngay sau khi bấm in.
- **Ra lệnh sản xuất — vải phối đơn giản hơn**: dòng vải phối chỉ còn chọn Loại vải + Màu, bỏ 2 ô Số lượng/Đơn vị không cần thiết (số lượng phối đã được xác định tại vải chính).
- **In lệnh sản xuất — hiện đủ loại vải phối**: bảng "Cấu trúc vải" nay hiện dạng "Vải chính: loại - màu / Vải phối: loại - màu" cho từng màu phối riêng — trước chỉ gộp tên màu, làm mất thông tin nếu màu phối dùng loại vải khác màu chính.
- **Ra lệnh sản xuất — hết lỗi giữ lại dữ liệu phiên trước**: xác định nguyên nhân thật là bấm vào TIÊU ĐỀ phân hệ "Quản lý sản xuất" (chỉ xổ/cuộn menu con) chứ không phải bấm đúng mục "Ra lệnh sản xuất" — nay bấm tiêu đề phân hệ cũng làm mới luôn màn hình, hết tình trạng biểu mẫu cũ còn sót lại.
- **Ghi tiến độ — Kỹ thuật hết giật khung khi thêm công đoạn**: thêm công đoạn may thứ 2 trở đi không còn hiện tượng khung nhảy giật.
- **Ghi tiến độ — Kỹ thuật không còn mất dữ liệu khi đổi công đoạn**: nhập Đơn giá/Hệ số cho 1 công đoạn rồi thêm/xoá công đoạn khác không còn làm mất dữ liệu vừa nhập.
- **Ghi tiến độ — sửa lỗi thật `UNIQUE KEY constraint 'UQ_DonHangCongDoanMay'`**: đã xác định nguyên nhân gốc và sửa 3 lớp (xem chi tiết ở Bước 2.11) — không còn tái diễn, kể cả trường hợp chọn nhanh liên tiếp nhiều công đoạn.
- **Ghi tiến độ — chọn nhiều công đoạn may nay lưu đủ**: hệ quả trực tiếp của việc sửa lỗi trên — trước đây do lỗi lưu dở dang nên "chọn 2 công đoạn nhưng sang May chỉ thấy 1", nay lưu đủ toàn bộ.
- **Ghi tiến độ — "Giao việc nội bộ" ngay tại Kỹ thuật (mới)**: thêm cột "Nhân viên & SL" ngay trong khối chọn công đoạn may ở Kỹ thuật — giao được nhiều nhân viên + số lượng cho từng công đoạn ngay từ bước này, hiện luôn trong "Đã giao việc" khi xem lại ở công đoạn May.
- **Ghi tiến độ — Giao vải hiện đủ thông tin cây vải**: ô tìm mã cây thêm vị trí kho + ngày nhập.
- **Ghi tiến độ — Phụ kiện làm rõ hơn**: thêm dòng tham khảo Tổng SL cắt; đơn vị tính tự điền theo phụ kiện đã chọn (cho chọn nếu phụ kiện có 2 đơn vị); thêm bộ lọc theo Loại phụ kiện.
- **Ghi tiến độ — May tính đúng Tổng SL cắt**: "Tổng SL cắt (đã quy đổi)" nay chỉ cộng các màu CHÍNH, không cộng luôn màu phối.
- **In phiếu báo cáo đơn hàng — bổ sung nhiều dữ liệu**: thêm ảnh sản phẩm; "SL nhập kho thực tế" hiện thêm "(đã quy đổi)" khi tính được số liệu đã quy đổi từ Thẻ kho hàng hóa; mục "Xuất vải kèm đơn hàng" thêm dòng tóm tắt cấu trúc vải chính/phối; bảng "Phụ kiện xuất kèm đơn hàng" thêm cột "SL chỉ định"; dữ liệu Kho nhập/May ghi nhận SAU khi nâng cấp hiện thêm đơn vị tính/tên nhà gia công ngay trên dòng lịch sử tương ứng.
- **In phiếu xuất kho vải / xuất phụ kiện — thêm ảnh sản phẩm**: áp dụng tương tự phiếu báo cáo đơn hàng ở trên.
- **Danh mục — Công đoạn sản xuất thêm mã công đoạn**: thêm cột "Mã công đoạn" — xem lưu ý quan trọng về phạm vi áp dụng ở Bước 2.11 (chưa thay thế các so sánh theo tên công đoạn đang có sẵn trong code).
- **Kho vải — ô tìm mã cây hiện đủ thông tin**: bổ sung vị trí kho + ngày nhập vào cả 2 nơi (tạo phiếu xuất mới, sửa phiếu xuất đã có) — riêng màn Sửa còn sửa thêm 1 lỗi khiến các cây ĐÃ có sẵn trong phiếu bị thiếu thông tin này (chỉ cây mới thêm mới có).
- **Quản lý phụ kiện — Phiếu Xuất thêm cột SL chỉ định trên màn hình xem**: trước đây cột này chỉ có trên bản in, màn hình xem chi tiết phiếu chưa hiện.
- **Mobile — sửa lỗi quét QR không nhận**: vùng quét mã QR trước đây có kích thước cố định, trên điện thoại có thể lớn hơn khung hình camera thực tế khiến quét không nhận; nay tự co giãn theo đúng khung hình.
- **Mobile — Thẻ kho hàng hóa "Lên đơn đặt hàng" hiện ảnh**: thêm ảnh sản phẩm (theo mã hàng) và ảnh riêng theo màu, tự đổi khi đổi lựa chọn.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", cần xác nhận lại nếu chưa đúng ý): xem đầy đủ ở khung cảnh báo trong Bước 2.11, gồm: phạm vi giới hạn của "Mã công đoạn" (chưa refactor các so sánh theo tên), lịch sử Kho nhập/May chỉ có dữ liệu mới, lựa chọn thêm "Giao việc nội bộ" vào Kỹ thuật thay vì di chuyển khối đã có ở May, điều kiện áp dụng của "SL nhập kho đã quy đổi", và việc dùng SQL transaction lần đầu tiên (chỉ áp dụng cho đúng 1 route đã có lỗi thật).
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ theo từng mục trong 29 yêu cầu gốc, và cho 1 agent kiểm tra ĐỘC LẬP đối chiếu lại toàn bộ 29 mục — phát hiện và đã sửa thêm **2 lỗi thực sự** trong lúc kiểm tra: (1) ở công đoạn Phụ kiện, đổi "Loại PK" lọc đúng danh sách hợp lệ nhưng gợi ý hiện ra khi gõ (`<datalist>`) không được vẽ lại theo đúng loại vừa chọn — đã sửa để vẽ lại đúng gợi ý; (2) khối "Nhân viên & SL" mới thêm ở Kỹ thuật ban đầu chỉ nhớ có bao nhiêu dòng chứ chưa nhớ nhân viên/số lượng đã nhập — nếu thêm/bớt 1 công đoạn may KHÁC trước khi bấm "Gửi", dữ liệu nhân viên/SL vừa nhập cho công đoạn trước đó sẽ mất (cùng loại lỗi đã sửa cho ô Đơn giá/Hệ số ở mục trên, nhưng ban đầu chưa áp dụng hết cho khối này) — đã sửa để lưu lại đầy đủ. Sau khi sửa cả 2, đã tự kiểm tra lại đoạn code liên quan. Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — đây là đợt thay đổi lớn nhất từ trước tới nay, **đặc biệt khuyến nghị** kiểm thử đầy đủ theo danh sách ở Bước 2.11 trên môi trường test trước khi dùng cho dữ liệu thật, đặc biệt là khối "Nhân viên & SL" và bộ lọc "Loại PK" vừa sửa thêm.

### v5.6

Đợt refinement thứ 6, gồm 3 nhóm: **Quản lý sản xuất** (ngày ra lệnh trên phiếu in, sửa được cấu trúc vải khi sửa lệnh có khoá màu đã dùng tiến độ, Giao vải hiện cảnh báo rõ khi không có cây phù hợp, công đoạn May bỏ bắt buộc chọn màu, phiếu báo cáo hiện tên nhà gia công/nhà in, Dashboard "Đơn hàng đang sản xuất" hiện cả đơn chưa bắt đầu, tách phân quyền "Ghi nhận tiến độ" khỏi "Xem/Sửa lệnh sản xuất"), **Quản lý kho vải** (drilldown trạng thái ở Tồn kho tổng hợp, mở rộng + làm rõ ô tìm mã cây ở Xuất kho, ẩn đơn đã xuất kho hết, sửa lỗi quét QR làm mất phiếu đang mở), và **Thẻ kho hàng hóa** (gợi ý rõ khi danh mục "Loại hàng" trống, bỏ cache để danh mục mới thêm hiện ngay). Cách nâng cấp từ v5.5: xem Bước 2.10. Đổi `PhanCongMay.MauSacID` sang nullable, cập nhật view `vw_TonKhoVai`, thêm 1 chức năng phân quyền mới (`QLSX.tiendo`, tự sao chép quyền từ `orders`).

- **Ra lệnh sản xuất — ngày ra lệnh trên phiếu in**: phiếu Lệnh sản xuất hiện thêm dòng "Ngày ra lệnh" ở phần thông tin đầu phiếu.
- **Sửa lệnh sản xuất — sửa được cấu trúc vải**: form Sửa đơn hàng nay cho sửa cả khối "Cấu trúc vải" (loại vải/màu chính, màu phối, số lượng, ảnh) — trước đây chỉ sửa được thông tin chung của đơn. Màu chính đã có tiến độ ghi nhận (Giao vải/Cắt/May...) bị khoá không cho đổi Loại vải/Màu (có nhãn 🔒 giải thích), nhưng vẫn sửa được Số lượng/Ảnh; thêm màu chính mới hoặc thêm/bớt màu phối không bị giới hạn.
- **Ghi tiến độ — Giao vải hiện cảnh báo rõ khi thiếu cây phù hợp**: trước đây khi không có cây vải nào khớp đúng loại/màu, ô tìm kiếm chỉ hiện trống không giải thích — nay hiện khung cảnh báo nêu rõ nguyên nhân khả dĩ.
- **Ghi tiến độ — công đoạn May bỏ bắt buộc chọn màu**: dòng giao việc không còn ô chọn Màu (chỉ cần chọn nhân viên + số lượng); bảng số lượng lũy kế theo màu (từ số cắt) vẫn hiện để đối chiếu thủ công; giao được nhiều nhân viên với số lượng khác nhau cho cùng 1 công đoạn.
- **In phiếu báo cáo đơn hàng — tên nhà gia công/nhà in**: hiện thêm dòng tên nhà gia công/nhà in (kèm ngày giao/nhận gần nhất) ngay trên bảng "Lịch sử cập nhật tiến độ".
- **Dashboard — "Đơn hàng đang sản xuất" hiện cả đơn chưa bắt đầu**: trước đây bảng này chỉ lọc đơn có trạng thái "Đang sản xuất", ẩn mất đơn đã ra lệnh nhưng chưa ghi tiến độ lần nào; nay hiện mọi đơn CHƯA hoàn thành.
- **Phân quyền — tách "Ghi nhận tiến độ" khỏi "Xem/Sửa lệnh sản xuất"**: thêm chức năng con mới `QLSX.tiendo` gộp toàn bộ thao tác Giao vải/Phụ kiện/Công đoạn may/Phân công may/Giao nhận nhà gia công/Ép chuyển công đoạn — tách biệt với `QLSX.orders` (chỉ còn Xem/Sửa/Xoá lệnh sản xuất + in phiếu). Cho phép giao 1 nhóm/user chỉ được ghi tiến độ mà không sửa được thông tin lệnh, hoặc ngược lại.
- **Kho vải — drilldown trạng thái ở Tồn kho tổng hợp**: tab Tồn kho tổng hợp thêm cột "Trạng thái" hiện 3 nhãn bấm được (Nguyên cây/Cây lẻ/Hết kèm số lượng), mở đúng danh sách cây vải khớp mã vải + trạng thái đã bấm — trước đây chỉ tab "Tồn theo cây" có drilldown này.
- **Kho vải — Xuất kho làm rõ ô tìm mã cây**: sửa lỗi CSS khiến ô tìm mã cây không thực sự rộng gấp đôi như đã làm ở v5.4 tại 1 số vị trí (Giao vải, Xuất kho) do thiếu rule `width` cho input; đồng thời phần gợi ý kết quả tìm đã hiện rõ mã cây + tên vải + số KG còn (tính năng có từ v5.3, xác nhận hoạt động đúng sau khi sửa CSS).
- **Kho vải — ẩn đơn đã xuất kho hết**: danh sách "Đơn hàng sản xuất" trong form Xuất kho nay ẩn các đơn đã được giao vải VÀ toàn bộ cây đã giao đều hết KG còn lại; đơn chưa từng giao vải vẫn hiện bình thường.
- **Kho vải — sửa lỗi quét QR làm mất phiếu đang mở**: quét QR để điền mã cây trong khi đang mở form Xuất kho/Giao vải trước đây làm phiếu đang mở tự đóng do dùng chung 1 cơ chế modal — nay quét QR dùng lớp overlay độc lập, không còn ảnh hưởng modal cha.
- **Thẻ kho hàng hóa — danh mục "Loại hàng" hiện đúng dữ liệu**: sửa lỗi dropdown "Loại hàng" trong form Tạo thẻ kho mới không tự cập nhật khi danh mục vừa được thêm mới (do bị cache); nay luôn tải lại danh mục mới nhất, đồng thời hiện gợi ý rõ khi danh mục đang trống.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", cần xác nhận lại nếu chưa đúng ý):
  - Một phần phản hồi trong đợt này (gõ tìm mã cây ở Giao vải, hiện rõ tên/KG còn ở Xuất kho, cột Trạng thái click được ở "Tồn theo cây") hoá ra đã được code từ v5.2–v5.4 — rà soát code xác nhận các tính năng này đã tồn tại; nếu môi trường thật chưa thấy, nhiều khả năng do CHƯA triển khai đủ các bản v5.1–v5.5, không phải lỗi mới. Xem cảnh báo đầu Bước 2.10.
  - Khoá sửa màu: chỉ khoá Loại vải+Màu của khối màu CHÍNH đã có tiến độ — không khoá Số lượng/Ảnh, không khoá màu phối (không bị theo dõi tiến độ riêng). Kiểm tra "đã có tiến độ" theo cặp (Đơn hàng, Màu), không theo từng dòng cấu trúc vải cụ thể.
  - Tên nhà gia công/nhà in trên phiếu báo cáo hiện dưới dạng 1 dòng thông tin tĩnh (giá trị hiện tại + ngày gần nhất), không chèn thành cột trong từng dòng lịch sử — vì giao/nhận nhà gia công là 1 cột đơn trên đơn hàng (ghi đè mỗi lần lưu), không có lịch sử nhiều lần thực sự để gắn vào từng dòng.
  - Chức năng `tiendo` gộp chung mọi thao tác ghi tiến độ thành 1 quyền duy nhất, không tách nhỏ hơn (vd Giao vải riêng, Phụ kiện riêng) — yêu cầu gốc chỉ nêu 2 nhóm.
  - Đơn "đã xuất kho hết" bị ẩn định nghĩa theo đã-giao-vải + hết-KG-còn, không theo trạng thái đơn hàng — nêu lại nếu muốn tiêu chí khác.
  - Đợt này CÓ thêm 1 chức năng phân quyền mới — nên yêu cầu người dùng đăng xuất/đăng nhập lại sau khi nâng cấp (xem Bước 2.10).
  - **Rủi ro kỹ thuật cần lưu ý (KHÔNG tự ý sửa vì ảnh hưởng ngoài phạm vi yêu cầu)**: thao tác "Sửa lệnh sản xuất" khi có gửi `chiTietVai` thực hiện XÓA rồi GHI LẠI toàn bộ `DonHangChiTietVai`, gồm nhiều lệnh SQL riêng lẻ KHÔNG bọc trong 1 transaction — nếu 1 lệnh INSERT ở giữa vòng lặp lỗi (vd dữ liệu màu/loại vải không hợp lệ), có thể để lại trạng thái thiếu 1 phần màu. Đây là mẫu hình đã có sẵn xuyên suốt toàn bộ `qlsx.js` từ trước (kể cả `POST /orders` gốc), không phải lỗi mới phát sinh riêng ở đợt này — nhưng PUT là điểm đầu tiên áp dụng mẫu XÓA+GHI LẠI này nên rủi ro thực tế tăng lên. Khuyến nghị cân nhắc bọc transaction cho toàn bộ file này ở 1 đợt riêng (ảnh hưởng nhiều điểm, cần kiểm thử kỹ), không xử lý trong đợt v5.6 vì ngoài phạm vi 13 yêu cầu gốc.
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ và cho 1 agent kiểm tra độc lập đối chiếu từng mục trong 13 yêu cầu gốc — phát hiện và đã sửa 1 lỗi thực sự (nút "Ghi tiến độ"/"Giao nhận nhà gia công" ban đầu vẫn gate theo quyền `orders` cũ thay vì `tiendo` mới). Sau khi sửa, đã tự kiểm tra lại trực tiếp (đọc lại đúng đoạn code vừa sửa + toàn bộ khối validate/xóa/ghi lại `DonHangChiTietVai`) — toàn bộ 13 mục đạt (PASS). Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển — khuyến nghị kiểm thử đầy đủ theo danh sách ở Bước 2.10 trên môi trường test trước khi dùng cho dữ liệu thật.

### v5.5

Đợt refinement thứ 5, gồm 3 nhóm: sửa lỗi **"in phiếu hay bị treo trang"** (toàn hệ thống), cải tiến **Dashboard QLSX** (lọc theo trạng thái, cuộn riêng, drilldown nhà gia công/in thêu, làm rõ "Số ngày xử lý TB"), và mở rộng **Ra lệnh sản xuất** + **Ghi tiến độ** (ảnh sản phẩm/hình in trên phiếu in, gộp màu chính/phối 1 ô, tải ảnh "Hình in", công đoạn Kỹ thuật chọn nhà gia công, công đoạn May giao việc nhiều nhân viên có tìm kiếm + Admin sửa lại). Cách nâng cấp từ v5.4: xem Bước 2.9. Chỉ thêm 2 cột nullable cho `DonHangSanXuat`; không đổi cấu trúc phân quyền.

- **Sửa lỗi in phiếu hay treo trang**: nguyên nhân là cửa sổ in (`window.open`) bị mở SAU khi chờ tải dữ liệu, khiến trình duyệt âm thầm chặn popup rồi mã nguồn ghi tiếp vào cửa sổ rỗng — nhìn như trang bị treo. Sửa tận gốc: mở cửa sổ in NGAY khi bấm nút (trước khi gọi API), có thông báo lỗi rõ ràng nếu bị chặn popup; đồng thời đổi cơ chế bấm in tự động sang chờ ảnh tải xong mới in (trước đây có thể in thiếu ảnh trong phiếu). Áp dụng cho phiếu Lệnh sản xuất và Phiếu báo cáo đơn hàng (2 điểm thực sự có nguy cơ); đã rà soát toàn bộ các phiếu in khác (Kho vải, Phụ kiện) và xác nhận không bị ảnh hưởng.
- **Dashboard — lọc theo trạng thái**: bấm vào từng ô thống kê (Tổng/Hoàn thành/Đang sản xuất/Chưa bắt đầu/Trễ hạn) mở popup danh sách đơn hàng đúng trạng thái đó.
- **Dashboard — cuộn riêng & drilldown**: bảng "Đơn hàng đang sản xuất" cuộn độc lập với trang; bấm vào dòng báo cáo nhà gia công/nhà in thêu hoặc số đếm theo công đoạn đều mở popup danh sách đơn liên quan.
- **Dashboard — "Số ngày xử lý TB"**: làm rõ nhãn hiển thị khi thiếu dữ liệu (đổi "-" thành "Chưa đủ dữ liệu") — phép tính vốn đã đúng từ trước, chỉ hiện số khi đơn đã có đủ cả Ngày giao lẫn Ngày nhận từ nhà gia công/in.
- **Ra lệnh sản xuất — vải phối không cần số lượng**: bỏ bắt buộc nhập số lượng ở phần chọn vải phối.
- **Ra lệnh sản xuất — ảnh trên phiếu in**: phiếu Lệnh sản xuất hiện thêm ảnh sản phẩm và ảnh hình in (nếu đơn có khai báo).
- **Ra lệnh sản xuất — gộp màu chính/phối**: bảng "Cấu trúc vải" trên phiếu in gộp màu chính và các màu phối vào 1 ô duy nhất dạng "Tên (chính) - Tên, Tên (phối)" thay vì 2 dòng riêng như trước.
- **Ra lệnh sản xuất — lịch sử hiện giờ cập nhật**: phiếu báo cáo đơn hàng hiện đủ ngày GIỜ cập nhật tiến độ (trước chỉ có ngày).
- **Ra lệnh sản xuất — tải ảnh Hình in**: form Tạo mới và Sửa đơn hàng có thêm ô tải ảnh cho "Hình in" (độc lập với dòng chữ mô tả hình in đã có).
- **Ghi tiến độ — công đoạn Kỹ thuật chọn nhà gia công**: thêm ô chọn nhà gia công ngay tại bước này; nếu để trống hoặc chọn "Nhà Làm" thì hiện khối chọn công đoạn may (tìm bằng gõ chữ) kèm đơn giá/hệ số riêng cho đơn; nếu chọn nhà khác thì hiện 1 ô đơn giá gia công ngoài (phục vụ tính lương/thanh toán làm sau, chưa dùng ở đâu khác).
- **Ghi tiến độ — công đoạn May giao việc**: hiện bảng công đoạn đã chọn ở Kỹ thuật (cuộn riêng nếu >7 dòng); chọn nhân viên bằng tìm-gõ, giao được nhiều nhân viên cho cùng 1 công đoạn, hiện tổng SL bàn cắt quy đổi kèm theo; thêm bảng "việc đã giao" với quyền Admin sửa lại tên nhân viên/số lượng qua API mới `GET/PUT /orders/:maDH/phancongmay[/:id]`.
- **Kho vải**: sửa dòng gợi ý dễ gây hiểu lầm "2 công đoạn Giao vải" — hệ thống chỉ có 1 công đoạn "Giao vải" duy nhất từ v5.2, dòng hint cũ nhắc nhầm tên gọi trước khi gộp.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", cần xác nhận lại nếu chưa đúng ý):
  - Đơn giá gia công ngoài (`DonGiaGiaCongNgoai`) đặt ở cấp đơn hàng, không tách theo công đoạn — gia công ngoài thường trả trọn gói theo đơn, khác với đơn giá công đoạn may nội bộ (`DonHangCongDoanMay`).
  - Khi chưa chọn nhà gia công ở Kỹ thuật, mặc định coi là "Nhà Làm" — nhất quán với logic `tinhNextStage()` đã có sẵn.
  - Nhãn màu trên phiếu in rút gọn "(chính)/(phối)" thay vì "(vải chính)/(vải phối)" nguyên văn — ý nghĩa không đổi, bảng gọn hơn.
  - Công đoạn May triển khai dạng danh sách dòng lặp lại (thêm/bớt tự do) thay vì "1 nút cố định/công đoạn" — vẫn đáp ứng đủ giao nhiều nhân viên/công đoạn, cuộn riêng, Admin sửa được.
  - "2 công đoạn Giao vải" xác nhận là hiểu lầm từ 1 dòng hint cũ, không phải lỗi dữ liệu/cấu trúc — không có migration nào liên quan đến công đoạn này.
  - "Số ngày xử lý TB" xác nhận không phải lỗi tính toán — chỉ thiếu dữ liệu đầu vào (ngày nhận từ nhà gia công), đã làm rõ nhãn hiển thị.
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ và cho 1 agent kiểm tra độc lập đối chiếu từng mục trong 13 yêu cầu gốc — tất cả đạt (PASS), không phát hiện lỗi chặn triển khai. Vẫn **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo đúng danh sách ở Bước 2.9 trên môi trường test trước khi dùng cho dữ liệu thật.

### v5.4

Đợt refinement thứ 4, tập trung vào **Thẻ kho hàng hóa** (tách rời khỏi Kho nhập tự động, thêm danh mục "Loại hàng", hết hàng hiện đỏ, ảnh đại diện phóng to) và **Quản lý kho vải** (drilldown xem nhanh cây vải từ Tồn kho, mở rộng ô tìm mã cây, dựng lại đúng cả 4 mẫu phiếu in theo file `mau_phieu.docx` người dùng cung cấp — Nhập/Xuất kho vải, Nhập/Xuất kho phụ kiện). Cách nâng cấp từ v5.3: xem Bước 2.8. Có thêm 1 bảng danh mục mới (`DanhMucNhomSanPham`) và 3 cột nullable cho các bảng phiếu hiện có; không đổi cấu trúc phân quyền.

- **Thẻ kho hàng hóa — tách Kho nhập khỏi tự tạo thẻ kho**: ghi nhận tiến độ "Kho nhập" trong QLSX **không còn tự động tạo Thẻ kho hàng hóa** như mọi bản trước — phải tạo thủ công qua "Tạo thẻ kho mới" trước; sau khi đã có thẻ kho, Kho nhập vẫn tự cộng dồn số lượng như cũ. Khi tạo thẻ kho cho 1 đơn đã từng ghi Kho nhập trước đó, ô "Nhập" tự điền và khóa theo đúng số liệu đã ghi (giống cơ chế ô "Số cắt" đã có).
- **Thẻ kho hàng hóa — danh mục "Loại hàng" (mới)**: nhóm sản phẩm theo kiểu dáng (VD "Quần bé trai"), độc lập với trường "Nguồn hàng" (đổi tên từ "Loại hàng" cũ — phân biệt Nhà sản xuất/Đặt ngoài) để tránh nhầm lẫn 2 khái niệm; dùng để lọc trong danh sách Thẻ kho và Catalogue.
- **Thẻ kho hàng hóa — hết hàng hiện đỏ**: mã hàng tồn ≤ 0 hiện dòng đỏ kèm nhãn "Hết hàng"/"Âm kho" trong danh sách nội bộ; Catalogue công khai không đổi (vẫn tự ẩn mã hết hàng như từ v4.0).
- **Thẻ kho hàng hóa — ảnh đại diện phóng to**: ảnh đại diện chung ở danh sách và trang chi tiết mã hàng nay bấm phóng to được (giống ảnh theo màu đã có từ v5.1), đóng ảnh quay lại đúng màn hình đang xem.
- **Quản lý kho vải — drilldown từ Tồn kho**: cả 2 màn hình Tồn kho tổng hợp và Tồn theo cây thêm cột STT; bấm vào ô Trạng thái/Mã vải/Loại vải/Màu mở popup danh sách các cây vải liên quan.
- **Quản lý kho vải — mở rộng ô tìm mã cây**: ô tìm mã cây trong form Xuất kho rộng gấp đôi so với trước.
- **Dựng lại 4 mẫu phiếu in theo đúng `mau_phieu.docx`**: cấu trúc dòng Ngày/Số/Đơn vị bán hàng/Ngày hóa đơn tách riêng từng dòng (trước đây gộp chung 1 dòng); phiếu Nhập (vải + phụ kiện) thêm ô/cột **"Ngày hóa đơn"** nhập tay; phiếu Nhập phụ kiện thêm cột **"Đơn giá"**; phiếu Xuất (vải + phụ kiện) thêm cột **"SL theo chỉ định"** (lấy từ dữ liệu Giao vải/Chỉ định NPL trong QLSX) và tăng từ 2 lên **4 vai ký** (Người lập/Bộ phận cắt/NV chỉ định NPL/Thủ kho); cột "Ghi chú" trên phiếu Xuất kho vải để trống trên bản in (không có ô nhập liệu tương ứng, dành ghi tay sau khi in).
- **Catalogue**: ảnh đại diện và ảnh theo màu bấm phóng to được; thêm dropdown lọc theo "Loại hàng" mới.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", cần xác nhận lại nếu chưa đúng ý):
  - Đặt tên nội bộ bảng/cột danh mục mới là `DanhMucNhomSanPham`/`NhomSanPhamID`/`TenNhom` (khác với nhãn hiển thị "Loại hàng" trên giao diện) để tránh trùng tên với cột `TheKhoHangHoa.LoaiHang` đã có sẵn (Nhà sản xuất/Đặt ngoài) — nếu sau này chỉnh sửa code, lưu ý phân biệt 2 khái niệm này.
  - Cột "Ghi chú" trên phiếu Xuất kho vải cố tình để trống trên bản in — mẫu `mau_phieu.docx` có cột này nhưng yêu cầu gốc không mô tả nguồn dữ liệu, hiểu là khoảng trống ghi tay sau khi in (thực tế phổ biến ở chứng từ giấy xưởng may) thay vì thêm 1 trường dữ liệu mới không có trong yêu cầu.
  - Số hóa đơn (`SoHoaDon`, đã có từ trước) vẫn hiện thêm trên bản in phiếu Nhập cạnh "Ngày hóa đơn" mới dù mẫu chỉ ghi rõ "Ngày hóa đơn" — giữ nguyên để không mất khả năng nhìn thấy dữ liệu đã có sẵn trong hệ thống.
  - Sửa 1 chỗ có vẻ là lỗi chính tả trong mẫu gốc: vai ký "NV chỉnh định NPL" → in ra thành **"NV chỉ định NPL"** (khớp đúng nghĩa "chỉ định NPL" dùng xuyên suốt các phần khác của hệ thống) — nêu lại nếu đây là tên gọi cố ý khác, không phải lỗi chính tả.
  - Đợt này **không đổi cấu trúc bảng phân quyền** — không cần yêu cầu người dùng đăng xuất/đăng nhập lại như các đợt trước.
  - Vấn đề quét QR/camera qua mkcert (disclose từ Bước 2.7) **vẫn chưa có xác nhận thực tế đã khắc phục triệt để trên mọi thiết bị của xưởng** — nếu đã kiểm thử thực tế và ổn, có thể bỏ qua ghi chú này ở các bản sau.
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh, không dựa vào bản sao có thể lỗi thời trong môi trường chạy thử — gồm cả việc xác nhận lại bash sandbox từng hiển thị sai lệch tạm thời so với nội dung file thật) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo đúng danh sách ở Bước 2.8 trên môi trường test trước khi dùng cho dữ liệu thật — đặc biệt: in thử cả 4 mẫu phiếu và so trực tiếp với `mau_phieu.docx` gốc.

### v5.3

Đợt refinement thứ 3, gồm 5 nhóm yêu cầu: mở rộng phân quyền theo chức năng, cải tiến Thẻ kho hàng hóa, cải tiến Quản lý kho vải, phóng to chuông/popup thông báo, và cải tiến Quản lý phụ kiện — cộng thêm hạ tầng HTTPS tuỳ chọn cho quét QR trên nhiều máy. Cách nâng cấp từ v5.2: xem Bước 2.7. Không đụng cấu trúc dữ liệu nghiệp vụ của QLSX (dùng lại đúng bảng đã có từ v5.2); chỉ thêm cột cho bảng phân quyền theo chức năng và 1 chức năng mới cho Kho hàng.

- **Phân quyền theo chức năng**: mở rộng từ chỉ Xem sang đủ **Xem/Sửa/Xóa** cho từng tab con, áp dụng cho **toàn bộ 6 phân hệ** (không chỉ vài phân hệ như đề xuất ban đầu) — quyền cuối cùng = quyền phân hệ AND quyền tab con; ghi đè riêng theo user (v5.1) cũng nâng cấp theo, thay thế cả 3 ô cùng lúc.
- **Form popup dùng chung toàn hệ thống**: phóng to gấp đôi, kéo di chuyển được, kéo góc đổi kích thước được, có nút thu nhỏ về góc màn hình (vẫn thao tác được phần phía sau) — đổi lại, bấm ra ngoài popup không còn tự đóng nữa (phải bấm ✕ hoặc Esc), tránh mất dữ liệu do lỡ tay.
- **Catalogue**: thêm dropdown lọc theo Thẻ kho, dùng kèm ô tìm kiếm tự do đã có.
- **Thẻ kho hàng hóa**: đặt hàng xong từ Chi tiết mã hàng quay lại đúng màn hình Chi tiết mã hàng (không về danh sách); đơn vị quy đổi hiện thêm hệ số sau chữ "ri" (VD "200 Cái (40 ri5)"); thêm quyền **Xóa mã hàng** (chặn nếu đã có đơn khách đặt hàng liên kết); tách nút "Tạo thẻ kho mới" ra 1 tab riêng thay vì nằm trong tab danh sách.
- **Quản lý kho vải**: Sửa phiếu Nhập/Xuất nay sửa được **toàn bộ các trường** (trước đây chỉ sửa thông tin đầu phiếu) — dòng đã phát sinh xuất kho/giao vải sản xuất vẫn sửa được KG/kho/GSM/giá nhưng không đổi được loại vải/màu và không giảm dưới mức đã dùng, dòng chưa phát sinh gì thì tự do; phiếu Xuất không gắn đơn hàng nay tìm mã cây bằng ký tự bất kỳ, hiện kèm tên loại vải/màu, gồm cả vải chính và vải phối (giao vải sản xuất cũng áp dụng tương tự); quét QR dùng thẳng camera thiết bị (xem mục HTTPS/mkcert ở Bước 2.7 để dùng được trên mọi máy, không chỉ máy chủ); sửa lỗi in tem khổ ngang bị to chữ/mất chữ; lưu nháp form tạo phiếu Nhập/Xuất vào bộ nhớ trình duyệt — mất dữ liệu nếu tắt/mở lại khi chưa lưu nay đã khắc phục.
- **Thông báo**: chuông và popup phóng to rõ hơn; popup hiện giữa màn hình, tự cập nhật nội dung mới trong vòng ~15 giây (rút ngắn từ 45 giây) mà không cần F5 trang.
- **Quản lý phụ kiện**: list Phiếu Nhập/Xuất xác nhận đã có nút Xóa theo phân quyền (từ v5.1); tab Thẻ kho/Tồn kho tự lọc ngay khi gõ/chọn loại, không cần bấm "Xem dữ liệu" nữa (giống Kho vải); ô chọn phụ kiện trong form Phiếu Nhập/Xuất gõ tự do tìm được (trước đây dropdown cố định); bấm "Lịch sử" ở Danh mục phụ kiện nay hiện **popup ngay tại chỗ** (trước đây chuyển tab), hiển thị đủ cột Ngày/Loại phiếu/Đơn hàng/Nhập/Xuất/Tồn cuối/ĐVT.
- **Hạ tầng (mới)**: hỗ trợ **HTTPS tuỳ chọn qua mkcert** — cho phép mở camera quét QR từ MỌI máy trong mạng LAN (điện thoại, tablet, PC khác), không chỉ máy chủ như trước; xem hướng dẫn cài đặt chi tiết ở Bước 2.7. Hoàn toàn tuỳ chọn — không cấu hình vẫn chạy HTTP như cũ.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo "triển khai toàn bộ không cần hỏi lại", cần xác nhận lại nếu chưa đúng ý):
  - Phân quyền tab con không có ô "Thêm" riêng — dùng chung ô "Sửa" cho cả Thêm/Sửa, đúng theo yêu cầu gốc chỉ nêu "xem, sửa, xóa".
  - Ghi đè riêng theo user ở cấp tab con thay thế toàn bộ 3 ô cùng lúc, không ghi đè từng ô lẻ — nhất quán với cách ghi đè theo phân hệ đã có.
  - Thông báo "đẩy lên không cần F5" dùng polling 15 giây, không phải WebSocket thời gian thực — có độ trễ tối đa ~15 giây.
  - Lưu nháp localStorage chỉ áp dụng form **tạo mới** Nhập/Xuất kho vải, chưa mở rộng sang form Sửa hay phân hệ khác.
  - HTTPS qua mkcert là chứng chỉ tự ký được tin cậy thủ công (root CA cài riêng từng máy), không phải chứng chỉ thật từ CA công cộng — chỉ phù hợp dùng nội bộ trong LAN xưởng.
  - File mẫu phiếu in thật (`mau_phieu.docx`) vẫn chưa nhận được, tình trạng placeholder giữ nguyên như đã disclose từ v5.1.
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh, không dựa vào bản sao có thể lỗi thời trong môi trường chạy thử) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo Bước 2.7 trên môi trường test trước khi dùng cho dữ liệu thật.

### v5.2

Đợt refinement thứ 2 tập trung riêng vào phân hệ **Quản lý sản xuất**, theo yêu cầu chi tiết hóa quy trình thực tế của xưởng. Cách nâng cấp từ v5.1: xem Bước 2.6. Không đụng Kho vải/Kho hàng hóa (dùng lại đúng bảng đã có); Phụ kiện chỉ thay đổi ở CHỖ và THỜI ĐIỂM ghi nhận (nay ở Ghi tiến độ thay vì lúc Ra lệnh sản xuất), cấu trúc bảng `DonHangChiTietPhuKien` giữ nguyên.

- **Dashboard**: bấm vào 1 dòng trong bảng "Đơn hàng đang sản xuất" để xem chi tiết đơn ngay trong popup, không cần chuyển tab.
- **Danh mục Máy sản xuất (mới)**: khai báo máy sản xuất (1 kim, Vắt sổ...) và gán cho từng Nhân viên — nền tảng cho tính lương theo máy sau này.
- **Công đoạn Kỹ thuật**: bổ sung checklist chọn công đoạn may áp dụng cho đơn hàng + đơn giá/hệ số **riêng theo từng đơn hàng** (bảng mới `DonHangCongDoanMay`, khác giá mặc định toàn hệ thống) — dùng tính lương công nhân may sau này; công đoạn May chỉ hiện đúng các công đoạn đã chọn ở đây khi giao việc nội bộ.
- **Ra lệnh sản xuất**: mỗi màu chính trong cấu trúc vải có ảnh riêng (upload lúc tạo lệnh, hiện kèm trong "In lệnh sản xuất"); bỏ khối "Phụ kiện cần dùng" khỏi form này (chuyển sang công đoạn "Phụ kiện" ở Ghi tiến độ). Tab "Danh sách đơn hàng" đổi tên thành **"Danh sách lệnh sản xuất"**, thêm nút Sửa/Xóa theo phân quyền, các nút thao tác khác cũng ẩn/hiện đúng theo quyền Sửa của tài khoản (trước đây hiện cố định cho mọi người xem được đơn).
- **2 công đoạn mới trong Ghi tiến độ**: "Giao vải" (thay nút "Giao vải SX" rời trước đây — chỉ hiện cây vải tồn kho đúng loại vải/màu của đơn, mã cây hiển thị dạng thẻ tự co giãn theo độ dài) và "Phụ kiện" (thay khối khai báo lúc tạo lệnh) — cả 2 chèn vào giữa luồng, ngay trước công đoạn "Cắt".
- **Công đoạn May**: thêm hiển thị "Tổng số bàn cắt" tham khảo (số dòng cây vải đã ghi ở Cắt); dropdown công đoạn may khi giao việc nội bộ lọc theo đúng các công đoạn đã chọn ở Kỹ thuật của đơn đó; vẫn hỗ trợ chia 1 công đoạn cho nhiều nhân viên với số lượng riêng (tính năng đã có từ v4.0).
- **Công đoạn Cắt**: mỗi ô nhập liệu theo từng cây vải có nhãn rõ ràng; thêm cột "KG/mét đã dùng"; nhân viên trải vải đổi từ chọn 1 người sang checkbox chọn tối đa 2 người.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo, cần xác nhận lại nếu chưa đúng ý):
  - "Tổng số bàn cắt" được định nghĩa là số dòng cây vải ghi nhận ở lần Cắt gần nhất (yêu cầu gốc không định nghĩa rõ "bàn" là gì).
  - Sửa lệnh sản xuất chỉ sửa thông tin chung, không sửa lại cấu trúc vải/phụ kiện đã khai báo (tránh làm lệch dữ liệu tiến độ đã tham chiếu).
  - Xóa lệnh sản xuất từ chối nếu đơn đã có Thẻ kho hàng hóa/xuất vải/thông báo liên kết — hành vi an toàn có chủ đích, không phải lỗi.
  - File mẫu phiếu in thật (`mau_phieu.docx`) vẫn chưa nhận được, tình trạng placeholder giữ nguyên như đã disclose ở v5.1.
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file sau mỗi lần chỉnh) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo Bước 2.6 mục 8 trên môi trường test trước khi dùng cho dữ liệu thật.

### v5.1

Đợt hoàn thiện/chỉnh sửa bổ sung sau khi v5.0 (Phase 1-4) đã lên production, theo yêu cầu chi tiết hóa từ người dùng thực tế. Cách nâng cấp từ v5.0: xem Bước 2.5. Không đổi cấu trúc dữ liệu ở Kho vải/Kho hàng/Phụ kiện (dùng lại đúng bảng đã có), chỉ thêm 2 bảng mới cho phân quyền theo user (`UserPermissions`, `UserChucNangPermissions`).

- **Phân quyền theo từng user (mới)**: bổ sung lớp phân quyền **ghi đè riêng cho từng tài khoản**, đứng trên phân quyền theo nhóm đã có — Quản lý User → Ma trận phân quyền có thêm chế độ "Theo từng user" bên cạnh "Theo nhóm quyền". Không cấu hình gì thêm = user vẫn dùng đúng quyền theo nhóm như trước, không ảnh hưởng gì đến hệ thống phân quyền hiện tại.
- **Giao diện chung**: menu bên trái và nội dung bên phải cuộn độc lập (trước đây cuộn chung, menu dài sẽ đẩy trôi cả nội dung); popup thông báo tự nổi lên góc màn hình khi đăng nhập hoặc khi có thông báo mới, không cần tự bấm vào chuông mới biết; mọi form popup đóng được bằng phím Esc; phần đầu mọi bản in đều có tên công ty.
- **Kho vải**: tab Nhập kho và Xuất kho đổi thành màn hình danh sách phiếu (Xem/In/Sửa/Sửa header/Xóa theo phân quyền) thay vì chỉ có form tạo mới — xem lại được và in lại được phiếu cũ, việc trước đây không làm được; ô tìm kiếm ở "Tồn theo cây" lọc được theo bất kỳ ký tự nào gõ vào (mã cây/mã vải/loại vải/màu); thông báo lỗi camera quét QR rõ ràng hơn (phân biệt do trình duyệt chặn HTTP hay do chưa cấp quyền); tem QR in khổ A6 to hơn hẳn (~80% khổ giấy).
- **Kho hàng hóa**: tạo thẻ kho loại "Nhà sản xuất" giới hạn đúng màu đã ra lệnh sản xuất + khóa ô Số cắt (áp dụng lúc Tạo mới); màn hình chi tiết mã hàng thêm cột ảnh theo màu (phóng to được) và đặt hàng nhanh nhiều khách cùng lúc cho 1 mã hàng + 1 màu; lên đơn đặt hàng chỉ hiện mã hàng còn tồn và tự lọc màu đúng theo mã hàng đã chọn.
- **Phụ kiện**: tab Phiếu Nhập và Phiếu Xuất đổi thành màn hình danh sách phiếu (giống Kho vải) thay vì chỉ có form tạo mới; Phiếu Nhập thêm bộ lọc "Loại PK" theo từng dòng kèm thêm loại mới ngay tại form; Phiếu Xuất khi gắn đơn hàng tự lọc phụ kiện theo đúng danh sách đã chỉ định NPL cho đơn đó.
- **Giới hạn/quyết định đã disclose khi triển khai đợt này** (đưa ra không hỏi lại theo đúng chỉ đạo, cần xác nhận lại nếu chưa đúng ý):
  - File mẫu phiếu in thật (`mau_phieu.docx`) **chưa được gửi kèm** — đang dùng placeholder chỉ có tên công ty, chưa có logo/địa chỉ/mã số thuế/bố cục theo đúng mẫu thật (xem cảnh báo ở Bước 2.5).
  - Ràng buộc màu/số cắt ở Thẻ kho "Nhà sản xuất" chỉ áp dụng lúc **Tạo mới**, chưa áp dụng khi Sửa thẻ kho đã có (để không chặn sửa dữ liệu cũ).
  - Các API Sửa (PUT) phiếu Nhập/Xuất kho vải và phiếu Nhập/Xuất phụ kiện **chỉ sửa được thông tin đầu phiếu**, không sửa lại được danh sách dòng/số lượng đã ghi — cần xóa phiếu và tạo lại nếu sai chi tiết dòng, để tránh làm lệch các báo cáo/số liệu đã tính dựa trên dữ liệu gốc.
  - Chưa cấu hình HTTPS cho server — quét QR bằng camera từ các máy trạm khác (ngoài máy chủ) qua LAN HTTP sẽ luôn bị trình duyệt chặn, đây là hạn chế của trình duyệt chứ không phải lỗi ứng dụng; cần bổ sung HTTPS nếu muốn dùng tính năng quét QR trên nhiều máy trong xưởng.
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa qua tool đọc file, không dựa vào bản sao có thể lỗi thời trong môi trường chạy thử) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển đợt này. Khuyến nghị kiểm thử đầy đủ theo Bước 2.5 mục 7 trên môi trường test trước khi dùng cho dữ liệu thật.

### v5.0

Triển khai theo 4 giai đoạn (Phase 1-4), gộp chung 1 bản phát hành. Cách nâng cấp từ v4.0: xem Bước 2.4.

- **Phase 1 — Nền tảng chung**: menu sidebar dạng accordion (thu gọn/mở rộng theo phân hệ); tự đổi mật khẩu + admin đặt lại mật khẩu cho tài khoản khác; hỗ trợ PWA (cài như app trên điện thoại/máy tính); tự mở hộp thoại in ngay sau khi lưu ở các form in phiếu. **Quan trọng nhất**: hạ tầng phân quyền theo **từng tab con** trong 1 phân hệ (bảng `ChucNang`/`ChucNangPermissions`) — ở v4.0, phân quyền chỉ có 1 lớp theo phân hệ (Xem/Thêm/Sửa/Xóa); từ v5.0 có thêm lớp thứ 2 tick được từng tab cụ thể (VD nhóm Kinh doanh chỉ xem Dashboard QLSX, không thấy tab Ra lệnh sản xuất).
- **Phase 2 — Quản lý sản xuất**: tách riêng "Ra lệnh sản xuất" khỏi "Thêm đơn hàng" cũ; màu phối nằm lồng trong màu chính (không còn 2 dòng rời); in Lệnh sản xuất theo mẫu docx; chỉ định NPL/phụ kiện ngay lúc ra lệnh (bản ghi kế hoạch, chưa trừ kho); mã công đoạn may + đơn giá theo công đoạn (kèm import Excel); "Giao vải sản xuất tạm" (chọn trước cây vải dự kiến cấp cho đơn, chưa trừ kho thật); Cắt ghi theo từng cây (STT, số lớp, hệ số quy đổi); đổi tên "Giao/nhận nhà gia công" + tách nhánh khi công đoạn May do nhà gia công làm; Dashboard hiện thêm báo cáo theo nhà gia công.
- **Phase 3 — Kho vải**: Nhập kho đổi sang chọn **Loại vải + Màu** thay vì chọn thẳng mã vải có sẵn (tự tìm hoặc tự tạo mã vải tương ứng — không cần nhớ mã); Xuất kho khi gắn đơn hàng chỉ cho chọn cây vải đã được "Giao vải sản xuất" (Phase 2) cho đúng đơn đó, thay cho cách lọc "cùng loại vải" cũ — đúng luồng thực tế (Sản xuất giao tạm vải trước, Kho vải xuất thật sau).
- **Phase 4 — Kho hàng hóa**: "Đơn khách đặt hàng" nay validate tồn kho thực tế (`NhapCai - XuatCai`) trước khi ghi đơn — trước đây có thể lên đơn vượt tồn, làm tồn kho hiển thị âm; nếu thiếu tồn, hệ thống báo lỗi rõ theo từng mã hàng-màu và không ghi đơn nào (tránh ghi một phần).
- **Phân quyền theo chức năng nay chặn THẬT ở backend** (không chỉ ẩn menu như trước): áp dụng middleware `requireChucNang` cho route thao tác chính của cả 4 phân hệ QLSX/Kho vải/Kho hàng/Phụ kiện — trước v5.0, `ChucNangPermissions` dù có cấu hình cũng chỉ ẩn tab trên giao diện, tài khoản vẫn gọi được API nếu biết đường dẫn.
- **Giới hạn đã biết (chưa xử lý trong bản này)**: vài API dùng chung nhiều tab (VD `GET /rolls` ở Kho vải phục vụ cả 3 tab Tồn theo cây/Xuất kho/In tem) chưa bị chặn theo chức năng — chặn ở đây sẽ làm hỏng tab khác nếu 1 nhóm chỉ được ẩn 1 trong 3 tab đó; đây là chặn hành động thao tác chính, chưa phải cách ly dữ liệu tuyệt đối qua mọi API. Kho hàng hóa/Phụ kiện chưa có QR/tem như Kho vải; "Đơn khách đặt hàng" chưa gợi ý tồn còn lại real-time khi đang nhập liệu (chỉ validate lúc bấm Lưu).
- **Lưu ý kiểm thử**: đã rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa) nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển bản này. Khuyến nghị kiểm thử đầy đủ theo Bước 2.4 mục 7 trên môi trường test trước khi dùng cho dữ liệu thật.

### v4.0

- **Sửa lỗi "form không trắng khi mở lại"**: các form nhiều dòng (Nhập/Xuất kho vải, Kiểm kê, Phiếu phụ kiện...) nay tự dựng lại đúng 1 dòng trắng hoặc render lại toàn bộ tab sau khi lưu thành công, thay vì chỉ `form.reset()` (không xóa được các dòng đã thêm động).
- **Giao diện responsive cho điện thoại/tablet**: menu chuyển thành ngăn kéo (hamburger ☰) trên màn hình ≤ 900px, bảng cuộn ngang, form 1 cột — không cần thao tác trên máy tính bàn nữa cho các công đoạn xưởng (Cắt, May...).
- **Danh mục mới**: Đơn vị tính, Công đoạn may, Nhân viên (xem Bước 8).
- **Thông báo trong hệ thống**: nhân viên nhận thông báo khi có tiến độ mới tới đúng công đoạn họ được phân quyền cập nhật (xem Bước 9 và Bước 10.1).
- **QLSX**: dashboard thêm bảng đơn hàng đang sản xuất; trạng thái hiển thị kèm tên công đoạn; đơn vị tính khi tạo đơn chọn từ danh mục; form ghi tiến độ tách riêng theo công đoạn (Kỹ thuật/Cắt/May/còn lại), thêm nhân viên trải vải + cắt, màu phụ, giao việc nội bộ cho May; bỏ tính năng "Cấp vải" (chuyển hẳn qua Kho vải); "In phiếu" thêm phần xuất vải kèm đơn, và hiện "Chưa nhập kho" khi SL nhập kho = 0.
- **Kho vải**: thêm đơn giá nhập theo mã vải; tìm mã vải/mã cây bằng cách gõ tự do; xuất kho có thể gắn đơn hàng để giới hạn loại vải; quét mã QR bằng camera (thư viện `html5-qrcode`) để tìm cây khi xem tồn hoặc xuất kho; in tem khổ A6 (1 tem/trang, chọn hướng) + tìm và in lại 1 tem theo mã cây.
- **Kho hàng hóa**: thẻ kho phân loại Nhà sản xuất (liên kết đơn hàng, tự gợi ý mã/tên/màu, tự cộng tồn khi đơn "Kho nhập") hoặc Đặt ngoài (khai báo tay đơn vị); lịch sử mở rộng hiển thị chi tiết tồn theo từng màu, song song 2 đơn vị.
- **Phụ kiện**: tách phiếu Nhập (có Nhà cung cấp + Số hóa đơn, không cần đơn hàng) và phiếu Xuất (giữ nguyên, có thể gắn đơn hàng) thành 2 form riêng; nút "Lịch sử" ở Danh mục phụ kiện tự chuyển sang tab Thẻ kho và tra đúng mã.
- **Catalogue công khai**: trang `catalogue.html` không cần đăng nhập, hiển thị hàng còn tồn kho kèm ảnh/màu/giá, dùng để gửi khách hàng.
- **Phụ thuộc mới**: thư viện `html5-qrcode` (v2.3.8, tải qua CDN `cdnjs.cloudflare.com`) — phụ thuộc frontend ngoài đầu tiên của dự án, trước đó hoàn toàn thuần HTML/CSS/JS. Xem lưu ý về Internet/offline ở Bước 2.3.
- **Cách nâng cấp từ bản cũ**: xem Bước 2.3.
- **Lưu ý kiểm thử**: các thay đổi trên đã được rà soát logic/cấu trúc code kỹ (đọc lại toàn bộ file đã sửa), nhưng **chưa chạy được trên một instance SQL Server thật** trong quá trình phát triển bản này (môi trường phát triển không có sẵn SQL Server). Khuyến nghị kiểm thử thủ công đầy đủ theo Bước 10 trên môi trường test trước khi dùng cho dữ liệu thật, đặc biệt các luồng: ghi tiến độ Kho nhập → tự tạo/cộng Thẻ kho hàng hóa; xuất kho vải có gắn đơn hàng; và giao việc nội bộ công đoạn May.

### v3.0

- **Phân hệ Quản lý phụ kiện (mới)**: chuyển đổi từ file Apps Script "Code phụ kiện.gs" độc lập sang module dùng chung database, theo ledger nhập/xuất (bảng `LoaiPhuKien`, `DanhMucPhuKien`, `PhieuPhuKien`, `PhieuPhuKienChiTiet`, view `vw_TonKhoPhuKien`).
- **Liên kết Phụ kiện ↔ Đơn hàng sản xuất**: phiếu xuất phụ kiện có thể gắn `DonHangID`, cho phép báo cáo số lượng từng phụ kiện đã xuất kèm 1 đơn hàng cụ thể.
- **Mở rộng "In phiếu" của Quản lý sản xuất**: bổ sung bảng "Báo cáo năng suất Cắt/Nhập kho" (SL yêu cầu cắt, SL cắt thực tế, SL nhập kho thực tế, % hao hụt giữa các mốc — tính từ tiến độ công đoạn "Cắt"/"Kho nhập") và bảng "Phụ kiện xuất kèm đơn hàng".
- Nếu bạn đã cài v1.0 hoặc v2.0, chạy `migration_v2.sql` (nếu chưa chạy) rồi `migration_v3.sql` theo Bước 2.1/2.2 để nâng cấp không mất dữ liệu.

### v2.0

Triển khai đầy đủ 5 nghiệp vụ vốn chỉ có sẵn ở tầng schema trong v1.0: định mức vải & hao hụt, kiểm kê kho vải, in tem QR hàng loạt theo ngày nhập, cấp phát vải tự động theo đơn hàng sản xuất, và ảnh riêng theo từng màu trong Thẻ kho hàng hóa.

### v1.0

Bản giao lần đầu, bao phủ nghiệp vụ cốt lõi của 3 công cụ gốc: đăng nhập/phân quyền, danh mục dùng chung, quản lý sản xuất theo công đoạn, nhập/xuất kho vải theo cây, thẻ kho hàng hóa.

### Đề xuất giai đoạn tiếp theo (tuỳ chọn, chưa có yêu cầu cụ thể)

- **Xuất báo cáo Excel** cho các bảng dashboard/hao hụt/tồn kho/năng suất, thay vì chỉ xem trên web.
- **Gắn vai trò cố định cho công đoạn** (VD cờ "là công đoạn Cắt" / "là công đoạn May" / "là công đoạn Kho nhập" thay vì so khớp theo tên): giúp báo cáo năng suất và các form chuyên biệt ở Bước 10.1 không phụ thuộc vào việc admin không đổi tên các công đoạn trong Danh mục — đây vẫn là điểm dễ vỡ nhất của kiến trúc hiện tại, giữ nguyên xuyên suốt từ v1.0 đến v4.0 để nhất quán với các quy ước đã có, nhưng nên ưu tiên xử lý nếu tên công đoạn có khả năng bị đổi trong thực tế vận hành.
- **Chấm công / tính lương theo công đoạn may**: v4.0 mới có danh mục Nhân viên + ghi nhận "ai làm công đoạn nào, số lượng bao nhiêu" (bảng `PhanCongMay`) — đây là dữ liệu thô sẵn có để xây tiếp module tính lương theo sản lượng, nhưng công thức đơn giá/lương **chưa được yêu cầu và chưa triển khai** trong bản này.
- **Thông báo qua thời gian thực (WebSocket)** thay cho polling 45 giây, nếu sau này cần độ trễ thấp hơn — hiện tại polling đã đủ đáp ứng nhu cầu "biết trong vòng dưới 1 phút".

Không đề xuất làm ngay các mục trên nếu chưa có nhu cầu vận hành cụ thể — thêm tính năng khi chưa rõ ai dùng và dùng để làm gì là chi phí bảo trì không cần thiết.
