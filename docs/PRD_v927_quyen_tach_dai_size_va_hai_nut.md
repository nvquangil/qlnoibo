# PRD v9.27 — Tổ cắt không thấy nút Tách dải size / mẫu + tách bạch "dải size" và "mẫu"

**Ngày:** 2026-11-06 · **Báo lỗi:** Nguyen · **Trạng thái:** đã sửa, CHƯA deploy
Không migration. `frontend/js/module.qlsx.js` + bump `?v=9.27`. Đi chung đợt v9.23→v9.26.

---

## 1. Triệu chứng

Nguyên văn: *"đang bị lẫn lộn ở chỗ tách size và mẫu. hiện tại tôi kiểm tra lại nhân viên tổ cắt
đang không thấy chức năng tách dải size, mẫu mà chỉ có user admin thấy"*.

Hai việc riêng biệt, sửa cả hai.

## 2. 🔴 Lỗi A — màn hình khóa CHẶT HƠN máy chủ

`renderDaiSizeBar` hiện nút bằng `perm && perm.canEdit`. Nhưng `perm` truyền vào
`openProgressForm` là quyền **theo TAB đang mở**:

```js
const perm = effectivePerm(user, 'QLSX', activeTab, rawPerm);   // activeTab = 'danhsach', 'tiendo', …
```

Tổ cắt mở Ghi tiến độ từ tab danh sách ⇒ `canEdit = false` ⇒ **nút bị ẩn**.

Trong khi backend cho phép:

```js
router.put('/orders/:maDH/daisize', requireAuth, requirePermission('QLSX','edit'), requireChucNang('QLSX','tiendo'), …)
```

— **đúng bằng** gác của `POST /orders/:maDH/tiendo`. Tức **ai ghi được sổ cắt thì tách được dải**.
Máy chủ cho, màn hình chặn. Người đủ quyền không làm được việc mà **không ai báo gì** — kiểu lỗi tệ
nhất vì nó trông y như "tính năng không tồn tại".

**Sửa:** gác bằng `coQuyenSuaTienDo()` — bản sao chính xác của cặp gác backend
(`effectivePerm(user,'QLSX','tiendo',…).canEdit`).

**Cùng lỗi, cùng chỗ:** nút **"✏️ Sửa / thêm cây"** và **"🗑️ Xóa sổ này"** trong khối *Sổ cắt đã ghi
nhận* cũng đang gác bằng `perm` của tab, trong khi backend `PUT/DELETE /socat/:tienDoId` gác đúng cặp
tiến độ. Tổ cắt ghi được sổ cắt thì phải sửa được sổ cắt — đã đổi sang
`coQuyenSuaTienDo()` / `coQuyenXoaTienDo()`.

Người **thật sự** không có quyền: khung **vẫn hiện** (xem được lệnh đã tách gì), kèm câu
*"Bạn không có quyền ghi tiến độ nên chỉ xem được, không tách/sửa được."* — theo đúng luật đã chốt
ở v9.04: **nút khóa kèm lý do, không ẩn câm**.

## 3. Lỗi B — "lẫn lộn giữa tách size và tách mẫu"

Trước: **một** nút `📏 Tách dải size / mẫu`, bấm vào mới phải chọn kiểu trong hộp thoại — bắt người
dùng quyết định trước khi nhìn thấy sự khác nhau.

Nay, khi lệnh **chưa tách**, thanh hiện **hai nút riêng** kèm một dòng giải thích ngay dưới:

- **📏 Tách dải size** — chia MỘT lớp cắt thành nhiều dải, hệ số **CỘNG** lại bằng hệ số Cắt
  (2-7 có 6 + 8-12 có 5 = 11).
- **🧩 Tách mẫu** — nhiều biến thể dùng **CHUNG** một dải size (in chó / in thỏ), **mỗi mẫu mang ĐỦ
  hệ số**, vải cắt chung một bàn.

Bấm nút nào vào thẳng kiểu đó; tiêu đề hộp thoại ghi rõ **"Tách MẪU — DH…"** hay **"Tách DẢI SIZE —
DH…"**. Kiểu MẪU còn **điền sẵn hệ số** (chỉ có một giá trị hợp lệ).

Lệnh **đã tách rồi** thì chỉ còn một nút *Sửa dải size* / *Sửa mẫu* đúng kiểu đang có — **đổi kiểu
phải là hành động cố ý trong hộp thoại** (vẫn có hỏi lại từ v9.23), không phải hệ quả của việc bấm
nhầm nút ở ngoài.

## 4. File đã sửa

| File | Việc |
|---|---|
| `frontend/js/module.qlsx.js` | gác quyền theo `coQuyenSuaTienDo()`/`coQuyenXoaTienDo()` (3 nút); hai nút tách riêng + dòng giải thích; tham số `kieuMoSan`; tiêu đề hộp thoại theo kiểu; điền sẵn hệ số khi mở thẳng kiểu MẪU |
| `frontend/index.html` | bump `?v=9.27` |
| `backend/utils/kiem_he_so_hieu_luc.js` | thêm mục 6b — ghim **gác màn hình phải khớp gác máy chủ**, và hai nút tách riêng |

## 5. Kiểm

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_he_so_hieu_luc.js
node backend\utils\kiem_tach_mau_cung_dai.js
```

## 6. Nghiệm thu — phải thử bằng TÀI KHOẢN TỔ CẮT, không phải admin

1. Đăng nhập **tài khoản tổ cắt** → mở Ghi tiến độ một lệnh → **thấy hai nút** 📏 và 🧩, cùng dòng
   giải thích.
2. Tổ cắt bấm 🧩 → hộp thoại tiêu đề **"Tách MẪU"**, hệ số điền sẵn → lưu được (không bị 403).
3. Tổ cắt thấy **"✏️ Sửa / thêm cây"** ở khối *Sổ cắt đã ghi nhận*.
4. Một tài khoản **không có** chức năng Ghi tiến độ → vẫn thấy khung, **không** thấy nút, có câu giải
   thích lý do.
5. Lệnh **đã tách mẫu** → chỉ còn nút *🧩 Sửa mẫu*; vào trong đổi sang Dải size thì **phải hỏi lại**.

## 7. Chưa làm — cần Nguyen xác nhận

Ảnh thứ hai anh gửi (bảng `TenMau / MauSacID / Tu_Phoi / Tu_Chinh / Khong_Ro / Tong_He_Thong_Dang_Tinh`)
tôi **chưa đụng tới** — chưa rõ anh muốn hỏi gì ở đó. Nếu là nghi ngờ số liệu màu/phôi thì gửi lại
câu hỏi cụ thể, tôi tra.
