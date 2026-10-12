# PRD — v8.74: QC và Đóng gói ghi nhiều đợt (cộng dồn) + giữ lại khi chưa đủ

**Trạng thái:** CHỜ DUYỆT — chưa viết dòng code nào
**Ngày:** 2026-10-08 · **Người yêu cầu:** Nguyen

> "Công đoạn QC, đóng gói sửa nhập nhiều lần như công đoạn kho nhập, khi ghi nhận chưa đủ số lượng thì vẫn hiện ở công đoạn"

---

## 1. Hiện trạng

| Công đoạn | Ghi lần 2 | Chưa đủ SL |
|---|---|---|
| **Cắt** | cộng dồn theo từng `SoDoID` | — |
| **Kho nhập** | **cộng dồn** (`CongDonKN`, v7.56) | **giữ lại** ở KN (v7.57) |
| **QC, Đóng gói** | **THAY THẾ** lần trước | bị đẩy sang công đoạn sau ngay đợt 1 |

`effectiveTienDoIds()` (`qlsx.js:605-648`) có 3 nhánh; QC/DG rơi vào nhánh mặc định "lấy batch mới nhất".

Gate "chưa đủ thì giữ lại" (`qlsx.js:4184-4224`) **chỉ có cho `isKhoNhap`**.

**Hệ quả hiện tại:** đóng gói 300/600 cái → ghi xong lệnh nhảy sang Kho nhập, **biến mất khỏi danh sách Đóng gói**, muốn nhập tiếp 300 còn lại thì ghi lại và **mất 300 đã ghi**.

---

## 2. Quyết định đã chốt (Nguyen, 2026-10-08)

| # | Quyết định |
|---|---|
| **Q1** | Mốc "đủ số lượng" = **TỔNG SỐ CẮT** (`getTongSLCatForOrder`), giống hệt Kho nhập. Một công thức duy nhất cho cả ba công đoạn. |
| **Q2** | **Có** màn "Các đợt đã ghi" cho QC/DG, nhưng **KHÓA xóa đợt QC ĐẦU TIÊN** của lệnh. |
| **Q3** | Ghi **vượt** tổng sổ cắt → **CẢNH BÁO, không chặn**. Giống Kho nhập đang làm. |
| **Q4** | Lệnh **chưa ghi sổ cắt** (tổng = 0) → **bỏ qua gate**, ghi xong chuyển công đoạn bình thường. Giống Kho nhập: `knChuaDu = knSoCat > 0 && knDaNhap < knSoCat`. |
| **Q5** | Lệnh **đang kẹt** ở QC/DG từ trước bản này → **KHÔNG kéo về**. Không viết truy vấn rà, không sửa dữ liệu. Bản vá chỉ áp cho lệnh ghi từ sau khi deploy. |

---

## 3. 🔴 Vì sao phải khóa xóa đợt QC đầu tiên

Lương **không** đọc số lượng QC — nó chỉ lấy **`MIN(NgayGhiNhan)`** của QC làm mốc kỳ:

```sql
CROSS APPLY (SELECT MIN(q.NgayGhiNhan) AS NgayQC ...) qc
WHERE YEAR(qc.NgayQC) = @n AND MONTH(qc.NgayQC) = @t
```

`payroll.js:1271-1273` ghi rõ vì sao là MIN chứ không MAX:

> *"MIN = LAN GHI QC DAU TIEN, CO Y khong dung MAX: lay MAX thi moi lan ai do ghi bo sung QC la CA CUC TIEN NHAY SANG THANG KHAC, ke ca thang da chot va da tra."*

**Ghi THÊM đợt QC → `MIN` không đổi → kỳ lương đứng yên. An toàn.**
**XÓA đợt QC đầu → `MIN` dịch sang đợt sau → tiền nhảy tháng, âm thầm.**

Ảnh hưởng cùng lúc **ba** nơi:

| Nơi | File |
|---|---|
| Lương khoán may | `payroll.js:1279-1286` |
| Lương gia công / in thêu | `luongGiaCongInThe.js:46-52` |
| **Công nợ nhà gia công** | `congno.js:1510-1511` (gọi `loadGiaCong` không truyền kỳ) |

⚠️ `CROSS APPLY` (không phải LEFT) ⇒ lệnh **chưa qua QC bị loại khỏi kết quả**, kể cả khi không lọc kỳ. Tức công nợ nhà gia công cũng chỉ tính lệnh đã qua QC.

---

## 4. Tiêu chí hoàn thành

1. Ghi QC đợt 1 (300/600) → lệnh **vẫn ở QC**, danh sách vẫn thấy, trạng thái `Đang sản xuất`.
2. Ghi QC đợt 2 (300) → tổng **600**, lệnh tự chuyển sang Đóng gói.
3. Tích "Đã hoàn thành" ở đợt bất kỳ → chuyển ngay dù chưa đủ (hàng lỗi bỏ đi).
4. Tương tự cho Đóng gói.
5. **Dữ liệu cũ không nhảy một số nào** — lệnh từng ghi lại QC/DG trước bản này giữ nguyên con số hiện tại.
6. Cột đối chiếu "công đoạn trước" ở DG và KN vẫn khớp (xem R3 §6).
7. Lương tháng đã chốt **không đổi** sau khi ghi thêm đợt QC. Đối chiếu một tháng đã trả trước/sau.

---

## 5. Thiết kế

### 5a. Cột cờ mới — KHÔNG backfill

```sql
ALTER TABLE TienDoSanXuat ADD CongDonQCDG BIT NULL;
```

Một cột dùng chung cho cả QC và DG (không cần hai cột — `StageID` đã phân biệt).

🔴 **TUYỆT ĐỐI không backfill.** Đây là bài học v7.56 (`qlsx.js:622-627`):

> *"truoc ban nay, 'ghi lai' duoc hieu la GHI LAI DE SUA, nen cong don ca du lieu cu se lam moi lenh tung ghi lai bi CONG GAP LEN — doi SL hoan thanh, gia thanh, bao cao nang suat ma khong ai biet."*

Luật đọc (nhân bản nhánh KN, `qlsx.js:629-639`):
- cộng **mọi** bản ghi có `CongDonQCDG = 1` (ghi từ sau khi deploy)
- cộng thêm **đúng một** bản ghi `CongDonQCDG IS NULL` — bản mới nhất, làm điểm bắt đầu
- loại mọi bản `NULL` còn lại

⚠️ Bản KN hiện có `ORDER BY` đặt sau `UNION` nên theo chuẩn T-SQL nó áp cho **toàn bộ** kết quả, còn `TOP 1` của nhánh thứ hai không có `ORDER BY` riêng ⇒ bản ghi NULL được chọn là **không xác định**. Bản mới phải viết đúng (subquery `MAX(TienDoID)` như `slKhoNhapTheoDon` đang làm), và **sửa luôn nhánh KN** cho khớp.

### 5b. Gate "chưa đủ thì giữ lại" — tham số hóa

Khối `qlsx.js:4184-4197` + `4210-4224` hiện gắn cứng `isKhoNhap`. Đổi thành danh sách công đoạn có gate:

```js
const CONG_DOAN_GIU_LAI = ['KN', 'QC', 'DG'];   // đều so với TỔNG SỔ CẮT (Q1)
```

⚠️ Ba điểm **không được** làm hỏng khi nhân bản (ghi chú v7.57 tại `qlsx.js:4186-4196`):
1. Khối tính phải chạy **cả khi `isLast`** — KN thường là công đoạn cuối.
2. **Không** ép `isLast = false`: `nextIndex = -1` → `stages[-1]` → TypeError.
3. Dùng **chính** `getStageActualQty()` (đã đi qua `effectiveTienDoIds`, tức đã cộng dồn) chứ không đếm lại.

### 5c. Frontend

| Việc | Khuôn mẫu |
|---|---|
| Tách `'QC'` khỏi nhánh `else` (`module.qlsx.js:5366`) | theo nhánh `'DG'` 5352-5365 |
| Thêm cột **"Đã ghi (lũy kế)"** + **"Còn lại"** cho QC/DG | `daNhapCuaDong('QC'\|'DG', ct, dai)` — **dữ liệu đã có sẵn**, backend không phải đổi gì (`qlsx.js:425-442`) |
| Checkbox **"Đã hoàn thành"** + dòng gợi ý | `#knKetThuc` 5290-5296 |
| Màn "Các đợt đã ghi" | `renderKhoNhapDaGhi()` 2605-2680 |
| Payload `ketThucQC` / `ketThucDG` | 5506 |

### 5d. Backend endpoint sửa/xóa đợt

Nhân bản `ghinhankhonhap` (`qlsx.js:2357-2440`) → `ghinhanqc`, `ghinhandonggoi`.

🔴 **DELETE đợt QC đầu tiên phải bị CHẶN** với thông báo tiếng người, nêu rõ tháng lương bị ảnh hưởng. Không chặn ở frontend là đủ — phải chặn ở **backend**, vì đó là nơi duy nhất bảo vệ được.

---

## 6. Rủi ro

| # | Rủi ro | Xử lý |
|---|---|---|
| **R1** | Dữ liệu cũ cộng gấp lên | Cột cờ, không backfill (§5a) |
| **R2** | Kỳ lương dịch khi xóa đợt QC đầu | Chặn ở backend (§5d) |
| **R3** | Đổi riêng QC hoặc riêng DG → cột đối chiếu so **số cộng dồn với số thay thế** | **Đổi cả hai cùng một lần deploy.** `MA_CONG_DOAN_TRUOC = { MAY:'CAT', QC:'MAY', DG:'QC', KN:'DG' }` |
| **R4** | DG nhập theo **Ri**, hệ số là `TongSoLop` từng màu. Cắt bổ sung giữa hai đợt → hệ số đổi → tổng cái sai | Cộng dồn ở mức **CÁI đã quy đổi**, không ở mức Ri. Mỗi đợt quy đổi bằng hệ số **tại thời điểm ghi** |
| **R5** | `TienDoChiTietMau.SoLuongLuyKe` mang nghĩa "lũy kế của đợt đó", không phải delta. Màn sửa đợt `DELETE` rồi `INSERT` lại cả đợt | Giữ nguyên nghĩa: mỗi đợt vẫn lưu số **của riêng đợt**; cộng dồn xảy ra ở tầng ĐỌC (`effectiveTienDoIds`), không đổi tầng ghi |
| **R6** | Viết nhánh cộng dồn riêng ở từng hàm `getStage*` | **Chỉ sửa `effectiveTienDoIds`** — cả 3 hàm tự đúng theo. Đây là điểm mạnh của thiết kế hiện tại |
| **R7** | Lương LA/DG (`PhanCongLaDongGoi`) | **Không ảnh hưởng** — bảng riêng, đọc `td.NgayGhiNhan`, không qua `TienDoChiTietMau`. Và frontend đã ngừng gửi `giaoViecLaDG` từ v8.29 |

**Đã xác minh KHÔNG ảnh hưởng:** giá thành (chỉ đọc CAT/KN), báo cáo năng suất (chỉ CAT/KN), thẻ kho/tồn kho (QC/DG không có đường ghi — khối cộng DELTA đã gỡ từ v6.91), định mức/hao hụt.

---

## 7. Kế hoạch

| # | Việc | Phụ thuộc |
|---|---|---|
| 1 | `migration_v874.sql`: thêm `CongDonQCDG BIT NULL`, **không backfill** + đăng ký gì cần | — |
| 2 | `effectiveTienDoIds`: nhánh QC/DG; **sửa luôn `ORDER BY` của nhánh KN** cho đúng chuẩn | 1 |
| 3 | Ghi cờ lúc INSERT (`qlsx.js:4053-4059`) | 1 |
| 4 | Tham số hóa gate "giữ lại" cho KN/QC/DG | 2 |
| 5 | Frontend: cột lũy kế + còn lại, checkbox, màn các đợt | 3·4 |
| 6 | Endpoint `ghinhanqc` / `ghinhandonggoi` + **chặn xóa đợt QC đầu** | 3 |
| 7 | Chạy lại bộ kiểm có sẵn `backend/utils/kiem_kho_nhap_nhieu_dot.js` | 2 |
| 8 | Truy vấn **chỉ đọc** đối chiếu lương một tháng đã chốt: trước vs sau | 6 |

⚠️ **Có migration** ⇒ chạy xong **phải `pm2 restart`**, và gộp vào `CAI_DAT_DAY_DU.sql`.

⚠️ Sửa cả backend lẫn frontend ⇒ bump `?v=` của `module.qlsx.js`.

---

## 8. Câu hỏi mở

✅ **Đã trả lời hết 2026-10-08** — xem Q3 / Q4 / Q5 ở §2. Không còn câu hỏi chặn nào.

⚠️ Hệ quả của **Q5** cần nói rõ với người dùng khi bàn giao: lệnh nào **đang dở** ở QC/DG lúc deploy
thì vẫn nằm sai chỗ (đã bị đẩy sang công đoạn sau). Muốn nhập tiếp cho những lệnh đó, người dùng
dùng đường **ép công đoạn thủ công** sẵn có (`qlsx.js:4281-4302`, chỉ admin) để kéo con trỏ về QC/DG,
rồi ghi bình thường — từ lúc đó cơ chế cộng dồn mới có hiệu lực cho lệnh đó.
