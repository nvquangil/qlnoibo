# PRD v8.98 — Điện thoại tự nhận bản mới (không cần Ctrl+F5)

**Ngày:** 2026-10-23 · **Nguyen:** *"2 thay đổi 8.96 và 8.97 ở bản mobile chưa thể hiện"*

## 1. Nguyên nhân (đọc code, chưa cầm máy điện thoại nên là chẩn đoán)

Mobile **không có bố cục riêng**: `style.css` chỉ thu sidebar và cho bảng cuộn ngang, không ẩn cột nào; service worker (`sw.js`) network-first, không đệm JS. Vậy điện thoại "không thấy gì đổi" là vì **đang chạy bộ JS cũ trong bộ nhớ**:

- App được ghim ra màn hình chính (PWA) hoặc để nguyên tab Safari/Chrome nhiều ngày. Mở lại là **tiếp tục trang cũ**, không tải lại `index.html`, nên không bao giờ thấy số `?v=` mới. Máy tính không gặp vì mỗi lần deploy anh Ctrl+F5.
- Không có phím F5 nào trên điện thoại để bảo mọi người bấm — và sẽ lặp lại ở **mọi** bản sau.

Kiểm chứng nhanh: trên điện thoại, đóng hẳn app (vuốt khỏi đa nhiệm) rồi mở lại → nếu ảnh cây / cột lệnh SX hiện ra thì đúng chẩn đoán.

## 2. Cách chữa — `frontend/js/app.js` (không backend, không đụng `sw.js`)

| Khi nào | Làm gì |
|---|---|
| Người dùng **quay lại app** (tab hiện lại, app mở từ nền, nút Back) | tải `index.html` với `cache:'no-store'`, so **dấu vân phiên bản** (tập `?v=` của `/js/*` + `/css/*`) với trang đang chạy. Khác ⇒ **tự tải lại** nếu không có modal nào mở và không đang gõ ô nào |
| Khác nhưng **đang mở modal / đang gõ** | không tự tải (mất dữ liệu đang nhập) — hiện **thanh vàng** trên cùng: *"Phần mềm có bản cập nhật mới"* + nút **Tải lại ngay** / **Để sau** |
| App mở suốt (máy để bảng tồn kho cả ngày) | kiểm **mỗi 10 phút**, chỉ hiện thanh vàng, không tự tải |
| Chống lặp | tối đa 1 lần hỏi/phút; vừa tự tải lại < 2 phút mà vẫn "khác" (proxy đệm, đang copy dở) ⇒ chỉ hiện thanh, không tải nữa. Chỉ đếm `?v=` của file **mình** dưới `/js/`,`/css/` — script chèn lúc chạy (leaflet DMS, qrcode) không tính, nếu không trang luôn "khác" ⇒ tải vô tận |
| Nhìn là biết | dưới tên người dùng ở sidebar ghi **`v8.98`** (số `?v=` lớn nhất của trang đang chạy) — mở điện thoại ra là biết máy đó đang bản nào |

## 3. Deploy

> 🔴 `server\D:\QLSX` là máy chạy thật. **Lần này điện thoại vẫn phải tải lại tay MỘT lần** — cơ chế tự tải chỉ có tác dụng từ khi máy đã chạy bản 8.98. Từ lần sau trở đi không cần nữa.

**Bước 1 — kiểm tại C:**
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\app.js
```

**Bước 2 — copy 2 file sang `server\D:\QLSX\`**
```
frontend\js\app.js
frontend\index.html
```
(Không cần `pm2 restart` — file tĩnh. Nếu 4 file của v8.97 chưa copy thì copy luôn cùng lúc.)

**Bước 3 — máy chủ**
```powershell
findstr /C:"theoDoiBanMoi" D:\QLSX\frontend\js\app.js
findstr /C:"app.js?v=8.98" D:\QLSX\frontend\index.html
```

**Bước 4 — điện thoại, tải lại tay một lần (chọn đúng trường hợp):**
- **Android — Chrome hoặc app ghim màn hình chính:** vuốt app khỏi đa nhiệm → mở lại. Nếu vẫn cũ: kéo trang xuống để refresh; vẫn cũ nữa: Chrome → ⋮ → Cài đặt → Cài đặt trang web → Bộ nhớ → xóa dữ liệu của trang.
- **iPhone — Safari:** kéo trang xuống để refresh. **App ghim màn hình chính:** vuốt lên đóng hẳn → mở lại. Nếu vẫn cũ: Cài đặt → Safari → Nâng cao → Dữ liệu trang web → xóa trang này (phải đăng nhập lại).
- Xác nhận: dưới tên người dùng ở menu trái phải thấy **v8.98**.

**Bước 5 — thử cơ chế mới (sau khi điện thoại đã ở 8.98):** trên máy chủ đổi tạm `module.khohang.js?v=8.97` → `?v=8.99` trong `D:\QLSX\frontend\index.html`, trên điện thoại chuyển sang app khác ≥ 1 phút rồi quay lại → phải tự tải lại và sidebar hiện `v8.99`. Đổi lại `8.97` sau khi thử (điện thoại sẽ tự tải lại lần nữa về `v8.98`).

**Bước 6** — commit `"v8.98 dien thoai tu tai lai khi co ban moi"` → push.

## 4. Ngoài phạm vi

- `sw.js` vẫn đệm `index.html` lúc cài để dùng khi **mất mạng hoàn toàn** — khi có mạng lại, cơ chế trên sẽ kéo bản mới. Không đổi để không thêm một tầng cache phải nghĩ.
- Máy tính để bàn: từ nay cũng tự nhận bản mới khi quay lại tab, nhưng anh vẫn nên Ctrl+F5 ngay sau deploy như cũ để thử nghiệm.
