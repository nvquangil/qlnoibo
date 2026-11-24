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
   🔴 Nguyen chốt 14/11/2026 (v9.55):
     · Kiểu thưởng thứ ba 'ChuyenCan' — BẬC THANG theo công: hợp đồng khai các bậc (SoCong, TienThuong);
       hưởng BẬC CAO NHẤT có SoCong ≤ công đi làm (TV + CT + lễ hưởng lương, KHÔNG tính phép), mỗi bậc
       là SỐ TỔNG (không cộng dồn), KHÔNG xét đi muộn. Chọn kiểu này thì phụ cấp chuyên cần cố định
       (PhuCapChuyenCan) BỎ QUA — bậc thang thay thế, không trả hai lần.
     · Mã chấm công 'TN' (tai nạn) xử lý như TS/KL: không công, không lương, không xăng.
     · "Không phép" = ngày làm việc (T2–T7, trừ CN, trừ lễ chung, từ ngày vào làm, tới hôm nay) không có
       dòng chấm công nào — chỉ hiện để đối chiếu, KHÔNG trừ tiền (chuyên cần đã mất vì thiếu công).
     · Lễ chung (NgayLeChung) KHÔNG có công — chỉ là ngày nghỉ.

   Mọi số tiền làm tròn ĐỒNG ở từng khoản; THỰC LĨNH làm tròn theo cfg.LamTronThucLinh (nghìn).
   ================================================================================================== */
'use strict';
const { tachKieuThuong } = require('./kieuThuong');   // v9.73: nhiều kiểu thưởng — thuần, không CSDL

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

/* === v9.55 CHUYEN CAN BAC THANG + KHONG PHEP — BAT DAU === */
/* Thưởng chuyên cần bậc thang: bac = [{ SoCong, TienThuong }] (thứ tự bất kỳ, cho phép trùng/rác),
   cong = công đi làm. Trả tiền của BẬC CAO NHẤT có SoCong ≤ cong; không đạt bậc nào ⇒ 0.
   Nguyen chốt 14/11: mỗi bậc là số tổng, không cộng dồn. */
function thuongChuyenCanBac(bac, cong) {
  const c = so(cong);
  let tot = null;
  (Array.isArray(bac) ? bac : []).forEach(b => {
    const moc = so(b && (b.SoCong != null ? b.SoCong : b.soCong));
    const tien = so(b && (b.TienThuong != null ? b.TienThuong : b.tienThuong));
    if (!(moc > 0) || c + 1e-9 < moc) return;
    if (tot === null || moc > tot.moc) tot = { moc, tien };
  });
  return tot ? r0(tot.tien) : 0;
}
/* v9.72 — Thưởng chuyên cần theo SỐ NGÀY NGHỈ: bac = [{ SoNgayNghiToiDa, TienThuong }] (0 = phải đi đủ). Trả tiền của bậc
   có SoNgayNghiToiDa NHỎ NHẤT mà vẫn ≥ số ngày nghỉ (bậc chặt nhất còn đạt được = tiền cao nhất theo cách khai thường
   gặp: 0 ngày → 500k, 2 ngày → 300k). Nghỉ nhiều hơn mọi bậc ⇒ 0. Bậc không có SoNgayNghiToiDa (dòng cũ) bỏ qua. */
function thuongChuyenCanTheoNghi(bac, soNgayNghi) {
  const n = Math.max(0, so(soNgayNghi));
  let tot = null;
  (Array.isArray(bac) ? bac : []).forEach(b => {
    const v = b && (b.SoNgayNghiToiDa != null ? b.SoNgayNghiToiDa : b.soNgayNghiToiDa);
    if (v == null || v === '') return;
    const moc = so(v);
    const tien = so(b && (b.TienThuong != null ? b.TienThuong : b.tienThuong));
    if (n > moc + 1e-9) return;
    if (tot === null || moc < tot.moc) tot = { moc, tien };
  });
  return tot ? r0(tot.tien) : 0;
}
/* Ngày làm việc của một khoảng: T2..T7, bỏ Chủ nhật và lễ chung. tu/den: 'yyyy-mm-dd'. Trả mảng chuỗi ngày.
   Thuần chuỗi (không Date theo múi giờ): tạo Date bằng UTC để getUTCDay() không lệch. */
function dsNgayLamViec(tu, den, ngayLe) {
  const ra = [];
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(tu || '')), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(den || ''));
  if (!a || !b) return ra;
  const le = ngayLe instanceof Set ? ngayLe : new Set(Array.isArray(ngayLe) ? ngayLe.map(x => String(x).slice(0, 10)) : []);
  let d = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const cuoi = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  for (let n = 0; d <= cuoi && n < 400; d += 86400000, n++) {
    const dt = new Date(d);
    const s = dt.toISOString().slice(0, 10);
    if (dt.getUTCDay() === 0 || le.has(s)) continue;
    ra.push(s);
  }
  return ra;
}
/* v10.02 — CÁC NGÀY CHỦ NHẬT của một khoảng (bù của dsNgayLamViec ở phần Chủ nhật).
   Dùng cho báo cáo "Ngày nghỉ theo năm": hợp đồng `ChuyenCanTinhCN = 0` (bộ phận nghỉ CN) thì ngày
   Chủ nhật KHÔNG phải ngày phải đi làm ⇒ xếp vào "nghỉ CN", KHÔNG phải "không phép"
   (Nguyen 23/11: "Nếu bộ phận nghỉ CN thì tính nghỉ cn").
   Vẫn dựng ngày bằng Date.UTC như dsNgayLamViec — KHÔNG dùng new Date(chuỗi) theo giờ máy. */
function dsChuNhatTrongKhoang(tu, den) {
  const ra = [];
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(tu || '')), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(den || ''));
  if (!a || !b) return ra;
  let d = Date.UTC(+a[1], +a[2] - 1, +a[3]);
  const cuoi = Date.UTC(+b[1], +b[2] - 1, +b[3]);
  for (let n = 0; d <= cuoi && n < 400; d += 86400000, n++) {
    const dt = new Date(d);
    if (dt.getUTCDay() === 0) ra.push(dt.toISOString().slice(0, 10));
  }
  return ra;
}
/* Số ngày KHÔNG PHÉP trong tháng của một người:
   ngày làm việc (dsNgayLamViec) trong [max(đầu tháng, ngàyVào), min(cuối tháng, hômNay)] mà KHÔNG có dòng
   chấm công nào (x / P / KL / TS / TN / LT đều là "có dòng" — có mặt hoặc nghỉ có lý do).
   { nam, thang, homNay:'yyyy-mm-dd', ngayVao:'yyyy-mm-dd'|null, ngayLe:Set, dsNgayCoDong:Set|Array } */
function dsNgayKhongPhep(o) {
  const nam = so(o && o.nam), thang = so(o && o.thang);
  if (!nam || !thang) return [];
  const dau = `${nam}-${String(thang).padStart(2, '0')}-01`;
  const cuoiThang = `${nam}-${String(thang).padStart(2, '0')}-${String(new Date(Date.UTC(nam, thang, 0)).getUTCDate()).padStart(2, '0')}`;
  const homNay = String((o && o.homNay) || '').slice(0, 10);
  const ngayVao = String((o && o.ngayVao) || '').slice(0, 10);
  let tu = dau, den = cuoiThang;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ngayVao) && ngayVao > tu) tu = ngayVao;
  if (/^\d{4}-\d{2}-\d{2}$/.test(homNay) && homNay < den) den = homNay;
  if (tu > den) return [];
  const co = (o && o.dsNgayCoDong) instanceof Set ? o.dsNgayCoDong : new Set(Array.isArray(o && o.dsNgayCoDong) ? o.dsNgayCoDong.map(x => String(x).slice(0, 10)) : []);
  return dsNgayLamViec(tu, den, o && o.ngayLe).filter(s => !co.has(s));
}
/* v9.58: tách dsNgayKhongPhep (danh sách NGÀY) để màn hình liệt kê đúng những ngày bị đếm — số mà không soi được
   từng ngày thì "sao tôi bị 2 ngày" không ai trả lời được (cùng lý do với tạm ứng v9.32). */
function demKhongPhep(o) { return dsNgayKhongPhep(o).length; }
/* === v9.55 CHUYEN CAN BAC THANG + KHONG PHEP — KET THUC === */

/* --------------------------------------------------------------------------------------------------
   e  = một nhân viên, GỒM thông số hợp đồng + số liệu tháng đã gom (xem gomChamCong ở dưới):
        KieuLuong, LuongCoBan, DonGiaNgay, LuongCoDinhThang, MucDongBH,
        PhuCapAnCa, PhuCapTrangPhuc, PhuCapDienThoai (SoCongXangXe/SoCongAnTrua BỎ từ v9.68 — chia CC),
        PhuCapXangXe = ĐỒNG / 1 NGÀY công đi làm (v9.72, v9.79 chốt lại; SoKmDiLam của v9.78 KHÔNG còn đọc),
        PhuCapChucVu, PhuCapChuyenCan, QuyKPI, KieuThuong, TyLeThuViec, SoNguoiPhuThuoc,
        congThuViec, congChinhThuc, congLe, soPhep, soNgayMuon, gioOT, conThuViec,
        diemKPI (null = chưa đánh giá), tienKPIGhiDe (null = không ghi đè), thuongSanPham,
        bacChuyenCan [{SoCong, TienThuong}] (v9.55, kiểu 'ChuyenCan'), soKhongPhep (v9.55, chỉ chép),
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

  /* ---- Thưởng: KPI / theo sản phẩm / chuyên cần bậc thang — theo hợp đồng.
     v9.73 (Nguyen 17/11): hợp đồng chọn được NHIỀU kiểu ("KPI,SanPham,ChuyenCan", utils/kieuThuong) ⇒ CỘNG mọi kiểu đã chọn.
     Giá trị cũ một kiểu vẫn đúng (chuỗi một phần tử). kieuThuong trả ra = chuỗi chuẩn đã lưu. ---- */
  const dsKieu = tachKieuThuong(e.KieuThuong);
  const kieuThuong = dsKieu.join(',');
  let thuong = 0, diemKPI = null, chuaDanhGiaKPI = false, soNgayNghi = null, thuongKPI = 0, thuongSP = 0, thuongCC = 0;
  if (dsKieu.includes('KPI')) {
    if (e.tienKPIGhiDe != null && e.tienKPIGhiDe !== '') {
      thuongKPI = r0(e.tienKPIGhiDe);
      diemKPI = e.diemKPI == null ? null : so(e.diemKPI);
    } else if (e.diemKPI == null || e.diemKPI === '') {
      chuaDanhGiaKPI = true;                                 // chưa chấm ⇒ 0 và BÁO, không bịa 100
    } else {
      diemKPI = Math.max(0, Math.min(100, so(e.diemKPI)));
      thuongKPI = r0(so(e.QuyKPI) * diemKPI / 100 * tyLeCong);
    }
  }
  if (dsKieu.includes('SanPham')) {
    thuongSP = r0(e.thuongSanPham);                          // Σ SL × đơn giá, KHÔNG prorate (Media)
  }
  if (dsKieu.includes('ChuyenCan')) {
    /* v9.55: bậc cao nhất đạt được theo CÔNG ĐI LÀM (TV + CT + lễ, không phép), không xét đi muộn.
       v9.72 (Nguyen 17/11): ĐỊNH NGHĨA LẠI theo SỐ NGÀY NGHỈ TRONG THÁNG — "đi làm đủ số ngày của tháng thì 500k, nghỉ 2
       ngày thì 300k; tháng 30/31 ngày TÍNH CẢ CHỦ NHẬT". Bậc = { SoNgayNghiToiDa, TienThuong }; nghỉ = số ngày của tháng
       − lễ chung − số ngày có mặt. Bậc có SoNgayNghiToiDa ⇒ luật mới; bậc cũ (chỉ SoCong) ⇒ luật v9.55 (không bỏ rơi HĐ cũ). */
    const bacMoi = (Array.isArray(e.bacChuyenCan) ? e.bacChuyenCan : []).some(b => b && (b.SoNgayNghiToiDa != null || b.soNgayNghiToiDa != null));
    if (bacMoi && so(e.soNgayThang) > 0) {
      const coMat = e.soNgayCoMat != null ? so(e.soNgayCoMat) : Math.round(ngayDiLam);
      soNgayNghi = Math.max(0, so(e.soNgayThang) - so(e.soNgayLeThang) - coMat);
      thuongCC = thuongChuyenCanTheoNghi(e.bacChuyenCan, soNgayNghi);
    } else {
      thuongCC = thuongChuyenCanBac(e.bacChuyenCan, congLam);
    }
  }
  thuong = thuongKPI + thuongSP + thuongCC;

  /* ---- Phụ cấp ---- */
  /* Ăn ca: cùng luật với xăng — số THÁNG cho CÔNG CHUẨN THÁNG công ⇒ đơn giá/ngày × ROUND(ngày đi làm).
     Không đi làm thì không ăn; phép không tính. (Hai bảng T10 không có khoản này — để 0 là ra 0.)
     v9.68 (Nguyen 16/11): "Ký hợp đồng bỏ trường Số công chuẩn — xăng xe / ăn trưa; tính lương lấy theo công
     chuẩn của tháng trong Cấu hình lương" ⇒ KHÔNG đọc e.SoCongAnTrua / e.SoCongXangXe nữa, luôn chia cho CC
     (công chuẩn tháng, payroll.js getCongChuan). Cột cũ trong CSDL để nguyên, không ai đọc. */
  const anCaNgay = so(e.PhuCapAnCa) / CC;
  const pcAnCa = r0(anCaNgay * Math.round(ngayDiLam));
  const pcTrangPhuc = r0(so(e.PhuCapTrangPhuc) * tyLeCong);
  const pcDienThoai = r0(so(e.PhuCapDienThoai) * tyLeCong);
  /* 🔴 v9.79 (Nguyen 19/11, CHỐT LẠI: "xăng xe điền theo số tiền /1 ngày × ngày công thực tế") — MỘT CÔNG THỨC:
         xăng = PhuCapXangXe (ĐỒNG / 1 NGÀY, khai trên hợp đồng) × ngày công đi làm thực tế
     Đây là quay lại luật v9.72. Cách tính theo KM của v9.78 BỊ BỎ: `SoKmDiLam` và `cfg.XangXeDonGiaKm` không còn
     được đọc ở đâu (cột v904 để nguyên trong CSDL, vô hại). Công đi làm = thử việc + chính thức, KHÔNG tính phép,
     KHÔNG tính lễ, KHÔNG làm tròn (25,5 công × 20k = 510k). Không phụ thuộc công chuẩn.
     🔴 BẪY DỮ LIỆU CŨ — ĐỌC KỸ: hợp đồng khai TRƯỚC v9.72 ghi SỐ THÁNG (vd 540.000). Đọc nhầm số đó là đ/ngày
     ⇒ 540.000 × 27 = 14.580.000 tiền xăng một người. Vì vậy `database/sua_phu_cap_xang_xe_theo_ngay_v972.sql`
     (chia số tháng → đ/ngày) LẠI CẦN, phải chạy TRƯỚC khi tính lương; cờ `xangNghiSoThang` dưới đây để payroll.js
     réo tên những hợp đồng còn giá trị đáng ngờ. Không tự chia trong code: không biết hợp đồng nào đã sửa tay. */
  const xangNgay = so(e.PhuCapXangXe);                       // ĐỒNG / 1 NGÀY công đi làm thực tế
  const pcXangXe = r0(xangNgay * ngayDiLam);
  const NGUONG_XANG_NGAY = 100000;                           // > mức này gần như chắc chắn là SỐ THÁNG chưa chia
  const xangNghiSoThang = xangNgay >= NGUONG_XANG_NGAY;
  const thieuXangNgay = ngayDiLam > 0 && !(xangNgay > 0);    // có đi làm mà chưa khai đơn giá ngày ⇒ xăng 0
  const pcChucVu = r0(so(e.PhuCapChucVu) * tyLeCong);       // Lan: 2tr × 26,5 ÷ 27 — phép CÓ tính
  /* Chuyên cần: đủ công chuẩn + KHÔNG phép + KHÔNG đi muộn. Một trong ba sai là mất cả khoản.
     v9.55: kiểu thưởng 'ChuyenCan' (bậc thang) THAY THẾ khoản cố định này — Nguyen chốt, không trả hai lần. */
  const duChuyenCan = congLam >= CC - 1e-9 && soPhep === 0 && soNgayMuon === 0;
  const chuyenCan = dsKieu.includes('ChuyenCan') ? 0 : (duChuyenCan ? r0(e.PhuCapChuyenCan) : 0);

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
    soKhongPhep: so(e.soKhongPhep),   // v9.55: route đếm (demKhongPhep), chỉ chép vào snapshot — không vào tiền
    luongCB, donGiaNgay, luongNgayCong: luong,
    gioOT, donGiaGioOT: Math.round(donGiaGioOT * 100) / 100, tangCa,
    diemKPI, chuaDanhGiaKPI, thuong, soNgayNghi,   // v9.72: soNgayNghi = số ngày nghỉ dùng xét chuyên cần (null = luật cũ)
    thuongKPI, thuongSP, thuongCC,                 // v9.73: từng phần của thuong (nhiều kiểu cộng lại)
    pcAnCa, pcTrangPhuc, pcXangXe, pcDienThoai, pcChucVu, chuyenCan, duChuyenCan,
    xangNgay,                                                   // v9.79: đơn giá đ/NGÀY dùng để tính, phiếu lương in kèm
    thieuXangNgay, xangNghiSoThang,                             // v9.79: cờ cho payroll.js cảnh báo (0 đồng / nghi còn là số tháng)
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
/* v10.01 — MỘT ĐỊNH NGHĨA DUY NHẤT cho "dòng chấm công này tính mấy NGÀY".
   Luật (đã chạy từ v9.73, trước đây viết lặp ở hai nhánh của gomChamCong): có `SoCong > 0` thì lấy
   chính nó (giấy nửa ngày ⇒ 0,5), không có thì tính TRỌN 1 ngày (phiếu nghỉ cả ngày ghi SoCong = 0).
   🔴 Báo cáo "ngày nghỉ phép theo năm" (routes/payroll.js /chamcong/nghiphepnam) đếm theo ĐÚNG luật
   này — nếu sửa ở đây thì sửa cả biểu thức CASE trong câu SQL đó, kẻo hai màn nói hai số. */
function soNgayNghiCuaDong(r) { const c = so(r && r.soCong); return c > 0 ? c : 1; }

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
    if (ma === 'P') { g.soPhep += soNgayNghiCuaDong(r); return; }      // phép: KHÔNG lương, KHÔNG xăng
    if (ma === 'TS' || ma === 'KL' || ma === 'TN') return;             // thai sản / không lương / tai nạn (v9.55): không gì
    if (ma === 'LT') { g.congLe += soNgayNghiCuaDong(r); return; }     // lễ hưởng lương
    if (soCong <= 0) return;
    const ngay = String(r.ngay || '').slice(0, 10);
    if (mocTV && ngay && ngay <= mocTV) g.congThuViec += soCong; else g.congChinhThuc += soCong;
    const vao = phut(r.gioVao);
    if (vaoChuan != null && vao != null && vao > vaoChuan + chamChuoc) g.soNgayMuon++;
  });
  return g;
}

module.exports = { tinhLuongV945, gomChamCong, calcThueTNCN, tyLeThuViecCua,
  thuongChuyenCanBac, thuongChuyenCanTheoNghi, dsNgayLamViec, demKhongPhep, dsNgayKhongPhep,
  soNgayNghiCuaDong, dsChuNhatTrongKhoang };   // v9.55 / v9.58 / v9.72 / v10.01 / v10.02
