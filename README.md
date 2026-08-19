# Hệ thống Quản lý Nội bộ — Tổng quan kiến trúc (v4.0)

## Bối cảnh

Bốn công cụ Google Sheets/Apps Script độc lập (Quản lý sản xuất, Kho vải, Thẻ kho hàng hóa, Phụ kiện), mỗi công cụ tự quản lý "database" riêng (một Google Sheet), đăng nhập bằng so khớp văn bản thuần (mật khẩu lưu dạng chữ thường trong sheet), phân quyền tĩnh bằng checkbox hoặc chuỗi text. Yêu cầu: gộp thành một hệ thống dùng chung một database SQL Server, có đăng nhập/phân quyền tập trung theo nhóm và theo bộ phận, giữ nguyên (và chuẩn hoá lại) nghiệp vụ của cả 4 công cụ gốc, đồng thời liên kết chéo giữa Quản lý sản xuất với Kho vải và với Phụ kiện.

## Quyết định kiến trúc

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Database | SQL Server | Theo yêu cầu; đã chuẩn hoá 3TF, khoá ngoại đầy đủ, thay cho các sheet phẳng không ràng buộc. |
| Backend | Node.js + Express + `mssql` | Nhẹ, không cần Windows/IIS bắt buộc, dễ deploy trên cùng máy chủ Windows đang chạy SQL Server hoặc trên Linux/Docker sau này; đội ngũ hiện tại đã quen JavaScript (frontend gốc toàn bộ là HTML/JS). |
| Xác thực | `bcryptjs` băm mật khẩu + `express-session` | Khắc phục lỗ hổng bảo mật nghiêm trọng nhất của các bản gốc: mật khẩu lưu dạng chữ thường, ai có quyền Editor sheet đều đọc được. |
| Phân quyền | Nhóm (Group) × Phân hệ (Module) = ma trận Xem/Thêm/Sửa/Xóa, cộng thêm phân quyền theo Công đoạn sản xuất cho riêng phân hệ QLSX | Thay thế các cơ chế phân quyền không đồng nhất giữa 4 bản gốc (chuỗi "công đoạn phụ trách", checkbox theo cột, cột "role" tự do) bằng một mô hình duy nhất, mở rộng được cho phân hệ mới (Phụ kiện) mà không đổi cấu trúc. |
| Frontend | HTML/CSS/JS thuần (không framework) | Giữ tinh thần đơn giản, dễ bảo trì của bản gốc; không cần bước build; mỗi phân hệ là 1 file JS độc lập. |

## Cấu trúc thư mục

```
QLNoiBo/
├── database/
│   ├── schema.sql               # Toàn bộ DDL (v4.0, ~40 bảng + 4 view) + dữ liệu danh mục mẫu
│   ├── migration_v2.sql         # Nâng cấp database v1.0 -> v2.0 (idempotent)
│   ├── migration_v3.sql         # Nâng cấp database v2.0 -> v3.0: phan he Phu kien (idempotent)
│   └── migration_v4.sql         # Nâng cấp database v3.0 -> v4.0: xem PHẦN E (idempotent)
├── backend/
│   ├── server.js                # Điểm khởi động Express
│   ├── db.js                    # Kết nối SQL Server (connection pool)
│   ├── middleware/auth.js       # Xác thực + kiểm tra phân quyền
│   ├── routes/                  # auth, users, danhmuc, qlsx, khovai, khohang, phukien, upload,
│   │                             # notifications (v4.0), public (v4.0, KHÔNG qua requireAuth)
│   └── utils/                   # loadUserContext, seed_admin, crudFactory, checkOverdue, vaiXuatService
├── frontend/
│   ├── login.html, index.html, catalogue.html   # catalogue.html: trang công khai (v4.0), không cần đăng nhập
│   ├── css/style.css
│   └── js/                      # common.js, app.js, catalogue.js, module.*.js (1 file / phân hệ)
├── HUONG_DAN_CAI_DAT.md
└── README.md
```

## Phân hệ & phân quyền

6 phân hệ, hiển thị trên sidebar tuỳ theo quyền `CanView` của user trên từng `ModuleCode`:

1. **DANHMUC** — Danh mục dùng chung: bộ phận, loại vải, màu sắc, mã vải, phụ liệu, nhà gia công/in thêu, nhà cung cấp, khách hàng, danh mục thẻ kho, công đoạn sản xuất, cấu hình hệ thống, **đơn vị tính, công đoạn may, nhân viên (mới, v4.0)**.
2. **USERS** — Quản lý tài khoản, nhóm quyền, ma trận phân quyền.
3. **QLSX** — Quản lý sản xuất: đơn hàng, tiến độ theo công đoạn (tự động chuyển tiếp, **form nhập liệu khác nhau theo từng công đoạn — v4.0**), giao việc nội bộ cho nhân viên May khi nhà làm, giao/nhận nhà gia công & nhà in, **báo cáo năng suất Cắt/Nhập kho + xuất vải + phụ kiện xuất kèm đơn hàng trong "In phiếu"**, dashboard (kèm bảng đơn hàng đang sản xuất — v4.0), **thông báo cho nhân viên khi có tiến độ mới tới công đoạn của họ (v4.0)**, cảnh báo trễ hạn qua email. *(Tính năng "Cấp vải" thủ công trong QLSX đã được loại bỏ ở v4.0 — xuất vải cho đơn hàng nay thực hiện duy nhất qua phân hệ Kho vải.)*
4. **KHOVAI** — Kho vải: nhập/xuất theo cây vải (mã cây + QR tự sinh), **đơn giá nhập theo mã vải, quét QR bằng camera để tìm cây / xuất kho (v4.0)**, xuất kho có thể **gắn với 1 đơn hàng sản xuất để giới hạn chỉ chọn đúng loại vải của đơn đó (v4.0)**, tồn kho theo mã vải và theo cây, định mức & hao hụt, kiểm kê kho vải, **in tem khổ A6 (1 tem/trang, chọn hướng dọc/ngang) + tìm và in lại 1 tem theo mã cây (v4.0)**.
5. **KHOHANG** — Thẻ kho hàng hóa: thẻ kho theo mã hàng + màu (mỗi màu có ảnh riêng), **phân loại Nhà sản xuất / Đặt ngoài — thẻ kho "Nhà sản xuất" liên kết trực tiếp 1 đơn hàng sản xuất, tự gợi ý mã hàng/tên hàng/màu chính, và được tự động cập nhật tồn khi đơn hàng đó "Nhập kho" (v4.0)**, **lịch sử chi tiết tồn theo từng màu, hiển thị song song đơn vị cơ bản/quy đổi (v4.0)**, đơn khách đặt hàng, tồn kho tự động trừ/hoàn khi hủy đơn, **Catalogue công khai không cần đăng nhập cho khách xem hàng còn tồn (v4.0, xem mục 10.5 trong HUONG_DAN_CAI_DAT.md)**.
6. **PHUKIEN** — Quản lý phụ kiện: mác, thẻ bài, chun, dây rút, dây cổ... theo ledger nhập/xuất; danh mục phụ kiện với size/đơn vị quy đổi; **phiếu Nhập và phiếu Xuất nay là 2 form tách riêng — phiếu Nhập có Nhà cung cấp + Số hóa đơn, không cần gắn đơn hàng; phiếu Xuất giữ nguyên có thể gắn đơn hàng sản xuất (v4.0)**; thẻ kho/tồn kho chi tiết hoặc tổng hợp theo loại.

`Admin` (cờ `IsAdmin=1` trên Group) luôn thấy và làm được mọi thứ trên mọi phân hệ, bỏ qua bảng `Permissions`.

Ngoài 6 phân hệ trên (yêu cầu đăng nhập), v4.0 có thêm **1 trang công khai** `catalogue.html` — xem Catalogue sản phẩm còn tồn kho, không cần tài khoản, dùng để gửi link cho khách hàng.

## Những gì đã chuẩn hoá lại so với bản gốc (có chủ đích, không phải thiếu sót)

- **Ledger thay vì bộ đếm trực tiếp / dòng phẳng**: nhập/xuất kho vải, kho hàng hóa, và phụ kiện đều được ghi thành phiếu (header + chi tiết) thay vì cộng/trừ trực tiếp vào 1 dòng tổng hoặc lặp lại header trên mỗi dòng chi tiết (cách bản gốc "Code phụ kiện.gs" lưu vào sheet `Data_Nhap_Xuat`) — tránh sai lệch khi có thao tác đồng thời, và giữ được lịch sử đầy đủ để truy vết.
- **`DonHangChiTietVai` tách khỏi JSON blob**: bản gốc lưu cấu trúc vải/màu dưới dạng chuỗi JSON trong 1 ô; bản này tách thành bảng con có khoá ngoại tới `LoaiVai`/`MauSac`, truy vấn/báo cáo được bằng SQL thay vì phải parse JSON ở tầng ứng dụng.
- **`NhaGiaCong` gộp Nhà gia công + Nhà in/thêu** thành 1 bảng với cột `LoaiHinh`, thay vì 2 danh sách cứng trong 2 cột của 1 sheet — thêm loại hình thứ 3 trong tương lai không cần đổi cấu trúc.
- **`vaiXuatService.js` dùng chung cho 2 phân hệ**: cấp phát vải theo đơn hàng (QLSX) và xuất kho thủ công (Kho vải) đi qua cùng một hàm xử lý duy nhất thay vì viết lại logic 2 lần.
- **Phụ kiện xuất kèm đơn hàng qua `DonHangID` thay vì trường text tự do**: bản gốc chỉ có ô "Mã Đơn Hàng" dạng text, không đối chiếu được với đơn hàng thật; bản này cho phép gắn thẳng vào `DonHangSanXuat` khi đơn tồn tại trong hệ thống, đồng thời vẫn giữ trường text `MaDon` cho các trường hợp đơn hàng ngoài hệ thống.
- **(v4.0) Giữ nguyên công thức quy đổi `LoaiRi` khi thêm nhãn đơn vị tính**: thay vì đổi cách tính Cái↔Ri đang chạy ổn định ở các phân hệ, v4.0 chỉ thêm 2 cột nhãn hiển thị `DonViCoBan`/`DonViQuyDoi` (VD "Cái"/"Ri") đi kèm `LoaiRi` sẵn có — tránh rủi ro sai số khi đổi công thức đang được nhiều phân hệ dùng chung.
- **(v4.0) "Kho nhập" tự động tạo/liên kết Thẻ kho hàng hóa theo đơn hàng**: khi ghi tiến độ tại công đoạn "Kho nhập", hệ thống tự tạo `TheKhoHangHoa` (nếu đơn hàng đó chưa có) và cộng thêm đúng phần chênh lệch (không cộng trùng số đã nhập lần trước) vào tồn theo màu — giữ đúng quy ước "nhập số lũy kế" đã dùng cho `TienDoChiTietMau` từ trước.
- **(v4.0) Thông báo dùng polling, không dùng WebSocket**: bảng `ThongBao` + endpoint `/api/notifications`, frontend hỏi lại mỗi 45 giây — lựa chọn thực tế, phù hợp kiến trúc "không framework, không hạ tầng realtime" hiện có, thay vì thêm WebSocket/Socket.IO chỉ để phục vụ 1 tính năng.
- **(v4.0) Thêm thư viện ngoài `html5-qrcode` (qua CDN)**: đây là phụ thuộc frontend đầu tiên khác 0 của dự án (trước đó thuần HTML/CSS/JS không thư viện ngoài) — cần để quét QR bằng camera; máy chủ chạy backend/frontend **cần có Internet để tải file JS này lần đầu** (hoặc tự tải về host tĩnh nội bộ nếu xưởng không có Internet — xem lưu ý ở `HUONG_DAN_CAI_DAT.md` PHẦN E).

## Nhật ký cập nhật

**v4.0** — Sửa lỗi form không reset khi mở lại; giao diện responsive cho điện thoại/tablet; thêm danh mục Đơn vị tính, Công đoạn may, Nhân viên; ghi tiến độ QLSX có form riêng theo từng công đoạn (Kỹ thuật/Cắt/May/còn lại), giao việc nội bộ cho nhân viên May; bỏ "Cấp vải" trong QLSX — xuất vải nay chỉ qua phân hệ Kho vải, có thể gắn theo đơn hàng; Kho vải thêm đơn giá nhập, quét QR camera, in tem A6; Kho hàng hóa thêm phân loại Nhà sản xuất/Đặt ngoài liên kết đơn hàng, tự cập nhật tồn khi Kho nhập, lịch sử chi tiết theo màu; Phụ kiện tách phiếu Nhập/Xuất, thêm Nhà cung cấp + Số hóa đơn cho phiếu Nhập; thêm thông báo trong hệ thống khi có tiến độ mới; thêm trang Catalogue công khai không cần đăng nhập. Cách nâng cấp từ bản cũ: xem `HUONG_DAN_CAI_DAT.md` PHẦN E.

**v3.0** — Thêm phân hệ Quản lý phụ kiện (chuyển đổi từ "Code phụ kiện.gs" độc lập), liên kết xuất phụ kiện với đơn hàng sản xuất, và mở rộng "In phiếu" của Quản lý sản xuất với báo cáo năng suất Cắt/Nhập kho + phụ kiện xuất kèm đơn hàng. Cách nâng cấp từ bản cũ: xem `HUONG_DAN_CAI_DAT.md` Bước 2.1/2.2.

**v2.0** — Triển khai định mức vải & hao hụt, kiểm kê kho vải, in tem QR hàng loạt, cấp phát vải tự động theo đơn hàng sản xuất, ảnh riêng theo từng màu trong Thẻ kho hàng hóa.

**v1.0** — Bản giao lần đầu, bao phủ nghiệp vụ cốt lõi của 3 công cụ gốc (Quản lý sản xuất, Kho vải, Thẻ kho hàng hóa).
