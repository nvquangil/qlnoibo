# PRD v9.33 — Tách dải/mẫu chỉ ở Cắt + mỗi dải một bảng riêng ở công đoạn sau

**Ngày:** 2026-11-06 · **Người yêu cầu:** Nguyen · **Trạng thái:** đã viết, CHƯA deploy

---

## 1. Yêu cầu (nguyên văn)

> "chức năng tách dải size tách mẫu chỉ hiển thị ở công đoạn cắt. hiện tại các công đoạn đều có.
> sau công đoạn cắt mà có tách size, tách mẫu thì các công đoạn sau sẽ hiển thị các bảng các mầu
> chính riêng theo tách nên làm bẩng riêng ví dụ size 2-7 mầu đỏ, mầu xanh như hiện tai, size 8-12"

Làm rõ thêm (AskUserQuestion):

> "chỉ ở cứt [Cắt] và để tách trước khi trải vì hệ số đã biết rồi"

## 2. ⚠️ Mâu thuẫn đã nêu trước khi làm

Phần A **đảo ngược v9.26** — cũng của Nguyen, cũng ngày 2026-11-06:

| Bản | Yêu cầu | Lý do khi đó |
|---|---|---|
| v9.26 | khung tách hiện ở **mọi** công đoạn | "cắt xong lệnh sang May thì không còn thấy nút tách mẫu" |
| v9.33 | khung tách **chỉ** ở Cắt | "để tách **trước khi trải** vì hệ số đã biết rồi" |

Đã nêu mâu thuẫn, Nguyen xác nhận chọn v9.33. Ghi lại đây để lần sau không ai "đồng bộ" ngược lại.

**Hệ quả đã chấp nhận:** user có gán công đoạn mà **không gồm Cắt** (tổ QC, tổ kho, tổ in thêu)
thì ô chọn công đoạn của họ không có Cắt ⇒ **không còn đường mở hộp thoại Tách**. Đây đúng là điều
yêu cầu, nhưng là thay đổi về quyền truy cập trên thực tế — nếu sau này có người kêu "không tách
được", đây là chỗ cần xem. Họ **vẫn ĐỌC được** lệnh đã tách những dải/mẫu nào, vì mỗi khối ở phần B
có tiêu đề mang tên dải/mẫu.

## 3. Thành công đo bằng gì

| # | Nghiệm thu | Cách đo |
|---|---|---|
| N1 | Mở Ghi tiến độ, chọn **Cắt** → khung "Tách dải size / Tách mẫu" hiện | mắt |
| N2 | Đổi sang **May / QC / Đóng gói / Kho nhập** → khung **biến mất sạch**, không còn vệt | mắt |
| N3 | Quay lại **Cắt** → khung hiện lại, **không chồng hai khung** | mắt |
| N4 | Lệnh đã tách 2 dải, 3 màu → QC/Đóng gói/Kho nhập hiện **2 khối có viền**, mỗi khối tiêu đề "Dải size: 2-7 — hệ số 6 cái/lớp" và đủ **3 màu bên trong** | mắt |
| N5 | Tổng số ô nhập **không đổi** so với bản cũ (3 màu × 2 dải = 6 ô), gõ và Gửi lưu đúng như cũ | gõ thử 1 lệnh, so số lưu |
| N6 | Lệnh **không tách** → màn hình y hệt bản cũ, không viền, không tiêu đề | mắt |
| N7 | Lệnh tách **MẪU** → mỗi khối có câu "các số SL từ Cắt / Còn lại là số CHUNG của cả N mẫu — không cộng sang khối kia" | mắt |
| N8 | `node backend\utils\kiem_bang_rieng_theo_dai.js` xanh | chạy |

## 4. Đã làm gì

### Phần A — khung tách chỉ ở Cắt

`frontend/js/module.qlsx.js` (~6244):

```js
const hostDai = modal.querySelector('#daiSizeHost');
function capNhatKhungDaiSize(stageId) {
  if (!hostDai) return;
  const s = stageById.get(String(stageId));
  if (s && s.MaCongDoan === 'CAT') renderDaiSizeBar(hostDai, maDH, perm, detail);
  else hostDai.innerHTML = '';
}
const veTheoCongDoan = (stageId) => { capNhatKhungDaiSize(stageId); renderStageFields(stageId); };
```

Ba nơi đi qua `veTheoCongDoan`: mở form, đổi ô chọn, nhảy thẳng (`jumpStageCode`).

🔴 **KHÔNG quay về cách trước v9.26** (vẽ bên trong nhánh CAT của `renderStageFields`). Nhánh đó có
nhiều đường async ghi đè `box.innerHTML` — chính là họ lỗi "khung dải size biến mất" đã phải vá ba
lần từ v8.79 tới v9.13. Host vẫn nằm **ngoài** `#pStageFields`; chỉ **nội dung** của nó theo công đoạn.

### Phần B — mỗi dải/mẫu một bảng riêng

Hàm mới `khoiTheoDai(veDong, khiRong)` (~4044) thay cho `dongNhapList().map(...).join('') || '...'`
tại **ba** nơi: `mauQtyRowsHtml` (May/QC/LA/...), `dgQtyRowsHtml` (Đóng gói), khối Kho nhập.

- Lệnh **không tách** → trả đúng bản cũ (không khối, không viền).
- Lệnh **đã tách** → đảo thứ tự thành **dải ngoài, màu trong**, mỗi dải một `<div class="khoi-dai">`
  có tiêu đề `Dải size: 2-7 — hệ số 6 cái/lớp` (hoặc `Mẫu: …`).
- Kiểu **MẪU** thêm một câu nhắc trong mỗi khối: các số là **chung cả N mẫu**, không cộng sang khối kia.

🔴 **`dongNhapList()` KHÔNG đổi.** Payload lúc Gửi vẫn duyệt đúng hàm đó. `khoiTheoDai` thuần túy là
cách bày — không đụng một con số nào. Bộ tự kiểm có phép khoá đúng việc này (mục 2.3: tập cặp
(màu, dải) của hai hàm phải trùng khít, không mất không lặp).

### File đụng tới

| File | Việc |
|---|---|
| `frontend/js/module.qlsx.js` | A + B |
| `frontend/index.html` | bump `module.qlsx.js?v=9.27` → **9.33** |
| `backend/utils/kiem_bang_rieng_theo_dai.js` | **MỚI** — bộ tự kiểm (không copy sang D:\) |
| `backend/utils/kiem_he_so_hieu_luc.js` | sửa 1 phép **đỏ oan** (xem §6) — không copy sang D:\ |

**Không có migration.** Không đụng backend.

## 5. Lệnh chạy (PowerShell, máy chủ chạy dưới tài khoản `Admin`)

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_bang_rieng_theo_dai.js
node backend\utils\kiem_tach_mau_cung_dai.js
node backend\utils\kiem_he_so_hieu_luc.js
```

Bốn lệnh xanh hết mới copy. Copy 2 file sang `D:\QLSX`:

```
frontend\js\module.qlsx.js
frontend\index.html
```

Không cần `pm2 restart` (chỉ file frontend) — nhưng PWA phải thấy `?v=9.33` mới mới nạp lại.

## 6. Rà soát chéo độc lập — kết quả

| # | Mức | Nội dung | Xử lý |
|---|---|---|---|
| 1 | XANH | Cú pháp 3 chỗ sửa, kể cả chỗ Kho nhập lồng trong template literal; không có backtick trong comment nằm trong template literal | — |
| 2 | XANH | `dongNhapList()` và `khoiTheoDai()` duyệt cùng tập cặp (màu, dải), chỉ khác thứ tự | — |
| 3 | XANH | Không có chỗ nào duyệt DOM theo cha-con với `.mau-qty / .dg-* / .kn-*`; tất cả dùng bộ chọn thuộc tính phẳng ⇒ lồng thêm `.khoi-dai` vô hại | — |
| 4a | VÀNG | Kiểu MẪU: hai khối cùng ghi "hệ số 6", dễ cộng thành 12 | **đã sửa** — thêm câu nhắc trong khối |
| 4b | VÀNG | "Còn lại" trùng số nay bị tách xa nhau | **đã sửa** — cùng câu nhắc trên |
| 4c | VÀNG | Khối thêm viền + padding có thể tràn ngang ở Kho nhập (8 cột) | **đã sửa** — `overflow-x:auto` trên khối |
| 5a | VÀNG | **Lỗi CŨ, không phải v9.33**: `renderStageFields('May')` ở dòng ~4701 và ~4711 truyền **tên công đoạn** trong khi hàm tra `stageById` theo **StageID** ⇒ sau khi Sửa/Xóa một dòng giao việc nội bộ ở May, form bị vẽ nhầm sang "Số lượng lũy kế theo màu" | **CHƯA sửa** — ngoài phạm vi, cần xác minh scope biến trước khi đụng. Xem §7 |
| 5b | ĐỎ-nghiệp vụ | Tổ không làm Cắt mất hẳn nút Tách | **chấp nhận** — đúng yêu cầu; ghi ở §2 |
| 6 | ĐỎ | Bộ kiểm cũ `kiem_he_so_hieu_luc.js:156` ghim nguyên văn `renderDaiSizeBar(modal.querySelector('#daiSizeHost'), …)`, nay tách thành 2 dòng ⇒ **đỏ oan, exit 1** | **đã sửa** |
| 7 | XANH | `kiem_tach_mau_cung_dai.js` không có phép nào đỏ oan | — |
| 8 | XANH | Bump `?v=9.33`; sidebar tự suy ra từ `?v=` lớn nhất, không có hằng số nào phải bump thêm | — |

Hai phép yếu trong bộ kiểm mới (tên phép hứa nhiều hơn phép kiểm; phép phủ định quá hẹp) cũng đã siết lại.

## 7. Còn nợ

- **5a** `renderStageFields('May')` ở ~4701/4711 — lỗi có từ lâu, đáng sửa nhưng phải đọc kỹ scope
  trước (hàm đó có `modal` / `veTheoCongDoan` trong tầm với không). Không gộp vào đợt này để tránh
  sửa mù một màn đang chạy.
- Tách được **trước khi trải** chỉ đúng khi hệ số đã khai ở Ra lệnh SX hoặc đã có sổ cắt. Lệnh chưa
  khai hệ số thì vẫn phải lưu sổ cắt trước. Nguyen nói "hệ số đã biết rồi" — nếu thực tế có lệnh
  chưa khai, cần một đường khai hệ số ngay trên khung tách. Chưa làm.
