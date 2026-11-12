# PRD v9.45 — Lương công nhật theo bảng thực tế T10/2026

*Soạn 11/11/2026 từ file `Tháng 10.2026.xlsx` (3 sheet). **Đã chốt (§8) và đã viết mã cùng ngày — xem `docs/TRIEN_KHAI_v936_v940.md` §9 để nghiệm thu.***

> ⚠️ §5.1 dưới đây đề xuất bảng `ThongSoLuong` riêng, không bắt buộc hợp đồng. **Anh chốt ngược lại** (§8.10: "Ký hợp đồng có lựa chọn theo KPI hay theo SP") ⇒ thông số nằm trên **HopDongLaoDong** (migration_v890), người không có hợp đồng hiệu lực **không có trong bảng lương**. §5.1 giữ lại làm lịch sử.

---

## 1. Vấn đề

Phần mềm **đã có** bộ tính lương công nhật (v6.1, tháng 7/2026, viết từ `luong.xlsm`), nhưng anh chưa dùng. Đối chiếu với bảng T10/2026 cho thấy lý do: bảng thực tế dùng **hai mô hình** (lương ngày cho 36 người, lương tháng cho 11 người), còn phần mềm dùng **mô hình thứ ba** — có thuế TNCN và giảm trừ gia cảnh mà thực tế không áp, thiếu thử việc 85%, thiếu KPI, thiếu chức vụ, thiếu chuyên cần, tăng ca không cộng vào lĩnh.

Hậu quả: bảng lương 47 người vẫn làm tay trên Excel, với các lỗi điển hình của Excel đã thấy ngay trong file này (§3).

---

## 2. Giải mã công thức — đã kiểm bằng số thật

### 2.1 Sheet "LƯƠNG CÔNG NHẬT T10/2026" — 36 người, lương NGÀY

```
Tổng tiền   = Lương ngày × Số ngày LV + Tiền làm thêm + TN/KPI + Xăng xe + Chuyên cần
Thành tiền  = ROUND_nghìn(Tổng tiền − Tạm ứng − Tiền đóng BH)
```

| Khoản | Quy tắc đọc được | Bằng chứng |
|---|---|---|
| Lương ngày × ngày | ngày có số lẻ từ máy chấm công | Lan Anh 500.000 × 27,7712 = 13.885.621 |
| Tiền làm thêm | giờ × **đơn giá giờ RIÊNG** (không theo công thức chung) | Liệu 270k → 45.000/h (=1/6) · Quốc 300k → 45.000/h (=0,15) · Thọ 280k → 36.400/h (=0,13) · Hợp 357k → 35.700/h (=0,10) |
| TN/KPI (kế toán) | 500.000 ÷ 26 × ngày | Soan 23,5 ngày → 451.923 · Duyên 27 → 519.231 |
| Xăng xe | đơn giá/ngày × ngày | Nhung 15.000 × 27 = 405.000 (ghi chú trong file) |
| Chuyên cần | số cố định từng người khi đủ | Hợp 300k · Nhung 300k · Cô Lan 200k |
| Tiền đóng BH | **10,5% × mức đóng riêng**, KHÔNG phải lương | 840k = 8tr · 630k = 6tr · 584k = 5,56tr (ghi chú "từ T7 mức mới 5.560k") · 558k = 5,31tr |
| Lương cố định tháng | ghi đè Tổng | O Tám 335k × 31 = 10.385.000 nhưng Tổng = 10.000.000 |
| Điều chỉnh tay | trừ thẳng vào Thành tiền, không có cột | Ngọc: Tổng 4.983.333 → Thành tiền 4.783.000 (−200k, ghi chú "nghỉ nhiều không xin phép") |
| Người lương khoán | Thành tiền = 0 bằng cách **gõ Tổng vào cột BH** | Phương/May/Hưng trải vải, Vương chần đè |

### 2.2 Sheet "BẢNG LƯƠNG CÔNG NHẬT THÁNG 10/2026" — 11 người, lương THÁNG, có 3 chữ ký

```
Lương CB      = CB ÷ 27 × (ngày thử việc × 0,85 + ngày chính thức × 1)
Thưởng KPIs   = mức KPI × KPI% × ngày ÷ 27          (hoặc lấy thẳng từ sheet KPI — Media)
Lương OT      = giờ × CB ÷ 27 ÷ 8 × (thử việc ? 0,85 : 1) × 100%
Tiền xăng     = đơn giá/ngày × ROUND(ngày đi làm thực tế, KHÔNG tính phép)
Chức vụ/TN    = mức × ngày ÷ 27                       (phép CÓ tính)
Chuyên cần    = mức nếu đủ 27 công và KHÔNG có phép, else 0
BHXH          = 10,5% × CB (chỉ người có đóng)
Thực nhận     = Lương CB + KPI + OT + xăng + chức vụ + chuyên cần − BHXH − tạm ứng
```

Bằng chứng:
- Lan KTT: 16 TV × 10tr÷27 × 0,85 + 9,5 CT × 10tr÷27 = **8.555.556** ✓ · chức vụ 2tr × 26,5÷27 = **1.962.963** ✓ · xăng 20k × ROUND(26,5 − 1 phép = 25,5) = 20k × 26 = **520.000** ✓ · chuyên cần 0 vì có 1 phép ✓
- Loan QC: OT 11,5h × (5,4tr÷27÷8 = 25.000) × 0,85 = **244.375** ✓ · xăng 20k × ROUND(19,5) = 20k × 20 = **400.000** ✓
- Xuân: KPI 4tr × 6÷27 = **888.889** ✓ (KPI prorate theo ngày, không nhân 0,85)
- Hường: BHXH 7tr × 10,5% = **735.000** ✓

### 2.3 Sheet "KPI HƯƠNG MEDIA"

`247 ảnh × 20.000 + 0 video × 50.000 = 4.940.000` → đổ thẳng vào cột Thưởng KPIs của Hương ở sheet 2.

---

## 3. Lỗi tìm thấy trong file — lý do nên đưa vào phần mềm

| # | Lỗi | Hậu quả |
|---|---|---|
| 1 | **Tổng tạm ứng sheet 1 = 8.720.000, cộng tay = 11.720.000** (Soan 3,12tr + Quốc 4tr + Hằng bé 1,6tr + Nghĩa 3tr) | Dòng tổng thiếu 3.000.000. Thành tiền từng người vẫn đúng; ai đối chiếu quỹ theo dòng tổng là lệch 3tr |
| 2 | Hệ số OT ghi "150% / 200% / 300%" ở tiêu đề sheet 2, nhưng **tính 100%** | Hoặc tiêu đề sai, hoặc đang trả thiếu OT |
| 3 | Bốn tỷ lệ đơn giá giờ OT khác nhau ở sheet 1 (1/6, 0,15, 0,13, 0,10) | Nếu là nhầm thì có người đang nhận OT thấp hơn người khác 40% |
| 4 | Điều chỉnh (−200k Ngọc) trừ thẳng, không cột, không dấu vết | Tháng sau không ai biết vì sao số không khớp công thức |
| 5 | Người lương khoán nằm lẫn, dùng cột BH làm chỗ "trừ hết" | Cột BH mất nghĩa; cộng cột BH ra số vô lý |
| 6 | Hai sheet cùng tháng dùng **hai công chuẩn** (26 ở sheet 1 cho KPI kế toán, 27 ở sheet 2) | Cùng một tháng, hai mẫu số |
| 7 | Hai ô `#REF!` ở vùng ghi chú BH | Công thức tham chiếu đã vỡ |

---

## 4. Phần mềm đang có — dùng lại được gì

| Thành phần | Trạng thái | Dùng lại |
|---|---|---|
| Chấm công: kéo máy qua IP, nhập file, nhóm chấm công, giờ vào/ra, tổng hợp ra **số công lẻ** + giờ OT theo loại | ✅ có, đang chạy | **Dùng nguyên** — số 26,71 / 27,77 trong file đúng là kiểu nó sinh ra |
| Tạm ứng = tổng phiếu chi loại Tạm ứng của tháng (v9.32) | ✅ | Dùng nguyên — hết lỗi #1 |
| Bảng cấu hình: BH 8/1,5/1, công chuẩn năm, 5 bậc thuế | ✅ | Dùng; thêm công tắc thuế |
| Bảng lương snapshot + chốt + Excel + file CK BIDV | ✅ | Dùng; thêm cột |
| Bộ tính `tinhLuongCongNhat` | ✅ nhưng **sai mô hình** | Viết lại theo §5 |
| Lương trải vải cắt, khoán may, gia công, là/đóng gói | ✅ các tab riêng | Người lương khoán **ra khỏi** bảng công nhật |
| Lương CB + 4 phụ cấp lấy từ **Hợp đồng lao động hiệu lực** | ✅ | ❌ Không đủ: 36 người sheet 1 phần lớn không có hợp đồng; thiếu 8 thông số (§5.1) |

---

## 5. Thiết kế đề xuất

### 5.1 Thông số lương từng người, có hiệu lực theo ngày

File có ghi chú "330k/ngày **từ tháng 10**", "tăng lên 10tr **từ T6**", "**từ T7** mức đóng BH mới" ⇒ thông số đổi theo thời gian, phải giữ lịch sử. Bảng mới `ThongSoLuong` (NhanVienID, **TuNgay**, …), bộ tính lấy dòng mới nhất có TuNgay ≤ cuối tháng:

| Thông số | Sheet 1 | Sheet 2 |
|---|---|---|
| `KieuLuong` | `Ngay` | `Thang` |
| `DonGiaNgay` / `LuongThang` | 500.000 | 10.000.000 |
| `DonGiaGioOT` (trống = tự suy: lương ngày ÷ 8 hoặc CB ÷ CC ÷ 8) | 45.000 | trống |
| `MucDongBH` (trống = không đóng) | 8.000.000 | 7.000.000 |
| `ThuongKPIThang` + `KPIPhanTram` | 500.000 | 8.000.000 / 100% |
| `PhuCapChucVu` (tháng) | — | 2.000.000 |
| `XangNgay` | 15.000 | 20.000 |
| `ChuyenCanThang` | 300.000 | 500.000 |
| `NgayHetThuViec` | — | 2026-10-16 |
| `LuongCoDinhThang` (ghi đè, O Tám) | 10.000.000 | — |

**Không bắt buộc hợp đồng.** Có hợp đồng thì nút "Lấy từ hợp đồng" điền sẵn — không bắt 36 người đi ký hợp đồng để tính được lương.

### 5.2 Bộ tính mới (một hàm, hai chế độ)

```
công, phép, giờOT          ← chấm công (đã có)
côngTV, côngCT             ← tách theo NgayHetThuViec (chỉ kiểu Thang)

Lương     = Ngay  : DonGiaNgay × công
            Thang : LuongThang ÷ CC × (côngTV × 0,85 + côngCT)
            (LuongCoDinhThang có giá trị thì ghi đè)
OT        = giờOT × (DonGiaGioOT ?? mức giờ suy ra × (thử việc ? 0,85 : 1)) × hệ số OT (cấu hình, mặc định 100%)
KPI       = KPI nhập tay tháng này ?? ThuongKPIThang × KPIPhanTram × công ÷ CC
Xăng      = XangNgay × ROUND(công − phép)          ← quy tắc sheet 2; sheet 1 không trừ phép (§7.6)
Chức vụ   = PhuCapChucVu × công ÷ CC
Chuyên cần= ChuyenCanThang nếu (công ≥ CC và phép = 0) else 0     ← §7.4
BH        = MucDongBH × 10,5%
Thuế TNCN = công tắc; mặc định TẮT (theo thực tế hai bảng)        ← §7.2
Điều chỉnh= cột ± nhập tay, BẮT BUỘC có lý do
Tạm ứng   = từ phiếu chi (đã có)
Thực lĩnh = ROUND_nghìn(Lương + OT + KPI + Xăng + Chức vụ + Chuyên cần + Điều chỉnh − BH − Thuế − Tạm ứng)
```

### 5.3 Màn hình

Một tab **Lương công nhật** như hiện nay, bảng có đủ cột của sheet 2 cộng cột *Điều chỉnh* và *Lý do*; lọc theo kiểu lương (Ngày / Tháng) để in hai bảng riêng nếu anh vẫn muốn hai bảng. In có 3 chữ ký (Người lập / Kế toán trưởng / Giám đốc) như sheet 2. KPI Media: ô nhập số ảnh × đơn giá ngay trong bảng tháng.

---

## 6. Phạm vi & kế hoạch

**Trong:** bảng `ThongSoLuong` (migration), màn nhập thông số (với nút lấy từ hợp đồng), bộ tính mới, cột điều chỉnh + lý do, công tắc thuế, làm tròn nghìn, in 3 chữ ký, bộ tự kiểm chạy thật bộ tính trên **đúng 47 dòng của file T10** làm dữ liệu giả.

**Ngoài:** máy chấm công (đã có), file CK (đã có, chỉ đổi cột), lương khoán các loại (tab riêng, đã có), quyết toán thuế năm.

| # | Việc | Phụ thuộc |
|---|---|---|
| 1 | Anh chốt 7 câu ở §7 | — |
| 2 | Migration `ThongSoLuong` + công tắc thuế + hệ số OT vào cấu hình | 1 |
| 3 | Bộ tính mới + bộ tự kiểm bằng 47 dòng thật | 2 |
| 4 | Màn thông số + bảng lương + in | 3 |
| 5 | **Rà soát**: nhập thông số 47 người, tính T10/2026, so Thực nhận từng dòng với file. Lệch dòng nào = công thức giải mã sai dòng đó | 4 |
| 6 | Rà chéo độc lập, rồi mới deploy | 5 |

---

## 7. Cần anh chốt

1. **Đơn giá giờ OT sheet 1** — bốn tỷ lệ (1/6 · 0,15 · 0,13 · 0,10) là thỏa thuận riêng từng người, hay nhầm? Nếu riêng thì nhập từng người; nếu một công thức thì công thức là gì?
2. **Thuế TNCN** — phần mềm đang tính, hai bảng thực tế không. Tắt? (Tôi không phải kế toán thuế — hỏi kế toán trước khi chốt.)
3. **Hệ số OT** — 100% như đang tính, hay 150/200/300% như tiêu đề?
4. **Chuyên cần** — điều kiện chính xác: đủ công chuẩn? không phép? không đi muộn? (sheet 2 cho thấy 1 phép là mất 500k)
5. **Công chuẩn** — 26 hay 27 cho tháng 10? Hai sheet đang dùng hai số.
6. **Xăng xe** — trừ ngày phép (sheet 2) hay không (sheet 1)?
7. **Một bảng hay hai bảng** — gộp 47 người một bảng có cột kiểu lương, hay giữ hai bảng in riêng?

Và một câu không về công thức: **bảng nào là bảng chính thức** để lưu trữ? Sheet 2 có ba chữ ký; sheet 1 không. Phần mềm sẽ in theo mẫu bảng chính thức.

---

## 8. Đã chốt — Nguyen 11/11/2026 (nguyên văn, kèm cách hiểu đã áp dụng)

| # | Anh chốt | Áp dụng |
|---|---|---|
| 1 | "công thức lương cơ bản / số giờ 1 ngày × 1,5 × giờ OT thực tế chung cho mọi người" | Một công thức, hệ số = `CauHinhLuong.HsTangCaThuong` (1,5), **không** phân biệt CN/lễ. Thử việc nhân thêm tỷ lệ thử việc |
| 2 | "phần mềm đang tính, hai bảng thực tế không, cứ để sẵn vào đó" | Thuế vẫn tính, hiện cột; công tắc `TruThueTNCN` mặc định 0 |
| 3 | "Hệ số OT — 100 điểm tối đa" | Hiểu là thang KPI 0–100 (câu 3 gốc là hệ số OT, nhưng OT đã trả lời ở câu 1) |
| 4 | "đủ công chuẩn? không phép? không đi muộn? … đúng" | Cả ba điều kiện; đi muộn = trễ hơn giờ vào nhóm quá `DiMuonChamChuocPhut` |
| 5 | "theo cài đặt công chuẩn của tháng" | `CongChuanThang`, một số cho cả bảng |
| 6 | "trừ ngày phép (sheet 2)" | Xăng = đơn giá/ngày × ROUND(ngày đi làm thật) |
| 7 | "gộp 47 người một bảng có cột kiểu lương" | Một bảng, cột Kiểu; in 3 chữ ký |
| 8 | "thêm chức năng đánh giá KPI từng người" | Tab Đánh giá KPI, bảng `DanhGiaKPI` (điểm, tiền ghi đè, nhận xét) |
| 9 | "theo sản phẩm tên, đơn giá, số lượng = thành tiền" | Bảng `ThuongSanPhamThang`, thành tiền = cột tính |
| 10 | "Ký hợp đồng có lựa chọn theo KPI hay theo SP. Nếu theo KPI thì hàng tháng có bảng đánh giá KPI theo sp thì lấy theo sản phẩm" | `HopDongLaoDong.KieuThuong` (KPI/SanPham); thông số lương **nằm trên hợp đồng** |
| 10b | "Theo sản phẩm thì người có thể nhiều sp mỗi sản phẩm 1 đơn giá" | Bảng `HopDongSanPham` (nhiều dòng/hợp đồng); tháng nhập SL từng SP, đơn giá tự điền |

**Chưa trả lời:** bảng chính thức để lưu trữ (sheet 2 có 3 chữ ký) — phần mềm in theo mẫu sheet 2 cho cả 47 người.

**Giả định tôi tự đặt khi viết mã** (xem TRIEN_KHAI §9.3): khoản tháng chặn trên 1 × mức khi công > công chuẩn; Lan KPI 8tr = ghi đè; Sâm thử việc 70%.
