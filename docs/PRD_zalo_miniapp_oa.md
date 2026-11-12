# PRD — Đưa thẻ kho hàng hóa lên Zalo (OA + Mini App)

**Ngày:** 2026-11-05 · **Yêu cầu:** Nguyen · **Trạng thái:** CHỜ DUYỆT, chưa viết dòng code nào
**Chốt từ Nguyen:** người dùng = **cả khách lẫn nhân viên**; phạm vi = **xem + đặt đơn + theo dõi đơn & công nợ**.

---

## 1. Vấn đề

Khách sỉ/shop hiện xem hàng qua trang catalogue web (`thoitrangmoyn.id.vn`) và đặt hàng phần lớn
qua chat Zalo. Hai hệ quả:

- Đơn chảy vào Zalo chat → nhân viên gõ lại vào phần mềm → sai sót và chậm.
- Khách hỏi "còn hàng không", "đơn tôi tới đâu rồi", "tôi còn nợ bao nhiêu" đều phải có người trả lời tay.

Khách đã ở sẵn trên Zalo. Đưa chính các màn đó vào Zalo là bỏ được bước gõ lại và bước trả lời tay.

## 2. Nền đã có (không phải làm lại)

| Thứ Zalo Mini App bắt buộc phải có | Hiện trạng |
|---|---|
| Tên miền + HTTPS thật để khai whitelist | ✅ `thoitrangmoyn.id.vn` qua Cloudflare Tunnel |
| API công khai không dùng phiên đăng nhập nội bộ | ✅ `/api/public/catalogue`, `/catalogue-danhmuc`, `/danhmuc/:slug` |
| Luồng đăng nhập khách + đặt đơn + xem đơn | ✅ `/khach/dangnhap`, `/khach/datdon`, `/khach/donhang` |
| Tách bề mặt công khai khỏi phần mềm nội bộ | ✅ `PUBLIC_PORT` + danh sách trắng đường dẫn trong `server.js` |
| Cờ công khai theo danh mục | ✅ `TheKhoDanhMuc.CongKhai` / `Slug` / `TieuDeCongKhai` |

**Chưa có:** công nợ cho khách tự xem (công nợ đang nằm trong `routes/congno.js` nội bộ), và danh tính
Zalo (`TaiKhoanKhach` hiện là tên đăng nhập + mật khẩu do nhân viên phát tay).

## 3. Hai thứ KHÁC NHAU, đừng chọn một

- **Zalo OA** không chứa được thẻ kho. Nó là kênh chat/thông báo + menu; chỉ trỏ link được.
- **Zalo Mini App** là nơi hiển thị được, **nhưng bắt buộc gắn vào một OA**.

⇒ Không phải "OA hay Mini App" mà là **OA trước, Mini App sau**.

## 4. Tiêu chí thành công

| Đo cái gì | Mốc |
|---|---|
| Đơn khách tự đặt / tổng đơn khách sỉ | ≥ 50% sau 2 tháng kể từ khi mở Mini App |
| Số lần nhân viên phải gõ lại đơn từ chat | giảm ≥ 50% |
| Câu hỏi "còn hàng không / đơn tới đâu / nợ bao nhiêu" trong chat | giảm ≥ 50% |
| Sự cố lộ dữ liệu (khách thấy dữ liệu của khách khác, hoặc thấy giá vốn/tồn nội bộ) | **0 — đây là tiêu chí chặn, không phải chỉ tiêu** |

Nếu Giai đoạn 0 (xem §6) cho thấy khách không bấm vào link, **dừng lại**, không làm Mini App.

## 5. Phạm vi

**Trong phạm vi**

- Khách: xem hàng (ảnh, giá, còn hàng), đặt đơn, xem đơn đã đặt, xem công nợ **của chính mình**.
- Đăng nhập bằng số điện thoại Zalo, thay tên đăng nhập/mật khẩu phát tay.
- OA: menu trỏ Mini App; thông báo đơn được xác nhận.

**Ngoài phạm vi (lần này)**

- Thanh toán trong app.
- Nhân viên tra tồn kho **bằng Mini App** — xem §6 Giai đoạn 3, có lý do.
- Đổi bất cứ luồng nội bộ nào: duyệt đơn, trừ tồn, ghi công nợ vẫn y nguyên.

## 6. Kế hoạch theo giai đoạn

### Giai đoạn 0 — OA + link (0,5 ngày, gần như không code) 🔸 làm trước, đo rồi mới quyết

Lập OA, đặt nút menu trỏ `https://thoitrangmoyn.id.vn`, gửi cho 5–10 khách sỉ thân thiết.
Đếm lượt mở trong 2 tuần. **Đây là cổng chặn**: không ai bấm thì toàn bộ phần dưới không đáng làm.

### Giai đoạn 1 — Nền danh tính + công nợ (5–8 ngày)

Không phụ thuộc Zalo, làm được ngay, và tự nó đã có ích cho trang web hiện tại.

1. `TaiKhoanKhach` + cột `ZaloUserID`, `SDTZalo`; đăng nhập bằng số điện thoại (OTP hoặc Zalo trả về).
2. API mới `/api/public/khach/congno` — **chỉ trả nợ của chính tài khoản đang đăng nhập**,
   `KhachHangID` lấy từ phiên trên server, **không bao giờ nhận từ client**.
3. 🔴 **Backfill `KhachHangID`** cho phiếu bán hàng / phiếu thu cũ (nợ Track B từ v8.07) — xem Rủi ro R1.
4. Đối chiếu số nợ hiển thị cho khách với sổ công nợ nội bộ, **từng khách một**, trước khi bật.

### Giai đoạn 2 — Mini App cho khách (10–15 ngày + thời gian Zalo duyệt)

Viết giao diện bằng ZMP/React (Mini App **không** nhận website nhúng thẳng), gọi lại đúng
`/api/public/*` đã có. 4 màn: Danh mục → Chi tiết hàng → Giỏ/Đặt đơn → Đơn & Công nợ của tôi.
OA bắn thông báo khi đơn chuyển trạng thái.

### Giai đoạn 3 — Nhân viên tra tồn kho (1 ngày, **không làm Mini App**)

**Khuyến nghị: dùng đúng phần mềm hiện có.** QLNoiBo đã là PWA cài được lên điện thoại, đã có
`pm.thoitrangmoyn.id.vn` kèm OTP Cloudflare Access. Việc cần làm chỉ là hướng dẫn nhân viên cài và
chỉnh lại màn thẻ kho cho dễ đọc trên màn hình nhỏ.

Làm Mini App nội bộ thì: phải qua review của Zalo cho một app không phục vụ người tiêu dùng, và
**bề mặt dữ liệu nội bộ (tồn thực, giá vốn) bị đẩy ra một kênh công khai** — đổi lại gần như không
được gì so với PWA. Nếu vẫn muốn, điều kiện tối thiểu là tách riêng app, tách riêng API, và chỉ cho
danh sách Zalo ID được duyệt tay.

## 7. Rủi ro

| | Rủi ro | Hậu quả | Xử lý |
|---|---|---|---|
| **R1** 🔴 | Phiếu bán hàng/phiếu thu cũ **chưa gắn `KhachHangID`** (nợ Track B, v8.07) | Khách mở app thấy **số nợ thiếu** → cãi nhau về tiền | Backfill + đối chiếu từng khách **trước** khi bật công nợ. Chưa đối chiếu xong thì **không mở mục Công nợ** |
| **R2** 🔴 | API công khai lọc sai → khách A thấy dữ liệu khách B | Lộ doanh số, giá, công nợ | Mọi truy vấn lọc theo `KhachHangID` **lấy từ phiên server**; viết bộ tự kiểm ghim đúng điều này |
| **R3** | Chính sách hiện tại: khách **không** thấy số tồn (ghi trong `migration` tài khoản khách), nhưng `/api/public/catalogue` đang trả `TongTon` | Lộ năng lực kho, hoặc khách đặt hụt | Chốt: hiện **"Còn hàng / Hết hàng"**, không hiện số — xem Câu hỏi mở Q2 |
| **R4** | Giá: khách sỉ có chiết khấu riêng (CK shop/NPP, v6.21), catalogue đang hiện `GiaBan` chung | Khách thấy giá không phải giá của mình → mất lòng tin | Chốt Q1 trước khi code |
| **R5** | Thủ tục Zalo: OA xác thực cần ĐKKD; Mini App phải qua review; phí OA/ZNS | Trễ hoặc phát sinh chi phí | **Tôi chưa xác minh được** — xem §9 |
| **R6** | Toàn bộ chạy qua Cloudflare Tunnel về **một máy Windows ở xưởng** | Mini App kéo lượng truy cập lớn hơn web → chậm hoặc sập giờ cao điểm | Giới hạn tần suất cho `/api/public/*`, cache ảnh, đo trước khi mở rộng |

## 8. Câu hỏi mở — cần Nguyen trả lời trước khi code

- **Q1 — Giá:** khách thấy **giá chung** hay **giá theo chiết khấu của chính khách đó**?
- **Q2 — Tồn:** hiện **"Còn / Hết"** hay **số lượng thật**?
- **Q3 — Công nợ:** chỉ **số dư tổng**, hay **từng phiếu** (ngày, số tiền, đã trả)?
- **Q4 — Đơn mới:** vẫn giữ luồng "Chờ xác nhận → nhân viên bấm Xác nhận mới trừ tồn" chứ?
- **Q5 — Pháp lý:** đã có **ĐKKD** đứng tên để xác thực OA chưa?

## 9. Điều tôi chưa kiểm chứng được

Trong phiên này tôi **không tải được tài liệu Zalo** (trang dựng bằng JS, browser pane bị chặn truy
cập). Vì vậy **phí xác thực OA, phí ZNS, quy trình và thời gian duyệt Mini App hiện hành chưa được
xác nhận** — con số/điều kiện phải lấy từ `oa.zalo.me` và `miniapp.zalo.me`, không lấy theo trí nhớ.
Toàn bộ ước lượng công ở §6 là **công lập trình**, chưa gồm thời gian chờ duyệt.

## 10. Đề xuất

Duyệt **Giai đoạn 0 + Giai đoạn 1** trước. Giai đoạn 0 gần như không tốn gì mà trả lời được câu
đắt nhất: khách có thật sự dùng không. Giai đoạn 1 có ích kể cả khi không bao giờ làm Mini App —
backfill `KhachHangID` và màn công nợ cho khách dùng được ngay trên web hiện tại.

Giai đoạn 2 chỉ bật khi Giai đoạn 0 đạt mốc và R1 đã đối chiếu xong.
