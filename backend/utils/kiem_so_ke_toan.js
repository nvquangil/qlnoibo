/* ================================================================================================
   KIEM CHUNG SO CHI TIET CONG NO (mau so ke toan 9 cot)                                   v7.34
   ------------------------------------------------------------------------------------------------
   KHONG CAN CSDL. Goi DUNG ham veSoKeToan() ma route /export dung, voi du lieu dung san theo dung
   mau nguoi dung gui (chi tiet cong no.xls), roi GHI FILE ra dia va DOC LAI de doi chieu:

       1. Dung 9 cot, dung ten cot theo tung loai so (khach hang / nha cung cap)
       2. Du dau ky + phat sinh no - phat sinh co = Du cuoi ky
       3. Moi chung tu co dong chi tiet thi cac dong do nam NGAY DUOI, thut le 4 khoang trang
       4. Chiet khau (Ps co tren dong HD) va phieu nhap lai KHONG bi tinh hai lan
       5. Bo loc ky: chung tu truoc ky don vao Du dau ky, chung tu sau ky bi bo han
       6. Cot tien la SO (numFmt), khong phai CHU -> Excel SUM duoc

   CACH DUNG (trong thu muc backend):
       node utils/kiem_so_ke_toan.js
   Ghi file mau ra: <thu muc tam>/kiem_so_ke_toan.xlsx  (mo len xem duoc)
   Thoat 0 = dat, 1 = co muc khong dat.
   ================================================================================================ */
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { __kiemThu } = require('../routes/congno');
const { veSoKeToan, xeTien, taoTienIch } = __kiemThu;

let dat = 0, truot = 0;
function ok(dieuKien, nhan, chiTiet) {
  if (dieuKien) { dat++; console.log('  OK   ' + nhan); }
  else { truot++; console.log('  TRUOT ' + nhan + (chiTiet ? '  -> ' + chiTiet : '')); }
}
const soDep = n => (Math.round(Number(n) || 0)).toLocaleString('vi-VN');

/* ------------------------------------------------------------------------------------------------
   DU LIEU DUNG: dung dang ma soChiTietKH() tra ve (MOI NHAT LEN TRUOC, co LuyKe tinh tu cu->moi).
   Lay so that tu mau nguoi dung gui de neu lech thi biet ngay lech o dau.
   ------------------------------------------------------------------------------------------------ */
function duLieuKH() {
  /* Xay theo thu tu CU -> MOI cho de doc, roi tinh LuyKe va lat lai giong soChiTietKH(). */
  const tho = [
    // truoc ky (2025) -> phai don vao Du dau ky
    { Ngay: '2025-12-20', Loai: 'Phiếu bán hàng', SoPhieu: 'PX25900', PhatSinh: 261735200, ThanhToan: 0, DienGiai: 'Xuất hàng 2025', CtLoai: 'PBH', CtID: 900 },
    // trong ky
    { Ngay: '2026-01-05', Loai: 'Phiếu bán hàng', SoPhieu: 'PX26010', PhatSinh: 6104000, ThanhToan: 0, DienGiai: '', CtLoai: 'PBH', CtID: 10 },
    { Ngay: '2026-01-07', Loai: 'Phiếu thu', SoPhieu: 'PT26013', PhatSinh: 0, ThanhToan: 6000000, DienGiai: 'A Lợi tt TM', CtLoai: 'PT', CtID: 13 },
    { Ngay: '2026-01-08', Loai: 'Phiếu nhập lại', SoPhieu: 'NL26012', PhatSinh: -540000, ThanhToan: 0, DienGiai: 'Nhập lại 1ri Tung Tung cotton', CtLoai: 'PNL', CtID: 12 },
    { Ngay: '2026-01-20', Loai: 'Điều chỉnh', SoPhieu: '', PhatSinh: 1000000, ThanhToan: 0, DienGiai: 'Điều chỉnh tăng', CtLoai: null, CtID: null },
    { Ngay: '2026-02-01', Loai: 'Phiếu bán hàng', SoPhieu: 'PX26099', PhatSinh: 24819480, ThanhToan: 0, DienGiai: 'Xuất kho', CtLoai: 'PBH', CtID: 99 },
    // sau ky -> phai bi bo han
    { Ngay: '2026-09-09', Loai: 'Phiếu bán hàng', SoPhieu: 'PX26999', PhatSinh: 777000, ThanhToan: 0, DienGiai: 'Ngoài kỳ', CtLoai: 'PBH', CtID: 999 }
  ];
  let luy = 0;
  tho.forEach(r => { luy += (r.PhatSinh || 0) - (r.ThanhToan || 0); r.LuyKe = luy; });
  return { rows: tho.slice().reverse(), luyCuoi: luy };   // dao chieu giong soChiTietKH()
}
const chiTietKH = new Map([
  ['PBH#900', [{ Ten: 'Hàng 2025', SoLuong: 100, DonVi: 'Cái', DonGia: 2617352, ThanhTien: 261735200 }]],
  ['PBH#10', [{ Ten: 'Bộ nỉ lông khóa cổ quần - Đen', SoLuong: 28, DonVi: 'Cái', DonGia: 218000, ThanhTien: 6104000 }]],
  ['PNL#12', [{ Ten: 'Bộ cotton giặc lộng bé - Hồng', SoLuong: 6, DonVi: 'Cái', DonGia: 90000, ThanhTien: 540000 }]],
  ['PBH#99', [
    { Ten: 'Bộ dài tay bé gái BD26C0501', SoLuong: 36, DonVi: 'Cái', DonGia: 123950, ThanhTien: 4462200 },
    { Ten: 'Bộ dài tay bé gái BD26C0502', SoLuong: 30, DonVi: 'Cái', DonGia: 157450, ThanhTien: 4723500 },
    { Ten: 'Bộ dài tay bé gái BD26C072', SoLuong: 36, DonVi: 'Cái', DonGia: 123950, ThanhTien: 4462200 },
    { Ten: 'Bộ dài tay bé trai BD26C047', SoLuong: 50, DonVi: 'Cái', DonGia: 134670, ThanhTien: 6733500 },
    { Ten: 'Bộ dài tay bé trai BD26C042', SoLuong: 36, DonVi: 'Cái', DonGia: 123280, ThanhTien: 4438080 }
  ]],
  ['PBH#999', [{ Ten: 'Ngoài kỳ', SoLuong: 1, DonVi: 'Cái', DonGia: 777000, ThanhTien: 777000 }]]
]);

function duLieuNCC() {
  const tho = [
    { Ngay: '2026-01-10', Loai: 'Nhập vải', SoPhieu: 'NKV-00007', PhatSinh: 50000000, ThanhToan: 0, DienGiai: 'HĐ 123', CtLoai: 'PNV', CtID: 7 },
    { Ngay: '2026-01-15', Loai: 'Phiếu chi', SoPhieu: 'PC26001', PhatSinh: 0, ThanhToan: 20000000, DienGiai: 'Trả tiền vải', CtLoai: 'PC', CtID: 1 },
    { Ngay: '2026-02-02', Loai: 'Trả vải NCC', SoPhieu: 'XKV-00009', PhatSinh: -3000000, ThanhToan: 0, DienGiai: 'Vải lỗi', CtLoai: 'PXV', CtID: 9 }
  ];
  let luy = 0;
  tho.forEach(r => { luy += (r.PhatSinh || 0) - (r.ThanhToan || 0); r.LuyKe = luy; });
  return { rows: tho.slice().reverse(), luyCuoi: luy };
}
const chiTietNCC = new Map([
  ['PNV#7', [{ Ten: 'Cotton 2 chiều - Trắng · cây C0001', SoLuong: 500, DonVi: 'Kg', DonGia: 100000, ThanhTien: 50000000 }]]
]);

/* ------------------------------------------------------------------------------------------------ */
(async () => {
  const tienIch = taoTienIch();
  /* Hai WORKBOOK rieng: ca hai so dung CUNG mot ten sheet ('So chi tiet cong no') - dung that thi moi
     file chi co mot so nen khong trung, con o day gop vao mot workbook la ExcelJS nem loi trung ten. */
  const wb = new ExcelJS.Workbook();
  const wbN = new ExcelJS.Workbook();

  console.log('');
  console.log('=== 1. SO KHACH HANG (ky 01/01/2026 - 28/02/2026) ===');
  const dKH = duLieuKH();
  const kqKH = veSoKeToan(wb, tienIch, {
    laKH: true, tenDoiTuong: 'Minh Thành - Hà Nội', rows: dKH.rows, chiTiet: chiTietKH,
    tuNgay: '2026-01-01', denNgay: '2026-02-28'
  });
  ok(kqKH.duDau === 261735200, 'Dư đầu kỳ = lũy kế của chứng từ CUỐI CÙNG trước kỳ', 'duDau=' + soDep(kqKH.duDau));
  /* Phat sinh no  = 6.104.000 + 1.000.000 + 24.819.480 = 31.923.480
     Phat sinh co  = 6.000.000 (phieu thu) + 540.000 (nhap lai, PhatSinh AM -> sang cot giam no) */
  ok(kqKH.tongNo === 31923480, 'Phát sinh nợ chỉ gồm chứng từ TRONG kỳ (bỏ 2025 và 09/2026)', soDep(kqKH.tongNo));
  ok(kqKH.tongCo === 6540000, 'Phiếu nhập lại (phát sinh ÂM) chạy sang cột giảm nợ, không trừ ở cột nợ', soDep(kqKH.tongCo));
  ok(kqKH.duDau + kqKH.tongNo - kqKH.tongCo === kqKH.duCuoi,
    'Dư đầu + nợ − có = Dư cuối (không đếm hai lần)',
    `${soDep(kqKH.duDau)} + ${soDep(kqKH.tongNo)} - ${soDep(kqKH.tongCo)} != ${soDep(kqKH.duCuoi)}`);
  ok(kqKH.soDong === 5, 'Đúng 5 chứng từ trong kỳ (loại 1 trước kỳ + 1 sau kỳ)', 'soDong=' + kqKH.soDong);

  console.log('');
  console.log('=== 2. SO NHA CUNG CAP (khong gioi han ky) ===');
  const dN = duLieuNCC();
  const kqN = veSoKeToan(wbN, tienIch, {
    laKH: false, tenDoiTuong: 'Vải Huyền My', rows: dN.rows, chiTiet: chiTietNCC
  });
  ok(kqN.duDau === 0, 'Không truyền kỳ -> Dư đầu kỳ = 0, mọi chứng từ vào trong kỳ', soDep(kqN.duDau));
  ok(kqN.tongNo === 50000000, 'Mua hàng (tăng nợ phải trả) = 50.000.000', soDep(kqN.tongNo));
  ok(kqN.tongCo === 23000000, 'Phiếu chi 20tr + trả vải 3tr = 23.000.000 ở cột giảm nợ', soDep(kqN.tongCo));
  ok(kqN.duCuoi === 27000000, 'Còn phải trả NCC = 27.000.000', soDep(kqN.duCuoi));

  console.log('');
  console.log('=== 3. xeTien(): tach tien mot dong thanh (tang no / giam no) ===');
  const t1 = xeTien({ PhatSinh: 5000, ThanhToan: 0 });
  const t2 = xeTien({ PhatSinh: -5000, ThanhToan: 0 });
  const t3 = xeTien({ PhatSinh: 0, ThanhToan: 5000 });
  ok(t1.tangNo === 5000 && t1.giamNo === 0, 'Phát sinh dương -> cột tăng nợ');
  ok(t2.tangNo === 0 && t2.giamNo === 5000, 'Phát sinh ÂM -> cột giảm nợ, đổi thành số DƯƠNG');
  ok(t3.tangNo === 0 && t3.giamNo === 5000, 'Thanh toán -> cột giảm nợ');

  /* --------------------------------------------------------------------------------------------
     GHI FILE ROI DOC LAI: doc lai moi biet chac cai gi thuc su nam trong o nao. Doc bien trong bo
     nho la tu kiem tra chinh minh.
     -------------------------------------------------------------------------------------------- */
  const duong = path.join(os.tmpdir(), 'kiem_so_ke_toan.xlsx');
  const duongN = path.join(os.tmpdir(), 'kiem_so_ke_toan_ncc.xlsx');
  await wb.xlsx.writeFile(duong);
  await wbN.xlsx.writeFile(duongN);
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.readFile(duong);
  const wb2N = new ExcelJS.Workbook(); await wb2N.xlsx.readFile(duongN);

  console.log('');
  console.log('=== 4. DOC LAI FILE: ' + duong + ' ===');
  ok(wb2.worksheets.length === 1 && wb2N.worksheets.length === 1, 'Mỗi file đúng 1 sheet sổ chi tiết');
  const ws = wb2.worksheets[0], wsN = wb2N.worksheets[0];
  ok(ws.name === 'Sổ chi tiết công nợ', 'Tên sheet = "Sổ chi tiết công nợ"', ws.name);

  /* Tim dong tieu de cot: dong dau tien co o A = 'Mã' */
  let dongTD = 0;
  ws.eachRow((r, i) => { if (!dongTD && String(r.getCell(1).value || '').trim() === 'Mã') dongTD = i; });
  ok(dongTD > 0, 'Tìm được dòng tiêu đề cột (ô A = "Mã")');
  const td = ws.getRow(dongTD);
  const nhan = [];
  for (let c = 1; c <= 9; c++) nhan.push(String(td.getCell(c).value || ''));
  ok(String(td.getCell(10).value || '') === '', 'Đúng 9 cột, không có cột thứ 10 lạc');
  ok(nhan.join('|') === 'Mã|Ngày|Số|Diễn giải|Số lượng|Đơn giá|Thành tiền|Bán hàng|Phiếu thu',
    'Sổ KHÁCH HÀNG: 2 cột tiền là "Bán hàng" / "Phiếu thu"', nhan.join(' | '));
  let dongTDn = 0;
  wsN.eachRow((r, i) => { if (!dongTDn && String(r.getCell(1).value || '').trim() === 'Mã') dongTDn = i; });
  const nhanN = [];
  for (let c = 8; c <= 9; c++) nhanN.push(String(wsN.getRow(dongTDn).getCell(c).value || ''));
  ok(nhanN.join('|') === 'Mua hàng|Phiếu chi',
    'Sổ NHÀ CUNG CẤP: 2 cột tiền là "Mua hàng" / "Phiếu chi" - CUNG THU TU voi so khach hang',
    nhanN.join(' | '));
  /* Thu tu 2 cot tien phai GIONG NHAU o ca hai so: cot 8 = hang, cot 9 = tien. Dao thu tu o mot so
     la loi da tung mac (nguoi dung phai nhac). */
  const duDauN = wsN.getRow(dongTDn + 2);
  ok(String(duDauN.getCell(4).value || '') === 'Dư đầu kỳ',
    'Sổ NCC cũng có dòng "Dư đầu kỳ" ở cùng vị trí', String(duDauN.getCell(4).value));

  /* Doc toan bo dong du lieu de kiem thu tu va dong chi tiet */
  const bang = [];
  ws.eachRow((r, i) => {
    if (i <= dongTD) return;
    bang.push({
      i, Ma: String(r.getCell(1).value || ''), Ngay: String(r.getCell(2).value || ''),
      So: String(r.getCell(3).value || ''), DienGiai: String(r.getCell(4).value == null ? '' : r.getCell(4).value),
      SoLuong: r.getCell(5).value, DonGia: r.getCell(6).value, ThanhTien: r.getCell(7).value,
      No: r.getCell(8).value, Co: r.getCell(9).value,
      fmtNo: r.getCell(8).numFmt, fmtTT: r.getCell(7).numFmt
    });
  });
  const iDau = bang.findIndex(r => r.DienGiai === 'Dư đầu kỳ');
  const iPS = bang.findIndex(r => r.DienGiai === 'Phát sinh trong kỳ');
  const iCuoi = bang.findIndex(r => r.DienGiai === 'Dư cuối kỳ');
  ok(iDau === 1, 'Dòng "Dư đầu kỳ" ngay sau dòng chú giải mã', 'vi tri=' + iDau);
  ok(iPS > iDau && iCuoi === iPS + 1, '"Phát sinh trong kỳ" rồi tới "Dư cuối kỳ" ở cuối sổ');
  ok(bang[iDau].No === 261735200, 'Dư đầu kỳ nằm ở cột NỢ của sổ khách hàng', String(bang[iDau].No));
  ok(bang[iPS].No === 31923480 && bang[iPS].Co === 6540000, 'Dòng phát sinh in đúng 2 tổng');
  ok(bang[iCuoi].No === 287118680, 'Dư cuối kỳ = 287.118.680', String(bang[iCuoi].No));

  /* Dong chi tiet: nam NGAY DUOI chung tu, thut le, va KHONG co so o 2 cot no/co
     (neu co thi dong hang bi cong vao tong -> chinh la loi "dem hai lan"). */
  const ctiet = bang.filter(r => /^ {4}\S/.test(r.DienGiai));
  /* 7 = 1 (PX26010) + 1 (NL26012) + 5 (PX26099). Phieu thu va Dieu chinh khong co dong hang;
     PX25900 (truoc ky) va PX26999 (sau ky) bi loai nen chi tiet cua chung cung phai mat theo. */
  ok(ctiet.length === 7, 'Có 7 dòng chi tiết hàng (1+1+5 trong kỳ, 2025 và 09/2026 bị loại)', 'dem=' + ctiet.length);
  ok(ctiet.every(r => !r.No && !r.Co), 'Dòng chi tiết KHÔNG ghi gì vào 2 cột nợ/có (không đếm hai lần)');
  ok(ctiet.every(r => !r.Ma && !r.Ngay && !r.So), 'Dòng chi tiết để trống Mã/Ngày/Số');
  const lech = ctiet.filter(r => Math.abs(Number(r.SoLuong) * Number(r.DonGia) - Number(r.ThanhTien)) > 1);
  ok(lech.length === 0, 'Mọi dòng chi tiết: Số lượng × Đơn giá = Thành tiền',
    lech.map(r => r.DienGiai.trim()).join('; '));
  /* Chung tu PX26099 co 5 dong hang -> phai la 5 dong lien tiep ngay sau no */
  const i99 = bang.findIndex(r => r.So === 'PX26099');
  const sau99 = bang.slice(i99 + 1, i99 + 6);
  ok(i99 > 0 && sau99.length === 5 && sau99.every(r => /^ {4}\S/.test(r.DienGiai)),
    'PX26099: đúng 5 dòng hàng nằm liền ngay dưới chứng từ');
  ok(Math.abs(sau99.reduce((a, r) => a + Number(r.ThanhTien || 0), 0) - 24819480) < 1,
    'Tổng thành tiền 5 dòng hàng = số tiền chứng từ PX26099',
    String(sau99.reduce((a, r) => a + Number(r.ThanhTien || 0), 0)));
  /* Chung tu ngoai ky KHONG duoc xuat hien */
  ok(!bang.some(r => r.So === 'PX26999'), 'Chứng từ sau kỳ (09/2026) bị loại khỏi sổ');
  ok(!bang.some(r => r.So === 'PX25900'), 'Chứng từ trước kỳ (12/2025) không in ra, chỉ dồn vào Dư đầu kỳ');
  /* O tien phai la SO va co numFmt -> Excel SUM duoc, khong phai chuoi "1.234.567" */
  ok(typeof bang[iPS].No === 'number' && bang[iPS].fmtNo === '#,##0',
    'Ô tiền là kiểu SỐ + numFmt #,##0 (Excel cộng/lọc được)',
    typeof bang[iPS].No + ' / ' + bang[iPS].fmtNo);

  console.log('');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  console.log(truot ? '>> CO MUC KHONG DAT - phai sua truoc khi giao.' : '>> DAT TAT CA.');
  console.log('File mau de mo xem: ' + duong);
  process.exit(truot ? 1 : 0);
})().catch(err => { console.error('LOI KIEM CHUNG: ' + err.stack); process.exit(1); });
