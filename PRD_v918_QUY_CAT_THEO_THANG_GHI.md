# PRD v9.18 — Lương trải vải cắt: BỎ chờ QC, quỹ theo THÁNG GHI SỔ CẮT

**Ngày:** 2026-11-04 · **Nguyen:** *"Sửa lại lương bộ phận cắt gia công. Tính theo ngày cập nhật tiến độ trong tháng."* Chốt qua hỏi đáp: **"Bỏ hẳn chờ QC"** + phạm vi **"Chỉ Lương trải vải cắt"**.

## 1. Luật

| | v9.02 (cũ) | v9.18 (mới) |
|---|---|---|
| Lệnh chưa QC | sổ cắt KHÔNG vào quỹ (treo) | **vẫn vào quỹ** |
| Kỳ của một sổ cắt | tháng MUỘN HƠN giữa ngày cắt và ngày QC đầu (thực chất = tháng QC) | **tháng GHI sổ cắt** |

Ví dụ: cắt ghi 15/10, QC đầu 05/11 → cũ: quỹ T11; mới: **quỹ T10, không chờ**. Ba bảng còn lại (khoán may, GC/in thêu, là/đóng gói) + sổ công nợ nhà GC **GIỮ NGUYÊN luật chờ QC v9.02** — đây là ngoại lệ có chủ đích cho mỗi bộ phận cắt (thợ cắt làm đầu chuỗi, QC đến sau hàng tháng). Giờ công chia quỹ vẫn theo tháng chấm công (không đổi). Cột **Ngày QC** giữ lại chỉ để hiển thị (trống = lệnh chưa QC) qua khối mới `OUTER_APPLY_NGAY_QC` — bản OUTER không gate, có cảnh báo "không bao giờ dùng làm gate" ngay trong code.

## 2. Hệ quả TIỀN — đọc trước khi tin bảng lương

Quỹ cắt các tháng **đổi lại** (v9.02 từng dịch: T8 85,6tr→22,4tr, T9 48,9tr→73,2tr — nay quay về gần số trước đó, cộng thêm phần lệnh chưa-bao-giờ-QC được thả ra). Chạy `database/kiem_tra_v918_quy_cat_theo_thang.sql` trong SSMS **trước và sau deploy**: Bảng 1 = quỹ từng tháng theo HAI luật đặt cạnh nhau; Bảng 2 = các lệnh trước đây treo (chưa QC) nay vào quỹ tháng nào, bao nhiêu. **Tháng đã trả lương theo số v9.02: xử lý nghiệp vụ (không truy thu/truy chi tự động — hệ thống chỉ hiện số theo luật mới).** 2 dòng sổ cắt nghi sai hệ số từ đợt v9.02 (DH2608061 = 35,9tr; DH2608070 = 11,7tr) nay lại nằm trong quỹ T9/T10 theo tháng ghi — **vẫn chưa rà**, rà trước khi chốt lương cắt các tháng đó.

## 3. File

| File | Gì |
|---|---|
| `backend/utils/luongGiaCongInThe.js` | + `OUTER_APPLY_NGAY_QC` (hiển thị, không gate) + export |
| `backend/routes/payroll.js` | `loadSoDoCat`: bỏ gate QC + kỳ = tháng ghi; import khối mới |
| `frontend/js/module.payroll.js` | 5 câu luật/empty-hint màn cắt đổi theo luật mới |
| `frontend/index.html` | `module.payroll.js?v=9.18` |
| `backend/utils/kiem_luong_theo_qc.js` *(sửa, KHÔNG copy)* | mục 4 (cắt) đảo chiều CÓ CHỦ ĐÍCH; đếm lọc-trần = đúng 1 chỗ |
| `backend/utils/kiem_congno_giacong_inthe.js` *(sửa, KHÔNG copy)* | regex export ghim cứng → nhận export mới (rà chéo bắt — đỏ oan kiểu cũ) |
| `database/kiem_tra_v918_quy_cat_theo_thang.sql` *(mới, chạy SSMS, chỉ đọc)* | đối chiếu quỹ hai luật |

Không migration. Rà chéo độc lập bắt 2 lỗi thật đã sửa: bộ kiểm công nợ GC vỡ oan vì export mới; SQL đối chiếu Bảng 2 chết scope CTE (đã chuyển sang bảng tạm #soCat).

## 4. Deploy — GỘP với v9.19 (một đợt, 4 file)

⚠️ v9.19 (Ngày cắt / Mã rập / Xuất Excel) sửa **cùng ba file** và index.html đã mang bump 9.19 ⇒ **không deploy lẻ v9.18**. Lệnh kiểm đầy đủ + bước `findstr maRapCuaDon` nằm ở **PRD_v919 mục 4**; sidebar sau deploy hiện **v9.19**.

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\payroll.js
node --check backend\utils\luongGiaCongInThe.js
node --check frontend\js\module.payroll.js
node backend\utils\kiem_luong_theo_qc.js
node backend\utils\kiem_congno_giacong_inthe.js
node backend\utils\kiem_luong_cat_marap_excel.js
```

Cả ba bộ kiểm `0 sai` → copy **4 file**: `backend\routes\payroll.js` · `backend\utils\luongGiaCongInThe.js` · `frontend\js\module.payroll.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5.

**Thử:**
1. Chạy `kiem_tra_v918_quy_cat_theo_thang.sql` → Bảng 1: cột `QuyV918_theoThangGhi` phải khớp quỹ trên tab Lương trải vải cắt từng tháng sau deploy.
2. Tab Lương trải vải cắt T10/T11: lệnh cắt T10 chưa QC **có mặt** trong quỹ T10, cột Ngày QC trống; câu ghi chú dưới bảng nói luật mới.
3. Lương khoán may / GC-in thêu / là-đóng gói: **không đổi số** so với trước deploy (luật QC còn nguyên) — so một tháng bất kỳ.
4. Công nợ nhà gia công: không đổi.

**Commit:** `"v9.18 quy luong trai vai cat: bo cho QC, ky = thang ghi so cat (rieng bo phan cat; 3 bang luong kia giu luat v9.02)"`

## 5. Nói trước

- Lệnh cắt xong rồi HỦY/không bao giờ QC: tiền cắt VẪN đã vào quỹ tháng ghi — đó là chủ đích "bỏ hẳn chờ QC"; muốn loại thì xóa sổ cắt của lệnh đó.
- PRD_v902 mục trải vải cắt đã đánh dấu hết hiệu lực; HUONG_DAN_CAI_DAT.md đã có mục v9.17 + v9.18.
