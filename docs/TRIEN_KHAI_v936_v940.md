# Triển khai v9.36 → v9.40 — danh sách kiểm

*Soạn 10/11/2026. Máy khách hiện đang chạy **v9.33**.*

Đợt này gồm **4 nhóm việc độc lập**. Có thể deploy từng nhóm, nhưng migration phải chạy trước khi `pm2 restart`.

| Nhóm | Nội dung | Migration | Rủi ro tiền |
|---|---|---|---|
| v9.35 | Nội dung công việc → mục 1.5 hợp đồng lao động | `migration_v887` | không |
| v9.36 | Phí vận chuyển vải vào giá thành, không vào công nợ NCC | `migration_v888` | **CÓ** — số "Phải trả NCC" sẽ đổi |
| v9.37 → v9.41 | Sao lưu CSDL tự động (phân hệ mới) + bản sao Google Drive + **sao lưu transaction log** | không | không |
| v9.38 → v9.39 | Tách dải size về Kỹ thuật + cột tỷ lệ vải | `migration_v889` | không (xem §5) |
| **v9.45** | **Lương công nhật theo bảng thực tế** — bộ tính mới, thông số trên hợp đồng, tab Đánh giá KPI, điều chỉnh có lý do, in 3 chữ ký | `migration_v890` | **CÓ** — bảng lương công nhật đổi hẳn cách tính (xem §9) |
| v9.46 | Phiếu bán hàng: tên người lập + giờ/ngày lập dưới ô "Người làm phiếu"; phiếu đã sửa/hủy in "Sửa lần cuối: ai — lúc nào" | `migration_v891` | không (xem §10) |
| v9.47 | Rê chuột vào ảnh nhỏ (thẻ kho hàng hóa, chi tiết hàng hóa, thẻ kho phụ kiện, thẻ kho vải — và mọi ô ảnh nhỏ khác) là hiện to ngay; bấm vẫn mở toàn màn | không | không (xem §11) |
| **v9.48** | Hợp đồng lao động: điều khoản thưởng e) / 3.4 **in theo đúng Kiểu thưởng** đã chọn (KPI / Sản phẩm / Không) thay vì câu KPI cố định | không | không (xem §12) |
| **v9.49** | Chấm công: **kéo tự động từ máy chấm công theo giờ cài đặt** + tổng hợp bảng công; nút "Chạy ngay" | không | không (xem §13) |

*✅ **Đợt v9.35 → v9.48b ĐÃ deploy, migration v887 → v891 đã chạy** (Nguyen xác nhận 12/11/2026). **v9.49 CHƯA deploy** (§13). Việc còn mở: §9.1–§9.3 (khai hợp đồng + 3 giả định lương công nhật) và §8.*

---

## 0. Bắt buộc làm trước — không bỏ qua

🔴 **Bash sandbox của tôi hỏng suốt phiên này (12 lần liên tiếp).** Tôi **không chạy được** `node --check` lẫn bộ tự kiểm nào. Toàn bộ phần dưới là đọc mã bằng tay cộng với rà soát chéo độc lập. Bước 1 và bước 2 dưới đây là lưới an toàn **duy nhất** còn lại.

### Bước 1 — Biên dịch thử. Chạy trên thư mục C:\ (bản sửa), KHÔNG phải D:\

```
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\saoLuuCSDL.js
node --check backend\utils\lichSaoLuu.js
node --check backend\utils\canhBaoSaoLuu.js
node --check backend\routes\saoluu.js
node --check backend\routes\qlsx.js
node --check backend\routes\hrm.js
node --check backend\routes\khovai.js
node --check backend\routes\danhmuc.js
node --check backend\routes\baocao.js
node --check backend\utils\tienVaiNhap.js
node --check backend\utils\crudFactory.js
node --check frontend\js\module.saoluu.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\module.hrm.js
node --check frontend\js\module.khovai.js
node --check frontend\js\module.danhmuc.js
node --check frontend\js\app.js
node --check backend\utils\luongCongNhat.js
node --check backend\routes\payroll.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.mypay.js
node --check backend\routes\banhang.js
node --check frontend\js\module.khohang.js
node --check frontend\js\common.js
node --check backend\routes\khohang.js
node --check backend\routes\congno.js
node --check backend\routes\users.js
node --check backend\utils\luongGiaCongInThe.js
node --check frontend\js\module.congno.js
node --check frontend\js\module.users.js
node --check backend\utils\bangLuongTuDong.js
node --check backend\utils\nghiPhep.js
node --check backend\utils\loadUserContext.js
node --check backend\server.js
node --check backend\routes\hopdong.js
node --check backend\routes\publicKy.js
node --check backend\utils\hopDongCore.js
node --check backend\utils\hopDongPdf.js
node --check backend\utils\kySoPdf.js
node --check backend\utils\kiemChuKySo.js
node --check backend\utils\guiOtp.js
node --check backend\utils\nhatKyHopDong.js
node --check backend\utils\thu_ky_so.js
node --check frontend\js\module.hopdong.js
node --check frontend\js\ky.js
node --check frontend\js\kysoclient.js
node --check backend\utils\kyTuXa.js
node --check backend\utils\chuoiTinCay.js
node --check backend\utils\nhacHanKy.js
node --check backend\utils\kiem_hop_dong_gd2.js
node --check backend\routes\baocao.js
node --check backend\routes\dashboard.js
node --check frontend\js\module.baocao.js
node --check frontend\js\module.dashboard.js
node --check backend\utils\kiem_doanh_thu_thuan_dashboard_bao_cao.js
node --check backend\routes\congno.js
node --check frontend\js\module.congno.js
node --check frontend\js\module.hoadon.js
node --check backend\utils\kiem_xem_nam_truoc.js
node --check backend\routes\nhapkho.js
node --check backend\utils\giaNhapHangHoa.js
node --check frontend\js\module.nhapkho.js
node --check backend\utils\kiem_ton_dau_ky_khong_cong_no.js
node --check frontend\js\module.khovai.js
node --check backend\utils\sanLuongTheoLenh.js
node --check backend\routes\qlsx.js
node --check backend\routes\payroll.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.hrm.js
node --check frontend\js\module.mypay.js
node --check backend\utils\kiem_san_luong_theo_lenh.js
node --check backend\utils\luongCongNhat.js
node backend\utils\kiem_luong_cong_nhat_v945.js
node backend\utils\kiem_dieu_khoan_thuong_hop_dong.js
node backend\utils\kiem_mypay_cham_cong_cua_toi.js
node --check backend\routes\danhmuc.js
node --check frontend\js\module.danhmuc.js
node --check backend\routes\users.js
node --check backend\routes\auth.js
node --check backend\utils\loadUserContext.js
node --check frontend\js\app.js
node --check frontend\js\module.users.js
node backend\utils\kiem_cong_tac_vien_thiet_ke.js
node backend\utils\kiem_mypay_mac_dinh_theo_nhan_vien.js
node --check backend\utils\anhLenhSX.js
node --check backend\routes\hrm.js
node backend\utils\kiem_nghi_phep_le_chuyen_can.js
node --check backend\utils\kieuThuong.js
node --check backend\utils\nghiPhep.js
node --check frontend\js\common.js
node backend\utils\kiem_san_luong_theo_lenh.js
node --check backend\utils\kyGuiDangGiu.js
node --check backend\routes\kygui.js
node --check backend\routes\banhang.js
node --check backend\server.js
node --check frontend\js\module.kygui.js
node --check frontend\js\module.khohang.js
node backend\utils\kiem_hang_ky_gui.js
node --check backend\utils\sanLuongTheoLenh.js
node --check backend\routes\qlsx.js
node --check frontend\js\module.qlsx.js
node backend\utils\kiem_san_luong_theo_lenh.js
node --check backend\routes\danhmuc.js
node --check backend\routes\dashboard.js
node --check frontend\js\module.danhmuc.js
node --check frontend\js\module.dashboard.js
node backend\utils\kiem_nhom_khach_hang.js
node --check backend\utils\luongCongNhat.js
node --check backend\routes\hrm.js
node --check frontend\js\module.hrm.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.mypay.js
node backend\utils\kiem_luong_cong_nhat_v945.js
```

*(6 dòng cuối là v9.78 (§38) — **xăng = số tiền/1 NGÀY × ngày công thực tế (bản chốt v9.79 19/11; cách tính theo km đã bỏ; `module.hrm/payroll.js` lên 9.80, phải copy LẠI)** + mã rập ở list lệnh + vòng tròn theo nhóm; `module.mypay/qlsx/dashboard.js` **9.78**; cần migration_v904. Chạy lại `kiem_dieu_khoan_thuong_hop_dong.js` + `kiem_san_luong_theo_lenh.js` + `kiem_nhom_khach_hang.js` vì đụng mẫu hợp đồng / picker lệnh / biểu đồ.)*

*(5 dòng cuối là v9.77 (§37) — nhóm khách hàng + dashboard theo nhóm; `module.danhmuc/dashboard.js` 9.77; cần migration_v903. Chạy lại `kiem_doanh_thu_thuan_dashboard_bao_cao.js` vì đụng `/kinhdoanh`.)*

*(4 dòng trước đó là v9.76 (§36) — chọn sản phẩm may mẫu theo hợp đồng; `module.qlsx.js` 9.76; cần migration_v902.)*

*(7 dòng `kyGuiDangGiu…kiem_hang_ky_gui` là v9.75 (§35) — `kyGuiDangGiu.js` MỚI, `banhang.js` require lúc nạp; `server.js` vỡ là KHÔNG ai vào được; cần migration_v901 TRƯỚC restart. `danhmuc.js`, `module.danhmuc.js` ở trên v9.75 sửa tiếp — chạy lại; `module.khohang/danhmuc.js` 9.75. Chạy lại `kiem_hang_mau_o_khach.js`, `kiem_chot_ban_hang_mau.js` vì đụng guard sửa phiếu bán hàng.)*

*(2 dòng `kieuThuong.js` / `nghiPhep.js` + chạy lại `kiem_san_luong_theo_lenh.js`, `kiem_luong_cong_nhat_v945.js`, `kiem_dieu_khoan_thuong_hop_dong.js`, `kiem_nghi_phep_le_chuyen_can.js` là v9.73 (§33) — `kieuThuong.js` MỚI, 4 file route/util require lúc nạp; `module.hrm/payroll/mypay/qlsx.js` 9.73; cần migration_v899.)*

*(3 dòng `anhLenhSX…kiem_nghi_phep` + chạy lại `kiem_luong_cong_nhat_v945.js`, `kiem_dieu_khoan_thuong_hop_dong.js` là v9.72 (§32) — `module.hrm.js`, `module.payroll.js` 9.72.)*

*(5 dòng `users.js…module.users.js` + bộ kiểm `kiem_mypay_mac_dinh` chạy lại là v9.71 — §30 mục 3 lương CTV theo mã rập + §31 user bắt đổi mật khẩu; `payroll.js`, `module.payroll.js` 9.71.)*

*(`module.khovai.js` là v9.66; 8 dòng `module.qlsx…kiem_san_luong` là v9.67 (§27); 3 dòng `luongCongNhat…kiem_dieu_khoan` là v9.68 (§28, `module.hrm.js` 9.68); `kiem_mypay_cham_cong` là v9.69 (§29); 3 dòng cuối là v9.70 (§30 — `qlsx.js`, `payroll.js`, `danhmuc.js`, `module.qlsx/payroll/danhmuc/mypay.js` 9.70, cần migration_v896) — sản lượng theo lệnh ⇒ thưởng sản phẩm tự động. `baocao.js`, `congno.js` ở trên v9.66 cũng sửa 1 dòng.)*

*(4 dòng cuối + `baocao`/`dashboard` ở trên là v9.65 (§25) — "xem năm trước" + công nợ "tính đến ngày".)*

*(5 dòng cuối là v9.63 (§24) — doanh thu thuần dashboard = báo cáo. `baocao.js` đã có ở trên (v9.36) nhưng v9.63 sửa tiếp — chạy lại.)*

*(từ `server.js` trở xuống là v9.61 (§22) — `server.js` vỡ là KHÔNG ai vào được phần mềm; `hrm.js` v9.61 thêm 2 dòng cuối — chạy lại. Ba file `kyTuXa.js` / `chuoiTinCay.js` / `nhacHanKy.js` là MỚI của v9.62 (§23); v9.62 sửa tiếp `server.js`, `hopdong.js`, `publicKy.js`, `hopDongCore.js`, `hopDongPdf.js`, `module.hopdong.js`, `ky.js` — chạy lại cả.)*

*(`bangLuongTuDong.js` / `nghiPhep.js` là file MỚI của v9.53 / v9.55; `loadUserContext.js` là v9.59 (§20) — file này nạp quyền cho MỌI lần đăng nhập, vỡ là không ai đăng nhập được; `payroll.js` / `hrm.js` / `congno.js` / `luongCongNhat.js` / `module.payroll.js` / `module.hrm.js` / `module.mypay.js` ở trên v9.53–v9.55 sửa tiếp, `users.js` hai phía v9.59 sửa tiếp — chạy lại.)*

*(bốn dòng v9.45: luongCongNhat / payroll / module.payroll / module.mypay — `hrm.js` hai phía đã có ở trên nhưng v9.45 sửa tiếp, chạy lại. banhang / module.khohang là v9.46; `common.js` là v9.47 — file này nạp cho MỌI màn hình, vỡ cú pháp là cả phần mềm đứng.)*

**Yêu cầu: KHÔNG dòng nào in ra gì cả.** In ra một dòng = máy chủ sẽ không khởi động được.

> Vì sao gắt: lỗi "dấu backtick nằm trong comment bên trong template literal" đã **sập production hai lần** (v7.98, v8.73), và trong chính đợt này rà soát chéo bắt được tôi tái phạm ở `baocao.js`. `node --check` bắt được nó trong 1 giây.

### Bước 2 — Bộ tự kiểm

```
node backend\utils\kiem_sao_luu_csdl.js
node backend\utils\kiem_bang_rieng_theo_dai.js
node backend\utils\kiem_he_so_hieu_luc.js
node backend\utils\kiem_phi_van_chuyen_vai.js
node backend\utils\kiem_noi_dung_cong_viec.js
node backend\utils\kiem_tach_mau_cung_dai.js
node backend\utils\kiem_luong_cong_nhat_v945.js
node backend\utils\kiem_tam_ung_tru_luong.js
node backend\utils\kiem_dau_vet_phieu_ban_hang.js
node backend\utils\kiem_xem_truoc_anh_khi_re_chuot.js
node backend\utils\kiem_xem_anh_dien_thoai.js
node backend\utils\kiem_keo_cham_cong_tu_dong.js
node backend\utils\kiem_quet_ma_vach_phieu_ban_hang.js
node backend\utils\kiem_ma_vach_the_kho.js
node backend\utils\kiem_sl_giao_va_mypay_tu_dong.js
node backend\utils\kiem_bang_luong_tu_tinh_lai.js
node backend\utils\kiem_nghi_phep_le_chuyen_can.js
node backend\utils\kiem_mypay_mac_dinh_theo_nhan_vien.js
node backend\utils\kiem_mypay_luong_trai_vai_cat.js
node backend\utils\kiem_hop_dong_ky_dien_tu.js
node backend\utils\kiem_hop_dong_gd2.js
node backend\utils\kiem_doanh_thu_thuan_dashboard_bao_cao.js
node backend\utils\kiem_xem_nam_truoc.js
node backend\utils\kiem_ton_dau_ky_khong_cong_no.js
```

*(`kiem_hop_dong_ky_dien_tu.js` mục 7 KÝ THẬT bằng chứng thư tự ký — chỉ chạy khi đã `npm install` các thư viện v9.61 (§22); chưa cài thì in "⏭ BO QUA", không đỏ. `kiem_hop_dong_gd2.js` (v9.62, §23) cũng vậy ở mục 2 và 3; mục 3 ghi tạm một file `__kiem_tam_root.pem` vào `backend\chungthu_goc\` rồi tự xóa — nếu bộ kiểm sập giữa chừng mà file còn, XÓA TAY (đó là CA giả).)*

**Hoặc một lệnh chạy hết** (từ 12/11, chạy cả bộ cũ lẫn mới — đừng chọn tay nữa, v9.45 đã sót 4 phép vì chọn tay):

```
node backend\utils\kiem_tat_ca.js --nhanh
```

*(`kiem_xem_anh_dien_thoai.js` là bộ kiểm cũ của lightbox v7.77 — chạy lại vì v9.47 chèn mã ngay dưới khối đó trong `common.js`; mục 2 của nó cần jsdom, không có thì tự bỏ qua, không phải lỗi.)*

`kiem_luong_cong_nhat_v945.js` chạy **bộ tính thật trên đúng 47 dòng của file `Tháng 10.2026.xlsx`** — đỏ ở dòng nào là công thức tôi giải mã sai dòng đó. `kiem_tam_ung_tru_luong.js` (v9.32) phải chạy lại vì v9.45 đổi route tính lương.

**Đỏ nào cũng gửi tôi nguyên văn, đừng tự sửa.** Bộ kiểm có thể đỏ oan — và đỏ oan là lỗi của tôi, không phải của anh.

### Bước 2b — Kết quả lần chạy ĐỦ 88 bộ đầu tiên (anh chạy 14/11): 40 đỏ, đã phân loại

Lần đầu `kiem_tat_ca.js` chạy hết 88 bộ (trước đây mỗi đợt chỉ chạy vài bộ chọn tay) nên lòi ra bộ kiểm **mục ruỗng tích lũy nhiều tháng**: bộ viết ở bản X ghim cứng số cột / số lần gọi / `?v=` đúng bằng X, bản sau đổi là đỏ dù mã đúng.

| Nhóm | Bộ | Đã làm |
|---|---|---|
| **Thuộc đợt này** | `kiem_ma_vach_the_kho` (1 đỏ oan: regex `class="kh-mavach-quet"` trong khi class thật là `btn small secondary kh-mavach-quet`) · `kiem_keo_cham_cong_tu_dong` ("chênh 3": phép kiểm dùng `Math.round(2 ngày 23h59)` = 3 — mã đúng; **và** phát hiện bộ này từ 13/11 **treo im ở mục 7** rồi Node thoát mã 0 không in KET QUA — "xanh giả". Nay stub trả máy thứ 2 ngay + canh gác 20 s) | sửa bộ kiểm, chạy lại |
| **Đỏ oan do bản sau đổi mã** | `kiem_luong_cong_nhat_v945` ([123/123] → file sinh lại là [123/124]) · `kiem_dau_vet_phieu_ban_hang` (nới [124/124]) · `kiem_o_tim_moi_danh_sach` (payroll 6→7 chỗ gọi vì tab KPI v9.45; `dataset.tim` → `hasAttribute('data-tim')`) · `kiem_tam_ung_tru_luong` (SQL `bp.TenBoPhan AS BoPhan` sau rà chéo) · `kiem_bao_gia_gia_sau_thue` / `kiem_cong_no_loc_ky` / `kiem_co_gui_mau_so_cong_no` / `kiem_luong_cat_marap_excel` (ghim `?v=` bằng đúng, nay ≥) · `kiem_so_quy_tren_dashboard` (stub thiếu `themOTimTuDong` v9.05) · `kiem_zalo_webhook` (2 phép 🔴 thứ tự: `indexOf('xuLy(sk)')` bắt nhầm dòng ĐỊNH NGHĨA hàm nằm trên route — thứ tự thật ĐÚNG, mã an toàn) | sửa bộ kiểm |
| **Lỗi thật, đã sửa mã** | `kiem_tam_ung_tru_luong`: v9.45 đổi route tính lương sang `ISNULL(TrangThaiLaoDong,'') <> 'Đã nghỉ việc'` (NULL = đang làm) nhưng ô chọn nhân viên ở phiếu chi (`congno.js GET /nhanvien`) vẫn `<>` (NULL bị loại) ⇒ người trạng thái NULL có lương mà không ứng được. **Sửa `backend\routes\congno.js` theo luật v9.45** — copy file này cùng đợt, `pm2 restart` | sửa mã |
| **Thiếu môi trường** | 9 bộ `Cannot find module 'jsdom'` (be_rong_cot_form, chon_danh_muc_ma_hang, cot_stt_tu_dong, gia_nhap_ma_hang, gia_thanh_chi_phi_chung, lenh_sx_phieu_nhap_kho, phieu_kem_chuyen_thang, tim_kiem_lenh_sx, xuat_in_cong_no) | `kiem_tat_ca` nay ghi **BOQUA**, không tính đỏ. Muốn chạy: `cd backend && npm install --no-save jsdom` (không vào package.json, máy chủ không cần) |
| **Mục ruỗng cũ, CHƯA rà** (không nằm trong mã đợt này) | `kiem_excel_phieu_ban_hang` (13 cột vs 12 — cột "Chương trình KM" v8.70 thêm sau) · `kiem_hang_mau_o_khach` (route chốt bán mẫu v9.08 tự viết lại câu "đã trả") · `kiem_tong_tien_phieu_nhap_vai` (đỏ sẵn từ trước v9.36, đã ghi ở trên) · `kiem_sao_luu_csdl` (5) · `kiem_so_ke_toan` (10) · `kiem_v754` (5) · `kiem_kho_nhap_nhieu_dot` (4) · `kiem_cong_no_doi_tac_2_chieu` (2) · `kiem_danh_sach_moi_nhat_len_dau` (2) · `kiem_dashboard_so_congno` · `kiem_he_so_hieu_luc` · `kiem_in_phieu_xuat_tra_ncc` · `kiem_nhap_lai_hang_hoa` · `kiem_nhaplai_bat_loi` · `kiem_phieu_thu_ncc` · `kiem_sua_phieu_nhap_lai` · `kiem_thong_ke_chi_tiet` · `kiem_tracuu_ma_cong_khai` · `kiem_chon_cay_kg_met` · `kiem_lenh_sx_o_phieu_nhap` (bộ kiểm tự vỡ cú pháp) | **chưa đụng** — cần một buổi riêng đọc từng cặp bộ kiểm ↔ mã để tách "bộ kiểm cũ" với "lỗi thật". 4 bộ có mùi lỗi thật: `kiem_danh_sach_moi_nhat_len_dau` (sổ quỹ bị đảo chiều — bộ kiểm từng khóa "đảo là SAI"), `kiem_he_so_hieu_luc` (nút Sửa/Xóa sổ cắt gác sai quyền — cùng họ lỗi v9.27), `kiem_chon_cay_kg_met` (lấy `vc.SoMet` làm số đã cấp), `kiem_sua_phieu_nhap_lai` (lưới thiếu dòng) |

**Luật từ nay:** bộ kiểm không ghim `?v=` bằng đúng, không ghim số cột/số chỗ gọi nếu không kèm lý do; bộ kiểm có `await` phải có canh gác thời gian (treo = Node thoát mã 0 = xanh giả).

⚠️ **Biết trước một chỗ đỏ KHÔNG phải do đợt này:** `kiem_tong_tien_phieu_nhap_vai.js` dòng 107 đỏ sẵn **từ trước v9.36** (nó đòi `congno.js` gọi `bieuThucTienCay(` 4 lần, thực tế 3 — bảng chứng từ đã dời sang `utils/chungTu.js`). Thấy đỏ đừng truy vào v9.36.

---

## 1. Trước khi deploy — hai câu SQL phải chạy

### 1.1 🔴 Ước lượng chênh lệch "Phải trả NCC" (v9.36)

Số công nợ NCC **sẽ đổi** sau v9.36. Phải biết trước đổi bao nhiêu, nếu không thì sau deploy không phân biệt được "đổi do tính năng mới" với "có người sửa phiếu".

Câu SQL nằm ở **`docs/PRD_v936_phi_van_chuyen_vai.md` §7**. Chạy, chụp màn hình kết quả, giữ lại.

### 1.2 Mẫu hợp đồng đã bị sửa trong CSDL chưa (v9.35)

```sql
SELECT MaMau FROM MauVanBanHRM WHERE MaMau IN ('HDLD_CHINHTHUC','HDLD_THUVIEC');
```

- **Không ra dòng nào** → tốt, phần mềm dùng mẫu gốc, tính năng chạy đúng.
- **Ra dòng** → mẫu đó đã bị sửa tay trước v9.35 và **không có chỗ cắm `{{NoiDungCongViec}}`**. Gõ nội dung vào sẽ lưu được, hiện được trên màn hình, mà **bản hợp đồng IN RA vẫn là điều khoản cũ**. v9.35 có toast cảnh báo, nhưng tốt nhất là sửa lại mẫu trước.

---

## 2. Migration — chạy TRƯỚC `pm2 restart`

Ba file, chạy theo thứ tự, trên CSDL `QLNoiBo` ở máy chủ:

```
database\migration_v887.sql    -- HopDongLaoDong.NoiDungCongViec
database\migration_v888.sql    -- VaiCay.PhiVanChuyenDonGia + NhaCungCap.PhiVanChuyenDonGia/DVT
database\migration_v889.sql    -- DonHangDaiSize.TyLeVai
database\migration_v890.sql    -- v9.45: HopDongLaoDong +6 cột, CauHinhLuong +4 cột, BangLuongChiTiet +16 cột,
                               --        3 bảng mới (HopDongSanPham, DanhGiaKPI, ThuongSanPhamThang), ChucNang PAYROLL/kpi
database\migration_v891.sql    -- v9.46: PhieuBanHang.NguoiSuaID + UpdatedAt (ai sửa/hủy, lúc nào)
database\migration_v892.sql    -- v9.55 (14/11, §18): 3 bảng mới (HopDongChuyenCan, NgayLeChung, PhieuNghi),
                               --        BangLuongChiTiet.SoKhongPhep, nới CHECK KieuThuong thêm 'ChuyenCan',
                               --        ChucNang PAYROLL/nghiphep (v9.57: tab "Tạo giấy nghỉ phép / Nghỉ cá nhân")
database\migration_v893.sql    -- v9.61 (14/11, §22): HỢP ĐỒNG MUA BÁN + KÝ ĐIỆN TỬ — 8 bảng mới (MauHopDongMB(+LichSu),
                               --        HopDongMB, HopDongMBHang, HopDongMBBenKy, HopDongMBLink, HopDongMBOTP, HopDongMBNhatKy),
                               --        KhachHang +9 cột, Module HOPDONG + 4 ChucNang (kyso MacDinhCho=0), mẫu HDMB_CHUAN
database\migration_v894.sql    -- v9.62 (14/11, §23): HopDongMB +5 cột (LoaiVanBan HopDong|PhuLuc|ThanhLy, HopDongChaID,
                               --        SoHoaDon, NgayHoaDon, NhacLanCuoi), HopDongMBBenKy +3 (KyTuXaNha, KyTuXaUserId, ChuoiTinCay),
                               --        2 mẫu PHULUC_CHUAN / THANHLY_CHUAN. CHẶN (RAISERROR) nếu chưa chạy v893.
database\migration_v895.sql    -- v9.67 (16/11, §27): DonHangSanXuat.NhanVienMayMauID (FK NhanVien), bảng SanLuongTheoLenh
                               --        (lệnh + người + tên SP + SL + ngày; Nguon MayMau|Tay), ChucNang QLSX/sanluong + MYPAY/sanluongcuatoi
                               --        (cả hai MacDinhCho = 0 — phải tick). Độc lập v892–v894.
database\migration_v896.sql    -- v9.70 (16/11, §30): bảng CongTacVien (đơn giá thiết kế / lệnh), DonHangSanXuat.CongTacVienID (FK),
                               --        ChucNang DANHMUC/congtacvien + PAYROLL/luongctv. Độc lập.
database\migration_v897.sql    -- v9.71 (16/11, §31): Users.PhaiDoiMatKhau (user tạo không mật khẩu ⇒ bắt đổi lần đầu). Độc lập.
database\migration_v898.sql    -- v9.72 (17/11, §32): HopDongChuyenCan.SoNgayNghiToiDa (chuyên cần theo số ngày nghỉ). Sau v892.
database\migration_v899.sql    -- v9.73 (17/11, §33): KieuThuong NVARCHAR(50) + bỏ CHECK (nhiều kiểu thưởng); BLCT.KieuThuong 50;
                               --        PhieuNghi.NuaNgay (nghỉ ½ ngày). Sau v890 + v892.
database\migration_v900.sql    -- v9.74 (17/11, §34): HopDongLaoDong.ChuyenCanTinhCN (chuyên cần có đếm CN không, mặc định 1). Độc lập.
database\migration_v901.sql    -- v9.75 (17/11, §35): HÀNG KÝ GỬI — 4 bảng PhieuKyGui*/PhieuKyGuiTra*, PhieuBanHangChiTiet.KyGuiCTID,
                               --        KhachHang.PhanTramCKKyGui, ChucNang KHOHANG/kygui. Độc lập. 🔴 TRƯỚC pm2 restart (crudFactory khách hàng).
database\migration_v902.sql    -- v9.76 (17/11, §36): DonHangSanXuat.MayMauTenSP (sản phẩm may mẫu chọn theo danh mục hợp đồng). Sau v895.
database\migration_v903.sql    -- v9.77 (19/11, §37): NhomKhachHang + KhachHang.NhomKhachHangID + ChucNang DANHMUC/nhomkhachhang. Độc lập.
database\migration_v904.sql    -- v9.78 (19/11, §38): CauHinhLuong.XangXeDonGiaKm + HopDongLaoDong.SoKmDiLam (2 cột để đó, v9.79 không đọc). Sau v890.
database\migration_v905.sql    -- v9.81 (19/11, §39): SanLuongTheoLenh.DonHangID cho NULL + cột MaHangCu + CHECK (làm lại mã cũ). Sau v895.
⛔ database\migration_v906.sql -- v9.82 (19/11): SoSizeRi — HẾT HIỆU LỰC NGAY TRONG NGÀY (v9.85 dùng HeSoQuyDoi sẵn có). KHÔNG CHẠY.
```

🔴 **CHỐT (v9.79, 19/11):** xăng = `HopDongLaoDong.PhuCapXangXe` (**đ/NGÀY**) × ngày công đi làm thực tế — công thức duy nhất. Cách tính theo km của v9.78 đã bỏ; hai cột của `migration_v904` để nguyên, không đọc (vẫn chạy migration cho khớp CSDL, không cần migration mới).

🔴 Vì cột `PhuCapXangXe` lại được dùng để tính: `database\sua_phu_cap_xang_xe_theo_ngay_v972.sql` **LẠI CẦN CHẠY** (hợp đồng cũ ghi SỐ THÁNG ⇒ 540.000 × 27 = 14,58 triệu/người). KHỐI A xem trước → gửi kết quả → "proceed" → KHỐI B. Bảng lương có dòng đỏ "TRẢ THỪA" réo tên mọi hợp đồng còn ≥ 100.000 đ/ngày.

Cả năm đều chạy lại được nhiều lần không sao (`IF COL_LENGTH(...) IS NULL`). v887–v891 anh đã chạy (12/11); **còn v892** (đợt v9.55), **v893 rồi v894** (đúng thứ tự — v894 tự chặn nếu v893 chưa chạy), **v895** (v9.67, không phụ thuộc v893/v894 nhưng cần v890 — bảng `HopDongSanPham`). Chạy xong: `cd database && node tao_file_cai_dat.js` để gộp vào `CAI_DAT_DAY_DU.sql` ([i/N] đổi, bộ kiểm không ghim số).

⚠️ v894: cột được dò **một lần rồi đệm** (`hopDongCore.coV894`) — chạy migration SAU khi máy chủ đã lên thì phải `pm2 restart` mới thấy phụ lục / hóa đơn / nhắc hạn. Chưa chạy v894 thì phân hệ vẫn chạy như v9.61 (màn Cấu hình ký báo đỏ "Chưa chạy migration_v894").

⚠️ v890: cột mới được dò **mỗi lần gọi** (không cache) nên thứ tự migration/restart không gây lệch số. Tab **Đánh giá KPI** hiện cho mọi người có quyền PAYROLL ngay sau khi copy JS (dòng `ChucNang PAYROLL/kpi` chỉ để **Quản trị → Phân quyền** có thể *cấm* riêng tab này cho ai đó).

Kiểm sau khi chạy:

```
node backend\utils\kiem_cot_migration.js
```

⚠️ Bộ kiểm này đọc cấu hình CSDL của chính phần mềm. Bản đầu tôi **đoán nhầm tên 2 bảng** và nó báo "THIẾU CỘT" rất thuyết phục — suýt đẩy anh đi sửa lược đồ production. Nay tên bảng chép từ `ALTER TABLE` trong file migration. **Vẫn vậy: nó báo thiếu cột thì gửi tôi, đừng tự `ALTER`.**

---

## 3. Deploy

1. Copy các file đã đổi từ `C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo` sang `D:\QLSX` (giữ nguyên cấu trúc thư mục).
2. Nhớ file **mới hoàn toàn** — dễ quên nhất:
   - `backend\utils\saoLuuCSDL.js`
   - `backend\utils\lichSaoLuu.js`
   - `backend\utils\canhBaoSaoLuu.js`
   - `backend\routes\saoluu.js`
   - `frontend\js\module.saoluu.js`
   - **v9.45:** `backend\utils\luongCongNhat.js` (bộ tính mới — thiếu file này `payroll.js` nổ ngay lúc `require`, máy chủ không lên), `database\migration_v890.sql`
   - v9.45 sửa: `backend\routes\payroll.js`, `backend\routes\hrm.js`, `frontend\js\module.payroll.js`, `frontend\js\module.hrm.js`, `frontend\js\module.mypay.js` (phiếu lương nhân viên tự xem — rà chéo bắt được in cứng "−thuế")
   - v9.46: `database\migration_v891.sql` (mới), `backend\routes\banhang.js`, `frontend\js\module.khohang.js`
   - v9.47: `frontend\js\common.js` (bump `?v=9.47` trong index.html — PWA sẽ tự nạp lại)
   - v9.49: `backend\utils\lichChamCong.js` (MỚI), `backend\routes\payroll.js`, `backend\server.js`, `frontend\js\module.payroll.js` (§13)
   - v9.50: `frontend\js\common.js` (bump `?v=9.50`; §14)
   - v9.51: `backend\routes\khohang.js` (route `PUT /items/:id/mavach` — cần `pm2 restart`), `frontend\js\module.khohang.js` (bump `?v=9.51`, gồm cả v9.50 — §15)
   - 14/11 (từ lần chạy đủ bộ kiểm, §0 bước 2b): `backend\routes\congno.js` — ô chọn nhân viên ở phiếu chi lọc cùng luật với route tính lương v9.45 (NULL = đang làm)
   - v9.52 (§16): `backend\routes\users.js`, `backend\utils\luongGiaCongInThe.js`, `frontend\js\module.payroll.js` (9.52), `frontend\js\module.users.js` (9.52), `frontend\js\module.congno.js` (9.52)
   - **v9.53 (§17):** `backend\utils\bangLuongTuDong.js` (**MỚI** — thiếu file này `payroll.js`, `hrm.js`, `congno.js` nổ ngay lúc `require`, máy chủ không lên), `backend\routes\payroll.js`, `backend\routes\hrm.js`, `backend\routes\congno.js`, `frontend\js\module.payroll.js` (9.53), `frontend\js\module.mypay.js` (9.53). Không migration (cờ ghi vào bảng `CauHinh` có sẵn).
   - **v9.54 (§17.2):** `backend\routes\payroll.js` (route bỏ chốt), `frontend\js\module.payroll.js`.
   - **v9.55 (§18):** `backend\utils\nghiPhep.js` (**MỚI** — `payroll.js` require lúc nạp, thiếu là máy chủ không lên), `backend\utils\luongCongNhat.js`, `backend\routes\payroll.js`, `backend\routes\hrm.js`, `frontend\js\module.payroll.js` (9.55), `frontend\js\module.hrm.js` (9.55), `frontend\js\module.mypay.js` (9.55), `database\migration_v892.sql` (MỚI — chạy trước restart).
   - **v9.56 (§19):** `frontend\js\module.khohang.js` (9.56 — gồm cả v9.50/v9.51).
   - **v9.57 (§18.2):** `backend\routes\payroll.js`, `frontend\js\module.payroll.js`, `database\migration_v892.sql` (thêm dòng ChucNang — chạy lại được), `backend\utils\kiem_o_tim_moi_danh_sach.js` (payroll 8 chỗ gọi).
   - **v9.58 (§18.2/§18.3):** `backend\routes\payroll.js`, `backend\utils\luongCongNhat.js`, `frontend\js\module.payroll.js` (**9.58**) — giấy nghỉ in không đầu trang chung (anh gửi ảnh 14/11); tooltip liệt kê ngày không phép.
   - **v9.59 (§20):** `backend\utils\loadUserContext.js` (luật MYPAY theo nhân viên — cần `pm2 restart`), `backend\routes\users.js` (danh sách trả `NhanVienID`), `frontend\js\module.users.js` (**9.59**). Không migration.
   - **v9.60 (§21):** `backend\routes\payroll.js` (route `GET /luongtraivaicat/cuatoi` MỚI + `/luongmay/cuatoi` trả bộ phận — `pm2 restart`), `frontend\js\module.payroll.js` (**9.60**), `frontend\js\module.mypay.js` (**9.60**). Không migration.
   - **v9.61 (§22) — PHÂN HỆ MỚI, nhiều file:** MỚI `backend\routes\hopdong.js`, `backend\routes\publicKy.js`, `backend\utils\hopDongCore.js`, `hopDongPdf.js`, `kySoPdf.js`, `kiemChuKySo.js`, `guiOtp.js`, `nhatKyHopDong.js`, `thu_ky_so.js`, `kiem_hop_dong_ky_dien_tu.js`; `frontend\js\module.hopdong.js`, `frontend\js\ky.js`, `frontend\js\kysoclient.js`, `frontend\ky.html`, `frontend\tools\MoynKySo\index.html` (+ `MoynKySo.exe` anh build từ `tools\MoynKySo\`); SỬA `backend\server.js` (**mount route + danh sách trắng cổng công khai**), `backend\routes\hrm.js` (2 dòng cuối), `frontend\js\app.js` (**9.61**), `frontend\index.html`, `backend\.env.example`; `database\migration_v893.sql`. 🔴 `npm install` trong `backend\` TRƯỚC `pm2 restart` (thiếu `pdf-lib`/`pkijs`… thì route ký nổ lúc gọi; `server.js` vẫn lên).
   - **v9.62 (§23) — giai đoạn 2:** MỚI `backend\utils\kyTuXa.js`, `backend\utils\chuoiTinCay.js`, `backend\utils\nhacHanKy.js` (**`server.js` + `hopdong.js` require lúc nạp — thiếu một file là máy chủ KHÔNG lên**), `backend\utils\kiem_hop_dong_gd2.js`, `database\migration_v894.sql`, thư mục `backend\chungthu_goc\` (tự tạo khi chạy, chép .cer CA gốc vào); SỬA `backend\server.js` (dòng đặt lịch nhắc hạn), `backend\routes\hopdong.js`, `backend\routes\publicKy.js`, `backend\utils\hopDongCore.js`, `backend\utils\hopDongPdf.js`, `backend\utils\kiem_hop_dong_ky_dien_tu.js` (bỏ ghim `?v=`), `frontend\js\module.hopdong.js` (**9.62**), `frontend\js\ky.js` (**9.62** — bump trong `frontend\ky.html`, KHÔNG phải index.html), `frontend\js\kysoclient.js` (**9.62**, bump ở CẢ `index.html` và `ky.html` — báo đúng câu khi công cụ từ chối origin), `frontend\ky.html`, `frontend\index.html`, `backend\.env.example` (mục KYTUXA_*), `backend\package.json` (+8 thư viện v9.61 — `npm install` là đủ), `tools\MoynKySo\Program.cs` (**v1.0.1**: nhận mọi origin mạng nội bộ + `origins.txt`; cửa sổ xác nhận ghi trang nào gọi — build lại .exe). Hướng dẫn cấu hình: `docs\HUONG_DAN_CAU_HINH_KY.md`.
   - **v9.63 (§24) — doanh thu thuần dashboard = báo cáo:** `backend\routes\baocao.js`, `backend\routes\dashboard.js` (`pm2 restart`), `frontend\js\module.baocao.js` (**9.63**), `frontend\js\module.dashboard.js` (**9.63**), `backend\utils\kiem_doanh_thu_thuan_dashboard_bao_cao.js` (MỚI). Không migration.
   - **v9.65 (§25) — xem năm trước + công nợ tính đến ngày:** `backend\routes\congno.js` (`pm2 restart`), `frontend\js\module.congno.js` (**9.65**), `frontend\js\module.baocao.js` (**9.65**), `frontend\js\module.dashboard.js` (**9.65**), `frontend\js\module.hoadon.js` (**9.65**), `frontend\index.html`, `backend\utils\kiem_xem_nam_truoc.js` (MỚI), `backend\utils\kiem_phieu_thu_ncc.js` (bỏ ghim chữ ký hàm). Không migration.
   - **v9.66 (§26) — loại nhập "Tồn đầu kỳ / nhập khác" không vào công nợ NCC:** `backend\routes\nhapkho.js`, `backend\utils\giaNhapHangHoa.js`, `backend\routes\baocao.js` (1 nhãn) (`pm2 restart`), `frontend\js\module.nhapkho.js` (**9.66**), `frontend\js\module.khovai.js` (**9.66** — chỉ nhãn ô NCC phiếu nhập vải), `frontend\index.html`, `backend\utils\kiem_ton_dau_ky_khong_cong_no.js` (MỚI), `kiem_gia_nhap_ma_hang.js` / `kiem_xoa_phieu_va_nguon_hang.js` / `kiem_lenh_sx_o_phieu_nhap.js` (bỏ ghim). Không migration (cột `LoaiNhap` không có CHECK). Sửa dữ liệu cũ (tùy chọn, SSMS, mặc định ROLLBACK): `database\sua_phieu_ton_dau_ky_v966.sql` (hàng hóa) + `database\sua_phieu_ton_dau_ky_vai_pk_v966.sql` (vải + phụ kiện).
   - **v9.67 (§27) — sản lượng theo lệnh ⇒ thưởng sản phẩm tự động:** `database\migration_v895.sql` (TRƯỚC restart), `backend\utils\sanLuongTheoLenh.js` (MỚI), `backend\routes\qlsx.js`, `backend\routes\payroll.js` (`pm2 restart`), `frontend\js\module.qlsx.js` (**9.67**), `frontend\js\module.payroll.js` (**9.67**), `frontend\js\module.hrm.js` (**9.67**, chỉ dòng gợi ý), `frontend\js\module.mypay.js` (**9.67**, mục tự ghi), `frontend\index.html`, `backend\utils\kiem_san_luong_theo_lenh.js` (MỚI).
   - **v9.78 (§38) — xăng theo km + mã rập ở list lệnh + vòng tròn theo nhóm:** `database\migration_v904.sql` (TRƯỚC restart), `backend\utils\luongCongNhat.js`, `backend\routes\payroll.js`, `backend\routes\hrm.js`, `backend\routes\qlsx.js` (`pm2 restart`), `frontend\js\module.hrm.js` (**9.78**), `module.payroll.js` (**9.78**), `module.mypay.js` (**9.78**), `module.qlsx.js` (**9.78**), `module.dashboard.js` (**9.78**), `frontend\index.html`. Sau restart: khai **Tiền xăng hỗ trợ (đ/km)** ở Cấu hình lương rồi khai **Số km** cho từng hợp đồng.
   - **v9.77 (§37) — nhóm khách hàng + dashboard theo nhóm:** `database\migration_v903.sql` (TRƯỚC restart — tab mới cần dòng ChucNang), `backend\routes\danhmuc.js`, `backend\routes\dashboard.js` (`pm2 restart`), `frontend\js\module.danhmuc.js` (**9.77**), `frontend\js\module.dashboard.js` (**9.77**), `frontend\index.html`, `backend\utils\kiem_nhom_khach_hang.js` (MỚI). Sau restart: Quản trị → Phân quyền tick **DANHMUC/nhomkhachhang** cho nhóm cần dùng (Admin thấy sẵn).
   - **v9.76 (§36) — sản phẩm may mẫu theo danh mục hợp đồng:** `database\migration_v902.sql` (TRƯỚC restart), `backend\utils\sanLuongTheoLenh.js`, `backend\routes\qlsx.js` (`pm2 restart`), `frontend\js\module.qlsx.js` (**9.76**), `frontend\index.html`.
   - **v9.75 (§35) — hàng ký gửi:** `database\migration_v901.sql` (TRƯỚC restart — bắt buộc, crudFactory khách hàng), `backend\utils\kyGuiDangGiu.js` (**MỚI**), `backend\routes\kygui.js` (**MỚI**), `backend\routes\banhang.js`, `backend\routes\danhmuc.js`, `backend\server.js` (`pm2 restart`), `frontend\js\module.kygui.js` (**MỚI**), `frontend\js\module.khohang.js` (**9.75**), `frontend\js\module.danhmuc.js` (**9.75**), `frontend\index.html`, `backend\utils\kiem_hang_ky_gui.js` (MỚI).
   - **v9.74 (§34) — chuyên cần theo ngày nghỉ: tích/bỏ tích "Tính cả chủ nhật":** `database\migration_v900.sql` (TRƯỚC restart), `backend\routes\payroll.js`, `backend\routes\hrm.js` (`pm2 restart`), `frontend\js\module.hrm.js` (**9.74**), `frontend\index.html`.
   - **v9.73 (§33) — nhiều kiểu thưởng; bậc chuyên cần không lưu (báo lỗi rõ); nghỉ ½ ngày; bản in Lương CTV có ảnh:** `database\migration_v899.sql` (TRƯỚC restart), `backend\utils\kieuThuong.js` (**MỚI** — `luongCongNhat.js`, `payroll.js`, `hrm.js`, `qlsx.js` require lúc nạp, thiếu là máy chủ không lên), `backend\utils\luongCongNhat.js`, `backend\utils\nghiPhep.js`, `backend\routes\payroll.js`, `backend\routes\hrm.js`, `backend\routes\qlsx.js` (`pm2 restart`), `frontend\js\module.hrm.js` (**9.73**), `frontend\js\module.payroll.js` (**9.73**), `frontend\js\module.mypay.js` (**9.73**), `frontend\js\module.qlsx.js` (**9.73**), `frontend\index.html`.
   - **v9.72 (§32) — xăng xe đ/ngày; chuyên cần theo số ngày nghỉ; Lương CTV có ảnh:** `database\migration_v898.sql` (TRƯỚC restart), `database\sua_phu_cap_xang_xe_theo_ngay_v972.sql` (dữ liệu, chờ proceed), `backend\utils\luongCongNhat.js`, `backend\utils\anhLenhSX.js` (MỚI), `backend\routes\payroll.js`, `backend\routes\hrm.js`, `backend\routes\qlsx.js` (`pm2 restart`), `frontend\js\module.hrm.js` (**9.72**), `frontend\js\module.payroll.js` (**9.72**), `frontend\index.html`.
   - **v9.71 (§30 mục 3 + §31) — lương CTV theo MÃ RẬP; user không mật khẩu bắt đổi lần đầu:** `database\migration_v897.sql`, `backend\routes\payroll.js`, `backend\routes\users.js`, `backend\routes\auth.js`, `backend\utils\loadUserContext.js` (`pm2 restart`), `frontend\js\module.payroll.js` (**9.71**), `frontend\js\app.js` (**9.71**), `frontend\js\module.users.js` (**9.71**), `frontend\index.html`.
   - **v9.70 (§30) — cộng tác viên thiết kế + lệnh đã ghi sản lượng không hiện lại:** `database\migration_v896.sql` (TRƯỚC restart), `backend\routes\qlsx.js`, `backend\routes\payroll.js`, `backend\routes\danhmuc.js` (`pm2 restart`), `frontend\js\module.qlsx.js` (**9.70**), `module.payroll.js` (**9.70**), `module.danhmuc.js` (**9.70**), `module.mypay.js` (**9.70**), `frontend\index.html`, `backend\utils\kiem_cong_tac_vien_thiet_ke.js` (MỚI).
   - **v9.69 (§29) — chấm công bên cạnh Bảng lương của tôi:** `backend\routes\payroll.js` (`pm2 restart`), `frontend\js\module.mypay.js` (**9.69**), `frontend\index.html`, `backend\utils\kiem_mypay_cham_cong_cua_toi.js` (MỚI). Không migration.
   - **v9.68 (§28) — bỏ ô công chuẩn xăng xe / ăn trưa trên HĐ:** `backend\utils\luongCongNhat.js` (`pm2 restart`), `frontend\js\module.hrm.js` (**9.68**), `frontend\index.html`, `kiem_luong_cong_nhat_v945.js` + `kiem_dieu_khoan_thuong_hop_dong.js` (thêm phép). Không migration.
3. `frontend\index.html` — bắt buộc copy, nếu không trình duyệt vẫn chạy JS cũ.
4. `pm2 restart` (sau migration).
5. `pm2 logs` — tìm dòng `[saoluu] Lịch: ...`. Không thấy dòng đó là lịch chưa chạy.

> ⚠️ Máy chủ chạy dưới tài khoản Windows **Admin** (`C:\Users\Admin\.pm2`), không phải QUAN. Đường dẫn `C:\Users\QUAN\...` không dùng được trong PowerShell trên máy đó.
>
> ⚠️ `findstr` **nói dối** trên `backend\routes\hrm.js` (có byte điều khiển ở comment chết dòng 603-610 từ v8.85). Kiểm file đó đã copy chưa bằng **kích thước + ngày sửa**, đừng dùng `findstr`.

---

## 4. Nghiệm thu — sao lưu CSDL (v9.37 → v9.40)

Đây là phần anh vừa vấp sáng nay nên để trước.

### 4.1 Tìm phân hệ

Menu trái phải có **💾 Sao lưu dữ liệu** (biểu tượng đĩa mềm). Chỉ tài khoản Admin thấy — cố ý: file `.bak` chứa **toàn bộ dữ liệu công ty**.

### 4.2 Chọn thư mục — điều đã làm hỏng lần thử sáng nay

🔴 **`G:\BackupQLNoiBo` (Google Drive) KHÔNG dùng được làm thư mục sao lưu chính, và không có cách nào sửa được điều đó.**

Lý do: ổ Google Drive (cũng như OneDrive, Dropbox, ổ ánh xạ mạng) được gắn vào **phiên đăng nhập của anh**. Dịch vụ SQL Server chạy ở phiên khác, dưới tài khoản khác — với nó ký tự ổ `G:` **không tồn tại**. Cấp quyền thư mục bao nhiêu cũng vô ích. Lỗi `BACKUP DATABASE is terminating abnormally` anh nhận được là **câu tổng kết cuối cùng** của SQL Server, không phải lý do; lý do thật (Msg 3201) bị driver vứt đi — nay đã sửa, phần mềm gom đủ cả hai.

Cách làm đúng, đã cài sẵn:

| Ô | Điền | Ai ghi |
|---|---|---|
| **Thư mục lưu \*** | `D:\BackupQLNoiBo` | SQL Server |
| **Bản sao thứ hai** | `G:\BackupQLNoiBo` | phần mềm (Node) chép sang sau khi đã xác minh |

Danh sách ổ trên màn hình nay đánh dấu **🚫 SQL không ghi được** cho đúng những ổ kiểu này, và bấm vào chúng sẽ điền vào ô **Bản sao thứ hai**, không phải ô chính.

### 4.3 Chạy thử

1. Điền hai ô như trên, đặt **Giữ lại 30 ngày**, **Bản sao thứ hai giữ 30 ngày**.
2. Bấm **Kiểm tra thư mục**. Phải ra **hai dòng xanh**:
   - `SQL Server GHI ĐƯỢC vào D:\BackupQLNoiBo...`
   - `Bản sao thứ hai: Phần mềm GHI ĐƯỢC vào G:\BackupQLNoiBo...`
   - Đỏ thì **đọc nguyên câu** — nó nói thẳng phải làm gì và nêu đúng tên tài khoản dịch vụ SQL (đọc từ chính SQL Server, không phải đoán).
3. Bấm **Lưu cấu hình**. Toast phải nói *"Lịch chạy lúc 01:15 mỗi ngày"*. Nói *"Lịch KHÔNG chạy"* thì đọc lý do kèm theo.
4. Bấm **Sao lưu ngay**.
   - Nếu trình duyệt báo hết giờ chờ, **đừng đóng trang** — phần mềm sẽ tự hỏi lại máy chủ 15 giây một lần tới 10 phút rồi báo kết quả thật. (Sao lưu vẫn chạy tiếp ở máy chủ sau khi trình duyệt bỏ cuộc; bản cũ báo "thất bại" ở đây là **nói sai**.)
5. Kiểm bằng mắt:
   - `D:\BackupQLNoiBo\QLNoiBo_20261110_HHMM.bak` — có file, kích thước vài chục MB.
   - `G:\BackupQLNoiBo\` — có **đúng một file cùng tên**, và **không có** file nào tên bắt đầu bằng `~dangchep_`.
   - Màn hình: ô to màu xanh *"Bản sao lưu dùng được gần nhất"* hiện giờ vừa rồi.
6. Bấm **Tải về** ở một bản — file tải được.

### 4.4 Đọc kỹ phần cảnh báo đỏ trên đầu màn hình

Màn hình nay tự nêu các vấn đề sau nếu có. **Đọc hết, đừng bỏ qua:**

- 🔴 **Lịch tự động không chạy** — kèm lý do cụ thể. Trước đây ô tick "Chạy tự động" chỉ phản ánh **ý muốn đã lưu**, không phản ánh thực tế; lịch có thể chết câm mà ô vẫn xanh.
- 🔴 **Bản sao ngoài máy hỏng** — sao lưu vào máy vẫn tốt, nhưng mất tuyến phòng thủ ngoài máy.
- ⚠️ **Chưa cấu hình SMTP** → cảnh báo **chỉ hiện trên màn hình, không có email nào được gửi**. Ô "Email báo khi hỏng" lưu được, hiện được, mà không ai đọc — trước v9.40 đúng là như vậy, nay đã sửa nhưng vẫn cần `SMTP_HOST` trong `backend\.env`.
- ⚠️ **Thư mục sao lưu cùng ổ với file CSDL** — `D:` đang chứa `QLNoiBo1.ndf`, nên cảnh báo này **sẽ hiện** với cấu hình ở §4.2. Đó là lý do bản trên Google Drive là tuyến phòng thủ chính.

### 4.5 Sao lưu transaction log (v9.41) — Nguyen đã chốt giữ FULL recovery

**Trước khi bật, chạy câu này trên máy chủ:**

```sql
SELECT name, size*8/1024 AS MB, log_reuse_wait_desc
FROM sys.database_files;
```

```powershell
Get-PSDrive C,D | Select-Object Name, @{n='TrongGB';e={[math]::Round($_.Free/1GB,1)}}
```

🔴 **Nếu ổ D: còn dưới ~5 GB thì ĐỪNG bật.** Giữ 30 ngày log ở chu kỳ 1 giờ nghĩa là tới **720 file `.trn`** cộng 30 bản `.bak` — trên chính ổ đang chứa file CSDL. Ổ đầy là vòng lặp chết: `BACKUP LOG` hỏng → log không được cắt → `.ldf` phình → đầy nốt ổ chứa CSDL → **SQL Server ngừng nhận ghi → cả xưởng dừng**. Phần mềm có chặn (sàn 2 GB) nhưng chặn xong thì log vẫn không được cắt.

Nếu `log_reuse_wait_desc` ra gì khác `NOTHING` / `LOG_BACKUP` thì gửi tôi — có thứ khác đang giữ log, sao lưu log sẽ không cắt được.

**Bật thế nào:** màn hình Sao lưu → tick **Sao lưu transaction log** → chọn chu kỳ (mặc định 1 giờ) → **Lưu cấu hình** → bấm **📝 Sao lưu log ngay** một lần để thử.

**Nghiệm thu:**

1. Có file `QLNoiBo_LOG_20261110_HHMMSS.trn` trong `D:\BackupQLNoiBo` và trong `G:\BackupQLNoiBo`.
2. Màn hình hiện mục **"Bản sao lưu log gần đây"** với dòng **"Log đang dùng X% của 136 MB"**.
3. Sau vài lần chạy, `X%` phải **giảm** và ở mức thấp. Đó là bằng chứng log thực sự được cắt.
4. 🔴 **File `.ldf` vẫn 136 MB** — đúng như vậy, không phải lỗi. `BACKUP LOG` giải phóng chỗ *bên trong* file, không thu nhỏ file. Nó đã **thôi phình**, đó là mục tiêu. Muốn lấy lại 136 MB trên ổ thì phải `DBCC SHRINKFILE` một lần — thao tác riêng, làm phân mảnh chỉ mục, **nói tôi trước khi làm**.
5. Khối trên cùng màn hình đổi từ *"mất nhiều nhất 14 giờ"* thành *"mất nhiều nhất 1 giờ"*.

### 4.6 Tự xóa bản cũ nhất khi ổ sắp đầy (v9.44)

Anh yêu cầu: *"khi còn 5 GB thì xóa file cũ nhất để lưu file mới, có chỗ cài đặt"*. Ô **Giữ trống ổ đích (GB)** trong Cấu hình, mặc định 5.

Luật chạy, đọc kỹ vì nó **xóa file sao lưu**:

| | |
|---|---|
| Khi nào xóa | Trước mỗi lần sao lưu, nếu ổ đích còn **dưới ngưỡng** (hoặc không đủ chỗ cho bản mới) |
| Xóa gì, thứ tự | ① file `.HONG` (đã biết hỏng) → ② bản log vô dụng → ③ bản **đầy đủ cũ nhất**, kéo theo log của nó |
| Xóa bao nhiêu | Tới khi lên lại ngưỡng, nhưng **tối đa 3 bản đầy đủ mỗi lần chạy** |
| Không bao giờ | Xóa xuống dưới **"Luôn giữ ít nhất"** (3 bản) — lưới an toàn cuối, không nới |
| Sao lưu **log** | **Không được xóa bản đầy đủ** — chỉ dọn log vô dụng. Lịch log chạy mỗi giờ; để nó xóa bản đầy đủ là vài giờ mất hết |
| Xóa xong vẫn thiếu | Đủ chỗ cho bản mới thì **vẫn ghi**, kèm cảnh báo. Không đủ thì từ chối và nói rõ |
| Báo | **Email mỗi lần có xóa** — thao tác không đảo ngược mà im lặng là sai |

🔴 **Vì sao giới hạn 3 bản/lần**: rà soát chéo chỉ ra bản đầu không giới hạn — ổ tụt sâu một đêm (vì file `.ldf` phình chẳng hạn) là xóa sạch 27 bản **rồi vẫn từ chối**, hủy toàn bộ lịch sử mà không đổi lại được gì. Giờ lịch sử mòn 3 bản/đêm, có email, nhìn thấy được — đủ thời gian để anh đi tìm thứ thật sự đang ăn ổ.

**Nghiệm thu:** đặt ngưỡng tạm **thật cao** (ví dụ 500 GB — chắc chắn ổ D: đang dưới) → Lưu → **Sao lưu ngay** → dòng kết quả phải có *"đã xóa N bản đầy đủ cũ nhất … để lấy chỗ"* với N ≤ 3, và email tới. Rồi **đặt lại 5 GB**. Đừng quên bước cuối.

**Hai điều phải biết để không tự phá:**

- 🔴 **Đừng xóa tay file `.trn`.** Chúng là một **chuỗi liên tục**: xóa một file ở giữa làm mất khả năng khôi phục của *tất cả* các mốc sau nó, và không có dấu hiệu nào nhìn thấy được cho tới đúng lúc cần. Phần mềm tự quyết hạn giữ (chỉ xóa bản cũ hơn bản `.bak` cũ nhất còn giữ) — vì thế màn hình **không có ô** để gõ số ngày giữ log.
- Khôi phục về **đúng một thời điểm**: phục hồi bản `.bak` `WITH NORECOVERY`, rồi lần lượt các `.trn` sau nó theo đúng thứ tự, bản cuối dùng `WITH STOPAT`. Chỉ cần quay về mốc 01:15 thì **một mình file `.bak` là đủ**, không cần `.trn` nào.

---

## 5. Nghiệm thu — tách dải size + tỷ lệ vải (v9.38 → v9.39)

### 5.1 Nút nằm ở đâu

| Công đoạn | Nút hiện |
|---|---|
| **Kỹ thuật** | 📏 Tách dải size |
| **Cắt** | 🧩 Tách mẫu |
| Công đoạn khác | không nút, nhưng **vẫn thấy tóm tắt** dải/mẫu |

Đúng như anh chốt: *"chỉ tách dải size ở công đoạn kỹ thuật, còn tách mẫu vẫn ở công đoạn cắt"*.

### 5.2 Cột tỷ lệ vải

Mở **Kỹ thuật → Tách dải size**. Bảng có hai cột mới: **Tỷ lệ vải** (gõ tay) và **= %** (tự tính).

Kiểm:

1. Gõ `0.8` và `1.2` → cột `= %` ra **40,0%** và **60,0%**.
2. Xóa đi, gõ `40` và `60` → vẫn ra **40,0%** và **60,0%**. (Đơn vị tự do — hệ thống chỉ lấy tỷ lệ.)
3. Xóa trắng **một** dải → cả hai dòng về `—`, và dòng chữ dưới bảng chuyển sang màu cam. Cố ý: khuyết một dải thì không bịa tỷ lệ nửa vời.
4. **Lưu**, đóng, **mở lại** → hai số vẫn còn nguyên.

🔴 **Bước 4 là bước quan trọng nhất.** Rà soát chéo bắt được lỗi: backend **vứt sạch** `tyLeVai` trước khi ghi, nên nó luôn lưu NULL — và câu `UPDATE` còn **đè NULL lên số đã khai trước đó**, nghĩa là chỉ cần mở hộp thoại sửa tên dải là mất sạch tỷ lệ, im lặng. Đã sửa, nhưng phải tự mắt kiểm.

5. Mở **Cắt → Tách mẫu** → **không có** hai cột đó. Đúng: các mẫu dùng chung một dải size nên tỷ lệ vải của chúng bằng nhau theo định nghĩa.

### 5.2b Hệ số ở sổ cắt nay ĐIỀN SẴN từ tách dải (v9.42)

Tổ cắt **không phải gõ** hệ số nữa — ô tự điền:

| Lệnh | Ô hệ số điền sẵn |
|---|---|
| Tách dải `2-7` (6) + `8-12` (5) | **11** — một lớp cắt ra cả ri gồm mọi dải |
| Tách mẫu (mỗi mẫu 6) | **6** — các mẫu chung một dải size, không cộng dồn |
| Không tách | hệ số ở Ra lệnh SX, y như trước |

🔴 **Ô vẫn sửa được, cố ý.** Tách dải là kế hoạch, sổ cắt là cái đã xảy ra. Khóa cứng thì khi ri thật khác kế hoạch sẽ không còn chỗ nào khai đúng, và sai đó chảy thẳng vào lương cắt lẫn giá thành mà không ai thấy.

Gõ số khác tổng dải thì hiện chữ đỏ ngay dưới ô: *"Lệch với tách dải size: 11. Kiểm lại — nhiều khả năng gõ nhầm."* Chỉ cảnh báo, không chặn.

**Nghiệm thu — làm ở CẢ HAI màn, đây là chỗ tôi suýt bỏ sót:**

1. **Ghi tiến độ → Cắt** → thêm một cây → ô Hệ số phải hiện sẵn **11** (không phải hệ số ở Ra lệnh SX).
2. **Sửa sổ cắt** (nút Sửa ở một sổ cắt cũ) → dòng cũ giữ **nguyên hệ số đã lưu**, dòng **thêm mới** hiện **11**.
3. Gõ 12 vào một dòng → chữ đỏ hiện ngay; xóa về 11 → chữ đỏ biến mất.
4. Lưu rồi mở lại → số không bị nhảy.

🔴 **Trước khi deploy, xác nhận hai điều** (nếu không, lệnh tách MẪU sẽ bị cộng dồn và **SL cái gấp đôi** — sai thẳng vào lương cắt):

```sql
SELECT COL_LENGTH('DonHangDaiSize','LoaiTach') AS CoCot;   -- phải KHÁC NULL
```

và **pm2 đã restart SAU khi chạy migration_v885**. Phần mềm nhớ kết quả dò cột vĩnh viễn trong một lần chạy, nên chạy migration mà không restart thì nó vẫn tưởng cột chưa có.

### 5.3 🔴 Phải nói rõ: tỷ lệ này CHƯA vào giá thành

Hiện tại `tinhGiaThanh()` vẫn gộp toàn bộ tiền vải của lệnh rồi chia cho số lượng hoàn thành — ra **một con số chung**, giống hệt trước v9.38. Cột `TyLeVai` **đã được lưu nhưng chưa được dùng**.

Bản đầu của tôi viết trên màn hình *"giá thành chia vải theo tỷ lệ trên"* — **sai**, hứa một cơ chế chưa tồn tại, mà đây đúng là chữ anh đọc để quyết định về tiền. Rà soát chéo bắt được, đã sửa thành *"đã khai đủ tỷ lệ vải (chưa dùng vào giá thành)"*.

Chia giá thành theo dải là việc riêng, vì phải tách **cả mẫu số** (số lượng hoàn thành theo dải) chứ không chỉ tử số — không thì ra đơn giá vô nghĩa. Anh muốn làm thì nói, tôi viết PRD riêng.

### 5.4 ⚠️ Việc anh cần kiểm — ai bị khóa ngoài công đoạn Kỹ thuật

```sql
SELECT u.Username, u.HoTen, s.TenCongDoan
FROM UserCongDoan uc
JOIN Users u ON u.UserID = uc.UserID
JOIN CongDoan s ON s.StageID = uc.StageID
ORDER BY u.Username;
```

Ai **chỉ** được gán công đoạn Cắt (không có Kỹ thuật) thì từ v9.39 **không còn đường nào mở hộp thoại tách dải size** — ở Cắt họ thấy dòng chữ *"— sửa ở công đoạn Kỹ thuật"* dẫn tới nơi họ vào không được.

Đây đúng là triệu chứng anh báo ngày 06/11 (*"nhân viên tổ cắt không thấy chức năng tách dải size"*), lần này qua một cửa khác. Gửi tôi kết quả câu trên, tôi sẽ nói nên cấp thêm công đoạn hay nới điều kiện hiện nút.

---

## 6. Nghiệm thu — phí vận chuyển vải (v9.36)

1. **Danh mục → Nhà cung cấp**: mỗi NCC có **Đơn giá phí vận chuyển** + **ĐVT phí VC** (kg / mét). Điền cho vài NCC rồi Lưu.
   - 🔴 Sửa một NCC **không điền** hai ô này → giá cũ phải **còn nguyên**, không bị xóa.
2. **Kho vải → lập phiếu nhập** cho NCC đã có đơn giá phí → mỗi cây vải tự mang phí theo **bản chụp tại thời điểm nhập**. Đổi giá ở danh mục **không** hồi tố phiếu cũ — cố ý.
3. **QLSX → tính giá thành** một lệnh dùng vải đó → dưới Đơn giá có dòng `gồm phí VC ...`.
4. 🔴 **Công nợ NCC**: mở sổ công nợ của chính NCC đó → số **không được** chứa phí vận chuyển. Đây là ràng buộc trung tâm của v9.36.
5. So **"Phải trả NCC"** với ảnh chụp ở §1.1. Chênh lệch phải khớp với ước lượng.

⚠️ **Nợ đã biết, cố ý chưa sửa:** số **"giá trị tồn kho vải"** trong báo cáo vẫn sai (bỏ sót vải mua theo mét). Tôi đã thử sửa, rà soát chéo chỉ ra bản sửa **còn sai hơn** (`tonCuoiKG` luôn là KG trong khi đơn giá bình quân thành đ/mét), nên đã rút khỏi đợt. Sửa đúng cần quy đổi mét ↔ kg (định lượng + khổ vải) hoặc thêm cột riêng. Lý do đầy đủ nằm trong khối ghi chú của CTE `gia` trong `baocao.js`.

---

## 7. Nghiệm thu — nội dung công việc hợp đồng (v9.35)

1. **Nhân sự → Hợp đồng → Ký hợp đồng**: có ô **Nội dung công việc** (ô nhiều dòng, nhập tay).
2. Để trống → in hợp đồng → mục 1.5 phải là **đúng câu gốc của mẫu đó** (hai mẫu Chính thức / Thử việc có câu khác nhau), **không được để trống**. In chỗ trống = hợp đồng thiếu điều khoản.
3. Gõ nội dung riêng → in → mục 1.5 đúng nội dung vừa gõ, **xuống dòng giữ nguyên**.
4. Nếu hiện toast cảnh báo "mẫu không có chỗ cắm" → xem lại §1.2.

---

## 9. Nghiệm thu — lương công nhật theo bảng thực tế (v9.45)

Anh chốt 11/11 (10 điểm + "mỗi SP một đơn giá"). Những gì đã làm theo đúng từng điểm:

| Anh chốt | Phần mềm làm |
|---|---|
| 1. OT = lương CB ÷ giờ/ngày × 1,5 × giờ OT, chung mọi người | Hệ số lấy ở **Cấu hình lương → Hệ số TC ngày thường** (đang 1,5). CN/lễ **không** nhân khác. Thử việc × tỷ lệ thử việc (Loan: 25.000 × 1,5 × 0,85) |
| 2. Thuế TNCN để sẵn, không trừ | Cột **Thuế TNCN** luôn tính và hiện (xám, "không trừ"). Công tắc **Cấu hình → Trừ thuế TNCN vào thực lĩnh**, mặc định **Không** |
| 3. KPI 100 điểm tối đa | Tab **Đánh giá KPI**: điểm 0–100; tiền = quỹ KPI (hợp đồng) × điểm/100 × tổng công ÷ công chuẩn (chặn trên 1). Ô **Tiền ghi đè** khi muốn ấn định số |
| 4. Chuyên cần: đủ công chuẩn + không phép + không đi muộn | Đúng ba điều kiện; đi muộn = giờ vào máy chấm công trễ hơn giờ vào của nhóm quá **phút châm chước** (cấu hình, mặc định 5) |
| 5. Công chuẩn theo tháng | Lấy `CongChuanThang` — **một số cho cả 47 người** (sheet 1 đang chia 26, sheet 2 chia 27 ⇒ KPI kế toán Soan/Duyên sẽ khác file) |
| 6. Xăng trừ ngày phép | = đơn giá/ngày × ROUND(ngày đi làm thật) |
| 7. Gộp một bảng, cột kiểu lương | Cột **Kiểu** (Ngày/Tháng), cột Công TV / Công CT / Phép / Muộn / OT / KPI-SP / Xăng / Chức vụ / Chuyên cần / BH / Thuế / Tạm ứng / **Điều chỉnh** / Thực lĩnh. In có **3 chữ ký** |
| 8. Đánh giá KPI từng người | Tab mới **Lương → Đánh giá KPI**, theo tháng |
| 9–10. Theo SP: tên, đơn giá, SL; HĐ chọn KPI hay SP; nhiều SP mỗi SP một đơn giá | Hợp đồng: **Kiểu thưởng** = KPI / Sản phẩm + **danh mục SP & đơn giá** (nhiều dòng). Tab KPI: nút **📝 Sản phẩm** nhập SL từng SP trong tháng, đơn giá tự điền từ hợp đồng |

### 9.1 🔴 Việc anh phải làm TRƯỚC khi tính được: khai hợp đồng cho 47 người

Bảng lương chỉ tính người có **hợp đồng Hiệu lực** (Nhân sự → Hợp đồng lao động). Người chưa có **không có trong bảng** — sau khi bấm Tính lương, hộp kết quả liệt kê tên. Với mỗi người, khung **"Thông số tính lương công nhật (v9.45)"** trong form hợp đồng:

| Ô | Sheet 1 (36 người lương ngày) | Sheet 2 (11 người lương tháng) |
|---|---|---|
| Kiểu lương | **Ngày** | **Tháng** |
| Đơn giá ngày | cột "Lương ngày công" (Soan 500.000) | — |
| Lương cơ bản (ô cũ phía trên) | — | "Mức lương cơ bản" (Lan 10.000.000) |
| Mức đóng BHXH | suy từ tiền BH: 840k→8tr, 630k→6tr, 584k→**5,56tr**, 558k→**5,31tr**; người không đóng để trống | Hường 7tr, Ngọc 8tr; còn lại trống |
| Lương cố định/tháng | O Tám **10.000.000** | — |
| Ngày hết thử việc | — | người có "Ngày công thử việc" > 0 (Lan 16/10…) |
| Kiểu thưởng + quỹ KPI | Soan, Duyên: KPI, quỹ 500.000 | KPI, quỹ = "Thưởng KPIs"; **Hương Media: Sản phẩm** (ảnh 20.000, video 50.000) |
| Phụ cấp chức vụ (ô cũ) | Hợp 500.000 ("TN") | Lan 2tr, Thanh 1tr, Loan 1,6tr |
| Phụ cấp chuyên cần (ô cũ) | Hợp 300k, Nhung 300k, Cô Lan 200k | 500k / Thanh 300k / Ngọc 0 |
| Phụ cấp xăng xe + số công xăng (ô cũ) | Nhung: 15.000 × 26 = **390.000**, số công **26** | 20.000 × 27 = 540.000, số công 27 (Hường/Xuân 30.000 × 27) |
| Tỷ lệ thử việc (ô cũ) | trống | **Sâm: 70** (file 829.630 = 8tr/27 × 4 × 0,7 — không phải 85%) |

Nếu 47 hợp đồng là quá nặng để khai tay, nói tôi — tôi viết màn "Khai nhanh thông số lương" nhập một bảng, mỗi người một dòng.

### 9.2 Chạy thử T10/2026 và so với file

1. Cấu hình lương: **Công chuẩn tháng 10** = số anh chọn (file dùng cả 26 và 27 — phải chọn một). Hệ số TC ngày thường 1,5. Trừ thuế: Không. Làm tròn 1.000.
2. Tab Đánh giá KPI tháng 10: chấm **100 điểm** cho mọi người KPI (file đang trả đủ quỹ). **Lan: Tiền ghi đè 8.000.000** (file trả đủ 8tr dù 26,5/27 công — không theo công thức). Hương Media: 📝 Sản phẩm → ảnh × 247.
3. Lương công nhật → Tính lương. So **Thực lĩnh** với cột Thành tiền / Thực nhận của file:
   - **Khớp đến đồng** (đã kiểm bằng bộ tự kiểm trên 47 dòng): mọi người **không có OT** ở sheet 1 (15 người) và 10/11 người sheet 2 — *sheet 2 file không làm tròn nghìn, phần mềm làm tròn ⇒ lệch dưới 500đ là đúng*.
   - **Cố ý khác file:** 17 người có OT (công thức OT mới — file dùng 4 tỷ lệ lẫn lộn và hệ số 1,0); Duyên KPI 500k (file 519.231 vì chia 26 trong tháng 27 công); Hợp OT 7h = 468.563 (file 249.900).
   - **Ngọc −200k**: bấm ô **±** ở cột Điều chỉnh, ghi lý do "Nghỉ nhiều không xin phép". Số này giữ nguyên khi tính lại.
4. Chấm công: phần mềm lấy **công, phép (P), lễ (LT), giờ OT, giờ vào** từ Chấm công. Nếu T10 chưa có dữ liệu chấm công trong phần mềm thì chưa so được — khi đó so từng khoản bằng bộ tự kiểm là đủ để tin công thức, còn số công thì tháng 11 mới so được.
5. 🔴 **Nhìn cột "Muộn" trước khi chốt.** Luật "đi muộn dù một ngày = mất chuyên cần" (anh chốt) chạy trên **giờ vào của nhóm chấm công** (mặc định 08:00) + châm chước 5 phút. Nếu giờ vào cấu hình lệch giờ thật của xưởng thì **cả xưởng mất chuyên cần** ngay lần tính đầu (200k–500k/người). Thấy quá nhiều người "Muộn" ⇒ sửa giờ vào ở Chấm công → Cấu hình nhóm / phút châm chước ở Cấu hình lương, **không phải** sửa luật.
6. Nhân viên tự xem (menu "Bảng lương của tôi") thấy đúng các khoản như phiếu lương: thuế chỉ in dấu trừ khi có trừ, có dòng Điều chỉnh kèm lý do.

### 9.3 Giả định tôi tự đặt — anh xác nhận hoặc bác

- **Khoản tháng (quỹ KPI, chức vụ, trang phục, điện thoại) chặn trên 1 × mức tháng** khi công > công chuẩn. Bằng chứng: Hợp 31 công/26 nhận đúng 500k. Hệ quả: Duyên 27/26 nhận 500k thay vì 519.231.
- **Phép không tính xăng nhưng CÓ tính KPI và chức vụ** (Lan: chức vụ 2tr × 26,5/27 với 1 phép).
- **Lễ hưởng lương (LT)** tính như ngày làm cho lương + chuyên cần, **không** tính xăng.
- Người có **lương cố định** (O Tám) vẫn tính xăng/chuyên cần/BH theo công nếu có khai.
- **OT thử việc xét ở CUỐI THÁNG, không theo từng ngày**: người còn thử việc đến hết tháng thì toàn bộ giờ OT × tỷ lệ thử việc (Loan); hết thử việc giữa tháng thì toàn bộ OT tính 100%. Phần LƯƠNG thì tách đúng theo ngày. Đơn giản hóa cố ý — tách OT theo ngày cần sửa `gomChamCong`, làm khi anh thấy cần.
- Hợp đồng **hết hạn (Đến ngày đã qua) nhưng còn trạng thái Hiệu lực** vẫn được dùng để tính, kèm cảnh báo tên người — không tự loại ai.

---

## 10. Nghiệm thu — dấu vết lập / sửa trên phiếu bán hàng (v9.46)

Anh yêu cầu 11/11: *"phiếu bán hàng thêm giờ, ngày tháng lập đầu tiên để dưới người làm phiếu, tên người làm phiếu theo tên user đăng nhập. Nếu sửa ghi rõ, ngày sửa cuối cùng."*

| Chỗ | Trước | Nay |
|---|---|---|
| Bản in, ô ký **Người làm phiếu** | chỉ có nhãn | dưới nhãn: **tên user đã lập** (cách chỗ ký ~1 cm) + *Lập lúc hh:mm ngày dd/mm/yyyy* (giờ lập **đầu tiên**, không đổi khi sửa) |
| Bản in, chân phiếu | — | phiếu đã sửa hoặc đã hủy: dòng nghiêng *Sửa lần cuối: &lt;tên&gt; — hh:mm ngày dd/mm/yyyy* (căn phải). Chưa sửa thì **không có dòng này** |
| Màn xem phiếu (bấm số phiếu) | "Người lập: tên" | "Người lập: tên (hh:mm ngày …)" + dòng cam "Sửa lần cuối: …" khi có |

Kiểm nhanh (sau `migration_v891` + copy file + `pm2 restart`):

1. **Lập phiếu mới** bằng tài khoản A → In → dưới "Người làm phiếu" thấy tên A và giờ vừa lập. **Không** có dòng "Sửa lần cuối".
2. **Sửa phiếu đó** (đổi ghi chú) bằng tài khoản B → In → tên A + giờ lập **giữ nguyên**; thêm dòng *Sửa lần cuối: B — giờ vừa sửa*.
3. **Hủy** một phiếu → in bản hủy → có "(PHIẾU ĐÃ HỦY)" như cũ **và** dòng "Sửa lần cuối" = người hủy.
4. **Phiếu cũ** (lập trước v9.46, chưa ai sửa): có tên + giờ lập (cột `CreatedAt` có từ v6.68), không có "Sửa lần cuối" — đúng, vì chưa ai sửa **kể từ khi có v9.46**. Phiếu cũ từng sửa trước v9.46 cũng không có dòng này — phần mềm không bịa dấu vết quá khứ.
5. Giờ hiện trên phiếu phải là **giờ máy chủ** (giờ VN) — nếu lệch đúng 7 tiếng, gửi tôi: nghĩa là có chỗ nào đó đã đổi `useUTC`.

Chưa chạy `migration_v891` thì mọi thứ vẫn chạy: tên + giờ lập vẫn in; chỉ thiếu dấu vết sửa (im lặng, vì sửa phiếu không được phép thất bại vì thiếu một cột dấu vết).

---

## 12. Nghiệm thu — điều khoản thưởng trên hợp đồng theo Kiểu thưởng (v9.48, CHƯA deploy)

Anh yêu cầu 12/11: *"chỗ kiểu thưởng chọn kiểu gì thì khi nội dung và in ra phải theo cái đó. Hiện tại đang cố định [câu e) KPI]"*.

**Deploy (v9.48 + v9.48b):** trên **C:\**: `node --check backend\routes\hrm.js`, `node --check frontend\js\module.hrm.js`, `node --check frontend\js\module.payroll.js` → `node backend\utils\kiem_tat_ca.js --nhanh` (chạy MỌI bộ kiểm, trừ 3 bộ cần CSDL — xem §12.2) → copy `backend\routes\hrm.js`, `frontend\js\module.hrm.js`, `frontend\js\module.payroll.js`, `frontend\index.html` (hrm + payroll bump 9.48) → `pm2 restart`. Không migration.

| Kiểu thưởng trên hợp đồng | Câu e) (HĐLĐ) / 3.4 (HĐ thử việc) in ra |
|---|---|
| **Theo KPI** | *Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là X đồng/tháng tương ứng 100 điểm…* — **nguyên văn câu cũ**, hợp đồng KPI đã ký in lại y hệt |
| **Theo sản phẩm** | *Thưởng theo sản phẩm: … với đơn giá: Ảnh: 20.000 đồng/sản phẩm; Video: 50.000 đồng/sản phẩm. Mức hưởng thực tế bằng số lượng sản phẩm nghiệm thu nhân với đơn giá…* — danh mục lấy từ bảng sản phẩm khai ở form hợp đồng; chưa khai thì in dấu chấm |
| **Không** | *Thưởng/thu nhập hiệu suất: Không áp dụng thưởng KPI hay thưởng theo sản phẩm cố định. Các khoản thưởng khác (nếu có) thực hiện theo Quy chế…* |

Thử: mở một hợp đồng → Sửa → đổi Kiểu thưởng lần lượt 3 giá trị → Lưu → In. Màn **Xem hợp đồng** (bấm vào dòng ở Hồ sơ nhân viên) có thêm hai dòng "Kiểu lương" và "Thưởng (điều khoản e / 3.4)" — đúng cái sẽ in.

🔴 **Luật nhất quán với bảng lương:** in theo **đúng** ô Kiểu thưởng, không "đoán". Hợp đồng cũ (trước v9.45) chỉ khai *Quỹ KPI* mà Kiểu thưởng còn để *Không* ⇒ bảng lương **không tính KPI** và bản in **không có điều khoản KPI** — form hiện cảnh báo đỏ ngay dưới ô Kiểu thưởng, bấm In cũng báo. Những người thưởng KPI thật: mở hợp đồng, chọn **Theo KPI**, Lưu — một lần.

### 12.1 v9.48b — "deploy rồi mà vẫn in câu KPI cố định" (Nguyen 12/11)

Nguyên nhân: mẫu HĐLĐ **đã được sửa** trong tab *Mẫu văn bản* trước v9.48 ⇒ bản trong CSDL còn câu KPI cứng, và phần mềm ưu tiên bản đó hơn mẫu gốc. (Kiểm: tab *Mẫu văn bản*, cột "Đang dùng" của hai mẫu hợp đồng ghi **Bản sửa (vN)** chứ không phải *Mẫu gốc*.)

Bản in anh gửi 12/11 cho thấy mẫu đã sửa có **cả hai**: câu KPI cũ (tách gạch đầu dòng "- Quỹ KPI…") **và** `{{DieuKhoanThuong}}` chèn tay phía sau ⇒ in ra hai điều khoản. v9.48b xử lý luôn ca này: nhận ra câu cũ kể cả có gạch đầu dòng/xuống dòng, và nếu biến xuất hiện hai lần thì giữ một.

Sửa trong v9.48b: khi đọc mẫu đã sửa, phần mềm **tự nhận ra câu KPI cũ nguyên văn và thay bằng `{{DieuKhoanThuong}}`** ngay lúc in — không bắt ai đi sửa mẫu; mở ô *Sửa mẫu* cũng thấy biến mới, bấm Lưu là thành bản chính thức. Không tự ghi vào CSDL. Câu nào đã bị **viết khác đi** thì không nhận ra ⇒ vẫn báo đỏ "thiếu chỗ cắm" như trước — khi đó chèn `{{DieuKhoanThuong}}` vào câu e)/3.4 hoặc bấm **Mẫu gốc**.

Cùng bản: tab **Lương → Đánh giá KPI → 📝 Sản phẩm** nay **lấy danh mục từ hợp đồng**: mỗi sản phẩm hợp đồng là một dòng sẵn, tên + đơn giá khóa, chỉ gõ số lượng; dòng tháng trước ngoài danh mục vẫn hiện (nhãn "ngoài danh mục hợp đồng"); vẫn thêm được dòng phát sinh. File: `module.payroll.js` (bump 9.48), `module.hrm.js`.

### 12.2 Vì sao `kiem_ho_so_nhan_su.js` đỏ 8 phép (chạy 12/11)

| Phép đỏ | Lý do | Xử lý |
|---|---|---|
| 3 phép `.gitignore` / `uploads_hr/.gitkeep` (§1) | Anh chạy trên **D:\QLSX** — bản deploy không có `backend\.gitignore` và `.gitkeep` (không phải kho git). Trên C:\ cả ba đều có | Chạy bộ kiểm trên **C:\** (như §0). Không phải lỗi |
| `payroll.js van tinh theo NhanVien.SoNguoiPhuThuoc` (§2b) | Phép ghim một dòng mã của bộ tính v6.1 — v9.45 đã thay bằng `luongCongNhat.js` (cách tính giảm trừ **không đổi**) | Đã sửa phép kiểm: soi `payroll.js` SELECT cột + `luongCongNhat.js` nhân |
| 3 phép `payroll.js KHONG doc PhuCapChuyenCan / PhuCapChucVu / QuyKPI` (§6d) | Phép mô tả thiết kế **trước v9.45** ("chỉ để in"). Anh đã chốt 11/11 bảng lương lấy các khoản này từ hợp đồng — phép cũ nay sai, không phải mã sai | Đã đảo phép: payroll **phải** đọc; kèm phép "tính lại bị chặn khi đã chốt" |
| `printHopDong() goi inVanBan()` (§7g) | Phép cắt cứng 400 ký tự đầu hàm; v9.48 thêm cảnh báo quỹ KPI trước lệnh in nên lệnh in rơi ra ngoài 400 ký tự | Đã sửa: cắt đến hết hàm |

Bài học ghi lại: v9.45 đổi payroll mà bộ kiểm HRM không nằm trong danh sách §0 nên 4 phép đỏ nằm im một ngày. Từ nay §0 Bước 2 = **một lệnh chạy tất cả**:

```
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node backend\utils\kiem_tat_ca.js --nhanh
```

(`--nhanh` bỏ 3 bộ cần CSDL thật: `kiem_cot_migration`, `kiem_ten_bang_cot`, `kiem_ton_am` — chạy riêng khi cần kiểm dữ liệu. Bộ nào đỏ thì nó in sẵn 40 dòng cuối, không phải chạy lại từng bộ. `--chi-tiet` in hết.)

---

## 13. Nghiệm thu — kéo chấm công tự động theo giờ (v9.49, CHƯA deploy)

Anh yêu cầu 13/11: *"phần tải về chấm công từ máy chấm công cho tải tự động vào 1 thời gian cài đặt"*.

**Deploy:** trên C:\ `node --check` 4 file `backend\routes\payroll.js`, `backend\utils\lichChamCong.js`, `backend\server.js`, `frontend\js\module.payroll.js` → `node backend\utils\kiem_tat_ca.js --nhanh` → copy 4 file đó (`lichChamCong.js` **MỚI** — thiếu là `server.js` không lên) + `frontend\index.html` (payroll bump 9.49) → `pm2 restart` → `pm2 logs` tìm dòng `[chamcong-tudong] Lịch: …` hoặc `Lịch không chạy — Kéo tự động đang TẮT` (mặc định tắt, không có gì chạy ngầm cho đến khi anh bật). Không migration — cấu hình ghi vào bảng `CauHinh` khóa `CHAM_CONG_TU_DONG`.

**Ở đâu:** Lương → Chấm công → dưới bảng máy chấm công có khối **⏰ Kéo tự động theo giờ**: Bật · Giờ chạy mỗi ngày (mặc định 23:30) · Kéo mấy ngày gần nhất (mặc định 3) · Tổng hợp bảng công sau khi kéo · **Lưu** · **▶ Chạy ngay**.

**Cách chạy:** đúng giờ, với **mọi máy đang Hoạt động** (máy "Tạm dừng" bỏ qua), kéo N ngày gần nhất (bản ghi trùng tự bỏ — kéo lại 3 ngày là cố ý, máy tắt hay mất mạng một hôm thì hôm sau vẫn vớt được), rồi **Tổng hợp từ máy → bảng công** tháng hiện tại (ngày 1–3 tổng hợp cả tháng trước). Dòng bảng công **đã sửa tay không bị ghi đè** (cùng MERGE với nút tay). Một máy lỗi không chặn máy khác; mọi máy đều lỗi thì không tổng hợp.

Kiểm:
1. Bật, đặt giờ **2 phút sau hiện tại**, Lưu → dòng trạng thái phải ghi "● Đang chạy — mỗi ngày lúc hh:mm…". Đợi qua giờ, bấm tab Chấm công lại → dòng "Lần chạy gần nhất … (theo lịch): May X +N lần quẹt mới". `pm2 logs` cũng có dòng `[chamcong-tudong] …`.
2. **▶ Chạy ngay** → kết quả hiện ngay, bảng công tháng đổi theo. Bấm hai lần liền → lần hai báo "Đang có một lượt kéo chưa xong".
3. Tắt → Lưu → trạng thái "● Không chạy — Kéo tự động đang TẮT". Sau `pm2 restart` trạng thái phải giữ đúng như đã lưu.
4. Đặt giờ thật: **sau giờ tan ca muộn nhất** — tổng hợp trước khi người ca tối quẹt ra thì ngày đó thiếu giờ ra (mã `x?`); lần kéo hôm sau sẽ sửa lại vì kéo lại 3 ngày và dòng đó là `Nguon='May'`.

Không làm trong bản này (nói trước): không gửi email/Zalo khi máy lỗi — kết quả chỉ hiện trên màn và `pm2 logs`. Muốn báo thì nói, ghép vào kênh cảnh báo của sao lưu.

---

## 14. Nghiệm thu — quét mã vạch bằng camera máy tính bảng để thêm hàng theo Ri (v9.50, CHƯA deploy)

Anh yêu cầu 13/11: *"Lập phiếu bán hàng thêm chức năng quét mã vạch qua camera máy tính bảng để thêm hàng theo số lượng ri. Đối chiếu tên khách và mã hàng ở khách đặt hàng nếu có thì chuyển trạng thái bên khách đặt hàng đã xuất hàng luôn."*

**Deploy:** trên C:\ `node --check frontend\js\common.js` + `node --check frontend\js\module.khohang.js` → `node backend\utils\kiem_quet_ma_vach_phieu_ban_hang.js` (bộ kiểm MỚI, giả lập camera + DOM, không cần CSDL) → `node backend\utils\kiem_tat_ca.js --nhanh` → copy **2 file** `frontend\js\common.js`, `frontend\js\module.khohang.js` + `frontend\index.html` (bump `common 9.50`, `khohang 9.50`) → **không** `pm2 restart` cũng được (không đổi máy chủ, không migration) nhưng restart cho chắc cũng không sao. Máy tính bảng mở lại trang (PWA tự nạp lại khi thấy `?v=` đổi).

**Giả định tôi đặt — anh bác thì nói:**
1. **Mã vạch trên tem = `Mã barcode` khai ở Thẻ kho hàng hóa** (cột `MaBarcode`, nhập tay — cùng nguồn với tra cứu Zalo v9.25). Tem nào in **mã hàng** thay vì mã barcode cũng quét được (dò mã hàng sau mã vạch). Mã chưa khai barcode → quét báo "Không có mã hàng nào mang mã vạch …" — khai thêm ở Thẻ kho rồi quét lại.
2. **1 lần quét = +1 Ri = +`LoaiRi` đơn vị** trên dòng (đúng hệ số mà cột "Quy đổi" của form đang dùng). Mã chưa khai hệ số (`LoaiRi` trống/1) → mỗi lần quét +1 cái, dòng trạng thái nói rõ.
3. **Các màu dùng chung một mã vạch** (anh xác nhận 13/11). Mã chỉ có **đúng 1 màu** → tự chọn, không hỏi. Mã nhiều màu → **lần đầu quét, nút màu hiện ngay dưới camera, bấm màu của tem** (★ = màu khách đặt, số trong ngoặc = khả dụng); các tem sau **cùng mã cộng thẳng vào màu đó**; sang màu khác thì **bấm màu khác TRƯỚC khi quét**. Chưa bấm màu = tem chưa được cộng (quét 3 tem rồi bấm Đen = +3 Ri Đen); đóng camera khi còn tem chưa bấm màu → hỏi trước. Bấm nhầm / quét nhầm: nút **↶ Hoàn lại** (dòng về đúng số trước lần quét đó). Không đoán màu theo đơn khách, cũng không theo "màu duy nhất còn khả dụng" (khả dụng đã trừ chính đơn của khách này — khách đặt Đen đúng bằng tồn thì Đen khả dụng 0, đoán sẽ chọn nhầm Trắng).
4. **Khớp đơn khách đặt:** cùng **khách** (tên chuẩn hoá hoa/thường/khoảng trắng — cùng luật với nút "Chọn đơn" — hoặc khách danh mục liên kết của đơn web) + cùng **mã hàng** (+ cùng màu khi dòng đã có màu), đơn đang *Chờ xác nhận/Chờ xử lý* chưa gắn phiếu. **Đơn Đi tuyến (shop/NPP) KHÔNG tự khớp** — phiếu của đơn đó phải ghi cho NPP + gắn shop/nhân viên, vẫn dùng nút "Chọn đơn" như cũ. Khi lưu, đơn khớp chuyển **"Đã xuất hàng"** bằng đúng đường cũ của dòng lấy từ đơn (backend không đổi một dòng nào).

**Ở đâu:** Lập phiếu bán hàng (mới hoặc sửa) → dưới bảng dòng hàng, cạnh "+ Thêm dòng hàng" có nút **📷 Quét mã vạch (+1 Ri/lần)**. Cần **https** (máy tính bảng đã cài rootCA như hướng dẫn cũ) — mở bằng http thì nút báo đúng câu đó, không mở camera.

Kiểm trên máy tính bảng (Android Chrome hoặc iPad Safari):
1. Chọn khách → bấm nút → khung camera **ngang** (rộng, thấp) hiện. Đưa tem của mã **1 màu** vào: **bíp** ngắn + rung, dòng xanh dưới camera: `✓ AB123 · Đen — dòng 1: 1 Ri = 12 Cái`, dưới nữa là hàng nút màu (1 nút, tô đậm) và tóm tắt "Đang có trên phiếu (từ quét): …".
1b. Tem của mã **nhiều màu**: bíp, dòng chữ "AB123 có 3 màu — bấm màu của tem ở dưới" + hàng nút `Đen (24)` `Trắng ★ (12)` `Xanh (0)`, tóm tắt đỏ "⚠ Đang giữ 1 tem AB123 chưa bấm màu". **Chưa bấm thì phiếu chưa đổi.** Quét thêm 2 tem nữa cùng mã (đưa camera ra/vào) → "đang giữ 3 tem"; bấm **Trắng** → dòng Trắng 3 Ri. Quét tem tiếp → cộng thẳng vào Trắng, không hỏi. Bấm **Đen** rồi quét → tem sau vào Đen (dòng mới). Bấm **↶ Hoàn lại** → dòng về đúng số trước lần quét vừa rồi. Đang giữ tem mà quét sang mã khác → tem bị bỏ, câu báo của lần quét mới mở đầu bằng "⚠ Bỏ N tem …". Bấm Đóng khi còn tem chưa bấm màu → hộp hỏi "đóng là bỏ số tem này".
2. **Giữ nguyên tem trong khung 5 giây** → vẫn 1 Ri (không đếm trùng). **Đưa camera ra chỗ khác ≈1–2 giây rồi đưa lại cùng tem** → 2 Ri. Đây là cách đếm nhiều ri cùng mã. (Ngưỡng 1,2 giây khung trống liên tục cho mã vạch — nếu thực tế hay **đếm trùng** khi tay rung/lóa, hoặc **đếm chậm**, nói tôi chỉnh `nghiMs`.)
3. Quét tem mã khác → dòng mới (đang giữ tem chưa bấm màu của mã trước thì tem đó bị bỏ, có báo). Quét lại mã + màu đã cộng **trong cùng lượt mở camera** → cộng tiếp, không tạo dòng mới. **Đóng camera rồi mở lại** → màu phải bấm lại; gặp lại mã + màu đã có trên phiếu thì hỏi một lần "đếm lại từ đầu / cộng thêm" (dòng đang 0 thì không hỏi). Dòng thêm tay chưa chọn màu → nhận luôn màu vừa bấm.
4. Tem lạ / mã không khai barcode → bíp dài + dòng đỏ, không thêm dòng. Hai mã hàng khai **trùng** một barcode → dòng đỏ "đang gắn cho 2 mã hàng … không tự chọn" (sửa barcode ở Thẻ kho).
5. Bấm Đóng → bảng dòng hàng đã có đủ, mỗi (mã, màu) một dòng, ô màu đã chọn sẵn; ô SL sửa tay được như thường; cột Quy đổi hiện số Ri.
6. **Khớp đơn:** khách có đơn chờ cho mã đó → sau khi quét, dòng chuyển sang kiểu "từ đơn" (mã hàng in đậm, nhãn `khớp đơn #123 3 Ri`), dòng trạng thái ghi "khớp 1 đơn khách đặt (#123) → lưu phiếu là chuyển Đã xuất hàng". Lưu phiếu → vào **Đơn khách đặt hàng**, đơn #123 phải là **Đã xuất hàng** và gắn số phiếu.
7. **Giao thiếu:** đơn đặt 3 Ri, chỉ quét 2 Ri → bấm Lưu phải ra hộp hỏi "Số lượng trên phiếu NHỎ HƠN số khách đặt … OK = vẫn lưu". OK thì đơn vẫn đóng với số đặt 3 Ri (phiếu trừ tồn 2 Ri) — đúng luật cũ của dòng lấy từ đơn; Cancel thì sửa lại.
8. **Đổi màu / đổi khách** trên dòng quét → nhãn đơn khớp lại theo màu/khách mới (đơn của khách cũ không còn trên phiếu). Dòng lấy từ nút "Chọn đơn" mà anh tự tích thì quét vào **không** bị khớp lại — chỉ hỏi một lần "đếm lại từ đầu hay cộng thêm".
9. Trên **máy tính** không camera: nút vẫn hiện, bấm báo "Không tìm thấy camera" — không hỏng gì. Các chỗ quét QR cũ (kho vải, giao vải) chạy y như trước (tôi chỉ **thêm** tùy chọn vào `openQrScanner`, mặc định giữ nguyên hành vi, không thêm khoảng trắng dưới camera).

**Rà chéo độc lập 13/11 đã bắt và tôi đã sửa trước khi giao:** (1) đếm ma sau hộp confirm (đo "kể từ lần thấy cuối" sai khi luồng bị chặn → nay đo khung trống **liên tục**); (2) phiếu 2 dòng cùng mã khác màu bị cộng hết vào dòng đầu → nay dòng khóa theo (mã, màu), màu bấm ngay dưới camera; (3) bộ kiểm đếm sai số chỗ gọi (đỏ oan). Sau rà chéo anh xác nhận "các màu cùng 1 mã vạch" → đổi cách chọn màu từ "chọn trên dòng sau khi đóng camera" sang "bấm màu ngay dưới camera" (1b). **Rà chéo lần 2** trên phần này bắt thêm và đã sửa: tự chọn "màu duy nhất còn khả dụng" là sai im lặng (bỏ); câu "Bỏ N tem" bị câu ✓ đè mất (ghép vào đầu câu ✓); nút Hoàn lại khi đang giữ tem làm mất nút màu; đóng camera còn tem không hỏi; lỗi trong nút bấm im lặng (bọc anToan); đơn đã ở dòng khác bị gắn lại (2 dòng cùng DonID). Chưa đo được trên máy thật — điểm 1b, 2 và 6 của bảng kiểm trên là chỗ dễ lệch nhất.

Không làm trong bản này: không in tem / sinh mã vạch (tem đã có sẵn), không quét bằng máy quét USB (máy quét USB gõ như bàn phím — nếu anh có, nói, thêm ô "gõ mã vào đây" là xong, không cần camera). Nếu Android đọc mã vạch kém: có thể bật `useBarCodeDetectorIfSupported` (bộ đọc native của Chrome) — chưa bật vì trên Chrome Windows nó "có mà không đọc được gì", cần đo trước.

---

## 15. Nghiệm thu — cột MÃ VẠCH ở danh sách Thẻ kho hàng hóa, sửa/quét ngay tại dòng (v9.51, CHƯA deploy)

Anh báo 13/11: *"tôi kiểm tra danh mục hàng hóa chưa có cột mã vạch"*. Đúng: `MaBarcode` chỉ có trong form **Sửa thẻ kho** (ô "Mã Barcode") và form Nhập kho, danh sách không hiện, và không có cách điền nhanh cho hàng trăm mã trước khi dùng quét v9.50.

**Deploy (gộp với v9.50):** `node --check backend\routes\khohang.js` (thêm) → `node backend\utils\kiem_ma_vach_the_kho.js` (bộ kiểm MỚI, route chạy thật với CSDL giả) → `kiem_tat_ca.js --nhanh` → copy thêm `backend\routes\khohang.js` + `frontend\js\module.khohang.js` (bump **9.51**) + `frontend\index.html` → **`pm2 restart`** (lần này có đổi máy chủ). Không migration (cột `MaBarcode` có từ migration_v517).

**Ở đâu:** Thẻ kho hàng hóa → cột **Mã vạch** mới, ngay sau Tên hàng (chữ "— chưa có —" khi trống). Có quyền Sửa thì mỗi dòng có nút **✎**:
1. Bấm ✎ → ô nhập + **📷** + **💾** + **✕** hiện ngay tại ô. Gõ tay hoặc bấm 📷 đưa tem vào camera — đọc được là tự điền, bấm 💾 (hoặc Enter). Esc/✕ = bỏ.
2. Lưu chỉ ghi **đúng một cột** `MaBarcode` (route mới `PUT /items/:id/mavach`), không đi qua đường Sửa thẻ kho 15 cột (đường đó từng làm mất ảnh màu — v9.03). Lưu xong chữ trên dòng đổi ngay, không vẽ lại cả bảng (giữ bộ lọc/ô tìm đang gõ).
3. **Trùng:** mã vạch đã gắn cho mã hàng khác → báo "đang gắn cho mã hàng X", không lưu. So trùng theo cùng luật với quét ("8938-000111" = "8938000111"). Sửa bên kia trước nếu muốn chuyển.
4. **Xóa:** để ô trống rồi 💾 → mã vạch về trống. (Form Sửa thẻ kho KHÔNG xóa được — nó bọc ISNULL — đây là đường xóa duy nhất.)
5. Ô tìm kiếm nay tìm được theo mã vạch; nút **📷** cạnh ô tìm: quét tem → lọc danh sách theo mã đó, báo số dòng; không có mã nào → gợi ý bấm ✎ để gán.
6. Zalo tra cứu (v9.25) nhận mã vạch mới ngay (xóa chỉ mục), không đợi 60 s.

Việc anh làm trước khi dùng quét v9.50: đi một lượt qua các mã có tem — bấm ✎ → 📷 → 💾 cho từng mã (máy tính bảng, ngay tại kho). Nếu tem in **mã hàng** (không phải số barcode riêng) thì không cần gán gì: quét v9.50 dò theo mã hàng sau khi dò mã vạch.

---

## 16. Nghiệm thu — ba việc nhỏ 14/11 (v9.52, CHƯA deploy)

Anh yêu cầu 14/11: *"Chi tiết gia công thêm cột sl giao"* · *"Khi thêm user mới gắn với mã nhân viên auto có chức năng bảng lương của tôi"* · *"Phiếu chi ⚠️ Tạm ứng — TRỪ vào lương tháng thì khi in phiếu chi ghi rõ Tạm ứng trừ lương tháng chọn"*.

**Deploy (gộp đợt):** thêm `node --check backend\routes\users.js`, `backend\utils\luongGiaCongInThe.js`, `frontend\js\module.congno.js`, `frontend\js\module.users.js` → `node backend\utils\kiem_sl_giao_va_mypay_tu_dong.js` (bộ kiểm MỚI) → copy 2 file backend + `module.payroll.js` (9.52), `module.users.js` (9.52), `module.congno.js` (9.52) + `index.html` → `pm2 restart`. Không migration.

**16.1 Cột SL giao** — Lương → Lương gia công / in thêu: mọi bảng (tổng hợp theo nhà, chi tiết, popup + bản in từng nhà) có cột **SL giao** cạnh **SL nhận**. SL giao = số ghi ở công đoạn Giao gia công / Giao in thêu. **Tiền KHÔNG đổi** — vẫn SL nhận × đơn giá; cột này chỉ để thấy hao hụt giao/nhận. Dòng giao mà chưa nhận vẫn không nằm trong bảng (tiền chỉ phát sinh khi hàng về — luật cũ). Sổ công nợ nhà gia công dùng chung util nên số tiền ở đó cũng không đổi. Ghi chú dưới bảng đã sửa câu "Lọc theo tháng tạo dòng giao (CreatedAt)" vốn sai từ v8.61 (thực tế lọc theo tháng QC).

**16.2 Tự bật "Bảng lương của tôi"** — Quản lý user: tạo user có chọn **Liên kết nhân viên**, hoặc sửa user và gắn nhân viên MỚI (trước trống, hoặc đổi người) → máy chủ tự thêm **ghi đè riêng theo user** cho phân hệ MYPAY (Xem = 1) và tab *Bảng lương của tôi*; toast "Đã tự bật…". Vì sao cần: migration_v620 chỉ cấp MYPAY cho các nhóm có LÚC ĐÓ, nhóm tạo sau không có, user không thuộc nhóm nào thì không thấy gì. Kiểm: tạo user mới không thuộc nhóm nào, gắn nhân viên → người đó đăng nhập → thấy "Bảng lương của tôi". Xem lại ở Quản lý user → Phân quyền riêng theo user: dòng MYPAY có tick "Ghi đè riêng" + Xem. Gỡ liên kết KHÔNG tự thu hồi (quản trị bỏ tick nếu muốn). Máy chưa chạy migration_v5_userperm thì bỏ qua lặng lẽ, user vẫn tạo được.

**16.3 Phiếu chi tạm ứng in rõ tháng trừ** — phiếu chi loại *⚠️ Tạm ứng — TRỪ vào lương tháng*: bản in có khung đậm **"TẠM ỨNG — TRỪ VÀO LƯƠNG THÁNG m/yyyy"** ngay dưới "Lý do chi"; danh sách phiếu chi và popup chứng từ hiện cùng câu đó (màu cam). Tháng = tháng đã chọn trên phiếu; phiếu cũ trước v9.32 chưa có tháng thì = tháng của ngày chi — đúng luật trừ lương của bảng lương (bản in không được nói khác bảng lương). Loại khác (Khác / Công tác phí / Hoàn ứng / Thưởng) không in gì thêm. Kiểm: tạo phiếu chi NV tạm ứng chọn trừ tháng 12/2026 → 🖨️ → thấy khung "TẠM ỨNG — TRỪ VÀO LƯƠNG THÁNG 12/2026"; phiếu công tác phí → không có khung.

---

## 17. Nghiệm thu — bảng lương công nhật TỰ TÍNH LẠI khi có biến động (v9.53, CHƯA deploy)

Anh yêu cầu 14/11: *"Lương công nhật – tính lương khi có biến động ngày công phiếu thu chi hay ký hợp đồng tự động tính lương luôn không cần bấm tính lương"*.

**Deploy (gộp đợt):** `node --check backend\utils\bangLuongTuDong.js` (MỚI) + chạy lại `node --check` cho `payroll.js`, `hrm.js`, `congno.js`, `module.payroll.js`, `module.mypay.js` → `node backend\utils\kiem_bang_luong_tu_tinh_lai.js` (bộ kiểm MỚI — chạy THẬT `routes/payroll.js`, `routes/congno.js`, `routes/hrm.js` với CSDL giả; cần `express`/`exceljs`/`xlsx`/`multer` trong `backend\node_modules`, máy anh có sẵn vì máy chủ cũng cần) → `kiem_tat_ca.js --nhanh` → copy `backend\utils\bangLuongTuDong.js` + 3 route + `module.payroll.js` (9.53) + `module.mypay.js` (9.53) + `index.html` → **`pm2 restart`**. **Không migration** — cờ ghi vào bảng `CauHinh` có sẵn (khóa `BANG_LUONG_TU_DONG`).

**17.1 Cách làm — cờ bẩn + tính lúc xem, không tính lúc ghi.** Mỗi nơi làm đổi đầu vào bảng lương ghi một cờ *"tháng m/yyyy cần tính lại, vì …"*; mở tab **Lương → Lương công nhật** (hoặc nhân viên mở **Bảng lương của tôi**) là máy chủ tính lại **trước khi** trả bảng — đúng hàm của nút Tính lương (`tinhBangLuongThang`, tách ra từ route), xóa cờ, và hiện dòng trạng thái ngay trên bảng. Vì sao không tính ngay lúc ghi: một buổi sửa 40 dòng chấm công = 40 lần tính cả bảng mà chưa ai xem; lịch kéo chấm công 23:30 cũng vậy. Tính lúc xem: mỗi lần mở tối đa MỘT lần tính, luôn ra số mới nhất.

Các chỗ đánh dấu (hook): **chấm công** — nút Tổng hợp + lịch tự động v9.49 (`tongHopChamCongThang`), sửa tay một ngày, xóa bảng chấm công tháng; **phiếu chi tạm ứng** (Công nợ) — lập / sửa / xóa phiếu loại *Tạm ứng* (sửa thì đánh dấu CẢ tháng trừ cũ lẫn mới; đổi sang Hoàn ứng cũng đánh dấu tháng cũ); **hợp đồng** (Nhân sự) — thêm / sửa / xóa: đánh dấu **mọi tháng từ ngày hiệu lực tới nay** (sửa lùi ngày thì từ ngày sớm hơn; tối đa 12 tháng gần nhất); **nhân viên** — đổi trạng thái qua lại ranh giới *Đã nghỉ việc* (sửa hồ sơ hoặc thanh lý hợp đồng): tháng này + tháng trước; **KPI / thưởng sản phẩm**; **cấu hình lương / biểu thuế** (tháng này + tháng trước), **công chuẩn** (tháng đó). Không hook: cấu hình giờ chấm công và nhóm chấm công (chỉ ảnh hưởng lần Tổng hợp sau — Tổng hợp đã hook), kéo dữ liệu máy (ghi punch thô, chưa thành công).

**17.2 Luật quan trọng:**
- 🔴 **Đã chốt thì KHÔNG tự tính** (giữ luật v9.32): cờ vẫn ghi, bảng hiện dòng cam *"⚠ Bảng đã chốt nhưng có biến động sau đó (giờ): …"*, số đã chốt giữ nguyên. **v9.54 (anh chốt 14/11): có nút 🔓 Bỏ chốt** — chỉ hiện khi bảng đã chốt, **bắt buộc ghi lý do**, máy chủ ghi dấu vết `[giờ] Bỏ chốt — <người>: <lý do>` vào `BangLuong.GhiChu` (cột có sẵn, không migration; hiện 📝 cạnh trạng thái) và đưa bảng về Nháp. Bỏ chốt **không tự tính ngay** — mở lại tab, có cờ biến động thì tự tính và nói vì sao, rồi chốt lại. Quyền: như Chốt (sửa + tab Lương công nhật). Route `PUT /bangluong/:id/bochot`; UPDATE có điều kiện `TrangThai='Đã chốt'` (hai người bấm cùng lúc ⇒ người sau nhận 409).
- **Tháng này và tháng trước chưa có bảng ⇒ tự tạo lần đầu** khi mở tab (không bắt bấm nút). Tháng cũ hơn chưa từng có bảng thì không tự tạo (mở xem T3 năm ngoái không nên sinh một bảng lương) — hiện dòng xám, bấm Tính lương nếu thật sự cần.
- Lỗi lúc tự tính (SQL hỏng…) **không làm mất bảng**: GET vẫn trả bảng cũ, dòng đỏ nói lỗi, cờ giữ để lần sau tính lại; bấm Tính lương để thấy lỗi đầy đủ.
- Hai người mở cùng lúc ⇒ **một** lần tính. Biến động đến **trong lúc** đang tính ⇒ cờ vẫn còn, lần mở sau tính nữa (không nuốt biến động).
- Nút **Tính lương** vẫn còn (tính lại ngay, không cần chờ mở lại). Bấm xong cờ được trả nợ. Điều chỉnh ± có lý do vẫn giữ qua mọi lần tính (v9.45).
- Nhân viên mở *Bảng lương của tôi* cũng kích tính lại (cùng hàm) nhưng chỉ thấy *"Vừa cập nhật tự động lúc …"* — **không thấy lý do** (lý do nhắc tên phiếu chi / hợp đồng của người khác). Người lập bảng (`NguoiLapID`) không bị ghi đè thành nhân viên đó.
- Hỏng cờ (bảng `CauHinh` lỗi) không làm hỏng việc lưu phiếu chi / hợp đồng — các hàm đánh dấu không bao giờ ném; chỉ mất một lần tự tính.

**17.3 Kiểm sau deploy (T11/2026, bảng đang Nháp):**
1. Mở Lương công nhật T11 → nếu chưa có bảng: tự tạo, dòng xanh *"⟳ Bảng đã tự tính lại lúc … vì: Chưa có bảng lương tháng này — tạo lần đầu"* (+ link *"N người chưa có hợp đồng — xem"* nếu còn người chưa khai HĐ). Mở lại → dòng xám *"Số liệu đang là mới nhất — tính lần cuối …"*, **không** tính nữa (nhìn `pm2 logs` không có DELETE/INSERT mới — hoặc tin dòng xám).
2. Chấm công → sửa tay một ngày của một người (đổi số công) → quay lại Lương công nhật → dòng xanh *"… vì: Sửa tay chấm công ngày dd/mm/yyyy"*, công của người đó đổi theo.
3. Công nợ → Phiếu chi → lập phiếu NV *Tạm ứng* 500.000 trừ tháng 11 → Lương công nhật → dòng xanh *"… vì: Phiếu chi tạm ứng PC26xxxx"*, cột Tạm ứng của người đó +500.000. Sửa phiếu đó sang trừ tháng 12 → T11 tự tính lại (tạm ứng về 0), T12 (chưa có bảng? tháng sau chưa tự tạo — mở T12 sau 1/12 mới tạo) .
4. Nhân sự → Hợp đồng → sửa đơn giá ngày của một người (ngày hiệu lực 01/10) → Lương công nhật T11 **và** T10 (nếu T10 còn Nháp) đều báo *"… vì: Sửa hợp đồng số …"* khi mở.
5. Chốt bảng T11 → sửa thêm một ngày chấm công → mở T11: dòng **cam** *"Bảng đã chốt nhưng có biến động sau đó"*, số không đổi, nút Tính lương không hiện (như cũ). **v9.54:** bấm 🔓 Bỏ chốt → không ghi lý do thì bị chặn; ghi lý do → bảng về Nháp, cạnh trạng thái có 📝 dấu vết; tab tải lại → dòng xanh *"⟳ Bảng đã tự tính lại … vì: Sửa tay chấm công …"*, công của người đó đã đổi → chốt lại.
6. Đăng nhập tài khoản nhân viên → Bảng lương của tôi → có dòng *"Vừa cập nhật tự động lúc …"* / *"Số liệu tính lúc …"*, không có lý do.
7. Nếu bật lịch kéo chấm công v9.49: sáng hôm sau mở Lương công nhật → dòng xanh *"… vì: Tổng hợp chấm công 11/2026"*.

**17.4 Giả định (nói rõ, anh sửa nếu sai):** (a) *"tự động tính lương luôn"* = số luôn mới khi mở xem, không cần nút — không phải "tính lại ngay tại giây ghi phiếu"; hai cách cho cùng kết quả, cách này rẻ hơn và không chạy ngầm 40 lần/buổi. (b) Bảng **đã chốt** vẫn không tự tính (luật v9.32) — nếu anh muốn "chốt rồi vẫn tự tính" thì phải bỏ luôn ý nghĩa của chốt, tôi không khuyến nghị. (c) Tháng cũ (trước tháng trước) chưa từng tính thì không tự sinh bảng.

---

## 18. Nghiệm thu — nghỉ phép / lịch nghỉ lễ / nghỉ cá nhân / cột Không phép / thưởng chuyên cần bậc thang (v9.55, CHƯA deploy)

Anh yêu cầu 14/11: *"Ký hợp đồng: kiểu thưởng thêm phần chuyên cần: tự tạo danh sách chuyên cần (28 công 300k, 30 công 50k)"* · *"Tạo phiếu nghỉ phép chọn nhân viên, chọn ngày nghỉ phép để đưa vào bảng lương. Chữ ký có người xin nghỉ và trưởng bộ phận"* · *"Lương công nhật thêm cột không phép"* · *"Chấm công thêm chức năng tạo lịch nghỉ lễ chung cho cả công ty. Tạo lịch nghỉ không lương, thai sản, tai nạn theo từng cá nhân"*.

**Anh chốt 14/11 (bốn câu hỏi):** bậc chuyên cần = **chỉ nhận bậc cao nhất đạt được, trả đúng số tiền ghi ở bậc đó, KHÔNG cộng dồn** — anh nói lại lần 2: *"đạt 28 công thưởng 300.000, đạt 30 công thưởng 500.000"* (người 30 công nhận 500.000, không phải 800.000) · chọn kiểu này thì **phụ cấp chuyên cần cố định bỏ qua** (bậc thang thay thế) · **phép (P) vẫn KHÔNG lương** như v9.45 · **lễ chung KHÔNG công** (chỉ là ngày nghỉ). Giả định tôi kèm (anh chưa phản đối): công xét bậc = công đi làm + lễ hưởng lương, **không tính phép, không xét đi muộn**; "không phép" = ngày làm việc **T2–T7, trừ CN, trừ lễ chung, từ ngày vào làm, tới hôm nay** mà không có dòng chấm công nào (x / P / KL / TS / TN / LT đều là "có dòng").

**Deploy (gộp đợt):** chạy `database\migration_v892.sql` **trước** → `cd database && node tao_file_cai_dat.js` → `node --check` 7 file (§0 bước 1, gồm `utils\nghiPhep.js` MỚI) → `node backend\utils\kiem_nghi_phep_le_chuyen_can.js` (bộ kiểm MỚI — chạy thật `luongCongNhat`, `nghiPhep`, `payroll.js`, `hrm.js` với CSDL giả) → `kiem_tat_ca.js --nhanh` → copy (§3, v9.55) + `index.html` (hrm/payroll/mypay **9.55**) → **`pm2 restart`**. Chưa chạy migration mà đã copy code: máy vẫn chạy (mọi bảng/cột đều dò trước), các nút mới báo *"chưa chạy migration_v892"*, bảng lương có thêm một dòng cảnh báo; ngày lễ đã gõ ở Cài đặt chấm công **không mất** (POST cài đặt giữ danh sách cũ khi form không gửi).

**18.1 Lịch nghỉ lễ chung** — Chấm công → **📅 Lịch nghỉ lễ** (xem theo năm ở ô Kỳ lương): thêm ngày + tên, xóa. Lần đầu mở, các ngày đã gõ ở ô *"Ngày lễ / Tết"* cũ của Cài đặt chấm công được **chép sang bảng** `NgayLeChung` (ô cũ bỏ khỏi form; bảng là nguồn duy nhất từ đó — xóa ở lịch là mất hẳn). Tác dụng: không tính công, không tính "không phép", phiếu nghỉ bỏ qua ngày đó, OT ngày đó vào cột Lễ/Tết (như cũ). Thêm/xóa lễ ⇒ bảng lương tháng đó tự tính lại (v9.53).

**18.2 Giấy nghỉ phép + lịch nghỉ cá nhân** — **v9.57 (anh 14/11): là TAB RIÊNG "Tạo giấy nghỉ phép / Nghỉ cá nhân"** ngay dưới Chấm công trong phân hệ Tính lương (chức năng `PAYROLL/nghiphep`, dòng `ChucNang` thêm trong migration_v892 — không có dòng cấu hình = ai có quyền Tính lương đều thấy; Quản trị → Phân quyền cấm riêng được). Trên tab: form tạo giấy + danh sách giấy chạm tới tháng đang chọn (ô tìm tự động); từ *Chấm công → Sửa chi tiết* một người có nút *🏖️ Tạo giấy nghỉ cho người này* chuyển sang tab với người đó chọn sẵn. Chọn nhân viên, loại **P phép / KL không lương / TS thai sản / TN tai nạn**, từ ngày – đến ngày, lý do, người duyệt (trống = *Quản lý trực tiếp* trên hợp đồng). Lưu ⇒ số giấy `NP<yy><4 số>`, máy chủ ghi **các ngày làm việc** trong khoảng (bỏ CN + lễ) vào bảng chấm công: mã = loại, 0 công, nguồn **PhieuNghi**; bảng lương đọc như cũ (P → cột Phép; KL/TS/TN → không công không lương, mã TN mới thêm vào bộ gom). **🖨️ In** ra **GIẤY NGHỈ PHÉP** (/ KHÔNG LƯƠNG / THAI SẢN / DO TAI NẠN LAO ĐỘNG) có khung ký **TRƯỞNG BỘ PHẬN** (tên người duyệt) và **NGƯỜI XIN NGHỈ**, tên công ty lấy từ module Nhân sự. Sửa/xóa giấy ⇒ gỡ dòng cũ, áp lại mọi giấy của các tháng bị đụng, bảng lương tự tính lại. **Luật va chạm:** ngày đã có quẹt máy (nguồn May) hoặc sửa tay (ThuCong) thì **máy/tay thắng giấy**; ngược lại *Tổng hợp từ máy* được ghi đè dòng PhieuNghi thành May (người về sớm hơn giấy) — và sau mỗi lần tổng hợp giấy được **áp lại** cho tháng đó (xóa bảng công tháng rồi tổng hợp lại không mất phép). Nút 📅 Lịch nghỉ lễ vẫn ở tab Chấm công.

**18.3 Cột Không phép** — Lương công nhật có cột **Không phép** (đỏ khi > 0; dòng tính trước migration thì trống), có trong Excel (29 cột, vị trí tính theo tên cột), bản in, phiếu lương từng người và *Bảng lương của tôi*. **Không trừ tiền** (chuyên cần đã mất vì thiếu công). Trong tháng đang chạy, số này tính tới **hôm nay** nên ngày chưa kéo máy sẽ hiện là không phép — kéo máy / tổng hợp xong là tự đúng. **Chủ nhật KHÔNG bao giờ được tính** (anh hỏi 14/11): hàm `dsNgayLamViec` trong `utils/luongCongNhat.js` bỏ mọi ngày có `getUTCDay() === 0` và mọi ngày trong lịch lễ chung, trước khi đếm — bộ kiểm có phép *"T10/2026: 31 ngày − 4 CN = 27"* và phép *"không dòng nào cả tháng → 12 ngày, không ngày nào là CN"*. **v9.58:** rê chuột vào số Không phép (và trong phiếu lương từng người) là thấy **đúng danh sách ngày** bị đếm (`GET /bangluong` tính lại tại chỗ bằng cùng hàm) — nếu có Chủ nhật trong danh sách đó, gửi tôi ảnh; không có thì con số là ngày thường chưa có chấm công (chưa kéo máy / chưa tổng hợp).

**18.4 Thưởng chuyên cần bậc thang** — Nhân sự → Hợp đồng: *Kiểu thưởng* có thêm **"Chuyên cần bậc thang (theo số công)"** + bảng bậc (*Từ số công* → *Tiền thưởng*, ghi số TỔNG của bậc). Bảng lương: cột **Thưởng KPI/SP/CC** = tiền của bậc cao nhất có số công ≤ công đi làm; cột **Chuyên cần** (cố định) = 0 cho người này (form cảnh báo nếu ô cố định còn số; bảng lương cũng cảnh báo). Hợp đồng in ra điều khoản e)/3.4: *"Thưởng chuyên cần theo số ngày công: … đạt từ 28 công trở lên: 300.000 đồng; … Chỉ hưởng mức của bậc cao nhất đạt được …"*. Tab Đánh giá KPI không liệt kê người kiểu này (không có gì để chấm). Chưa khai bậc ⇒ 0 + cảnh báo.

**18.5 Kiểm sau deploy (T11/2026):**
1. Chấm công → 📅 Lịch nghỉ lễ: thấy các ngày từng gõ ở cài đặt cũ (nếu có); thêm 01/01/2027 "Tết Dương lịch"; mở Cài đặt chấm công → ô ngày lễ cũ thành dòng "Quản lý ở 📅 Lịch nghỉ lễ (đang có N ngày)".
2. Tính lương → tab **Tạo giấy nghỉ phép / Nghỉ cá nhân** (có trong menu trái ngay dưới Chấm công) → tạo giấy P cho một người, 17–18/11 (T3–T4) → toast "2 ngày làm việc đã ghi" → Chấm công → Sửa chi tiết người đó: 2 dòng 17, 18/11 mã **P**, 0 công, nguồn **PhieuNghi** → nút *🏖️ Tạo giấy nghỉ cho người này* đưa về tab với người đó chọn sẵn → 🖨️ In: tiêu đề **GIẤY NGHỈ PHÉP**, hai khung ký, tên trưởng bộ phận = Quản lý trực tiếp trên hợp đồng → Lương công nhật: dòng xanh *"… vì: Nghỉ phép NP26xxxx — <tên>"*, cột Phép +2, chuyên cần 0 (nếu có khoản cố định). Quản trị → Phân quyền: thấy chức năng *Tạo giấy nghỉ phép / Nghỉ cá nhân* để cấm riêng nếu cần.
3. Kéo máy / Tổng hợp từ máy sau ngày 17/11 nếu người đó thực tế có quẹt → dòng 17/11 đổi sang nguồn **May** có công (máy thắng); phiếu vẫn còn trong danh sách.
4. Thêm lịch **TS** cho một người 25/11 → 10/02/2027 → bảng chấm công T11 có dòng TS từ 25/11 (bỏ CN + lễ); T12 và T1 cũng có khi mở tới.
5. Lương công nhật: cột **Không phép** của người thiếu quẹt một ngày trong tuần (không phép, không nghỉ) = 1; người có phiếu P ngày đó = 0.
6. Hợp đồng một người: Kiểu thưởng = Chuyên cần bậc thang, bậc 20 → 300.000, 22 → 350.000; ô "Phụ cấp chuyên cần" đang có số → form báo bỏ qua → Lưu → Lương công nhật tự tính lại: cột Thưởng = 300.000 nếu công đi làm 20–21,5, = 350.000 từ 22; cột Chuyên cần = 0 → In hợp đồng: điều khoản e) liệt kê hai bậc.
7. Xóa phiếu P ở bước 2 → hai dòng P biến mất khỏi bảng chấm công, bảng lương tự tính lại, Phép về 0.

**18.6 Chưa làm / nói rõ:** phép năm **có lương** (12 ngày/năm) — anh chọn làm sau; phiếu nghỉ chưa có luồng duyệt điện tử (in ra ký tay — đúng yêu cầu); tạo phiếu không kiểm chồng khoảng với phiếu khác của cùng người (hai phiếu chồng ngày thì ngày đó mang mã của phiếu áp sau — thứ tự theo ngày bắt đầu); người nghỉ thai sản nhiều tháng vẫn nằm trong bảng lương với 0 công (không tự ẩn).

---

## 19. Nghiệm thu — cột Mã hàng ở phiếu bán hàng rộng theo mã dài nhất (v9.56, CHƯA deploy)

Anh yêu cầu 14/11: *"Giao diện lập phiếu bán hàng, cột mã hàng để thể hiện dài ô theo chữ cái của mã hàng. Hiện đang ngắn quá."*

Nguyên nhân: 9 cột còn lại của bảng dòng hàng đều ghim chiều rộng px, cột Mã hàng là cột duy nhất "co giãn" nên trên màn hẹp (máy tính bảng, modal) nó bị bóp — ô chọn chỉ còn vài ký tự. Sửa (`module.khohang.js` 9.56, `veDong()`): cột Mã hàng có **chiều rộng tối thiểu theo mã dài nhất trong danh mục** (≈9,5px/ký tự + 48px, kẹp 150–420px) và vùng bảng **cuộn ngang** khi không đủ chỗ thay vì bóp cột. Kiểm: lập phiếu bán hàng trên máy tính bảng → ô Mã hàng đọc trọn mã dài nhất; thêm dòng, chọn mã, quét mã vạch vẫn như cũ (chỉ đổi CSS của cột). Deploy: `node --check frontend\js\module.khohang.js` → copy + `index.html` (khohang **9.56**). Không máy chủ, không migration.

---

## 20. Nghiệm thu — "Bảng lương của tôi" tự có cho mọi tài khoản đã gắn mã nhân viên (v9.59, CHƯA deploy)

Anh yêu cầu 14/11: *"Bảng lương của tôi mặc định tự phân quyền cho user được gán mã nhân viên"*.

**Vì sao v9.52 chưa đủ:** v9.52 chỉ **ghi dòng** ghi-đè-riêng đúng lúc gắn (tạo / sửa user). Người gắn **trước** v9.52 không có dòng; và nhóm nào từng mở *Ma trận phân quyền* rồi bấm Lưu thì bị MERGE `CanView=0` cho mọi phân hệ chưa tick — MYPAY nằm trong số đó ⇒ vẫn "gắn rồi mà không thấy".

**Luật mới (`utils/loadUserContext.js`, lúc nạp phiên — không cần dòng nào trong CSDL, không backfill):** tài khoản có `Users.NhanVienID` ⇒ phân hệ **MYPAY Xem = có** và tab *Bảng lương của tôi* không bị ẩn, **bất kể nhóm**. Chỉ **nhường** một trường hợp: quản trị đã cố ý vào *Phân quyền riêng theo user*, tick "Ghi đè riêng" dòng MYPAY (hoặc chức năng *luongcuatoi*) rồi **bỏ Xem** — người đó vẫn bị chặn (màn hình hiện đúng dòng ấy nên không ai phải đoán). Dòng theo **nhóm** không được coi là "cấm" (lý do ở trên). Admin không đổi gì (thấy hết sẵn). Route `/bangluong/cuatoi` vốn chỉ `requireAuth` + tự lọc theo NhanVienID của chính phiên ⇒ luật này chỉ **mở menu**, không mở dữ liệu của ai khác. `moBangLuongCuaToi` v9.52 **giữ lại** (vô hại, trùng luật).

**Giao diện (`module.users.js` 9.59):** ở *Phân quyền riêng theo user*, dòng MYPAY ghi "Tài khoản đã gắn nhân viên ⇒ TỰ thấy phân hệ này, không cần tick" (hoặc "Tự có khi tài khoản được gắn nhân viên" nếu chưa gắn) — `/api/users` trả thêm `NhanVienID` cho việc này. Nhãn ô *Liên kết nhân viên* ở form tài khoản nói rõ gắn là tự thấy.

**Kiểm (sau `pm2 restart`):**
1. Lấy một tài khoản đã gắn nhân viên **từ trước 14/11**, không có tick MYPAY ở nhóm lẫn ở phân quyền riêng → người đó **đăng nhập lại** → menu có 🧾 *Bảng lương của tôi*, mở ra thấy lương của chính mình. (Chưa đăng nhập lại thì chưa thấy — quyền nạp lúc đăng nhập, giống mọi thay đổi phân quyền.)
2. Tài khoản **chưa gắn** nhân viên, nhóm không cấp MYPAY → vẫn không thấy (không mở bừa).
3. Muốn chặn riêng một người đã gắn: *Phân quyền riêng theo user* → dòng MYPAY tick "Ghi đè riêng", bỏ "Xem", Lưu → người đó đăng nhập lại → mất menu. Bỏ tick "Ghi đè riêng" → đăng nhập lại → có lại.
4. Quản lý user → Phân quyền riêng → chọn người đã gắn → dòng MYPAY có câu nhắc xanh; chọn người chưa gắn → câu nhắc xám.

**Chưa làm:** gỡ liên kết không tự xóa dòng v9.52 cũ (người gỡ sau khi gắn qua v9.52 vẫn thấy phân hệ, mở ra "chưa liên kết") — quản trị bỏ tick nếu cần; giữ nguyên như §16.2.

---

## 21. Nghiệm thu — "Bảng lương của tôi": lương trải vải cắt cho bộ phận Cắt, lương khoán may chỉ bộ phận May (v9.60, CHƯA deploy)

Anh yêu cầu 14/11: *"Bảng lương của tôi, nhân viên bộ phận cắt thể hiện bảng lương cắt trải vải. Chỉ thể hiện bảng lương của nhân viên được gắn vào."* và *"Lương khoán may chỉ những người thuộc bộ phận may mới hiện ra."*

**21.1 Lương trải vải cắt của chính mình.** Route tự phục vụ mới `GET /api/payroll/luongtraivaicat/cuatoi` (cùng kiểu hai route `/cuatoi` cũ: chỉ cần đăng nhập, lọc theo `Users.NhanVienID` của phiên — KHÔNG gác tab `luongtraivaicat`, nhân viên không có tab đó). Dùng đúng bộ loader + `tongHopLuongCat` của tab kế toán rồi **cắt về một người**: trả MỘT dòng lương của chính người đó (không gửi bảng của cả bộ phận, không gửi tổng lương/chênh lệch bộ phận), chỉ bàn cắt người đó **trải vải hoặc cắt** (luật v9.20, lọc theo ID — bản backend của `laBanCuaNV`, bộ kiểm so với bản màn hình), còn **quỹ / tổng giờ / lương 1 giờ của cả bộ phận giữ** để phiếu nói được cách chia. Không thuộc bộ phận "Cắt" ⇒ `boPhanCat:false`, không tải sổ cắt. Màn "Bảng lương của tôi" dựng phiếu bằng **chính** `buildLuongCatNVBody` của tab kế toán (`ModulePayroll.buildLuongCatNVBody` — cùng cách chia, cùng câu chữ); kỳ in theo dữ liệu (`d.thang/d.nam`) chứ không theo kỳ đang chọn ở tab kế toán. Người không thuộc bộ phận Cắt **không có mục này** (không vẽ mục trống). Máy chủ chưa cập nhật / lỗi ⇒ hai phần trên vẫn hiện, phần cắt ghi rõ "Không tải được…".

**21.2 Lương khoán may chỉ bộ phận May.** `/luongmay/cuatoi` trả thêm `boPhan` + `boPhanMay` (so TÊN bộ phận = "May", trim + không phân biệt hoa thường — cùng kiểu luật "Cắt" ở `loadGioCongCat`; **tên bộ phận là dữ liệu Danh mục, đổi tên là đổi luật**). Màn chỉ vẽ mục *Lương khoán may* khi `boPhanMay`, **hoặc khi tháng đó có dòng khoán may thật** (giả định tôi tự chốt: tiền có thì không giấu, dù người đó không thuộc bộ phận May — nếu anh muốn chặt đúng theo bộ phận, bỏ vế `(may.rows || []).length > 0` ở `hienMay`). Máy chủ cũ chưa trả `boPhanMay` ⇒ hiện như trước.

**Kiểm (sau copy + `pm2 restart`):**
1. Đăng nhập tài khoản gắn nhân viên bộ phận **Cắt** → Bảng lương của tôi: dưới Lương công nhật có **PHIẾU LƯƠNG TRẢI VẢI CẮT — Tháng m/yyyy** (giờ công, hệ số, quỹ, lương 1 giờ, LƯƠNG KHOÁN THÁNG = giờ × hệ số × lương 1 giờ) + bảng "Bàn cắt có … tham gia" — đối chiếu với Tính lương → Lương trải vải cắt → bấm đúng người: **cùng số**. Mục *Lương khoán may* **không hiện** (trừ khi người đó có dòng khoán may thật).
2. Tài khoản gắn nhân viên bộ phận **May** → có mục Lương khoán may (kể cả trống: "Không có lương khoán may tháng này."), **không** có mục trải vải cắt.
3. Tài khoản gắn nhân viên bộ phận khác (Kho, Kinh doanh…) → chỉ Lương công nhật.
4. Đổi kỳ ở ô Kỳ lương → phiếu cắt in đúng tháng vừa chọn (không phải tháng của tab kế toán).

**Deploy:** `node --check backend\routes\payroll.js`, `frontend\js\module.payroll.js`, `frontend\js\module.mypay.js` → `node backend\utils\kiem_mypay_luong_trai_vai_cat.js` (bộ kiểm MỚI — gọi thẳng route thật với CSDL giả; đồng thời chạy lại `kiem_luong_cat_marap_excel.js` vì tôi đụng `buildLuongCatQuyBody`/`buildLuongCatNVBody`) → copy 3 file + `index.html` (payroll **9.60**, mypay **9.60**) → `pm2 restart`. Không migration.

---

## 22. Nghiệm thu — HỢP ĐỒNG MUA BÁN + KÝ ĐIỆN TỬ qua link (v9.61, CHƯA deploy, CHƯA `node --check`)

Anh yêu cầu 14/11 (4 tin nhắn + trả lời câu hỏi): ký HĐ mua bán với công ty / hộ KD; gửi link ký; bên không có chữ ký số ký **OTP** (email ngay, SMS/Zalo làm sẵn); bên có USB token **ký ngay trên web**; MOYN **ký số tự động** + dấu thời gian (TSA công cộng); trang quản trị (lọc, tạo HĐ, gửi lại OTP/link, nhật ký, tải PDF đủ chữ ký); portal khách responsive; soạn HĐ **riêng** (không gắn đơn hàng sỉ), **tải file mẫu lên** như HĐLĐ, điền các trường. PRD: `docs/PRD_v961_hop_dong_mua_ban_ky_dien_tu.md`.

**22.1 Điểm phải biết trước khi thử**
- **"Ký ngay trên web bằng USB token"** = công cụ **MOYN Ký số** (`tools\MoynKySo`, C#, anh build bằng `dotnet publish` — xem csproj) chạy trên máy người ký (khách hoặc giám đốc), lắng nghe `localhost:8765`, trang web đưa hash → token ký (Windows hỏi PIN) → máy chủ ghép CMS + dấu thời gian. Không cài công cụ thì dùng đường **tải PDF về → ký bằng phần mềm CA / Adobe → tải lên** (máy chủ kiểm: phần đầu file = bản gửi, chữ ký hợp lệ, hạn chứng thư, MST). Đây là cách mọi nền tảng ký trên web làm — trình duyệt không đọc được token.
- **MOYN ký số tự động** cần `.env`: `HOPDONG_KY_TU_DONG=pfx` + `HOPDONG_PFX_PATH/PASS` (chứng thư file xin CA), hoặc `=pkcs11` + `HOPDONG_PKCS11_DLL/PIN` (token cắm cố định ở máy chủ, cần `npm install pkcs11js` — module native, máy chủ phải có Build Tools). **Để trống = TẮT**: sau khi khách ký, hợp đồng sang "Chờ MOYN ký số", người có năng lực **HOPDONG/kyso** (Phân quyền → tick) ký bằng công cụ trên máy mình hoặc tải bản đã ký lên. 🔴 PKCS#11: PIN sai là phần mềm KHÔNG thử lại (token khóa).
- **Dấu thời gian**: mặc định `http://timestamp.digicert.com` (công cộng, miễn phí — anh chốt). TSA lỗi/không tới ⇒ vẫn ký, nhật ký ghi "không có dấu thời gian", nút "Ký số lại" để ghép lại.
- **OTP**: email đi ngay khi máy chủ có `SMTP_*`; SMS (`SMS_PROVIDER=esms|speedsms` + key) và Zalo ZNS (`ZALO_ZNS_TEMPLATE_OTP`) đã làm sẵn, bật khi có tài khoản — chưa cấu hình thì nút kênh đó **mờ**, không lỗi.
- **Bản khách ký số** (nếu khách ký số) được **giữ nguyên file riêng** — không ghép trang chứng nhận vào (ghép là chữ ký khách vô hiệu). Bản cuối = bản gốc + trang CHỨNG NHẬN KÝ ĐIỆN TỬ (ghi SHA-256 bản khách ký, OTP, IP, thời điểm, QR mã tra cứu) + chữ ký số MOYN (+TSA).
- Nhật ký (audit trail) **chỉ thêm**, mỗi dòng băm nối dòng trước — màn Nhật ký báo "chuỗi băm nguyên vẹn" / "KHÔNG khớp từ dòng #n".

**22.2 Chuẩn bị máy chủ (anh làm, theo thứ tự)**
1. `cd D:\QLSX\backend && npm install pdf-lib pkijs asn1js node-forge @signpdf/signpdf @signpdf/placeholder-pdf-lib @signpdf/utils mammoth` (+ `pkcs11js` chỉ khi dùng token ở máy chủ).
2. Chạy `database\migration_v893.sql` → `cd database && node tao_file_cai_dat.js`.
3. `backend\.env`: thêm theo mẫu `.env.example` (mục v9.61 + mục Email SMTP). Tối thiểu để thử: `SMTP_*`, `PUBLIC_BASE_URL`. Ký tự động: `HOPDONG_KY_TU_DONG` + PFX/PKCS11.
4. `node backend\utils\thu_ky_so.js --chungthu` (đọc được chứng thư?) → `node backend\utils\thu_ky_so.js <file bất kỳ>.pdf` → mở `_da_ky.pdf` bằng **Adobe Acrobat Reader** → bảng Signatures: chữ ký hợp lệ (chuỗi tin cậy có thể báo "unknown" nếu CA chưa trong danh sách tin cậy của Adobe — bình thường với CA VN, bấm "Add to trusted"), có dòng *timestamp*.
5. Copy file (§3 v9.61) + `index.html` → `pm2 restart` → `pm2 logs` không có dòng lỗi `Cannot find module`.
6. Build công cụ: máy có .NET 8 SDK: `cd tools\MoynKySo && dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true` → chép `MoynKySo.exe` vào `D:\QLSX\frontend\tools\MoynKySo\`. (Sửa `ORIGINS` trong Program.cs nếu tên miền khác.)
7. Quản trị → Phân quyền: cấp phân hệ HOPDONG cho nhóm kế toán/kinh doanh; tick năng lực **Ký số phía MOYN** cho giám đốc/kế toán trưởng.

**22.3 Thử — luồng OTP (chính)**
1. Hợp đồng mua bán → **Cấu hình ký**: điền bên bán (tên pháp nhân, MST, địa chỉ, người ký, chức vụ, email kế toán), Lưu; bấm **Kiểm bộ ký** → thấy chứng thư (hoặc "TẮT").
2. **Mẫu hợp đồng**: có `HDMB_CHUAN` (migration); bấm Sửa → sửa điều khoản → Lưu (phiên bản tăng, Lịch sử có bản cũ). Thử **Tải file mẫu lên** một .docx → mở ra trong khung soạn → chèn biến → Lưu. In thử: biến hiện ‹TenBien›.
3. **Danh sách → + Tạo hợp đồng**: chọn mẫu, chọn khách từ danh mục (các ô bên mua tự điền) hoặc gõ tay, **SĐT + email người ký = của chính anh để thử**, thêm 2 dòng hàng, điền các ô "Các trường trong mẫu", Lưu → màn chi tiết.
4. **Xem trước** (biến còn trống thì báo) → **Xuất bản & gửi link ký** (Email) → thấy link; email đến hộp thư anh.
5. Mở link trên **điện thoại**: thấy hai bên, bảng hàng, PDF; tab *Ký bằng mã OTP* → chọn kênh Email → **Gửi mã OTP** → mã về email → nhập → vẽ chữ ký → tick đồng ý → **Tôi đồng ý ký kết / Xác nhận đơn hàng** → báo thành công; 10–20 giây sau (ký tự động bật) có nút **Tải bản PDF có chữ ký số**.
6. Quản trị: hợp đồng **Đã ký**; chi tiết: bên mua ✅ OTP email → đích che, IP; bên bán ✅ chứng thư; **Tải nhật ký** → chuỗi băm nguyên vẹn, có dòng XEM / GUI_OTP / OTP_DUNG / KY_OTP / KY_SO_MOYN / DAU_THOI_GIAN; **Tải PDF đã ký số** → Adobe Reader: trang cuối "CHỨNG NHẬN KÝ ĐIỆN TỬ", bảng Signatures hợp lệ. Đổi **Thanh toán** → lọc "Chưa thanh toán" đúng.
7. Thử sai: nhập OTP sai 5 lần → khóa 15 phút; gửi OTP > 6 lần/giờ → chặn; mở link sau khi đã xuất bản lại → "không còn hiệu lực"; **Từ chối** → quản trị thấy lý do, **Thu hồi về nháp** → sửa → xuất bản lại.
8. Ký tự động TẮT: sau bước 5 hợp đồng ở **Chờ MOYN ký số**; người có kyso: **Ký bằng USB token máy này** (công cụ đang chạy, chọn chứng thư, nhập PIN) hoặc **PDF chờ MOYN ký** → ký Adobe → **Tải lên bản đã ký**.

**22.4 Thử — khách ký số**: trên trang ký, tab *Ký bằng chữ ký số*: Cách 1 (công cụ) hoặc Cách 2 (tải về → ký Adobe/plugin CA → tải lên). Tải lên file **ghi lại toàn bộ** (vd in lại PDF) → báo "phần mềm ký đã GHI LẠI toàn bộ file…". Sau ký: quản trị có nút **Bản khách đã ký số (file riêng)**; trang chứng nhận ghi SHA-256 bản đó.

**22.5 Tra cứu công khai**: `https://thoitrangmoyn.id.vn/ky.html?tra=<mã>` (QR cuối PDF) → trạng thái + hash, không lộ nội dung.

**22.6 Chưa làm (nói trước):** ~~kiểm chuỗi tin cậy tới gốc NEAC / CRL~~, ~~ký từ xa qua CA~~, ~~phụ lục/thanh lý~~, ~~nhắc hạn ký~~ → **đã làm ở v9.62 (§23)**. Còn lại: OCSP (chỉ CRL); nhiều người ký mỗi bên; hợp đồng nguyên tắc nhiều đơn.

---

## 23. Nghiệm thu — HỢP ĐỒNG MUA BÁN giai đoạn 2 (v9.62, CHƯA deploy, CHƯA `node --check`)

Anh nói 14/11: *"làm luôn giai đoạn 2"* = 5 việc ở PRD §7 GĐ2: **phụ lục / thanh lý** hợp đồng, **hóa đơn** (số/ngày HĐĐT), **nhắc hạn ký tự động**, **kiểm chuỗi tin cậy + CRL**, **ký từ xa qua CA** (VNPT SmartCA / chuẩn CSC) cho cả khách lẫn MOYN. Làm trên nền §22 — §22 phải chạy được trước (thư viện, migration_v893, SMTP).

**23.1 Điểm phải biết trước khi thử**
- **Ký từ xa qua CA**: khách (hoặc giám đốc) KHÔNG cần USB token, không cài gì — nhập SĐT/CCCD đăng ký SmartCA → máy chủ gửi hash cho CA → khách bấm xác nhận trên **app SmartCA** (hoặc nhập OTP nếu CA theo chuẩn CSC) → CA trả chữ ký → máy chủ ghép vào PDF như ký USB token. 🔴 **Cần hợp đồng dịch vụ tích hợp với CA** (tài khoản SP) — chưa có thì mục này **ẩn** (không khai `KYTUXA_NHA` trong .env). ⚠️ Mã viết theo tài liệu công khai, **chưa đối chiếu được với tài khoản thật** (sandbox chết, chưa có tài khoản) — lần gọi thật đầu tiên xem `pm2 logs` dòng `[kyTuXa]` (ghi gọn trả lời của CA, không ghi mật khẩu); tên trường lệch thì gửi tôi đoạn log, sửa `utils\kyTuXa.js` một chỗ.
- **Chuỗi tin cậy**: chép file `.cer/.pem` của CA gốc + CA trung gian (tải từ cổng NEAC `rootca.gov.vn` hoặc trang CA: VNPT-CA, Viettel-CA, FPT-CA…) vào `D:\QLSX\backend\chungthu_goc\` — đọc lại ngay khi file đổi, **không cần restart**. Chưa có file nào ⇒ cột ghi "Chưa kiểm chuỗi tin cậy", không coi là lỗi. CRL tải từ điểm phân phối trong chứng thư (đệm 6 giờ) — máy chủ phải ra được internet.
- **Nhắc hạn ký**: mỗi ngày đúng giờ (Cấu hình ký → mặc định 08:30), hợp đồng *Chờ ký* còn ≤ N ngày (mặc định 2) → **gửi lại link** (link cũ vô hiệu — CSDL chỉ giữ hash) + ghi `NhacLanCuoi`; quá hạn → *Hết hạn* + email kế toán. 🔴 Nhắc **KHÔNG dời hạn ký** (rà chéo bắt được: gửi lại link tay thì đặt lại hạn = hôm nay + 7, nhắc tự động mà cũng vậy thì hợp đồng không bao giờ hết hạn — đã chặn trong `nhacHanKy.js`).
- **Phụ lục / thanh lý** = một "hợp đồng" loại `PhuLuc` / `ThanhLy` trỏ tới **hợp đồng gốc đã ký**; số tự sinh `PL<yy>0001` / `TL<yy>0001`; ký y như hợp đồng (OTP / ký số / từ xa); mẫu `PHULUC_CHUAN` / `THANHLY_CHUAN` có biến `{{HopDongCha_So}}`, `{{HopDongCha_Ngay}}`, `{{NoiDungSuaDoi}}`, `{{KetQuaThucHien}}`, `{{DaThanhToan}}`… (anh sửa mẫu theo ý). Hợp đồng gốc chỉ được chọn khi **Đã ký** và là loại hợp đồng (không phụ lục của phụ lục).
- **Hóa đơn**: chỉ ghi tay số + ngày HĐĐT để kế toán đối chiếu (hiện ở danh sách 🧾) — **không** tự xuất hóa đơn (phân hệ HĐĐT v8.36 riêng).

**23.2 Chuẩn bị máy chủ**
1. Xong §22.2 (thư viện, v893, SMTP) → chạy `database\migration_v894.sql` → `cd database && node tao_file_cai_dat.js` → copy file §3 v9.62 → `pm2 restart` → `pm2 logs` thấy dòng `[hopdong] Lịch nhắc hạn ký: mỗi ngày 08:30 (30 8 * * *)`.
2. Tạo thư mục `D:\QLSX\backend\chungthu_goc\` (máy chủ tự tạo khi mở Cấu hình ký) → chép .cer của CA gốc (ít nhất CA cấp chứng thư cho MOYN + CA của khách hay ký).
3. (Khi có tài khoản CA) `.env`: mục `KYTUXA_*` theo `.env.example` → `pm2 restart` → Cấu hình ký hiện dòng "Ký từ xa qua CA ● …".
4. Bộ kiểm: `node backend\utils\kiem_hop_dong_gd2.js` (mục 2–3 cần thư viện §22.2; mục 3 ghi tạm `__kiem_tam_root.pem` vào `chungthu_goc\` rồi tự xóa).

**23.3 Thử**
1. **Cấu hình ký**: thấy 3 dòng mới (Ký từ xa, Chứng thư CA gốc — liệt kê file đã chép, CSDL v894 nếu chưa chạy); mục **Nhắc hạn ký tự động**: bật, 2 ngày, 08:30 → Lưu (lịch đổi ngay, không restart) → **Chạy nhắc ngay (thử)** → toast "Đã chạy: 0 hết hạn, 0 nhắc".
2. **Nhắc hạn**: tạo HĐ thử, xuất bản gửi link (hạn 7 ngày); trong SQL tạm đặt `UPDATE HopDongMB SET HanKy = DATEADD(day, 1, SYSDATETIME()) WHERE SoHopDong='<số>'` → bấm **Chạy nhắc ngay** → email link MỚI tới hộp thư; chi tiết HĐ: dòng "Nhắc hạn ký lần cuối …", nhật ký `NHAC_HAN` + `GUI_LINK`; **hạn ký không đổi** (vẫn +1 ngày); bấm lần nữa cùng ngày → "0 nhắc" (1 lần/ngày). Đặt `HanKy` = hôm qua → Chạy → HĐ sang **Hết hạn**, email kế toán, link cũ mở ra "hết hạn".
3. **Phụ lục**: mở HĐ **Đã ký** → nút **➕ Tạo phụ lục** → form điền sẵn loại = Phụ lục, hợp đồng gốc, bên mua, tên; mẫu `PHULUC_CHUAN` tự chọn; điền *Nội dung sửa đổi*; Lưu → số `PL26xxxx`; **Xem trước** thấy số/ngày hợp đồng gốc; xuất bản → khách ký OTP y như HĐ. Chi tiết HĐ gốc: bảng "Phụ lục / thanh lý thuộc hợp đồng này" → Mở. Danh sách: lọc **Loại văn bản = Phụ lục**. Thử sai: tạo phụ lục không chọn gốc → chặn; chọn gốc là HĐ chưa ký → máy chủ 400.
4. **Thanh lý**: như trên với **➕ Tạo biên bản thanh lý**, mẫu `THANHLY_CHUAN` (điền *Kết quả thực hiện*, *Đã thanh toán*…).
5. **Hóa đơn**: HĐ Đã ký → dòng **Hóa đơn điện tử**: số + ngày → Lưu → danh sách hiện 🧾 số; nhật ký `HOA_DON`.
6. **Chuỗi tin cậy**: sau khi chép .cer CA gốc, khách (hoặc MOYN) ký số → bảng *Các bên ký* có dòng 🔗 "✔ Chuỗi tin cậy hợp lệ tới gốc "…" · không bị thu hồi (CRL)" (xanh) hoặc "✖ …" (đỏ, vd chứng thư CA lạ / hết hạn / đã thu hồi); trang CHỨNG NHẬN cuối PDF ghi cùng dòng; nhật ký `CHUOI_TIN_CAY`. Chưa chép .cer → "Chưa kiểm chuỗi tin cậy (chưa nạp chứng thư gốc)" (vàng).
7. **Ký từ xa (khi có tài khoản CA)**: trang ký của khách → tab *Ký bằng chữ ký số* có **Cách 0 — Ký từ xa qua VNPT SmartCA**: nhập SĐT → tick → **Gửi yêu cầu ký** → điện thoại nhận thông báo SmartCA → xác nhận → trang tự báo "Đã ký số từ xa" (hỏi mỗi 2 giây, dừng sau 3 phút). Phía MOYN: HĐ *Chờ MOYN ký số* → nút **📲 Ký từ xa qua VNPT SmartCA** → nhập SĐT người ký → xác nhận trên app → Đã ký. CA chuẩn CSC: thay xác nhận app bằng ô nhập OTP.

**23.4 Cách chữa khi hỏng**
- Máy chủ không lên sau copy: `pm2 logs` → `Cannot find module './utils/nhacHanKy'` / `kyTuXa` / `chuoiTinCay` ⇒ thiếu file mới (§3 v9.62).
- Form tạo không có ô "Loại văn bản" ⇒ `index.html` chưa bump `module.hopdong.js?v=9.62` (sidebar phải hiện v9.62).
- Trang ký của khách không có Cách 0 ⇒ bình thường khi chưa khai `KYTUXA_NHA`; đã khai mà vẫn không ⇒ `ky.html` chưa copy (`ky.js?v=9.62`) hoặc thiếu `KYTUXA_SP_ID/PASSWORD` (vnptsmartca) / `CLIENT_ID` hay `USERNAME` (csc).
- Nhắc hạn không chạy ⇒ `pm2 logs` lúc khởi động không có dòng `[hopdong] Lịch nhắc hạn ký` ⇒ xem lỗi ngay trên dòng `không đặt được lịch`; giờ máy chủ phải đúng múi giờ VN.

---

## 24. Nghiệm thu — "Doanh thu thuần" Dashboard kinh doanh = Báo cáo kinh doanh (v9.63, CHƯA deploy)

Anh gửi ảnh 16/11: cùng kỳ 01/01–16/11/2026, Dashboard ghi doanh thu thuần **9.257.966.214**, Báo cáo kinh doanh ghi **9.273.601.772**, cùng 867 phiếu.

**Vì sao lệch — hai màn hình đang dùng HAI định nghĩa, không màn nào đúng chuẩn kế toán:**

| | Dashboard (cũ) | Báo cáo KD (cũ) |
|---|---|---|
| Doanh thu | `SUM(TongThanhToan)` = **gồm VAT** 9.465.528.673 | `SUM(TienTruocVAT)` = chưa VAT 9.273.601.772 |
| Hàng khách trả | trừ 207.562.459 (gồm VAT) | **không trừ** (migration_v676 để bảng riêng "muốn trừ thì trừ có ý thức" — chưa ai trừ) |
| Thuần | 9.257.966.214 | 9.273.601.772 |

Hai số gần nhau là trùng hợp (VAT ≈ 191,9 triệu ≈ hàng trả 207,6 triệu). Chuẩn VAS: **doanh thu thuần = doanh thu chưa VAT − hàng bán bị trả lại (chưa VAT)**. v9.63 đưa cả hai về đúng một công thức.

**Thay đổi**
- Báo cáo KD: thêm dòng **"Hàng bán bị trả lại"** (phiếu nhập lại theo *ngày nhập* trong kỳ, chưa VAT) giữa "Doanh thu bán hàng" và "DOANH THU THUẦN"; **giá vốn** tính trên (số cái bán − số cái trả) — hàng trả đã nhập kho lại thì giá vốn của nó không còn là giá vốn hàng bán; bảng B ghi "(−x trả)" ở cột SL, mã chỉ có trả lại (bán kỳ trước) hiện dòng âm; Excel có thêm cột SL bán / SL trả / SL thuần.
- Dashboard: ba thẻ Doanh thu / Hàng khách trả / Doanh thu thuần và cột tương ứng trong bảng khách **chuyển sang chưa VAT**; số gồm VAT (= số vào công nợ) hiện ở dòng phụ của thẻ và tooltip từng ô. **Đã thu / Còn nợ không đổi** (tiền thật). Biểu đồ 12 tháng cũng chưa VAT.

**v9.64 (cùng ngày, Nguyen: "lãi phải lấy giá SAU trừ CK NPP — thực tế thu về theo phiếu xuất kho bán hàng"):**
- Báo cáo KD bảng B: doanh thu từng mã = Σ(tiền dòng × TienTruocVAT/TongTienHang **của chính phiếu đó**) — CK NPP của từng phiếu, không còn phân bổ một tỷ lệ chung cả kỳ. Tổng các dòng = DOANH THU THUẦN (lệch tối đa vài đồng do làm tròn từng dòng).
- Tab **Giá vốn hàng hóa**: thêm cột **Giá thực thu (1 cái)** = bình quân mọi phiếu bán chưa hủy, sau CK shop + CK NPP từng phiếu, chưa VAT; **Lãi gộp 1 cái = giá thực thu − giá vốn** (kèm %); giá niêm yết của thẻ kho chỉ còn để tham khảo. Mã chưa bán lần nào: lãi tạm theo niêm yết, ghi chữ "niêm yết" xám. `module.baocao.js` **9.64**.

**Nghiệm thu (sau copy + restart, Ctrl+F5):**
0. Tab Giá vốn: mã bán cho NPP có CK (vd 10%) phải thấy Giá thực thu ≈ 90% giá niêm yết (nếu không CK shop) và lãi 1 cái giảm tương ứng so với trước; rê chuột vào ô thấy "Đã bán n cái, lần cuối …".
1. Cùng kỳ 01/01–16/11: Dashboard "Doanh thu trong kỳ (chưa VAT)" phải = Báo cáo KD dòng "Doanh thu bán hàng" = **9.273.601.772** (số cũ của báo cáo, nếu không có phiếu mới). Dòng phụ "gồm VAT 9.465.528.673".
2. Dashboard "Doanh thu thuần" = Báo cáo KD "DOANH THU THUẦN" — **bằng nhau đến từng đồng**. Giá trị ≈ 9.273.601.772 − hàng trả chưa VAT (≤ 207.562.459; bằng đúng số đó nếu các phiếu trả không có VAT).
3. Báo cáo KD: "Giá vốn hàng bán" **giảm** so với 6.530.538.114 đúng bằng (số cái trả × giá vốn) — lãi gộp đổi theo; ô "Doanh thu thuần" ghi "… − n phiếu trả lại (x cái, y đ)".
4. Lọc Dashboard theo một khách có phiếu trả: cột Hàng trả < số trên phiếu nhập lại nếu phiếu có VAT; rê chuột vào ô thấy "Gồm VAT: …" = đúng số trên phiếu.
5. Bộ kiểm `kiem_doanh_thu_thuan_dashboard_bao_cao.js` — chạy kịch bản giả qua ĐÚNG hai route thật, hai bên ra cùng 1.314.000.

**Hệ quả anh nên biết:** từ v9.63, tổng cột "Doanh thu" trên Dashboard **không** còn bằng tổng tiền ghi trên phiếu (thiếu phần VAT) — ai quen đối chiếu với công nợ thì nhìn dòng "gồm VAT". Lãi gộp / lợi nhuận trên báo cáo các kỳ có hàng trả sẽ **thấp hơn** số cũ (đúng hơn).

---

## 25. Nghiệm thu — "Xem năm trước" ở mọi kỳ báo cáo + công nợ "tính đến ngày" (v9.65, CHƯA deploy)

Anh nói 16/11: *"các kỳ xem báo cáo, công nợ chưa có xem năm trước. rà soát lại hết thêm xem năm trước"*. Rà cả 5 màn có kỳ:

| Màn | Trước | v9.65 |
|---|---|---|
| Báo cáo kinh doanh (5 tab) | Tháng này · Tháng trước · Quý này · Năm nay | + **Quý trước**, **Năm trước** (01/01–31/12 năm trước) |
| Dashboard kinh doanh | Tháng này · Năm nay | + **Tháng trước**, **Năm trước** |
| Hóa đơn điện tử | Tháng này · Tháng trước | + **Năm nay**, **Năm trước** (xem trong phần mềm; bấm *Tải từ TCT* cả năm sẽ lâu) |
| Công nợ — sổ chi tiết / phiếu thu / chi / điều chỉnh / sổ quỹ | select Tháng/Quý/Năm đã có 4 năm (v9.17) | ghi rõ **"Năm 2026 (năm nay)" / "Năm 2025 (năm trước)"** |
| Công nợ — **bảng tổng hợp** KH / NCC / gia công | chỉ lũy kế đến hiện tại, **không có kỳ** — đây là chỗ "chưa có xem năm trước" | thêm **"Tính đến ngày"** (select kỳ nhanh hoặc gõ ngày): Còn nợ = số dư tại hết ngày đó; xuất Excel + sổ chi tiết mở từ bảng cũng cắt đến cùng mốc |

**Cách tính "tính đến ngày"** (backend `?denNgay=`): mỗi nguồn chỉ cộng chứng từ có ngày ≤ mốc — KH: phiếu BH `NgayBan`, phiếu thu `NgayThu`, điều chỉnh `Ngay`, nhập lại `NgayNhap`; NCC: nhập vải `NgayNhap`, nhập/trả PK `Ngay`, phiếu chi `NgayChi`, thu lại `NgayThu`, điều chỉnh `Ngay`, trả vải `NgayXuat`, nhập kho hàng hóa `NgayNhap`; gia công/in thêu: ngày QC của dòng (cùng mốc với sổ chi tiết). Không chọn = lũy kế như cũ, số không đổi một đồng.

**Thử:**
1. Công nợ KH → *Tính đến ngày* chọn "Năm 2025 (năm trước)" → ô ngày = 31/12/2025, bảng vẽ lại, dòng tóm tắt ghi "(tính đến 31/12/2025)". Bấm tên một khách → sổ chi tiết mở với kỳ … → 31/12/2025: **Dư cuối kỳ phải = Còn nợ** trên bảng. Bấm ✖ → về số hiện tại = số cũ.
2. Xuất Excel khi đang chọn mốc → tiêu đề "Số dư tính đến ngày 31/12/2025", tên file có `_den_2025-12-31`.
3. NCC + gia công: như trên. Gia công: dòng QC sau mốc không tính.
4. Báo cáo KD: bấm **Năm trước** → từ 01/01 đến 31/12 năm trước; **Quý trước** vào tháng 1 phải ra Q4 năm trước (bộ kiểm có ca này).
5. Dashboard: **Tháng trước** = 01→cuối tháng trước; **Năm trước**.

Màn **danh sách** nhập kho / nhập lại / phiếu BH (lọc ngày tự do, không phải kỳ báo cáo) tôi để nguyên — nói nếu anh muốn thêm nút ở đó.

---

## 26. Nghiệm thu — phiếu nhập kho hàng hóa "Tồn đầu kỳ / nhập khác" KHÔNG vào công nợ NCC (v9.66, CHƯA deploy)

Anh nói 16/11: *"Trong công nợ nhà cung cấp có Nhập tồn kho hàng hoá đầu kỳ — cái này không tính vào công nợ trả nhà cung cấp."*

**Vì sao nó lọt vào:** phiếu nhập kho hàng hóa trước v9.66 chỉ có 2 loại — *Từ nhà cung cấp* (bắt chọn NCC, cộng công nợ) và *Từ sản xuất* (bắt chọn lệnh SX, không đơn giá). Nhập tồn đầu kỳ không thuộc loại nào, kế toán buộc phải chọn "Từ nhà cung cấp" + một NCC bất kỳ ⇒ cả kho hàng đầu kỳ thành nợ phải trả NCC đó.

**v9.66:** loại thứ ba **"Tồn đầu kỳ / nhập khác (có giá vốn, không công nợ)"** — có đơn giá (= giá vốn, vào bình quân gia quyền giá vốn như phiếu NCC), **không** gắn NCC, **không** gắn lệnh SX, **không** vào công nợ (bảng tổng hợp lẫn sổ chi tiết NCC chỉ cộng loại *Từ nhà cung cấp* — mã cũ, không đụng). Tồn kho, báo cáo tồn vẫn tính như mọi phiếu nhập. Mã hàng mới sinh từ phiếu này được đặt *Nguồn hàng = Đặt ngoài* (sửa ở Danh mục nếu là hàng tự may). Không migration.

**Việc anh làm với phiếu ĐÃ nhập:** mở phiếu tồn đầu kỳ đang gắn NCC → **Sửa** → Loại nhập = "Tồn đầu kỳ / nhập khác" → Lưu (ô NCC biến mất; phiếu giữ nguyên dòng hàng + đơn giá). Công nợ NCC đó giảm đúng bằng tổng phiếu. Nhiều phiếu: chạy `database\sua_phieu_ton_dau_ky_v966.sql` trong SSMS — KHỐI A chỉ SELECT (xem danh sách phiếu khớp NCC/ghi chú "Nhập tồn kho hàng hoá đầu kỳ"), KHỐI B UPDATE trong transaction, **mặc định ROLLBACK**; đọc kết quả đúng rồi mới đổi dòng cuối thành COMMIT. **Sửa dữ liệu thật — lưu kết quả KHỐI A trước để đổi ngược.**

**Vải và phụ kiện tồn đầu kỳ** (anh hỏi tiếp 16/11: *"Nhập tồn kho vải đầu kỳ cũng chưa có"*): phiếu nhập vải và phiếu nhập phụ kiện **không có loại phiếu** — chúng chỉ vào công nợ khi **có chọn NCC** (`NCC_ID IS NOT NULL`). Phần mềm đã cho lưu phiếu nhập vải **không chọn NCC** từ trước; v9.66 chỉ đổi nhãn ô NCC thành *"-- Không có (tồn đầu kỳ / nhập khác — không vào công nợ) --"* (`module.khovai.js` 9.66) để kế toán biết đường. Phiếu cũ đang gắn NCC giả "Nhập tồn kho vải đầu kỳ": chạy `database\sua_phieu_ton_dau_ky_vai_pk_v966.sql` — KHỐI A liệt kê NCC khớp tên (`%tồn kho vải đầu kỳ%`, `%tồn kho phụ kiện đầu kỳ%`, `%tồn đầu kỳ%`) + từng phiếu vải/phụ kiện + cột *SoPhieuChi_PhaiLa0* (nếu > 0 là đã từng chi tiền cho NCC giả → dừng lại); KHỐI B đặt `NCC_ID = NULL`, mặc định ROLLBACK. Giá nhập vải / giá vốn không đổi. Nếu NCC giả đặt tên khác, gửi tên để tôi sửa LIKE.

**Thử:** lập phiếu loại mới, có đơn giá, không chọn gì ở ô Nguồn → lưu được (trước đây báo "phải chọn nhà cung cấp"); Công nợ NCC không đổi; Báo cáo tồn hàng hóa có dòng "Nhập kho (tồn đầu kỳ / khác)"; tab Giá vốn: mã mới có giá = đơn giá phiếu; danh sách phiếu lọc được theo loại mới; Excel ghi "Tồn đầu kỳ / nhập khác".

---

## 27. Nghiệm thu — sản lượng theo lệnh SX ⇒ thưởng theo sản phẩm TỰ ĐỘNG: nhân viên may mẫu, ảnh, video (v9.67, CHƯA deploy, cần migration_v895)

Anh yêu cầu 16/11: *"Ký hợp đồng có nhân viên trả thưởng theo kiểu sản phẩm. Phần chỉ định sản xuất thêm trường nhân viên may mẫu, chọn trong list nhân viên. Phần tính lương sẽ cập nhật từ đây."* và *"Thêm chức năng cập nhật ảnh, video gán theo lệnh sản xuất — số lượng ảnh, video theo danh mục trong ký hợp đồng KPI theo sản phẩm (SL × đơn giá), phần tính lương sẽ cập nhật từ đây, không phải cập nhật tay."*

**Cách tôi hiểu và làm (giả định — anh xem có đúng ý không):**

1. **Một cơ chế cho cả hai**: bảng `SanLuongTheoLenh` — mỗi dòng = *lệnh SX + nhân viên + tên sản phẩm + số lượng + ngày*. "May mẫu", "Ảnh", "Video" chỉ là **tên sản phẩm trong danh mục của hợp đồng lao động** (Nhân sự → Hợp đồng → Kiểu thưởng *Theo sản phẩm* → Danh mục sản phẩm & đơn giá). Không có danh mục cứng "ảnh/video" trong phần mềm — anh khai tên gì ở hợp đồng thì ghi sản lượng theo tên đó.
2. **Nhân viên may mẫu**: ô chọn mới ở *Chỉ định sản xuất* và *Sửa lệnh* (chọn trong danh sách nhân viên đang làm — mã + bộ phận, không gõ tay như Thiết kế/Rập vì phải gắn được vào lương). Chọn xong, phần mềm **tự ghi 1 dòng** sản lượng: lệnh đó, người đó, sản phẩm = dòng có chữ "mẫu" trong hợp đồng của người đó (không có thì ghi "May mẫu" và báo đỏ), SL = 1, **ngày = Ngày đặt của lệnh** (⇒ tháng lương). Đổi người / bỏ chọn / đổi ngày đặt ⇒ dòng tự sửa theo, cả hai tháng liên quan đều được đánh dấu tính lại. Bản in lệnh có dòng "May mẫu: tên".
3. **Ảnh, video**: tab mới **QLSX › Sản lượng theo lệnh** (ChucNang `QLSX/sanluong`): chọn tháng → bảng mọi dòng (kể cả dòng may mẫu tự động, chỉ xem) + tổng tiền từng người; nút **＋ Ghi sản lượng**: ngày, lệnh (gõ mã/tên → chọn trong 60 lệnh gần nhất), nhân viên, **sản phẩm = danh sách theo hợp đồng của người đó** (đổi người/ngày là nạp lại; hợp đồng không phải kiểu *Theo sản phẩm* hoặc chưa khai danh mục thì báo đỏ ngay), số lượng, ghi chú. Sửa/xóa từng dòng (dòng may mẫu thì không — sửa ở lệnh).
3b. **Nhân viên TỰ ghi cho mình** (anh nói thêm 16/11: *"Sản lượng theo lệnh gán với nhân viên luôn, nghĩa là tự cập nhật cho mình. Khi nhân viên ký hợp đồng theo sản phẩm thì sẽ hiện ở chức năng này"*): trong **Bảng lương của tôi** (MYPAY — tài khoản gắn mã nhân viên tự có, v9.59) thêm mục **"Sản lượng theo lệnh của tôi"** — **chỉ hiện khi hợp đồng hiệu lực của người đó là kiểu *Theo sản phẩm*** (máy chủ quyết, không cần phân quyền thêm; đổi hợp đồng là mục tự hiện/ẩn). Dòng danh mục SP + đơn giá theo hợp đồng, nút ＋ Ghi sản lượng: ngày, lệnh (gõ mã/tên → chọn), **sản phẩm = list theo hợp đồng của chính mình**, số lượng. Sửa/xóa dòng mình ghi; dòng may mẫu chỉ xem. Máy chủ lấy người = `Users.NhanVienID` của phiên — client không chọn được người khác; hợp đồng không phải *Theo sản phẩm* ⇒ từ chối ghi (409). Tab QLSX › Sản lượng theo lệnh (mục 3) vẫn còn cho quản lý ghi hộ / rà toàn bộ. `module.mypay.js` 9.67.
3c. **Nhiều dòng sản phẩm cho một lệnh** (anh: *"Ghi sản lượng 1 lệnh thêm được nhiều dòng sản phẩm chọn từ list"*): cả hai form (QLSX và Bảng lương của tôi) — chọn ngày + lệnh (+ nhân viên) **một lần**, bảng dòng sản phẩm: mỗi dòng = SP chọn từ list hợp đồng + SL + ghi chú, nút **＋ Thêm dòng sản phẩm**, ✕ bỏ dòng. Máy chủ nhận `rows[]`, kiểm hết các dòng trước (sai một dòng là không ghi dòng nào), chặn cùng một SP lặp hai dòng (gộp SL). Sửa vẫn từng dòng.
3d. **Phân quyền** (anh: *"Thêm chức năng phân quyền"*): dòng ChucNang mới **`MYPAY/sanluongcuatoi` — "Sản lượng theo lệnh của tôi (tự ghi ảnh / video)"** (migration_v895, mặc định tick). Quản trị → Phân quyền bỏ tick cho nhóm (hoặc ghi đè riêng cho người) ⇒ mục biến mất ở Bảng lương của tôi **và** máy chủ chặn 403 các route `/sanluong/cuatoi…` — hai lớp cùng một luật. Tab quản lý vẫn theo `QLSX/sanluong` như trước.
3e. **Mặc định KHÔNG có** (anh: *"Ghi sản lượng mặc định không có, phân quyền ai có quyền mới hiển thị"*): cả hai dòng ChucNang `QLSX/sanluong` và `MYPAY/sanluongcuatoi` đặt **`MacDinhCho = 0`** (năng lực "phải tick mới có", cùng cơ chế `QLSX/xemtatca`, `HOPDONG/kyso`): chưa tick ⇒ tab/mục **không hiện** và API trả 403; Quản trị → Phân quyền tick cho nhóm (hoặc ghi đè riêng cho người) mới có. Admin thấy sẵn. Lưu ý kỹ thuật: `loadUserContext` không đưa chức năng `MacDinhCho=0` vào `hiddenChucNang`, nên tab QLSX và mục MYPAY tự hỏi `chucNangPerm` — vì thế **phải đăng nhập lại** sau khi tick.
3f. **Cột Mã rập + Ảnh** (anh: *"Ghi sản lượng thêm cột mã rập; ảnh sản phẩm lấy từ ảnh hàng hóa, tự cập nhật khi có ảnh hàng hóa"*): hai bảng sản lượng thêm cột **Mã rập** (một công thức hai nguồn `utils/maRapCuaDon.maRapTheoDon` — sơ đồ + tiến độ kỹ thuật) và **Ảnh**: ưu tiên **ảnh đại diện hàng hóa** của mã hàng thuộc lệnh (hợp hai nguồn: thẻ kho gắn lệnh ∪ phiếu nhập kho của lệnh, không hủy), chưa có thì lùi về ảnh lệnh (`AnhSanPham`). Tính lúc đọc — thêm ảnh ở Thẻ kho là lần mở sau hiện ngay, không chép cột. Rê chuột hiện to (v9.47), bấm mở ảnh gốc.
4. **Tính lương**: bộ tính lương công nhật cộng **Σ SL × đơn giá hợp đồng** của các dòng có ngày trong tháng vào `thuongSanPham` — **cộng thêm** phần nhập tay cũ ở tab *Đánh giá KPI / sản phẩm* (vẫn giữ cho sản phẩm ngoài lệnh SX). Tab KPI hiện riêng "Từ lệnh SX: Ảnh × 12; Video × 3" (chỉ xem) và phần "Nhập tay"; cửa sổ Sản phẩm tháng có khối xanh "Tự động từ lệnh sản xuất" trên bảng nhập tay. Ghi/sửa/xóa sản lượng ⇒ bảng lương tháng đó tự tính lại khi mở (v9.53); **tháng đã chốt không đổi**.
5. **Đơn giá KHÔNG lưu ở dòng sản lượng** — tra từ hợp đồng hiệu lực *cuối tháng* lúc tính (cùng mốc bảng lương). Sửa đơn giá ở hợp đồng ⇒ tháng chưa chốt tự đúng. Tên không khớp (vd ghi "Clip" mà hợp đồng khai "Video") ⇒ **0 đồng + chữ đỏ "(không khớp HĐ)"** ở cả hai tab — không đoán, không tự sửa tên.

**Những gì tôi KHÔNG làm (nói rõ để anh quyết):**
- **Không tải file ảnh/video lên** — chỉ ghi *số lượng*. Tôi hiểu "cập nhật ảnh video" là ghi sản lượng để tính thưởng; nếu anh muốn lưu cả file (để xem lại ảnh/video của lệnh) thì nói, đó là việc khác: video nặng, `/uploads` đang **công khai không cần đăng nhập**, cần đường tải riêng.
- Không ghi sản lượng từ *Ghi tiến độ* (công đoạn may/cắt) — những cái đó đã có lương khoán may / lương cắt riêng.
- Không tự chuyển các dòng *nhập tay* cũ ở tab KPI sang lệnh.

**Giả định cần anh xác nhận:** (a) 1 lệnh = 1 "sản phẩm may mẫu" (không theo số mẫu/số màu); (b) tháng tính thưởng may mẫu = tháng **Ngày đặt** lệnh (không phải ngày may xong); (c) ảnh/video đếm theo **cái** (SL gõ tay), người ghi là người có quyền *tạo* ở QLSX; (d) thưởng theo SP **không prorate** theo công (luật v9.45 giữ nguyên).

**Thử (sau migration_v895 + pm2 restart + copy JS):**

| Việc | Mong đợi |
|---|---|
| Nhân sự → Hợp đồng của 1 người: Kiểu thưởng *Theo sản phẩm*, danh mục: `May mẫu 150.000`, `Ảnh 50.000`, `Video 200.000` | Lưu được; dưới bảng có dòng gợi ý tên phải khớp sản lượng |
| QLSX → Chỉ định sản xuất: chọn người đó ở **Nhân viên may mẫu**, lưu | Toast xanh "Thưởng may mẫu: May mẫu — 150.000 đ/lệnh"; tab Sản lượng theo lệnh (tháng của Ngày đặt) có dòng 🧵 May mẫu (tự động), 1 × 150.000 |
| Chọn người có hợp đồng kiểu KPI / Không | Vẫn lưu lệnh; toast đỏ "hợp đồng không phải kiểu Theo sản phẩm — không cộng thưởng" |
| Sửa lệnh: bỏ chọn may mẫu | Dòng tự động biến mất; tổng tháng giảm 150.000 |
| Sản lượng theo lệnh → ＋ Ghi: lệnh X, người đó, **Ảnh**, SL 12 | Dòng mới 12 × 50.000 = 600.000; tổng người = 750.000 |
| Ghi thêm SP gõ tên không có trong HĐ (chỉ xảy ra với dòng cũ) | Chữ đỏ "(không khớp HĐ)", 0 đ |
| Tính lương → Đánh giá KPI / sản phẩm, tháng đó | Dòng người đó: "Từ lệnh SX: May mẫu × 1; Ảnh × 12", Tiền thưởng 750.000; bấm 📝 Sản phẩm → khối xanh tự động + bảng nhập tay trống |
| Nhập tay thêm `Video × 1` ở cửa sổ đó, lưu | TỔNG = 950.000; tab Lương công nhật mở ra tự tính lại, cột thưởng = 950.000 |
| Sửa đơn giá Ảnh ở hợp đồng thành 60.000 | Mở lại tab KPI: Ảnh × 12 = 720.000 (không cần ghi lại sản lượng) |
| Xóa lệnh X (Danh sách lệnh → Xóa) | Dòng sản lượng của lệnh đi theo (FK CASCADE), lương tính lại |
| Bảng lương **đã chốt** của tháng cũ, rồi ghi thêm sản lượng vào tháng đó | Bảng chốt KHÔNG đổi (v9.53); chỉ báo "có biến động" |
| Sau migration, đăng nhập tài khoản thường (không admin) chưa được tick | KHÔNG thấy tab QLSX › Sản lượng theo lệnh, KHÔNG thấy mục ở Bảng lương của tôi |
| Quản trị → Phân quyền: tick `QLSX/sanluong` cho nhóm → đăng nhập lại | Tab hiện; cột Ảnh (ảnh hàng hóa của lệnh, không có thì ảnh lệnh), cột Mã rập |
| Thêm ảnh đại diện cho mã hàng của lệnh ở Thẻ kho → mở lại tab | Ô Ảnh của các dòng lệnh đó tự đổi sang ảnh hàng hóa |
| Đăng nhập bằng tài khoản gắn nhân viên có HĐ *Theo sản phẩm* → Bảng lương của tôi | Dưới phiếu lương có mục "Sản lượng theo lệnh của tôi" + dòng SP/đơn giá theo HĐ; ＋ Ghi: chọn lệnh, SP (chỉ list của HĐ mình), SL → dòng hiện, tổng cập nhật; dòng may mẫu "(tự động từ lệnh)" không có nút Sửa/Xóa |
| Tài khoản gắn nhân viên có HĐ kiểu KPI / Chuyên cần / Không | KHÔNG có mục này |
| Nhân viên tự ghi xong → kế toán mở Tính lương › Đánh giá KPI | Dòng người đó có "Từ lệnh SX: …" đúng số nhân viên vừa ghi |
| ＋ Ghi sản lượng: 1 lệnh, thêm 2 dòng Ảnh × 10 và Video × 2, Lưu | Toast "Đã ghi 2 dòng"; 2 dòng hiện; chọn cùng SP ở 2 dòng ⇒ báo "bị lặp hai dòng", không ghi gì |
| Quản trị → Phân quyền: bỏ tick `MYPAY/sanluongcuatoi` cho nhóm → đăng nhập lại bằng tài khoản nhóm đó | Bảng lương của tôi KHÔNG còn mục Sản lượng; gọi thẳng API trả 403 |

Bộ kiểm: `node backend\utils\kiem_san_luong_theo_lenh.js` (chạy thật `thuongTheoThang`/`dongBoMayMau` với CSDL giả: khớp tên hoa/thường, không khớp = 0, xóa-rồi-chèn dòng may mẫu, đánh dấu 2 tháng).

---

## 28. Nghiệm thu — bỏ ô "Số công chuẩn — xăng xe / ăn trưa" trên hợp đồng, chia theo công chuẩn THÁNG (v9.68, CHƯA deploy)

Anh yêu cầu 16/11: *"Ký hợp đồng bỏ trường Số công chuẩn — xăng xe, Số công chuẩn — ăn trưa. Tính lương lấy theo công chuẩn của tháng trong phần cấu hình lương."*

**Làm:** `utils/luongCongNhat.js` — đơn giá/ngày xăng xe = `PhuCapXangXe ÷ CC`, ăn trưa = `PhuCapAnCa ÷ CC` (CC = công chuẩn tháng, Cấu hình lương → `getCongChuan`), **không đọc** `SoCongXangXe`/`SoCongAnTrua` nữa; vẫn × ROUND(ngày đi làm) như v9.45. Form hợp đồng (`module.hrm.js` 9.68) bỏ 2 ô; payload không gửi ⇒ máy chủ ghi NULL vào 2 cột (cột CSDL giữ nguyên, không migration). Mẫu in HĐLĐ gốc: câu b)/c) thành *"… đồng/tháng, tính theo số công chuẩn của tháng."*; **mẫu đã sửa trong CSDL** còn `{{SoCongXangXe}} công.` được nâng cấp lúc đọc (`nangCapMauCu`, cùng cách v9.48b); mẫu tự viết khác còn chứa biến thì in chữ "theo công chuẩn tháng" thay cho số.

**Hệ quả số:** người đang khai 26 công chuẩn trên HĐ nhưng tháng có CC 27 ⇒ đơn giá xăng/ngày giảm (540.000/27 thay vì /26) — bảng lương tháng chưa chốt sẽ đổi khi mở (v9.53 tự tính lại khi hợp đồng/cấu hình đổi; **đổi mã bộ tính thì anh bấm Tính lương lại** hoặc chờ biến động). Tháng đã chốt không đổi.

| Việc | Mong đợi |
|---|---|
| Nhân sự → Hợp đồng → Sửa | Không còn 2 ô "Số công chuẩn — xăng xe / ăn trưa"; lưu được |
| In HĐLĐ (mẫu gốc hoặc mẫu đã sửa) | Mục b)/c): "… đồng/tháng, tính theo số công chuẩn của tháng." — không có "…" trống |
| Cấu hình lương công chuẩn tháng = 26, HĐ xăng 540.000, đi làm 25 ngày | Xăng xe = 540.000/26 × 25 = 519.231 |

Bộ kiểm: `node backend\utils\kiem_luong_cong_nhat_v945.js` (+3 phép v9.68) và `kiem_dieu_khoan_thuong_hop_dong.js` (+2 phép nâng cấp mẫu).

---

## 29. Nghiệm thu — "Bảng lương của tôi" có bảng chấm công (giờ vào / giờ ra) bên cạnh (v9.69, CHƯA deploy)

Anh yêu cầu 16/11: *"Bảng lương của tôi thêm bảng chấm công của nhân viên đó bên cạnh. Lấy bảng giờ vào giờ ra."*

**Làm:** route tự phục vụ `GET /api/payroll/chamcong/cuatoi?nam&thang` (chỉ đăng nhập; người = tài khoản đang gắn — không chọn được người khác; ngày/giờ trả chuỗi để không lệch múi giờ), đặt trước `/chamcong/:nhanVienId`. `module.mypay.js` 9.69: phiếu lương bên trái, **bảng chấm công bên phải** (màn hẹp thì xuống dưới): Ngày, Thứ, Mã, **Giờ vào, Giờ ra**, Công, Tăng ca (giờ), Ghi chú; đầu bảng tổng số ngày · công · giờ tăng ca; Chủ nhật tô nhạt. Nguồn = `ChamCongNgay` (bảng đã tổng hợp từ máy chấm công + sửa tay + phiếu nghỉ) — đúng bảng mà lương đang tính, nên công ở đây = công trên phiếu lương. Không migration.

| Việc | Mong đợi |
|---|---|
| Đăng nhập tài khoản gắn nhân viên → Bảng lương của tôi | Bên phải phiếu lương có bảng chấm công tháng đang chọn, giờ vào/ra như tab Chấm công của kế toán (cùng người, cùng ngày) |
| Đổi tháng | Cả phiếu lương lẫn chấm công đổi theo |
| Tháng chưa tổng hợp chấm công | "Chưa có ngày chấm công nào trong tháng này." — phiếu lương vẫn hiện |
| Tài khoản chưa gắn nhân viên | Không có bảng (giữ câu hướng dẫn liên kết như cũ) |

Bộ kiểm: `node backend\utils\kiem_mypay_cham_cong_cua_toi.js` (chạy thật handler với CSDL giả + `phanChamCong`).

---

## 30. Nghiệm thu — CỘNG TÁC VIÊN THIẾT KẾ: danh mục, đơn giá, lương CTV; lệnh SX tích "Cộng tác viên"; lệnh đã ghi sản lượng không hiện lại (v9.70, CHƯA deploy, cần migration_v896)

Anh yêu cầu 16/11: *"Thêm chức năng lương CTV, đơn giá, danh mục CTV. Lệnh sản xuất thêm dấu tích cộng tác viên bên trường nhân viên thiết kế. Nếu là CTV thì chọn list CTV ra. Không tích thì chọn nhân viên thiết kế trong bộ phận thiết kế. Kỹ thuật rập chọn từ list nhân viên bộ phận kỹ thuật."* và *"Ghi sản lượng: những lệnh đã cập nhật thì không hiện ra ở list lệnh sản xuất nữa."*

1. **Danh mục → Cộng tác viên thiết kế** (ChucNang `DANHMUC/congtacvien`): tên, SĐT, email, **Đơn giá thiết kế (đ / 1 lệnh SX)**, số TK + ngân hàng, trạng thái (Đang hợp tác / Ngừng), ghi chú. CTV "Ngừng" không hiện trong ô chọn của lệnh mới (lệnh cũ vẫn giữ tên).
2. **Lệnh SX** (Chỉ định SX + Sửa lệnh): cạnh "Thiết kế" có ô tích **Cộng tác viên** — tích ⇒ ô chọn CTV (tên + đơn giá); không tích ⇒ ô tên + nút ↧ NV chỉ lọc **bộ phận Thiết kế** (trước đây lọc "kỹ thuật" cho cả hai ô). **Kỹ thuật rập** ↧ NV lọc **bộ phận Kỹ thuật**. Lọc theo TÊN bộ phận không dấu — bộ phận phải có tên chứa "Thiết kế" / "Kỹ thuật" (Danh mục → Bộ phận); bộ phận không có ai ⇒ lùi về toàn bộ NV. Lưu: `CongTacVienID` + **ThietKeVien = tên CTV** (bản in cũ hiện tên như trước, thêm "(CTV)").
3. **Tính lương → Lương CTV thiết kế** (ChucNang `PAYROLL/luongctv`) — **v9.71 đổi đơn vị tính sang MÃ RẬP** (anh: *"Tính lương CTV căn cứ vào mã rập bộ phận kỹ thuật cập nhật; nếu đã tính rồi lệnh SX sau sẽ không tính nữa. Mỗi mã rập chỉ tính 1 lần."*): mã rập của lệnh lấy bằng công thức hai nguồn sẵn có (sơ đồ + tiến độ Kỹ thuật — do Kỹ thuật gõ). Duyệt mọi lệnh gắn CTV theo Ngày đặt: mã rập gặp **lần đầu** ⇒ tính cho CTV của lệnh đó, tháng = tháng Ngày đặt lệnh đó, tiền = đơn giá hiện tại; gặp lại ở lệnh sau ⇒ **0 đ**, hiện ở bảng "đã tính ở lệnh X"; lệnh gắn CTV mà Kỹ thuật **chưa cập nhật mã rập** ⇒ chưa tính, hiện ở bảng đỏ "chưa có mã rập". Một lệnh có 2 mã rập ⇒ 2 × đơn giá. Tổng hợp: số mã rập, số lệnh, đơn giá/mã rập, thành tiền; xem/in từng CTV. **Không** vào bảng lương công nhật, không thuế/BH — chi bằng phiếu chi ở Công nợ.
4. **Ghi sản lượng — lệnh đã ghi không hiện lại**: ô chọn lệnh (QLSX và Bảng lương của tôi) **loại lệnh đã có dòng ghi tay của người đang chọn** (tab QLSX chưa chọn người ⇒ loại lệnh bất kỳ ai đã ghi; đổi người là danh sách nạp lại); đang Sửa thì lệnh đó vẫn giữ. Dòng may mẫu tự động không tính là "đã ghi".

**Giả định:** (a) ✅ **anh chốt 17/11**: đơn vị = **mã rập**, mỗi mã rập một lần **toàn hệ thống** — CTV B dùng lại mã rập CTV A đã được tính ⇒ B không được tính; (b) so mã rập không phân biệt hoa/thường, bỏ khoảng trắng; (c) tháng tính = tháng Ngày đặt của lệnh có mã rập lần đầu (không phải ngày Kỹ thuật cập nhật); (d) đơn giá KHÔNG chốt theo mã rập — sửa ở danh mục là mọi tháng chưa chi đổi theo.

| Việc | Mong đợi |
|---|---|
| Danh mục → Cộng tác viên thiết kế: thêm "Hương Media", đơn giá 500.000 | Lưu được; hiện ở ô chọn CTV của lệnh |
| Chỉ định SX: tích Cộng tác viên → chọn Hương Media → lưu | Lệnh có Thiết kế = "Hương Media"; bản in "Thiết kế: Hương Media (CTV)" |
| Không tích: ↧ NV ở Thiết kế | Chỉ NV bộ phận Thiết kế; ↧ NV ở Kỹ thuật rập chỉ bộ phận Kỹ thuật |
| Sửa lệnh đó: bỏ tích | Lưu ⇒ CongTacVienID NULL, tên thiết kế giữ nguyên chữ |
| Tính lương → Lương CTV thiết kế, tháng của Ngày đặt — Kỹ thuật CHƯA ghi mã rập | Bảng đỏ "chưa có mã rập", 0 đ |
| Kỹ thuật ghi mã rập MR01 cho lệnh đó (Bổ sung sơ đồ / tiến độ KT) → mở lại tab | Hương Media: 1 mã rập × 500.000 |
| Lệnh thứ hai cùng CTV, Kỹ thuật ghi lại MR01 | Bảng "đã tính ở lệnh …", 0 đ; tổng không đổi |
| Lệnh có 2 mã rập MR02, MR03 | 2 × 500.000 |
| Sửa đơn giá danh mục → 600.000, mở lại tab | 600.000 / mã rập (đơn giá tra lúc xem) |
| Ghi sản lượng: ghi lệnh X cho NV A → mở lại ＋ Ghi, chọn NV A, gõ "X" | Lệnh X không còn trong danh sách; chọn NV B thì vẫn thấy X |
| Sửa dòng của lệnh X | Ô lệnh vẫn hiện X |

Bộ kiểm: `node backend\utils\kiem_cong_tac_vien_thiet_ke.js` (chạy thật `timLenhChuaGhi` với CSDL giả; v9.71: chạy thật `tinhLuongCTVTheoMaRap` 4 tình huống + kiểm mục §31).

---

## 31. Nghiệm thu — tạo user không mật khẩu ⇒ mật khẩu tạm = tên đăng nhập, đăng nhập lần đầu BẮT đổi (v9.71, CHƯA deploy, cần migration_v897)

Anh yêu cầu 16/11: *"Thay đổi lại user. Khi tạo user mới nếu không có mật khẩu thì đăng nhập lần đầu yêu cầu đổi mật khẩu."*

**Làm:** `migration_v897.sql` thêm `Users.PhaiDoiMatKhau BIT DEFAULT 0`. Quản lý User → Thêm: ô Mật khẩu **không bắt buộc**; để trống ⇒ máy chủ đặt **mật khẩu tạm = chính tên đăng nhập** + cờ bắt đổi (toast báo mật khẩu tạm cho quản trị đọc cho người dùng). Đăng nhập xong, `app.js` thấy cờ ⇒ **chặn toàn màn hình** bằng form "Đổi mật khẩu trước khi sử dụng" (không menu, không Hủy, không Esc): nhập mật khẩu tạm + mật khẩu mới (≥ 6 ký tự, **không trùng tên đăng nhập**) ⇒ hạ cờ, vào phần mềm. Tài khoản tạo **có** mật khẩu: như cũ, không bị bắt. Chưa chạy migration mà để trống mật khẩu ⇒ báo rõ, không tạo (không để tài khoản mật khẩu tạm lọt mà không bắt đổi).

| Việc | Mong đợi |
|---|---|
| Quản lý User → Thêm "ngocA", để trống mật khẩu | Tạo được; toast "Mật khẩu tạm = ngocA…" |
| Đăng nhập ngocA / ngocA | Vào màn hình chỉ có form đổi mật khẩu, không có menu |
| Nhập mật khẩu mới = "ngocA" | Báo "không được trùng tên đăng nhập" |
| Đổi thành mật khẩu riêng | Tải lại, vào phần mềm bình thường; đăng nhập lại bằng mật khẩu mới, không bị bắt nữa |
| Thêm user có nhập mật khẩu | Không bị bắt đổi |

Bộ kiểm: mục 6 của `kiem_cong_tac_vien_thiet_ke.js`. File: `migration_v897.sql`, `routes/users.js`, `routes/auth.js`, `utils/loadUserContext.js` (`pm2 restart`), `app.js` (**9.71**), `module.users.js` (**9.71**), `index.html`.

---

## 32. Nghiệm thu — xăng xe theo NGÀY × công thực tế; chuyên cần bậc thang theo SỐ NGÀY NGHỈ (cả chủ nhật); Lương CTV có ảnh (v9.72, CHƯA deploy, cần migration_v898)

> ✅ **Mục 1 (xăng đ/NGÀY × công) VẪN LÀ LUẬT ĐANG CHẠY** — v9.78 từng đổi sang km rồi v9.79 chốt lại về đây (xem §38). Nhớ chạy `sua_phu_cap_xang_xe_theo_ngay_v972.sql` trước khi tính lương. Mục 2 (chuyên cần) và mục 3 (ảnh CTV) không đổi.

Anh yêu cầu 17/11: *"Ký hợp đồng: xăng xe sẽ tính theo ngày, ví dụ 1 ngày 20k × số công thực tế."* · *"Chuyên cần bậc thang định nghĩa lại: đi làm đủ số ngày của tháng thì được 500k, nghỉ 2 ngày trên 1 tháng thì được 300k, vì tháng 30/31 ngày tính cả chủ nhật."* · *"Lương CTV thêm hình ảnh giống Sản lượng theo lệnh của tôi."*

**1. Xăng xe = đơn giá/ngày × công đi làm thực tế** (`utils/luongCongNhat.js`): ô "Phụ cấp xăng xe" trên hợp đồng nay là **đ/NGÀY** (nhãn đổi, bản in b) đổi: "… đồng/ngày, nhân với số ngày công làm việc thực tế trong tháng"; mẫu đã sửa trong CSDL nâng cấp lúc đọc). Công đi làm = thử việc + chính thức (phép, lễ không tính), **không làm tròn** (25,5 công × 20k = 510k — Excel T10 từng làm tròn 26 ngày = 520k; khác là cố ý theo luật mới). Không còn phụ thuộc công chuẩn.
🔴 **DỮ LIỆU CŨ**: hợp đồng khai trước v9.72 ghi **số tháng** (vd 540.000) — sau khi copy mã mà chưa sửa, lương xăng sẽ nhảy ×27. Chạy `database\sua_phu_cap_xang_xe_theo_ngay_v972.sql` trong SSMS: KHỐI A liệt kê hợp đồng có xăng > 0 kèm số "nếu chia @CC" (đặt @CC = 26 hay 27 theo cách anh đã khai); KHỐI B UPDATE chia, **mặc định ROLLBACK**, loại trừ được hợp đồng đã sửa tay. **Việc này sửa dữ liệu thật — tôi chờ anh xem KHỐI A rồi "proceed".** Hoặc sửa từng hợp đồng trên form.

**2. Chuyên cần bậc thang theo số ngày nghỉ** (`migration_v898`: `HopDongChuyenCan.SoNgayNghiToiDa`): form hợp đồng đổi ô bậc thành **"Nghỉ tối đa (ngày/tháng)"** + tiền: `0 → 500.000`, `2 → 300.000`. Bộ tính: nghỉ = **số ngày của tháng (28–31, tính cả CN) − số ngày lễ chung trong tháng − số ngày có mặt** (ngày có chấm công công > 0, CN đi làm cũng tính); nhận tiền của **bậc chặt nhất còn đạt** (nghỉ 1 ngày ⇒ 300k; nghỉ 3 ⇒ 0). Phép vẫn là nghỉ. Hợp đồng còn bậc kiểu cũ (theo số công) **vẫn chạy luật v9.55** cho tới khi anh khai lại — ô form hiện trống kèm gợi ý "bậc cũ: đạt X công — khai lại". Điều khoản e)/3.4 in theo kiểu bậc.
Giả định: lễ chung không tính là nghỉ (nếu anh muốn lễ cũng là nghỉ thì nói); ngày có mặt = có công > 0 (nửa ngày vẫn là có mặt).

**3. Lương CTV có ảnh**: cột Ảnh ở bảng chi tiết mã rập và bảng "chưa có mã rập" — cùng công thức ảnh với Sản lượng theo lệnh (tách ra `utils/anhLenhSX.js`, dùng chung): ảnh hàng hóa ưu tiên, lùi về ảnh lệnh, rê chuột phóng to.

| Việc | Mong đợi |
|---|---|
| Hợp đồng: xăng xe 20.000, chấm công 25,5 ngày đi làm | Phiếu lương: xăng 510.000 |
| Hợp đồng: Kiểu thưởng Chuyên cần bậc thang, bậc `0 → 500.000`, `2 → 300.000`; tháng 11 (30 ngày), có mặt 30 ngày | Thưởng 500.000 |
| Cùng người, có mặt 28 ngày (nghỉ 2, kể cả CN) | 300.000; có mặt 27 ⇒ 0 |
| Tháng có 1 ngày lễ chung, có mặt 29/30 | Nghỉ 0 ⇒ 500.000 |
| Hợp đồng cũ còn bậc "28 công → 300k" chưa khai lại | Vẫn tính theo số công như trước; form hiện ô trống + gợi ý khai lại |
| Tính lương › Lương CTV thiết kế | Cột Ảnh hiện ảnh hàng hóa của lệnh |

Bộ kiểm: `kiem_luong_cong_nhat_v945.js` (sheet 2 tổng đổi −10.000 cố ý; +9 phép v9.72), `kiem_dieu_khoan_thuong_hop_dong.js` (+1 phép), `kiem_nghi_phep_le_chuyen_can.js` (sửa regex), `kiem_cong_tac_vien_thiet_ke.js` (+2). File: `migration_v898.sql`, `sua_phu_cap_xang_xe_theo_ngay_v972.sql`, `utils/luongCongNhat.js`, `utils/anhLenhSX.js` (MỚI), `routes/payroll.js`, `routes/hrm.js`, `routes/qlsx.js` (`pm2 restart`), `module.hrm.js` (**9.72**), `module.payroll.js` (**9.72**), `index.html`.

---

## 33. Nghiệm thu — Kiểu thưởng chọn NHIỀU kiểu (cộng dồn); bậc chuyên cần theo ngày nghỉ KHÔNG LƯU (nguyên nhân + sửa); giấy nghỉ phép ½ ngày; bản in Lương CTV có ảnh (v9.73, CHƯA deploy, cần migration_v899)

Anh yêu cầu 17/11: *"Kiểu thưởng thay đổi cách lựa chọn, có thể chọn 2 hoặc 3 kiểu thưởng, áp dụng cả các kiểu đã chọn trong tính lương."* · *"Bậc thưởng chuyên cần theo SỐ NGÀY NGHỈ đang không lưu, lưu xong quay lại lại mất."* · *"Tạo giấy nghỉ phép có thể nghỉ ½ ngày."* · *"Bản in lương CTV thiết kế đang không có ảnh."*

**1. Kiểu thưởng = tập hợp.** Form hợp đồng: ô chọn một kiểu thành **3 ô tích** (Theo KPI / Theo sản phẩm / Chuyên cần bậc thang); tích cái nào khung đó hiện (danh mục SP, bậc chuyên cần). CSDL lưu một chuỗi thứ tự cố định `KPI,SanPham,ChuyenCan` (cột `HopDongLaoDong.KieuThuong` rộng ra 50, **bỏ CHECK** — `migration_v899`; `BangLuongChiTiet.KieuThuong` cũng rộng ra). Hợp đồng cũ một kiểu **giữ nguyên giá trị**, không phải sửa. Luật tách/ghép ở `utils/kieuThuong.js` (một nơi, backend; `module.hrm.js` có bản gương `tachKieu`).
Bộ tính (`utils/luongCongNhat.js`): **thưởng = KPI + sản phẩm + chuyên cần bậc thang**, mỗi phần theo đúng luật cũ của kiểu đó; trả thêm `thuongKPI / thuongSP / thuongCC`. Có "ChuyenCan" trong tập hợp ⇒ phụ cấp chuyên cần cố định bỏ qua (như trước). Tab Đánh giá KPI: người có cả KPI lẫn SP hiện **hai dòng** (dòng chấm điểm + dòng sản phẩm, đánh dấu "(cùng người)"). Điều khoản e)/3.4 bản in hợp đồng: nối các câu của từng kiểu đã chọn; màn xem nối bằng " + ". Nhãn ở bảng lương / phiếu lương / MYPAY ghép "KPI+SP+CC".
🔴 Chưa chạy `migration_v899` mà lưu hợp đồng ≥ 2 kiểu ⇒ máy chủ báo rõ "Chưa chạy database/migration_v899.sql…" (không cắt chuỗi im lặng). Bảng lương chốt trước v9.73 giữ ảnh chụp `KieuThuong` cũ.

**2. Bậc chuyên cần theo ngày nghỉ "không lưu".** Nguyên nhân tìm thấy khi đọc `hrm.js luuBacChuyenCan`: khi CSDL **chưa có cột `SoNgayNghiToiDa`** (chưa chạy `migration_v898`), hàm lọc bỏ im lặng mọi dòng kiểu mới (SoCong = 0) ⇒ lưu "thành công" mà bảng trống. Sửa: thiếu cột thì **ném lỗi rõ** "Chưa chạy database/migration_v898.sql — bậc chuyên cần theo SỐ NGÀY NGHỈ chưa lưu được…", form hiện lỗi, không báo thành công giả. **Trên máy anh: chạy `migration_v898.sql` (và `v899`) rồi khai lại bậc — sẽ lưu.** Nếu đã chạy v898 mà vẫn mất, báo tôi kèm F12 › Network › PUT /api/hrm/hopdong/… (response).

**3. Nghỉ ½ ngày** (`migration_v899`: `PhieuNghi.NuaNgay BIT`): form giấy nghỉ phép thêm ô tích **"Chỉ nghỉ ½ ngày"** — bắt buộc Từ = Đến (1 ngày). Chấm công tháng ghi **0,5 công nghỉ** cho ngày đó (bản in giấy / cột Phép hiện 0,5); máy chấm đã có dòng của ngày đó thì máy thắng giấy (như mọi phiếu nghỉ — giả định cũ §18). Chuyên cần theo ngày nghỉ: ngày có công > 0 là **có mặt** (giả định §32 giữ).

**3b. Phiếu lương tách từng dòng thưởng** (Nguyen 17/11: *"phiếu lương công nhật tách Thưởng KPI (100/100 điểm) + Thưởng chuyên cần (bậc thang) 2 dòng riêng biệt"*): bảng lương chụp thêm `BangLuongChiTiet.ThuongKPI / ThuongSP / ThuongCC` (migration_v899; `Thuong` vẫn là tổng). Phiếu lương (Tính lương › in phiếu NV) và Bảng lương của tôi in **mỗi kiểu một dòng** — nhiều dòng thì in cả dòng 0 để thấy khoản nào không đạt. Bảng tính TRƯỚC khi chạy v899 (như T10 anh đang xem) chưa có 3 cột ⇒ lần xem đầu sau deploy máy chủ tự đánh dấu + tính lại (bảng chưa chốt), mở phiếu lần sau là tách; bảng đã chốt thì giữ một dòng gộp. Luật ở `common.js cacDongThuongPhieuLuong` (dùng chung 2 màn) — `common.js` bump **9.73**.

**4. Bản in Lương CTV có ảnh**: bản in "In tổng hợp" / "In" từng CTV và modal chi tiết nay có cột **Ảnh** (56 px) ở bảng chi tiết mã rập — ảnh `<img>` trần, cùng gốc, `printHtml` đợi ảnh tải xong mới in (cơ chế sẵn có từ v7.x). Bảng "chưa có mã rập" không in (không phải lương).

| Việc | Mong đợi |
|---|---|
| Hợp đồng: tích KPI + Theo sản phẩm, quỹ KPI 2.700.000, SP "Video" 50.000; chấm 100 điểm, 10 video; đủ công | Thưởng = 2.700.000 + 500.000 = 3.200.000; phiếu lương ghi "Thưởng KPI (100/100 điểm) + Thưởng theo sản phẩm" |
| Tích cả 3, có mặt đủ tháng, bậc 0 → 500.000 | Cộng thêm 500.000; phụ cấp chuyên cần cố định = 0 |
| Bỏ tích "Theo sản phẩm" khi hợp đồng đã khai SP | Hỏi xác nhận XÓA danh mục SP rồi mới lưu |
| Lưu hợp đồng 2 kiểu khi CHƯA chạy migration_v899 | Lỗi rõ "Chưa chạy database/migration_v899.sql…" |
| In hợp đồng tích KPI + SP | Điều khoản e) có cả câu KPI lẫn câu sản phẩm |
| Khai bậc "0 → 500k, 2 → 300k" rồi mở lại hợp đồng | Bậc còn nguyên (sau khi chạy v898); chưa chạy v898 ⇒ lỗi rõ, không "lưu thành công" giả |
| Giấy nghỉ phép 20/11 → 20/11, tích ½ ngày | Chấm công 20/11: Phép 0,5; giấy không tích ½ mà Từ ≠ Đến ⇒ lỗi "nửa ngày chỉ cho giấy 1 ngày" |
| Lương CTV › In | Cột Ảnh có hình ở bảng chi tiết mã rập |
| Tính lương lại T10 (sau v899) rồi in phiếu NV tích KPI + Chuyên cần | Hai dòng: "Thưởng KPI (100/100 điểm) 2.700.000" và "Thưởng chuyên cần (bậc thang) 500.000"; Bảng lương của tôi cùng hai dòng |

Bộ kiểm: `kiem_luong_cong_nhat_v945.js` (+11 phép v9.73, có chạy thật `cacDongThuongPhieuLuong`; regex form đổi sang ô tích), `kiem_dieu_khoan_thuong_hop_dong.js` (+3; mốc cắt đổi sang `THU_TU_KIEU`), `kiem_nghi_phep_le_chuyen_can.js` (+2; mốc cắt + regex LIKE), `kiem_san_luong_theo_lenh.js` (regex `coKieu`). File: `migration_v899.sql` (MỚI, sau v898), `utils/kieuThuong.js` (**MỚI** — `luongCongNhat.js`, `payroll.js`, `hrm.js`, `qlsx.js` require lúc nạp, thiếu là máy chủ không lên), `utils/luongCongNhat.js`, `utils/nghiPhep.js`, `routes/payroll.js`, `routes/hrm.js`, `routes/qlsx.js` (`pm2 restart`), `module.hrm.js` (**9.73**), `module.payroll.js` (**9.73**), `module.mypay.js` (**9.73**), `module.qlsx.js` (**9.73**, so sánh `.includes('SanPham')`), `common.js` (**9.73**, `cacDongThuongPhieuLuong` — nạp cho MỌI màn, `node --check` bắt buộc), `index.html`.

---

## 34. Nghiệm thu — chuyên cần theo ngày nghỉ: hợp đồng chọn "Tính cả chủ nhật" hay không (v9.74, CHƯA deploy, cần migration_v900)

Anh hỏi 17/11: *"Văn phòng nghỉ chủ nhật, tháng có 4 hay 5 chủ nhật thì làm thế nào? Chỉ khối sản xuất tính nghỉ 2 ngày/tháng."*

Luật v9.72 đếm mọi ngày của tháng ⇒ người nghỉ CN theo lịch bị tính 4–5 ngày nghỉ, không bao giờ đạt bậc. Sửa: ô tích **"Tính cả chủ nhật"** trong khung bậc chuyên cần của hợp đồng (`HopDongLaoDong.ChuyenCanTinhCN`, `migration_v900`, mặc định **1** = mọi hợp đồng hiện có giữ luật sản xuất). Bỏ tích (văn phòng): ngày của tháng trừ các CN; lễ chung rơi vào CN không trừ hai lần; **CN đi làm không tính là có mặt** (không bù cho ngày thường nghỉ). Theo hợp đồng, không theo tên bộ phận. Điều khoản e) in "không kể chủ nhật và ngày nghỉ lễ chung"; màn xem ghi "(không tính chủ nhật)". Chưa chạy v900 mà bỏ tích ⇒ lỗi rõ khi lưu.

| Việc | Mong đợi |
|---|---|
| T11/2026 (30 ngày, 5 CN), văn phòng bỏ tích, đi đủ 25 ngày thường | Nghỉ 0 ⇒ 500.000 |
| Cùng người nghỉ thứ Ba 10/11, đi làm CN 8/11 | Nghỉ 1 ⇒ 300.000 (CN không bù) |
| Khối sản xuất (tích), đi 25 ngày thường | Nghỉ 5 ⇒ 0 (như v9.72) |
| Lễ chung rơi vào CN, văn phòng | Không bị trừ hai lần |

Bộ kiểm: `kiem_nghi_phep_le_chuyen_can.js` (+6 phép, gọi thật `payroll.ngayChuyenCanThang`). File: `migration_v900.sql` (MỚI), `routes/payroll.js`, `routes/hrm.js` (`pm2 restart`), `module.hrm.js` (**9.74**), `index.html`.

---

## 35. Nghiệm thu — HÀNG KÝ GỬI: xuất ký gửi không công nợ, khách báo bán theo kỳ ⇒ phiếu bán hàng CK 12%, trả về (v9.75, CHƯA deploy, cần migration_v901)

Anh nêu 17/11: *"Xuất hàng ký gửi theo nguyên giá 100.000, hợp đồng CK 12% trên số khách bán được; khách thanh toán tự trừ 12%; PXK 10 cái ghi nợ 1.000.000, khách bán 3 trả 264.000 — làm sao khớp công nợ. ~30 khách, mỗi khách nhiều mặt hàng."* Chốt: báo bán **theo kỳ** (bảng kê cuối tháng), **CK theo khách**.

**Nghiệp vụ (VAS — hàng gửi bán TK 157 vẫn là tồn kho của mình):**

| Bước | Màn | Kho | Doanh thu | Công nợ |
|---|---|---|---|---|
| Xuất ký gửi 10 cái | Thẻ kho › **Hàng ký gửi › Phiếu xuất ký gửi** | tồn giữ nguyên, **khả dụng −10** (hiện "đang giữ" như đơn khách) | 0 | 0 |
| Khách báo bán 3 | Sổ ký gửi › **Báo bán** | **phiếu bán hàng thật** trừ tồn 3 | 300.000 − CK 12% | **+264.000** |
| Khách trả 264.000 | Phiếu thu như thường | — | — | 0 ✔ |
| Khách trả 7 cái chưa bán | Sổ ký gửi › **Trả về** | khả dụng +7 (không chứng từ kho) | 0 | 0 |

**Kiến trúc — vì sao không thêm cờ vào `PhieuBanHang`:** khảo sát 17/11 cho thấy ~20 truy vấn công nợ / sổ kế toán / báo cáo KD / dashboard / công nợ trước chứng từ / hóa đơn đọc thẳng `PhieuBanHang` và **không cái nào** lọc `LaHangMau`. Cờ mới = sửa 20 chỗ, sót một là nợ phồng im lặng. Nên ký gửi là **bảng riêng** (`PhieuKyGui*`, `PhieuKyGuiTra*`) — mọi báo cáo tiền đúng theo cấu trúc. Hàng ký gửi **không trừ `XuatCai`**: nó cắm vào `banhang.layHangDangGiu` (nguồn "đang giữ" duy nhất) ⇒ Thẻ kho / lên đơn / catalogue tự thấy khả dụng giảm, không sửa màn nào. Báo bán gọi `banhang.taoPhieuBanHang` (ruột POST /phieu tách ra) ⇒ một đường duy nhất trừ tồn + công nợ; dòng mang `PhieuBanHangChiTiet.KyGuiCTID`. `Còn ở khách = gửi − Σ báo bán (phiếu chưa hủy) − Σ trả (phiếu chưa hủy)` — một công thức ở `utils/kyGuiDangGiu.js`.

**Chặn:** phiếu bán hàng sinh từ báo bán **không sửa được** (như phiếu có "khách mua luôn") — hủy rồi báo bán lại (hủy tự trả số về sổ); phiếu ký gửi đã có báo bán / trả không sửa / hủy được cho tới khi hủy các phiếu đó; form bán hàng thường gửi `kyGuiCTID` bị từ chối; xuất ký gửi quá khả dụng (tồn − đang giữ, theo **đơn vị chính** — bẫy Ri) bị chặn.

**% CK:** `KhachHang.PhanTramCKKyGui` (Danh mục › Khách hàng, ô mới) ⇒ tự điền vào phiếu ký gửi (`PhieuKyGui.PhanTramCK`, chụp lúc lập) ⇒ báo bán dùng số đó làm CK NPP cả phiếu (sửa được trên form báo bán). 🔴 `crudFactory` không dò cột ⇒ **chạy v901 TRƯỚC `pm2 restart`**, không thì thêm/sửa khách hàng lỗi "Invalid column name".

**Giới hạn cố ý (nói trước):** (1) báo cáo tồn kho / NXT hiện **tồn gồm cả hàng đang ở khách** (đúng kế toán 157); "tại kho" = tồn − đang giữ — Thẻ kho cột "Đang giữ" đã gồm ký gửi; chưa có cột riêng "trong đó ký gửi" ở báo cáo NXT. (2) Phiếu ký gửi **đã lập trước v9.75 bằng phiếu bán hàng nguyên giá** không tự chuyển — anh xử lý tay một lần: hủy phiếu bán cũ (nếu chưa thu tiền) rồi lập phiếu ký gửi; đã thu tiền thì giữ nguyên, chỉ lập ký gửi cho phần còn ở khách. Cần SQL liệt kê thì tôi viết. (3) Hàng khách **đã mua** mà trả ⇒ Phiếu nhập lại như thường, không qua "Trả về".

| Việc | Mong đợi |
|---|---|
| Danh mục › Khách hàng › Shop A: % CK ký gửi = 12 | Lưu được (sau v901) |
| Thẻ kho › Hàng ký gửi › Phiếu xuất ký gửi: Shop A, M1 đen 10 cái | Phiếu KG26xxxx; Công nợ Shop A **không đổi**; Thẻ kho M1: tồn không đổi, "đang giữ" +10 |
| Lập phiếu bán hàng thường M1 đen 15 cái khi tồn 20 | Form báo khả dụng 10 (tồn − giữ); máy chủ vẫn cho lưu nếu tồn đủ (như đơn giữ hôm nay) |
| Sổ ký gửi › Shop A › Báo bán: M1 3 cái, CK 12% | Phiếu bán hàng PX… 3 cái × 100.000, CK NPP 12% ⇒ công nợ +264.000; sổ: đã bán 3, còn 7; Thẻ kho đang giữ 7, tồn −3 |
| Phiếu thu Shop A 264.000 | Còn nợ 0 |
| Sổ ký gửi › Trả về 7 | Còn 0; đang giữ 0; tồn không đổi (chưa bao giờ trừ) |
| Tab Phiếu bán hàng › phiếu PX… vừa sinh › Sửa | Bị chặn, lý do "dòng BÁO BÁN hàng ký gửi"; Hủy ⇒ sổ ký gửi còn 7 trở lại |
| Báo bán 8 khi còn 7 | 400 "còn ở khách chỉ 7" |

Bộ kiểm: `kiem_hang_ky_gui.js` (MỚI — chạy thật util + route với CSDL giả, có phép bẫy Ri). File: `migration_v901.sql` (MỚI), `utils/kyGuiDangGiu.js` (**MỚI** — `banhang.js` require lúc nạp, thiếu là máy chủ không lên), `routes/kygui.js` (**MỚI**), `routes/banhang.js`, `routes/danhmuc.js`, `server.js` (`pm2 restart`), `module.kygui.js` (**MỚI**), `module.khohang.js` (**9.75**), `module.danhmuc.js` (**9.75**), `index.html`.

---

## 36. Nghiệm thu — Nhân viên may mẫu: chọn SẢN PHẨM theo danh mục hợp đồng (v9.76, CHƯA deploy, cần migration_v902)

Anh yêu cầu 17/11: *"Nhân viên may mẫu (thưởng theo SP tự động) thêm lựa chọn theo danh mục sản phẩm trong ký hợp đồng."*

Trước (v9.67): chọn người ⇒ máy tự lấy dòng có chữ "mẫu" trong hợp đồng ⇒ hợp đồng có "May mẫu áo" 150k và "May mẫu quần" 200k thì luôn dính dòng đầu. Nay: dưới ô "Nhân viên may mẫu" (form Chỉ định SX và Sửa lệnh) có ô **"Sản phẩm may mẫu"** — nạp đúng danh mục SP của hợp đồng hiệu lực của người đó tại ngày đặt (kèm đơn giá); chọn dòng nào thì dòng `SanLuongTheoLenh` (Nguon MayMau) ghi đúng tên đó ⇒ lương lấy đúng đơn giá. Để trống = luật cũ. Lưu ở `DonHangSanXuat.MayMauTenSP` (migration_v902); đổi người thì ô SP nạp lại và giữ lựa chọn nếu còn trong danh mục; tên không còn trong hợp đồng ⇒ hiện "(không còn trong danh mục — 0 đ)" và tab KPI báo đỏ như trước. Ô SP đọc qua route mới `GET /api/qlsx/maymau/sanpham` gác bằng quyền **lệnh SX** (QLSX/orders), không gác QLSX/sanluong (mặc định không tick — người lập lệnh sẽ bị 403).

| Việc | Mong đợi |
|---|---|
| Hợp đồng NV A: Theo sản phẩm, "May mẫu áo" 150.000, "May mẫu quần" 200.000 | — |
| Chỉ định SX: NV may mẫu = A ⇒ ô Sản phẩm liệt kê 2 dòng kèm giá; chọn "May mẫu quần" | Toast "Thưởng may mẫu: May mẫu quần — 200.000 đ/lệnh"; Sản lượng theo lệnh có dòng MayMau tên "May mẫu quần" |
| Sửa lệnh: ô SP đang chọn "May mẫu quần"; đổi NV sang B (hợp đồng không có tên đó) | Ô SP nạp danh mục của B + dòng "(không còn trong danh mục — 0 đ)" đang chọn — người dùng chọn lại |
| Không chọn SP | Như v9.67: tự lấy dòng có chữ "mẫu" |

Bộ kiểm: `kiem_san_luong_theo_lenh.js` (+3 phép chạy thật `dongBoMayMau(..., tenSP)`; regex chữ ký mới). File: `migration_v902.sql` (MỚI), `utils/sanLuongTheoLenh.js`, `routes/qlsx.js` (`pm2 restart`), `module.qlsx.js` (**9.76**), `index.html`.

---

## 37. Nghiệm thu — NHÓM KHÁCH HÀNG: danh mục + gán khách vào nhóm; Dashboard kinh doanh theo nhóm (v9.77, CHƯA deploy, cần migration_v903)

Anh yêu cầu 19/11: *"Thêm chức năng danh mục nhóm khách hàng, tự thêm khách hàng vào nhóm hoặc khi tạo danh mục khách hàng thì chọn nhóm."* · *"Dashboard kinh doanh thêm theo nhóm khách hàng."*

**1. Danh mục › Nhóm khách hàng** (tab mới, quyền `DANHMUC/nhomkhachhang`): tên nhóm (chặn trùng), mô tả, thứ tự; cột **Số khách** và nút **👥 Khách hàng trong nhóm** — tích chọn hàng loạt, có ô tìm, "Chọn hết / Bỏ chọn hết" tác động lên các dòng đang hiện. **2. Danh mục › Khách hàng** thêm ô **"Nhóm khách hàng"** (chọn khi tạo/sửa), bảng hiện tên nhóm. Một khách thuộc **tối đa một nhóm** — cột `KhachHang.NhomKhachHangID`, gán ở hai nơi nhưng chỉ một chỗ lưu nên không thể lệch; tích ở nhóm B cho khách đang ở nhóm A = **chuyển** sang B.

**3. Dashboard kinh doanh**: ô lọc **Nhóm khách hàng** (tất cả / từng nhóm / "Chưa gán nhóm"), bảng **tổng hợp theo nhóm** (số khách, số phiếu, doanh thu, hàng trả, doanh thu thuần + % tỷ trọng, đã thu, còn nợ) đặt trên bảng khách, và cột **Nhóm** ở bảng khách. Lọc nhóm thì cả thẻ số, biểu đồ 12 tháng và bảng đều theo đúng tập khách đó.

🔴 **Cách ghép (đọc trước khi sửa sau này):** dashboard gom phiếu theo **TÊN khách** (`PhieuBanHang.TenKhach` — khóa công nợ, xem `congno.js`), còn nhóm nằm ở bảng `KhachHang`. Nên bản đồ tên → nhóm gom **một dòng/tên** (`MIN(NhomKhachHangID) GROUP BY LTRIM(RTRIM(TenKhachHang))`) rồi gắn ở **JS sau truy vấn**; **không** thêm JOIN vào câu SQL công nợ — danh mục có hai dòng trùng tên là JOIN nhân đôi dòng, đúng lớp lỗi `#kh` v6.69.2. Tên trên phiếu không có trong danh mục khách ⇒ **"Chưa gán nhóm"**. Tổng hợp theo nhóm cộng từ chính các dòng khách (không truy vấn lần hai ⇒ không lệch). Chưa chạy v903 ⇒ chạy như cũ, mọi khách vào "Chưa gán nhóm", dashboard báo một dòng cảnh báo.

| Việc | Mong đợi |
|---|---|
| Danh mục › Nhóm khách hàng: thêm "Nhà phân phối", "Shop lẻ" | Lưu được; trùng tên bị chặn |
| Nút 👥 ở nhóm "Shop lẻ": tích 5 khách, Lưu | Toast "Shop lẻ: 5 khách hàng"; cột Số khách = 5 |
| Gõ tìm "shop" rồi Lưu | Vẫn giữ nguyên các khách đã tích đang bị ẩn (không gỡ oan) |
| Danh mục › Khách hàng: mở 1 khách, chọn nhóm "Nhà phân phối" | Bảng khách hiện nhóm; nút 👥 của nhóm đó thấy khách này đã tích |
| Dashboard: bảng "theo nhóm" | Tổng các nhóm = TỔNG CỘNG của bảng khách; % cộng lại 100% |
| Dashboard lọc nhóm "Shop lẻ" | Thẻ số, biểu đồ, bảng chỉ còn khách nhóm đó |
| Dashboard lọc "Chưa gán nhóm" | Ra đúng các khách chưa gán (dùng để gán nốt) |
| Chưa chạy v903 | Không lỗi; cảnh báo cam nói rõ tên file migration |

Bộ kiểm: `kiem_nhom_khach_hang.js` (MỚI — chạy thật `/kinhdoanh`, `/khach`, route gán nhóm với CSDL giả; có phép bẫy tên trùng danh mục). File: `migration_v903.sql` (MỚI), `routes/danhmuc.js`, `routes/dashboard.js` (`pm2 restart`), `module.danhmuc.js` (**9.77**), `module.dashboard.js` (**9.77**), `index.html`.

---

## 38. Nghiệm thu — XĂNG XE = SỐ TIỀN /1 NGÀY × NGÀY CÔNG THỰC TẾ (chốt lại, bỏ cách tính theo km); list lệnh ghi sản lượng có MÃ RẬP; biểu đồ tròn theo NHÓM khách (v9.78 + bản chốt v9.79, CHƯA deploy, cần migration_v904)

Anh yêu cầu 19/11: *"Xăng xe quy định bao nhiêu/1 km tính từ nhà đến công ty. Đơn giá chung của công ty là bao nhiêu 1 km, số km mỗi người khác nhau nên tiền hỗ trợ khác nhau × ngày công thực tế. Thêm trong cài đặt lương tiền xăng hỗ trợ/1 km dùng chung cả công ty. Số km nhập theo từng người."* · *"Ghi sản lượng theo lệnh: sổ list danh sách lệnh thêm cả mã rập."* · *"Thêm biểu đồ tròn cho nhóm khách nữa."*

**1. Xăng xe = SỐ TIỀN MỘT NGÀY × ngày công thực tế** — anh chốt lại 19/11: *"Chốt lại xăng xe điền theo số tiền /1 ngày × ngày công thực tế."*

Nhân sự › **Hợp đồng** › ô **"Phụ cấp xăng xe (đ / 1 NGÀY công đi làm thực tế)"** (`HopDongLaoDong.PhuCapXangXe`). Công thức duy nhất: **xăng = đơn giá đ/ngày × ngày công đi làm thực tế** (không tính phép, không tính lễ, không làm tròn — 25,5 công × 20k = 510k). Không phụ thuộc công chuẩn.

⛔ **Cách tính theo km (bản v9.78 viết trước đó trong cùng ngày) ĐÃ BỎ.** Ô "Tiền xăng hỗ trợ (đ/1 km)" ở Cấu hình lương **gỡ khỏi màn hình**; ô "Số km đi làm" **gỡ khỏi form hợp đồng**. Hai cột của `migration_v904` (`CauHinhLuong.XangXeDonGiaKm`, `HopDongLaoDong.SoKmDiLam`) **để nguyên trong CSDL** — không đọc, không xóa; số km ai đã nhập vẫn còn nếu sau này quay lại. **Không cần migration mới.**

> 🔴 **TIỀN THẬT — PHẢI LÀM TRƯỚC KHI TÍNH LƯƠNG:** hợp đồng khai từ **trước v9.72** đang ghi **SỐ THÁNG** (vd 540.000). Đọc số đó là đ/ngày ⇒ **540.000 × 27 = 14.580.000 tiền xăng một người**. Vì vậy `database\sua_phu_cap_xang_xe_theo_ngay_v972.sql` **LẠI CẦN** (file đã đổi ghi chú đầu trang): chạy KHỐI A xem trước → gửi kết quả → "proceed" → KHỐI B.
> Lưới chắn trong code: mỗi lần Tính lương, hợp đồng nào còn khai **≥ 100.000 đ/ngày** sẽ bị réo tên ở dòng đỏ **"TRẢ THỪA"** kèm số tiền sẽ trả; màn Xem hợp đồng cũng gắn ⚠️ ngay dòng phụ cấp xăng xe. Còn dòng đỏ đó thì **chưa được chốt tháng**.

Điều khoản b) hợp đồng vẫn dùng **một biến `{{HoTroXangXe}}`** (giữ tên biến của v9.78, chỉ đổi nội dung — đổi tên biến lần nữa là thêm một vòng "mẫu cũ in ra câu sai"), nội dung: "**N** đồng/ngày, nhân với số ngày công làm việc thực tế trong tháng." Mẫu đã sửa trong CSDL tự nâng cấp khi đọc (`nangCapMauCu` nâng cả dạng v9.68 lẫn v9.72 về biến mới).

**2. Ghi sản lượng theo lệnh — ô chọn lệnh có MÃ RẬP** (cả QLSX › Sản lượng theo lệnh lẫn MYPAY › tự ghi): mỗi dòng trong danh sách gợi ý hiện `Rập <mã> · <tên SP> · <ngày>`, dòng "đã chọn" cũng kèm mã rập. Lấy từ cùng một bản công thức mã rập hai nguồn (`utils/maRapCuaDon`), không ghép lại.

**3. Dashboard: hai biểu đồ tròn theo NHÓM** ("Tỷ lệ doanh thu thuần theo NHÓM khách", "Tỷ lệ công nợ theo NHÓM khách") hiện **luôn** phía trên hai vòng theo khách — không phải chọn nhóm mới thấy. Vòng theo nhóm không gộp đuôi (ít nhóm).

| Việc | Mong đợi |
|---|---|
| Mở form Hợp đồng | Có ô **"Phụ cấp xăng xe (đ / 1 NGÀY công đi làm thực tế)"**; **không còn** ô "Số km đi làm" |
| Mở Cấu hình lương | **Không còn** ô "Tiền xăng hỗ trợ (đ/1 km)" |
| NV A: 20.000 đ/ngày, tháng có 20 công đi làm | Xăng = **400.000** |
| NV A có thêm 3 ngày phép | Xăng vẫn **400.000** (phép, lễ không tính xăng) |
| NV A đi 25,5 công | Xăng = 20.000 × 25,5 = **510.000** (không làm tròn lên 26) |
| 🔴 NV C còn khai **540.000** (số tháng cũ) | Bảng lương hiện dòng đỏ **"TRẢ THỪA … NV C (540.000/ngày ⇒ 14.580.000)"**; màn Xem hợp đồng gắn ⚠️ — chạy SQL v972 rồi tính lại |
| NV D chưa khai xăng, có ngày công | Xăng = 0; bảng lương liệt kê tên ở dòng cảnh báo thường |
| In hợp đồng | Điều khoản b) = "**20.000** đồng/ngày, nhân với số ngày công làm việc thực tế trong tháng." |
| QLSX › Sản lượng theo lệnh › chọn lệnh | Danh sách gợi ý có "Rập …" ở đầu mỗi dòng |
| Dashboard | Có 4 vòng tròn: 2 theo nhóm (trên) + 2 theo khách (dưới) |

Bộ kiểm: `kiem_luong_cong_nhat_v945.js` (7 phép chạy thật công thức đ/ngày — có ca "540.000 số tháng ⇒ bật cờ cảnh báo" và ca "km bị bỏ, khai km vẫn không cộng đồng nào" — + 5 phép so chuỗi), `kiem_dieu_khoan_thuong_hop_dong.js` (2 phép câu b) `{{HoTroXangXe}}`), `kiem_nhom_khach_hang.js` (+1 phép vòng tròn nhóm). File: `migration_v904.sql` (vẫn cần chạy, không đổi), `utils/luongCongNhat.js`, `routes/payroll.js`, `routes/hrm.js`, `routes/qlsx.js` (`pm2 restart`), `module.hrm.js` (**9.80**), `module.payroll.js` (**9.80**), `module.mypay.js` (**9.78**), `module.qlsx.js` (**9.78**), `module.dashboard.js` (**9.78**), `index.html`.

> 🔴 **Bản sửa LẦN HAI, 19/11 (anh chốt lại xăng = đ/ngày)** — các file sau **ĐÃ ĐỔI, phải copy LẠI** dù trước đó đã copy: `backend\utils\luongCongNhat.js`, `backend\routes\payroll.js`, `frontend\js\module.hrm.js` (**→ 9.80**), `frontend\js\module.payroll.js` (**→ 9.80**), `frontend\index.html`, `backend\utils\kiem_luong_cong_nhat_v945.js`, `database\sua_phu_cap_xang_xe_theo_ngay_v972.sql` (đổi ghi chú đầu trang — **lại cần chạy**). `migration_v904.sql` **KHÔNG đổi**; `kiem_dieu_khoan_thuong_hop_dong.js` không đổi so với bản sửa lần một.

---

## 39. Nghiệm thu — Ghi sản lượng: dấu tích **LÀM LẠI MÃ CŨ** (không có lệnh SX, nhập mã hàng) (v9.81, CHƯA deploy, cần migration_v905)

Anh yêu cầu 19/11: *"Ghi sản lượng theo lệnh, trường lệnh SX thêm dấu tích làm lại mã cũ, nhập mã hàng."*

Làm lại một mã hàng cũ thì không có lệnh sản xuất nào để chọn, nhưng dòng sản lượng vẫn phải ghi được (vẫn tính thưởng theo sản phẩm). Ô **Lệnh sản xuất** nay có dấu tích **"♻️ Làm lại mã cũ"**: tích vào thì ô tìm lệnh biến mất, thay bằng ô **gõ mã hàng**; dòng ghi với `DonHangID = NULL` + `MaHangCu`.

Có ở **cả hai** màn, vì cùng một nghiệp vụ: QLSX › **Sản lượng theo lệnh** (quản lý ghi hộ) và MYPAY › **Sản lượng theo lệnh của tôi** (nhân viên tự ghi).

Mọi thứ khác **không đổi**: vẫn chọn nhân viên, vẫn chọn sản phẩm theo danh mục hợp đồng, vẫn nhiều dòng một lần, vẫn vào thưởng theo sản phẩm, vẫn đánh dấu tính lại lương theo ngày.

**Điểm kỹ thuật dễ chết người:** hai câu lấy danh sách sản lượng trước đây `JOIN DonHangSanXuat` — với dòng không có lệnh thì **JOIN thường nuốt mất dòng**, nhân viên mất thưởng mà không ai thấy. Đã đổi sang `LEFT JOIN`; bộ kiểm có phép chặn tái phạm. Dòng làm lại không có ảnh và không có mã rập (không có lệnh thì không có hai thứ đó) — đúng như vậy, không phải lỗi.

| Việc | Mong đợi |
|---|---|
| Mở form Ghi sản lượng (cả 2 màn) | Trên ô "Lệnh sản xuất" có dấu tích "♻️ Làm lại mã cũ" |
| Tích vào | Ô tìm lệnh ẩn đi, hiện ô "Mã hàng cũ" |
| Tích mà để trống mã hàng rồi Lưu | Báo "Đã tích Làm lại mã cũ thì phải nhập mã hàng", không ghi |
| Tích + nhập mã hàng + chọn NV + SP + SL rồi Lưu | Ghi được; bảng hiện "♻️ Làm lại mã cũ" + mã hàng ở cột Lệnh SX, cột Ảnh và Mã rập trống |
| Thưởng tháng đó | Cộng bình thường như dòng có lệnh (Tính lương → tab KPI/sản phẩm) |
| Bỏ tích, chọn lệnh như cũ | Ghi như trước, không đổi gì |
| Sửa một dòng "làm lại" | Form mở ra đã tích sẵn, mã hàng điền sẵn |
| Chưa chạy migration_v905 mà tích | Báo rõ "Chưa chạy migration_v905.sql …", dòng CÓ lệnh vẫn ghi bình thường |

Bộ kiểm: `kiem_san_luong_theo_lenh.js` (+7 phép mục 6 — có phép chặn JOIN thường quay lại). File: `migration_v905.sql` (**MỚI**), `utils/sanLuongTheoLenh.js`, `routes/qlsx.js` (`pm2 restart`), `module.qlsx.js` (**9.81**), `module.mypay.js` (**9.81**), `index.html`.

---

## 40. Nghiệm thu — 1 MÀU TRẢI NHIỀU BÀN CẮT hệ số khác nhau: Đóng gói / Kho nhập quy đổi Ri theo SỐ SIZE, hệ số lấy theo từng bàn (v9.82, CHƯA deploy, cần migration_v906)

Anh hỏi 19/11: *"1 lệnh sản xuất có 1 màu trải nhiều bàn cắt hệ số khác nhau, phần ghi tiến độ đóng gói và kho nhập thể hiện như nào. Chỉ lấy hệ số theo cắt không lấy theo lệnh."* — và chốt công thức: *"Lấy hệ số của bàn cắt chia theo số size. Ví dụ 3-7 có 5 size lấy 10/5 để tính số ri: 10/5 = 2 × 5 lớp = 10 ri."*

**🔴 Gốc của lỗi: hệ thống đang gộp HAI con số khác hẳn nhau làm một.**

| | Nghĩa | Lưu ở | Thuộc về |
|---|---|---|---|
| **cái / LỚP** | một lớp vải cắt ra mấy cái | `TienDoCatChiTietCay.HeSoQuyDoi` | **từng bàn cắt** |
| **cái / RI** | một ri gồm mấy cái (= số size) | `DonHangDaiSize.HeSo`, hoặc **`DonHangSanXuat.HeSoQuyDoi`** (ô "Hệ số quy đổi" sẵn có) | **dải size / lệnh** |

> 🔴 **Bản chốt v9.85 (anh chốt sau khi đọc §40 bản đầu):** *"Giữ nguyên hệ số quy đổi và bỏ chỗ vừa thêm số size cái/1 ri. Phần đóng gói và kho nhập lấy từ hệ số quy đổi."* ⇒ **không thêm cột nào**; ô **"Hệ số quy đổi"** ở Ra lệnh SX chính là số cái trong 1 ri, đổi nhãn thành **"Hệ số quy đổi (số cái trong 1 ri)"**. ⛔ `migration_v906.sql` **KHÔNG CẦN CHẠY** (đã ghi chú đầu file). Kèm theo: ô **"Đơn vị quy đổi"** **bỏ khỏi form** — bảng `DanhMucDonViQuyDoi` và cột `DonViQuyDoiID` **giữ nguyên**, form Sửa chép lại giá trị cũ nên lệnh cũ vẫn in được "240 Ri × 5 = 1.200 Cái".

Trước v9.82, khi lệnh không tách dải, màn Đóng gói / Kho nhập lấy **cái/LỚP** đem nhân với số Ri — chỉ đúng khi một lớp = đúng một bộ ri. Các bàn lệch hệ số thì còn tệ hơn: `HeSoCat = null` ⇒ **lùi về hệ số của LỆNH** (mặc định 1) ⇒ gõ "3 Ri" lưu 3 cái.

**Luật mới:**

1. **Ri → Cái = SỐ CÁI TRONG 1 RI**: có tách dải → `DonHangDaiSize.HeSo`; không tách dải → ô **"Hệ số quy đổi (số cái trong 1 ri)"** trên form lệnh SX. **Không bao giờ lấy hệ số CẮT (cái/lớp) làm hệ số RI nữa** — đó mới là lỗi gốc.
2. **Hệ số quy đổi để 1 / chưa khai** ⇒ ô Ri **hiện nhưng khoá**, kèm câu "lệnh chưa khai Hệ số quy đổi…" — gõ thẳng số Cái. Không đoán.
3. **Hệ số cắt lấy theo TỪNG BÀN**: dưới ô nhập của màu nào cắt từ 2 bàn trở lên có bảng nhỏ `bàn · cái/lớp · lớp · cái · ri`, cộng tổng.
4. Số ri đã cắt của màu = **tổng CÁI đã cắt ÷ số cái/ri** — đúng cả khi các bàn lệch hệ số (50 = 250 ÷ 5 trong ví dụ của anh).

| Việc (dải 3-7 = 5 size) | Mong đợi |
|---|---|
| Form lệnh SX (tạo + sửa) | Ô **"Hệ số quy đổi (số cái trong 1 ri)"**; **không còn** ô "Đơn vị quy đổi", **không còn** ô "Số size" |
| Sửa một lệnh cũ rồi Lưu | Đơn vị quy đổi cũ **giữ nguyên** (bản in vẫn có "× 5 = 1.200 Cái") |
| Lệnh để Hệ số quy đổi = 1 | Ô Ri **khoá**, gõ thẳng Cái |
| Màu A: bàn 1 hệ số 5 × 20 lớp | Bảng ghi **100 cái = 20 ri** |
| Bàn 2 hệ số 10 × 5 lớp | **50 cái = 10 ri** |
| Bàn 3 hệ số 10 × 10 lớp | **100 cái = 20 ri** |
| Dòng tổng của màu A | **35 lớp · 250 cái · 50 ri** |
| Gõ "3 Ri" ở Đóng gói | Tổng (cái) = **15** (3 × 5 size) — **không** phải 3 và không phải 30 |
| Lệnh chưa khai Số size | Ô Ri **khoá**, câu đỏ "lệnh chưa khai Số size…", gõ Cái vẫn được |
| Lệnh có tách dải size | Không đổi gì — vẫn lấy hệ số của dải như v8.59 |

> ⚠️ **Số đã lưu từ trước KHÔNG đổi**: `TienDoChiTietMau` lưu số CÁI, phép quy đổi chỉ xảy ra lúc gõ. Nhưng kể từ bản này, cùng một thao tác gõ "3 Ri" có thể ra số khác trước — đó là chủ đích, trước sai.

> 🔶 **Chưa đụng tới:** phiếu nhập kho hàng hóa (`nhapkho.js`) vẫn quy đổi bằng `TheKhoHangHoa.LoaiRi` của mã hàng, không liên quan sổ cắt — anh chốt "để nguyên". Sổ cắt 11 mà mã hàng khai Ri 6 vẫn chưa có chỗ cảnh báo.

Bộ kiểm: `kiem_san_luong_theo_lenh.js` (+8 phép mục 7 — có phép cấm `heSoCuaDong` và `SoSizeRi` quay lại). File: `routes/qlsx.js` (`pm2 restart`), `module.qlsx.js` (**9.82**), `index.html`. ⛔ **`migration_v906.sql` KHÔNG chạy** — không cần migration nào cho §40.

---

## 41. Nghiệm thu — Nhóm khách hàng: mỗi khách MỘT nhóm, nhóm khác không hiện lại; bấm tên nhóm xem danh sách khách (v9.83, CHƯA deploy, không cần migration)

Anh yêu cầu 19/11: *"Mỗi khách chỉ gán vào 1 nhóm. Khi gán vào nhóm rồi ở nhóm khác thêm thì không hiện ra nữa. Khi click vào nhóm khách hiện ra list khách thuộc nhóm đó."*

1. **Một khách một nhóm** — vốn đã đúng từ v9.77 (cột đơn `KhachHang.NhomKhachHangID`), không phải sửa gì.
2. **Màn "➕ Thêm khách vào nhóm"** nay **chỉ hiện** khách chưa gán nhóm nào + khách đang thuộc chính nhóm này. Khách của nhóm khác **biến mất khỏi danh sách**, kèm dòng đếm "N khách đang thuộc nhóm khác nên không hiện ở đây — muốn chuyển thì vào nhóm cũ gỡ ra trước".
3. **Bấm vào TÊN NHÓM (hoặc số khách)** → màn **xem** danh sách khách thuộc nhóm đó, chỉ đọc, mỗi dòng có nút **Gỡ khỏi nhóm**. Tách hẳn khỏi màn thêm, bấm nhầm không còn mở ra màn gán hàng loạt.

| Việc | Mong đợi |
|---|---|
| Bấm tên nhóm "Shop lẻ" | Hiện list khách thuộc Shop lẻ + số lượng ở tiêu đề |
| Bấm số ở cột "Số khách" | Mở đúng màn xem đó |
| Nhóm rỗng | "Nhóm này chưa có khách hàng nào…" |
| Gán khách X vào Shop lẻ, rồi mở "Thêm khách" của nhóm NPP | **Không thấy** khách X; dòng đếm báo có 1 khách ở nhóm khác |
| Vào Shop lẻ → Gỡ khách X → mở lại NPP | Khách X hiện ra, tích được |
| Gỡ một khách | Chỉ khách đó rời nhóm, những người còn lại giữ nguyên |

Bộ kiểm: `kiem_nhom_khach_hang.js` (+3 phép). File: `module.danhmuc.js` (**9.83**), `index.html`. **Không migration, không đụng backend.**

---

## 42. 🔴 SỬA SỐ SAI — Phải thu khách hàng ở Báo cáo kinh doanh khai KHỐNG (thiếu trừ hàng khách trả lại) (v9.86, CHƯA deploy, không cần migration)

Nguyen 19/11: *"Số phải thu của khách ở dashboard và báo cáo kinh doanh đang lệch."* Màn hình anh gửi: Báo cáo **6.166.008.191 đ**, Dashboard **5.525.846.877 đ** — lệch **640.161.314 đ**.

**Nguyên nhân:** công thức phải thu khách của hệ thống là

```
Phải thu = Bán hàng + Điều chỉnh công nợ − Đã thu − HÀNG KHÁCH TRẢ LẠI (PhieuNhapLai)
```

`congno.js:1069` (màn Công nợ khách hàng) và `dashboard.js:200` đều trừ vế cuối từ **v6.66**. Riêng **mục B của Báo cáo tài chính** (`baocao.js:654`, `:713`) vẫn dùng công thức thời **trước v6.66** — không biết bảng `PhieuNhapLai` tồn tại. Nên nó **khai khống phải thu đúng bằng toàn bộ hàng khách đã trả lại từ trước tới nay**. Dashboard mới là số đúng.

Ba màn, một nghiệp vụ, **ba câu SQL chép tay** — `dashboard.js` có sẵn dòng cảnh báo "sửa congno.js phải sửa cả file này" nhưng `baocao.js` nằm ngoài vòng cảnh báo đó.

**Sửa:** `baocao.js` đọc thêm `PhieuNhapLai` (gác bảng bằng `OBJECT_ID` y như `congno.js`, máy chưa chạy migration_v676 vẫn chạy) và trừ vào `tongPhaiThu`; trả thêm `PhaiThu_TraLai`; bảng mục B + Excel thêm dòng **"Hàng khách trả lại"**.

**Sửa kèm (lỗi hiển thị riêng):** phụ đề thẻ chỉ in *"Bán hàng − đã thu"* nên **nhìn vào thẻ không bao giờ ra số** (9.958.021.240 − 6.432.511.657 = 3.525.509.583 ≠ 6.166.008.191 — vì thiếu Điều chỉnh công nợ ≈ 2,64 tỷ). Nay in đủ bốn vế.

| Việc | Mong đợi |
|---|---|
| Báo cáo KD › thẻ "Phải thu khách hàng" | Giảm đúng bằng tổng hàng khách trả lại; **khớp** "CÒN NỢ (lũy kế)" ở Dashboard |
| Phụ đề thẻ | "Bán hàng X + điều chỉnh Y − đã thu Z − khách trả hàng T" — cộng trừ ra đúng số to |
| Mục B của báo cáo | Có dòng "Hàng khách trả lại" (số âm) |
| Xuất Excel › sheet "Công nợ cuối kỳ" | Có dòng tương ứng |
| Đối chiếu ba màn | Báo cáo = Dashboard = tổng cột "Còn nợ" ở Công nợ khách hàng |

> ⚠️ **Con số báo cáo sẽ GIẢM** ~640 triệu — đó là sửa sai, không phải mất tiền: số cũ khai khống. Nếu sau khi deploy mà **vẫn còn lệch**, chạy câu chẩn đoán ở task để tìm phần còn lại (nghi: chứng từ **tên khách rỗng** bị Dashboard loại bỏ, hoặc Dashboard đang bật lọc "khách theo dõi" / lọc nhóm).

Bộ kiểm: `kiem_doanh_thu_thuan_dashboard_bao_cao.js` (+4 phép — khoá cả ba màn vào cùng một công thức). File: `routes/baocao.js` (`pm2 restart`), `module.baocao.js` (**9.86**), `index.html`.

**✅ Đã deploy 19/11 — xác nhận đúng:** Báo cáo xuống **5.942.167.454** = 9.958.021.240 + 2.640.498.608 − 6.432.511.657 − 223.840.737.

---

## 43. 🔴 Dashboard ĐANG LỌC mà không nói — thẻ "CÒN NỢ (lũy kế)" chỉ là một phần (v9.87, CHƯA deploy, không cần migration)

Sau §42, hai màn **vẫn** lệch 416.320.577 đ. Chạy `database\kiem_tra_lech_phai_thu_v986.sql` trên CSDL thật, kết quả dứt khoát:

| Phần | Kết quả |
|---|---|
| Hai công thức dựng lại từ CSDL | **cùng ra 5.942.167.454**, lệch **0,00** |
| Chứng từ tên khách rỗng (A1–A4) | **0** — không có |
| Chứng từ ngày sau 19/11 (B1–B4) | **0** — không có |
| Số khách phải ra | **174**, nhưng Dashboard hiện **142** |

⇒ **Công thức không sai.** Dashboard đang bật **"Chọn khách theo dõi"** với 142/174 khách; 32 khách còn lại ôm đúng 416.320.577 đ công nợ. Thẻ "CÒN NỢ (lũy kế)" **chịu bộ lọc** nhưng phụ đề chỉ ghi *"tính đến hiện tại, không theo kỳ"* — không một chữ nào nói nó là **một phần**. Đọc thẻ thì tưởng là tổng công nợ toàn bộ.

Đây là lỗi **nói thiếu**, không phải lỗi số: cùng loại với *"ẩn nút vì nghiệp vụ chặn mà không nói lý do"*. Giá phải trả: hai vòng truy nguyên và một lần sửa `baocao.js` (lần đó sửa đúng, nhưng chưa đủ để khớp).

**Sửa:** backend đếm thêm **tổng số khách trước mọi bộ lọc** và trả cờ `dangLocKhach` / `dangLocNhom`. Màn hình khi đang lọc:
- Băng vàng đầu màn: **"⚠️ Đang LỌC — mọi số dưới đây chỉ của phần đang xem, không phải toàn bộ. Đang theo dõi 142/174 khách. Muốn so với Báo cáo kinh doanh thì bỏ lọc trước."** kèm nút **"Bỏ lọc, xem tất cả"**.
- Thẻ **CÒN NỢ**: phụ đề đổi thành *"⚠️ CHỈ của phần đang lọc — không phải toàn bộ"*; khi **không** lọc thì ghi *"…khớp Báo cáo kinh doanh"*.
- Thẻ **Số khách**: hiện **"142 / 174"**.

| Việc | Mong đợi |
|---|---|
| Dashboard đang chọn khách theo dõi | Băng vàng hiện ngay đầu màn; thẻ Số khách "142 / 174"; thẻ CÒN NỢ có ⚠️ |
| Bấm "Bỏ lọc, xem tất cả" | Xoá danh sách theo dõi (cả máy chủ lẫn trình duyệt) + bỏ lọc nhóm, nạp lại |
| Sau khi bỏ lọc | CÒN NỢ = **5.942.167.454**, bằng đúng Báo cáo KD; phụ đề ghi "khớp Báo cáo kinh doanh" |
| Không lọc gì từ đầu | Không có băng vàng, màn hình y như cũ |

Bộ kiểm: `kiem_nhom_khach_hang.js` (+2 phép). File: `routes/dashboard.js` (`pm2 restart`), `module.dashboard.js` (**9.87**), `index.html`.

---

## 44. Nghiệm thu — "Hệ số quy đổi (số cái trong 1 ri)" ở **Chỉ định sản xuất** BẮT BUỘC và phải KHÁC 1 (v9.88, CHƯA deploy, không cần migration)

Nguyen 21/11: *"Hệ số quy đổi (số cái trong 1 ri) thêm điều kiện bắt buộc phải nhập khác 1"* — *"ở chỉ định sản xuất"*.

**Vì sao 1 không phải giá trị hợp lệ.** Từ §40 (v9.85) ô này mang **một** nghĩa: SỐ CÁI TRONG 1 RI, và Đóng gói / Kho nhập quy đổi Ri → Cái bằng chính nó. Để 1 nghĩa là *"1 ri = 1 cái"* ⇒ ô Ri bị khoá, cả dây chuyền phải gõ tay số Cái — đúng cái lỗi §40 đi chữa. Mà 1 lại là **giá trị mặc định cũ** của cột, nên "1" gần như luôn là **chưa khai** chứ không phải đã khai.

**Luật chặn (một bảng, hai nơi cài — frontend chặn sớm, backend chặn thật):**

| Nhập | Kết quả |
|---|---|
| để trống | ❌ chặn — *"Chưa nhập… VD dải 3-7 có 5 size thì nhập 5."* |
| 0, số âm, chữ | ❌ chặn — *"phải là một số lớn hơn 0"* |
| **1** (kể cả "1.0", " 1 ") | ❌ chặn — *"KHÔNG được để 1… ô Ri sẽ bị khoá"* |
| 0 < n < 1 (vd 0,5) | ❌ chặn — *"phải LỚN HƠN 1"* |
| 2, 5, 11, 1,5 | ✅ cho qua |

**Màn hình:**
- Chỉ định sản xuất: ô **bỏ `value="1"`** (mặc định cũ chính là thứ làm ai cũng bấm Lưu mà không khai), placeholder *"Bắt buộc — VD: 5"*, nhãn có dấu `*` đỏ.
- Sửa lệnh: lệnh cũ hệ số ≤ 1 thì ô **để trống** (không hiện "1") + dòng đỏ *"Lệnh này chưa khai số cái trong 1 ri…"*.
- Câu hướng dẫn cũ *"Để 1 = ô Ri bị khoá, chỉ gõ được số Cái"* đã gỡ — nay 1 là giá trị bị từ chối.
- Báo lỗi xong thì **đưa con trỏ về đúng ô**.

🔴 **Hệ quả CỐ Ý, phải biết trước khi deploy:**
1. **Lệnh CŨ đang mang hệ số mặc định 1 sẽ không lưu được ở form Sửa** cho tới khi khai số cái/1 ri. Đó là đường **duy nhất** để chữa dữ liệu cũ, nhưng nghĩa là mở Sửa một lệnh cũ chỉ để đổi *deadline* cũng phải khai hệ số. Nếu không muốn vậy thì báo — gỡ chặn ở `PUT /orders/:maDH` là một dòng.
2. **Hàng bán theo CÁI, không chia ri** (nếu có) thì hệ số đúng **là 1** — luật mới sẽ chặn oan. Chưa gặp ca nào, nhưng đây là chỗ sẽ vỡ đầu tiên.
3. Ô hệ số ở **sổ cắt** điền sẵn theo lệnh khi lệnh không tách dải. Trước đây điền 1 (vô nghĩa, ai cũng gõ đè); nay điền một số **trông như đúng**. Hai số chỉ bằng nhau khi **1 lớp = 1 ri**; lệnh nào 1 lớp ra nhiều ri (bàn hệ số 10, dải 5 size ⇒ 2 ri/lớp) thì **phải sửa tay**. Tooltip của ô đã đổi để nói thẳng điều đó.

| Việc | Mong đợi |
|---|---|
| Chỉ định SX: để trống hệ số, bấm Lưu | Chặn, báo *"Chưa nhập…"*, con trỏ nhảy về ô |
| Chỉ định SX: gõ 1, bấm Lưu | Chặn, báo *"KHÔNG được để 1…"* |
| Chỉ định SX: gõ 5, bấm Lưu | Lưu bình thường |
| Sửa một lệnh cũ (hệ số đang 1) | Ô **trống** + dòng đỏ; bấm Lưu luôn thì bị chặn |
| Sửa lệnh đó, gõ 5, Lưu | Lưu được; vào Đóng gói / Kho nhập thì **ô Ri mở**, gõ 3 Ri ra 15 Cái |
| Gọi thẳng API `POST /api/qlsx/orders` với `heSoQuyDoi: 1` | HTTP **400** (không phải 401) kèm đúng câu trên |

Bộ kiểm: **`kiem_he_so_quy_doi_bat_buoc.js` (MỚI)** — cắt hàm `loiHeSoQuyDoi()` **thật** ra khỏi **cả hai** file rồi chạy trên cùng một bảng 17 ca, và bắt buộc hai nơi **cùng kết luận** từng ca. File: `routes/qlsx.js` (`pm2 restart`), `module.qlsx.js` (**9.88**), `index.html`. Không cần migration.

---

## 45. Nghiệm thu — BỐ CỤC 2 CỘT kiểu KiotViet cho phiếu BÁN HÀNG + NHẬP KHO (v9.89, CHƯA deploy, không cần migration)

Nguyen 23/11 kèm 2 ảnh màn KiotViet: *"thay đổi lại giao diện phiếu bán hàng và nhập kho hàng hóa"*. **Phạm vi đã chốt: chỉ bố cục 2 cột** — giữ nguyên luồng lưu, giữ cách thu tiền (phiếu thu riêng).

**Vì sao không làm POS đầy đủ.** `openPhieuBanHangForm` ~900 dòng trong `module.khohang.js`, `openForm` ~740 dòng trong `module.nhapkho.js`, và **24 bộ tự kiểm** bám vào id/class/payload của hai màn bằng so chuỗi. Làm POS (tab hoá đơn, thanh toán trong phiếu) = viết lại cả hai + sửa 24 bộ kiểm, trên màn mà `banhang.js` là **nơi duy nhất ghi `XuatCai`**. Đổi bố cục bằng cách **bọc thêm div + CSS** thì rủi ro gần như bằng 0.

**Thành quả:** dòng hàng chiếm hết bên trái; bên phải là thông tin phiếu + tổng tiền (+ nút Lưu ở phiếu bán hàng). Màn hẹp (điện thoại/máy tính bảng dọc) **tự xuống 1 cột** như cũ — `flex-wrap`, không media query.

| Màn | Trái | Phải |
|---|---|---|
| Phiếu bán hàng | bảng dòng hàng + nút "+ Thêm dòng" + "📷 Quét mã vạch" | ngày · khách · SĐT · địa chỉ · shop · NVKD · gửi mẫu · ghi chú · **TỔNG CỘNG → CK NPP → TỔNG TIỀN HÀNG → THUẾ GTGT → TỔNG SAU THUẾ → bằng chữ** · nút Lưu |
| Phiếu nhập kho | tích "Tạo thẻ kho" · danh mục cho mã mới · bảng dòng hàng | số phiếu · ngày nhập · loại nhập · nguồn · số/ngày hoá đơn · ghi chú · tổng tiền (nút Lưu giữ ở chân modal) |

**Thay đổi cấu trúc THẬT SỰ duy nhất:** chân phiếu bán hàng rời khỏi `<tbody>` (vì `<tr>` không đặt ngoài `<table>` được). Đã kiểm trước khi làm: `chanPhieuHtml()` **chỉ** `veDong()` dùng — bản in dựng HTML riêng nên **mẫu in Word không đụng**; và **không bộ kiểm nào** bám vào `.bh-chan` / `chanPhieuHtml` / `#bhTongHang`. Hàm `chanPhieuHtml()` bỏ hẳn (không để hàm chết sinh 2 chỗ cùng id); ba ô `#bhCKNPP`/`#bhVAT`/`#bhApNPP` nay nối sự kiện **một lần** thay vì mỗi lần vẽ lại bảng (trước là chồng handler).

| Việc | Mong đợi |
|---|---|
| Mở Lập phiếu bán hàng trên máy bàn | 2 cột; gõ số lượng → số bên phải nhảy ngay |
| Bấm "Áp 17%" | `#bhCKNPP` = 17, mọi dòng tiền tính lại — **chỉ chạy 1 lần** |
| Thêm/xóa dòng hàng | tổng bên phải đúng; xóa hết dòng thì hiện "Chưa có dòng nào" (không văng lỗi) |
| 📷 Quét mã vạch | +1 Ri như cũ |
| **In phiếu bán hàng** | **y hệt trước** — chân phiếu vẫn đủ 6 dòng |
| Sửa phiếu đã có | số liệu nạp đúng, lưu lại tồn kho tính lại như cũ |
| Mở trên điện thoại | tự về 1 cột, không tràn ngang |
| Nhập kho: đổi Loại nhập → Tồn đầu kỳ | ô Nguồn ở cột phải đổi theo, tiền không vào công nợ (v9.66 nguyên vẹn) |

Bộ kiểm: **`kiem_bo_cuc_phieu_2_cot.js` (MỚI)** — chủ yếu kiểm cái **KHÔNG được đổi**: liệt kê đủ 24 id + 12 class của phiếu bán hàng và 13 id của phiếu nhập kho, ràng `#bhQuet` vẫn đứng ngay sau `#bhThem`, và ràng chân phiếu đã rời **dứt điểm** (không còn `.bh-chan`, không còn neo cũ). File: `module.khohang.js` (**9.89**), `module.nhapkho.js` (**9.89**), **`css/style.css` (9.89 — quên bump là người dùng ăn CSS cũ, bố cục vỡ)**, `index.html`. Không đụng backend ⇒ không cần `pm2 restart` cho mục này.

---

## 45b. Nghiệm thu — phiếu BÁN HÀNG: 2 cột CỐ ĐỊNH, cuộn riêng, ẩn 2 trường, NHIỀU TAB hoá đơn (v9.91, CHƯA deploy, không cần migration)

Nguyen 23/11 (sau khi xem §45): *"Phiếu bán hàng phom nhập lúc nào cũng cố định 2 cột giống như kiotviet tôi đã gửi. Cột thông tin khách hàng giữ nguyên không xuống dưới bất kể độ phân giải nào. Tạm thời ẩn trường shop bán lẻ và nhân viên kinh doanh đi. 2 cột cuộn lên cuộn xuống riêng nhau. Thêm đc tab khác khi đang làm phiếu."*

**① 2 cột cố định + cuộn riêng.** Class mới `.phieu-2cot.co-dinh` (chỉ phiếu bán hàng dùng; **phiếu nhập kho giữ nguyên hành vi §45** — vẫn tự về 1 cột khi hẹp). `flex-wrap: nowrap`, cột phải ghim `flex: 0 0 340px`, mỗi cột `max-height: calc(100vh - 260px); overflow-y: auto`.
🔴 **Hệ quả CỐ Ý:** màn hẹp hơn ~820px sẽ **cuộn ngang**, không xếp chồng. Đó đúng là nghĩa của "không xuống dưới bất kể độ phân giải nào" — nếu dùng trên điện thoại thấy vướng thì bỏ chữ `co-dinh` ở một chỗ duy nhất trong `module.khohang.js`.

**② Ẩn Shop bán lẻ + NVKD.** Hai thẻ `select` đổi thành `input type=hidden`, **giữ nguyên `name` và giá trị**. Không xoá hẳn vì payload v7.24 gửi `undefined` khi thiếu trường — máy chủ hiểu là "giữ nguyên", nghe an toàn nhưng **giá trị điền sẵn cho phiếu MỚI** (shop của đơn lấy tại shop, NVKD từ Đi tuyến) sẽ mất trắng ⇒ doanh số NVKD hụt âm thầm. Dòng chữ nhắc "Đơn lấy tại shop X" vẫn hiện.

**③ Nhiều tab hoá đơn** — thanh `Hoá đơn 1 ✕ | Hoá đơn 2 ✕ | ＋` như KiotViet. Mỗi tab là **một lần gọi form đầy đủ**, giữ nguyên DOM, đổi tab chỉ ẩn/hiện ⇒ dòng đang nhập, ô đang gõ, đơn khách đã gắn đều còn nguyên. Lưu một tab = **chỉ đóng tab đó**, các tab khác vẫn đang nhập dở. Đóng tab cuối = đóng cửa sổ. Đóng tab còn dòng hàng thì hỏi trước.

🔴 **Không đụng gì tới lúc lưu**: mỗi tab gọi đúng API cũ, payload cũ. Không có "lưu hàng loạt", không gom phiếu, **không giữ nháp sau khi đóng cửa sổ**.

| Việc | Mong đợi |
|---|---|
| Mở Lập phiếu bán hàng | thanh tab "Hoá đơn 1" + nút ＋; 2 cột |
| Thu nhỏ cửa sổ trình duyệt hết cỡ | cột phải **vẫn ở bên phải**, xuất hiện thanh cuộn ngang |
| Cuộn bảng hàng bên trái | cột phải **đứng yên**, và ngược lại |
| Nhập dở Hoá đơn 1 → bấm ＋ → nhập Hoá đơn 2 → quay lại tab 1 | **dòng hàng của tab 1 còn nguyên**, tổng tiền đúng |
| Lưu Hoá đơn 2 | tab 2 đóng, in phiếu; **tab 1 vẫn còn** y nguyên |
| Đóng ✕ tab đang có dòng hàng | hỏi xác nhận |
| Đóng tab cuối cùng | cửa sổ đóng |
| Sửa một phiếu cũ | mở trong tab, vẫn ＋ thêm phiếu mới được |
| **Lưu phiếu từ đơn lấy tại shop** | ShopID + NVKD **vẫn được ghi** dù ô đã ẩn (kiểm trong CSDL) |
| **In phiếu** | y hệt trước |

Bộ kiểm: `kiem_bo_cuc_phieu_2_cot.js` **(bổ sung mục 7–9, chạy lại)** — ràng `.co-dinh` chỉ ở bán hàng, hidden còn đủ `name`, cả 3 chỗ mở phiếu đều qua khung tab, đổi tab là ẩn/hiện chứ không vẽ lại, và **không có `document.getElementById` trong form** (id trùng giữa các pane sẽ bắt nhầm). File: `module.khohang.js` (**9.91**), `css/style.css` (**9.91**), `index.html`. Không đụng backend.

---

## 45c. Nghiệm thu — phiếu BÁN HÀNG: gỡ chú thích, SĐT/Địa chỉ chỉ-đọc, "+ Khách mới" dùng form Danh mục, Ghi chú ghim đáy cột trái (v9.92, CHƯA deploy, không cần migration)

Nguyen 23/11 (kèm ảnh khoanh đỏ): *"bỏ hết dòng chú thích đi, chỗ khoang đỏ. Sđt và địa chỉ khi chọn khách mới hiện ra ko nhập, khách mới lưu danh mục đầy đủ trường như thêm ở danh mục (gọi luôn form nhập ở danh mục khách hàng). Ghi chú cho 1 hàng cuối cùng cố định ở bên cột chọn hàng hóa."*

**① Gỡ chú thích.** Hai dòng bị gỡ khỏi form: *"Công nợ nhóm theo TÊN KHÁCH…"* và dòng dài dưới ô **Gửi mẫu / cho khách mượn**. Nghiệp vụ **không đổi một ly** — nội dung đó vẫn nằm trong comment mã nguồn và ở §35/§27. **GIỮ** khối nhắc *"khách này đang giữ mẫu"* (`#bhNhacMauBox`): đó là cảnh báo theo dữ liệu thật, không phải chú thích tĩnh.

**② SĐT + Địa chỉ: chỉ-đọc, chỉ hiện khi đã có khách.** Gộp vào một khối `#bhKhachTT`, mặc định ẩn; chọn khách thì hiện và điền từ danh mục. Vẫn là `<input name="sdt">` / `<input name="diaChi">` (readonly) **chứ không đổi sang chữ thường** — đổi sang `<span>` là payload mất hai trường, phiếu in trống địa chỉ. Muốn sửa số/địa chỉ thì sửa ở **Danh mục › Khách hàng** (một nguồn, không lệch giữa các phiếu).

**③ "+ Khách mới" mở ĐÚNG form của Danh mục › Khách hàng.** Trước đây là hộp "thêm nhanh" riêng chỉ 4 ô, nên khách tạo từ phiếu bán hàng **thiếu** Tên viết hóa đơn, MST, địa chỉ/email hóa đơn, % CK ký gửi, Nhóm khách hàng. Nay `module.danhmuc.js` export `moFormKhachHang(tenGoiY, callback)`; thêm trường vào khai báo danh mục là phiếu bán hàng có ngay, không phải nhớ sửa hai nơi.
- `openForm` của Danh mục nhận thêm `opts.giaTriSan` (điền sẵn tên mà **vẫn là chế độ THÊM** — truyền `row` sẽ bật chế độ SỬA và gọi `apiPut` vào bản ghi chưa tồn tại) và `opts.sauKhiLuu` (**bắt buộc** thay `render(container, currentUser)`: gọi từ phân hệ khác thì hai biến đó là `null`).
- Giữ `themKhachNhanh()` làm **đường lùi** — PWA có thể còn cache `module.danhmuc.js` cũ; lúc đó nút vẫn phải bấm được chứ không "bấm không có gì xảy ra". Hàm này còn được **Lên đơn đặt hàng** dùng nên không xóa.

**④ Ghi chú xuống cột trái, ghim đáy.** `position: sticky; bottom: 0` trong cột trái — cuộn bảng hàng dài đến đâu vẫn thấy và gõ được. 🔴 Ô cũ bên cột phải **đã gỡ**: hai ô cùng `name="ghiChu"` thì FormData lấy ô đầu tiên, gõ vào ô kia là mất trắng (đúng lỗi v6.75). Bộ kiểm đếm và ràng **đúng một** ô.

| Việc | Mong đợi |
|---|---|
| Mở phiếu mới | không còn dòng chú thích nào ở cột phải; khối SĐT·Địa chỉ **chưa hiện** |
| Chọn một khách trong danh mục | khối SĐT·Địa chỉ hiện ra, điền sẵn, **gõ không được** |
| "+ Khách mới" | mở form **đầy đủ trường** y Danh mục › Khách hàng (có MST, Nhóm khách hàng…) |
| Lưu khách mới xong | tự chọn vào phiếu, SĐT·Địa chỉ hiện theo; **không** văng lỗi; vào Danh mục thấy đủ trường vừa khai |
| Bấm Hủy ở form khách mới | quay lại phiếu, không tạo gì |
| Cuộn bảng hàng dài | ô **Ghi chú vẫn dính đáy** cột trái |
| Gõ ghi chú rồi Lưu | ghi chú vào đúng phiếu (kiểm bản in) |
| Sửa phiếu cũ đã có SĐT/địa chỉ | khối hiện sẵn, lưu lại **không mất** sdt/diaChi |

Bộ kiểm: `kiem_bo_cuc_phieu_2_cot.js` **(bổ sung mục 10–12, chạy lại)**. File: `module.khohang.js` (**9.92**), **`module.danhmuc.js` (9.92)**, `css/style.css` (**9.92**), `index.html`. Không đụng backend.

---

## 46. Nghiệm thu — THỢ MAY TỰ GHI CÔNG ĐOẠN MAY CỦA MÌNH (v9.90, CHƯA deploy, cần migration_v907)

Nguyen 23/11: *"Công đoạn may phần cập nhật nhân viên và số lượng có thể cho nhân viên tự nhập khi phân quyền... hoặc nhân viên thuộc bộ phận may nhập công đoạn của mình. Khi nhân viên tự nhập thì **chỉ hiện ra chọn công đoạn và điền số lượng**. Để cả 2 cách cập nhật."* — chốt tiếp: *"chỉ cần thuộc bộ phận May, nhưng **chỉ nhìn thấy của mình** không thấy của người khác. Thêm tick quyền cho người khác như **tổ trưởng nhìn thấy hết** của mọi người."*

**Hai đường ghi, MỘT bảng `PhanCongMay`** — lương khoán may chỉ có một nguồn:

| Đường | Ở đâu | Ai | Ghi gì |
|---|---|---|---|
| ① Ghi hộ (cũ, **giữ nguyên**) | QLSX › Ghi tiến độ › May | quản lý có quyền QLSX/tiendo | chọn nhân viên + SL cho từng công đoạn |
| ② Tự ghi (**mới**) | MYPAY › Bảng lương của tôi, mục cuối | nhân viên **thuộc bộ phận "May"** | ngày · lệnh SX · công đoạn · số lượng |

**Phân quyền:**
- **Tự ghi: KHÔNG cần tick gì** — cứ hồ sơ nhân viên thuộc bộ phận `May` là thấy mục và ghi được. Máy chủ kiểm bộ phận, không kiểm chức năng.
- **Xem của mọi người: phải tick `MYPAY/congdoanmaytatca`** (migration_v907, `MacDinhCho = 0` ⇒ mặc định TẮT). Dùng `coQuyenChucNang()` — "không có dòng cấu hình = KHÔNG có quyền", ngược hẳn `requireChucNang`. Bắt buộc opt-in vì thấy số người khác = thấy lương khoán người khác.
- **Xem ≠ sửa:** tổ trưởng xem hết nhưng **không xóa được** dòng người khác; muốn sửa số của người khác vẫn phải vào QLSX › Ghi tiến độ (có dấu vết người cập nhật).

**Chốt an toàn:** `NhanVienID` **ép = người đang đăng nhập**, route POST **không hề đọc** `nhanVienId` từ body. Công đoạn phải thuộc **đúng lệnh đang chọn** (không kiểm thì gọi thẳng API là ghi số lệnh này vào đơn giá lệnh khác, lương sai âm thầm). Ghi/xóa đều đánh dấu bảng lương tháng đó tính lại.

| Việc | Mong đợi |
|---|---|
| Thợ may đăng nhập → Bảng lương của tôi | cuối trang có mục **"Công đoạn may của tôi"** + nút "＋ Ghi công đoạn may" |
| Bấm nút → chọn lệnh → chọn công đoạn → SL → Lưu | lưu xong bảng hiện dòng mới kèm đơn giá & thành tiền; **không có ô chọn nhân viên** |
| Ô chọn lệnh | chỉ lệnh **đã khai đơn giá công đoạn may**; gõ để lọc |
| Dòng vừa ghi | hiện luôn ở **QLSX › Ghi tiến độ › May** (cùng một bảng) và ở **Lương khoán may** của chính thợ đó |
| Thợ may khác đăng nhập | **KHÔNG thấy** dòng của người kia |
| Tick `MYPAY/congdoanmaytatca` cho tổ trưởng → đăng nhập lại | thấy **cả tổ**, có cột "Nhân viên", dòng của mình ghi "(bạn)"; **không có nút Xóa** ở dòng người khác |
| Nhân viên **không** thuộc bộ phận May | không thấy mục này; gọi thẳng API → **403** nói rõ *"Hồ sơ của bạn đang thuộc bộ phận ..."* |
| Tài khoản chưa gắn nhân viên | 403 nói rõ cần quản trị gán nhân viên |
| Quản lý vào QLSX › Ghi tiến độ › May | **y như cũ**, không mất gì |

🔴 **Hai điều phải kiểm NGAY SAU khi chạy migration** (file v907 có sẵn 2 câu SELECT ở cuối):
1. **Danh sách ai sẽ tự ghi được ngay** — mọi tài khoản gắn nhân viên bộ phận "May". Có tên lạ thì sửa bộ phận ở Nhân sự **trước** khi restart.
2. **Tên bộ phận phải đúng chữ "May"**. Nếu xưởng đặt "Tổ may" / "May 1" thì **không ai tự ghi được** — báo lại để đổi luật so khớp (đừng tự đổi tên bộ phận trong CSDL: tên đó còn dùng để lọc nhân viên Cắt/May ở nhiều màn).

Bộ kiểm: **`kiem_cong_doan_may_cua_toi.js` (MỚI)** — route POST **không được** chứa chữ `nhanVienId`; các route mới **không** gắn `requireChucNang`; `DELETE` chỉ xóa dòng của chính mình và quyền "xem hết" không mở đường xóa; **không** `toISOString()`; và **đúng hai** `INSERT INTO PhanCongMay` trong toàn file.

### 46b. 🔴 v9.93 — SỬA LỖI "thợ may vào không thấy gì" + đổi theo mô tả mới của Nguyen (23/11)

Nguyen sau khi deploy v9.90: *"Nhân viên bộ phận may vào nhưng không có phần tự cập nhật của mình. Nghĩa là mọi nhân viên bộ phận may khi có lệnh ở công đoạn may sẽ hiện ra đó và chọn công đoạn và nhập số lượng... Vẫn so sánh số lượng với tổng bàn cắt như hiện tại. Phần xem tất cả mọi người hiện theo kiểu click vào 1 lệnh ra danh sách mọi người làm lệnh đó."*

**🔴 Lỗi gốc là của tôi: v9.90 ẨN MỤC MÀ KHÔNG NÓI LÝ DO** (`if (!laBoPhanMay && !xemTatCa) return ''`). Thợ may mở ra thấy trống trơn, không cách nào biết là chưa liên kết nhân viên, sai tên bộ phận, hay file chưa copy — đúng cái lỗi dự án này đã ghi thành luật và tôi vẫn mắc.

| Sửa | Nội dung |
|---|---|
| **Luôn hiện mục** | Không ghi được thì **vẫn hiện tiêu đề** + câu lý do cụ thể từ máy chủ: *"chưa liên kết hồ sơ nhân viên"* / *"CHƯA KHAI BỘ PHẬN"* / *"đang thuộc bộ phận X"* |
| **Nới khớp tên bộ phận** | v9.90 bắt **bằng đúng** `'May'`. Nay khớp **theo từ**: "Tổ may", "May 1" đều chạy. 🔴 **Giữ dấu** — bỏ dấu thì "Máy" (cơ khí/bảo trì) thành "may" và cả tổ cơ khí ghi được vào lương khoán may. Bộ kiểm cấm `boDau` trong hàm này |
| **Lệnh tự hiện** | Bỏ ô gõ tìm. Bảng liệt kê lệnh **đang đứng ở công đoạn May** (`CongDoanHienTaiID`), mỗi dòng có **Tổng bàn cắt · Cả tổ đã may · Còn lại**, bấm **＋ Ghi phần của tôi** |
| **So với tổng bàn cắt** | Chặn ở **máy chủ** (409): tổng của **một công đoạn** (cả tổ) không vượt tổng SL cắt màu chính. Dùng `getCatMauList` — **đúng hàm** màn Ghi tiến độ dùng cho `slCatTongChinh`, không tự viết SUM khác. Cắt chưa ghi sổ (tổng 0) thì **không chặn** |
| **Xem tất cả theo LỆNH** | Nút **👥 Ai đã làm** trên từng dòng lệnh → bảng mọi người làm lệnh đó (tên · công đoạn · ngày · SL · tiền), kèm tổng bàn cắt. Vẫn đòi tick `MYPAY/congdoanmaytatca` (403 nếu không có) |
| **Form rút gọn hơn nữa** | Lệnh đã chọn từ bảng ⇒ form chỉ còn **công đoạn + số lượng** (+ ngày), đúng yêu cầu |

🔴 **Chạy `database\kiem_tra_tho_may_khong_thay_muc_v993.sql` (CHỈ ĐỌC) một lần** — cột `KetLuan` nói thẳng từng tài khoản vướng điều kiện nào, và phần C cho biết hiện **có lệnh nào đang ở công đoạn May** không (không có lệnh thì bảng rỗng, màn hình cũng nói ra).

| Việc | Mong đợi |
|---|---|
| Thợ may (bộ phận "May") mở Bảng lương của tôi | thấy mục + **bảng lệnh đang ở công đoạn May** |
| Không có lệnh nào ở công đoạn May | vẫn thấy mục, ghi *"Hiện không có lệnh nào đang ở công đoạn May"* |
| Nhân viên bộ phận khác mở | thấy mục + câu *"Hồ sơ của bạn đang thuộc bộ phận X…"* (KHÔNG còn trống trơn) |
| Tài khoản chưa gắn nhân viên | câu *"chưa được liên kết… nhờ quản trị"* |
| Bấm ＋ Ghi phần của tôi | form chỉ có công đoạn + SL; lưu xong bảng cập nhật "Cả tổ đã may" |
| Nhập SL vượt tổng bàn cắt | **chặn**, báo rõ đã ghi bao nhiêu / tổng cắt bao nhiêu |
| Bộ phận tên "Tổ may" | **vẫn ghi được** (v9.90 thì không) |
| Bộ phận tên "Máy" (cơ khí) | **KHÔNG** ghi được — đúng ý |
| Tổ trưởng có tick quyền → 👥 Ai đã làm | bảng mọi người làm lệnh đó |

File: `routes/qlsx.js` (`pm2 restart`), `module.mypay.js` (**9.93**), `index.html`, `database/migration_v907.sql` (vẫn cần, cho quyền xem tất cả), `database/kiem_tra_tho_may_khong_thay_muc_v993.sql` (chỉ đọc).

### 46c. 🔴 v9.94 — ĐỦ SỐ THEO BÀN CẮT THÌ TỰ CHUYỂN CÔNG ĐOẠN

Nguyen 23/11: *"Khi cập nhật số lượng và các công đoạn đã tạo đơn giá. Nếu đủ số lượng theo bàn cắt tự chuyển công đoạn."*

**Chuyển khi và chỉ khi đủ CẢ BỐN điều kiện:**

| | Điều kiện | Không đủ thì |
|---|---|---|
| ① | Lệnh **đang đứng** ở công đoạn May | giữ nguyên (không kéo con trỏ lệnh đã đi xa hơn — luật v5.48) |
| ② | Tổng bàn cắt **> 0** | chưa ghi sổ cắt thì không có mốc nào để gọi là "đủ" |
| ③ | Lệnh có khai **ít nhất một** công đoạn may trong bảng đơn giá | không khai thì không chuyển |
| ④ | **MỌI** công đoạn đã khai đơn giá đều có tổng SL ghi **≥ tổng bàn cắt** | còn một công đoạn thiếu là chưa chuyển |

Bộ kiểm ràng điều ④ dùng `every()` — dùng `some()` thì một công đoạn xong đã đẩy cả lệnh đi.

**🔴 Ba điều phải biết trước khi dùng:**

1. **Chuyển xong, lệnh biến mất khỏi danh sách của thợ may** (danh sách lọc theo `CongDoanHienTaiID`). Gate "vượt tổng bàn cắt" ở §46b chặn trước nên gõ nhầm 1000 thay vì 100 sẽ bị từ chối chứ không đẩy lệnh đi. Muốn kéo lại: quản lý ghi tiến độ công đoạn May như cũ.
2. **SL lũy kế theo màu**: đường "Gửi" của quản lý ghi kèm `TienDoChiTietMau` — số mà Đóng gói / Kho nhập / báo cáo đọc. Tự chuyển mà bỏ trống thì khâu sau thấy May = 0. Nên khi tự chuyển, hệ thống ghi luôn, lấy **đúng số cắt theo màu** (điều kiện ④ nói May đã làm đủ bằng tổng cắt). **Không tự chia tỉ lệ, không bịa số.** Và **chỉ ghi khi công đoạn May chưa có dòng nào** — quản lý đã nhập tay thì giữ của họ.
3. **Thông báo**: người của công đoạn sau được báo y như đường "Gửi". Lỗi gửi thông báo không làm hỏng việc đã ghi.

Màn hình **nói to** khi việc này xảy ra: *"✅ Lệnh X đã may đủ N theo bàn cắt — TỰ CHUYỂN sang công đoạn Y. Lệnh này không còn trong danh sách của bạn nữa."* (toast 12 giây). Ghi được mà chuyển hỏng cũng nói ra, kèm hướng dẫn báo tổ trưởng.

🔴 **Sửa kèm lỗi của chính v9.93**: tôi gọi `getCatMauList(pool, donHangId)` **thiếu `stageId`** ở 3 chỗ ⇒ số cắt sai/rỗng. Nay cả 3 dùng `getTongSLCatForOrder()` — hàm sẵn có, cũng chính là mốc mà gate "chưa đủ số" của Kho nhập / QC / Đóng gói đang dùng. Bộ kiểm cấm gọi `getCatMauList` thiếu tham số.

| Việc | Mong đợi |
|---|---|
| Lệnh có 3 công đoạn may, mới đủ 2 | **không** chuyển, lệnh vẫn trong danh sách |
| Ghi nốt công đoạn thứ 3 cho đủ | chuyển sang công đoạn sau + **toast nói rõ**; lệnh rời danh sách |
| Vào QLSX xem lệnh đó | con trỏ đã ở công đoạn sau; **May có SL theo màu** = số cắt theo màu |
| Lệnh chưa ghi sổ cắt | ghi bao nhiêu cũng **không** tự chuyển |
| Quản lý đã nhập tay SL theo màu ở May rồi | tự chuyển **không ghi đè** số của quản lý |
| Người của công đoạn sau | nhận được thông báo |

File: `routes/qlsx.js` (`pm2 restart`), `module.mypay.js` (**9.94**), `index.html`.

### 46d. 🔴 v9.95 — cảnh báo NGAY KHI GÕ · sửa số khi lệnh còn ở May · mọi thợ may xem được của nhau

Nguyen 23/11: *"Nếu số lượng quá bàn cắt theo từng công đoạn cảnh báo luôn khi người cuối cùng nhập không cho đi, khi chưa chuyển công đoạn mọi người vẫn có thể sửa số lượng đc. Người khác cùng bộ phận may nhìn được số lượng của người khác từng công đoạn."*

**① Cảnh báo ngay lúc gõ.** Ô chọn công đoạn hiện luôn *"còn N"*; gõ số đến đâu soát đến đó. Vượt ⇒ chữ đỏ **"⛔ VƯỢT TỔNG BÀN CẮT"** nói rõ công đoạn đó đã ghi bao nhiêu, còn bao nhiêu, và **khoá nút Lưu**. Vừa khít ⇒ chữ xanh *"vừa đủ, lưu xong có thể tự chuyển công đoạn"*. Máy chủ **vẫn chặn 409** — màn hình chỉ nói sớm, không thay gác cổng.

**② Sửa / xóa số lượng — ba cổng, thiếu một là từ chối:**

| | Điều kiện | Không qua thì |
|---|---|---|
| ① | Người gọi thuộc bộ phận May | 403 nói rõ bộ phận đang khai |
| ② | **Lệnh CÒN đứng ở công đoạn May** | 409: *"Lệnh X đã chuyển khỏi công đoạn May — nhờ tổ trưởng sửa ở QLSX › Ghi tiến độ"* |
| ③ | Dòng **của mình**, HOẶC mình là **tổ trưởng** (tick `MYPAY/congdoanmaytatca`) | 403: *"Dòng này là của <tên> — nhờ tổ trưởng sửa giúp"* |

🔴 Gate vượt-bàn-cắt khi **sửa** phải **trừ chính dòng đang sửa** ra khỏi tổng cũ — không thì sửa 50 → 60 bị tính thành 50 + 60 và chặn oan. Bộ kiểm ràng `AND ID <> @id`.
🔴 Sửa/xóa dòng **của người khác** luôn **ghi nhật ký** (console: ai sửa của ai, từ bao nhiêu sang bao nhiêu) — đây là số ăn vào lương khoán của họ.
Sửa xong cũng **xét tự chuyển công đoạn** y như lúc ghi mới (§46c).

**③ Mọi thợ may xem được của nhau.** Nút **👥 Ai đã làm** nay hiện cho **mọi** thợ may, không cần tick. Bảng **gom theo CÔNG ĐOẠN**, mỗi công đoạn một dòng tổng đối chiếu tổng bàn cắt: xanh *"đủ"*, vàng *"còn thiếu N"*, đỏ *"VƯỢT N"*. Tick `MYPAY/congdoanmaytatca` từ nay **chỉ còn một tác dụng**: cho phép **sửa/xóa** dòng của người khác.

Máy chủ trả cờ `suaDuoc` cho từng dòng — màn hình **không tự đoán luật**, chỉ vẽ theo cờ.

| Việc | Mong đợi |
|---|---|
| Công đoạn còn 20, gõ 25 | chữ đỏ ngay khi gõ + **nút Lưu xám**, không bấm được |
| Gõ lại 20 | chữ xanh *"vừa đủ"*, nút Lưu mở |
| Thợ A bấm 👥 Ai đã làm | thấy **cả tổ**, gom theo công đoạn, có dòng tổng/còn thiếu |
| Thợ A bấm Sửa ở dòng của thợ B | **không có nút Sửa** (chỉ xem) |
| Tổ trưởng bấm Sửa dòng thợ B | sửa được; log máy chủ ghi lại |
| Sửa dòng 50 → 60 khi công đoạn còn chỗ | **không** bị chặn oan |
| Lệnh đã chuyển sang khâu sau | mọi nút Sửa/Xóa biến mất + dòng chữ nói lý do |
| Sửa xong vừa đủ cả tổ | tự chuyển công đoạn + toast |

File: `routes/qlsx.js` (`pm2 restart`), `module.mypay.js` (**9.95**), `index.html`.

### 46e. 🔴 v9.96 — chỉ còn DANH SÁCH LỆNH · bấm thẳng ô SL để sửa · thêm mã rập + ảnh · popup hàng mẫu

Nguyen 23/11: *"Phần này chỉ hiện danh sách lệnh. Khi click vào lệnh hiện list danh sách các công đoạn và công nhân đã cập nhật, tổ trưởng kích vào ô sl của công nhân cần sửa để sửa số lượng. Công nhân bộ phận May vẫn chưa thấy danh sách lệnh thuộc công đoạn may"* + *"Thêm mã rập và hình ảnh"* + *"phiếu bán hàng: phần thông báo hàng mẫu đang ở khách làm popup nổi lên khi chọn khách đó"*.

**🔴 Vì sao thợ may vẫn chưa thấy danh sách lệnh — lỗi của tôi ở v9.93.** Tôi lọc **cứng** `CongDoanHienTaiID = MAY`. Nhưng v9.94 vừa thêm luật **tự chuyển** (may đủ là lệnh rời May ngay), và thực tế nhiều lệnh đã bị đẩy qua khâu sau trong khi thợ may vẫn còn phải ghi ⇒ danh sách rỗng, màn hình trông như hỏng. Nay lấy **rộng hơn**: mọi lệnh **đã khai đơn giá công đoạn may** và **chưa Hoàn thành**; lệnh đang đứng ở May gắn cờ **● Đang ở May** và **xếp lên đầu**, lệnh khác ghi rõ *đang ở khâu nào*. Nút **＋ Ghi phần của tôi** chỉ hiện ở lệnh đang ở May.

| Đổi | Nội dung |
|---|---|
| **Bỏ bảng theo tháng** | Mục công đoạn may giờ **chỉ còn danh sách lệnh**. Không mất gì: tổng lương khoán may tháng đã có mục **"Lương khoán may — Tháng X"** riêng ngay trên cùng màn — giữ hai bảng cùng nói một chuyện là thừa và sớm muộn lệch nhau |
| **Thêm cột** | **Ảnh** sản phẩm (dùng `COT_ANH_SAN_LUONG` — bản công thức ảnh lệnh dùng chung) + **Mã rập** (`maRapTheoDon`, một bản công thức hai nguồn) |
| **Sửa SL bằng cách bấm vào ô** | Ô SL nào sửa được thì gạch chân nét đứt, bấm vào biến thành ô nhập ngay tại chỗ. **Enter** hoặc rời ô = lưu, **Esc** = bỏ, số không đổi thì không gọi API. 🔴 **Không dùng `prompt()`** — trên máy tính bảng ở xưởng, prompt bật bàn phím che hết bảng |
| **Tổ trưởng chỉ-có-tick** | Người **không** thuộc bộ phận May nhưng có tick nay **cũng thấy danh sách lệnh** (trước chỉ thấy tiêu đề, dưới trống trơn). Cờ `choXem` chỉ nới cho route **đọc**; route **ghi** vẫn đòi đúng bộ phận May |

**Phiếu bán hàng — nhắc hàng mẫu thành popup.** Chọn khách đang giữ mẫu ⇒ **popup nổi lên** ngay. Ở khối khách hàng chỉ còn **một dòng tóm tắt bấm được** (*"⚠️ Khách này đang giữ N hàng mẫu chưa trả — bấm xem"*) để đóng popup rồi vẫn xem lại được. Popup **chỉ bật khi chọn khách** (và khi mở form đã có sẵn khách), **không** bật lại mỗi lần đổi mã hàng — nhảy popup liên tục lúc đang nhập thì không ai chịu được. `#bhNhacMauBox` **giữ nguyên id** vì bộ kiểm hàng mẫu khác bám vào.

| Việc | Mong đợi |
|---|---|
| Thợ may mở Bảng lương của tôi | thấy **danh sách lệnh** có Ảnh · Mã rập · Đang ở · Tổng bàn cắt · Đã may · Còn lại |
| Lệnh đã sang khâu sau | **vẫn hiện**, cột "Đang ở" ghi tên khâu đó, **không** có nút ＋ |
| Bấm 👥 Ai đã làm | list **theo công đoạn**, mỗi công đoạn có dòng tổng đối chiếu bàn cắt |
| Tổ trưởng bấm vào ô SL | ô thành input ngay tại chỗ; Enter lưu; Esc trả số cũ |
| Thợ thường bấm ô SL của người khác | **không bấm được** (không gạch chân) |
| Tổ trưởng không thuộc bộ phận May | **vẫn thấy** danh sách lệnh |
| Phiếu bán hàng: chọn khách đang giữ mẫu | **popup nổi lên**; đóng rồi còn dòng tóm tắt bấm xem lại |
| Đổi mã hàng trên phiếu | **không** bật lại popup |

File: `routes/qlsx.js` (`pm2 restart`), `module.mypay.js` (**9.96**), `module.khohang.js` (**9.96**), `index.html`.

### 46f. 🔴 v9.97 — so theo TỪNG CÔNG ĐOẠN (bỏ cột "Còn lại") · cột Ghi chú · nhiều công đoạn một lần

Nguyen 23/11 kèm ảnh: *"Không cần cột còn lại. Vì số lượng so từng công đoạn chứ không so cả lệnh... Thêm cột ghi chú. Chưa đủ hiện cột ghi chú ghi công đoạn nào thiếu bao nhiêu cái. 1 người có thể chọn được nhiều công đoạn trong 1 lần cập nhật, thêm dòng."*

**🔴 Lỗi của tôi ở v9.96, ảnh chỉ thẳng ra.** Cột *"Cả tổ đã may"* cộng **mọi công đoạn** lại rồi đem trừ tổng bàn cắt ⇒ lệnh 5 công đoạn hiện *"Còn lại −5964"*. Số đó vô nghĩa. Đúng ra **mỗi công đoạn so riêng với tổng bàn cắt** (gate 409 ở §46b vốn đã làm đúng — chỉ cái cột hiển thị là sai).

| Đổi | Nội dung |
|---|---|
| **Bỏ cột "Còn lại"** | Không có khái niệm "còn lại của cả lệnh" |
| **Cột "Đã may"** | Giữ nhưng ghi rõ dưới tiêu đề *(cộng mọi công đoạn)* — để không ai đem nó đi so nữa |
| **Thêm cột Ghi chú** | Chưa đủ: *"Thiếu: Tra cổ **120** · Vắt sổ **45**"*. Đủ: *"✔ Đủ cả N công đoạn"*. Chưa ghi sổ cắt: *"không có mốc để so"* |
| **Máy chủ** | Gom theo **(lệnh × công đoạn)**, trả `Thieu[]` + cờ `DuHet` |
| **Nhiều công đoạn một lần** | Form thành **nhiều dòng** (công đoạn + SL), nút **＋ Thêm công đoạn** / **✕** bỏ dòng. POST nhận mảng `dong[]`, vẫn nhận dạng 1 dòng cũ để bản JS trong cache không gãy |

🔴 **Chốt an toàn khi gửi nhiều dòng:** tách 100 thành 2 dòng 50 trên **cùng một công đoạn** phải bị chặn y như một dòng 100. Cả **máy chủ lẫn màn hình** đều **cộng dồn các dòng cùng công đoạn** trước khi so với tổng bàn cắt. Bộ kiểm ràng cả hai.

| Việc | Mong đợi |
|---|---|
| Lệnh 5 công đoạn, bàn cắt 498 | **không** còn cột "Còn lại"; Ghi chú ghi rõ công đoạn nào thiếu bao nhiêu |
| Một công đoạn đã đủ, bốn cái chưa | Ghi chú chỉ liệt kê **bốn cái chưa** |
| Đủ cả năm | *"✔ Đủ cả 5 công đoạn"* + lệnh **tự chuyển** công đoạn (§46c) |
| Form: thêm 3 dòng, 3 công đoạn khác nhau | lưu một lần ra **3 dòng** |
| Form: 2 dòng **cùng** công đoạn, 50 + 60, công đoạn còn 100 | **chặn** — 110 > 100, không lách được bằng cách tách dòng |
| Dòng chọn công đoạn mà bỏ trống SL | báo lỗi, không lưu nửa vời |

File: `routes/qlsx.js` (`pm2 restart`), `module.mypay.js` (**9.97**), `index.html`.

### 46g. v9.98 — cột "Đã may" liệt kê TỪNG công đoạn · ẩn lệnh đã may đủ

Nguyen 23/11: *"Cột đã may ghi rõ số lượng từng công đoạn, ko ghi tổng. Lệnh đã đủ qua công đoạn may không hiện ra nữa."*

- **Cột "Đã may"** bỏ con số tổng, liệt kê từng dòng: *Tra cổ: **498*** · *Vắt sổ: **350***… Công đoạn đã đủ tô **xanh**, chưa đủ tô **cam**. Số tổng cộng chéo các công đoạn chỉ gây hiểu nhầm — đó chính là gốc của lỗi "−5964" ở §46f.
- **Lệnh đã may đủ MỌI công đoạn: mặc định ẩn.**

🔴 **Một chốt tôi thêm, không nằm trong yêu cầu:** ẩn cứng thì **bít lối sửa**. Nút **👥 Ai đã làm** là đường **duy nhất** để sửa/xóa một dòng ghi thừa, mà nút đó nằm trên chính dòng lệnh — lệnh biến mất là hết cách sửa từ MYPAY. Nên có thêm ô tích **"Hiện cả N lệnh đã may đủ (chỉ cần khi phải sửa lại số đã ghi thừa)"**, mặc định **không** tích. Lọc hết sạch thì màn hình nói ra, không để bảng trống.

| Việc | Mong đợi |
|---|---|
| Lệnh 5 công đoạn | cột Đã may hiện **5 dòng**, mỗi dòng một công đoạn |
| Công đoạn đủ / chưa đủ | xanh / cam |
| Lệnh đã đủ mọi công đoạn | **không hiện** trong danh sách |
| Tích "Hiện cả lệnh đã đủ" | hiện lại, bấm 👥 sửa được (nếu lệnh còn ở công đoạn May) |
| Mọi lệnh đều đủ | *"Tất cả N lệnh đều đã may đủ mọi công đoạn"* — không để bảng trống |

File: `routes/qlsx.js` (`pm2 restart`), `module.mypay.js` (**9.98**), `index.html`.

### 46h. v9.99 — chấm công + công đoạn may tách thành CHỨC NĂNG RIÊNG (migration_v908)

Nguyen 23/11: *"Bảng lương của tôi đang hiện bảng chấm công trên 1 trang. Sửa thành 1 chức năng bảng chấm công trong bảng lương của tôi. Vẫn auto có khi tạo user."* → tiếp: *"Tách luôn công đoạn may thành chức năng riêng trong bảng lương của tôi."*

Trước: chấm công là **cột phải** (v9.69, §29) và công đoạn may là **mục cuối** (v9.90, §45) của cùng trang phiếu lương. Nay phân hệ **Bảng lương của tôi** có **ba mục menu**:

| Mục menu | Nội dung |
|---|---|
| **Bảng lương của tôi** | phiếu lương công nhật (một cột), khoán may, lương trải vải cắt, sản lượng theo lệnh |
| **Chấm công của tôi** | ngày · thứ · mã · giờ vào · giờ ra · công · TC · ghi chú |
| **Công đoạn may của tôi** | danh sách lệnh may + ＋ Ghi phần của tôi + 👥 Ai đã làm |

Ô **Kỳ lương** dùng chung: đổi tháng ở mục nào thì vẽ lại **đúng mục đó**, không nhảy về phiếu lương. Trang phiếu lương nay bớt **hai** lượt gọi API mỗi lần mở.

🔴 **"Vẫn auto có khi tạo user" nằm ở đúng một con số**: `migration_v908.sql` khai hai dòng `ChucNang` — `MYPAY/chamcongcuatoi` và `MYPAY/congdoanmaycuatoi` — đều **`MacDinhCho = 1`** (**tick sẵn**). Đây là điểm **khác hẳn** hai dòng MYPAY trước đó (`sanluongcuatoi` v895, `congdoanmaytatca` v907) vốn là `0` ("phải tick mới có"). Lý do: hai dòng kia là quyền **mở rộng phạm vi** (xem số của người khác); còn hai dòng mới là **của chính mình** (máy chủ lọc theo `Users.NhanVienID` của phiên) nên mặc định phải có. Hệ thống không chép quyền lúc tạo tài khoản — nó đọc `ISNULL(ChucNangPermissions.CanView, ISNULL(ChucNang.MacDinhCho, 1))`, nên đặt `1` là đủ cho **cả user cũ lẫn user mới**. Muốn giấu với một nhóm: bỏ tick ở *Ma trận phân quyền → Chức năng*.

⚠️ `congdoanmaycuatoi` **chỉ là cái menu**. Ai thật sự *ghi* được vẫn do máy chủ quyết theo **bộ phận "May"** (`chanNeuKhongPhaiThoMay()` trong `routes/qlsx.js`) — đúng chốt v9.90 *"chỉ cần thuộc bộ phận May, không phải tick gì"*. Người không thuộc bộ phận May mở mục này thấy **câu lý do của máy chủ**, không phải trang trắng.

Máy chủ gác **cùng một luật** với menu cho chấm công: `GET /api/payroll/chamcong/cuatoi` thêm `requireChucNang('MYPAY','chamcongcuatoi','view')`. Dùng `requireChucNang` chứ **không** `coQuyenChucNang`: thiếu dòng cấu hình = **cho qua**, nên chưa chạy migration cũng không ai mất chức năng.

| Việc | Mong đợi |
|---|---|
| Vào phân hệ **Bảng lương của tôi** | menu con có **3 mục** |
| Mục **Chấm công của tôi** | ô chọn kỳ + tiêu đề *"Chấm công của tôi — Tháng M/YYYY"* + bảng chấm công |
| Mục **Công đoạn may của tôi** | ô chọn kỳ + danh sách lệnh may (y như phần cũ ở cuối phiếu lương) |
| Thợ may ghi/sửa/xóa xong trong mục công đoạn may | **ở nguyên mục đó**, danh sách lệnh vẽ lại — **không** nhảy về phiếu lương |
| Đổi tháng khi đang ở một mục | vẽ lại đúng mục đó |
| Mục **Bảng lương của tôi** | **không còn** bảng chấm công ở cột phải, **không còn** mục công đoạn may ở cuối |
| **User mới tạo** (chưa cấu hình quyền gì) | **thấy ngay** cả hai mục mới |
| Nhân viên **không thuộc bộ phận May** mở mục công đoạn may | thấy câu lý do, không phải trang trắng |
| Bỏ tick một chức năng cho một nhóm → đăng nhập lại | mất mục đó trên menu (chấm công còn bị chặn 403 ở máy chủ) |
| Tài khoản **chưa gắn hồ sơ nhân viên** | mục vẫn hiện, nội dung nói rõ *"chưa được liên kết… chọn Liên kết nhân viên"* |

🔴 **Một chốt tôi thêm, không nằm trong yêu cầu — nhưng chính là điều kiện để "auto có" đúng nghĩa:** luật v9.59 trong `utils/loadUserContext.js` (gắn hồ sơ nhân viên ⇒ tự mở MYPAY, vì nhóm nào từng bấm Lưu ở Ma trận phân quyền là bị `MERGE CanView = 0` hàng loạt) trước đây **ghi cứng mỗi `MYPAY:luongcuatoi`**. Không thêm hai mục mới vào đó thì ba mục cùng tính chất lại xử sự khác nhau — và với công đoạn may thì hậu quả là **thợ may mất đường tự ghi ⇒ mất lương khoán, im lặng**, đúng loại thiệt hại mà luật v9.59 sinh ra để chặn. Nay là **danh sách trắng ba mục tự phục vụ**. ⛔ **Không** đưa `sanluongcuatoi` / `congdoanmaytatca` vào — đó là năng lực `MacDinhCho = 0`, tự mở là phá đúng ý nghĩa opt-in.

File: `database/migration_v908.sql` (**MỚI**, chạy TRƯỚC restart), `routes/payroll.js`, `utils/loadUserContext.js` (cả hai cần `pm2 restart`), `module.mypay.js` (**?v=10.00** — số cache key, bản phát hành vẫn gọi là v9.99), `index.html`. Bộ kiểm: `backend\utils\kiem_mypay_cham_cong_cua_toi.js` (mục 5 · 6 · 7), `kiem_cong_doan_may_cua_toi.js` (mục 8 đã sửa theo vị trí mới) và chạy lại `kiem_mypay_mac_dinh_theo_nhan_vien.js` (vì đụng `loadUserContext.js`).

### 46i. v10.01 — ô Số công nhập được số lẻ · chức năng "Ngày nghỉ theo năm" (migration_v909)

Nguyen 23/11: *"Các trường trong bảng này có thể nhập số bất kỳ. Số công đang chỉ nhập được 1 và 0.5, có thể nhập 0.7 0.8"* + *"Thêm chức năng xem ngày nghỉ phép của nhân viên trong 1 năm. Tổng cộng bao nhiêu ngày đã nghỉ."*

**(1) Ô nhập "Thêm / sửa 1 ngày" (Tính lương › Chấm công › bấm một nhân viên).** Bốn ô `Số công`, `Giờ TC thường / chủ nhật / lễ` đang để `step="0.5"` ⇒ **trình duyệt chặn** mọi số không chia hết cho 0,5: gõ `0.7` là báo không hợp lệ và không lưu được. Đổi sang `step="any"` + `min="0"`.

🔴 **Không cần migration:** cột trong CSDL vốn đã chịu được — `ChamCongNgay.SoCong DECIMAL(4,2)`, `GioTangCa* DECIMAL(5,2)`, và máy chủ đã nhận `sql.Decimal(4,2)`. Đây thuần túy là một thuộc tính HTML chặn nhầm. Nhập `0.75` cũng lưu đúng; `0.755` sẽ được CSDL làm tròn còn 2 chữ số.

**(2) Tab mới `Tính lương › Ngày nghỉ theo năm`** — một hàng một người:

| Cột | Nội dung |
|---|---|
| T1 … T12 | số ngày **phép** từng tháng |
| Tổng phép | cả năm |
| KL · TS · TN | không lương · thai sản · tai nạn (cả năm) |
| **TỔNG đã nghỉ** | cộng cả bốn loại |

Trên đầu có dòng tổng toàn công ty; bấm một hàng ra danh sách **từng ngày nghỉ** (ngày · loại · số ngày · nguồn · ghi chú).

🔴 **Hai quyết định tôi đã chốt, nói rõ để anh bác nếu không đúng ý:**

1. **Nguồn số là `ChamCongNgay`, KHÔNG phải `PhieuNghi`.** Giấy nghỉ chỉ là *một* trong các đường ghi — máy chấm công và sửa tay cũng đặt mã P/KL/TS/TN thẳng vào chấm công, và chính `ChamCongNgay` mới là bảng mà bảng lương đọc. Đếm theo `PhieuNghi` sẽ đẻ ra con số thứ hai lệch với phiếu lương.
2. **Hiện cả bốn loại nghỉ, không chỉ phép.** Anh hỏi "ngày nghỉ phép" nhưng kết bằng "tổng cộng bao nhiêu ngày đã nghỉ" — nghỉ không lương cũng là đã nghỉ. Nên cột **Phép** là cột chính (tô xanh), ba loại kia tách riêng, và có cột TỔNG. Muốn chỉ còn phép thì nói, bỏ ba cột là xong.

**Cách đếm dùng chung một định nghĩa với bảng lương** — `soNgayNghiCuaDong()` mới tách ra trong `utils/luongCongNhat.js`: `SoCong > 0` thì lấy chính nó (**giấy nửa ngày = 0,5**), không thì **trọn 1 ngày** (phiếu nghỉ cả ngày ghi `SoCong = 0`). `gomChamCong` nay gọi chính hàm đó thay vì viết lặp biểu thức ở hai nhánh, nên số trên tab này **khớp** với dòng "Ngày phép" trên phiếu lương. Câu SQL gộp là bản sao của hàm đó — sửa một bên phải sửa cả hai (đã ghi chú ngay tại hai chỗ).

| Việc | Mong đợi |
|---|---|
| Gõ `0.7` vào Số công rồi Lưu | lưu được, bảng hiện 0,7 |
| Gõ số âm | trình duyệt chặn |
| Tab **Ngày nghỉ theo năm**, chọn năm | bảng cả công ty, có dòng TỔNG ở chân |
| Người chưa nghỉ ngày nào | **vẫn có hàng**, các ô trống (0 cũng là câu trả lời) |
| Bấm một hàng | danh sách từng ngày nghỉ + tổng |
| Người **đã nghỉ việc** có ngày nghỉ trong năm | không lên bảng, nhưng có **băng cam** nói rõ bao nhiêu ngày bị bỏ ra |
| Đối chiếu với phiếu lương | "Tổng phép" cộng 12 tháng = tổng dòng "Ngày phép" các tháng |

### 46j. v10.02 — khối tiêu đề CỐ ĐỊNH khi cuộn · tách rõ phép / không phép / nghỉ CN

Nguyen 23/11: *"Cố định phần này. Bạn lưu vào bộ nhớ khi thêm cái gì đều cố định phần tiêu đề trở lên thành 1 khối khi cuộn trang."* + *"Ngày nghỉ theo năm khi click vào 1 người hiện rõ phép, ko phép, không phép sẽ tính theo máy kéo về không chấm công nếu ko có giấy nghỉ phép. Nếu bộ phận nghỉ CN thì tính nghỉ cn."*

**(1) LUẬT CHUNG — đã ghi vào bộ nhớ, áp cho MỌI màn hình thêm mới từ nay:** cụm **ô chọn kỳ + tiêu đề + dòng tổng + ô tìm** cố định thành **một khối** khi cuộn; chỉ phần dữ liệu cuộn. Cách làm: bọc `<div class="toolbar">` để dùng đúng cơ chế sẵn có (`common.js → capNhatThanhCongCuDinh` gắn `.sticky-bar`, đo `--bar-h`, rồi `table thead th` tự dính ngay dưới). ⛔ Không tự viết `position: sticky` (thanh và tiêu đề bảng sẽ dính cùng mốc, tiêu đề mất hút — đã vấp v6.48.2) và ⚠️ không bọc bảng trong `overflow:auto` (common.js sẽ reset `--bar-h = 0` cho div đó). Ô tìm do `themOTimTuDong` sinh ra nằm ngoài khối nên được **kéo vào** sau khi gọi.

**(2) Click một người → tách rõ từng loại.** Modal nay mở đầu bằng các ô số: **Phép · Không lương · Thai sản · Tai nạn · KHÔNG PHÉP · Nghỉ CN · TỔNG**, rồi danh sách ngày **trộn chung** cả ngày không phép và nghỉ CN, sắp theo ngày, mỗi loại một màu (không phép tô **đỏ**).

🔴 **"Không phép" KHÔNG phải luật mới — dùng đúng bộ đếm của bảng lương** (`dsNgayKhongPhep()`, v9.55): ngày **làm việc** (T2…T7, trừ lễ chung) nằm trong `[max(đầu tháng, ngày vào làm), min(cuối tháng, hôm nay)]` mà **không có một dòng chấm công nào** — `x / P / KL / TS / TN / LT` đều tính là "có dòng". Chạy 12 lần (mỗi tháng một lần) nên con số tháng nào cũng **khớp cột "Không phép" trên bảng lương tháng đó**.

🔴 **Chủ nhật:** `dsNgayKhongPhep` vốn đã loại CN, nên CN **không bao giờ** thành không phép. Người có hợp đồng tích **"bộ phận nghỉ CN"** (`HopDongLaoDong.ChuyenCanTinhCN = 0`, migration_v900) thì CN được đếm riêng thành **Nghỉ CN**; người làm cả CN (`= 1`, khối sản xuất) hiện **"—"** kèm chú thích. **Nghỉ CN KHÔNG cộng vào TỔNG** — đó là ngày nghỉ theo lịch của bộ phận, không phải ngày người đó nghỉ việc riêng. Hợp đồng đổi giữa năm thì lấy bản **hiệu lực mới nhất tính đến 31/12 năm đang xem**.

| Việc | Mong đợi |
|---|---|
| Cuộn bảng xuống | khối Năm + tiêu đề + dòng tổng + ô tìm **đứng yên**; dòng tiêu đề cột dính ngay dưới |
| Cuộn **ngang** (23 cột) | khối vẫn phủ kín, không hở dải trong suốt |
| Bấm một người | 7 ô số + danh sách ngày trộn phép / không phép / nghỉ CN |
| Một ngày T3 không có dòng chấm công, không giấy nghỉ | hiện **Nghỉ KHÔNG PHÉP** (đỏ) |
| Chủ nhật, người **bộ phận nghỉ CN** | hiện **Nghỉ chủ nhật**, không tính không phép |
| Chủ nhật, người **làm cả CN** | không hiện dòng nào; cột Nghỉ CN là "—" |
| Đối chiếu một tháng | "Không phép" tháng đó = cột Không phép trên bảng lương tháng đó |

File: `routes/payroll.js`, `utils/luongCongNhat.js` (`pm2 restart`), `module.payroll.js` (**?v=10.02**), `index.html`. **Không** có migration mới ở bước này.

File (v10.01): `database/migration_v909.sql` (**MỚI**, chạy TRƯỚC restart), `routes/payroll.js`, `utils/luongCongNhat.js` (cần `pm2 restart`), `module.payroll.js`, `index.html`. Bộ kiểm **MỚI**: `backend\utils\kiem_nghi_phep_theo_nam.js` (mục 1–6, có 5b/5c cho v10.02); chạy lại `kiem_luong_cong_nhat_v945.js` + `kiem_nghi_phep_le_chuyen_can.js` (vì đụng `luongCongNhat.js`).

### 46k. v10.03 — gộp 17 migration còn thiếu vào `CAI_DAT_DAY_DU.sql`

Nguyen 24/11: *"Viết file cài đặt đầy đủ các migration mới."*

`CAI_DAT_DAY_DU.sql` — file **duy nhất** dùng dựng hệ thống trên máy mới — đang dừng ở **migration_v891**, thiếu **17 file** (v892…v909). Cài máy mới bằng file đó sẽ thiếu: lịch nghỉ lễ + phiếu nghỉ, hợp đồng mua bán + ký điện tử, sản lượng theo lệnh, CTV thiết kế, chuyên cần bậc thang, hàng ký gửi, nhóm khách hàng, và hai chức năng MYPAY/PAYROLL vừa làm.

**Chạy một lệnh:**

```
node database\tao_file_cai_dat.js --thu     (xem trước, không ghi gì)
node database\tao_file_cai_dat.js           (ghi thật)
```

🔴 **Vì sao là script chứ không phải tôi chép tay vào file:** chép ~2.500 dòng SQL vào một file 11.900 dòng mà **không có cách biên dịch lại để đối chiếu** (sandbox chết từ 10/11) là cách chắc nhất để gài một lỗi âm thầm vào đúng cái file cứu hộ. Script đọc **thẳng byte** của từng file migration nên không có rủi ro sai chính tả, và lần sau thêm migration mới chỉ việc chạy lại — hết cảnh file cài đặt tụt hậu 17 bản.

Cách script làm, cố ý bảo thủ:

- **Chỉ nối thêm, không dựng lại từ đầu.** Thứ tự chạy đọc từ chính các dòng `[n/N] tên.sql` đang có — không đoán lại. Mọi dòng SQL cũ giữ nguyên byte, chỉ con số `[n/N]` được đánh lại.
- Phần nối thêm đặt **trước** khối `=== CAI DAT XONG ===` ở cuối file (nếu không, câu "cài đặt xong" in ra giữa chừng).
- Sao lưu bản cũ ra `CAI_DAT_DAY_DU.truoc_khi_gop.sql` trước khi ghi đè (đã thêm vào `.gitignore`).
- **Tự kiểm trên file vừa ghi** (đọc lại từ đĩa): đủ 141 mục · không mục nào lặp · số thứ tự liền mạch 1..141 · **nội dung từng migration có mặt nguyên văn** · không lẫn SQL sửa/xóa dữ liệu một lần. Sai một điều là báo đỏ và in luôn cách khôi phục.
- Chạy lại nhiều lần vô hại: file nào đã có thì báo "đã có sẵn, bỏ qua".

⛔ **`migration_v906.sql` CỐ Ý KHÔNG GỘP** — luật "số size của Ri" đã bỏ ngay trong ngày (v9.82→v9.88 chốt lại dùng `DonHangSanXuat.HeSoQuyDoi`); gộp vào là dựng lại cột đã chết trên máy mới. Script in ra dòng này mỗi lần chạy để không ai tưởng nó bị quên.

⛔ Thư mục `database/` có 171 file `.sql` nhưng phần lớn là **SQL sửa dữ liệu một lần** (`sua_*`, `xoa_*`, `tinh_lai_*`, `chan_doan_*`, `import_*`). Danh sách gộp là **danh sách trắng khai tay** trong script, **không quét bừa cả thư mục** — chạy nhầm một file `sua_*` lên máy mới là sửa dữ liệu không có thật.

File: `database/tao_file_cai_dat.js` (**MỚI**), `.gitignore`, và `database/CAI_DAT_DAY_DU.sql` (do script ghi — **chạy script xong mới commit**).

### 46l. v10.04 — phiếu bán hàng dùng hết màn rộng (1657×865)

Nguyen 24/11: *"phiếu bán hàng cho rộng hơn cho kích thước 1657x865"*

1657×865 là màn **rộng nhưng thấp**, nên phải xử lý hai chiều khác nhau — không chỉ "kéo cho to ra":

| Chiều | Trước | Nay |
|---|---|---|
| Ngang | `.modal` khoá **1240px** ⇒ bỏ phí hơn 400px, bảng hàng phải cuộn ngang trong khi màn còn chỗ | `min(1700px, 100vw − 24px)` ⇒ ở 1657px được **1633px** |
| Dọc | đệm backdrop 40px trên/dưới + chừa **260px** cho hai cột ⇒ bảng hàng chỉ còn ~600px | đệm **12px**, chừa **190px** ⇒ bảng hàng ~**675px** |
| Chia cột | trái co giãn · phải 340px | phần dư **dồn hết cho cột TRÁI**; cột phải chỉ 340 → **380px** |

Phần dư cố ý không chia đều: chỗ thiếu là **bảng hàng**, còn cột phải nới rộng quá thì nhãn và ô nhập xa nhau, đọc mỏi mắt chứ không lợi gì.

🔴 **Nới cho RIÊNG phiếu bán hàng, không nới `.modal` chung** — hơn 200 cửa sổ khác đang dựa vào mốc 1240px. Cách làm: gắn class `bh-rong` lên **backdrop** (không phải `.modal`), vì cần sửa cả phần đệm của backdrop (lớp cha) lẫn bề rộng modal (lớp con) mà CSS không chọn ngược lên cha được. `openModal()` trả về chính backdrop nên gắn được bằng một dòng.

⚠️ **Gắn ở CẢ HAI đường mở form**: `moPhieuBanHangNhieuTab` (nhiều hoá đơn) và `openPhieuBanHangForm` nhánh `!khung` (mở một phiếu lẻ). Thiếu một đường là cùng một form mà hai bề ngang khác nhau — bộ kiểm đếm đúng 2 chỗ.

| Việc | Mong đợi |
|---|---|
| Mở phiếu bán hàng trên màn 1657×865 | cửa sổ rộng ~1633px, gần sát mép |
| Bảng hàng | cao thêm ~75px so với trước, bớt phải cuộn |
| Cột thông tin khách (phải) | 380px, **vẫn không xuống dưới** (luật `.co-dinh` v9.91 giữ nguyên) |
| Mở **một phiếu lẻ** (không qua tab) | rộng y hệt chế độ nhiều tab |
| Mở cửa sổ khác (nhập kho, danh mục…) | **vẫn 1240px như cũ** |

### 46m. v10.05 — cột Màu bị bóp về 0 · phiếu rộng và cao hơn nữa

Nguyen 24/11 (kèm ảnh khoanh đỏ): *"Cột mầu ko hiện ra. Cho rộng theo tên hoặc xuống dòng. Phiếu cho cao và rộng hơn nữa"*

🔴 **Gốc lỗi cột Màu — không phải thiếu chỗ, mà là đặt sai loại ràng buộc.** `<th style="width:130px">` chỉ là **gợi ý mềm**: khi tổng bề ngang các cột vượt chỗ trống, trình duyệt bóp **ô nào co được nhất**. Mọi cột số đều chứa `<input>` có bề ngang px cứng nên không co được; riêng ô Màu chứa `<select style="width:100%">` — mà `100%` của một ô đang bị bóp thì tự nó co về gần 0. Đúng cái ảnh Nguyen gửi: cột Màu còn đúng chữ "N".

Sửa: đổi sang **`min-width`** = **sàn cứng**. Thiếu chỗ thì bảng **cuộn ngang** (`#bhDong` vốn đã có `overflow-x: auto`) chứ không bóp cột nào về 0.

Hai cách Nguyen đưa ra đều làm, vì mỗi cách giải quyết một nửa:

| Cách | Áp cho |
|---|---|
| **Rộng theo tên** | `min-width` tính từ **tên màu dài nhất** trong danh mục màu của phiếu, kẹp **130…260px** — cùng công thức với cột Mã hàng (v9.56). Đây là phần cứu **ô chọn**, vì `<select>` không xuống dòng được (hạn chế của trình duyệt). |
| **Xuống dòng** | `.bh-o-mau { white-space: normal; word-break: break-word }` — áp cho dòng chữ *"khách đặt: …"* dưới ô chọn, để tên dài không đòi nới cột thêm. |

**Rộng và cao hơn nữa** (nối tiếp §46l):

| | v10.04 | v10.05 |
|---|---|---|
| Bề ngang modal | `min(1700px, 100vw − 24px)` | **`100vw − 16px`** — bỏ hẳn trần 1700px |
| Đệm backdrop | 12px | **8px** |
| Chừa chiều dọc | 190px | **150px** |

⚠️ **Không rút dưới 150px nữa**: dưới mức đó chính `.modal` phải cuộn, sinh **hai thanh cuộn lồng nhau** — khó dùng hơn là được việc. Nếu vẫn thấy chật thì cách đúng là bỏ bớt thứ chiếm chỗ dọc (thanh tab, dòng tiêu đề), nói tôi làm.

| Việc | Mong đợi |
|---|---|
| Cột **Màu** | hiện đủ ô chọn, đọc được tên màu; mã có tên màu dài thì cột tự rộng tới 260px |
| Tên màu rất dài | xuống dòng, không đẩy bảng phình ngang |
| Tổng các cột vượt chỗ | bảng **cuộn ngang**, không cột nào bị bóp về 0 |
| Bề ngang phiếu ở 1657px | **~1641px** |
| Chiều cao bảng hàng | thêm ~40px so với v10.04 |

File: `frontend/css/style.css` (**?v=10.05**), `frontend/js/module.khohang.js` (**?v=10.05**), `index.html`. Bộ kiểm: `kiem_bo_cuc_phieu_2_cot.js` (mục 7b + **7c**).

File (v10.04): `frontend/css/style.css`, `frontend/js/module.khohang.js`, `index.html`. Không đụng backend, **không có migration**.

---

## 11. Nghiệm thu — rê chuột vào ảnh nhỏ là hiện to (v9.47)

Anh yêu cầu 12/11: *"thẻ kho hàng hóa, chi tiết hàng hóa, thẻ kho phụ kiện, thẻ kho vải có hình ảnh: hiện tại đang phải click vào ảnh mới hiện to. Sửa để khi di chuột vào hình ảnh là hiện to luôn."*

Làm **một chỗ** trong `common.js` (bắt ở tầng trang, như lightbox v7.77) nên áp cho **mọi ô ảnh nhỏ** trong phần mềm, không riêng bốn màn — ô ảnh ở danh mục màu vải, đơn khách đặt, DMS… cũng được luôn. Luật: ảnh đang hiện **nhỏ** (≤ 160px) và là ảnh của phần mềm (trong link ảnh, có class `thumb`, hoặc src `/uploads/`, `/anh/`) thì rê vào là hiện bản to bên cạnh.

| Việc | Mong đợi |
|---|---|
| Rê chuột vào ô ảnh ở **Thẻ kho hàng hóa** | Sau ~0,1 giây, khung ảnh to (tới 640px, không quá 60% ngang / 80% dọc màn hình) hiện **bên phải** ô ảnh; ảnh ở sát mép phải thì khung sang **bên trái**. Dưới ảnh có mã hàng |
| Rời chuột khỏi ô ảnh | Khung biến mất ngay |
| Rê lướt dọc cột ảnh | Không nháy liên tục — chỉ ảnh chuột dừng lại mới hiện |
| **Bấm** vào ảnh | Vẫn mở toàn màn hình có nút ✕ như trước (khung xem trước tự ẩn) |
| **Chi tiết hàng hóa** (bấm vào dòng → "Lịch sử & chi tiết theo màu"): rê vào ảnh đại diện 72px và ảnh từng màu 36px | Hiện to như trên, kể cả khi đang ở trong cửa sổ |
| **Thẻ kho phụ kiện**, **Thẻ kho vải** (ô ảnh 40px) | Như trên |
| Cuộn trang / lăn chuột / gõ phím khi đang hiện | Khung ẩn |
| Trên **điện thoại / máy tính bảng** | **Không có** xem trước khi rê (không có chuột thật); chạm vẫn mở toàn màn như cũ |
| Ảnh **đang hiện lớn hơn 160px** (đã to sẵn, không có gì để "hiện to") | Không hiện khung. Ảnh sản phẩm 80px ở đầu bảng phụ kiện / kho vải vẫn ≤ 160 nên **có** |

Kỹ thuật, để anh biết khi thấy khác: bản xem trước tải ảnh cỡ **800px** (`/anh/800/…`) cho nhanh — hiện ảnh nhỏ phóng lên trước, tải xong thì nét lại; bấm mở toàn màn vẫn là ảnh gốc. Trong lúc khung đang hiện, chú giải "Bấm để phóng to" của trình duyệt được tạm tắt để không đè lên ảnh. Muốn **tắt** xem trước cho một chỗ nào đó: thêm `data-khong-xem-truoc` vào thẻ ảnh (hoặc thẻ cha) — nói tôi, tôi thêm.

---

## 8. Còn treo — không nằm trong đợt này

| Việc | Trạng thái |
|---|---|
| 🔴 **Đổi app secret Zalo đã lộ** (anh chụp màn hình trong hội thoại) | chưa làm |
| 🔴 **Đối chiếu tiền quỹ cắt T8–T11** sau v9.18 (`database\kiem_tra_v918_quy_cat_theo_thang.sql`) | chưa chạy |
| 🔴 **Đo chỗ trống ổ D: trước khi bật sao lưu log** (§4.5) | chờ anh |
| 🔶 `DBCC SHRINKFILE` lấy lại 136 MB của file .ldf — chỉ sau khi log đã được cắt ổn định vài ngày | chờ anh |
| 🔶 Zalo OA: nâng gói dịch vụ (`error -224`), tắt `user_received_message`, gỡ cờ `ZALO_OA_LOG_CHU_KY` | chờ |
| 🔶 Giá thành theo từng dải (§5.3) | chờ anh quyết |
| 🔶 Hoàn ứng (v9.32): chưa có đường ghi nhận. **Ai hoàn ứng thì ĐỪNG sửa phiếu chi cũ** | chưa viết |
| 🔶 "Giá trị tồn kho vải" (§6) | hoãn có chủ đích |
| 🔶 Xóa khối chết `__CU_renderSaoLuu_KHONG_DUNG` trong `module.users.js` | dọn sau |
