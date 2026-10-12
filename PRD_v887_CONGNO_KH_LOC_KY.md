# PRD v8.87 — Sổ công nợ khách hàng: lọc theo kỳ + sửa tiêu đề bản in

Trạng thái: **ĐÃ VIẾT CODE** — chờ chạy thử.
Ngày: 2026-10-12

> Nguyen chốt 2026-10-12: *"từ nay về sau bạn cứ viết luôn không cần đợi duyệt"*. PRD từ đây là tài
> liệu ghi lại quyết định, không còn là cổng chờ.

**Rà chéo tìm được 6 lỗi, đã sửa hết:**

| Lỗi | Hậu quả nếu để nguyên |
|---|---|
| `setHours(23,59,59)` sửa theo giờ máy trong khi mốc là UTC | mốc thật lùi về 16:59:59Z — mất chứng từ cuối ngày cuối kỳ khi có nguồn kiểu `DATETIME` |
| `new Date()` tự đoán định dạng chuỗi | `'2026-1-5'` parse theo giờ máy ⇒ chứng từ ngày đầu kỳ bị tính vào *Dư đầu kỳ* |
| Ngày sai định dạng trả `null` | âm thầm bỏ bộ lọc, màn hình hiện "Toàn bộ phát sinh" như chưa chọn gì |
| `tu.toISOString()` | vi phạm quy tắc "ngày theo giờ VN"; vọng về lùi một ngày |
| Dòng *DƯ ĐẦU KỲ* thiếu `data-tong` | bị `themCotStt()` đánh số thứ tự như một chứng từ |
| `closeModal()` rồi mới `await apiGet` | quá 600ms là sổ cũ bị đẩy vào ngăn xếp, sổ mới chồng lên — bấm Lọc vài lần chạm trần 8 modal |

Thêm hai điểm sửa kèm: nút Xuất Excel đổi nhãn thành **"Xuất Excel toàn bộ"** (route `/export` chưa
nhận kỳ — để nhãn cũ thì bản in theo kỳ và file Excel toàn bộ lệch nhau mà không ai biết), và hai bộ
tự kiểm cũ (`kiem_dashboard_so_congno.js`, `kiem_xuat_in_cong_no.js`) đã bị chữ ký hàm mới làm đỏ.

---

## 1. Vấn đề

Nguyen (2026-10-12): *"Khi vào 1 khách hàng chọn kỳ thì mới lọc ra bảng chi tiết, bảng tổng hợp chưa
theo kỳ chọn. Khi in tổng hợp thì trên tiêu đề vẫn ghi chi tiết công nợ."*

Trong cửa sổ **Sổ công nợ: \<khách\>** có hai thứ khác nhau nằm cạnh nhau:

| | Nguồn dữ liệu | Lọc kỳ |
|---|---|---|
| Bảng phát sinh ở trên | `/api/congno/congnokh/chitiet?khach=` | **Không** |
| 👁️ Xem sổ · ⬇️ Xuất Excel | `/api/congno/so-ke-toan?…&tuNgay=&denNgay=` | Có |

Khối "Kỳ: … đến …" đặt **ngay dưới** bảng nhưng chỉ điều khiển hai nút ở dòng dưới cùng. Người dùng
chọn kỳ, thấy bảng không đổi, kết luận là hỏng — hợp lý, vì bố cục nói rằng nó phải đổi.

Thêm vào đó, nút 🖨️ In của bảng này in ra tiêu đề **"SỔ CHI TIẾT CÔNG NỢ KHÁCH HÀNG"**, trùng tên với
bản in của "Xem sổ" — hai văn bản khác nhau cùng một tên, người nhận không phân biệt được.

---

## 2. 🔴 Điểm không phải chuyện nhãn mác

Lọc bảng theo kỳ **không chỉ là bỏ bớt dòng**. Cột *Còn nợ lũy kế* là số cộng dồn từ đầu. Cắt các
dòng trước kỳ mà vẫn cộng dồn từ 0 ⇒ **cột đó ra số sai**, in ra vẫn đẹp, vẫn mang đi đối chiếu với
khách. Đúng loại lỗi "số sai mà không ai biết".

Bắt buộc có dòng **Dư đầu kỳ** làm điểm xuất phát ⇒ phải sửa backend, không chỉ frontend.

Hệ quả thứ hai: khi `Đến ngày` < hôm nay, **dư cuối kỳ ≠ còn nợ hiện tại**. Phải hiện cả hai con số,
không được để một số duy nhất mà người đọc tự hiểu là cái nào.

---

## 3. Đã chốt (2026-10-12)

| Câu hỏi | Chốt |
|---|---|
| "Bảng tổng hợp" là bảng nào | Bảng trong cửa sổ **Sổ công nợ của 1 khách** (không đụng bảng danh sách tất cả khách) |
| Cột lũy kế khi lọc kỳ | Thêm dòng **Dư đầu kỳ** rồi cộng dồn |
| Tiêu đề bản in | **SỔ TỔNG HỢP CÔNG NỢ KHÁCH HÀNG** (giữ "SỔ CHI TIẾT…" cho sổ kế toán 10 cột) |

---

## 4. Thiết kế

### Backend — `backend/routes/congno.js`

`soChiTietKH(pool, ten)` → `soChiTietKH(pool, ten, tuNgay, denNgay)`:

1. Giữ nguyên phần lấy dữ liệu và tính lũy kế trên **toàn bộ** phát sinh (không đổi công thức —
   đây là chỗ bảng tổng hợp và sổ chi tiết phải khớp nhau).
2. Sau khi có `LuyKe` cho mọi dòng, mới cắt theo kỳ:
   - `duDauKy` = `LuyKe` của dòng **cuối cùng trước `tuNgay`**, không có dòng nào thì `0`.
   - `rows` = các dòng trong `[tuNgay, denNgay]`.
   - `duCuoiKy` = `LuyKe` của dòng cuối cùng trong kỳ, không có dòng nào thì `= duDauKy`.
3. Trả thêm: `tuNgay`, `denNgay`, `duDauKy`, `duCuoiKy`. `conNo` **giữ nguyên nghĩa cũ** = còn nợ
   hiện tại tính đến hôm nay — không đổi nghĩa một trường đang có, chỗ khác đang đọc nó.

Route `/congnokh/chitiet` nhận thêm `tuNgay` / `denNgay`. **Không truyền = trả y như cũ** — dashboard
và các chỗ gọi cũ không phải sửa gì.

### Frontend — `frontend/js/module.congno.js`

- `soChiTietKH(khach, ky)` nhận kỳ, gọi API kèm kỳ.
- Chuyển khối "Kỳ: … đến …" **lên trên bảng**, thêm nút **🔍 Lọc** để nạp lại bảng. Ô ngày nằm dưới
  bảng là nguồn gốc của hiểu nhầm này.
- Mặc định **để trống kỳ** = toàn bộ, đúng như hiện nay. Không tự đặt 01/01→hôm nay cho bảng, vì làm
  thế là âm thầm đổi con số người dùng đang quen nhìn.
- Khi có kỳ: chèn dòng đầu **"Dư đầu kỳ"** (đậm, nền xám) và dòng cuối **"Dư cuối kỳ"**.
  ⚠️ Bảng xếp mới-nhất-trên-đầu, nên "Dư đầu kỳ" nằm **dưới cùng** — phải ghi rõ "đọc từ dưới lên",
  giống ghi chú đã có ở `inSoCongNo`.
- Dòng tóm tắt đầu modal hiện **hai** số khi lọc kỳ: *Dư cuối kỳ* và *Còn nợ hiện tại*.
- Tiêu đề in đổi thành `SỔ TỔNG HỢP CÔNG NỢ KHÁCH HÀNG`; thêm dòng kỳ vào `dongTom` khi có lọc.

### Phạm vi

**Trong**: sổ công nợ **khách hàng** (1 đối tượng) · backend + frontend · bộ tự kiểm · bump `?v=`.

**Ngoài**: ❌ bảng danh sách tất cả khách · ❌ sổ NCC · ❌ sổ gia công/in thêu · ❌ sổ 2 chiều ·
❌ đổi công thức công nợ · ❌ đổi route `/so-ke-toan`.

> Ba sổ kia (NCC, gia công, 2 chiều) có đúng cùng vấn đề. Cố ý để ngoài đợt này: sửa một sổ rồi đối
> chiếu số thật trước, đúng rồi mới nhân ra — không sửa bốn chỗ cùng lúc trên máy chạy thật.

---

## 5. Cách nghiệm thu

1. Mở sổ một khách có phát sinh nhiều năm, **không chọn kỳ** → bảng và "Còn nợ" **y hệt trước khi sửa**.
2. Chọn kỳ từ 01/01 năm nay → hôm nay: `Dư đầu kỳ + Σ Phát sinh − Σ Thanh toán = Dư cuối kỳ`, và
   `Dư cuối kỳ = Còn nợ hiện tại`.
3. Chọn `Đến ngày` lùi về quá khứ → `Dư cuối kỳ ≠ Còn nợ hiện tại`, màn hình hiện **cả hai**.
4. Bấm 🖨️ In → tiêu đề **SỔ TỔNG HỢP CÔNG NỢ KHÁCH HÀNG**, có dòng kỳ, số khớp màn hình.
5. Bấm 👁️ Xem sổ cùng kỳ đó → **Dư đầu kỳ và Dư cuối kỳ khớp nhau giữa hai bản**. Lệch là có lỗi.
6. Dashboard kinh doanh bấm tên khách → vẫn mở bình thường (gọi không kèm kỳ).

---

## 6. Rủi ro

⚠️ **Đụng vào công nợ.** Mọi thay đổi ở đây đều có khả năng ra số khác mà vẫn in ra bình thường.
Bước nghiệm thu 1 (không chọn kỳ ⇒ giống hệt bản cũ) là lưới an toàn chính — chụp màn hình bảng
hiện tại của một khách **trước khi deploy** để đối chiếu.

⚠️ **Đang deploy thẳng lên máy chạy thật** (v8.85 vừa rồi bỏ qua bước D:\QLSX). Đợt này nên chạy thử
trên `D:\QLSX` trước, vì khác v8.85 ở chỗ: lỗi mẫu in thì nhìn là thấy, lỗi công nợ thì không.
