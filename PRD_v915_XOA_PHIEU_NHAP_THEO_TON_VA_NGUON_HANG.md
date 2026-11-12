# PRD v9.15 — Xóa phiếu nhập kho chặn theo TỒN SAU XÓA + Nguồn hàng theo loại phiếu

**Ngày:** 2026-11-03 · Hai yêu cầu của Nguyen trong cùng buổi, cùng đụng `backend/routes/nhapkho.js`.

## 1. Xóa phiếu nhập kho — đổi luật chặn (ảnh NK260316)

> *"Phiếu nhập kho mới nhập thêm và mã hàng cũ nhưng không xóa được, báo không xóa được do đã xuất bán. Đang để ràng buộc cả mã hàng. Thay đổi: nếu xóa phiếu SL nhiều hơn phiếu bán hàng thì mới cảnh báo."*

**Luật cũ (v6.92):** mã có *bất kỳ* phiếu bán chưa hủy nào ⇒ khóa xóa **mọi** phiếu nhập của mã — phiếu nhập THÊM lập nhầm cho mã cũ không gỡ ra được nữa.

**Luật mới:** chỉ chặn khi xóa xong có **(mã, màu) bị TỒN ÂM** — một câu SQL: đóng góp của phiếu (`SUM(SoLuongChinh)` theo mã+màu) so với `vw_TonTheoMau.TonCai`; chặn khi `TonCai − góp < 0`. Câu báo nêu rõ từng dòng: *tồn hiện X, phiếu này góp Y ⇒ còn X−Y* (kèm đơn vị thật của mã), và chỉ đường: hủy/giảm phiếu bán, hoặc dùng **HỦY** phiếu thay vì XÓA (hủy vốn không có guard từ v6.91 — đường thoát có chủ đích, tồn âm soi bằng `utils/kiem_ton_am.js`).

Vì sao so với **tồn của view** chứ không tự cộng "nhập từ phiếu − đã bán": tồn thật còn thẻ kho tay (`NhapCai` — hàng cũ nhập tồn ban đầu toàn đi đường này) + phiếu nhập lại; tự cộng thiếu nguồn là chặn oan đúng kiểu lỗi đang sửa. Phiếu đang **Đã hủy** thì xóa thẳng không kiểm (đóng góp đã nằm ngoài tồn).

🔴 **Bẫy đơn vị bắt được khi rà chéo (suýt sập):** `vw_TonTheoMau.TonCai` **TÊN là "Cái" nhưng LƯU theo ĐƠN VỊ CHÍNH của mã (có thể là Ri)** — `vw_NhapKhoTuPhieu` cộng thô `SoLuongChinh`, `banhang.js` trừ tồn bằng `slChinh`. Bản nháp đầu quy vế góp về cái bằng `QUY_VE_CAI` = so hai đơn vị khác nhau ⇒ mã Ri bị chặn oan gấp hệ số lần. Luật đúng: **hai vế cùng `SoLuongChinh` thô**.

An toàn bước 2 (xóa mã hàng mồ côi): `noiDangDungMaHang` quét FK động từ `sys.foreign_keys` — mã có phiếu bán hàng (FK NO ACTION) **luôn được giữ lại**, không đụng dữ liệu bán. Đuôi route đã có sẵn nhánh tính lại giá vốn cho cả NCC lẫn SX.

## 2. Nguồn hàng của thẻ kho theo loại phiếu nhập

> *"Làm phiếu nhập kho chọn từ sản xuất và gắn lệnh sản xuất nhưng ở thẻ kho hàng hóa, cột nguồn hàng vẫn gắn cờ hàng ngoài."*

Cột Nguồn hàng = `TheKhoHangHoa.LoaiHang` (badge Nhà SX / Đặt ngoài — `oNguonHangHtml`, module.khohang.js). Chỗ tạo mã mới của phiếu nhập đọc `d.loaiHang` nhưng **form không có ô nào gửi trường đó** ⇒ mọi mã sinh từ phiếu nhập — kể cả phiếu TỪ SẢN XUẤT — đều thành `DatNgoai`.

**Sửa (`timHoacTaoMaHang` nhận thêm `loai`):**
- Mã **MỚI** từ phiếu `SanXuat` ⇒ `NhaSanXuat`.
- Mã **ĐÃ CÓ** đang `DatNgoai` gặp phiếu `SanXuat` ⇒ **nâng MỘT CHIỀU** lên `NhaSanXuat` (cả nhánh chọn từ danh sách lẫn gõ mã; phiếu NCC không hạ ngược; chạy trong transaction của phiếu). Không phá luật v6.99 ("phiếu nhập không sửa mã đã có") — luật đó chặn giá trị *mặc định của form* ghi đè ĐVT/tỷ lệ; đây là tín hiệu *loại phiếu người dùng chọn*, đụng đúng một cột nhãn (đã rà: không chỗ nào tính tồn/giá/lương theo `LoaiHang`), cùng kiểu ngoại lệ TenHoaDon v7.46.
- **Dữ liệu cũ không tự chữa.** Mã đang sai cờ: mở phiếu nhập SX của nó → bấm **Lưu** lại là cờ đổi (PUT đi qua cùng đường).

## 3. File

| File | Gì |
|---|---|
| `backend/routes/nhapkho.js` | guard DELETE mới + `timHoacTaoMaHang(…, loai)` + nâng cờ |
| `frontend/js/module.nhapkho.js` | câu confirm nút Xóa theo luật mới (câu cũ "mã đã xuất bán thì không xóa được" nay sai) |
| `frontend/index.html` | `module.nhapkho.js?v=9.15` |
| `backend/utils/kiem_xoa_phieu_va_nguon_hang.js` *(mới, KHÔNG copy)* | vm.Script 3 file + phép cấu trúc viết trên bản cuối |

Không migration. Không đổi dữ liệu sẵn có.

## 4. Deploy — BẮT BUỘC GỘP với v9.11 + v9.13 + v9.14 + v9.16 + v9.17 (một đợt, 16 file)

`frontend/index.html` trong repo đang mang **cả sáu** bump (v9.11 ×2, v9.13, v9.14, v9.15, v9.16, v9.17) — copy index.html mà thiếu file JS nào là PWA giữ bản cũ vĩnh viễn (bài học v8.92). Không migration ở cả sáu bản.

```powershell
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\middleware\auth.js
node --check backend\routes\payroll.js
node --check backend\routes\khuyenmai.js
node --check backend\routes\nhaplai.js
node --check backend\routes\qlsx.js
node --check backend\routes\bangke.js
node --check backend\routes\nhapkho.js
node --check backend\routes\khohang.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.users.js
node --check frontend\js\module.khohang.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\module.bangkebtp.js
node --check frontend\js\module.nhapkho.js
node --check frontend\js\module.congno.js
node backend\utils\kiem_quyen_route_chi_doc.js
node backend\utils\kiem_he_so_hieu_luc.js
node backend\utils\kiem_bangke_size_tu_dai.js
node backend\utils\kiem_xoa_phieu_va_nguon_hang.js
node backend\utils\kiem_bao_gia_gia_sau_thue.js
node backend\utils\kiem_cong_no_loc_ky.js
```

**Cả 6 bộ kiểm `0 sai`** → copy **16 file** sang D:\QLSX (giữ nguyên cây thư mục):
`backend\middleware\auth.js` · `backend\routes\payroll.js` · `backend\routes\khuyenmai.js` · `backend\routes\nhaplai.js` · `backend\routes\qlsx.js` · `backend\routes\bangke.js` · `backend\routes\nhapkho.js` · `backend\routes\khohang.js` · `frontend\js\module.payroll.js` · `frontend\js\module.users.js` · `frontend\js\module.khohang.js` · `frontend\js\module.qlsx.js` · `frontend\js\module.bangkebtp.js` · `frontend\js\module.nhapkho.js` · `frontend\js\module.congno.js` · `frontend\index.html` → `pm2 restart qlnoibo` → Ctrl+F5 (sidebar v9.17).

**Thử (ngoài checklist của PRD_v911 + PRD_v913/914):**
1. Xóa phiếu NK260316: nay xóa được (nếu tồn sau xóa không âm); nếu chặn, câu báo nêu mã—màu—tồn—góp—còn, không còn câu "hàng đã xuất bán".
2. Mã quản theo **Ri**: thử xóa phiếu góp phần lớn tồn — chặn/cho phải đúng và câu báo in "Ri", không in "cái".
3. Phiếu nhập **từ SX** gắn lệnh, mã MỚI → thẻ kho badge **Nhà SX**.
4. Mã cũ đang "Đặt ngoài" có phiếu SX: mở phiếu → Lưu → cờ đổi Nhà SX. Phiếu NCC không hạ ngược cờ.
5. Hủy phiếu nhập (PUT /huy) vẫn như cũ — không bị guard mới đụng.

**Commit:** `"v9.15 xoa phieu nhap kho chan theo ton sau xoa (vw_TonTheoMau, cung don vi chinh) + nguon hang the kho theo loai phieu (SanXuat => NhaSanXuat, nang mot chieu)"`

## 5. Nói trước / còn mở

- Guard chạy ngoài transaction (chặn-trước-xóa-sau, chủ đích từ v6.92) — phiếu bán chen đúng giữa vẫn có thể tạo tồn âm; `kiem_ton_am.js` soi định kỳ.
- Xóa mã mồ côi kéo CASCADE `TheKhoChiTietMau` (kể cả NhapCai tay > 0) — hành vi có từ v6.92, không đổi ở bản này.
- Mã "Đặt ngoài" sai cờ hàng loạt từ trước: không backfill tự động (đúng chủ trương); ai cần sửa nhanh thì sửa ở form Thẻ kho hoặc Lưu lại phiếu SX của mã đó.
