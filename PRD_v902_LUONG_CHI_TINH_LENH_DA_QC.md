# PRD v9.02 — Rà soát tính lương: mọi bảng lương theo lệnh SX chỉ tính lệnh đã ghi QC

**Ngày:** 2026-10-24 · **Nguyen:** *"rà soát lại tất cả phần tính lương. Tất cả các lệnh sản xuất khi công đoạn QC ghi nhận tiến độ mới tính lương"* · chốt kỳ qua hỏi lại: **tháng muộn hơn giữa ngày ghi công đoạn và ngày QC đầu tiên**.

## 1. 🔴 Phát hiện quan trọng nhất: điều kiện QC của v8.61 **chưa bao giờ thật sự loại lệnh**

Rà chéo độc lập chỉ ra lỗi trong chính nền tảng v8.61:

```sql
CROSS APPLY (SELECT MIN(q.NgayGhiNhan) AS NgayQC FROM TienDoSanXuat q ... WHERE q.DonHangID = ...) qc
```

`MIN()` **không có GROUP BY luôn trả về đúng một dòng** (giá trị `NULL` khi không có bản ghi QC nào). Nên `CROSS APPLY` ở đây **không loại dòng nào** — ghi chú v8.61 "CROSS APPLY → lệnh chưa qua QC bị loại" là sai. Ba bảng lương thoát nạn chỉ nhờ mệnh đề `WHERE YEAR(qc.NgayQC)=@n` (NULL ⇒ false). Nhưng:

- **Sổ công nợ nhà gia công** (`congno.js` gọi `loadGiaCong(pool, sql)` **không truyền kỳ** để lấy lũy kế) ⇒ không có `WHERE` đó ⇒ **vẫn cộng cả lệnh chưa QC** từ v8.61 tới nay.
- Hai loader mới của v9.02 lọc theo `CASE WHEN qc.NgayQC > td.NgayGhiNhan ...` — với `NgayQC = NULL` thì so sánh ra UNKNOWN, rơi vào nhánh ELSE ⇒ lệnh chưa QC vẫn vào bảng, tức bản v9.02 đầu tiên của tôi **không có tác dụng gì**.

**Sửa tại gốc:** thêm `HAVING COUNT(*) > 0` vào khối APPLY (một nhóm duy nhất, không có dòng QC ⇒ không có nhóm ⇒ CROSS APPLY loại dòng ngoài) **và** `AND qc.NgayQC IS NOT NULL` ở ba loader — thắt lưng + dây đeo, vì đây là tiền.

**Hệ quả có chủ đích:** **số công nợ nhà gia công sẽ GIẢM** đúng phần của các lệnh chưa ghi QC. Chạy **Bảng 4/4b** của file SQL ở mục 4 để biết con số trước khi deploy.

## 2. Kết quả rà soát 5 bảng lương

Lương **công nhật** tính theo chấm công, không theo lệnh — ngoài phạm vi. Bốn bảng theo lệnh:

| # | Bảng | Chỗ tính | Trước | Sau v9.02 |
|---|---|---|---|---|
| 1 | Khoán may | `payroll.js loadLuongKhoanMay` | lọc tháng QC (hoạt động, nhờ `WHERE YEAR(qc.NgayQC)`) | dùng chung `APPLY_NGAY_QC` + `IS NOT NULL`; **kỳ đổi sang "tháng muộn hơn"** |
| 2 | Gia công / In thêu | `utils/luongGiaCongInThe.js` | lọc tháng QC khi có kỳ | giữ tháng QC (dòng giao/nhận **không có ngày nhận riêng** nên không có "ngày ghi" để so) |
| 2b | **Sổ công nợ nhà gia công** | `congno.js` ← cùng util | ❌ **cộng cả lệnh chưa QC** | loại lệnh chưa QC (số giảm) |
| 3 | **Là / Đóng gói** | `payroll.js loadLuongLaDongGoi` | ❌ lọc trần theo tháng ghi, không nhìn QC | gắn QC + kỳ "tháng muộn hơn" |
| 4 | **Trải vải cắt** (quỹ) | `payroll.js loadSoDoCat` | ❌ lọc trần theo tháng ghi sổ cắt | gắn QC + kỳ "tháng muộn hơn" |

Đã grep toàn backend: không có đường tính lương nào khác từ `PhanCongMay` / `PhanCongLaDongGoi` / `TienDoCatChiTietCay`. Giá thành (`qlsx.js`) đọc các bảng này nhưng là **chi phí theo lệnh**, không phải kỳ lương — đúng, không đụng.

### Vì sao khoán may cũng đổi sang "tháng muộn hơn"
Lập luận cũ "ngày ghi May luôn trước QC" **không còn đúng từ v8.74** (QC ghi nhiều đợt, live 2026-10-12): lô 1 QC ngày 28/9, lô 2 may trong tháng 10 ⇒ lấy tháng QC là tiền rơi vào **tháng 9 đã trả** — đúng cái v9.02 sinh ra để chặn. Với dòng May ghi trước QC (bình thường) kết quả y hệt v8.61.

## 3. Quy tắc kỳ lương
`kỳ = max(ngày ghi công đoạn, ngày QC đầu tiên)` — tiền **không bao giờ rơi vào tháng đã chốt**:
- Công đoạn **trước** QC (cắt, may): QC muộn hơn ⇒ kỳ = tháng QC.
- Công đoạn **sau** QC (đóng gói): ngày ghi muộn hơn ⇒ kỳ = tháng ghi.
- Lệnh **chưa QC**: không vào bảng nào; khi QC ghi, tự xuất hiện ở tháng QC.

Hệ quả cố ý ở **trải vải cắt**: quỹ gom sổ cắt theo kỳ QC, nhưng **giờ công chia quỹ vẫn là giờ chấm công của tháng đó**. Tiền của lệnh cắt T9/QC T10 chia cho người làm giờ T10 — tổng không mất, chỉ dịch tháng; anh đã chọn phương án này.

## 4. Thay đổi

| File | Gì |
|---|---|
| `backend/utils/luongGiaCongInThe.js` | `APPLY_NGAY_QC` **+ `HAVING COUNT(*) > 0`** (gate thật); thêm `bieuThucNgayKy(cot)`; export cả hai; sửa ghi chú v8.61 sai |
| `backend/routes/payroll.js` | `loadLuongKhoanMay` dùng khối chung + `IS NOT NULL` + kỳ "tháng muộn hơn"; `loadLuongLaDongGoi`, `loadSoDoCat` gắn QC + kỳ mới, trả `NgayQC`/`NgayKy`; `tongHopLuongCat` mang `NgayQC` |
| `frontend/js/module.payroll.js` | cột **Ngày QC** ở 6 bảng (màn hình + bản in + phiếu lương NV + chi tiết lệnh); ghi chú nêu điều kiện QC. **Sửa kèm 4 lỗi có từ trước:** 3 `colspan` dòng rỗng lệch (4→5, 6→7, 6→7) và dòng tiêu đề lệnh ở bản in quỹ thiếu `data-tong` (bị đánh số đè STT sơ đồ) |
| `backend/utils/kiem_congno_giacong_inthe.js` | 2 regex đã hỏng (v8.61 đổi `dieuKienKy(_cotCu,…)`; v9.02 thêm export) — nay khớp lại |
| `frontend/index.html` | `module.payroll.js?v=9.02` |
| `database/kiem_tra_v902_luong_theo_qc.sql` *(mới)* | SQL chỉ đọc, 5 bảng: **1** dòng May/Đóng gói/Sổ cắt **dịch tháng**; **2** lệnh có ghi công đoạn nhưng **chưa QC** (bị loại); **3** quỹ cắt từng tháng TRƯỚC/SAU; **4/4b** tiền gia công / in thêu của lệnh chưa QC = **phần công nợ sẽ giảm** |
| `backend/utils/kiem_luong_theo_qc.js` *(mới)* | bộ tự kiểm 4 loader + `HAVING` + cột/colspan frontend + bẫy v8.06 |

**Không migration.** Chỉ đọc — không ghi gì vào CSDL.

## 5. 🔴 Trước khi deploy — xem số dịch tháng

Chạy `database/kiem_tra_v902_luong_theo_qc.sql` (SSMS, chỉ đọc):
- **Bảng 3** `ChenhLech` của tháng gần nhất **đã trả lương** ≠ 0 ⇒ phần đó dịch sang tháng sau; kế toán phải biết trước.
- **Bảng 4 + 4b** = số tiền **công nợ nhà gia công sẽ giảm** ngay sau khi deploy. Nếu con số lớn và anh muốn công nợ vẫn tính cả lệnh chưa QC, nói trước khi copy — sẽ tách cờ riêng cho nhánh công nợ.
- **Bảng 2** = các lệnh nên ghi QC để lương vào đúng tháng.

## 6. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\luongGiaCongInThe.js
node --check backend\routes\payroll.js
node --check frontend\js\module.payroll.js
node backend\utils\kiem_luong_theo_qc.js
node backend\utils\kiem_congno_giacong_inthe.js
```
`0 sai` cả hai bộ kiểm → copy 4 file sang `server\D:\QLSX\`: `backend\utils\luongGiaCongInThe.js`, `backend\routes\payroll.js`, `frontend\js\module.payroll.js`, `frontend\index.html` →
```powershell
pm2 restart qlnoibo
findstr /C:"HAVING COUNT(*) > 0" D:\QLSX\backend\utils\luongGiaCongInThe.js
findstr /C:"qc.NgayQC IS NOT NULL" D:\QLSX\backend\routes\payroll.js
findstr /C:"module.payroll.js?v=9.02" D:\QLSX\frontend\index.html
```
Dòng `findstr` thứ hai phải ra **3 kết quả** (khoán may, là/đóng gói, sổ cắt).

**Thử:** Tính lương → Lương là/đóng gói: mọi dòng có Ngày QC; lệnh đang đóng gói mà chưa QC → không có dòng. Lương trải vải cắt: quỹ khớp cột `QuyCat_SAU_theoKyQC` của Bảng 3. Lương khoán may: tổng tháng so với lần xem trước deploy — chỉ đổi nếu có dòng May ghi sau đợt QC đầu. Công nợ nhà gia công: tổng giảm đúng bằng Bảng 4 + 4b.

**Commit** `"v9.02 luong theo lenh chi tinh khi da QC (HAVING COUNT>0 — gate v8.61 truoc day khong chay), ky = thang muon hon"`.

## 7. Ngoài phạm vi (nói trước)

- Gia công / in thêu vẫn lấy **tháng QC thuần**: `SoLuongNhan` ghi đè, không có cột ngày nhận nên không có "ngày ghi" để so. Muốn chính xác theo ngày nhận thì phải thêm cột `NgayNhan` — việc riêng.
- Giá thành (v8.95) không đổi.
