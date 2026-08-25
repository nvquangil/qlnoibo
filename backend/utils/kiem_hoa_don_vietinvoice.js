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
  console.log('=== 7. GOP DONG THEO MA HANG — hoa don KHONG chi tiet mau (v7.45) ===');
  /* Cung mot ma hang ban 3 mau. Hoa don phai ra MOT dong: SL = tong, ten KHONG kem mau. */
  const nhieuMau = [
    { MaHang: 'QD26CT091', TenHang: 'Quần dài bé trai QD26CT091', TenMau: 'Đen',
      DonVi: 'Cái', SoLuongCai: 10, GiaBan: 108000, ThanhTien: 1080000 },
    { MaHang: 'QD26CT091', TenHang: 'Quần dài bé trai QD26CT091', TenMau: 'Ghi',
      DonVi: 'Cái', SoLuongCai: 6, GiaBan: 108000, ThanhTien: 648000 },
    { MaHang: 'QD26CT091', TenHang: 'Quần dài bé trai QD26CT091', TenMau: 'Navy',
      DonVi: 'Cái', SoLuongCai: 4, GiaBan: 108000, ThanhTien: 432000 },
    { MaHang: 'AT26C012', TenHang: 'Áo thu bé gái AT26C012', TenMau: 'Hồng',
      DonVi: 'Cái', SoLuongCai: 5, GiaBan: 216000, ThanhTien: 1080000 }
  ];
  const hG = phieu();
  hG.TongTienHang = 3240000; hG.TienTruocVAT = 3240000; hG.TongThanhToan = 3240000;
  const kG = HD.tinhHoaDon(hG, nhieuMau);
  ok(kG.dong.length === 2, '4 dong hang (3 mau cung ma) -> 2 dong hoa don', String(kG.dong.length));
  const gQD = kG.dong.find(x => x.maHang === 'QD26CT091');
  ok(!!gQD && gQD.soLuong === 20, 'SL gop = 10 + 6 + 4 = 20', gQD && String(gQD.soLuong));
  ok(gQD && gQD.ten === 'Quần dài bé trai QD26CT091', 'Ten hang KHONG kem mau', gQD && gQD.ten);
  ok(gQD && !/Đen|Ghi|Navy| - /.test(gQD.ten), 'Ten khong con dau vet mau nao', gQD && gQD.ten);
  ok(gQD && gQD.soMauDaGop === 3, 'Ghi lai da gop 3 dong (de canh bao/soi khi can)',
    gQD && String(gQD.soMauDaGop));
  /* Boc thue MOT LAN tren tong nhom, khong boc tung mau roi cong. */
  ok(gQD && gQD.thanhTien === Math.round(2160000 / 1.08),
    `Thanh tien gop = round(2.160.000 / 1.08) = ${Math.round(2160000 / 1.08)}`,
    gQD && String(gQD.thanhTien));
  /* Van phai giu bat bien SL x DonGia = ThanhTien sau khi gop. */
  kG.dong.forEach((x, i) => {
    ok(Math.round(x.soLuong * x.donGia) === x.thanhTien,
      `Dong gop ${i + 1}: SL ${x.soLuong} x ${x.donGia} = ${x.thanhTien}`,
      String(Math.round(x.soLuong * x.donGia)));
  });
  ok(kG.tongHoaDon === 3240000, 'Gop dong KHONG lam lech tong hoa don', String(kG.tongHoaDon));
  ok(kG.canhBao.length === 0, 'Gop dong khong sinh canh bao', kG.canhBao.join(' | '));

  console.log('');
  console.log('=== 8. KHOA GOP PHAI CO DON VI (bai hoc gop don khach v6.21) ===');
  /* Cung ma hang ma ban theo 2 don vi: gop lai la cong nham hai loai so luong. */
  const haiDonVi = [
    { MaHang: 'BD26C047', TenHang: 'Bộ dài tay BD26C047', TenMau: 'Ghi',
      DonVi: 'Cái', SoLuongCai: 12, GiaBan: 100000, ThanhTien: 1200000 },
    { MaHang: 'BD26C047', TenHang: 'Bộ dài tay BD26C047', TenMau: 'Ghi',
      DonVi: 'Bộ', SoLuongCai: 3, GiaBan: 400000, ThanhTien: 1200000 }
  ];
  const hDV = phieu();
  hDV.TongTienHang = 2400000; hDV.TienTruocVAT = 2400000; hDV.TongThanhToan = 2400000;
  const kDV = HD.tinhHoaDon(hDV, haiDonVi);
  ok(kDV.dong.length === 2, 'Cung ma nhung khac DVT -> KHONG gop (2 dong)', String(kDV.dong.length));
  ok(kDV.dong.every(x => x.soLuong !== 15), 'KHONG cong 12 Cai + 3 Bo thanh 15');
  ok(kDV.dong.map(x => x.dvt).sort().join(',') === 'Bộ,Cái', 'Giu ca hai DVT',
    kDV.dong.map(x => x.dvt).join(','));

  console.log('');
  console.log('=== 9. Ma hang TRONG (du lieu cu) van ra dong, khong roi ra ngoai ===');
  const khongMa = [
    { MaHang: '', TenHang: 'Hàng lẻ không mã', TenMau: 'Đỏ', DonVi: 'Cái',
      SoLuongCai: 2, GiaBan: 54000, ThanhTien: 108000 },
    { MaHang: '', TenHang: 'Hàng lẻ không mã', TenMau: 'Xanh', DonVi: 'Cái',
      SoLuongCai: 3, GiaBan: 54000, ThanhTien: 162000 }
  ];
  const hKM = phieu();
  hKM.TongTienHang = 270000; hKM.TienTruocVAT = 270000; hKM.TongThanhToan = 270000;
  const kKM = HD.tinhHoaDon(hKM, khongMa);
  ok(kKM.dong.length === 1, 'Khong co ma -> gop theo TEN HANG (1 dong)', String(kKM.dong.length));
  ok(kKM.dong[0].soLuong === 5, 'SL gop = 2 + 3 = 5', String(kKM.dong[0].soLuong));

  console.log('');
  console.log('=== 10. FILE THAT sau khi gop: dung so dong, khong ghi tran ===');
  const { wb: wbG } = await HD.taoWorkbookHoaDon(hG, nhieuMau, null);
  const duongG = path.join(os.tmpdir(), 'kiem_hoa_don_gop.xlsx');
  await wbG.xlsx.writeFile(duongG);
  const wbG2 = new ExcelJS.Workbook();
  await wbG2.xlsx.readFile(duongG);
  const wsG = wbG2.worksheets[0];
  ok(String(wsG.getRow(13).getCell(19).value || '') === 'Quần dài bé trai QD26CT091'
    || String(wsG.getRow(14).getCell(19).value || '') === 'Quần dài bé trai QD26CT091',
    'S ghi ten hang KHONG kem mau');
  ok(Number(wsG.getRow(13).getCell(22).value) + Number(wsG.getRow(14).getCell(22).value) === 25,
    'Tong SL 2 dong = 20 + 5 = 25 (khong mat hang nao khi gop)');
  ok(String(wsG.getRow(15).getCell(19).value || '') === '' && !wsG.getRow(15).getCell(26).value,
    'Dong 15 TRONG — 4 dong hang chi ghi 2 dong, khong con vet dong cu');

  console.log('');
  console.log('=== 11. THONG TIN KHACH lay tu 4 o HOA DON cua danh muc (v7.45) ===');
  const khDayDu = {
    TenKhachHang: 'NPP Vĩnh Phúc - A Chung',
    DiaChi: 'Kho Vĩnh Phúc, giao giờ hành chính',
    Email: 'chung@example.com',
    TenHoaDon: 'Công ty TNHH Thương mại A Chung',
    MaSoThue: '0123456789',
    DiaChiHoaDon: 'Số 1 Đường B, P.C, TP Vĩnh Yên, Vĩnh Phúc',
    EmailHoaDon: 'ketoan@achung.vn'
  };
  const { wb: wbK } = await HD.taoWorkbookHoaDon(phieu(), dongHang, khDayDu);
  const duongK = path.join(os.tmpdir(), 'kiem_hoa_don_khach.xlsx');
  await wbK.xlsx.writeFile(duongK);
  const wbK2 = new ExcelJS.Workbook();
  await wbK2.xlsx.readFile(duongK);
  const rK = wbK2.worksheets[0].getRow(13);
  ok(String(rK.getCell(3).value) === khDayDu.TenHoaDon,
    'C = TenHoaDon (ten phap nhan), KHONG phai ten goi hang ngay', String(rK.getCell(3).value));
  ok(String(rK.getCell(5).value) === khDayDu.DiaChiHoaDon,
    'E = DiaChiHoaDon, khong phai dia chi giao hang', String(rK.getCell(5).value));
  ok(String(rK.getCell(6).value) === '0123456789', 'F = MaSoThue', String(rK.getCell(6).value));
  ok(String(rK.getCell(8).value) === 'ketoan@achung.vn',
    'H = EmailHoaDon (uu tien hon email lien lac)', String(rK.getCell(8).value));

  console.log('');
  console.log('=== 12. Chua khai o hoa don -> LUI VE du lieu cu, khong de trong tho ===');
  const hL = phieu();
  const { kq: kqL } = await HD.taoWorkbookHoaDon(hL, dongHang,
    { TenKhachHang: 'X', DiaChi: 'Kho Vĩnh Phúc', Email: 'a@b.vn' });
  const { wb: wbL } = await HD.taoWorkbookHoaDon(hL, dongHang,
    { TenKhachHang: 'X', DiaChi: 'Kho Vĩnh Phúc', Email: 'a@b.vn' });
  const duongL = path.join(os.tmpdir(), 'kiem_hoa_don_lui.xlsx');
  await wbL.xlsx.writeFile(duongL);
  const wbL2 = new ExcelJS.Workbook(); await wbL2.xlsx.readFile(duongL);
  const rL = wbL2.worksheets[0].getRow(13);
  ok(String(rL.getCell(3).value) === hL.TenKhach, 'C lui ve TenKhach cua phieu', String(rL.getCell(3).value));
  ok(String(rL.getCell(5).value) === hL.DiaChi, 'E lui ve DiaChi cua phieu', String(rL.getCell(5).value));
  ok(String(rL.getCell(8).value) === 'a@b.vn', 'H lui ve Email lien lac (vi la email thuc)');
  ok(kqL.canhBao.some(c => /CHƯA khai Mã số thuế/.test(c)),
    'Canh bao khi khach chua khai MST', kqL.canhBao.join(' | '));

  console.log('');
  console.log('=== 13. DU LIEU CU: MST bi go vao o Email -> F lay SO, H DE TRONG ===');
  const { wb: wbM, kq: kqM } = await HD.taoWorkbookHoaDon(phieu(), dongHang,
    { TenKhachHang: 'Y', DiaChi: 'Hà Nội', Email: 'MST: 0123657890' });
  const duongM = path.join(os.tmpdir(), 'kiem_hoa_don_mst.xlsx');
  await wbM.xlsx.writeFile(duongM);
  const wbM2 = new ExcelJS.Workbook(); await wbM2.xlsx.readFile(duongM);
  const rM = wbM2.worksheets[0].getRow(13);
  ok(String(rM.getCell(6).value) === '0123657890',
    'F chi lay PHAN SO, BO chu "MST:" (day la loi nguoi dung bao)', String(rM.getCell(6).value));
  ok(String(rM.getCell(8).value || '') === '',
    'H DE TRONG — khong do chuoi "MST: ..." vao cot Email nua', String(rM.getCell(8).value));
  ok(kqM.canhBao.some(c => /không phải email/.test(c)), 'Canh bao o Email dang chua thu khac',
    kqM.canhBao.join(' | '));
  /* MST 13 so (co ma don vi truc thuoc) van nhan. */
  const { wb: wb13 } = await HD.taoWorkbookHoaDon(phieu(), dongHang,
    { TenKhachHang: 'Y', Email: 'MST: 0123657890-001' });
  const duong13 = path.join(os.tmpdir(), 'kiem_hoa_don_mst13.xlsx');
  await wb13.xlsx.writeFile(duong13);
  const wb13b = new ExcelJS.Workbook(); await wb13b.xlsx.readFile(duong13);
  ok(String(wb13b.worksheets[0].getRow(13).getCell(6).value) === '0123657890-001',
    'MST 10+3 (don vi truc thuoc) nhan nguyen ca ma nhanh',
    String(wb13b.worksheets[0].getRow(13).getCell(6).value));
  /* ⚠️ Go THUA/THIEU mot chu so -> KHONG duoc cat bua 10 so dau thanh mot MST sai. */
  const { kq: kq11 } = await HD.taoWorkbookHoaDon(phieu(), dongHang,
    { TenKhachHang: 'Y', Email: 'MST: 01236578901' });
  ok(kq11.canhBao.some(c => /CHƯA khai Mã số thuế/.test(c)),
    'MST 11 so (go sai) -> KHONG cat 10 so dau, bao chua khai de go tay', kq11.canhBao.join(' | '));

  console.log('');
  console.log('=== 14. KHONG nham SO DIEN THOAI (cung 10 so) thanh MST ===');
  const { kq: kqSDT } = await HD.taoWorkbookHoaDon(phieu(), dongHang,
    { TenKhachHang: 'Z', DiaChi: 'Số 25 ngõ 187 phố Hoa', SDT: '0912345678', Email: '', GhiChu: 'Giao trước 5h' });
  ok(kqSDT.canhBao.some(c => /CHƯA khai Mã số thuế/.test(c)),
    'Khong co MST that -> bao chua khai, KHONG nhat so nha/SDT lam MST', kqSDT.canhBao.join(' | '));
  /* Ghi chu la day so tron thi moi nhan — do la truong hop nguoi dung co tinh go MST vao day. */
  const { kq: kqGC } = await HD.taoWorkbookHoaDon(phieu(), dongHang,
    { TenKhachHang: 'Z', GhiChu: '0123456789' });
  ok(!kqGC.canhBao.some(c => /CHƯA khai Mã số thuế/.test(c)),
    'Ghi chu chi la 10 chu so tron -> nhan la MST');

  console.log('');
  console.log('=== 15. Khach chua gan (khachHang = null) van xuat duoc ===');
  const { wb: wbN } = await HD.taoWorkbookHoaDon(phieu(), dongHang, null);
  const duongN = path.join(os.tmpdir(), 'kiem_hoa_don_null.xlsx');
  await wbN.xlsx.writeFile(duongN);
  const wbN2 = new ExcelJS.Workbook(); await wbN2.xlsx.readFile(duongN);
  ok(String(wbN2.worksheets[0].getRow(13).getCell(3).value) === phieu().TenKhach,
    'khachHang = null -> C van co ten khach cua phieu');

  console.log('');
  console.log('=== 16. TEN VIET HOA DON cua MA HANG (v7.46, migration_v690) ===');
  const coTenHD = [
    { MaHang: 'BD26C0501', TenHang: 'Bộ dài tay bé gái BD26C0501', TenHoaDon: 'Bộ quần áo trẻ em',
      TenMau: 'Hồng', DonVi: 'Cái', SoLuongCai: 10, GiaBan: 108000, ThanhTien: 1080000 },
    { MaHang: 'BD26C0501', TenHang: 'Bộ dài tay bé gái BD26C0501', TenHoaDon: 'Bộ quần áo trẻ em',
      TenMau: 'Xanh', DonVi: 'Cái', SoLuongCai: 5, GiaBan: 108000, ThanhTien: 540000 },
    /* Ma KHAC nhung TenHoaDon GIONG -> phai la 2 DONG (gop theo MA, khong gop theo ten). */
    { MaHang: 'BD26C0502', TenHang: 'Bộ dài tay bé trai BD26C0502', TenHoaDon: 'Bộ quần áo trẻ em',
      TenMau: 'Ghi', DonVi: 'Cái', SoLuongCai: 5, GiaBan: 108000, ThanhTien: 540000 },
    /* Chua khai TenHoaDon -> lui ve TenHang. */
    { MaHang: 'AT26C012', TenHang: 'Áo thu bé gái AT26C012', TenHoaDon: null,
      TenMau: 'Kem', DonVi: 'Cái', SoLuongCai: 5, GiaBan: 108000, ThanhTien: 540000 }
  ];
  const hHD = phieu();
  hHD.TongTienHang = 2700000; hHD.TienTruocVAT = 2700000; hHD.TongThanhToan = 2700000;
  const kHD = HD.tinhHoaDon(hHD, coTenHD);
  ok(kHD.dong.length === 3, '2 mau cung ma gop lai -> 3 dong', String(kHD.dong.length));
  const d0501 = kHD.dong.find(x => x.maHang === 'BD26C0501');
  ok(d0501 && d0501.ten === 'Bộ quần áo trẻ em',
    'S lay TEN VIET HOA DON, khong lay ten noi bo', d0501 && d0501.ten);
  ok(d0501 && d0501.soLuong === 15, 'Gop 2 mau: SL 10 + 5 = 15', d0501 && String(d0501.soLuong));
  const dAT = kHD.dong.find(x => x.maHang === 'AT26C012');
  ok(dAT && dAT.ten === 'Áo thu bé gái AT26C012',
    'Chua khai TenHoaDon -> LUI VE TenHang', dAT && dAT.ten);
  ok(kHD.dong.filter(x => x.ten === 'Bộ quần áo trẻ em').length === 2,
    'Hai MA khac nhau trung TenHoaDon van la HAI DONG (gop theo ma, khong theo ten)');
  /* TenHoaDon co khoang trang thua -> khong duoc coi la "da khai" mot cach nua voi. */
  const kTrang = HD.tinhHoaDon(phieu(), [
    { MaHang: 'X1', TenHang: 'Ten noi bo X1', TenHoaDon: '   ', DonVi: 'Cái',
      SoLuongCai: 1, GiaBan: 1080, ThanhTien: 1080 }
  ]);
  ok(kTrang.dong[0].ten === 'Ten noi bo X1',
    'TenHoaDon chi co khoang trang -> coi nhu chua khai', kTrang.dong[0].ten);
  /* Ghi ra file that: cot S phai la ten hoa don. */
  const { wb: wbHD } = await HD.taoWorkbookHoaDon(hHD, coTenHD, null);
  const duongHD = path.join(os.tmpdir(), 'kiem_hoa_don_tenhd.xlsx');
  await wbHD.xlsx.writeFile(duongHD);
  const wbHD2 = new ExcelJS.Workbook(); await wbHD2.xlsx.readFile(duongHD);
  const wsHD = wbHD2.worksheets[0];
  const tenTrenFile = [13, 14, 15].map(r => String(wsHD.getRow(r).getCell(19).value || ''));
  ok(tenTrenFile.filter(t => t === 'Bộ quần áo trẻ em').length === 2
    && tenTrenFile.includes('Áo thu bé gái AT26C012'),
    'File that: cot S ghi ten hoa don (2 dong) + 1 dong lui ve ten noi bo', tenTrenFile.join(' / '));
  ok(!tenTrenFile.some(t => /BD26C0501|BD26C0502/.test(t)),
    'Ten noi bo (co ma hang trong ten) KHONG con tren hoa don', tenTrenFile.join(' / '));

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log('File mau de mo xem: ' + duong);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
