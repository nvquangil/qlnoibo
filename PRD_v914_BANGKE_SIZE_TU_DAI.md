# PRD v9.14 — Bảng kê BTP: cột size lấy từ DẢI SIZE khi lệnh không có Thông số đo

**Ngày:** 2026-11-03 · **Nguyen:** *"một số lệnh khi tải từ sổ cắt về lại ra size mặc định là S,M,L — mà lệnh đó công đoạn cắt là 2-7."*

## 1. Vì sao ra S,M,L

Cột size của Bảng kê BTP lấy từ **Thông số đo** của lệnh (`GET /api/bangke/:maDH` → `sizeCols`). Lệnh nào **không khai Thông số đo** thì form rơi về mặc định cứng `['S','M','L']` (`module.bangkebtp.js:114`, có từ v5.44.5). "Tải từ sổ cắt" (nút *↧ Điền màu từ Cắt*) chỉ điền **dòng màu**, không đụng cột — nên cột vẫn là S/M/L và phải gõ lại 2,3,4,5,6,7 bằng tay.

## 2. Sửa — nguồn size thứ hai: DẢI SIZE của lệnh

Thứ tự nguồn cột khi mở bảng kê **mới**: ① Thông số đo (như cũ, vẫn thắng) → ② **dải size** của lệnh — tên dải `"2-7"` **nở** thành cột `2,3,4,5,6,7`; nhiều dải nối theo thứ tự (`"2-7"+"8-12"` → 2..12) → ③ S,M,L như cũ.

Chỉ nở khi **mọi** dải có dạng `số-số` tăng dần (tối đa 30 bước) — dải đặt tên chữ thì giữ nguyên fallback, thà như cũ còn hơn bịa cột sai. Nút *↧ Cột size từ …* và toast nói đúng nguồn: **"Dải size (công đoạn Cắt)"** hay "Thông số đo".

| File | Gì |
|---|---|
| `backend/routes/bangke.js` | `noDaiThanhSize()` + nhánh đọc `DonHangDaiSize` (try/catch, máy chưa chạy v859 không chết màn); trả thêm `sizeColsNguon` |
| `frontend/js/module.bangkebtp.js` | nhãn nút + toast theo nguồn |
| `frontend/index.html` | `module.bangkebtp.js?v=9.14` |
| `backend/utils/kiem_bangke_size_tu_dai.js` *(mới, không copy)* | vm.Script + **9 ca hành vi** chạy thật trên `noDaiThanhSize` + phép nối dây |

**Không migration. Không đổi dữ liệu** — bảng kê đã lưu giữ nguyên cột của nó.

## 3. ⚠️ Điều kiện để chạy — ăn theo v9.13

Nguồn ② chỉ có khi lệnh **đã tách dải size**. Mà nút tách dải bị ẩn từ v8.79 (lỗi async, v9.13 vá) — nên các lệnh "2-7" hiện tại **chưa chắc có dòng dải nào trong DB**. Trình tự đúng: **deploy v9.13 + v9.14 cùng đợt** → vào Cắt tách dải `2-7` (và `8-12` nếu có) cho lệnh đó → mở Bảng kê BTP → cột tự ra 2..7.

Nếu các lệnh đó "2-7" chỉ nằm ở **tên rập / ghi chú sơ đồ** chứ anh không định tách dải, nói tôi — lấy từ nguồn đó là bài khác.

## 4. Deploy (gộp với v9.13 — index.html mang cả hai bump)

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\routes\qlsx.js
node --check backend\routes\bangke.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\module.bangkebtp.js
node backend\utils\kiem_he_so_hieu_luc.js
node backend\utils\kiem_bangke_size_tu_dai.js
```

Cả hai bộ kiểm `0 sai` → copy **5 file**: `backend\routes\qlsx.js` · `backend\routes\bangke.js` · `frontend\js\module.qlsx.js` · `frontend\js\module.bangkebtp.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5 (sidebar hiện v9.14).

**Thử:**
1. Ghi tiến độ → Cắt: khung Dải size **đứng yên** (v9.13) → tách `2-7` hệ số 6, `8-12` hệ số 5.
2. Bảng kê BTP → *+ Thêm bảng kê* ở lệnh đó → cột tự ra **2..12**, nút ghi *↧ Cột size từ Dải size (công đoạn Cắt)* → *↧ Điền màu từ Cắt* → dòng màu + số lớp điền sẵn.
3. Lệnh có Thông số đo → cột vẫn theo Thông số đo (không bị dải đè).
4. Lệnh không dải, không TSD → S,M,L như cũ.
5. Giao in thêu → Kho nhập: mỗi màu 2 dòng theo dải (v9.13).

**Bản bảng kê đã LỠ lưu với S,M,L:** không tự đổi (không tự chữa quá khứ). Mở bản → bấm *↧ Cột size từ Dải size* → **giá trị cũ dồn theo vị trí** (ô của S thành ô của '2'…) → bấm lại *↧ Điền màu từ Cắt* để điền lại cho đủ cột → Lưu.

**Commit:** `"v9.14 bang ke BTP: cot size lay tu dai size cua lenh khi khong co Thong so do (2-7 -> 2..7)"`

## 4c. Nguồn thứ BA — ô Size của lệnh (ảnh sổ cắt DH2610119, 2026-11-03)

Lệnh SX có **ô Size** khai ở Ra lệnh SX (`DonHangSanXuat.Size`, vd `"2-7"`) — sổ cắt hiển thị lại ở dòng "Size". Lệnh đã điền ô này thì bảng kê **tự** ra cột 2…7, **không cần thao tác gì** (không cần TSD, không cần tách dải). Giá trị không nở được (`"9M - 4Y"`, chữ, trống) ⇒ đường cũ.

**Thứ tự nguồn chốt:** ① Thông số kỹ thuật → ② Dải size (Cắt) → ③ **ô Size của lệnh** → ④ S,M,L. Dải đứng trên ô Size vì dải là khai báo có chủ đích kèm hệ số; ô Size là chữ tham khảo.

## 4b. Bổ sung theo yêu cầu *"xử lý 100% các lệnh lấy từ thông số kỹ thuật"* (2026-11-03, ảnh DH2610138)

Thông số đo nay có **nhiều bản** theo `TenPhieu` (bản "THÔNG SỐ KỸ THUẬT"). Truy vấn cột size của Bảng kê vốn đã quét **mọi bản** của lệnh — với lệnh như DH2610138 nó phải ra `SIZE 2…SIZE 7`. Hai lỗ đã bịt:

1. **Khử trùng lặp**: lệnh có 2 bản TSD cùng khai size ⇒ cột ra `SIZE 2, 3, …, SIZE 2, 3, …` — nay dedupe giữ thứ tự.
2. **Bản bảng kê ĐÃ LƯU lệch nguồn thì im lặng** — đây nhiều khả năng là chính ca "ra S,M,L": bảng kê được tạo/lưu **trước khi** lệnh khai Thông số kỹ thuật, cột S/M/L đã đóng băng theo bản lưu (`data.cols` thắng — đúng chủ trương không tự chữa quá khứ), và không gì nói cho người dùng biết. Nay mở bản lệch là có **banner vàng**: *"Cột size của bản này (S, M, L) đang KHÁC Thông số đo hiện tại (SIZE 2…SIZE 7) — bấm ↧ Cột size từ Thông số đo để đồng bộ…"*.

**Nếu sau deploy, mở bảng kê MỚI của lệnh có TSD mà vẫn ra S,M,L** thì đó là chuyện dữ liệu — chạy probe này gửi tôi (thay mã lệnh):

```sql
DECLARE @ma NVARCHAR(50) = N'DH2610138';
SELECT t.ID AS TaiLieuID, ISNULL(t.TenPhieu,'') AS Ban, ISNULL(t.LaMau,0) AS LaMau,
       (SELECT COUNT(*) FROM TaiLieuThongSoDoCot c WHERE c.TaiLieuID=t.ID) AS SoCot,
       STUFF((SELECT ' | ' + c.TenCot FROM TaiLieuThongSoDoCot c
              WHERE c.TaiLieuID=t.ID ORDER BY c.ThuTu FOR XML PATH('')),1,3,'') AS CacCot
FROM TaiLieuThongSoDo t
WHERE t.DonHangID = (SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@ma);

SELECT ISNULL(TenPhieu,'') AS BanBangKe, ColsJson
FROM BangKeBanThanhPham
WHERE DonHangID = (SELECT DonHangID FROM DonHangSanXuat WHERE MaDH=@ma);
```

Bảng 1 trả `SoCot=6, CacCot=SIZE 2 | … | SIZE 7` mà bảng kê mới vẫn S,M,L ⇒ lỗi code, tôi sai ở đâu đó. Bảng 1 **rỗng** ⇒ lệnh chưa khai TSD ⇒ nguồn dải (mục 2) hoặc khai TSD. Bảng 2 có `ColsJson=["S","M","L"]` ⇒ đúng ca "bản lưu đóng băng" — banner mới sẽ chỉ đường.

## 5. Nói trước

- Lệnh hai dải trùng mép (`"2-7"` + `"7-12"`) → cột 7 chỉ một lần (dedupe).
- `module.tailieukythuat.js` có byte NUL từ trước ⇒ **grep coi nó là file nhị phân và bỏ qua im lặng** — rà file đó phải Read trực tiếp (ghi lại để lần sau đỡ tưởng "không có kết quả = không dùng").
