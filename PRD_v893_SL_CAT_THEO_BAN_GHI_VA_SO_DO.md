# PRD v8.93 — "SL từ Cắt" không cộng nhầm lần cắt phối: luật theo BẢN GHI + Kiểu theo SƠ ĐỒ

**Ngày:** 2026-10-19 · **Yêu cầu của Nguyen:** *"rà soát lại lệnh DH2608073 xem cộng số lượng các cây vải chính như nào, đang bị lệch so với sổ cắt. Sổ cắt tổng ĐEN02 30 lớp × 5 = 150 nhưng ở QC đang thể hiện 250"* → *"viết utils để chuyển sang vải chính cộng vào theo mã cây đã xuất ở phiếu xuất … vì ở phiếu xuất kho vải có ghi rõ cây nào vào phối, cây nào vào chính"*

---

## 1. Tái hiện đúng 250 — và nguyên nhân

| Bản ghi Cắt | Sơ đồ | Cây | Lớp | Cái | Trên phiếu xuất |
|---|---|---|---|---|---|
| 14579 | 6251 | 2DA-DEN02…006 | 2 | 10 | PXV-13205 Chính |
| 14579 | 6251 | 2DA-DEN02…011 | 17 | 85 | PXV-13205 Chính |
| 14579 | 6251 | 2DA-DEN02…002 | 11 | 55 | PXV-13205 Chính **+ PXV-14204 Phối** |
| **14580** | **6252** | **2DA-DEN02…002** | **20** | **100** | PXV-13205 Chính **+ PXV-14204 Phối** |

Ba dòng đầu = 30 lớp = 150, khớp sổ giấy. Dòng thứ tư là **cùng cây …002 cắt thêm 20 lớp cho bo** (bản ghi 14580 = sơ đồ 6252 = toàn cây của phiếu Phối PXV-14204).

Luật v8.71 gắn Kiểu cho **cây**: "cây có ít nhất một dòng Chính ⇒ tính ở mọi nơi". Cây …002 có cả hai dòng nên 20 lớp cắt bo cũng vào thành phẩm. Tàn 43 bị y hệt (hệ thống 180, đúng là 30).

Hôm trước DH2608064 là vải thân / vải bo **khác cây** nhưng cùng MauSacID — v8.71 xử được bằng cách hỏi theo cây. Hôm nay là **cùng cây** nên phải hỏi theo **lần cắt**.

## 2. Luật mới — `backend/utils/cayThanhPham.js` (một chỗ, mọi nơi dùng)

Cho một dòng sổ cắt, ưu tiên từ trên xuống:

| | Luật | Kết quả |
|---|---|---|
| S1 | Sơ đồ của bản ghi khai **Phối** | không tính |
| S2 | Sơ đồ khai **Chính** | tính, bất kể phiếu xuất |
| L3 | Lệnh chưa khai Kiểu ở phiếu xuất nào | tính hết (như cũ) |
| **B** | **Bản ghi Cắt là lần cắt phối**: *mọi* cây của bản ghi có dòng xuất Phối **và** *có* cây không có dòng Chính | **không tính dòng nào của bản ghi** |
| L1 | Cây có dòng xuất Chính | tính |
| L2 | Cây không có dòng xuất nào (cấp tay) | tính, có cảnh báo |
| | còn lại (chỉ Phối) | không tính |

**Luật B** là câu trả lời cho yêu cầu "theo mã cây đã xuất ở phiếu xuất": tổ cắt ghi một bản sổ cắt cho một lần trải, các cây trong đó cùng đi một phiếu. DH2608073: bản 14580 = {…003 P, …002 C+P, Kem11 P, Tàn43 C+P} → mọi cây ∈ Phối, …003 ∉ Chính → **phối**. Bản 14579 có …006 ∉ Phối → không phải phối → xuống L1. **Lệnh cũ tự đúng, không phải khai lại gì, không đụng dữ liệu.**

**Kiểu sơ đồ** (migration_v880, cột `DonHangChiTietSoDo.Kieu`) là nút ghi đè cho ca luật B không suy được: bản ghi phối mà *toàn* cây dùng chung thân/bo. Khai ở Ghi tiến độ → Kỹ thuật → Sơ đồ. Để trống = hệ thống tự suy.

## 3. Thay đổi

- **`backend/utils/cayThanhPham.js`** *(MỚI)* — `dieuKienCayThanhPham` (một lệnh), `dieuKienCayThanhPhamMoiLenh` (CTE danh sách), `bieuThucBanGhiLaPhoi`, `bieuThucCayLaChinh`, `bieuThucKieuSoDo`, `coKieuSoDo` (không cache), `donCoKhaiKieuVai`.
- **`backend/routes/qlsx.js`** — `slCatTheoMauTuCay` (cột "Cắt" ở May/QC/ĐG/KN), `getCatMauList` (TongSoLop + HeSoCat), `slKhoNhapTheoDon` (heCat) dùng util; `POST/PUT /sodo` nhận `kieu` (PUT chỉ ghi khi body có khóa).
- **`backend/routes/khohang.js`** — gợi ý thẻ kho từ sổ cắt dùng util (bỏ bản chép L1/L2).
- **`backend/routes/bangke.js`** — bảng kê BTP thêm luật B + sơ đồ (ghi chú v6.60.1 của chính file đó đã mô tả lỗ này).
- **`frontend/js/module.qlsx.js`** — bảng sơ đồ thêm cột Kiểu (thêm / sửa / hiển thị); nhãn sơ đồ ở sổ cắt và ô định lượng ghi THÂN/PHỐI.
- **`database/migration_v880.sql`** *(MỚI)* — cột `Kieu` + CHECK + **4 index** cho các khóa ngoại luật B dò (chưa có index nào, danh sách lệnh SX sẽ chậm dần nếu thiếu) + câu đối chiếu lệnh có cây xuất hai kiểu.
- **`database/kiem_tra_sl_cat_theo_mau.sql`** — cập nhật theo luật mới; chạy được cả trước lẫn sau migration (`#kieuSD` qua `EXEC`).
- **`backend/utils/kiem_cay_thanh_pham.js`** *(MỚI)* — mô phỏng luật trên 18 dòng thật của DH2608073: Đen 02 = 150, Tàn 43 = 30, và đối chứng luật cũ ra đúng 250.
- `frontend/index.html` — `module.qlsx.js?v=8.93`.

## 4. Không đổi / giới hạn

- Số **đã ghi** ở May/QC/ĐG/KN không đổi — chỉ cột tham chiếu "Cắt" và "Còn lại" đổi. Riêng giá thành và báo cáo năng suất đọc "SL cắt" qua cùng hàm nên **sẽ giảm** cho các lệnh dính lỗi — đó là số đúng.
- Bản ghi phối **toàn cây dùng chung** → luật B không suy được → phải khai Kiểu sơ đồ.
- Bản ghi phối có một cây **cấp tay** (không phiếu) → luật B không kích hoạt → cây cấp tay vẫn tính (L2, hành vi cũ).
- Danh sách lệnh SX gọi luật B cho mọi lệnh mỗi lần mở — vì vậy 4 index trong migration **không phải tùy chọn**.

---

## 5. Deploy

> 🔴 **`server\D:\QLSX` LÀ MÁY CHẠY THẬT.** Không có bản chạy thử.

### Bước 1 — kiểm tại C:
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\cayThanhPham.js
node --check backend\routes\qlsx.js
node --check backend\routes\khohang.js
node --check backend\routes\bangke.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_cay_thanh_pham.js
node backend\utils\kiem_he_so_ri_theo_cat.js
```
Cả hai bộ kiểm phải **0 sai**.

### Bước 2 — số TRƯỚC (chỉ đọc)
SSMS → `kiem_tra_sl_cat_theo_mau.sql` với `@MaDH = 'DH2608073'` → lưu Bảng 1. `SL_HeThong` của Đen 02 lúc này vẫn phải là **250** (file chẩn đoán đã theo luật mới, nhưng chưa có cột Kieu nên luật B vẫn áp — nếu Bảng 1 đã ra 150 thì càng tốt: file và code cùng luật).

### Bước 3 — migration
SSMS → `migration_v880.sql` → Execute. Xem bảng kết quả cuối: lệnh nào có cây xuất hai kiểu — đó là danh sách lệnh **có thể** dính, đối chiếu dần.

### Bước 4 — copy 6 file sang `server\D:\QLSX\`
```
backend\utils\cayThanhPham.js
backend\routes\qlsx.js
backend\routes\khohang.js
backend\routes\bangke.js
frontend\js\module.qlsx.js
frontend\index.html
```
Rồi `node tao_file_cai_dat.js` ở C: để gộp v880 vào `CAI_DAT_DAY_DU.sql`.

### Bước 5
```powershell
pm2 restart qlnoibo
findstr /C:"bieuThucBanGhiLaPhoi" D:\QLSX\backend\utils\cayThanhPham.js
findstr /C:"sdKieuSelectHtml" D:\QLSX\frontend\js\module.qlsx.js
```
Cả hai phải ra kết quả (bài học hôm trước: `index.html` bump mà JS chưa sang). Ctrl+F5.

### Bước 6 — kiểm trên DH2608073
1. Ghi tiến độ → QC → cột **Cắt** của Đen 02 phải là **150**, Tàn 43 **30**, Ghi 43 **120**, Đô 50 **150**.
2. Kỹ thuật → Sơ đồ: bảng có cột **Kiểu**, cả 4 sơ đồ đang "chưa khai". Sửa sơ đồ 6252 → Phối → Lưu → QC vẫn 150 (luật B đã loại rồi, sơ đồ chỉ xác nhận).
3. Mở một lệnh **không** có cây xuất hai kiểu → số Cắt **không đổi** so với trước.
4. Danh sách lệnh SX mở lên trong thời gian bình thường (index đã có).
