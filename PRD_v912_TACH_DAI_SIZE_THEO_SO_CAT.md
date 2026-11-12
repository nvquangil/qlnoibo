# PRD v9.12 — Tách dải size đối chiếu với hệ số Ở SỔ CẮT (hết cảnh "tính năng biến mất")

**Ngày:** 2026-10-31 · **Nguyen:** *"lệnh hệ số 10 hoặc 11 tôi muốn tách ra, vd size 2-7 và 8-12, hệ số 6 và 5. Nhớ trước có làm rồi mà giờ không nhìn thấy. Khi tách thì từ công đoạn sau hiển thị bảng số lượng tách. Có tên bàn đánh tay và hệ số."* — và bổ sung: *"ở công đoạn cắt luôn hiện tách dải, để bàn nào cần thì tích vào tách — các trường thông tin ở lệnh SX không gắn liền với công đoạn nào, chỉ để tham khảo."*

## 1. Tính năng KHÔNG biến mất — nó bị khoá bởi một cột không ai khai

**"Tách dải size" (v8.59) vẫn còn nguyên**: bảng `DonHangDaiSize` có `TenDai` gõ tay + `HeSo`; May/QC/Đóng gói/Kho nhập **đã** nở mỗi màu thành N dòng theo dải (đúng ví dụ 10 lớp × 6 = 60, × 5 = 50). Nút ở **đầu form Ghi tiến độ → công đoạn Cắt**, đã chốt với Nguyen từ 01/10.

Vì sao không thấy: v8.59 neo bất biến *tổng dải = `DonHangSanXuat.HeSoQuyDoi`* — cột **mặc định 1**, khai ở Chỉ định, và như Nguyen nói, **chỉ để tham khảo**. Trong khi v8.92 (2 tuần sau) đã chốt hệ số thật nằm ở **sổ cắt** (`TienDoCatChiTietCay.HeSoQuyDoi`). Lệnh cắt 11 mà ô lệnh vẫn 1 ⇒ nút mờ (ngưỡng >6) + gõ 6+5 bị từ chối *"không khớp hệ số của lệnh (1)"*. Hai bản cách nhau 2 tuần, không ai quay lại nối — `nhanHeSo` trong code còn in cảnh báo đỏ về đúng mâu thuẫn này.

## 2. Sửa (Nguyen đã chốt: cả lệnh dùng chung MỘT bộ dải)

1. **Hàm MỘT NƠI `heSoHieuLuc(catMauList, order)`** (backend) + bản sao có chủ đích `heSoHieuLucLenh(detail)` (frontend, dự án không có bundler): mọi màu ở sổ cắt cùng một hệ số > 0 ⇒ lấy hệ số đó (`nguon: 'cat'`); còn lại ⇒ hệ số lệnh, kèm **lý do** nói ra. Lấy `catMauList` qua `getCatMauList` — **không chép lại bộ lọc cây chính** (đã sai 3 lần).
2. **`PUT /orders/:maDH/daisize`** đối chiếu với hệ số hiệu lực; câu từ chối nói rõ đang so với **SỔ CẮT** hay **LỆNH** và vì sao.
3. **Nút LUÔN hiện đậm ở Cắt** — bỏ ngưỡng mờ `NGUONG_TACH_DAI = 6` theo đúng lời Nguyen; thanh dải size ghi rõ *"Hệ số đang dùng để đối chiếu: 11 (theo SỔ CẮT) — lệnh khai 1, lấy theo Cắt"*; modal cũng ghi nguồn.
4. Đổi tên biến vùng này `heSoLenh → heSoDoiChieu` — tên cũ nay nói dối, là mồi cho lần trôi dạt sau.

### Rà chéo bắt, đã sửa trong cùng bản

- **Fail-open ở backend**: `if (hl.heSo <= 0)` và `> 1e-9` đều im lặng cho qua nếu `hl.heSo` là `NaN` — viết lại **chiều thuận** (`Number.isFinite` + `!(… <= 1e-9)`), khoá khi không chắc.
- **Cắt cụt INT im lặng**: `DonHangDaiSize.HeSo` là `INT`, `sql.Int` sẽ `parseInt` — gõ 5.5 lưu thành 5 không báo gì ⇒ chặn 400 "hệ số dải phải là số nguyên" + ghi rõ trên modal.
- **Suýt ReferenceError**: đổi tên biến sót tham chiếu trong template — `node --check` KHÔNG bắt được lỗi này; bộ tự kiểm có phép `không còn \bheSoLenh\b` trong module.qlsx.js.

## 3. File

| File | Gì |
|---|---|
| `backend/routes/qlsx.js` | `heSoHieuLuc()` mới; `PUT /daisize` đối chiếu hệ số hiệu lực, chặn hệ số lẻ, fail-closed |
| `frontend/js/module.qlsx.js` | `heSoHieuLucLenh()`; thanh dải size + modal nói rõ nguồn; nút luôn đậm; so sai số thay `===` |
| `frontend/index.html` | `module.qlsx.js?v=9.12` |
| `backend/utils/kiem_he_so_hieu_luc.js` *(mới, không copy sang D:\)* | trích HAI bản hàm chạy trên cùng 9 bộ dữ liệu, đòi trả giống hệt nhau + phép hành vi ca Nguyen (cắt 11/lệnh 1 → 11, nguồn 'cat') |

**Không migration. Không đổi một con số nào đang chạy** — rà chéo xác nhận v9.12 không ghi dữ liệu, không sửa dòng cũ; tiền/giá thành/quỹ cắt đứng yên.

## 4. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_he_so_hieu_luc.js
```

`0 sai` rồi copy 3 file: `backend\routes\qlsx.js` · `frontend\js\module.qlsx.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5.

**Thử — đúng ca của anh:**

1. Mở lệnh đang cắt hệ số 11 (ô hệ số của lệnh kệ nó) → Ghi tiến độ → **Cắt** → khung "Dải size của lệnh" ghi *Hệ số đang dùng để đối chiếu: **11 (theo SỔ CẮT)***, nút **📏 Tách dải size** đậm.
2. Bấm → nhập `2-7` hệ số **6**, `8-12` hệ số **5** → tổng 11/11 ✓ → Lưu được.
3. Sang **May / QC / Đóng gói / Kho nhập**: mỗi màu nở thành 2 dòng `· 2-7` và `· 8-12`; cây 10 lớp → đối chiếu 60 và 50.
4. Gõ thử hệ số `5.5` → bị chặn "phải là số nguyên".
5. Lệnh chưa cắt gì → thanh ghi *(theo lệnh — Cắt chưa ghi sổ nào)*: hành vi cũ giữ nguyên.

## 5. Nói trước

- **Giới hạn có chủ đích:** lệnh mà các màu cắt **hệ số khác nhau** (vd thân 11, phối 6 đã bị loại sẵn; nhưng hai màu CHÍNH 11 và 6) thì không có "một hệ số của lệnh" ⇒ lùi về hệ số lệnh + nói lý do. Tách dải theo TỪNG BÀN riêng (bàn A 6+5, bàn B không tách) là bài khác — anh đã chốt chưa cần; nếu sau này cần thì phải gắn `DaiSizeID` vào bản ghi cắt, đụng 4 bảng + mọi chỗ đọc hệ số.
- Bảng dải **cũ** đã lưu theo hệ số lệnh mà lệch với sổ cắt: giờ muốn **sửa** bảng đó thì phải chia lại cho khớp hệ số sổ cắt (câu từ chối nói rõ số nào). Số liệu đã ghi không đổi.
- `GET /daisize` vẫn trả trường `heSoLenh` (không ai dùng) — hợp đồng cũ, để nguyên, đừng tưởng nó là thứ PUT đối chiếu.
- Ảnh hưởng tiền: **không** — dải chỉ đổi cách NHẬP/ĐỐI CHIẾU từ nay về sau; lương in thêu đã tra đơn giá theo dải từ v8.60. Hai việc v8.59 còn dở (in thêu theo dải 5c, đơn giá may theo dải 5d) vẫn dở — nói nếu muốn làm nốt.

**Commit:** `"v9.12 tach dai size: doi chieu he so SO CAT thay vi he so lenh (mac dinh 1) + nut luon hien o Cat + chan he so le"`
