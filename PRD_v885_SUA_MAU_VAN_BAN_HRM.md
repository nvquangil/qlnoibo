# PRD v8.85 — Tự sửa mẫu văn bản nhân sự

Trạng thái: **ĐÃ CHỐT + ĐÃ VIẾT CODE** — chờ chạy migration + test.
Ngày: 2026-10-10

**Hai điểm đã chốt (mục 4):**

- **Q1 → (b) Trình soạn thảo như Word.** Làm bằng `contenteditable` + `document.execCommand`, **không
  thêm thư viện**. Lý do đi chệch khỏi đề xuất ban đầu của tôi: Nguyen muốn sửa trực quan, mà máy
  không tải được file thư viện về để tự host, nên lấy thứ trình duyệt có sẵn. Đổi lại: `execCommand`
  đã bị đánh dấu *deprecated*. Nếu một ngày trình duyệt bỏ nó, **các nút định dạng mất tác dụng,
  phần gõ chữ vẫn chạy** — không mất mẫu, không vỡ bản in.
- **Q2 → cả 6 mẫu** (thêm Phụ lục, Thanh lý, khuôn chung quyết định).

---

## 1. Yêu cầu

Nguyen: *"các mẫu liên quan đến nhân sự thêm chức năng sửa file mẫu để chủ động"*.

Hiện mẫu hợp đồng / quyết định **ghi cứng trong `module.hrm.js`**. Đổi một câu chữ — thêm một điều
khoản, sửa giờ làm việc, đổi tên giám đốc — đều phải sửa code, copy file, restart. Nguyen muốn tự làm.

---

## 2. Vì sao việc này khác các việc trước

Đây là chỗ duy nhất trong hệ thống cho người dùng **nhập nội dung rồi hệ thống đem đi hiển thị
nguyên trạng**. Mọi chỗ khác chỉ nhập dữ liệu (số, ngày, tên) và code quyết định cách hiển thị.

⚠️ Hai hệ quả phải xử lý, không được bỏ qua:

**Sửa hỏng thì mất mẫu.** Người dùng xóa nhầm một thẻ, mẫu vỡ bố cục hoặc trắng trang. Phải có
**nút khôi phục mẫu gốc** và **lịch sử phiên bản** để quay lại bản trước.

**Nội dung người dùng nhập được chèn thẳng vào trang in.** Nếu lấy mẫu từ CSDL rồi dựng HTML, bất kỳ
ai sửa được mẫu cũng chèn được mã chạy trong trình duyệt người xem. Ở đây rủi ro thấp (chỉ người có
quyền HRM sửa, và bản in nằm trong iframe riêng), nhưng vẫn phải lọc thẻ nguy hiểm —
`<script>`, `<iframe>`, `on*=`, `javascript:`.

---

## 3. Thiết kế

### Mẫu lưu ở CSDL, code giữ bản gốc làm lưới an toàn

| | |
|---|---|
| Bảng `MauVanBanHRM` | `MaMau` (HDLD_CHINHTHUC / HDLD_THUVIEC / QD_TANGLUONG / …), `TenMau`, `NoiDung`, `PhienBan`, `NguoiSuaID`, `CapNhatLuc` |
| Lấy mẫu khi in | có trong CSDL → dùng; **không có hoặc lỗi → dùng mẫu gốc trong code** |
| Khôi phục | nút "Khôi phục mẫu gốc" ghi đè bằng bản trong code |

Nhờ lưới an toàn này, **CSDL chưa chạy migration vẫn in bình thường** — y như mọi việc trước.

### Biến thay thế

Mẫu viết `{{HoTen}}`, `{{SoHopDong}}`, `{{LuongCoBan}}`… Khi in, hệ thống thay bằng dữ liệu thật.

Màn sửa mẫu hiện **bảng tra biến** bên cạnh (bấm để chèn), nhóm theo: thông tin nhân viên · thông tin
hợp đồng · thông tin công ty · ngày tháng.

Biến gõ sai tên → in ra nguyên `{{XXX}}`. Màn sửa mẫu **cảnh báo ngay** khi phát hiện biến lạ, không
đợi tới lúc in mới biết.

Vài biến cần xử lý riêng, không chỉ thay chuỗi:
- `{{LuongCoBan_BangChu}}` — đọc số thành chữ (`docSoTienBangChu` đã có)
- `{{NgayKy_DayDu}}` — "Hà Nội, ngày 05 tháng 10 năm 2026"
- `{{SoNamHopDong}}`, `{{SoNgayThuViec}}` — tính từ hai mốc ngày
- Ô trống → in dấu chấm để điền tay, **không in "0 đồng"** (giữ nguyên quy tắc v8.82)

---

## 4. 🔴 HAI ĐIỂM CẦN CHỐT

**Q1 — Sửa bằng công cụ gì?**

| Phương án | Được | Mất |
|---|---|---|
| **(a) Ô soạn thảo HTML + nút Xem trước** | Không thêm thư viện. Toàn quyền về bố cục. Hợp với người đã quen HTML. | Phải biết thẻ HTML. Gõ sai thẻ là vỡ bố cục. |
| **(b) Trình soạn thảo WYSIWYG** (như Word) | Ai cũng sửa được, không cần biết HTML. | Phải thêm thư viện mới (Quill/TinyMCE ~200KB). Hệ thống hiện **không có thư viện soạn thảo nào** — đi ngược nguyên tắc "không thêm phụ thuộc" đang theo. Vẫn sinh HTML lỏng lẻo, khó giữ bố cục văn bản hành chính. |
| **(c) Tải lên file .docx làm mẫu** | Đúng thói quen làm việc nhất. | **Không khả thi** với kiến trúc hiện tại: hệ thống in bằng `printHtml()` + Ctrl+P, không có bộ render .docx. Muốn làm phải thêm thư viện sinh .docx và đổi toàn bộ đường in — một dự án riêng. |

Tôi đề xuất **(a)**: nhanh, không thêm phụ thuộc, và mẫu văn bản hành chính vốn ít thay đổi bố cục —
phần hay sửa là câu chữ, sửa trong HTML thô vẫn dễ.

**Q2 — Phạm vi mẫu nào?**
- Chỉ 3 mẫu đã làm (HĐLĐ chính thức, HĐ thử việc, QĐ tăng lương), hay
- Cả 6 (thêm Phụ lục, Thanh lý, và khuôn chung cho 4 loại quyết định còn lại)?

---

## 5. Phạm vi

**Trong**: bảng mẫu + migration · route CRUD mẫu (gate HRM) · màn sửa mẫu có xem trước · bảng tra
biến · lọc thẻ nguy hiểm · nút khôi phục bản gốc · lịch sử phiên bản · bộ tự kiểm.

**Ngoài**: ❌ sinh file .docx · ❌ trình soạn thảo WYSIWYG (trừ khi Q1 chọn (b)) · ❌ mẫu cho module
khác ngoài HRM · ❌ phân quyền riêng cho việc sửa mẫu (dùng chung `HRM/edit`).

---

## 6. Rủi ro

⚠️ **Sửa mẫu là sửa văn bản pháp lý.** Một câu điều khoản bị xóa nhầm vẫn in ra bình thường và vẫn
được ký. Hệ thống không thể biết nội dung đúng hay sai — chỉ bảo đảm không vỡ bố cục. Đề nghị: sau mỗi
lần sửa mẫu, **in thử một bản** đối chiếu với mẫu Word gốc trước khi dùng để ký thật.

⚠️ **Lịch sử phiên bản chỉ giữ N bản gần nhất** (đề xuất 10) để bảng không phình. Muốn giữ vĩnh viễn
thì phải nói rõ từ đầu.

---

## 7. Đã làm gì (2026-10-10)

| File | Việc |
|---|---|
| `database/migration_v878.sql` | 2 bảng `MauVanBanHRM` + `MauVanBanHRM_LichSu`; **cố ý không seed**; đăng ký `ChucNang HRM/mauvanban` |
| `backend/routes/hrm.js` | `locMauAnToan()`; GET/PUT/DELETE `/mauvanban`, GET `/mauvanban/:ma/lichsu`; `GIU_LICH_SU = 10` |
| `frontend/js/module.hrm.js` | `MAU_GOC` (6 mẫu, biến `{{...}}`), `layMau` / `thayBien` / `bienLa` / `inVanBan`, 6 hàm dựng biến, tab **Mẫu văn bản**; **gỡ** `mauHopDongChinhThuc` / `mauHopDongThuViec` / `mauQuyetDinhTangLuong` / `mauQuyetDinhChung` / `khoiBenA` / `khoiBenB` / `tieuDeVanBan` |
| `frontend/index.html` | `module.hrm.js?v=8.85` |
| `backend/utils/kiem_ho_so_nhan_su.js` | mục 7a–7g: một nguồn mẫu gốc, lưới an toàn khi chưa chạy migration, lọc thẻ, lịch sử, ChucNang, đối chiếu **mọi biến trong mẫu phải có thật** |

**Quyết định đáng ghi lại:**

1. **Mẫu gốc chỉ nằm trong code, không seed vào CSDL.** Seed là tạo bản sao thứ hai của cùng một văn
   bản pháp lý: sửa code thì CSDL không đổi theo, sửa CSDL thì code không đổi theo — sớm muộn hai bản
   trôi khỏi nhau và không ai biết bản nào đang được in. Hệ quả tốt kèm theo: **chưa chạy migration
   vẫn in bình thường**.
2. **Gỡ hẳn các hàm mẫu cũ**, không để lại làm "tham khảo" — cùng lý do trên, ở mức nguy hiểm hơn vì
   người sau sẽ sửa nhầm vào đó rồi tưởng đã sửa mẫu.
3. **`GET /mauvanban` KHÔNG gate theo chức năng.** Mọi bản in đều gọi route này để lấy mẫu; chặn ở đây
   là ai không được vào tab "Mẫu văn bản" cũng không in được hợp đồng. Ba route sửa/xóa/lịch sử mới gate.
4. **Biến gõ sai tên in ra nguyên `{{Ten}}`**, không thay bằng chuỗi rỗng — lỗi im lặng trong văn bản
   pháp lý tệ hơn lỗi nhìn thấy. Màn sửa mẫu cảnh báo ngay lúc gõ, không đợi tới lúc in.

## 8. v8.86 — sửa bảng trong ô soạn thảo (2026-10-10)

Nguyen: *"không xóa được bảng"* (khoanh đỏ hai bảng BÊN A / BÊN B của HĐLĐ), rồi *"hoặc xóa cột xóa
dòng, thêm dòng, thêm cột"*.

**Vì sao không xóa được:** trong `contenteditable`, bảng là **một khối**. Bôi đen rồi bấm Delete chỉ
xóa chữ trong các ô — cái bảng rỗng vẫn nằm nguyên đó. `execCommand` cũng không có lệnh nào cho bảng.
Phải thao tác thẳng trên DOM.

Thêm 5 nút vào thanh công cụ: **＋Dòng · －Dòng · ＋Cột · －Cột · 🗑 Bảng**. Cách dùng: bấm chuột vào
một ô bất kỳ trong bảng rồi bấm nút.

Hai chỗ phải cẩn thận:

- **Nút chặn `mousedown`.** Không chặn thì bấm nút là ô soạn thảo mất focus, con trỏ bay mất, không
  còn biết đang đứng ở ô nào. Áp luôn cho cả nút định dạng và nút biến — trước đây chúng dựa vào
  `o.focus()` khôi phục con trỏ, không chắc chắn bằng.
- **Ô gộp (`colspan`).** Mẫu có sẵn dùng colspan (dòng "Nơi cấp", "Nơi cư trú" gộp 4 ô). Thêm/xóa cột
  ở bảng như vậy làm các dòng lệch nhau, nên **hỏi xác nhận trước**, không tự ý làm. Xóa dòng/cột cuối
  cùng cũng hỏi trước vì nó xóa luôn cả bảng.

Backend đã cho phép `table/thead/tbody/tr/td/th` và thuộc tính `colspan/rowspan` trong danh sách
trắng, nên sửa bảng xong lưu lại không mất ô gộp. `index.html` bump `module.hrm.js?v=8.86`.

---

**Chưa làm:** 4 mẫu quyết định riêng (khen thưởng / kỷ luật / bổ nhiệm / điều chuyển) vẫn dùng khuôn
chung — chờ Nguyen gửi mẫu Word gốc. Giờ đã có `QD_CHUNG` sửa được nên Nguyen tự chỉnh được phần lớn.
