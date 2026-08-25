/* ================================================================================================
   XUAT HOA DON GTGT tu PHIEU BAN HANG -> file Excel nap vao VietInvoice                    v7.43
   ------------------------------------------------------------------------------------------------
   Mau: backend/templates/hoadon_vietinvoice.xlsx ("FILE MẪU DANH SÁCH HÓA ĐƠN ĐỂ NHẬP VÀO PHẦN MỀM
   VIETINVOICE"). DUNG CHINH FILE MAU LAM KHUON (doc roi ghi tiep tu dong 13) thay vi tu ve lai —
   giu nguyen 10 dong huong dan, dong tieu de 12, mau to cot va do rong cot. Sua mau chi can thay file.

   26 cot A..Z. Dong 12 = tieu de. Du lieu tu dong 13, MOI MA HANG la MOT dong Excel.
   Cot A (So thu tu hoa don) dien o MOI DONG de VietInvoice nhom cac dong cua cung mot hoa don;
   cot B..R (thong tin dau hoa don) chi dien o DONG DAU.

   v7.45: HOA DON KHONG CHI TIET MAU — gop cac dong cung ma hang thanh MOT dong, so luong la tong
   cua cac mau, ten hang KHONG kem mau. Xem khoi "GOP DONG THEO MA HANG" ben duoi.

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

   ==================== THONG TIN KHACH TREN HOA DON (v7.45, migration_v689) ====================
   Danh muc Khach hang co 4 o rieng cho hoa don — hoa don doc THANG tu day:
       C Ten don vi mua hang <- KhachHang.TenHoaDon   (lui ve header.TenKhach neu trong)
       E Dia chi             <- KhachHang.DiaChiHoaDon (lui ve header.DiaChi / KhachHang.DiaChi)
       F Ma so thue          <- KhachHang.MaSoThue
       H Email               <- KhachHang.EmailHoaDon (lui ve Email lien lac)
   VI SAO KHONG DUNG TenKhachHang cho cot C: no la KHOA GOM CONG NO (congno.js gom theo chuoi ten),
   sua thanh ten phap nhan la lech cong no. Hai thu khac nhau nen phai hai o khac nhau.

   CAI CHAN CHO DU LIEU CU: truoc khi co migration_v689, ke toan go MST vao O EMAIL ("MST: 0123456789")
   vi khong con cho nao khac -> code cu do nguyen sang cot H, thanh ra cot Email chua chuoi "MST: ..."
   con cot F thi trong (sai o hai cot mot luc). Nay: chua khai MaSoThue thi TACH SO tu Email/Ghi chu,
   va cot H chi nhan chuoi THAT SU la email (co @ + ten mien) — con lai de trong + canh bao.

   Cot D (Ma khach hang) van de trong: no chi hop le neu ma do da ton tai trong danh muc cua
   VietInvoice, dien bua se lam ca dong bi tu choi.
   ================================================================================================ */
const path = require('path');
const ExcelJS = require('exceljs');

const DUONG_MAU = path.join(__dirname, '..', 'templates', 'hoadon_vietinvoice.xlsx');
const DONG_DAU_DU_LIEU = 13;      // dong 12 la tieu de trong file mau
const THUE_MAC_DINH = 8;          // % thue GTGT (yeu cau hien tai)

const so = v => { const n = Number(v); return isFinite(n) ? n : 0; };
/* ------------------------------------------------------------------------------------------------
   MST & EMAIL — chi la CAI CHAN cho du lieu danh muc bi go lan o (xem ghi chu dau file).
   Dung o Email cua khach dang "MST: 0123456789" thi: cot F lay 0123456789, cot H de trong.
   Nguon quet: co NHAN ("MST"/"Mã số thuế"/"Tax") thi lay o dau cung duoc; KHONG co nhan thi chi
   nhan khi CA O chi la day so — de khong nhat so nha trong dia chi hay so dien thoai lam MST.
   MST Viet Nam: 10 chu so, hoac 10 + '-' + 3 (ma don vi truc thuoc).
   ------------------------------------------------------------------------------------------------ */
/* `(?<!\d)` + `(?!\d)`: day so phai DUNG 10 chu so. Go 11 so (thieu/thua mot chu) thi KHONG nhan —
   nhan bua se cat 10 so dau ra mot MST sai ma van trong "hop le"; de trong + canh bao de ke toan go
   tay thi an toan hon nhieu. */
const RE_MST_CO_NHAN = /(?:MST|M\.S\.T|Mã\s*số\s*thuế|MSDN|Tax(?:\s*code)?)\s*[:\-–]?\s*(?<!\d)(\d{10}(?:\s*-\s*\d{3})?)(?!\d)/i;
const RE_MST_TRUI = /^(\d{10}(?:\s*-\s*\d{3})?)$/;
const gonMST = s => String(s).replace(/\s+/g, '');
function tachMST(coNhan, truiCungDuoc) {
  for (const v of coNhan) {
    const m = String(v == null ? '' : v).match(RE_MST_CO_NHAN);
    if (m) return gonMST(m[1]);
  }
  for (const v of truiCungDuoc) {
    const m = String(v == null ? '' : v).trim().replace(/\s+/g, ' ').match(RE_MST_TRUI);
    if (m) return gonMST(m[1]);
  }
  return '';
}
const laEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v == null ? '' : v).trim());
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

  /* ================================ GOP DONG THEO MA HANG (v7.45) ================================
     Hoa don KHONG can chi tiet mau: moi ma hang MOT dong, so luong la TONG cua cac mau.
     (Phieu ban hang van giu chi tiet tung mau — day chi la cach TRINH BAY tren hoa don.)

     KHOA GOP CO CA DON VI: cung ma hang ma dong ban theo "Cai", dong ban theo "Bo" thi gop lai la
     cong nham hai loai so luong voi nhau va don gia ra vo nghia (bai hoc gop don khach v6.21).
     Ma hang trong (du lieu cu) thi lay TEN HANG lam khoa, khong de dong nao roi ra ngoai.

     TEN + DON GIA sau khi gop:
       · ten     = TenHoaDon cua ma hang (v7.46, migration_v690), lui ve TenHang neu chua khai.
                   TenHang la ten NOI BO (thuong kem ma hang, viet tat) — khong phai ten viet hoa don.
                   BO phan mau.
       · thanhTien = round(tong ThanhTien cua ca nhom / chia) — boc thue MOT LAN tren tong nhom,
                     khong boc tung mau roi cong (cong nhieu so da lam tron se lech them vai dong)
       · donGia  = thanhTien / tong SL  -> SL x Don gia = Thanh tien, VietInvoice tinh lai khong lech
     Cac mau trong nhom co the co GiaBan khac nhau (khuyen mai rieng mot mau); luc do don gia gop la
     GIA BINH QUAN — dung ve tien, va la cach duy nhat de mot dong the hien duoc ca nhom.
     ============================================================================================== */
  const nhom = new Map();
  (chiTiet || []).forEach(d => {
    /* SL lay theo DON VI GOC giong phieu in (SoLuongCai la so luong theo don vi goc — xem ghi chu
       dvGoc trong module.khohang.js v6.27). */
    const sl = so(d.SoLuongCai) || so(d.SoLuong);
    const dvt = d.DonVi || d.DonViCoBan || 'Cái';
    const ma = String(d.MaHang || '').trim();
    /* v7.46: uu tien TEN VIET HOA DON cua ma hang; chua khai thi lui ve ten noi bo. */
    const ten = String(d.TenHoaDon || '').trim() || d.TenHang || ma;
    const khoa = (ma || ten) + '||' + dvt;
    const g = nhom.get(khoa) || {
      ten, maHang: ma, dvt, soLuong: 0, tongTienGomThue: 0, giaBanDau: so(d.GiaBan), soMau: 0
    };
    g.soLuong += sl;
    g.tongTienGomThue += so(d.ThanhTien);
    g.soMau += 1;
    nhom.set(khoa, g);
  });

  const ds = [...nhom.values()].map(g => {
    const ttTruocThue = dong(g.tongTienGomThue / chia);
    return {
      ten: g.ten,
      maHang: g.maHang,
      dvt: g.dvt,
      soLuong: g.soLuong,
      /* Don gia suy TU thanh tien de SL x Don gia = Thanh tien (khong lech dong nao). */
      donGia: g.soLuong > 0 ? le2(ttTruocThue / g.soLuong) : le2(g.giaBanDau / chia),
      thanhTien: ttTruocThue,
      soMauDaGop: g.soMau
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
   GHI VAO FILE MAU. `khachHang` la ban ghi KhachHang (co the null) — lay ten/dia chi/MST/email
   hoa don; xem khoi "THONG TIN KHACH TREN HOA DON" o dau file.
   ------------------------------------------------------------------------------------------------ */
async function taoWorkbookHoaDon(header, chiTiet, khachHang, tuyChon) {
  const kq = tinhHoaDon(header, chiTiet, tuyChon);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DUONG_MAU);
  const ws = wb.worksheets[0];

  /* v7.45: THONG TIN KHACH — uu tien 4 o hoa don cua danh muc, thieu thi lui ve du lieu cu.
     Xem khoi ghi chu dau file. */
  const kh = khachHang || {};
  const chu = v => String(v == null ? '' : v).trim();
  const tenHoaDon = chu(kh.TenHoaDon) || chu(header.TenKhach);
  const diaChiHoaDon = chu(kh.DiaChiHoaDon) || chu(header.DiaChi) || chu(kh.DiaChi);
  const mst = chu(kh.MaSoThue) || tachMST([kh.Email, kh.GhiChu], [kh.Email, kh.GhiChu]);
  const email = laEmail(kh.EmailHoaDon) ? chu(kh.EmailHoaDon)
              : (laEmail(kh.Email) ? chu(kh.Email) : '');
  /* O Email chua thu khong phai email (thuong la MST go lan cho) -> noi ro vi sao cot H de trong. */
  if (chu(kh.Email) && !laEmail(kh.Email) && !laEmail(kh.EmailHoaDon)) {
    kq.canhBao.push(`Ô Email của khách đang chứa "${chu(kh.Email)}" — không phải email nên cột Email `
      + `của hóa đơn để trống${mst && !chu(kh.MaSoThue) ? `, đã tách MST ${mst} sang cột Mã số thuế` : ''}. `
      + 'Nên vào Danh mục → Khách hàng khai đúng ô "Mã số thuế" / "Email nhận hóa đơn".');
  }
  if (!mst) {
    kq.canhBao.push('Khách này CHƯA khai Mã số thuế trong Danh mục → Khách hàng, cột Mã số thuế của '
      + 'hóa đơn để trống — phải điền tay trước khi nạp vào VietInvoice.');
  }

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
      r.getCell(3).value = tenHoaDon;                              // C Ten don vi mua hang (ten hoa don)
      r.getCell(4).value = '';                                     // D Ma khach hang — de trong (xem ghi chu)
      r.getCell(5).value = diaChiHoaDon;                           // E Dia chi (dia chi hoa don)
      r.getCell(6).value = mst;                                    // F Ma so thue
      r.getCell(7).value = '';                                     // G Nguoi mua hang
      r.getCell(8).value = email;                                  // H Email (chi khi that su la email)
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
