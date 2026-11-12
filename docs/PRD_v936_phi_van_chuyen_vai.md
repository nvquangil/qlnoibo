# PRD v9.36 — Phí vận chuyển vải vào giá thành, KHÔNG vào công nợ NCC

**Ngày:** 2026-11-09 · **Người yêu cầu:** Nguyen · **Trạng thái:** đã viết, CHƯA deploy
**🔴 ĐỢT NÀY ĐỤNG TIỀN** (giá thành, giá vốn, báo cáo tài chính) — đọc §6 trước khi copy.

---

## 1. Yêu cầu (nguyên văn)

> "Vải nhập về chưa có giá vận chuyển. mỗi NCC giá vận chuyển khác nhau. làm thế nào để đưa vào giá
> thành từng cây vải mà không ảnh hưởng đến công nợ NCC."
> "giá vận chuyển để tính giá thành sản phẩm"

## 2. Bài toán cốt lõi

`congNoNCC()` (`congno.js:1168`) và `tinhGiaThanh()` (`qlsx.js:3297`) **cùng đọc `VaiCay.DonGiaNhap`**.
Cộng phí vào cột đó ⇒ công nợ phải trả NCC phình theo đúng số phí, tức hệ thống bảo ta nợ nhà cung
cấp cả tiền cước đã trả cho nhà xe.

⇒ Phí phải ở **cột riêng**, và hai biểu thức đo công nợ tuyệt đối không được thấy nó:

| Biểu thức | Đo cái gì | Có phí? |
|---|---|---|
| `bieuThucTienCay()` | công nợ phải trả NCC | **KHÔNG** |
| `bieuThucTienTraVai()` | trả vải về NCC (giảm nợ) | **KHÔNG** — cước đã trả nhà xe không đòi lại được |
| `bieuThucDonGiaCoPhiVC()` | giá thành / giá vốn | **CÓ** |

## 3. Ba quyết định Nguyen đã chốt

1. **Đơn giá khai theo NCC, tự áp khi nhập** (vẫn sửa tay từng cây trên phiếu).
2. **Chia theo kg/mét đúng `PhieuNhapVai.DonViTinhGia`.** Phí dạng đ/kg là mô hình đúng vì giá thành
   nhân với `SoKgMetSuDung` (lượng ĐÃ CẮT): cắt 60% cây thì gánh 60% phí, phần còn lại nằm ở vải tồn.
3. **Giữ nguyên tài khoản chi "CVC", chấp nhận phí bị trừ HAI LẦN** trong báo cáo lãi/lỗ (một lần qua
   giá vốn, một lần qua chi phí kinh doanh) — Nguyen nói tự biết khi đọc báo cáo. ⚠️ Nghĩa là **lãi
   hiển thị thấp hơn thực tế** đúng bằng tổng cước. Muốn hết thì tạo tài khoản mới `TinhChiPhiKD = 0`.

## 4. Đã làm

| File | Việc |
|---|---|
| `database/migration_v888.sql` | **MỚI** — `NhaCungCap.PhiVanChuyenDonGia` + `.PhiVanChuyenDVT` (+CHECK Kg/Met/NULL ở batch riêng) + `VaiCay.PhiVanChuyenDonGia` |
| `database/CAI_DAT_DAY_DU.sql` | khối `[121/121]` |
| `backend/utils/tienVaiNhap.js` | `coCotPhiVanChuyen`, `coCotPhiVCNhaCungCap`, `bieuThucPhiVCCay`, `bieuThucDonGiaCoPhiVC`, `donGiaCoPhiVC`, `phiVCCay`, `phiVCTheoNCC`, `chuanPhiVC` + khối ghi chú ranh giới tiền |
| `backend/utils/crudFactory.js` | cờ `rongThanhNull` (chuỗi rỗng → NULL) |
| `backend/routes/khovai.js` | POST + PUT ghi phí (3 đường), GET trả phí, **chặn 409 khi đổi đơn vị mà phiếu đã khai phí**, trả `phiVCLyDo` |
| `backend/routes/qlsx.js` | `tinhGiaThanh` cộng phí vào đơn giá; trả `DonGiaHang`/`DonGiaPhiVC` |
| `backend/routes/baocao.js` | **việc B** — mục B "Phải trả NCC" dùng `bieuThucTienCay()` |
| `backend/routes/danhmuc.js` | 2 cột NCC, `tuyChon` + `khongGuiThiGiu` + `rongThanhNull` |
| `frontend/js/module.khovai.js` | cột "Phí VC" ở 2 bảng (+`<col>`), payload 3 đường, draft, toast `phiVCLyDo` |
| `frontend/js/module.danhmuc.js` | 2 ô trong form NCC |
| `frontend/js/module.qlsx.js` | bảng giá thành hiện "gồm phí VC" |
| `backend/utils/kiem_phi_van_chuyen_vai.js` | **MỚI** — bộ tự kiểm (không copy sang D:\) |
| `frontend/index.html` | bump khovai / danhmuc / qlsx → **9.36** |

🔴 `VaiCay.PhiVanChuyenDonGia` là **bản chụp**: sửa đơn giá ở danh mục NCC **KHÔNG hồi tố** cây đã
nhập. Kế toán không chấp nhận hồi tố giá vốn.

## 5. Nghiệm thu

| # | Thử | Đúng là |
|---|---|---|
| N1 | Danh mục NCC → sửa **chỉ số điện thoại**, không đụng ô phí → Lưu | **lưu được**, và đơn giá phí **giữ nguyên** |
| N2 | Khai NCC 2.000 đ/kg → lập phiếu nhập "tính theo Kg", để trống ô Phí VC | mỗi cây nhận phí 2.000 |
| N3 | Cùng NCC đó, phiếu "tính theo Mét", để trống ô phí | phí = 0 **và có toast báo lệch đơn vị** |
| N4 | Gõ `0` vào ô Phí VC | lưu đúng 0 (không bị thay bằng giá NCC) |
| N5 | Sửa phiếu đã có phí, không đụng ô phí → Lưu | phí **giữ nguyên** |
| N6 | Phiếu đã khai phí → đổi "Đơn giá tính theo" | **chặn, báo 409** nói rõ phải xóa/khai lại phí |
| N7 | Giá thành lệnh có vải mang phí | đơn giá = giá hàng + phí, có dòng "gồm phí VC …" |
| N8 | **Công nợ NCC** của chính phiếu đó | **KHÔNG đổi một đồng** so với trước |
| N9 | Lệnh đã chốt giá thành trước v9.36 | giá vốn **không đổi** |
| N10 | `node backend\utils\kiem_phi_van_chuyen_vai.js` | xanh |

**N8 là phép quan trọng nhất** — ghi số công nợ NCC trước khi deploy để so.

## 6. Rà soát chéo độc lập — 5 ĐỎ + 4 CAM + 6 VÀNG

| # | Mức | Nội dung | Xử lý |
|---|---|---|---|
| Đ1 | 🔴 | `baocao.js` — tôi viết comment chứa **backtick trần trong template literal** ⇒ SyntaxError ⇒ **máy chủ không khởi động được**. Đúng lỗi đã sập production v7.98 + v8.73 | **đã sửa** (bỏ hết backtick + rút việc B(a)) |
| Đ2 | 🔴 | Việc B(a) "giá trị tồn kho vải": sửa xong **sai hơn trước** — tử số thành mét thì mẫu số cũng mét ⇒ `DonGiaBQ` thành đ/mét, nhưng `tonCuoiKG` luôn là KG ⇒ "KG × đ/mét". Ca đang ĐÚNG bị làm sai, ca đang sai không chữa được | **RÚT KHỎI ĐỢT** — xem §7 |
| Đ3 | 🔴 | Ô chọn ĐVT gửi `''`, vi phạm CHECK ⇒ **chết cả màn Danh mục NCC**, kể cả khi chỉ sửa số điện thoại | **đã sửa** — cờ `rongThanhNull` ở `crudFactory` |
| Đ4 | 🔴 | Thiếu `khongGuiThiGiu` ⇒ máy còn bản JS cũ trong cache sửa NCC là **xóa sạch đơn giá phí, im lặng** (đúng bài học `AnhMau` v8.94) | **đã sửa** |
| Đ5 | 🔴 | `lyDo` của `phiVCTheoNCC` **bị nuốt hoàn toàn** ⇒ khai phí ở NCC, nhập hàng, tưởng có phí mà cây = 0 | **đã sửa** — trả `phiVCLyDo` + toast |
| C1 | 🟠 | CHECK constraint cùng batch với `ALTER ADD` ⇒ SQL Server bind tên cột lúc biên dịch ⇒ **hủy cả batch**, migration không bao giờ xong | **đã sửa** — tách `GO` |
| C2 | 🟠 | `<colgroup>` thiếu `<col>` ⇒ ô nhập phí bị bóp còn 42px | **đã sửa** + thêm phép kiểm đếm `<col>` vs `<th>` |
| C3 | 🟠 | Đổi `DonViTinhGia` sau khi đã khai phí ⇒ phí đ/kg nhân với số mét, sai 2–4 lần | **đã sửa** — chặn 409 |
| C4 | 🟠 | Cờ dò cột gác **nhầm bảng** ⇒ migration chạy dở là **không lập được phiếu nhập vải nào** | **đã sửa** — cờ riêng cho `NhaCungCap` |
| V1 | 🟡 | Nhánh sửa cây có sẵn nhận cả **phí âm** (làm giảm giá thành) | **đã sửa** — dùng chung `chuanPhiVC()` |
| V3 | 🟡 | 3 đường ghi `VaiCay` khác (nhập tồn Excel, import cũ, nạp giá hàng loạt) không mang phí | **chấp nhận** — xem §7 |
| V5 | 🟡 | NCC khai đơn giá mà **bỏ trống ĐVT** ⇒ coi như Kg, im lặng | **chấp nhận**, ghi ở §7 |
| X1 | 🟢 | **Ranh giới tiền SẠCH**: grep toàn repo, `congno.js` 0 lần nhắc phí; `chungTu.js`, `giaVonLenhSX.js`, mục B `baocao.js` đều không cộng phí | — |
| X2 | 🟢 | `GROUP BY` hợp lệ ở **cả hai** trạng thái (hằng số không cần nằm trong GROUP BY) | — |
| X3 | 🟢 | Lệnh đã chốt giá thành trước v9.36 **không bị hồi tố** (cây cũ phí NULL ⇒ `giuNguyen`) | — |
| X8 | 🟢 | Số `0` vs bỏ trống: cả 3 payload gửi nguyên `.value`, backend phân biệt đúng | — |

## 7. Còn nợ / cảnh báo

- 🔴 **"Giá trị tồn kho vải" VẪN SAI** (bỏ sót vải mua theo mét) — cố ý chưa sửa, lý do đầy đủ trong
  khối ghi chú của CTE `gia` ở `baocao.js`. Sửa đúng cần quy đổi mét↔kg (GSM + khổ vải) hoặc thêm
  cột `GiaTriTonMet`. **Việc riêng**, phải đối chiếu số trước/sau.
- 🔴 **Mục B "Phải trả NCC" SẼ ĐỔI SỐ** sau deploy (tăng lên bằng tổng vải mua theo mét). Chạy câu
  này **trước** khi deploy để biết trước con số nhảy bao nhiêu:
  ```sql
  SELECT SUM(CASE WHEN pn.DonViTinhGia = N'Met' THEN ISNULL(vc.SoMet,0) ELSE 0 END
             * ISNULL(vc.DonGiaNhap,0)) AS ChenhLechDuKien
  FROM PhieuNhapVai pn JOIN VaiCay vc ON vc.PhieuNhapID = pn.PhieuNhapID
  WHERE pn.NCC_ID IS NOT NULL;
  ```
  ⚠️ Kể cả sau khi sửa, mục B **vẫn có thể lệch** màn Công nợ NCC đúng bằng tổng **phiếu trả vải**
  (mục B chưa trừ phiếu trả — nợ cũ, ngoài phạm vi v9.36).
- 🔶 Vải nhập qua **nhập tồn Excel / import cũ / nạp giá hàng loạt** không mang phí — muốn có phải
  vào Sửa phiếu nhập gõ tay. Chưa có đường nạp phí hàng loạt.
- 🔶 NCC khai đơn giá mà bỏ trống ĐVT thì hệ thống coi là **Kg**. Nếu ý là đ/mét thì sai lặng lẽ —
  nên luôn chọn ĐVT khi đã khai đơn giá.
- 🔶 Bản in / popup xem phiếu nhập **không có** cột Phí VC — cố ý: bản in là chứng từ với NCC, cước
  nhà xe không thuộc về nó.
- ⚠️ `kiem_tong_tien_phieu_nhap_vai.js:107` **đang đỏ sẵn từ trước v9.36** (đòi `congno.js` gọi
  `bieuThucTienCay(` đúng 4 lần, thực tế còn 3 vì "bảng chứng từ" đã dời sang `utils/chungTu.js`).
  Thấy đỏ đừng truy ngược vào v9.36.

## 8. Lệnh chạy

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\tienVaiNhap.js
node --check backend\utils\crudFactory.js
node --check backend\routes\khovai.js
node --check backend\routes\qlsx.js
node --check backend\routes\baocao.js
node --check backend\routes\danhmuc.js
node --check frontend\js\module.khovai.js
node --check frontend\js\module.danhmuc.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_phi_van_chuyen_vai.js
```

Xanh hết → chạy câu SQL ở §7 (ghi lại số) → chạy `migration_v888.sql` → `pm2 restart qlnoibo` →
copy 9 file C → D.
