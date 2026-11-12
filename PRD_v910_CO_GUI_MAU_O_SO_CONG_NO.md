# PRD v9.10 — Cờ "Gửi mẫu" ở sổ công nợ và sổ chi tiết công nợ

**Ngày:** 2026-10-30 · **Nguyen:** *"sổ công nợ và chi tiết công nợ những phiếu mẫu thêm cờ gửi mẫu"* (kèm ảnh **bản in A4** "SỔ TỔNG HỢP CÔNG NỢ KHÁCH HÀNG" của NPP Thanh Hóa — Đồng Quỳnh).

## 1. Vấn đề

Từ **v7.59** dòng phiếu gửi mẫu đã có badge "Gửi mẫu" — **nhưng chỉ trên bảng xem ở màn hình**. Bản **IN** (thứ mang cho khách ký) và cả hai bản **Excel** thì không có gì.

Nguyên nhân: `soChiTietKH()` trả về `LaHangMau` từ v7.59, nhưng **mọi hàm "map lại từng field"** phía sau nó đều đánh rơi:

| Nơi đánh rơi | Hậu quả |
|---|---|
| `duLieuSoKeToan()` | sổ chi tiết (xem + in) không có nhãn |
| `veSoKeToan()` | Excel sổ kế toán không có |
| `doSo()` | Excel sổ tổng hợp không có |
| `soDoiTac2Chieu()` | sổ 2 chiều không có |

Lúc đối chiếu nợ với khách, đây đúng là khoản khách nói *"cái này là mẫu anh mượn"* — không thấy cờ trên bản in là mất tác dụng của chính tính năng.

## 2. Cách làm

**Một hàm nhãn, mọi nơi gọi** — `nhanGuiMau(r)` trong `module.congno.js`:

🔴 **Bản in không được chỉ dựa vào màu nền.** Trình duyệt **mặc định TẮT in nền**, nên dòng nền vàng `#fffbe6` của màn hình in ra là trắng trơn. Nhãn phải là **chữ có viền** — viền đổi từ `#ffd591` (nhạt) sang `#ad6800` (đậm) chính vì lý do này; `border` và `color` là foreground nên **luôn in**, kể cả đen trắng. `print-color-adjust:exact` chỉ là lớp tăng cường.

**Vị trí nhãn:** cột **Loại** ở sổ tổng hợp (cả in, màn hình, Excel, sổ 2 chiều); cột **Diễn giải** ở sổ chi tiết 10 cột (cột Số chỉ rộng 74px, badge sẽ vỡ dòng).

⚠️ **Lệch có chủ ý:** Excel sổ kế toán ghi `[Gửi mẫu]` ở **đầu** Diễn giải (để lọc/tìm trong Excel ra ngay), còn màn hình + bản in đặt badge ở **cuối**. Ai so hai bản cạnh nhau sẽ thấy khác thứ tự — đây là chủ ý, không phải lỗi.

## 3. Sửa

| File | Gì |
|---|---|
| `backend/routes/congno.js` | `duLieuSoKeToan` + `soDoiTac2Chieu` giữ `LaHangMau`; `veSoKeToan` / `doSo` / `sheetDoiTac2Chieu` ghi chữ ra Excel |
| `frontend/js/module.congno.js` | `nhanGuiMau()` mới; gắn vào **5** nơi: bảng màn hình, `COT_SO_1CHIEU` (bản in), `COT_SO_2CHIEU` (bản in), `soKeToanHtml` (xem + in), bảng sổ 2 chiều |
| `frontend/index.html` | `module.congno.js?v=9.10` |
| `backend/utils/kiem_co_gui_mau_so_cong_no.js` *(mới, không copy sang D:\)* | `vm.Script` + các phép đối chiếu |

**Không có migration.** `PhieuBanHang.LaHangMau` có từ `migration_v693`; `soChiTietKH` vẫn dò cột — chưa chạy migration thì trả `0`, không nơi nào có nhãn, **không nổ**.

### Sau v9.10, 13 đầu ra đứng ở đâu

Có nhãn: màn hình sổ chi tiết KH · **bản in sổ tổng hợp** (đúng ảnh) · sổ kế toán (xem + in) · Excel sổ kế toán · Excel sổ tổng hợp (cả sheet "tất cả khách") · bản in sổ 2 chiều · màn hình sổ 2 chiều · Excel sổ 2 chiều · Dashboard (gọi lại màn hình).

Không có nhãn, **có lý do**: bảng tổng hợp theo khách (một dòng = một **khách**, không phải chứng từ) · sổ NCC / nhà gia công / sổ quỹ (không có khái niệm hàng mẫu) · sheet "CT phiếu bán hàng" (sheet dòng hàng, không phải dòng chứng từ — nói ở mục 5).

## 4. 🔴 Rà chéo chặn deploy — lỗi của chính tôi

**Hai bẫy cú pháp đã làm sập production, tôi vấp cả hai trong một bản vá:**

1. Đặt comment-chèn-chuỗi ở vị trí **câu lệnh**, ngoài template literal → SyntaxError (đã sập v8.06). Tôi tự bắt được ngay.
2. Sửa (1) xong thì viết **cặp đóng comment bên trong comment** → cắt comment sai chỗ (đã vỡ `tao_file_cai_dat.js` v8.61). Cũng tự bắt được.

**Rồi lỗi thứ ba — rà chéo mới bắt: bộ tự kiểm của tôi có 4 phép BÁO ĐỎ OAN**, tức nó luôn `exit 1`. Tôi chưa từng chạy được nó (sandbox hỏng), nên không phát hiện. Đây nguy hiểm vì **lưới an toàn duy nhất bị vô hiệu**: hai regex thiếu dấu `}` đóng substitution; hai regex "bắt bẫy cú pháp" khớp **mọi** comment hợp lệ.

🔴 **Kết luận rút ra, đã ghi vào script:** *không viết phép regex cho hai bẫy cú pháp đó.* Muốn biết một dòng `${/*` nằm trong hay ngoài template literal thì phải **phân tích cú pháp** — đúng việc `vm.Script` làm. Regex chỉ đẻ ra báo động giả rồi người ta ngừng tin bộ kiểm.

Rà chéo còn bắt một **lỗ thật**: sổ 2 chiều có nhãn ở bản in nhưng **thiếu ở màn hình và Excel** — ngược chiều của chính lỗi bản này đi sửa. Đã vá cả hai.

## 5. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\congno.js
node --check frontend\js\module.congno.js
node backend\utils\kiem_co_gui_mau_so_cong_no.js
```

Phải ra `0 sai`. Copy 3 file: `backend\routes\congno.js` · `frontend\js\module.congno.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5.

**Thử:**

1. Công nợ → NPP Thanh Hóa — Đồng Quỳnh → **Sổ chi tiết** → dòng phiếu mẫu có badge vàng (như cũ).
2. Bấm **In sổ** → trên bản A4, cột **Loại** của dòng đó có khung "Gửi mẫu". **Thử in với *Background graphics* TẮT** — khung + chữ vẫn phải đọc được.
3. **Xuất Excel tổng hợp** → cột Loại ghi `Phiếu bán hàng (Gửi mẫu)`.
4. **Xuất Excel sổ kế toán theo kỳ** → cột Diễn giải bắt đầu bằng `[Gửi mẫu]`.
5. Khách vừa là NCC → **Sổ 2 chiều**: màn hình, bản in và Excel **cả ba** phải có nhãn.
6. Khách không có phiếu mẫu nào → không đâu hiện nhãn, bố cục không đổi.

**Commit:** `"v9.10 so cong no: co Gui mau o ban in + Excel + so 2 chieu (truoc chi co tren man hinh)"`

## 6. Nói trước

- **Sheet "CT phiếu bán hàng"** trong file Excel "toàn bộ kèm chứng từ" chưa đánh dấu — sheet đó liệt kê **dòng hàng**, không phải dòng chứng từ. Rà chéo nói thêm cột ở đó tốn ~2 dòng vì `tapCot(pool,'PhieuBanHang')` đã nạp sẵn. Muốn thì nói, tôi thêm.
- Sổ chi tiết 10 cột dùng `table-layout:fixed`, cột Diễn giải còn ~116px sau khi trừ 9 cột cố định. Badge ~50px vẫn gọn một dòng, nhưng **mỗi dòng hàng mẫu cao thêm một dòng** — sổ nhiều phiếu mẫu sẽ dài thêm vài trang.
- Dòng nền vàng trên màn hình giữ nguyên; bản in **không** tô nền dòng (in nền thường bị tắt), chỉ có khung nhãn.
