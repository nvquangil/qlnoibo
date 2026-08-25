/* ================================================================================================
   KIEM CHUNG XUAT HOA DON GTGT (VietInvoice) — boc thue 8% khoi gia da gom thue        v7.43
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Goi DUNG ham that trong utils/hoaDonVietInvoice.js, va GHI FILE THAT tu file mau
   roi DOC LAI de doi chieu tung o.

   Kiem:
     1. Boc thue: Thanh tien truoc thue = round(ThanhTien / 1.08); SL x Don gia = Thanh tien
     2. TONG HOA DON KHOP DUNG TUNG DONG voi TongThanhToan cua phieu (sai so don vao tien thue)
     3. Phieu DA tach thue (PhanTramVAT > 0) thi KHONG boc lan hai
     4. Chiet khau NPP vao cot TIM O/P, cot vang X/Y de trong
     5. Ghi dung o: A moi dong, B..R chi dong dau, S..Z moi dong
     6. Canh bao khi so lieu vo ly (thue lech xa ty le ky vong)

   CACH DUNG (trong thu muc backend):
       node utils/kiem_hoa_don_vietinvoice.js
   ================================================================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const HD = require('./hoaDonVietInvoice');

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}

/* Phieu mau: gia DA GOM THUE, khong tach VAT (PhanTramVAT = 0) — dung nhu thuc te MOYN. */
function phieu({ vat = 0, ckNPP = 0, tienCK = 0 } = {}) {
  return {
    PhieuBHID: 99, SoPhieu: 'PX26099', NgayBan: '2026-08-01',
    TenKhach: 'NPP Vĩnh Phúc - A Chung', DiaChi: 'Vĩnh Phúc', KhachHangID: 5,
    PhanTramCKNPP: ckNPP, TienCKNPP: tienCK,
    PhanTramVAT: vat, TienVAT: 0,
    TongTienHang: 24819480, TienTruocVAT: 24819480 - tienCK,
    TongThanhToan: 24819480 - tienCK, TrangThai: 'Hoàn thành'
  };
}
const dongHang = [
  { MaHang: 'BD26C0501', TenHang: 'Bộ dài tay bé gái BD26C0501', TenMau: 'Hồng',
    DonVi: 'Cái', DonViCoBan: 'Cái', SoLuongCai: 36, GiaBan: 123950, ThanhTien: 4462200 },
  { MaHang: 'BD26C0502', TenHang: 'Bộ dài tay bé gái BD26C0502', TenMau: 'Xanh',
    DonVi: 'Cái', DonViCoBan: 'Cái', SoLuongCai: 30, GiaBan: 157450, ThanhTien: 4723500 },
  { MaHang: 'BD26C072', TenHang: 'Bộ dài tay bé gái BD26C072', TenMau: 'Kem',
    DonVi: 'Cái', DonViCoBan: 'Cái', SoLuongCai: 36, GiaBan: 123950, ThanhTien: 4462200 },
  { MaHang: 'BD26C047', TenHang: 'Bộ dài tay bé trai BD26C047', TenMau: 'Ghi',
    DonVi: 'Cái', DonViCoBan: 'Cái', SoLuongCai: 50, GiaBan: 134670, ThanhTien: 6733500 },
  { MaHang: 'BD26C042', TenHang: 'Bộ dài tay bé trai BD26C042', TenMau: 'Navy',
    DonVi: 'Cái', DonViCoBan: 'Cái', SoLuongCai: 36, GiaBan: 123280, ThanhTien: 4438080 }
];

(async () => {
  console.log('');
  console.log('=== 1. BOC THUE 8% (phieu chua tach thue) ===');
  const h1 = phieu();
  const k1 = HD.tinhHoaDon(h1, dongHang);
  ok(k1.chia === 1.08, 'Chia 1.08 khi PhanTramVAT = 0', String(k1.chia));
  ok(k1.thue === 8, '% thue = 8');
  /* Tung dong: round(ThanhTien / 1.08) */
  dongHang.forEach((d, i) => {
    const mong = Math.round(d.ThanhTien / 1.08);
    ok(k1.dong[i].thanhTien === mong,
      `Dong ${i + 1}: ${d.ThanhTien} / 1.08 = ${mong}`, String(k1.dong[i].thanhTien));
  });
  /* SL x Don gia = Thanh tien (khong lech dong nao) */
  k1.dong.forEach((x, i) => {
    const tinhLai = Math.round(x.soLuong * x.donGia);
    ok(tinhLai === x.thanhTien,
      `Dong ${i + 1}: SL ${x.soLuong} x DonGia ${x.donGia} = ThanhTien ${x.thanhTien}`, String(tinhLai));
  });

  console.log('');
  console.log('=== 2. TONG HOA DON KHOP TUNG DONG voi phieu ===');
  ok(k1.tongHoaDon === Math.round(h1.TongThanhToan),
    `Tong hoa don = TongThanhToan cua phieu (${h1.TongThanhToan})`,
    `tongHoaDon=${k1.tongHoaDon}`);
  ok(k1.tongTruocThue - k1.ckTruocThue + k1.tienThue === k1.tongHoaDon,
    'truoc thue - CK + thue = tong hoa don');
  /* Thue phai xap xi 8% cua tien truoc thue */
  const thueKyVong = Math.round((k1.tongTruocThue - k1.ckTruocThue) * 8 / 100);
  ok(Math.abs(k1.tienThue - thueKyVong) <= 10,
    `Tien thue ${k1.tienThue} xap xi 8% cua tien truoc thue (${thueKyVong})`);
  ok(k1.canhBao.length === 0, 'Khong co canh bao nao voi du lieu binh thuong',
    k1.canhBao.join(' | '));

  console.log('');
  console.log('=== 3. PHIEU DA TACH THUE -> KHONG boc lan hai ===');
  const h3 = phieu({ vat: 8 });
  h3.TienVAT = 1985558; h3.TongThanhToan = h3.TongTienHang + h3.TienVAT;
  const k3 = HD.tinhHoaDon(h3, dongHang);
  ok(k3.chia === 1, 'PhanTramVAT > 0 -> chia = 1 (khong boc)', String(k3.chia));
  dongHang.forEach((d, i) => {
    ok(k3.dong[i].thanhTien === d.ThanhTien,
      `Dong ${i + 1}: giu nguyen ThanhTien ${d.ThanhTien}`, String(k3.dong[i].thanhTien));
  });
  ok(k3.canhBao.some(c => /đã tách thuế/.test(c)), 'Co canh bao "phieu da tach thue"');
  ok(k3.tongHoaDon === Math.round(h3.TongThanhToan), 'Tong hoa don van khop TongThanhToan');
  /* ⚠️ Bay: neu boc lan hai thi tong se thap hon ~7.4% */
  const neuBocSai = Math.round(h3.TongTienHang / 1.08);
  ok(k3.tongTruocThue !== neuBocSai,
    'KHONG ra so cua truong hop boc hai lan (bay de sai nhat)',
    `tongTruocThue=${k3.tongTruocThue} neuBocSai=${neuBocSai}`);

  console.log('');
  console.log('=== 4. CHIET KHAU NPP (cot tim O/P) ===');
  const tienCK = 4219312;                    // 17% cua 24.819.480
  const h4 = phieu({ ckNPP: 17, tienCK });
  const k4 = HD.tinhHoaDon(h4, dongHang);
  ok(k4.ckTruocThue === Math.round(tienCK / 1.08),
    `Tien CK cung boc thue: ${tienCK} / 1.08 = ${Math.round(tienCK / 1.08)}`, String(k4.ckTruocThue));
  ok(k4.tongHoaDon === Math.round(h4.TongThanhToan),
    'Co CK van khop TongThanhToan', `${k4.tongHoaDon} vs ${Math.round(h4.TongThanhToan)}`);

  console.log('');
  console.log('=== 5. GHI FILE THAT roi DOC LAI ===');
  const { wb } = await HD.taoWorkbookHoaDon(h4, dongHang, { Email: 'npp@example.com' });
  const duong = path.join(os.tmpdir(), 'kiem_hoa_don.xlsx');
  await wb.xlsx.writeFile(duong);
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(duong);
  const ws = wb2.worksheets[0];
  /* Dong tieu de + huong dan phai CON NGUYEN (dung file mau lam khuon) */
  ok(String(ws.getCell('A12').value || '').indexOf('Số thứ tự hóa đơn') === 0,
    'Dong 12 van la dong tieu de cua file mau (khong ghi de len)');
  ok(String(ws.getCell('A1').value || '').indexOf('FILE MẪU DANH SÁCH HÓA ĐƠN') === 0,
    'Dong 1 huong dan van con nguyen');
  ok(String(ws.getCell('Z12').value || '') === 'Thành tiền(*)', 'Cot Z12 van la "Thành tiền(*)"');

  const d13 = ws.getRow(13);
  ok(d13.getCell(1).value === 1, 'A13 = so thu tu hoa don = 1');
  ok(String(d13.getCell(2).value) === '01/08/2026', 'B13 = ngay 01/08/2026', String(d13.getCell(2).value));
  ok(String(d13.getCell(3).value).indexOf('NPP Vĩnh Phúc') === 0, 'C13 = ten khach');
  ok(String(d13.getCell(4).value || '') === '', 'D13 (Ma khach hang) DE TRONG');
  ok(String(d13.getCell(6).value || '') === '', 'F13 (Ma so thue) DE TRONG — ke toan tu dien');
  ok(String(d13.getCell(8).value || '') === 'npp@example.com', 'H13 = email khach');
  ok(String(d13.getCell(13).value) === 'VND', 'M13 = VND');
  ok(Number(d13.getCell(15).value) === 17, 'O13 = ty le CK 17%');
  ok(Number(d13.getCell(16).value) === k4.ckTruocThue, 'P13 = tien CK da boc thue');
  ok(Number(d13.getCell(17).value) === 8, 'Q13 = 8 (% thue)');
  ok(Number(d13.getCell(18).value) === k4.tienThue, 'R13 = tien thue');
  ok(String(d13.getCell(24).value || '') === '' && String(d13.getCell(25).value || '') === '',
    'X13/Y13 (CK tung mat hang) DE TRONG — CK shop da nam trong gia dong');

  /* Dong 2 tro di: A co, B..R TRONG */
  const d14 = ws.getRow(14);
  ok(d14.getCell(1).value === 1, 'A14 = 1 (dien o MOI dong de nhom hoa don)');
  const trong = [2, 3, 5, 12, 13, 14, 17, 18].every(c => String(d14.getCell(c).value || '') === '');
  ok(trong, 'B14..R14 DE TRONG (thong tin dau hoa don chi o dong dau)');

  /* Moi dong hang phai co S..Z */
  k4.dong.forEach((x, i) => {
    const r = ws.getRow(13 + i);
    const okDong = String(r.getCell(19).value || '').indexOf(x.ten) === 0
      && String(r.getCell(20).value) === x.maHang
      && Number(r.getCell(22).value) === x.soLuong
      && Number(r.getCell(23).value) === x.donGia
      && Number(r.getCell(26).value) === x.thanhTien;
    ok(okDong, `Dong ${i + 1}: S/T/V/W/Z ghi dung (${x.maHang})`,
      `S=${r.getCell(19).value} T=${r.getCell(20).value} V=${r.getCell(22).value} W=${r.getCell(23).value} Z=${r.getCell(26).value}`);
  });
  /* Khong ghi tran xuong dong sau dong hang cuoi */
  const sauCuoi = ws.getRow(13 + k4.dong.length);
  ok(String(sauCuoi.getCell(19).value || '') === '' && !sauCuoi.getCell(26).value,
    'Khong ghi tran xuong dong sau dong hang cuoi');
  /* O so phai la SO, khong phai chuoi (cot trong mau dinh dang Text) */
  ok(typeof d13.getCell(26).value === 'number', 'O tien la kieu SO (khong phai chuoi)',
    typeof d13.getCell(26).value);
  /* Dieu can kiem thuc su: o KHONG con dinh dang Text ('@') cua file mau. ExcelJS khong ghi
     numFmt 'General' ra file (do la mac dinh) nen doc lai se ra `undefined` — chap nhan ca hai. */
  const nf = d13.getCell(26).numFmt;
  ok(nf !== '@', 'O so KHONG con dinh dang Text (@) cua file mau', String(nf));
  ok(nf === undefined || nf === 'General', 'numFmt la General (hoac undefined = General mac dinh)',
    String(nf));

  console.log('');
  console.log('=== 6. CANH BAO khi so lieu vo ly ===');
  /* Tong thanh toan lech xa -> thue tinh nguoc se vo ly -> phai canh bao */
  const hX = phieu();
  hX.TongThanhToan = 10000000;               // co tinh cho sai
  const kX = HD.tinhHoaDon(hX, dongHang);
  ok(kX.canhBao.length > 0, 'Co canh bao khi tien thue tinh nguoc lech xa 8%',
    kX.canhBao.join(' | '));
  const kRong = HD.tinhHoaDon(phieu(), []);
  ok(kRong.canhBao.some(c => /không có dòng hàng/.test(c)), 'Canh bao khi phieu khong co dong hang');

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log('File mau de mo xem: ' + duong);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
