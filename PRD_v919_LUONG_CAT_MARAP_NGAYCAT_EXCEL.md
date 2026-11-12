# PRD v9.19 — Lương trải vải cắt: Ngày cắt + Mã rập (từ Kỹ thuật) + Xuất Excel

**Ngày:** 2026-11-04 · **Nguyen:** *"Tính lương trải vải cắt. Bàn cắt theo lệnh sản xuất đổi tên cột ngày QC thành ngày cắt cập nhật theo ngày ghi tiến độ. Sửa mã hàng thành mã rập điền mã rập từ công đoạn kỹ thuật sang. Thêm chức năng xuất excel."*

Đi liền sau v9.18 (cùng tab, cùng file) — **deploy chung một đợt**.

## 1. Bảng "Bàn cắt theo lệnh sản xuất" — 8 cột, đổi 2

| Cột | Trước | Nay |
|---|---|---|
| 3 | Mã hàng (`MaSanPham`) | **Mã rập** — nguồn công đoạn **Kỹ thuật** |
| 5 | Ngày QC | **Ngày cắt** — theo ngày ghi tiến độ |

**Ngày cắt:** một lệnh có nhiều sơ đồ ghi nhiều ngày ⇒ hiện **khoảng** `15/10/2026 – 18/10/2026`; cùng ngày thì một ngày. (Lấy đại diện một ngày rồi im lặng là người xem tưởng cả lệnh cắt trong đúng ngày đó.) `tongHopLuongCat` tính thêm `NgayCatDau`/`NgayCatCuoi` = MIN/MAX ngày ghi sổ cắt.

**Mã rập:** mã rập nằm ở **hai nơi, cả hai đều do Kỹ thuật gõ** — bảng Sơ đồ (`DonHangChiTietSoDo.MaRap`) và lúc ghi tiến độ KT (`TienDoSanXuat.MaRap`); đọc một nguồn là trống oan (đã vấp hai lần: v6.06, v7.67) nên dùng **chung** `utils/maRapCuaDon.js`, không chép tay SQL lần thứ ba. Thứ tự ưu tiên (rà chéo chốt): **mã rập của các sơ đồ đã cắt TRONG KỲ trước**, trống mới lùi về mã rập của cả lệnh — để cột Mã rập không "nở" ra mã của sơ đồ ngoài kỳ trong khi cột Số sơ đồ chỉ đếm trong kỳ. Trống = Kỹ thuật chưa khai.

Kèm theo: bản in "Quỹ + bàn cắt" ghi thêm `· rập … · cắt dd/mm – dd/mm` ngay trên dòng tiêu đề lệnh (số cột không đổi); màn chi tiết 1 lệnh: sơ đồ chưa khai mã rập thì lùi về mã rập của lệnh — khớp với sheet Excel.

## 2. Xuất Excel — `GET /api/payroll/luongtraivaicat/excel`

Nút **📊 Xuất Excel** cạnh hai nút In. Ba sheet đúng ba bảng đang xem:

1. **Luong NV cat T{thang}-{nam}** — Mã NV, Họ tên, Giờ công, Hệ số, Lương 1 giờ, Lương khoán tháng + TỔNG.
2. **Ban cat theo lenh** — Mã ĐH, **Mã rập**, Tên SP, **Ngày cắt**, Số sơ đồ, Tổng lớp, Thành tiền + TỔNG.
3. **Chi tiet so do** — Mã ĐH, Mã rập, Ngày cắt, STT sổ cắt, Mét sơ đồ, Khổ vải, Tổng lớp, Người trải vải, Người cắt, Thành tiền + TỔNG.

Route gọi **lại chính các loader của màn** (`getCauHinhLuongCat` → `loadSoDoCat` → `loadGioCongCat` → `tongHopLuongCat` → `ganMaRapChoLenh`) — không viết câu SQL thứ hai, để file Excel và màn hình không ra hai con số. Gate quyền y khuôn các route excel sẵn có: `PAYROLL/view` + chức năng `luongtraivaicat` (GET ⇒ hành động `view`, không cần thêm dòng `ChucNang`).

## 3. File

| File | Gì |
|---|---|
| `backend/routes/payroll.js` | `ddmmyyyy`/`chuoiNgayCat`; `tongHopLuongCat` + NgayCatDau/Cuoi + gộp MaRap; `ganMaRapChoLenh`; route `/luongtraivaicat/excel` |
| `frontend/js/module.payroll.js` | `khoangNgayCat`; bảng theo lệnh đổi 2 cột; nút Xuất Excel; bản in + chi tiết lệnh |
| `frontend/index.html` | `module.payroll.js?v=9.19` |
| `backend/utils/kiem_luong_cat_marap_excel.js` *(mới, KHÔNG copy)* | vm.Script + 12 ca so **hai bản** hàm ngày + chạy thật `tongHopLuongCat` + nối dây Excel |
| `backend/utils/kiem_luong_theo_qc.js` *(sửa, KHÔNG copy)* | phép FE cắt theo cột mới |

Không migration. Không đụng `backend/utils/maRapCuaDon.js` (đã live từ v7.67) — nhưng payroll.js nay `require` nó, nên trước khi restart hãy chắc file đó **có trên D:\** (xem mục 4).

Rà chéo độc lập: **PASS 8/8, không lỗi chặn**; hai góp ý LOW đã sửa luôn (thứ tự ưu tiên mã rập; màn chi tiết khớp sheet Excel). Một góp ý để ngỏ: `maRapTheoDon` quét toàn bảng, không index trên `MaRap` — chấp nhận được vì 4 màn khác đã gọi nó từ lâu; nếu sau này chậm thì thêm tham số `donHangIds`.

## 4. Deploy — ⚠️ ĐỢT NAY LÀ **7 FILE**, xem **PRD_v921 mục 4**

(v9.21 sửa phiếu nhập lại cũng bump chung `index.html` ⇒ không deploy lẻ nhóm lương cắt. Lệnh dưới đây là phần của riêng v9.18–v9.20, giữ để tra cứu.)

### Phần lương cắt (v9.18 + v9.19 + v9.20, 4 file)

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\payroll.js
node --check backend\utils\luongGiaCongInThe.js
node --check frontend\js\module.payroll.js
node backend\utils\kiem_luong_theo_qc.js
node backend\utils\kiem_congno_giacong_inthe.js
node backend\utils\kiem_luong_cat_marap_excel.js
findstr /C:"maRapTheoDon" D:\QLSX\backend\utils\maRapCuaDon.js
```

Ba bộ kiểm `0 sai` **và** lệnh `findstr` cuối có kết quả (payroll.js mới `require` file này — thiếu là route trả 500) → copy **4 file**: `backend\routes\payroll.js` · `backend\utils\luongGiaCongInThe.js` · `frontend\js\module.payroll.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5 (sidebar **v9.19**).

**Thử:**
1. Tab Lương trải vải cắt → bảng "Bàn cắt theo lệnh sản xuất": cột **Mã rập** có số (lệnh nào Kỹ thuật đã khai), cột **Ngày cắt** hiện ngày hoặc khoảng — đối chiếu với sổ cắt của một lệnh bất kỳ.
2. Bấm **📊 Xuất Excel** → sheet 2 phải **khớp từng dòng** với bảng trên màn; sheet 1 khớp bảng lương NV; sheet 3 khớp modal chi tiết khi bấm vào một lệnh.
3. Bấm một lệnh → modal chi tiết: sơ đồ chưa khai mã rập hiện mã rập của lệnh (không trống như trước).
4. 🖨️ In quỹ + bàn cắt: dòng tiêu đề lệnh có `· rập …` và `· cắt …`, bảng không lệch cột.
5. Lệnh chưa QC vẫn trong quỹ (v9.18) — cột Ngày cắt vẫn có số (không còn phụ thuộc QC).

**Commit:** `"v9.19 luong trai vai cat: cot Ngay cat (ngay ghi tien do, khoang dau-cuoi) + Ma rap tu cong doan Ky thuat + xuat Excel 3 sheet"`

## 5. Nói trước

- Cột **Ngày cắt** của lệnh là **khoảng**, không phải một mốc — khi đối chiếu với sổ cắt nhớ điều đó.
- Mã rập **trống** nghĩa là Kỹ thuật chưa khai ở cả bảng Sơ đồ lẫn ghi tiến độ KT — không phải lỗi bảng lương.
- File Excel lấy **đúng kỳ đang chọn** trên màn (tháng/năm ở thanh kỳ), không phải toàn bộ lịch sử.
