/* ================================================================================================
   XUAT HOA DON GTGT tu PHIEU BAN HANG -> file Excel nap vao VietInvoice                    v7.43
   ------------------------------------------------------------------------------------------------
   Mau: backend/templates/hoadon_vietinvoice.xlsx ("FILE MẪU DANH SÁCH HÓA ĐƠN ĐỂ NHẬP VÀO PHẦN MỀM
   VIETINVOICE"). DUNG CHINH FILE MAU LAM KHUON (doc roi ghi tiep tu dong 13) thay vi tu ve lai —
   giu nguyen 10 dong huong dan, dong tieu de 12, mau to cot va do rong cot. Sua mau chi can thay file.

   26 cot A..Z. Dong 12 = tieu de. Du lieu tu dong 13, MOI DONG HANG la MOT dong Excel.
   Cot A (So thu tu hoa don) dien o MOI DONG de VietInvoice nhom cac dong cua cung mot hoa don;
   cot B..R (thong tin dau hoa don) chi dien o DONG DAU.

   ============================ BOC THUE — DIEM QUAN TRONG NHAT ============================
   Gia tren PHIEU BAN HANG cua MOYN la GIA DA GOM THUE (nguoi dung xac nhan). Hoa don can gia
   TRUOC THUE, nen phai chia 1.08 (thue 8%).

   ⚠️ NHUNG chi chia khi phieu CHUA tach thue. `PhieuBanHang` co san `PhanTramVAT`/`TienVAT`:
       · PhanTramVAT = 0  -> gia dong DA GOM thue ngam  -> CHIA 1.08
       · PhanTramVAT > 0  -> phieu DA tach thue roi     -> KHONG chia (chia nua la boc thue HAI LAN,
                             hoa don se thap hon thuc te ~7.4%)
   Day la cho de sai nhat va sai thi khong ai thay ngay — vi ca hai truong hop deu ra so "hop ly".

   LAM TRON (nguoi dung chon): Thanh tien truoc thue = round(ThanhTien / 1.08) den DONG; Don gia =
   Thanh tien truoc thue / So luong (de 2 so le). Nho vay SL x Don gia = Thanh tien khong lech dong
   nao khi VietInvoice tinh lai.

   TIEN THUE (cot R) = TongThanhToan cua phieu - (tong thanh tien truoc thue - tien CK truoc thue).
   Tinh NGUOC nhu vay de TONG HOA DON KHOP DUNG TUNG DONG voi so da vao cong no, moi sai so lam tron
   cua tung dong duoc hap thu vao tien thue — cach ke toan thuong dung.

   CHIET KHAU NPP: dien vao cot TIM O (Ty le CK%) + P (Tien CK) = "chiet khau theo tong tien hang"
   dung nhu huong dan trong file. Tien CK cung da boc thue. Cot vang X/Y (CK tung mat hang) de trong
   vi CK shop 33% DA nam trong `GiaBan` cua tung dong.

   MA SO THUE (cot F): bang `KhachHang` KHONG co cot MST — nguoi dung chon de TRONG va tu dien tay
   truoc khi nap vao VietInvoice. Cot D (Ma khach hang) cung de trong: no chi hop le neu ma do da ton
   tai trong danh muc cua VietInvoice, dien bua se lam ca dong bi tu choi.
   ================================================================================================ */
const path = require('path');
const ExcelJS = require('exceljs');

const DUONG_MAU = path.join(__dirname, '..', 'templates', 'hoadon_vietinvoice.xlsx');
const DONG_DAU_DU_LIEU = 13;      // dong 12 la tieu de trong file mau
const THUE_MAC_DINH = 8;          // % thue GTGT (yeu cau hien tai)

const so = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const dong = v => Math.round(so(v));                       // lam tron den DONG
const le2 = v => Math.round(so(v) * 100) / 100;            // 2 so le

/* ------------------------------------------------------------------------------------------------
   TINH TOAN THUAN (khong cham CSDL, khong cham Excel) — tach rieng de kiem chung duoc bang so.
   Tra ve { thue, chia, dong: [...], tongTruocThue, ckTruocThue, tienThue, tongHoaDon, canhBao[] }
   ------------------------------------------------------------------------------------------------ */
function tinhHoaDon(header, chiTiet, { thue = THUE_MAC_DINH } = {}) {
  const canhBao = [];
  const vatPhieu = so(header.PhanTramVAT);
  /* Phieu da tach thue thi KHONG boc lan hai — xem ghi chu dau file. */
  const chia = vatPhieu > 0 ? 1 : (1 + thue / 100);
  if (vatPhieu > 0) {
    canhBao.push(`Phiếu đã tách thuế ${vatPhieu}% (TienVAT = ${dong(header.TienVAT)}) nên KHÔNG bóc thuế lần nữa `
      + '— đơn giá trên hóa đơn lấy đúng giá dòng của phiếu.');
  }
  const thueDung = vatPhieu > 0 ? vatPhieu : thue;

  const ds = (chiTiet || []).map(d => {
    /* SL lay theo DON VI GOC giong phieu in (SoLuongCai la so luong theo don vi goc — xem ghi chu
       dvGoc trong module.khohang.js v6.27). */
    const sl = so(d.SoLuongCai) || so(d.SoLuong);
    const ttTruocThue = dong(so(d.ThanhTien) / chia);
    return {
      ten: [d.TenHang || d.MaHang, d.TenMau].filter(Boolean).join(' - '),
      maHang: d.MaHang || '',
      dvt: d.DonVi || d.DonViCoBan || 'Cái',
      soLuong: sl,
      /* Don gia suy TU thanh tien de SL x Don gia = Thanh tien (khong lech dong nao). */
      donGia: sl > 0 ? le2(ttTruocThue / sl) : le2(so(d.GiaBan) / chia),
      thanhTien: ttTruocThue
    };
  });

  const tongTruocThue = ds.reduce((s, x) => s + x.thanhTien, 0);
  const ckTruocThue = dong(so(header.TienCKNPP) / chia);
  /* Tien thue = tong thanh toan cua phieu - tien truoc thue sau CK. Tinh nguoc de tong hoa don KHOP
     DUNG voi so da vao cong no; sai so lam tron cua tung dong duoc hap thu vao day. */
  const tienThue = dong(so(header.TongThanhToan) - (tongTruocThue - ckTruocThue));
  const tongHoaDon = tongTruocThue - ckTruocThue + tienThue;

  if (!ds.length) canhBao.push('Phiếu không có dòng hàng nào.');
  if (tongHoaDon !== dong(header.TongThanhToan)) {
    canhBao.push(`Tổng hóa đơn ${tongHoaDon} lệch với tổng thanh toán của phiếu ${dong(header.TongThanhToan)}.`);
  }
  /* Thue tinh nguoc lech qua xa ty le ky vong => du lieu phieu co van de, phai bao chu khong im lang. */
  const thueKyVong = dong((tongTruocThue - ckTruocThue) * thueDung / 100);
  if (Math.abs(tienThue - thueKyVong) > Math.max(10, thueKyVong * 0.01)) {
    canhBao.push(`Tiền thuế tính ngược ${tienThue} lệch nhiều so với ${thueDung}% của tiền trước thuế `
      + `(${thueKyVong}). Kiểm tra lại: giá trên phiếu có thật là giá ĐÃ gồm thuế ${thueDung}% không?`);
  }
  return { thue: thueDung, chia, dong: ds, tongTruocThue, ckTruocThue, tienThue, tongHoaDon, canhBao };
}

/* ------------------------------------------------------------------------------------------------
   GHI VAO FILE MAU. `khachHang` la ban ghi KhachHang (co the null) — chi dung de lay Email.
   ------------------------------------------------------------------------------------------------ */
async function taoWorkbookHoaDon(header, chiTiet, khachHang, tuyChon) {
  const kq = tinhHoaDon(header, chiTiet, tuyChon);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DUONG_MAU);
  const ws = wb.worksheets[0];

  const hai = n => String(n).padStart(2, '0');
  const d = new Date(header.NgayBan);
  const ngay = isNaN(d) ? '' : `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`;

  kq.dong.forEach((x, i) => {
    const r = ws.getRow(DONG_DAU_DU_LIEU + i);
    const dauHoaDon = i === 0;
    /* A: dien o MOI dong -> VietInvoice nhom cac dong cua cung mot hoa don. */
    r.getCell(1).value = 1;
    if (dauHoaDon) {
      r.getCell(2).value = ngay;                                   // B Ngay hoa don
      r.getCell(3).value = header.TenKhach || '';                  // C Ten don vi mua hang
      r.getCell(4).value = '';                                     // D Ma khach hang — de trong (xem ghi chu)
      r.getCell(5).value = header.DiaChi || '';                    // E Dia chi
      r.getCell(6).value = '';                                     // F Ma so thue — nguoi dung tu dien
      r.getCell(7).value = '';                                     // G Nguoi mua hang
      r.getCell(8).value = (khachHang && khachHang.Email) || '';    // H Email
      r.getCell(12).value = 'TM/CK';                               // L Hinh thuc thanh toan
      r.getCell(13).value = 'VND';                                 // M Loai tien
      r.getCell(14).value = 1;                                     // N Ty gia
      /* O/P: CK theo TONG TIEN HANG (cot tim) — chi dien khi phieu that su co CK NPP. */
      if (so(header.PhanTramCKNPP) > 0 || kq.ckTruocThue > 0) {
        r.getCell(15).value = so(header.PhanTramCKNPP);             // O Ty le CK(%)
        r.getCell(16).value = kq.ckTruocThue;                      // P Tien CK (da boc thue)
      }
      r.getCell(17).value = kq.thue;                               // Q % thue GTGT
      r.getCell(18).value = kq.tienThue;                           // R Tien thue GTGT
    }
    r.getCell(19).value = x.ten;                                   // S Ten hang hoa (*)
    r.getCell(20).value = x.maHang;                                // T Ma hang
    r.getCell(21).value = x.dvt;                                   // U DVT
    r.getCell(22).value = x.soLuong;                               // V So luong
    r.getCell(23).value = x.donGia;                                // W Don gia
    /* X/Y (CK tung mat hang) de TRONG: CK shop 33% da nam trong GiaBan cua dong. */
    r.getCell(26).value = x.thanhTien;                             // Z Thanh tien (*)
    /* Cot trong mau dinh dang Text ('@') — dat lai General cho cac o SO de Excel/VietInvoice doc
       dung la so, khong phai chuoi. */
    [14, 15, 16, 17, 18, 22, 23, 26].forEach(c => { r.getCell(c).numFmt = 'General'; });
    r.commit && r.commit();
  });

  return { wb, kq };
}

module.exports = { tinhHoaDon, taoWorkbookHoaDon, DUONG_MAU, DONG_DAU_DU_LIEU, THUE_MAC_DINH };
