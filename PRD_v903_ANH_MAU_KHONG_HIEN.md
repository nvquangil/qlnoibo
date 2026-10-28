# PRD v9.03 — Ảnh từng màu đã lên server nhưng thẻ kho / catalogue không hiện

**Ngày:** 2026-10-25 · **Nguyen:** *"một số mã hàng hóa khi làm phiếu nhập tải ảnh lên nhưng ở thẻ kho hàng hóa không có ảnh từng mầu"* → *"xem trong thư mục upload của server có ảnh từng mầu, nhưng không thể hiện ảnh trên thẻ kho hay catalogue"*

## 1. Chẩn đoán

File nằm trong `backend/uploads` ⇒ upload chạy đúng. Thẻ kho và catalogue đều đọc **`TheKhoChiTietMau.LinkAnh`** (qua `vw_TonTheoMau` và `public.js`) ⇒ **`LinkAnh` rỗng**. Truy đường ghi, thấy **bốn chỗ nuốt ảnh, không chỗ nào báo gì**:

| # | Chỗ | Chuyện gì xảy ra |
|---|---|---|
| **1 🔴** | `PUT /api/khohang/items/:id` (**Thẻ kho → Sửa**) | Xóa mọi dòng màu không có trong form: `DELETE … WHERE MaHangID=@id AND ID NOT IN (...)`. Nhưng `vw_TonTheoMau` là **UNION** của `TheKhoChiTietMau` **và** `vw_NhapKhoTuPhieu` — nên màu **vẫn hiện** (hàng từ phiếu nhập còn đó), chỉ `LinkAnh` thành NULL. **Đúng triệu chứng, và xảy ra ở màn khác hẳn màn nhập** nên không ai nối được hai việc. Đây nhiều khả năng là thủ phạm của "một số mã" |
| 2 | `POST/PUT /api/nhapkho/phieu` | Bỏ tích *"Tạo thẻ kho luôn khi lưu"* ⇒ **bỏ qua cả khối ghi ảnh**. Ảnh đã tải lên thành file mồ côi, không có đường nào gắn lại |
| 3 | `module.nhapkho.js` ô chọn ảnh | `onchange` là **async**. Chọn ảnh xong bấm Lưu ngay (hoặc ảnh điện thoại 20 MB, nén vài giây) ⇒ phiếu gửi đi khi `d.anhMau` còn `undefined`. **File vẫn lên tới máy chủ** nhưng đường dẫn không kịp vào payload |
| 4 | Form **Sửa** phiếu nhập | Không nạp lại ảnh đang lưu ⇒ ô ảnh luôn trống ⇒ người dùng tưởng mất, tải lên lại (file mới), file cũ mồ côi |

## 2. Sửa

| File | Gì |
|---|---|
| `backend/routes/khohang.js` | **(1)** chỉ xóa dòng màu **thật sự rỗng**: không số liệu, **không ảnh**, không ghi chú, **và** không có hàng từ phiếu nhập kho. Dòng giữ lại được **báo ra** kèm tên màu và dấu "có ảnh" |
| `backend/routes/nhapkho.js` | **(2)** `taoTheKhoTuDong` **luôn** chạy — ô tích chỉ còn quyết định ẩn/hiện mã (đúng nghĩa từ v7.85; ghi ảnh không tạo tồn, không làm hiện lại mã đã ẩn). **(4)** `docPhieu` trả `AnhMauDangLuu` / `AnhDaiDienDangLuu` |
| `backend/utils/theKhoMau.js` | đếm **ảnh thật sự đổi** (`damBaoDongMau` → `{moi, anhDoi}`; `capNhatAnhDaiDien` theo `rowsAffected`) — không thì từ nay mở Sửa rồi Lưu sẽ luôn báo "Đã ghi N ảnh màu" và câu thông báo mất giá trị |
| `frontend/js/module.nhapkho.js` | **(3)** bộ đếm `soAnhDangTai`: còn ảnh đang tải thì nút Lưu khóa + đổi chữ *"⏳ Đang tải N ảnh…"*, kèm lưới chặn thứ hai trong `onclick`. **(4)** nạp sẵn ảnh đang lưu; **đổi màu thì bỏ ảnh của màu cũ** (nếu không, ảnh màu cũ bị chép sang màu mới — lỗi do chính thay đổi (4) sinh ra, rà chéo bắt được) |
| `frontend/index.html` | `module.nhapkho.js?v=9.03` |
| `backend/utils/tim_anh_mo_coi.js` *(mới)* | CLI **mặc định chỉ đọc**: quét `/uploads`, đối chiếu **16 cột ảnh** trong CSDL, liệt kê file mồ côi + đoán mã hàng / màu từ tên file. `--ganlai` mới ghi, và **chỉ ghi vào dòng đang trống ảnh** |
| `backend/utils/kiem_anh_nhap_kho_the_kho.js` | thêm mục 5c: 13 phép kiểm chặn đúng bốn chỗ trên |

**Không migration.**

## 3. Khôi phục ảnh đã mất

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo\backend
node utils\tim_anh_mo_coi.js
```

Báo cáo (chỉ đọc) gồm 4 phần:
- **DÒNG MÀU ĐANG THIẾU ẢNH** — câu trả lời thật cho "mã nào mất ảnh".
- **CÓ THỂ GẮN LẠI: N ảnh màu** — file mồ côi khớp được với dòng đang trống.
- **PHẢI TẢI LÊN LẠI BẰNG TAY** — dòng thiếu ảnh mà không có file mồ côi nào khớp.
- `--chitiet` mới in danh sách từng file (rất dài).

⚠️ **File mồ côi ≠ ảnh bị mất.** Dữ liệu thật 25/10 cho thấy phần lớn file mồ côi là **bản tải lên cũ**: cùng một mã/màu có 2–3 file cách nhau vài phút (vd `QD26C0092_mauGhi_` ngày 4/8, 7/8 11:51, 7/8 11:55). Đó chính là triệu chứng của **nguyên nhân #4** — form Sửa phiếu không hiện ảnh đang lưu nên người dùng tải lại; lần cuối được ghi, các lần trước thành rác. v9.03 đã chặn.

Đối chiếu xong:
```powershell
node utils\tim_anh_mo_coi.js --ganlai
```
🔴 Lệnh này **ghi vào CSDL**: điền `LinkAnh` cho dòng đang trống (và tạo dòng thẻ kho nếu màu mới chỉ có ở phiếu nhập, với SoCat/Nhập/Xuất = 0 — không tạo tồn). **Không bao giờ đè ảnh đang có.** Đọc báo cáo trước rồi mới chạy.

Có sẵn công cụ soi cũ: `node utils\soi_anh_the_kho.js --thieu-anh`.

### Khớp màu theo TÊN đã lọc
Tên file dạng `QD26C0092_mauGhi_…` / `_mauen_` / `_mauTmThan_` nghĩa là lúc tải ảnh **màu chưa có trong danh mục** (người dùng đang gõ tay) nên frontend dùng **tên màu** thay vì ID, rồi `upload.js` lọc mất dấu tiếng Việt: `Đen→en`, `Tím Than→TmThan`, `Lông Chuột→LngChut`, `Nâu→Nu`. Script gắn lại được bằng cách lọc tên màu trong CSDL theo **đúng cách đó**, nhưng **chỉ trong phạm vi các màu của chính mã hàng đó** và **chỉ khi khớp duy nhất** — khớp nhiều hơn một thì báo ra, không tự gắn.

### Phát hiện kèm: danh mục màu bị trùng
Dữ liệu thật có `MauSacID` 3295 / 8531 / 4333 / 6423 với tên `"nhiêu màu"` (thiếu dấu) bên cạnh `"Nhiều màu"` (ID 64), `"Kẻ đen"`, `"kẻ đỏ"`. Gõ tay tên màu ở phiếu nhập tạo màu mới mỗi khi gõ sai chính tả ⇒ tồn kho của cùng một màu bị tách làm hai. Không thuộc v9.03; nên dọn riêng (gộp màu trùng tên), nói nếu anh muốn làm.

## 4. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\khohang.js
node --check backend\routes\nhapkho.js
node --check backend\utils\theKhoMau.js
node --check backend\utils\tim_anh_mo_coi.js
node --check frontend\js\module.nhapkho.js
node backend\utils\kiem_anh_nhap_kho_the_kho.js
```
`0 truot` → copy 5 file sang `server\D:\QLSX\`: `backend\routes\khohang.js`, `backend\routes\nhapkho.js`, `backend\utils\theKhoMau.js`, `backend\utils\tim_anh_mo_coi.js`, `frontend\js\module.nhapkho.js`, `frontend\index.html` →
```powershell
pm2 restart qlnoibo
findstr /C:"GIỮ LẠI" D:\QLSX\backend\routes\khohang.js
findstr /C:"soAnhDangTai" D:\QLSX\frontend\js\module.nhapkho.js
findstr /C:"module.nhapkho.js?v=9.03" D:\QLSX\frontend\index.html
```

**Thử:**
1. Lập phiếu nhập, chọn ảnh màu rồi **bấm Lưu ngay** → nút phải đổi thành *"⏳ Đang tải 1 ảnh…"* và không lưu được cho tới khi xong.
2. Lưu xong → Thẻ kho → bấm mã → *Chi tiết theo màu* phải có ảnh; catalogue cũng có.
3. Mở **Sửa** phiếu đó → ô ảnh hiện thumbnail ảnh đang lưu (trước đây trống).
4. Bỏ tích *"Tạo thẻ kho"* rồi Lưu → vẫn ghi ảnh (thông báo nói rõ), mã vẫn ẩn khỏi danh sách Thẻ kho.
5. Thẻ kho → Sửa một mã có nhiều màu → Lưu → **không màu nào mất ảnh**; nếu form thiếu màu nào thì có câu "GIỮ LẠI N dòng màu…".

**Commit** `"v9.03 anh mau khong hien: 4 cho nuot anh im lang + CLI gan lai anh mo coi"`.

## 5. Nói trước

- `banHangCommon.js` tạo dòng màu mới khi bán hàng gặp (mã, màu) chưa có dòng — dòng đó không có ảnh. Không phải lỗi, nhưng là một đường nữa sinh ra dòng màu trống ảnh.
- Tên file ảnh màu có màu tiếng Việt bị `routes/upload.js` lọc sạch (`AT01_mau_<time>.jpg`) nên script **không tự gắn lại được** những file đó — chỉ liệt kê để gắn tay.
