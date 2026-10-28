# PRD v9.06 — Phiếu nhập lại: bấm Lưu không hoạt động khi trả ít hơn

**Ngày:** 2026-10-27 · **Nguyen:** *"khi làm phiếu nhập trả lại ấn Lưu phiếu trả lại không hoạt động. khi nhập lại đủ sl theo phiếu bán hàng thì lưu được, nhưng số lượng ít hơn không hoạt động. nếu nhập số lượng nhiều hơn phiếu xuất hiện cảnh báo"* (NL26039, NPP Hà Tây — C Hương Chương Mỹ).

## 1. Chẩn đoán

**Backend không có lỗi.** `POST /api/nhaplai/phieu` → `chuanBiPhieu()` từ chối với câu RẤT rõ cho từng trường hợp: vượt số còn trả được, mã quản kho theo Ri chỉ nhập lại được bội số Ri, các dòng thuộc phiếu khác %CK NPP/%VAT, dòng không thuộc khách. Tất cả trả 400 + message.

**Lỗi ở frontend — thông báo không bao giờ tới mắt người dùng:**

`apiFetch` (common.js, v7.27) **THROW** khi máy chủ trả 400. Mà `module.nhaplai.js` có 4 chỗ gọi API **không try/catch**:

| Chỗ | Hậu quả khi backend từ chối |
|---|---|
| `nlfLuu.onclick` | Promise chết im lặng ⇒ **không toast**. Tệ hơn: `disabled = false` nằm SAU `await` nên không bao giờ chạy ⇒ **nút Lưu bị khóa vĩnh viễn** — từ đó bấm bao nhiêu lần cũng "không hoạt động" theo đúng nghĩa đen |
| `tinhTong` → `/tinhthu` | Ô tổng tiền **đứng im ở số cũ** (ảnh chụp: 8.937.800 đ là tổng của lần tick trước, không khớp 3 dòng đang chọn) ⇒ người dùng tưởng số vừa gõ hợp lệ |
| `taiDong` | Bảng treo "Đang tải..." mãi |
| `nlfKhach.onchange` | Ô chọn phiếu trống không lý do |

Hai nhánh `if (!kq.success)` cũ là **mã chết** — `apiPost` không bao giờ trả về khi `success=false`, nó ném trước.

**Vì sao "đủ SL thì lưu được, ít hơn thì không"?** Quy tắc duy nhất trong `chuanBiPhieu` phụ thuộc số lượng (ngoài chặn vượt) là **bội số Ri** (`nhaplai.js:354`): mã quản kho theo Ri chỉ nhập lại được bội của hệ số. Ảnh chụp đúng ca này: dòng 47 **BCV25HD973 Ri5** nhập **14** cái — 14 không chia hết 5 ⇒ backend từ chối, frontend nuốt. Trả "đủ SL" với hàng bán nguyên Ri thì số còn lại là bội Ri ⇒ qua. Sau deploy, câu từ chối sẽ hiện **ngay dưới bảng khi đang gõ** — anh xác nhận giả thuyết này bằng chính thông báo đó.

## 2. Sửa (1 file + bump)

`frontend/js/module.nhaplai.js`:
- `nlfLuu.onclick`: bọc `try/catch/finally` — catch toast **nguyên văn câu backend** (8 giây cho đủ đọc); nút được **bắt vào biến một lần trước `try`** và mở lại trong `finally` (lỗi hay thành công đều mở); `disabled = true` vẫn đứng trước `try` để chặn bấm đúp; `xemPhieu` sau lưu có `.catch` riêng — lỗi mở bản xem không được đội lốt lỗi LƯU.
- `tinhTong`: catch ⇒ vẽ câu từ chối màu đỏ vào chỗ tổng tiền — thấy **ngay khi gõ**, trước cả khi bấm Lưu; chốt null `#nlfTong` (hẹn 250ms có thể nổ sau khi modal đã đóng).
- `taiBang` **tự đỡ lỗi bên trong** ⇒ nút Lọc, và mọi lần vẽ lại sau lưu/hủy/xóa, không còn treo "Đang tải..." vĩnh viễn.
- `taiDong`, `nlfKhach.onchange` (ghi "-- Lỗi tải danh sách phiếu xuất --" vào chính ô chọn), nút **Hủy/Xóa phiếu**, nút **Xem**, `openForm()` ở nơi gọi, `taiFile` (Excel): tất cả bọc bắt lỗi — cùng một lớp lỗi, quét sạch một lần.
- Xóa 3 nhánh `if (!kq.success)` / `kq.success ?` chết.
- **Nói trước luật Ri ngay trên ô nhập**: hàng quản kho theo Ri có `step = hệ số` + dòng chữ nhỏ "bội số N" dưới ô (dữ liệu `LoaiRi` có sẵn từ `layDongDaBan`). Backend vẫn là người chặn cuối.

`frontend/index.html`: `module.nhaplai.js?v=9.06`.

**Không đổi luật nghiệp vụ** — vẫn chặn đúng như backend đang chặn, chỉ NÓI RA lý do.

## 2b. Rà chéo bắt được gì trong bản vá đầu

| Mức | Lỗi | Sửa |
|---|---|---|
| 🔴 | Bản vá đầu để `$('nlfLuu').disabled = false` trong `finally` — nhưng lưu **thành công** thì `closeModal()` đã GỠ modal khỏi DOM ⇒ `$('nlfLuu')` = null ⇒ **TypeError ở mọi lần lưu thành công** (lỗi do chính bản vá sinh ra) | Bắt phần tử vào biến trước `try` |
| 🟡 | Hẹn 250ms của `tinhTong` nổ sau khi modal đóng ⇒ `null.innerHTML` | Chốt null `oTong` |
| 🟡 | `taiBang()` trong try của Hủy/Xóa nhưng không `await` ⇒ lỗi vỡ ngoài catch, bảng treo "Đang tải..." | `taiBang` tự đỡ lỗi bên trong |
| 🟡 | Bộ tự kiểm toàn so chuỗi — file vỡ cú pháp vẫn "0 sai" | Thêm phép **`vm.Script` biên dịch file** (parse không chạy) ngay đầu bộ kiểm — từ nay là lưới thay `node --check` ngay trong script |
| 🟡 | Cửa sổ quét `+4000` ký tự là số thần | Neo mút cuối vào hàm kế tiếp |

## 2c. Vì sao "đủ SL thì lưu được, ít hơn thì không" — ĐÃ LOẠI giả thuyết bội-Ri

Giả thuyết đầu (bội số Ri) **SAI** — Nguyen xác nhận 2026-10-27: bán lẻ vẫn bán được, và tồn đang hiện "**61 Ri5 dư 4, 309 Bộ**" ⇒ các mã này quản kho theo **Bộ** (309, số nguyên), "Ri5 dư 4" chỉ là hiển thị quy đổi (`quyDoiHienThi` của common.js). `donViChinhLaGop = false` ⇒ luật bội-Ri không chạm, trả lẻ vốn đã được phép, **không cần đổi gì về tồn**.

Nghi phạm còn lại theo ảnh chụp: **14 mã đang chọn ở chế độ "mọi phiếu"** trải trên PX26454 + PX26445 — nếu hai phiếu khác %CK NPP/%VAT thì `chuanBiPhieu` chặn *"lập riêng mỗi phiếu xuất một phiếu nhập lại"*. Khớp "trả đủ thì được" nếu lần đó chỉ tick trong một phiếu. **Cách xác nhận: deploy v9.06, gõ lại 5/5/14 — dòng đỏ hiện nguyên văn câu từ chối ngay dưới bảng.** Nếu đúng câu %CK: lập riêng từng phiếu (chạy ngay), hoặc làm tính năng "một lần Lưu tự tách N phiếu theo nhóm %CK/VAT" — việc riêng, chưa làm.

## 3. Deploy

Vào hàng đợi gộp chung (giờ là **v9.02 → v9.06**; `module.nhaplai.js` và `index.html` đều đã nằm trong danh sách copy của v9.05, bản này chỉ thay nội dung mới hơn).

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check frontend\js\module.nhaplai.js
node backend\utils\kiem_nhaplai_bat_loi.js
```

**Thử sau deploy (đúng kịch bản anh gặp):**
1. Mở lại phiếu NL26039: tick BCV25HD973 rồi sửa SL thành **14** → ngay dưới bảng phải hiện dòng đỏ (nếu đúng giả thuyết Ri: *"Mã BCV25HD973 quản kho theo Ri (1 Ri = 5 Cái) nên chỉ nhập lại được bội số của 5 Cái — bạn đang nhập lại 14 Cái."*).
2. Bấm **Lưu** → toast đỏ hiện đúng câu đó, và nút Lưu **vẫn bấm lại được** (không bị khóa chết như trước).
3. Sửa 14 → 15 (bội 5) → dòng đỏ biến mất, tổng tiền tính lại → Lưu thành công.
4. Nhập quá số còn trả → dòng đỏ "chỉ còn trả được N Cái".

**Commit:** `"v9.06 nhap lai: nut Luu cam khi backend tu choi — bat loi + mo lai nut + hien ly do ngay khi go"`

## 4. Nói trước — quyết định nghiệp vụ còn treo

Nếu đúng là luật **bội số Ri** chặn: khách trả lẻ 14 cái hàng Ri5 là chuyện có thật ngoài đời. Luật chặn là **có chủ đích** (hoàn tồn theo Ri, nhập lẻ sẽ làm tròn sai âm thầm — ghi chú ngay trong code từ trước). Muốn cho trả lẻ thì phải đổi cách hoàn tồn (tồn Ri bị lẻ) — đó là thay đổi nghiệp vụ riêng, nói thì tôi làm, không tự ý nới. Giải pháp tạm thời đúng quy trình: trả 10 (2 Ri) hoặc 15 (3 Ri), 4 cái lẻ còn lại xử lý ở lần trả sau khi gom đủ Ri.
