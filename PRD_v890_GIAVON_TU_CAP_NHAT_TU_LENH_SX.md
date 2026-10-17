# PRD v8.90 — Giá vốn hàng tự sản xuất tự cập nhật từ lệnh SX

Trạng thái: **ĐÃ VIẾT CODE** — chưa chạy thử.
Ngày: 2026-10-12

---

## 1. Yêu cầu

Nguyen: *"Báo cáo kinh doanh / Giá vốn hàng hóa: khi có giá thành sản phẩm từ Quản lý sản xuất sẽ tự
cập nhật vào, không cần phải chạy 'lấy giá thành từ lệnh SX'."*

Làm rõ: *"Ở Quản lý sản xuất có tính giá thành sản phẩm. Khi bên đó tính xong, thẻ kho hàng hóa có
phiếu nhập kho là lấy giá từ đó vào."*

Luật ghi đè đã chốt: **"Cập nhật, nhưng chỉ khi cùng lệnh SX đó."**

---

## 2. Thiết kế

Điểm kích hoạt là **phiếu nhập kho hàng hóa loại "Từ sản xuất"** — lưu, sửa, hủy, xóa. Đó cũng là
thời điểm tự nhiên nhất: `tinhGiaThanh()` lấy **mẫu số** (SL hoàn thành) từ chính bảng
`PhieuNhapKhoHangChiTiet`, nên phiếu vừa lưu chính là lúc `giaThanh1SP` lần đầu có giá trị hoặc vừa đổi.

Hướng này đã có sẵn khuôn: `utils/giaNhapHangHoa.js` làm đúng việc đó cho hàng **mua từ NCC** từ
v8.07, gọi tại 4 chỗ trong `nhapkho.js`. Nhánh hàng tự sản xuất khi đó bị cố ý bỏ qua. v8.90 thêm
nhánh đó bằng một util song song (`utils/giaVonLenhSX.js`) — **không dùng chung hàm**, vì nguồn giá
khác hẳn nhau: NCC là bình quân gia quyền giá mua, tự SX là `giaThanh1SP` tính từ toàn bộ chi phí lệnh.

### Luật ghi đè

| Giá vốn đang có | Ghi? | Vì sao |
|---|---|---|
| chưa có dòng nào | GHI | điền lần đầu |
| `Khai tay` | KHÔNG | người dùng cố ý khai đè |
| `Lệnh SX`, `MaDHNguon` NULL | GHI | không biết thuộc lệnh nào ⇒ coi như chưa rõ |
| `Lệnh SX`, **cùng** `MaDH` | GHI | nhập bổ sung đợt sau của chính lệnh này |
| `Lệnh SX`, **khác** `MaDH` | KHÔNG | giá vốn đang thuộc về một lệnh khác |
| `Phiếu nhập NCC` | GHI | mã này đã chuyển sang tự sản xuất |

---

## 3. 🔴 Ba lỗi rà chéo bắt được — đều là lỗi tiền, đã sửa

### (1) Bản đầu chỉ nạp cho mã **trên phiếu vừa lưu**

`giaThanh1SP` = tổng chi phí ÷ SL nhập kho của **cả lệnh**. Nạp chỉ cho mã trên phiếu thì:

> Lệnh 1.000 cái. Đợt 1 phiếu NK01 nhập **mã A** 50 cái → A = tổng CP ÷ 50, **gấp 20 lần giá đúng**.
> Đợt 2 phiếu NK02 nhập **mã B** 950 cái → mẫu số thành 1.000, B được ghi đúng,
> còn **A giữ giá gấp 20 lần vĩnh viễn** vì A không có trên NK02.

Lệnh nhiều size/màu nhập cuốn chiếu là dính chắc chắn, và **không bao giờ tự sửa**. Tôi đã viết trong
ghi chú bản đầu rằng "giá tự hội tụ khi nhập xong" — điều đó chỉ đúng nếu đợt sau tình cờ chứa đủ mọi
mã của đợt trước.

**Sửa:** nạp cho **mọi mã của cả lệnh**, lấy theo đúng hai đường mà nút nạp tay đang dùng
(`TheKhoHangHoa.DonHangID` + `PhieuNhapKhoHangChiTiet`). Vẫn chỉ gọi `tinhGiaThanh()` **một lần**.

### (2) Hủy/xóa phiếu làm giá vốn **tụt**, lãi gộp phình

Tôi tưởng hủy phiếu cuối cùng của lệnh sẽ làm `giaThanh1SP` thành `null` nên hàm tự bỏ qua. Sai —
`tinhGiaThanh()` có hai đường lùi: `slNhapKho = 0` ⇒ lùi về lũy kế công đoạn KN, rồi **SL cắt**. SL
cắt thường **lớn hơn** SL nhập kho thật ⇒ giá vốn giảm, lãi gộp phình lên. Một thao tác hủy nhầm để
lại giá vốn sai thấp cho tới lần nhập kế tiếp.

**Sửa:** chỉ ghi khi `gt.donViSLDungTinh === 'Cái'` — cờ này được `tinhGiaThanh()` gán **chỉ khi**
mẫu số đến từ phiếu nhập kho. Lệnh mới có SL cắt thì không đụng vào giá vốn.

### (3) Bị luật chặn thì **im lặng**

Mã đang mang giá vốn của **lệnh khác** — đúng tình huống luật cố tình chặn — người dùng lưu phiếu,
thấy "Đã lưu phiếu NK..." và tin rằng giá vốn đã đúng.

**Sửa:** hàm trả về `chiTietBoQua` kèm lý do từng mã; cả 4 đường dùng chung `loiNhanGiaVon()` để
không đường nào quên hiển thị.

### Kèm theo: đường NCC vẫn đè lên giá thành sản xuất

`giaNhapHangHoa.js` chỉ chặn `Khai tay`. Từ v8.90 **cả hai đường đều tự động**, nên một mã vừa mua
vừa tự sản xuất sẽ có giá vốn nhảy qua nhảy lại giữa hai nguồn tùy thứ tự thao tác — mỗi lần nhảy là
đổi lãi gộp của các kỳ đã chốt. Đã thêm: đường NCC **không đè** lên `NguonGia='Lệnh SX'`.

---

## 4. Phạm vi

**Trong**: `utils/giaVonLenhSX.js` (mới) · `utils/giaNhapHangHoa.js` (chặn đè Lệnh SX) ·
`routes/nhapkho.js` (4 đường) · `module.baocao.js` (nhãn nút + giải thích) ·
`utils/kiem_gia_von_tu_lenh_sx.js` (mới) · bump `?v=`.

**Ngoài**: ❌ migration (bảng `GiaVonHangHoa` đã có từ v6.72) · ❌ đổi công thức `tinhGiaThanh()` ·
❌ lịch sử giá vốn theo kỳ · ❌ bỏ nút nạp tay (vẫn cần cho dữ liệu cũ và nạp lại hàng loạt).

---

## 5. Cách nghiệm thu

1. Lệnh SX có phiếu nhập kho, mã **chưa có giá vốn** → lưu phiếu → giá vốn tự điền, `Nguồn` = `Lệnh SX`,
   số khớp với "Giá thành 1 sản phẩm" ở màn QLSX.
2. **Nhập hai đợt**: đợt 1 nhập mã A, đợt 2 nhập mã B (cùng lệnh) → sau đợt 2, **cả A và B** đều mang
   giá mới. Đây là phép thử của lỗi (1).
3. Mã đang mang giá vốn của **lệnh khác** → lưu phiếu → giá **không đổi**, và màn hình báo rõ
   "KHÔNG cập nhật được N mã: ... giá vốn đang thuộc lệnh ...". Phép thử của lỗi (3).
4. Mã **khai tay** → lưu phiếu → giá không đổi, có báo lý do.
5. Lệnh **chưa có phiếu nhập kho nào** (mới có SL cắt) → không ghi gì, báo "chưa có số lượng nhập kho
   thực tế". Phép thử của lỗi (2).
6. **Hủy** phiếu duy nhất của lệnh → giá vốn **giữ nguyên**, không tụt xuống.
7. Phiếu loại "Từ sản xuất" mà **không chọn lệnh SX** → lưu được, nhưng báo cảnh báo rõ.
8. Hàng mua NCC → lưu phiếu NCC → vẫn tự cập nhật như trước (không hỏng đường cũ).

---

## 6. Rủi ro còn lại

⚠️ **Bảng `GiaVonHangHoa` chỉ giữ MỘT giá mỗi mã**, không có lịch sử theo kỳ, mà báo cáo lãi/lỗ join
thẳng bảng này. Nên mỗi lần giá vốn cập nhật là **lãi gộp của mọi kỳ đã chốt đổi theo**. Trước v8.90
việc này chỉ xảy ra khi có người bấm nút; từ v8.90 nó xảy ra mỗi lần lưu phiếu nhập kho. Đã ghi cảnh
báo ngay trên màn Giá vốn hàng hóa. Muốn triệt để thì phải thêm lịch sử giá vốn theo kỳ — việc riêng,
không gộp vào đây.

⚠️ **Mỗi lần lưu phiếu nhập kho từ sản xuất nay chạy thêm ~20 truy vấn** (`tinhGiaThanh()` đọc toàn
bộ chi phí lệnh). Ước tính thêm 0,3–1 giây tùy kích thước lệnh. Chấp nhận được, nhưng nếu thấy lưu
phiếu chậm rõ rệt thì báo — có thể cache hoặc chuyển sang chạy nền.
