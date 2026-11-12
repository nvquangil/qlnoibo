# PRD v9.23 — Tách lệnh thành nhiều MẪU mà vẫn chung một dải size

**Ngày:** 2026-11-05 · **Yêu cầu:** Nguyen · **Trạng thái:** viết xong, CHƯA deploy
**⚠️ Đợt này CÓ MIGRATION** (`database/migration_v885.sql`) — khác mọi đợt v9.15→v9.22.

---

## 1. Vấn đề

Nguyên văn: *"một số lệnh sản xuất tôi muốn tách làm 2 mẫu từ khâu cắt nhưng vẫn cùng dải size"*.
Ví dụ Nguyen đưa: *"lệnh sx ra lệnh áo cộc size 2-7, ghi chú mẫu 1 in chó, mẫu 2 in thỏ"*.

Hệ thống đã có cơ chế tách **dải size** (v8.59–v9.14): `DonHangDaiSize` + cột `DaiSizeID` ở 4 bảng
tiến độ và 3 bảng đơn giá. Nhưng cơ chế đó ràng **TỔNG hệ số các dải = hệ số hiệu lực** (2-7 có 6 +
8-12 có 5 = 11) vì mỗi dải là một PHẦN RIÊNG của lớp cắt. Hai "mẫu" thì không như vậy: chúng dùng
chung cả dải size, nên mỗi mẫu vẫn mang đủ hệ số (6 và 6, không phải 6+6=12) — khai bằng dải size là
bị chặn, khai 3+3 cho đủ 6 thì mọi số sau đó sai một nửa.

## 2. Phạm vi đã chốt (3 vòng hỏi)

| Hỏi | Chốt |
|---|---|
| "Mẫu" nghĩa là gì | Biến thể hình in của cùng sản phẩm, **cùng bộ size** |
| Công đoạn sau nở mấy dòng | **2 dòng mỗi màu** — mỗi mẫu một dòng |
| Sổ cắt có tách không | **Cắt chung, khác từ khâu in** — sổ cắt giữ nguyên |

**Ngoài phạm vi:** không tách sổ cắt; không tự chia 108 cái cho hai mẫu (tỉ lệ do người ghi tiến độ
nhập thật); không đụng đơn giá in thêu / may theo dải (nợ 5c/5d từ v9.12).

## 3. Cách làm

### 3.1 Một cột nhãn, không bảng mới
`DonHangDaiSize.LoaiTach NVARCHAR(10) NOT NULL DEFAULT N'DAI'`, CHECK `IN (N'DAI', N'MAU')`.

Lý do không tạo bảng thứ hai: cấu trúc "nhiều dòng theo một chiều phụ" đã có sẵn và đã len vào ~12
chỗ (nở dòng nhập, `slTheoMauDai`, gate in thêu/gia công, bảng kê, lương gia công…). Thêm bảng là
phải nhân đôi tất cả.

### 3.2 Khác biệt DUY NHẤT giữa hai kiểu: ràng buộc hệ số

| | `DAI` (cũ) | `MAU` (mới) |
|---|---|---|
| Luật | **TỔNG** hệ số các dòng = hệ số hiệu lực | **MỖI** dòng = hệ số hiệu lực |
| Ví dụ | 2-7 (6) + 8-12 (5) = 11 ✓ | Mẫu 1 (6) và Mẫu 2 (6), hệ số 6 ✓ |
| Trần cả màu | tổng các dải | **bằng một dải** (vải cắt chung) |

Luật viết **hai bản** (backend `PUT /daisize` + frontend `dungLuat()`); bộ tự kiểm chạy cả hai trên
cùng bộ dữ liệu và đòi kết quả giống hệt.

### 3.3 🔴 Trần đối chiếu gom theo MÀU — chỗ nguy hiểm nhất của bản này

Vải cắt chung: cắt 18 lớp × 6 = **108 cái cho cả màu**, chia cho hai mẫu (54/54 hay 80/28 tùy xếp).
Nên:

- Trần **từng mẫu** = 108 (một mẫu có thể chiếm cả bàn) → ô "SL từ Cắt" giữ nguyên, **gắn nhãn
  "(chung cả 2 mẫu)"**.
- Trần **cả màu** = 108, **không phải 216** → "Còn lại", dòng gợi ý kết thúc, cảnh báo vượt đều phải
  gom theo màu.

Nếu cộng thẳng mọi dòng (code cũ): màn hình nói *"đã đóng gói 108 / sổ cắt 216 — còn 108"* trong khi
backend đo bằng `getTongSLCatForOrder` (cộng theo MÀU = 108) nên **đã cho lệnh chuyển tiếp**. Người
ghi tiến độ mất chỗ nhập; với QC thì `advanced` còn kéo theo tự chốt giá thành. Ở Kho nhập thì tệ
hơn: nhập 216 cái cho một bàn 108 cái mà không cảnh báo gì — **tồn kho phồng thật**.

Đã vá bằng bộ hàm `slCatCuaMau` / `daGhiCuaMau` / `tongCatCuaLenh` / `tongDaGhiCuaLenh` /
`conLaiCuaDong`, áp cho **ba** màn: QC, Đóng gói, Kho nhập — kể cả khối cảnh báo RIÊNG của Kho nhập
(có từ v7.56, không đi qua `canhBaoVuotSoCat`).

> Cả hai lỗi này do **rà chéo độc lập** bắt (vòng 1 và vòng 2), không phải tự thấy.

## 4. File đã sửa

| File | Việc |
|---|---|
| `database/migration_v885.sql` | **MỚI** — thêm cột `LoaiTach` + backfill + CHECK |
| `database/CAI_DAT_DAY_DU.sql` | gộp migration thành mục `[118/118]` |
| `backend/routes/qlsx.js` | `getDaiSizeList` trả `LoaiTach` (dò cột); `loaiTachCuaList`; `PUT /daisize` nhận `loaiTach`, luật rẽ nhánh, giữ kiểu cũ khi client không gửi; câu chặn nói "mẫu"/"dải" theo kiểu |
| `frontend/js/module.qlsx.js` | modal chọn kiểu + luật + giải thích; nhãn theo kiểu ở 8 màn; **trần gom theo màu** ở QC/Đóng gói/Kho nhập; cảnh báo vượt gom theo màu (2 khối) |
| `frontend/index.html` | bump `module.qlsx.js?v=9.23` |
| `backend/utils/kiem_tach_mau_cung_dai.js` | **MỚI** — bộ tự kiểm (không copy sang D:\) |
| `backend/utils/kiem_he_so_hieu_luc.js` | vá 3 phép đỏ-oan do v9.14–v9.23 làm lệch chuỗi |

## 5. Lệnh chạy (PowerShell — bash sandbox hỏng cả phiên, 32 lần)

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_tach_mau_cung_dai.js
node backend\utils\kiem_he_so_hieu_luc.js
```

**Thứ tự deploy (migration TRƯỚC pm2):**

1. SSMS: chạy `database\migration_v885.sql` trên DB `QLNoiBo`, xem 2 câu kiểm ở cuối file.
2. Copy sang `D:\QLSX`: `backend\routes\qlsx.js`, `frontend\js\module.qlsx.js`, `frontend\index.html`
   — **cộng thêm** 7 file đang chờ của đợt v9.18→v9.22 (danh sách ở `PRD_v921` mục 4).
3. `pm2 restart qlnoibo` (bắt buộc: `coCotQLSX` cache tên cột vĩnh viễn — không restart thì server
   vẫn tưởng chưa có cột và từ chối tách mẫu).
4. Ctrl+F5 trên trình duyệt.

## 6. Nghiệm thu

1. Lệnh **không tách** và lệnh **tách dải** cũ: mọi số ở Cắt/QC/Đóng gói/Kho nhập **y hệt trước**.
2. Mở một lệnh → Cắt → nút **🧩 Tách dải size / mẫu** → chọn **Mẫu** → gõ "Mẫu 1 in chó" và
   "Mẫu 2 in thỏ", hệ số tự điền = hệ số sổ cắt → Lưu được.
3. Thử gõ 3 và 3 (cộng lại bằng hệ số) → **phải bị chặn**, câu nhắc nói "mỗi mẫu phải mang đúng hệ số
   X".
4. Đóng gói / Kho nhập: mỗi màu ra **2 dòng**, ô "SL từ Cắt" và "Còn lại" đều có chữ
   **"(chung cả 2 mẫu)"**; ghi 54 cho mẫu 1 → "Còn lại" của **cả hai dòng** còn 54.
5. Ghi tiếp 54 cho mẫu 2 → dòng gợi ý nói **"đã đủ, lệnh tự chuyển tiếp"** (không còn "sổ cắt 216").
6. Thử ghi 108 + 108 → **phải hiện cảnh báo vượt** (ở cả Đóng gói lẫn Kho nhập).

## 7. Nợ lại / biết mà chưa làm

- `module.tailieukythuat.js` (Đơn giá gia công) vẫn gọi cột là **"Dải size"** ở lệnh tách mẫu — số
  đúng, chữ sai; muốn đổi phải sửa cả câu SQL ở `backend/routes/tailieukythuat.js:427` (chưa trả
  `LoaiTach`).
- `bangke.js` không nở được tên mẫu thành cột size (tên không dạng "2-7") nên rơi về nguồn
  `DonHangSanXuat.Size` — mất tiện ích, không sai số.
- Modal: đổi kiểu khi lệnh **chưa lưu dòng nào** thì hệ số đang gõ bị ghi đè không hỏi; số dòng trong
  câu hỏi xác nhận lấy từ lúc mở modal, không cập nhật khi vừa xóa dòng.
- Lệnh tách MẪU mà hệ số sổ cắt là **số lẻ** (5.5): không tách mẫu được (cột `HeSo` là INT). Form nói
  thẳng lý do và cách gỡ, không để nút Lưu sáng rồi server từ chối.

## 8. Chưa chạy được bộ tự kiểm

Bash sandbox hỏng toàn phiên (32 lần, lỗi mount Plan9/virtiofs) ⇒ **chưa chạy `node --check` lẫn bộ
tự kiểm nào**. Lưới an toàn của bản này là: hai vòng rà chéo độc lập (bắt 2 đỏ ở vòng 1, 2 đỏ ở vòng
2 — đã vá hết) + mục 5 ở trên. Nguyen chạy 4 lệnh ấy trước khi copy sang `D:\QLSX`.
