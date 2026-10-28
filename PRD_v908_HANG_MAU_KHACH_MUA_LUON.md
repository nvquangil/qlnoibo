# PRD v9.08 — Hàng mẫu: "khách mua luôn" (chốt bán ở cấp dòng) + nhãn Gửi mẫu ở phiếu nhập lại

**Ngày:** 2026-10-27 · **Nguyen:** *"những mẫu khách mua luôn thì xử lý như thế nào để theo dõi"* → chốt: **đánh dấu "đã chốt bán" ở cấp DÒNG** (theo số lượng). Kèm: *"phiếu nhập lại hiển thị thêm phiếu gửi mẫu ở dưới phiếu xuất"* → chốt: **chỉ gắn nhãn "Gửi mẫu"**.

## 1. Nguyên tắc — không đụng tiền, không đụng tồn

Phiếu "Gửi mẫu" vốn **là** phiếu bán hàng (cờ `LaHangMau`, migration_v693): đã trừ tồn, đã ghi công nợ đủ giá ngay lúc lập. Khách mua luôn ⇒ **không còn gì phải làm về số liệu**. Việc duy nhất còn thiếu: cho dòng **rời sổ** "Hàng mẫu ở khách" — sổ ấy trước đây chỉ biết trừ khi có phiếu nhập lại, nên mẫu khách mua đứt nằm lại vĩnh viễn, "số ngày mượn" tăng mãi, và mất luôn con số đáng giá nhất: **tỷ lệ gửi mẫu chốt được đơn**.

🔴 **Bất biến sống còn:**

```
Còn ở khách = Còn trả được = SoLuongCai − DaTraCai − MauDaChotCai
```

Tính tại **đúng một chỗ**: `backend/utils/dongDaBanChoKhach.js`. Hai màn (Sổ hàng mẫu, Phiếu nhập lại) ăn chung ⇒ hàng khách mua đứt vừa rời sổ, vừa **không trả lại được nữa**. Thiếu vế trừ ở một nơi là mở đường trả lại hàng đã bán đứt ⇒ tồn kho tăng khống mà tiền không đổi.

## 2. Sửa

| File | Gì |
|---|---|
| `database/migration_v884.sql` *(mới)* | 3 cột `PhieuBanHangChiTiet`: `MauDaChotCai INT`, `MauChotNgay DATE`, `MauChotGhiChu NVARCHAR(200)`. Có guard, chạy lại vô hại, **không backfill**. |
| `backend/utils/dongDaBanChoKhach.js` | `coCotMauChot` (dò cột), SELECT 3 cột, **đổi công thức `ConTraCai`** — chỗ duy nhất. |
| `backend/routes/banhang.js` | Route mới `PUT /hangmau/chot/:ctId` (gate `KHOHANG/edit` + chức năng `hangmau`); **guard mới ở `PUT /phieu/:id`**; `GET /phieu/:id` trả `LyDoKhongSua`; Excel hàng mẫu + cột "Khách mua luôn". |
| `backend/routes/nhaplai.js` | `/phieuxuat` trả thêm `LaHangMau`; câu từ chối của `chuanBiPhieu` nói rõ phần đã chốt. |
| `frontend/js/module.khohang.js` | Sổ hàng mẫu: cột "Khách mua luôn" + nút 🛒 + handler; nút Sửa phiếu bán hàng chặn sớm theo `LyDoKhongSua`. |
| `frontend/js/module.nhaplai.js` | Nhãn **Gửi mẫu** dưới số phiếu + `[GỬI MẪU]` trong ô chọn phiếu + cột "Khách mua luôn". |
| `frontend/index.html` | khohang + nhaplai `?v=9.08` |
| `backend/utils/kiem_chot_ban_hang_mau.js` *(mới, không copy sang D:\)* | `vm.Script` parse 5 file + kiểm bất biến tiền. |

**Cách dùng:** Sổ Hàng mẫu → bấm **🛒 Khách mua luôn** ở dòng → nhập số lượng (mặc định = toàn bộ còn lại; gõ **0** để bỏ đánh dấu) → nhập ghi chú. Dòng rời sổ, sang nhóm "khách mua luôn". Tích **"Hiện cả mẫu đã trả xong / đã chốt bán"** để xem lại và sửa.

Nhận **số tuyệt đối**, không cộng dồn ⇒ gõ nhầm sửa lại được; ngày chốt giữ nguyên của lần đầu.

## 3. 🔴 Lỗ TIỀN rà chéo phát hiện — có từ v7.59, nay mới vá

**Sửa phiếu bán hàng = `DELETE` sạch `PhieuBanHangChiTiet` rồi `INSERT` lại ⇒ dòng mang ID MỚI.** Hai thứ bám theo chính cái ID đó, và **không có khóa ngoại nào chặn**:

| Bám vào ID dòng | Hậu quả khi sửa phiếu |
|---|---|
| `PhieuNhapLaiChiTiet.PhieuBHChiTietID` → nguồn của `DaTraCai` | `DaTraCai` về 0 ⇒ **hàng khách ĐÃ TRẢ vẫn trả lại được lần nữa** — lỗ này tồn tại từ **v7.59** |
| `PhieuBanHangChiTiet.MauDaChotCai` (v9.08) | Mất đánh dấu ⇒ hàng khách **đã mua đứt** vẫn trả lại được |

Cả hai làm **tồn kho tăng khống mà tiền không đổi**. Đã vá: `PUT /phieu/:id` chặn khi phiếu còn "đời sau" bám vào, nói rõ phải gỡ cái gì trước; `GET /phieu/:id` trả `LyDoKhongSua` nên nút **Sửa** báo ngay lúc bấm, không để điền xong form mới ăn lỗi.

⚠️ **Phiếu gửi mẫu thường chưa thu tiền** nên guard phiếu thu (v9.04) không đỡ được — đúng loại phiếu mà tính năng này phục vụ. Nếu dữ liệu cũ đã dính (có phiếu từng sửa sau khi khách trả), số `DaTraCai` của phiếu đó đã mất từ lâu; v9.08 chỉ chặn từ nay, **không tự chữa quá khứ**.

### Rà chéo còn bắt 4 lỗi nhỏ, đã sửa
`CAI_DAT_DAY_DU.sql` tôi **sửa tay vào file sinh ra** (đã hoàn nguyên — phải chạy `tao_file_cai_dat.js`); sửa số lượng chốt **xóa trắng ghi chú cũ** (mồi sẵn `data-gc`); ô tìm `#hmMa` giữ chữ mà **không lọc lại** sau khi vẽ lại; 3 phép tự kiểm báo OK oan / vô dụng.

## 4. Deploy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\dongDaBanChoKhach.js
node --check backend\routes\banhang.js
node --check backend\routes\nhaplai.js
node --check frontend\js\module.khohang.js
node --check frontend\js\module.nhaplai.js
node database\tao_file_cai_dat.js
node backend\utils\kiem_chot_ban_hang_mau.js
node backend\utils\kiem_hang_mau_o_khach.js
```

🔴 **`node database\tao_file_cai_dat.js` phải chạy TRƯỚC bộ tự kiểm** — nó gộp v884 (và cả v881–v883 còn nợ) vào `CAI_DAT_DAY_DU.sql`; bộ kiểm có một phép đòi đúng việc đó.

Thứ tự trên máy thật: **① chạy `database\migration_v884.sql` trong SSMS → ② copy file → ③ `pm2 restart qlnoibo` → ④ Ctrl+F5.** Chạy migration sau khi restart thì backend đã dò cột lúc khởi động và nhớ kết quả cũ (`coCotMauChot` memo hoá) ⇒ phải restart lại lần nữa.

**Thử:**
1. Sổ Hàng mẫu → một dòng còn ở khách → **🛒 Khách mua luôn**, nhập **toàn bộ** → dòng biến mất khỏi sổ; tích "Hiện cả…" thấy lại với badge xanh *khách mua luôn*.
2. Vào **Phiếu nhập lại** của khách đó → dòng ấy **không còn trả lại được** (Còn trả được = 0), cột "Khách mua luôn" hiện số xanh.
3. Chốt **một phần** (gửi 5, chốt 2) → sổ còn 3; phiếu nhập lại: Đã bán 5 · Đã trả 0 · **Khách mua luôn 2** · Còn trả được 3 — phép trừ ra đúng.
4. Gõ **0** để bỏ đánh dấu → dòng quay lại sổ, trả lại được như cũ.
5. Thử **Sửa** chính phiếu đó ở danh sách Phiếu bán hàng → báo ngay *"có N đã đánh dấu khách mua luôn… hãy gỡ trước"*, **không mở form**.
6. Phiếu nhập lại: ô chọn phiếu có `[GỬI MẪU]`; tích "Lấy tất cả mã đã mua" → dòng thuộc phiếu mẫu có badge **Gửi mẫu** dưới số phiếu.
7. Tài khoản **không** được giao tab Hàng mẫu → không thấy nút 🛒 (và API trả 403 nếu gọi thẳng).

**Commit:** `"v9.08 hang mau: khach mua luon (chot ban cap dong) + nhan Gui mau o phieu nhap lai + chan sua phieu lam mat lien ket"`

## 5. Nói trước

- **Tỷ lệ chốt mẫu** giờ đã có đủ dữ liệu (gửi N → chốt M → trả K → còn L) nhưng **chưa có báo cáo**. Muốn một màn thống kê theo khách/tháng thì nói — dữ liệu sẵn rồi.
- Thanh tóm tắt và dòng TỔNG của sổ Hàng mẫu **không chạy theo ô tìm** (có từ v9.05 — màn này gọi thẳng `wireTableSearch`, không qua `themOTim` nên cũng không có cảnh báo đỏ). Lọc xong thì TỔNG vẫn là tổng cả sổ.
- Chốt bán **không nguyên tử**: hai người cùng lúc chốt và lập phiếu nhập lại cùng một dòng thì cờ trạng thái có thể sai (tiền/tồn vẫn đúng, `Math.max(0,…)` không cho ra số âm). Xác suất rất thấp, chưa làm khóa.
- Ghi chú chốt dài hơn 200 ký tự bị **cắt im lặng** (cột `NVARCHAR(200)`).
