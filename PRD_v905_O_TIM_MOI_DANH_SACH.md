# PRD v9.05 — Ô tìm ký tự bất kỳ cho mọi danh sách

**Ngày:** 2026-10-27 · **Nguyen:** *"rà soát hết các danh sách chức năng chưa có tìm kiếm, bổ sung tìm kiếm ký tự bất kỳ"*
**Chốt:** làm hết 66 màn · sửa luôn lỗi `data-notim` · gộp **một** bản deploy.

## 1. Kiểm kê — 102 màn danh sách

| Nhóm | Màn DS | Có tìm | Chưa có |
|---|---|---|---|
| Danh mục (20 tab) + Công nợ + Bảng kê BTP | 28 | 27 | 1 |
| Kho vải + Phụ kiện + Vật tư | 13 | 5 | 8 |
| QLSX + Thẻ kho + Nhập kho | 17 | 3 | 13 |
| **Lương + HRM + Tài khoản** | 22 | **0** | **22** |
| Báo cáo + DMS + Nhập lại + Hóa đơn + Dashboard | 22 | 0 | 22 |
| **Tổng** | **102** | **35** | **66** |

Hai phát hiện ngoài yêu cầu, đã sửa luôn:

1. 🔴 **11 màn ĐÃ CÓ ô tìm nhưng ô tìm hỏng** — cột Thao tác thiếu `data-notim` nên gõ "sửa"/"xóa" ra **nguyên bảng**: toàn bộ **20 tab Danh mục** (chung hàm `rowActions`), Phiếu thu, Phiếu chi, Điều chỉnh công nợ, Danh mục phụ kiện, Bảng kê BTP.
2. 🔴 **Hàng mẫu ở khách** gọi `wireTableSearch(body)` không tham số ⇒ đi tìm `#dmSearchBox` vốn không có ở màn đó ⇒ **lời gọi chết từ đầu**, không ai biết.

## 2. Cách làm — KHÔNG sửa bên trong 15 file module

Sửa 66 chỗ bên trong template literal là gần như chắc chắn có một lần đặt nhầm dấu nháy ngược — lỗi đó đã **làm sập máy chạy thật hai lần** (v7.98, v8.73), và lần này `node --check` chạy được nhưng tôi thì không chạy được (môi trường bash hỏng). Nên:

**`frontend/js/common.js` — 3 hàm dùng chung mới + 1 sửa bên trong `wireTableSearch`:**

| Hàm | Việc |
|---|---|
| `chuoiTimCuaDong(tr)` | Dựng chuỗi tìm của một dòng, **bỏ `<button>/<select>/<input>/<textarea>`**. Thay cho việc từng màn phải nhớ gắn `data-notim` ⇒ **sửa một chỗ, xong 11 màn hỏng**, và bắt được cả nút nằm LẪN trong cột dữ liệu (nút "↔ 2 chiều" trong cột Khách hàng của sổ công nợ) — thứ mà `data-notim` theo CỘT không bắt được. **Giữ thẻ `<a>`**: số phiếu / mã hàng / mã đơn hầu hết là link, bỏ đi là tìm không ra chính thứ hay tìm nhất. |
| `laDongThongBao(tr)` | Phân biệt dòng "chưa có dữ liệu" thật (nguyên dòng chỉ có MỘT ô, và ô đó là `.empty-hint`) với **ô chữ mờ bên trong dòng dữ liệu thật** ("chưa ghé", "chưa lên phiếu", "chưa có toạ độ", "bán trực tiếp"…). |
| `themOTim(goc, opts)` | Tự dựng ô tìm, chèn ngay trên bảng, rồi gọi `wireTableSearch`. |
| `themOTimTuDong(goc, opts)` | Gắn cho mọi bảng trong `goc` chưa có ai lo. **Một dòng ở mỗi màn là xong.** |

**38 lời gọi** ở 14 file, phủ ~62 bảng (nhiều màn có 2–4 bảng trong cùng hàm render). Không file nào bị sửa bên trong chuỗi HTML, trừ 2 chỗ thêm thuộc tính `data-khongtim` ở `module.baocao.js`.

### Sửa kèm
- **Hàng mẫu ở khách**: `wireTableSearch(body, 'hmMa')` + **xóa tiền lọc** ở phía dữ liệu (hai luật lọc khác nhau trên cùng một ô: tiền lọc có dấu / 2 cột / so nguyên chuỗi, còn ô tìm chung thì bỏ dấu / mọi cột / tách từ — gõ "ao thun" rồi đổi ô Khách là ra "không có hàng mẫu nào" dù có dòng khớp, và dòng TỔNG cũng cộng trên tập đã bị cắt).
- **Hồ sơ nhân sự (HRM)**: ô tìm cũ chỉ tìm **3 trường** và **phân biệt dấu** — gõ "ky thuat" để lọc theo bộ phận không ra gì. Nay tìm mọi cột hiển thị, bỏ dấu, tách từ, cùng luật với `wireTableSearch`.

### Cố ý KHÔNG gắn
| Màn | Vì sao |
|---|---|
| **Đơn khách đặt hàng** (`module.khohang.js`) | `applyOrderFilters()` cũng ghi `tr.style.display` theo 5 ô chọn ⇒ hai bộ lọc tranh nhau, gõ một chữ là **mở lại các dòng dropdown đang ẩn**; dòng đơn con `tr[data-sub]` mặc định ẩn sẽ **tự bung ra**; `#ordDemDong` và dòng TỔNG CỘNG do `capNhatDem()/capNhatTong()` tính, không được gọi lại ⇒ **số nói dối**. Muốn có ô tìm ở đây phải nhập nó VÀO `applyOrderFilters` (một bộ lọc duy nhất). Việc riêng. |
| Thẻ kho `#khSearch`, Lệnh SX `#qTim`, Tồn theo cây `#fSearch` (có quét QR), Tồn kho `#bcTim` (có mẹo tìm mã cây qua `data-tim`), Giá vốn `#gvTim`, Bảng công `#ccTim` | Đã có ô tìm riêng đang chạy tốt. Thay bằng chuẩn chung là **mất tính năng**. |
| 2 bảng CHỈ TIÊU của Báo cáo tài chính / Kết quả kinh doanh | Gắn `data-khongtim` — bảng P&L vài dòng cố định, ô tìm vô nghĩa. |

## 3. Rà chéo bắt được gì (3 lỗi CHẶN DEPLOY trong bản viết đầu)

| # | Mức | Lỗi | Đã sửa |
|---|---|---|---|
| 1 | 🔴 CHẶN | **Lặp lại đúng bài học v8.07**: dùng `querySelector('.empty-hint')` để nhận dòng trống. Nhưng `.empty-hint` còn là **kiểu chữ mờ cho MỘT ô** trong dòng dữ liệu thật ⇒ ① dòng đó không được gán `data-tim`, **gõ gì cũng vẫn hiện**; ② bảng mà mọi dòng đều có một ô như thế bị đếm là 0 dòng ⇒ **không gắn ô tìm nào**; ③ DMS Shop không gắn lại được ô tìm. Ảnh hưởng 8 màn | `laDongThongBao()` thay cho cả 3 chỗ |
| 2 | 🔴 CHẶN | Đơn khách đặt hàng: ô tìm mới đánh nhau với bộ lọc sẵn có (3 thứ cùng lúc) | Bỏ lời gọi, ghi rõ lý do tại chỗ |
| 3 | 🔴 CHẶN | Bộ tự kiểm báo sai oan: luật "cả file không được chứa `wireTableSearch(body);`" — `renderBanHang` gọi đúng như vậy và **hợp lệ** | Thu hẹp vào đúng vùng Hàng mẫu |
| 4 | NÊN | `neo` trèo quá tay: ra khỏi cả `.card`/`<fieldset>` vốn còn chứa tiêu đề ⇒ ô tìm rơi lên TRÊN khung, trông như ô của khối phía trước (6 màn) | Thêm điều kiện "thẻ cha có đúng MỘT con" |
| 5 | NÊN | **Dòng TỔNG là tiền**: lọc xong thân bảng còn vài dòng mà dòng TỔNG vẫn là tổng cả bảng (10 màn có tiền) | Chưa cộng lại được thì **nói ra**: hiện cảnh báo đỏ cạnh ô tìm khi đang lọc |
| 6 | NÊN | `colCount` đếm `<th>` của MỌI hàng thead ⇒ bảng thead 2 hàng ra số cột gấp đôi | Dùng `__soCotCuaBang()` có sẵn |
| 7 | NÊN | `data-tim=""` là falsy ⇒ có đường sinh ô thứ hai | `hasAttribute('data-tim')` |
| 8 | NÊN | `users.js` gọi TRƯỚC vòng duyệt `tbody tr` theo chỉ số | Chuyển xuống cuối hàm |
| 9 | NÊN | Phép kiểm "đếm số dòng" cắt tới cuối file ⇒ **không thể trượt** = vô dụng | Cắt đúng phạm vi hàm |

Đã kiểm và **không có lỗi**: cú pháp 39 chỗ chèn; biến truyền vào (`body`/`container`/`box`/`hop`/`el`/`resultEl`) đều có thật và đúng phần tử; không màn nào bị **hai ô tìm chồng nhau**; dòng "không tìm thấy" không bị `themCotStt` đánh số nhầm hay lệch `colspan`; `coOTim` không phá 35 màn đã có ô tìm; id sinh tự động không trùng.

## 4. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\common.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.hrm.js
node --check frontend\js\module.users.js
node --check frontend\js\module.mypay.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\module.khohang.js
node --check frontend\js\module.khovai.js
node --check frontend\js\module.phukien.js
node --check frontend\js\module.congno.js
node --check frontend\js\module.baocao.js
node --check frontend\js\module.dms.js
node --check frontend\js\module.nhaplai.js
node --check frontend\js\module.hoadon.js
node --check frontend\js\module.dashboard.js
node backend\utils\kiem_o_tim_moi_danh_sach.js
```

🔴 **Chỉ copy khi CẢ 15 lệnh `node --check` im lặng VÀ bộ tự kiểm ra `0 sai`.** Đây là bản đụng nhiều file nhất từ trước tới nay; `common.js` là file MỌI màn đều dùng, lỗi ở đó là trắng toàn hệ thống.

Copy **16 file** sang `server\D:\QLSX\`:
`frontend\js\common.js` · `module.payroll.js` · `module.hrm.js` · `module.users.js` · `module.mypay.js` · `module.qlsx.js` · `module.khohang.js` · `module.khovai.js` · `module.phukien.js` · `module.congno.js` · `module.baocao.js` · `module.dms.js` · `module.nhaplai.js` · `module.hoadon.js` · `module.dashboard.js` · `frontend\index.html`

(`backend\utils\kiem_o_tim_moi_danh_sach.js` là công cụ chạy ở C, **không copy**.)

```powershell
pm2 restart qlnoibo
findstr /C:"themOTimTuDong" D:\QLSX\frontend\js\common.js
findstr /C:"laDongThongBao" D:\QLSX\frontend\js\common.js
findstr /C:"common.js?v=9.05" D:\QLSX\frontend\index.html
```

**Thử — 6 phép, mỗi phép bắt một lớp lỗi khác nhau:**

1. **Danh mục → Khách hàng**: gõ **"sửa"** → phải **KHÔNG** ra dòng nào (trước v9.05 ra nguyên bảng). Đây là phép kiểm cho `chuoiTimCuaDong`.
2. **Lương → Lương khoán may**: phải có **hai** ô tìm (bảng tổng hợp + bảng chi tiết), gõ ở ô nào lọc bảng đó. Khi đang gõ phải hiện cảnh báo đỏ *"Dòng TỔNG vẫn là tổng của CẢ bảng"*.
3. **DMS → Shop**: đổi ô lọc *Nhà phân phối* rồi gõ tìm → **vẫn lọc được** (đây là màn vẽ lại `tbody` mà giữ nguyên `<table>`; nếu ô tìm trơ thì nhánh gắn-lại hỏng).
4. **DMS → Shop** có shop chưa có toạ độ: gõ một chữ không khớp → shop đó phải **ẩn đi** (trước khi sửa lỗi #1 thì nó ở lại mãi).
5. **Thẻ kho hàng hóa / Lệnh SX / Tồn theo cây / Tồn kho / Giá vốn / Bảng công tháng**: mỗi màn vẫn **đúng MỘT** ô tìm như cũ, không có ô thứ hai.
6. **Đơn khách đặt hàng**: **không** có ô tìm mới; 5 ô lọc + số "Đang hiện N/M" + dòng TỔNG chạy y như trước.

**Commit:** `"v9.05 o tim ky tu bat ky cho moi danh sach: 3 ham dung chung + 38 cho goi + sua 11 o tim hong"`

## 5. Nói trước

- **`module.vattu.js` là mã chết** — không có trong `index.html`, `ModuleVATTU` không ai gọi. Tức tab *Phiếu xuất vật tư* hiện **không vào được**. Không phải lỗi v9.05 nhưng anh nên quyết: nạp lại (phải bump `?v=` và thêm vào bộ tự kiểm) hay xóa file.
- **Danh sách trong popup chưa có ô tìm** — lịch sử mã hàng, chọn đơn, danh sách lệnh của một ô trạng thái, chi tiết tồn, sổ chi tiết công nợ, lịch sử shop… Kiểm kê chỉ tính màn danh sách của tab. Nói nếu anh muốn làm nốt.
- **Dòng TỔNG chưa cộng theo ô tìm** ở 10 màn có tiền (lương, doanh số DMS, hóa đơn, nhập lại, sổ quỹ, báo cáo). Hiện chỉ cảnh báo. Muốn cộng đúng thì phải khai `data-cot`/`data-so` cho từng ô tiền ở từng màn rồi bật `tongTheoLoc` — đúng cách đã làm cho công nợ khách ở v8.89. Việc riêng, theo từng màn.
- **Đơn khách đặt hàng** vẫn chưa có tìm theo ký tự (lý do ở mục 2). Muốn có thì phải gộp vào `applyOrderFilters`.
