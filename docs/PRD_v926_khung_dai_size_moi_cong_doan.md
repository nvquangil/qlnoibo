# PRD v9.26 — Khung "Dải size / Mẫu" hiện ở MỌI công đoạn, không chỉ ở Cắt

**Ngày:** 2026-11-06 · **Báo lỗi:** Nguyen · **Trạng thái:** đã sửa, CHƯA deploy
Không migration. Chỉ `frontend/js/module.qlsx.js` + bump `?v=9.26`. Đi chung đợt v9.23/v9.24.

---

## 1. Triệu chứng

Nguyên văn: *"tách dải size, tách mầu sau khi lưu sổ cắt mới có, nhưng khi lưu hết bàn cắt công đoạn
cắt không hiện ra nữa"*.

Tách làm hai vế:

**Vế 1 — "sau khi lưu sổ cắt mới có": ĐÚNG THIẾT KẾ, không phải lỗi.** Nút Tách luôn hiện, nhưng
bấm vào mà chưa có hệ số đối chiếu thì bị chặn. Hệ số đối chiếu lấy theo thứ tự: **sổ cắt trước,
hệ số khai ở lệnh sau** (`heSoHieuLuc`, v9.12). Lệnh chưa ghi sổ cắt và cũng chưa khai hệ số ở Chỉ
định sản xuất ⇒ chưa có gì để đối chiếu ⇒ chưa tách được. Khung có nói câu đó bằng chữ đỏ.
*Muốn tách được NGAY từ đầu thì khai Hệ số quy đổi ở Ra lệnh SX — không cần đợi sổ cắt.*

**Vế 2 — "lưu hết bàn cắt thì không hiện ra nữa": LỖI THẬT, đã sửa.**

## 2. Nguyên nhân

Khung Dải size/Mẫu chỉ được vẽ **bên trong nhánh CẮT** của `renderStageFields`, tức nằm trong
`#pStageFields` — vùng bị vẽ lại mỗi lần đổi công đoạn.

Cắt xong bàn cuối, bấm Gửi → backend tự chuyển lệnh sang **May/QC**. Lần sau mở Ghi tiến độ, ô
"Công đoạn" mặc định là **công đoạn hiện tại**, không phải Cắt ⇒ nhánh CẮT không chạy ⇒ **khung biến
mất**. Muốn tách phải tự biết đường chọn ngược ô Công đoạn về "Cắt".

Trớ trêu: **tách MẪU là việc làm SAU khi cắt xong** (Nguyen: *"tách làm 2 mẫu từ khâu cắt"*, *"cắt
chung, khác từ khâu in"*) — đúng lúc cần nút nhất thì nó không có ở đó.

## 3. Cách sửa

Dải size/mẫu là **thuộc tính của LỆNH, không của công đoạn** — chính Nguyen đã nói ở v9.12: *"các
trường thông tin ở lệnh SX không gắn liền với công đoạn nào"*.

Nên đưa khung ra **ngoài** `#pStageFields`: thêm `<div id="daiSizeHost">` ngay dưới ô Công đoạn /
Ngày ghi nhận, vẽ **đúng một lần** lúc mở form.

Được hai thứ:

1. Khung hiện ở **mọi công đoạn** — không phải đi đường vòng về Cắt.
2. 🔴 **Dẹp cả họ lỗi "khung dải size biến mất"** (v8.79 → v9.13). Trước đây mỗi nhánh async ghi đè
   `box.innerHTML` là một lần khung bay màu, phải nhớ vẽ lại ở **từng** nhánh — thêm một nhánh là
   sót một chỗ. Nay `renderStageFields` vẽ lại bao nhiêu lần cũng không chạm tới nó.

Gỡ 3 lời gọi `renderDaiSizeBar` cũ trong nhánh Cắt (nhánh "đã có sổ cắt hết", nhánh nhiều sơ đồ,
nhánh phẳng), thay bằng **một** lời gọi vào host.

## 4. File đã sửa

| File | Việc |
|---|---|
| `frontend/js/module.qlsx.js` | thêm `#daiSizeHost`; vẽ khung một lần ở đó; gỡ 3 lời gọi trong nhánh Cắt; cập nhật ghi chú của `renderSoCatDaGhi` |
| `frontend/index.html` | bump `module.qlsx.js?v=9.26` |
| `backend/utils/kiem_he_so_hieu_luc.js` | **lật ngược bất biến**: từ "≥3 lời gọi" thành "**đúng 1** lời gọi, vào host nằm **trước** `#pStageFields`" |

## 5. Kiểm

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_he_so_hieu_luc.js
node backend\utils\kiem_tach_mau_cung_dai.js
```

## 6. Nghiệm thu

1. Mở một lệnh **đã cắt xong** (đang ở May/QC/Đóng gói) → Ghi tiến độ → **thấy ngay khung Dải size /
   Mẫu** ở đầu form, không phải chọn về Cắt.
2. Đổi ô Công đoạn qua lại vài lần → khung **vẫn còn**, và **chỉ có một** khung (không chồng nhau).
3. Lệnh **chưa ghi sổ cắt, chưa khai hệ số** → khung vẫn hiện, kèm chữ đỏ *"Chưa có hệ số nào…"*;
   bấm Tách thì form báo rõ lý do.
4. Ở công đoạn **Cắt**: khung vẫn ở đầu form như cũ, khối "Sổ cắt đã ghi nhận" nằm ngay dưới.
5. Tách mẫu xong → form tự mở lại → khung hiện đúng tên mẫu mới.

## 7. Giả định tôi đã đặt — bác nếu sai

Tôi hiểu *"công đoạn cắt không hiện ra nữa"* là **khung tách dải/mẫu** không còn hiện khi lệnh đã
rời Cắt. Nếu ý anh là **mục "Cắt" biến mất khỏi ô chọn Công đoạn** thì đó là chuyện khác (liên quan
phân công công đoạn cho tài khoản) — nói một tiếng, tôi tra tiếp. Bản sửa này giúp được cả hai
trường hợp, vì khung nay không còn phụ thuộc vào việc chọn được công đoạn Cắt nữa.
