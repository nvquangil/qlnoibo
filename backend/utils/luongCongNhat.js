/* ==================================================================================================
   luongCongNhat.js — BỘ TÍNH LƯƠNG CÔNG NHẬT v9.45, THUẦN TÚY (không CSDL, không request)
   --------------------------------------------------------------------------------------------------
   Viết lại từ bảng lương THỰC TẾ T10/2026 của MOYN (docs/PRD_v945_luong_cong_nhat_theo_bang_thuc_te.md),
   thay bộ `tinhLuongCongNhat` v6.1 vốn chép từ `luong.xlsm` tháng 7 — sai mô hình (có thuế + giảm trừ
   mà thực tế không áp, thiếu thử việc/KPI/chức vụ/chuyên cần, OT không cộng vào lĩnh).

   Hai mô hình trong MỘT hàm, chọn theo `KieuLuong` của hợp đồng:
     'Ngay'  — 36 người sheet 1:  đơn giá ngày × số ngày
     'Thang' — 11 người sheet 2:  lương CB ÷ công chuẩn × (ngày thử việc × 85% + ngày chính thức)

   🔴 Nguyen chốt 11/11/2026 (mỗi dòng dưới đây là một quyết định, không phải mặc định của tôi):
     · OT = lương cơ bản ÷ số giờ một ngày × 1,5 × giờ OT — MỘT công thức cho mọi người, mọi loại giờ
       (hệ số lấy từ cfg.HsTangCaThuong, mặc định 1,5; CN/lễ KHÔNG nhân khác). Bảng T10 dùng 4 tỷ lệ
       lẫn lộn ⇒ OT tính lại sẽ KHÁC file — cố ý.
     · Thuế TNCN: VẪN TÍNH và hiện, chỉ TRỪ vào thực lĩnh khi cfg.TruThueTNCN = 1 (mặc định 0).
     · Chuyên cần: mất khi có PHÉP, hoặc thiếu công chuẩn, hoặc ĐI MUỘN (dù một ngày).
     · Công chuẩn: theo bảng CongChuanThang.
     · Xăng xe: đơn giá/ngày × ROUND(ngày đi làm thực) — phép KHÔNG tính (sheet 2).
     · KPI thang 100 điểm. Thưởng = QuyKPI × điểm/100 × MIN(1, tổng công ÷ CC); có ô ghi đè số tiền.
       (Lan KTT T10: 8tr dù 26,5/27 công — file không theo công thức ⇒ phải dùng ô ghi đè.)
     · Tỷ lệ thử việc: hợp đồng khai thì theo hợp đồng (Sâm T10 là 70%), không thì cấu hình (85).
     · Thưởng theo sản phẩm = Σ SL × đơn giá (nhiều sản phẩm, mỗi SP một đơn giá), KHÔNG prorate.

   Mọi số tiền làm tròn ĐỒNG ở từng khoản; THỰC LĨNH làm tròn theo cfg.LamTronThucLinh (nghìn).
   ================================================================================================== */
'use strict';

function so(n) { const v = Number(n); return Number.isFinite(v) ? v : 0; }
function r0(n) { return Math.round(so(n)); }

/* Thuế TNCN: 5 bậc kiểu MAX-of-lines (giữ nguyên bản v6.1 để số không đổi). */
function calcThueTNCN(tn, brackets) {
  const x = so(tn);
  if (x <= 0 || !Array.isArray(brackets) || !brackets.length) return 0;
  let best = 0;
  brackets.forEach(b => {
    const t = x * so(b.ThueSuat) - so(b.TruDi);
    if (t > best) best = t;
  });
  return r0(best);
}

/* Tỷ lệ thử việc: hợp đồng khai thì dùng (đơn vị %), không thì cấu hình, không nữa thì 85. */
function tyLeThuViecCua(e, cfg) {
  const hd = so(e.TyLeThuViec);
  if (hd > 0) return hd / 100;
  const c = so(cfg.TyLeThuViec);
  return (c > 0 ? c : 85) / 100;
}

/* --------------------------------------------------------------------------------------------------
   e  = một nhân viên, GỒM thông số hợp đồng + số liệu tháng đã gom (xem gomChamCong ở dưới):
        KieuLuong, LuongCoBan, DonGiaNgay, LuongCoDinhThang, MucDongBH,
        PhuCapAnCa, PhuCapTrangPhuc, PhuCapXangXe, PhuCapDienThoai, SoCongXangXe, SoCongAnTrua,
        PhuCapChucVu, PhuCapChuyenCan, QuyKPI, KieuThuong, TyLeThuViec, SoNguoiPhuThuoc,
        congThuViec, congChinhThuc, congLe, soPhep, soNgayMuon, gioOT, conThuViec,
        diemKPI (null = chưa đánh giá), tienKPIGhiDe (null = không ghi đè), thuongSanPham,
        tamUng, dieuChinh
   -------------------------------------------------------------------------------------------------- */
function tinhLuongV945(e, cfg, congChuan, brackets) {
  cfg = cfg || {};
  const CC = so(congChuan) > 0 ? so(congChuan) : 26;
  const gioNgay = so(cfg.GioChuanNgay) > 0 ? so(cfg.GioChuanNgay) : 8;
  const tyLeTV = tyLeThuViecCua(e, cfg);
  const kieuLuong = String(e.KieuLuong || '').trim() === 'Ngay' ? 'Ngay' : 'Thang';

  /* ---- Công ---- */
  const congTV = so(e.congThuViec), congCT = so(e.congChinhThuc), congLe = so(e.congLe);
  const soPhep = so(e.soPhep), soNgayMuon = Math.max(0, Math.round(so(e.soNgayMuon)));
  const congLam = congTV + congCT + congLe;                 // công ĐƯỢC TRẢ LƯƠNG (phép KHÔNG)
  const congQuyDoi = congTV * tyLeTV + congCT + congLe;     // thử việc nhân tỷ lệ; lễ hưởng nguyên
  const tongCong = congLam + soPhep;                        // hiển thị + chia chức vụ/KPI (phép CÓ)
  const ngayDiLam = congTV + congCT;                        // cho xăng xe: đi làm thật (lễ, phép KHÔNG)

  /* ---- Lương ---- */
  const luongCB = so(e.LuongCoBan), donGiaNgay = so(e.DonGiaNgay), luongCoDinh = so(e.LuongCoDinhThang);
  let luong, mucGio;
  if (kieuLuong === 'Ngay') {
    luong = r0(donGiaNgay * congQuyDoi);
    mucGio = donGiaNgay / gioNgay;
  } else {
    luong = r0(luongCB / CC * congQuyDoi);
    mucGio = luongCB / CC / gioNgay;
  }
  /* Lương cố định tháng: GHI ĐÈ bất kể công (O Tám 10tr/tháng dù 31 ngày). Chỉ ghi đè phần LƯƠNG,
     các khoản khác vẫn tính theo công. */
  if (luongCoDinh > 0) luong = r0(luongCoDinh);

  /* ---- Tăng ca: MỘT công thức cho mọi người, mọi loại giờ (Nguyen 11/11) ---- */
  const hsOT = so(cfg.HsTangCaThuong) > 0 ? so(cfg.HsTangCaThuong) : 1.5;
  const heSoTV_OT = e.conThuViec ? tyLeTV : 1;             // sheet 2: Loan thử việc, OT × 0,85
  const gioOT = so(e.gioOT);
  const donGiaGioOT = mucGio * hsOT * heSoTV_OT;
  const tangCa = r0(gioOT * donGiaGioOT);

  /* Tỷ lệ công cho các khoản THÁNG (KPI, chức vụ, trang phục, điện thoại): tổng công (CÓ phép) ÷ CC,
     CHẶN TRÊN 1 — khoản "tối đa / tháng" không vượt mức tháng khi làm hơn công chuẩn. Bằng chứng: Hợp
     31 công / CC 26 nhận đúng 500k "TN, KPI" (sheet 1), Lan 2tr × 26,5/27 và Loan 1,6tr × 19,5/27
     (sheet 2) đều prorate xuống. Duyên 27/26 × 500k = 519.231 ở sheet 1 là Excel chia 26 trong tháng
     27 công — với một công chuẩn chung cả tháng (Nguyen chốt) ô này về 500k. */
  const tyLeCong = Math.min(1, tongCong / CC);

  /* ---- Thưởng: KPI hoặc theo sản phẩm, theo hợp đồng ---- */
  const kieuThuong = String(e.KieuThuong || '').trim();
  let thuong = 0, diemKPI = null, chuaDanhGiaKPI = false;
  if (kieuThuong === 'KPI') {
    if (e.tienKPIGhiDe != null && e.tienKPIGhiDe !== '') {
      thuong = r0(e.tienKPIGhiDe);
      diemKPI = e.diemKPI == null ? null : so(e.diemKPI);
    } else if (e.diemKPI == null || e.diemKPI === '') {
      chuaDanhGiaKPI = true;                                 // chưa chấm ⇒ 0 và BÁO, không bịa 100
    } else {
      diemKPI = Math.max(0, Math.min(100, so(e.diemKPI)));
      thuong = r0(so(e.QuyKPI) * diemKPI / 100 * tyLeCong);
    }
  } else if (kieuThuong === 'SanPham') {
    thuong = r0(e.thuongSanPham);                            // Σ SL × đơn giá, KHÔNG prorate (Media)
  }

  /* ---- Phụ cấp ---- */
  /* Ăn ca: cùng luật với xăng — số THÁNG cho SoCongAnTrua công ⇒ đơn giá/ngày × ROUND(ngày đi làm).
     Không đi làm thì không ăn; phép không tính. (Hai bảng T10 không có khoản này — để 0 là ra 0.) */
  const anCaNgay = so(e.PhuCapAnCa) / (so(e.SoCongAnTrua) > 0 ? so(e.SoCongAnTrua) : CC);
  const pcAnCa = r0(anCaNgay * Math.round(ngayDiLam));
  const pcTrangPhuc = r0(so(e.PhuCapTrangPhuc) * tyLeCong);
  const pcDienThoai = r0(so(e.PhuCapDienThoai) * tyLeCong);
  /* Xăng: PhuCapXangXe là số THÁNG cho SoCongXangXe công (mẫu hợp đồng v8.82) ⇒ đơn giá/ngày =
     tháng ÷ số công khai; không khai thì ÷ CC. Nhân với ROUND(ngày đi làm) — sheet 2: Lan 25,5 → 26,
     Loan 19,5 → 20 (Math.round làm tròn nửa lên, khớp). */
  const xangNgay = so(e.PhuCapXangXe) / (so(e.SoCongXangXe) > 0 ? so(e.SoCongXangXe) : CC);
  const pcXangXe = r0(xangNgay * Math.round(ngayDiLam));
  const pcChucVu = r0(so(e.PhuCapChucVu) * tyLeCong);       // Lan: 2tr × 26,5 ÷ 27 — phép CÓ tính
  /* Chuyên cần: đủ công chuẩn + KHÔNG phép + KHÔNG đi muộn. Một trong ba sai là mất cả khoản. */
  const duChuyenCan = congLam >= CC - 1e-9 && soPhep === 0 && soNgayMuon === 0;
  const chuyenCan = duChuyenCan ? r0(e.PhuCapChuyenCan) : 0;

  /* ---- Bảo hiểm: trên MỨC ĐÓNG RIÊNG, không trên lương. Trống/0 = không đóng. ---- */
  const mucDongBH = so(e.MucDongBH);
  const bhxh = r0(mucDongBH * so(cfg.BhxhNld) / 100);
  const bhyt = r0(mucDongBH * so(cfg.BhytNld) / 100);
  const bhtn = r0(mucDongBH * so(cfg.BhtnNld) / 100);
  const tongBH = bhxh + bhyt + bhtn;

  /* ---- Thuế: tính luôn, trừ hay không là công tắc ---- */
  const tnMienThue = pcAnCa + pcTrangPhuc;
  const tnChiuThue = luong + tangCa + thuong + pcXangXe + pcDienThoai + pcChucVu + chuyenCan;
  const giamTruBanThan = so(cfg.GiamTruBanThan);
  const giamTruNPT = so(cfg.GiamTruNPT) * so(e.SoNguoiPhuThuoc);
  const tnTinhThue = Math.max(0, tnChiuThue - tongBH - giamTruBanThan - giamTruNPT);
  const thue = calcThueTNCN(tnTinhThue, brackets);
  const truThue = cfg.TruThueTNCN === true || cfg.TruThueTNCN === 1 || cfg.TruThueTNCN === '1';
  const tienThueTru = truThue ? thue : 0;             // SỐ TIỀN trừ; cờ `thueDaTru` trả ra là BOOLEAN

  /* ---- Thực lĩnh ---- */
  const tamUng = so(e.tamUng), dieuChinh = r0(e.dieuChinh);
  const lamTron = so(cfg.LamTronThucLinh) > 0 ? so(cfg.LamTronThucLinh) : 1;
  const thucLinhTho = tnChiuThue + tnMienThue - tongBH - tienThueTru - tamUng + dieuChinh;
  const thucLinh = Math.round(thucLinhTho / lamTron) * lamTron;

  return {
    kieuLuong, kieuThuong,
    congThuViec: congTV, congChinhThuc: congCT, congLe, soPhep, soNgayMuon, cong: tongCong, congLam,
    luongCB, donGiaNgay, luongNgayCong: luong,
    gioOT, donGiaGioOT: Math.round(donGiaGioOT * 100) / 100, tangCa,
    diemKPI, chuaDanhGiaKPI, thuong,
    pcAnCa, pcTrangPhuc, pcXangXe, pcDienThoai, pcChucVu, chuyenCan, duChuyenCan,
    mucDongBH, bhxh, bhyt, bhtn, tongBH,
    tnMienThue, tnChiuThue, giamTruBanThan, giamTruNPT, tnTinhThue, thue, thueDaTru: truThue,
    tamUng, dieuChinh, thucLinh
  };
}

/* --------------------------------------------------------------------------------------------------
   GOM CHẤM CÔNG THÁNG của một người thành các con số bộ tính cần.
   rows: [{ ngay:'YYYY-MM-DD', maCham, soCong, gioVao:'HH:MM'|null, gioOT }]
   ngayHetThuViec: 'YYYY-MM-DD' | null · gioVaoCauHinh: 'HH:MM' · chamChuocPhut: số phút
   Thuần túy, so sánh CHUỖI ngày (tránh lệch múi giờ của driver — xem ghi chú useUTC ở payroll.js).
   -------------------------------------------------------------------------------------------------- */
function phut(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function gomChamCong(rows, ngayHetThuViec, gioVaoCauHinh, chamChuocPhut) {
  const g = { congThuViec: 0, congChinhThuc: 0, congLe: 0, soPhep: 0, soNgayMuon: 0, gioOT: 0 };
  const mocTV = ngayHetThuViec ? String(ngayHetThuViec).slice(0, 10) : null;
  const vaoChuan = phut(gioVaoCauHinh);
  /* Thiếu cấu hình (máy chưa chạy migration_v890 ⇒ cfg.DiMuonChamChuocPhut = undefined) thì châm chước
     5 phút như mặc định của migration — KHÔNG phải 0, kẻo trễ 1 phút là mất chuyên cần (rà chéo v9.45). */
  const chamChuoc = chamChuocPhut == null || chamChuocPhut === '' ? 5 : Math.max(0, so(chamChuocPhut));
  (rows || []).forEach(r => {
    const ma = String(r.maCham || '').trim().toUpperCase();
    const soCong = so(r.soCong);
    g.gioOT += so(r.gioOT);
    if (ma === 'P') { g.soPhep += soCong > 0 ? soCong : 1; return; }   // phép: KHÔNG lương, KHÔNG xăng
    if (ma === 'TS' || ma === 'KL') return;                            // thai sản / không lương: không gì
    if (ma === 'LT') { g.congLe += soCong > 0 ? soCong : 1; return; }  // lễ hưởng lương
    if (soCong <= 0) return;
    const ngay = String(r.ngay || '').slice(0, 10);
    if (mocTV && ngay && ngay <= mocTV) g.congThuViec += soCong; else g.congChinhThuc += soCong;
    const vao = phut(r.gioVao);
    if (vaoChuan != null && vao != null && vao > vaoChuan + chamChuoc) g.soNgayMuon++;
  });
  return g;
}

module.exports = { tinhLuongV945, gomChamCong, calcThueTNCN, tyLeThuViecCua };
