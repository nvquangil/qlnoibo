# PRD v8.92 — Đóng gói / Kho nhập: 1 ri = hệ số ĐÃ DÙNG Ở CẮT, không phải hệ số của lệnh

**Ngày:** 2026-10-17 · **Yêu cầu của Nguyen:** *"Ghi tiến độ, công đoạn đóng gói và kho nhập 1 ri = 1 cái (hệ số quy đổi của lệnh) đang bị sai. Ví dụ lệnh DH2609111 ở công đoạn cắt đang hệ số 11 nhưng ra đóng gói và kho nhập là 1"*

---

## 1. Vì sao lệch — hai thước đo "ri" trên cùng một lệnh

| Nơi | Hệ số dùng | Từ bản |
|---|---|---|
| **Cắt** | `TienDoCatChiTietCay.HeSoQuyDoi` — **từng cây**, tổ cắt gõ trực tiếp trên dòng | v6.08 |
| **Đóng gói / Kho nhập** | `DonHangSanXuat.HeSoQuyDoi` — ô "Hệ số quy đổi" ở Ra lệnh SX, **`NOT NULL DEFAULT 1`** | v8.52 |

Lệnh ra với hệ số mặc định 1 (ít ai sửa ô đó), tổ cắt gõ 11 trên từng cây. Cắt tính đúng 11 cái/lớp. Đóng gói gõ "5 ri" → hệ thống lưu **5 cái** thay vì 55. Cột "Còn lại" ở Đóng gói / Kho nhập vì thế luôn báo còn rất nhiều, dòng "Đã nhập … Ri" ở danh sách lệnh SX cũng sai.

**Giả định đã kiểm trong code, chưa kiểm trên dữ liệu:** DH2609111 có `DonHangSanXuat.HeSoQuyDoi = 1` và các cây ở Cắt `HeSoQuyDoi = 11`. Truy vấn 1 trong `kiem_tra_v892` xác nhận điều này — nếu DH2609111 **không** có mặt ở kết quả đó thì cơ chế khác với tôi nghĩ, dừng lại báo tôi.

## 2. Chốt

**"1 ri" ở mọi công đoạn sau Cắt = đúng số cái mà một lớp cắt đã cho ra.** Hệ số của lệnh chỉ là mặc định khi Cắt chưa ghi.

Thứ tự ưu tiên cho một dòng (màu, dải):

1. Lệnh đã tách dải → hệ số **của dải** (v8.59, không đổi)
2. Sổ cắt của màu đó dùng **một** hệ số duy nhất → hệ số **theo sổ cắt** ← *mới*
3. Còn lại (Cắt chưa ghi, hoặc các cây cùng màu mang hệ số khác nhau) → hệ số **của lệnh**, kèm cảnh báo đỏ

Không sửa `DonHangSanXuat.HeSoQuyDoi` tự động: cột đó còn là mẫu số của bảng dải size (v8.59) và của "Tổng SL chỉ định" quy đổi trên bản in — đổi ngầm là phá chỗ khác.

## 3. Thay đổi

**`backend/routes/qlsx.js`**
- `getCatMauList()` — mỗi màu trả thêm `HeSoCat` (khi mọi cây chính của màu cùng một hệ số), `HeSoCatLech`, `HeSoCatMin/Max`. Lọc cây chính y hệt câu `TongSoLop` ngay trên (`dieuKienCayChinh`).
- `slKhoNhapTheoDon()` — dòng "Đã nhập 43 Ri (…)" ở danh sách lệnh SX dùng cùng luật (CTE `heCat`, lọc cây chính L1/L2/L3 dạng tương quan). Thêm `FLOOR` vì `HeSoQuyDoi` là DECIMAL — trước đây `SoRi` có thể ra 43,636.

**`frontend/js/module.qlsx.js`**
- `heSoCuaDong(dai, ct)` — thêm tham số `ct`, 4 chỗ gọi (Đóng gói, Kho nhập, `soLuongRiLe`, `daNhapRiLe`).
- `nhanHeSo(dai, ct)` — dòng ghi chú dưới mỗi màu nói rõ thước đang dùng: *"1 ri = 11 cái (hệ số theo sổ cắt — lệnh khai 1, Cắt dùng 11; lấy theo Cắt)"*. Cảnh báo đỏ khi sổ cắt lệch nhau, hoặc khi tổng hệ số dải ≠ Cắt.

**`database/kiem_tra_v892_he_so_ri_lech_cat.sql`** *(MỚI, chỉ đọc)* — đo quy mô: lệnh nào lệch, lệnh nào đã ghi Đóng gói/Kho nhập với hệ số sai, và từng dòng của DH2609111.

**`backend/utils/kiem_he_so_ri_theo_cat.js`** *(MỚI)* — chạy hàm `heSoCuaDong` thật với 7 tình huống + kiểm CTE.

**`frontend/index.html`** — `module.qlsx.js?v=8.92`.

## 4. Những gì KHÔNG đổi

- Số **đã ghi** ở Đóng gói / Kho nhập trước v8.92. Bản này chỉ sửa cách ghi **từ nay**. Sửa dữ liệu cũ là việc không đảo ngược — mục 6.
- Lương: `payroll.js` tính lương Là/Đóng gói từ `PhanCongLaDongGoi`, không đọc `TienDoChiTietMau` ⇒ hệ số không chạm lương. Kỳ lương mốc `MIN(NgayGhiNhan)` của QC — không liên quan.
- Báo cáo định mức/hao hụt ("Lý thuyết = định mức × SL nhập kho") **sẽ đúng hơn** từ nay, không phải lỗi.

## 5. Giới hạn còn lại — nói trước

- **Danh sách lệnh SX chỉ hiện một con số cho cả lệnh.** Lệnh có hai màu chính dùng hai hệ số khác nhau (A=11, B=12) → danh sách lùi về hệ số lệnh; form (tính từng màu) vẫn đúng. Chỉ là dòng chữ nhỏ dưới Trạng thái.
- **Dải size ràng với lệnh, không ràng với Cắt** (v8.59). Lệnh khai 1, Cắt 11, rồi tách dải: tổng dải buộc = 1 ⇒ "Cắt / Còn lại" theo dải sai tỉ lệ 11 lần. v8.92 **cảnh báo đỏ** ngay dưới ô nhập nhưng không tự sửa bảng dải. Đúng cách là sửa `HeSoQuyDoi` của lệnh về 11 rồi tách lại dải — cần người quyết, không để máy đổi.
- Lệnh rơi luật L3 (chưa khai Kiểu ở phiếu xuất vải nào) thì cây phối cũng được gộp khi tính `HeSoCat` → cây phối để hệ số 1 là màu đó bị coi "lệch" và lùi về lệnh. DH2609111 nếu thuộc nhóm này vẫn ra 1 — truy vấn 1 sẽ cho thấy.

## 6. Dữ liệu đã ghi sai — CHƯA làm gì, chờ anh xem số

Truy vấn 2 trong `kiem_tra_v892` liệt kê lệnh đã ghi Đóng gói/Kho nhập mà Cắt ≠ lệnh, kèm cột `NeuTheoCat` = số nếu nhân lại theo hệ số Cắt. Cột đó **chỉ đúng khi** người nhập đã gõ toàn ri chẵn (không có lẻ) — có lẻ thì tổng cái không tách ngược được, phải hỏi tổ.

Sau khi anh xem kết quả, hai đường:
- **Ít lệnh (≤ 5)**: sửa tay từng đợt bằng nút sửa đợt trên form (đã có từ v8.74) — không cần SQL.
- **Nhiều**: tôi viết `sua_du_lieu_v892_*.sql` theo đúng danh sách anh duyệt từng dòng. *Bước đó không đảo ngược — tôi sẽ dừng chờ "proceed".*

---

## 7. Deploy

> 🔴 **`server\D:\QLSX` LÀ MÁY CHẠY THẬT.** Không có bản chạy thử.

### Bước 1 — kiểm cú pháp tại C:

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_he_so_ri_theo_cat.js
```

Phải **0 sai**. Có dòng đỏ thì DỪNG, gửi tôi nguyên văn.

### Bước 2 — chạy chẩn đoán TRƯỚC khi deploy (chỉ đọc)

SSMS → `QLNoiBo` → mở `database\kiem_tra_v892_he_so_ri_lech_cat.sql` → Execute. Ba bảng kết quả, **chụp hoặc copy ra file gửi tôi**. Kiểm nhanh:
- Bảng 1 phải có `DH2609111` với `HeSoLenh = 1`, `HeSoCatMin = HeSoCatMax = 11`. **Không có ⇒ dừng, báo tôi.**
- Bảng 2: đếm số lệnh — quyết đường sửa dữ liệu ở mục 6.

### Bước 3 — copy 3 file sang `server\D:\QLSX\`

```
backend\routes\qlsx.js
frontend\js\module.qlsx.js
frontend\index.html
```

(Không có migration. `kiem_tra_v892…sql` và `kiem_he_so_ri_theo_cat.js` không cần copy.)

### Bước 4 — restart + Ctrl+F5

```powershell
pm2 restart qlnoibo
```

### Bước 5 — thử trên DH2609111

1. Quản lý SX → Ghi tiến độ → DH2609111 → **Đóng gói**. Dưới mỗi màu phải thấy: *"1 ri = **11** cái (hệ số theo sổ cắt — lệnh khai 1, Cắt dùng 11; lấy theo Cắt)"*.
2. Gõ **1** vào ô Ri → cột "Tổng (cái)" phải ra **11**. **Chưa bấm Gửi** nếu chưa muốn ghi thật.
3. Chuyển sang **Kho nhập** → cùng dòng ghi chú, cùng phép tính.
4. Danh sách lệnh SX: dòng "Đã nhập … Ri" của DH2609111 (nếu đang ở Kho nhập) phải chia theo 11.
5. Mở một lệnh **khác** mà lệnh = Cắt (ví dụ hệ số 5 cả hai) → ghi chú chỉ còn *"(hệ số theo sổ cắt)"*, không có đoạn màu cam — số không đổi so với trước.
