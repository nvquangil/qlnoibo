# PRD v9.21 — Phiếu nhập lại hàng hóa: SỬA ĐƯỢC

**Ngày:** 2026-11-05 · **Nguyen:** *"Phiếu nhập lại hàng hóa hiện tại không sửa được. Thay đổi thành sửa được."*

## 1. Đây là đảo một quyết định cũ — nói rõ trước

v6.66 **cố ý** không cho sửa, ghi ngay trong code: *"giá đã khóa cứng theo phiếu xuất nên 'sửa' thực chất chỉ là đổi số lượng → hủy rồi lập lại vừa rõ ràng vừa không sinh đường sửa tồn thứ hai."* Phiếu nhập lại **hoàn tồn kho + giảm công nợ khách**, nên mở đường sửa là mở đường sai tiền và sai kho.

Đã mở theo yêu cầu, nhưng **không sinh đường tồn thứ hai**: route sửa ghép lại đúng hai mảnh có sẵn của Hủy và Tạo —

```
truLaiTon()  →  DELETE chi tiết  →  UPDATE đầu phiếu  →  INSERT chi tiết + ghiXuatKho(-slChinh)
   (của Hủy)                                                      (y hệt POST)
```

**Ba ranh giới an toàn (backend ép, không chỉ khóa ở giao diện):**

| Giữ nguyên | Vì sao |
|---|---|
| **Giá** từng dòng | vẫn khóa cứng theo dòng phiếu bán gốc (`chuanBiPhieu`) — người dùng chỉ đổi được **số lượng**, ngày, lý do, ghi chú |
| **Khách hàng** | `tenKhach` ép bằng khách cũ của phiếu. Đổi khách = công nợ nhảy giữa hai người ⇒ muốn đổi thì hủy, lập mới |
| **Phiếu đã hủy** | không sửa được (tồn đã trả về) — nút Sửa hiện ở trạng thái **khóa kèm lý do**, không giấu đi |

Giữ nguyên cả **SoPhieu / NguoiTaoID / ngày tạo** (sửa không phải lập phiếu mới) và **SĐT/địa chỉ đã lưu trên phiếu**.

## 2. Mấu chốt kỹ thuật: `boPhieuNLID`

"Còn trả được" = đã bán − **đã trả** − khách mua luôn. Khi sửa chính phiếu đang trả 3 cái, nếu vẫn đếm 3 cái đó là "đã trả" thì: form sửa **mở ra trống trơn** (mọi dòng `ConTraCai = 0`) và mọi lần sửa đều bị chặn "trả vượt" dù chỉ giảm 3 → 2.

Nên `utils/dongDaBanChoKhach.js` nhận thêm `opts.boPhieuNLID` (**tuỳ chọn** — 5 màn khác gọi hàm này không đổi hành vi) để loại chính phiếu đang sửa khỏi phép "đã trả". 🔴 Cờ này **chỉ** dùng khi sửa: `POST /phieu` **ép `boPhieuNLID: null`**, không tin body — gửi kèm lúc tạo mới là bỏ qua phần đã trả của một phiếu khác ⇒ trả vượt số đã bán ⇒ tồn tăng khống.

Ba ca chặn trả vượt (rà chéo xác nhận đúng cả ba): mua 5, phiếu này đang trả 3 → sửa thành **5: cho**, thành **6: chặn**; có phiếu khác đã trả 2 → sửa thành **4: chặn** (trần 3).

## 3. File

| File | Gì |
|---|---|
| `backend/routes/nhaplai.js` | route **`PUT /phieu/:id`**; `layDongDaBan(..., boPhieuNLID)`; 2 route lấy dòng nhận `?boPhieuNLID`; POST ép null; `truLaiTon(..., viec)` để câu lỗi tồn nói đúng việc |
| `backend/utils/dongDaBanChoKhach.js` | `opts.boPhieuNLID` (tuỳ chọn) |
| `frontend/js/module.nhaplai.js` | `openForm(suaId)` dùng chung Lập/Sửa; nút Sửa; prefill; 3 lời gọi API kèm cờ; lưu bằng `apiPut` |
| `frontend/index.html` | `module.nhaplai.js?v=9.21` |
| `backend/utils/kiem_sua_phieu_nhap_lai.js` *(mới, KHÔNG copy)* | **kiểm hành vi thật**: require util + pool giả, bắt câu SQL sinh ra để chứng minh cờ chỉ ăn khi được truyền; + thứ tự `truLaiTon` trước `DELETE`; + ép `tenKhach` |
| `backend/utils/kiem_hang_mau_o_khach.js` *(sửa, KHÔNG copy)* | nới regex chữ ký `layDongDaBan` (thêm tham số tuỳ chọn làm nó **đỏ oan**) |

Không migration. Công nợ tính động từ `TongThanhToan` nên sửa xong là khớp ngay, không phải backfill.

**Rà chéo độc lập: PASS 7/8, bắt 8 điểm — đã sửa hết**, gồm 2 lỗi đỏ: bộ kiểm cũ đỏ oan vì đổi chữ ký, và **backend chưa ép `tenKhach`** (giao diện khóa nhưng API vẫn đổi được khách ⇒ công nợ nhảy giữa hai khách). Cùng với: thứ tự `truLaiTon`/`DELETE` chưa có phép ghim, phép "không viết phép tồn riêng" xanh oan, câu lỗi tồn ghi "trả lại" giữa lúc đang Sửa, hai ca prefill hỏng im lặng (khách hoặc phiếu bán gốc đã hủy), và SĐT/địa chỉ bị ghi đè.

## 3b. v9.22 — form sửa chỉ hiện MÃ ĐÃ NHẬP LẠI

**Nguyen (ngay sau v9.21):** *"Sửa là hiện ra cái phiếu đã nhập lại và những mã đã nhập lại thôi. Đang hiện ra như lúc lập phiếu ban đầu."* — đúng: v9.21 prefill tích sẵn nhưng vẫn liệt kê cả phiếu xuất.

- Chế độ sửa: bảng **chỉ các mã đang có trong phiếu** (lọc theo **hợp** của `daNhap` + `boGoc` — dòng bị đặt SL = 0 **vẫn ở lại bảng** để gõ lại; chỉ dựa `daNhap` thì nó rời bảng và không còn ô nào để sửa).
- Ô **"➕ Thêm mã khác vào phiếu"** (mặc định TẮT) để bổ sung mã; bật/tắt **giữ nguyên** số đang gõ dở.
- **Khóa ô "Phiếu xuất"** khi sửa — đổi phiếu là `taiDong()` xóa sạch số đang sửa mà không báo (rà chéo bắt).
- Dòng của phiếu **không hiện lại được** (phiếu bán gốc đã hủy, hoặc dòng đã trả hết / khách mua luôn ở nơi khác): **bỏ khỏi phiếu** và nói thẳng *"sửa và lưu sẽ BỎ N dòng đó"* — trước đó hứa "vẫn được giữ khi lưu" là sai, vì backend từ chối cả hai nguyên nhân ⇒ người dùng không bao giờ lưu được mà không hiểu vì sao.
- Hàm lọc tách thành `locDongTheoCheDo()` **thuần** để bộ kiểm chạy 6 ca thật (luật: kiểm hành vi, đừng so chuỗi).

Bump `module.nhaplai.js?v=9.22`. Rà chéo v9.22: bắt **3 lỗi thật (2 đỏ) + 2 câu chữ** — đã sửa hết.

## 4. Deploy — GỘP với v9.18–v9.20 (một đợt, **7 file**)

`frontend/index.html` mang bump của cả hai nhóm (`module.payroll.js?v=9.20` + `module.nhaplai.js?v=9.21`) ⇒ không deploy lẻ.

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\payroll.js
node --check backend\routes\nhaplai.js
node --check backend\utils\luongGiaCongInThe.js
node --check backend\utils\dongDaBanChoKhach.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.nhaplai.js
node backend\utils\kiem_luong_theo_qc.js
node backend\utils\kiem_congno_giacong_inthe.js
node backend\utils\kiem_luong_cat_marap_excel.js
node backend\utils\kiem_sua_phieu_nhap_lai.js
node backend\utils\kiem_hang_mau_o_khach.js
findstr /C:"maRapTheoDon" D:\QLSX\backend\utils\maRapCuaDon.js
```

Năm bộ kiểm `0 sai` + `findstr` có kết quả → copy **7 file**: `backend\routes\payroll.js` · `backend\routes\nhaplai.js` · `backend\utils\luongGiaCongInThe.js` · `backend\utils\dongDaBanChoKhach.js` · `frontend\js\module.payroll.js` · `frontend\js\module.nhaplai.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5.

**Thử (ngoài checklist lương cắt ở PRD_v918/919/920):**
1. Phiếu nhập lại → **Sửa** một phiếu: form mở ra **đã tích sẵn** đúng các mã và số lượng cũ; sửa SL một dòng → ô tổng đổi theo → Lưu thay đổi.
2. Mở lại phiếu vừa sửa: số tiền, tồn kho (tab Thẻ kho mã đó) và **công nợ khách** khớp số mới.
3. Sửa SL **lên bằng đúng số đã bán**: phải cho. Sửa **vượt**: phải chặn, câu từ chối nêu rõ đã bán / đã trả / còn trả được.
4. Phiếu **đã hủy**: nút Sửa hiện **mờ (khóa)** kèm lý do khi rê chuột, bấm không mở form.
5. Lập phiếu nhập lại **mới** cho mã đã trả hết: vẫn bị chặn như trước (cờ loại trừ không rò sang đường tạo mới).
6. Sổ "Hàng mẫu ở khách", cảnh báo ở form Bán hàng, popup Thẻ kho: số **không đổi** so với trước deploy.

**Commit:** `"v9.21 phieu nhap lai: sua duoc (PUT /phieu/:id, hoan ton cu bang truLaiTon roi ghi lai nhu POST); boPhieuNLID loai chinh phieu dang sua khoi phep da-tra; ep tenKhach + chan phieu da huy"`

## 5. Nói trước

- Sửa phiếu **không** đổi được khách và **không** đổi được giá — chỉ số lượng/ngày/lý do/ghi chú. Cần đổi khách hoặc giá: hủy phiếu, lập lại.
- Dòng cũ **không gắn** dòng phiếu bán gốc (dữ liệu rất cũ) sẽ **bị bỏ** khi lưu bản sửa — form cảnh báo trước khi lưu.
- `POST /tinhthu` (xem trước số tiền) nhận cờ loại trừ mà không ép null — chỉ ĐỌC, không ghi gì; tệ nhất là người có quyền xem thấy con số "còn trả được" thổi lên, còn khi lưu thì `POST /phieu` tính lại với null.
