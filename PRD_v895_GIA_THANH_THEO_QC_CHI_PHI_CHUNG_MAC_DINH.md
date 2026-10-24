# PRD v8.95 — Giá thành theo SL QC, tự chốt khi QC xong, chi phí chung mặc định cho mọi lệnh

**Ngày:** 2026-10-22 · **Yêu cầu của Nguyen:** *"thay đổi trong tính giá thành sản phẩm. sau khi cập nhật công đoạn QC lấy số lượng của QC để tính giá thành. Khi công đoạn QC cập nhật tiến độ xong sẽ tự ra giá thành lệnh sản xuất đó. bên tính giá thành sẽ có cài đặt phần chi phí chung chung tất cả lệnh sản xuất"*

**Ba quyết định đã chốt với anh (AskUserQuestion):**
1. Chốt khi lệnh **rời công đoạn QC** (đủ số cắt hoặc tích "Đã hoàn thành") — không phải sau mỗi đợt.
2. Chi phí chung: lệnh **có khai riêng thì dùng riêng, bỏ chung**. Không cộng hai nguồn.
3. "Tự ra giá thành" = **nạp vào Giá vốn hàng hóa** như v8.90, cộng thông báo số ngay sau khi Gửi QC.

---

## 1. Thay đổi về nghĩa — đọc kỹ, đây là tiền

### 1.1 Mẫu số của giá thành

| Thứ tự | Nguồn | Điều kiện | Được nạp giá vốn? |
|---|---|---|---|
| 1 | **SL QC đạt** (lũy kế các đợt) | lệnh đã **rời** QC (con trỏ ở công đoạn sau QC, hoặc Hoàn thành) | **Có** |
| 2 | SL phiếu nhập kho hàng hóa (quy về cái) | như v8.90 | Có |
| 3 | Lũy kế công đoạn Kho nhập | lệnh cũ | **Không** |
| 4 | SL cắt | chưa có gì | Không |

QC chưa xong ⇒ **không** dùng QC (đợt 1 là 100/1.000 cái, chia là giá gấp 10 lần) ⇒ lùi xuống hàng 2–4 và `nguonSL` ghi rõ *"QC chưa xong"*.

### 1.2 Chi phí chung — hai nguồn, riêng thắng chung
- `ChiPhiChungMacDinh` (bảng mới, migration_v882): đ/1 SP, áp cho mọi lệnh. Cài ở tab Giá thành → nút **⚙️ Chi phí chung mặc định**.
- `ChiPhiChungDonHang` (có từ v6.15): riêng từng lệnh.
- Lệnh có ≥1 dòng riêng **số tiền > 0** ⇒ dùng riêng, bỏ chung. Dòng riêng chỉ có tên, tiền 0 ⇒ coi như chưa khai ⇒ vẫn dùng chung (rà chéo bắt được: không có luật này thì một dòng rác làm giá vốn mất nguyên khoản chung).
- Form riêng từng lệnh **không** đổ bộ mặc định vào ô nhập (bấm Lưu không sửa gì là lệnh bị "đóng băng" khỏi bộ chung). Có nút *"Chép bộ mặc định xuống để sửa"* cho ai cố ý tách.

### 1.3 "Mốc chốt" = giá vốn lần nạp gần nhất
`DonHangSanXuat.GiaThanhChot / GiaThanhChotSL / GiaThanhChotNgay` được ghi **trong** `napGiaVonTuLenhSX()` — tức ở *mọi* đường nạp: rời QC, mỗi phiếu nhập kho của lệnh (4 chỗ trong nhapkho.js, v8.90), nút Chốt tay. Nhờ vậy mốc trên màn giá thành **luôn bằng** giá vốn đang nằm trong Báo cáo kinh doanh.

Hệ quả cần biết: chi phí phát sinh **sau** QC (bao bì ở Đóng gói, chi phí chung mặc định đổi) sẽ vào giá vốn ở **lần nạp kế** — phiếu nhập kho, hoặc bấm Chốt. Màn giá thành so mốc với số tính lại hiện tại, lệch là báo đỏ.

## 2. Lỗi có sẵn từ v8.90 được sửa kèm
`donViSLDungTinh` suy bằng cách **tìm chữ "phiếu"** trong câu nguồn — mà câu nhánh Kho nhập là *"…chưa có phiếu nhập kho"* ⇒ KN cũng thành 'Cái' ⇒ lệnh cũ bấm nạp là ghi giá vốn với mẫu số lũy kế KN (trước v7.56 chỉ là lần ghi cuối) ⇒ giá vốn gấp N. Nay dùng cờ `mauSoTinCay`, đặt đúng 2 nơi (QC xong, phiếu NK). Bộ kiểm có ca riêng cho KN.

## 3. File

| File | Gì |
|---|---|
| `database/migration_v882.sql` *(mới)* | bảng `ChiPhiChungMacDinh`; 3 cột `GiaThanhChot*` trên `DonHangSanXuat` |
| `backend/routes/qlsx.js` | `tinhGiaThanh`: mẫu số QC + cờ `mauSoTinCay` + riêng-thắng-chung; `chotGiaThanhVaNapGiaVon`; POST /tiendo gọi khi rời QC, trả `giaThanhQC`; `GET/PUT /caidat-giathanh/chiphichung` (PUT trong transaction); `POST /giathanh/:maDH/chot`; `/giathanh` trả thêm số dòng mặc định + mốc chốt; `coBangQLSX` (không cache) |
| `backend/utils/giaVonLenhSX.js` | ghi mốc chốt trước khi nạp; lý do "chưa xong QC" |
| `frontend/js/module.qlsx.js` | nút cài đặt chi phí chung mặc định (modal); form riêng không đổ mặc định + nút Chép; khối mốc chốt; nút Chốt; cột "Giá thành đã chốt" + badge "mặc định (N dòng)"; toast gộp sau Gửi QC |
| `frontend/js/common.js` | `toast(msg, type, ms)` — tham số thời gian |
| `backend/utils/kiem_gia_von_tu_lenh_sx.js` | mục 2 theo cờ mới |
| `backend/utils/kiem_gia_thanh_chi_phi_chung.js` | pool giả đủ 3 công đoạn; mục 1b: 8 kịch bản v8.95 chạy hàm thật |
| `frontend/index.html` | qlsx 8.95 · common 8.95 |

## 4. Còn nợ / rủi ro nói trước
- Nút **nạp giá vốn hàng loạt** ở `routes/baocao.js` vẫn ghi `GiaVon` theo đường riêng, **không** kiểm `donViSLDungTinh` và không ghi mốc. Chưa đụng (ngoài phạm vi); dùng nút đó cho lệnh chưa qua QC là có thể ghi giá sai.
- Sửa/xóa một **đợt QC** sau khi đã chốt (PUT/DELETE /ghinhandot) đổi mẫu số nhưng không tự nạp lại — bấm Chốt tay.
- Lệnh đã qua QC **trước** bản này: mốc trống, màn giá thành báo cam "chưa nạp giá vốn" — bấm Chốt từng lệnh (hoặc nạp hàng loạt với lưu ý trên).

---

## 5. Deploy

> 🔴 `server\D:\QLSX` là máy chạy thật.

**Bước 1 — kiểm tại C:**
```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check backend\utils\giaVonLenhSX.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\common.js
node backend\utils\kiem_gia_von_tu_lenh_sx.js
node backend\utils\kiem_gia_thanh_chi_phi_chung.js
```
Bộ kiểm thứ hai cần `jsdom` (như lần trước: `NODE_PATH=...`). Cả hai phải **0 sai**.

**Bước 2 — migration** (SSMS → `migration_v882.sql`), **trước** restart.

**Bước 3 — copy 5 file**
```
backend\routes\qlsx.js
backend\utils\giaVonLenhSX.js
frontend\js\module.qlsx.js
frontend\js\common.js
frontend\index.html
```

**Bước 4 — máy chủ**
```powershell
pm2 restart qlnoibo
findstr /C:"chotGiaThanhVaNapGiaVon" D:\QLSX\backend\routes\qlsx.js
findstr /C:"openCaiDatChiPhiChungModal" D:\QLSX\frontend\js\module.qlsx.js
findstr /C:"module.qlsx.js?v=" D:\QLSX\frontend\index.html
```
Ba dòng ra kết quả, dòng cuối `?v=8.95`. Ctrl+F5.

**Bước 5 — thử**
1. Tab Giá thành → ⚙️ Chi phí chung mặc định → khai 1–2 dòng → Lưu. Danh sách: lệnh chưa khai riêng hiện badge **"mặc định (N dòng)"**.
2. Mở một lệnh **chưa khai riêng** → nhóm 7 ghi *"đang dùng bộ mặc định"*, giá thành đã cộng. Ô nhập riêng **trống**.
3. Mở một lệnh **đã khai riêng** → nhóm 7 ghi *"khai riêng (bỏ bộ mặc định)"*, số = riêng, **không** cộng mặc định.
4. Chọn một lệnh đang ở QC, ghi đợt QC cuối (đủ số cắt hoặc tích Đã hoàn thành) → toast có dòng *"💰 Giá thành lệnh …: X đ/cái (SL QC …)"* + kết quả nạp giá vốn. Mở lệnh đó ở tab Giá thành → *"SL QC đạt (công đoạn QC đã xong)"*, mốc 📌 khớp.
5. Báo cáo kinh doanh → Giá vốn hàng hóa → mã của lệnh đó = X, nguồn "Lệnh SX".
6. Lệnh đang ở QC chưa xong → tab Giá thành ghi *"… QC chưa xong"*, mẫu số không phải QC.
7. Lệnh cũ đã Hoàn thành trước bản này → khối cam "chưa nạp giá vốn" → bấm **📌 Chốt** → mốc xuất hiện.

**Bước 6** — `node database\tao_file_cai_dat.js` (`[115/115] migration_v882.sql`) → commit `"v8.95 gia thanh theo SL QC, tu chot khi roi QC, chi phi chung mac dinh (migration_v882)"` → push.
