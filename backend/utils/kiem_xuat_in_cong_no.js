/* ================================================================================================
   KIEM CHUNG v7.82 — XUAT EXCEL + IN SO CONG NO
   ------------------------------------------------------------------------------------------------
   Nguyen: "cong no 2 chieu them xuat excel" -> roi "va chuc nang in" -> roi "phan cong no khach
   hang, nha cung cap them chuc nang in khi xem cong no".

   Test nay KHONG doc chuoi de doan dung/sai. No CHAY THAT:
     · Excel: dung ExcelJS that + taoTienIch() that cua routes/congno.js, roi doc lai tung o.
     · Ban in: cat inSoCongNo/COT_SO_1CHIEU/COT_SO_2CHIEU ra khoi module.congno.js, chay that,
       roi dung jsdom DEM O tung hang. Dem o la cach duy nhat bat duoc loi colspan lech — loi nay
       khong lam vo JS, chi lam bang in bi xo lech mot o, va nguoi doc se tuong so nam cot khac.

   ⚠️ HAI RANG BUOC DE SAI NHAT, moi cai co assert rieng:
     1. Dong TONG cua cot LUY KE phai lay dong TREN CUNG (so du hien tai), KHONG phai cong don ca
        cot. So xep moi-nhat-tren-dau (v7.79) nen cong don cot luy ke la con so vo nghia.
     2. Ban in phai in DUNG mang `rows` da nhan ve — khong goi lai API. In ra mot tap khac voi cai
        nguoi dung vua doi chieu tren man hinh la nguon cai nhau voi khach.

   Chay:  NODE_PATH=/tmp/tsd/node_modules node utils/kiem_xuat_in_cong_no.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong),
  `${m}  [duoc: ${JSON.stringify(thuc)}]`);

const sFe = doc('../frontend/js/module.congno.js');
const sBe = doc('routes/congno.js');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   0. CAT CODE THAT RA CHAY — khong viet lai logic trong test
   ================================================================================================ */
/* Cat mot khoi bat dau tu `moc` den khi dau mo/dong can bang. `mo`/`dong` de dung duoc cho ca
   `function ... { }` va `const X = (..) => [ ]`. */
function catKhoi(s, moc, mo, dong) {
  const i = s.indexOf(moc);
  if (i < 0) return '';
  let d = 0;
  for (let k = s.indexOf(mo, i); k < s.length; k++) {
    if (s[k] === mo) d++;
    else if (s[k] === dong) { d--; if (!d) return s.slice(i, k + 1); }
  }
  return '';
}

const thanIn = catKhoi(sFe, 'function inSoCongNo(opt) {', '{', '}');
const than1C = catKhoi(sFe, 'const COT_SO_1CHIEU = (rows, nhan) => [', '[', ']');
const than2C = catKhoi(sFe, 'const COT_SO_2CHIEU = (d) => [', '[', ']');
kiem(!!thanIn, 'cat duoc inSoCongNo()');
kiem(!!than1C, 'cat duoc COT_SO_1CHIEU (co tham so `nhan` de doi nhan cot)');
kiem(!!than2C, 'cat duoc COT_SO_2CHIEU');

/* Ban in bat buoc phai dung mang `rows` truyen vao. Neu ai do "cai tien" bang cach cho no tu goi
   API lay lai du lieu thi assert nay do — day la rang buoc nghiep vu, khong phai chuyen thm my. */
kiem(!/apiGet|fetch\(/.test(thanIn),
  'inSoCongNo KHONG goi API — in dung nhung dong dang xem tren man hinh');

/* Cac ham phu ma ban in dua vao — gia lap DON GIAN nhung DUNG BAN CHAT:
   fmtNumber phai co dau phan cach nghin (kieu vi-VN) de assert doc duoc so that. */
let banInCuoi = null;
const printHtmlGia = (tenFile, html, opts) => { banInCuoi = { tenFile, html, opts }; };
const escapeHtmlGia = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtNumberGia = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return '0';
  return x.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
};
const fmtDateGia = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (isNaN(t)) return '';
  const p = (v) => String(v).padStart(2, '0');
  return `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
};

const BanIn = new Function('printHtml', 'escapeHtml', 'fmtNumber', 'fmtDate',
  `${thanIn}\n${than1C};\n${than2C};\nreturn { inSoCongNo, COT_SO_1CHIEU, COT_SO_2CHIEU };`
)(printHtmlGia, escapeHtmlGia, fmtNumberGia, fmtDateGia);

const { JSDOM } = require('jsdom');
/* Bang du lieu -> ma tran o. Bang DAU TIEN la khoi dau phieu, bang THU HAI la so. */
function bangSo(html) {
  const d = new JSDOM('<body>' + html + '</body>').window.document;
  const bangs = [...d.querySelectorAll('table')];
  const b = bangs[bangs.length - 1];
  const soO = (tr) => [...tr.children].reduce((s, td) => s + (parseInt(td.getAttribute('colspan'), 10) || 1), 0);
  return {
    dauCot: [...b.querySelectorAll('thead th')].map(th => th.textContent.trim()),
    soOTieuDe: soO(b.querySelector('thead tr')),
    hang: [...b.querySelectorAll('tbody tr')].map(tr => ({
      o: [...tr.children].map(td => td.textContent.trim()), soO: soO(tr)
    })),
    dauPhieu: bangs[0].textContent.replace(/\s+/g, ' ').trim()
  };
}

/* ================================================================================================
   1. BAN IN SO MOT CHIEU (khach hang)
   ================================================================================================ */
console.log('\n=== 1. Ban in so MOT CHIEU (khach hang) ===');
const rowsKH = [
  { Ngay: '2026-09-06', Loai: 'Phiếu thu', SoPhieu: 'PT01', PhatSinh: 0, ThanhToan: 300000, LuyKe: 700000, DienGiai: 'thu tiền' },
  { Ngay: '2026-09-02', Loai: 'Phiếu bán hàng', SoPhieu: 'BH01', PhatSinh: 1000000, ThanhToan: 0, LuyKe: 1000000, DienGiai: 'bán áo' }
];
BanIn.inSoCongNo({
  tieuDe: 'SỔ CHI TIẾT CÔNG NỢ KHÁCH HÀNG', doiTuong: 'Cty ABC',
  dongTom: ['<b>Còn nợ:</b> 700.000 đ'],
  cot: BanIn.COT_SO_1CHIEU(rowsKH), rows: rowsKH, tenFile: 'So cong no - Cty ABC'
});
kiem(!!banInCuoi, 'goi printHtml (co ra ban in)');
let t = bangSo(banInCuoi.html);

bang(t.dauCot, ['TT', 'Ngày', 'Loại', 'Số phiếu', 'Phát sinh', 'Thanh toán', 'Còn nợ lũy kế', 'Diễn giải'],
  'dung 8 cot, co cot TT');
kiem(t.dauPhieu.includes('Cty ABC') && t.dauPhieu.includes('Ngày in'),
  'dau phieu co ten doi tuong + ngay in');
kiem(t.dauPhieu.includes('Còn nợ'), 'dau phieu co dong tom (con no)');
kiem(/mới nhất lên trên/.test(banInCuoi.html) && /đọc từ dưới lên/.test(banInCuoi.html),
  'co ghi chu: xep moi nhat tren dau, cot luy ke doc tu duoi len');
bang(banInCuoi.tenFile, 'So cong no - Cty ABC', 'ten file in = ten doi tuong (chuan dat ten phieu)');

console.log('\n  --- Dem o: moi hang phai du 8 o, khong lech ---');
bang(t.soOTieuDe, 8, 'hang tieu de: 8 o');
bang(t.hang.map(h => h.soO), [8, 8, 8], '2 hang du lieu + 1 hang TONG, hang nao cung 8 o');

console.log('\n  --- Noi dung dung thu tu man hinh (moi nhat tren dau) ---');
bang(t.hang[0].o.slice(0, 4), ['1', '06/09/2026', 'Phiếu thu', 'PT01'], 'hang 1 = phieu moi nhat, STT=1');
bang(t.hang[1].o.slice(0, 4), ['2', '02/09/2026', 'Phiếu bán hàng', 'BH01'], 'hang 2 = phieu cu hon');
bang(t.hang[0].o[4], '', 'phat sinh = 0 -> o TRONG (khong in "0" cho roi mat)');
bang(t.hang[0].o[5], '300.000', 'thanh toan 300.000 in dung dinh dang nghin');

console.log('\n  --- ⚠️ Dong TONG ---');
const tong1C = t.hang[2];
bang(tong1C.o[0], 'TỔNG', 'o dau dong tong ghi "TỔNG"');
bang(tong1C.o[1], '1.000.000', 'tong PHAT SINH = 1.000.000 (cong don ca cot)');
bang(tong1C.o[2], '300.000', 'tong THANH TOAN = 300.000 (cong don ca cot)');
bang(tong1C.o[3], '700.000',
  'tong CON NO LUY KE = 700.000 = dong TREN CUNG, KHONG phai 1.700.000 (khong cong don cot luy ke)');
bang(tong1C.o[4], '', 'cot Dien giai o dong tong de trong');

console.log('\n  --- So RONG ---');
BanIn.inSoCongNo({ tieuDe: 'SỔ', doiTuong: 'X', cot: BanIn.COT_SO_1CHIEU([]), rows: [], tenFile: 'x' });
const tr = bangSo(banInCuoi.html);
bang(tr.hang.length, 1, 'so rong -> dung 1 hang thong bao');
bang(tr.hang[0].soO, 8, 'hang thong bao trai du 8 o (colspan dung)');
kiem(/Chưa có phát sinh nào/.test(tr.hang[0].o[0]), 'ghi ro "Chua co phat sinh nao"');

/* ================================================================================================
   2. DOI NHAN COT cho so NCC / gia cong — ban in phai ghi DUNG chu nguoi dung dang thay
   ================================================================================================ */
console.log('\n=== 2. Doi nhan cot cho so NCC / nha gia cong ===');
BanIn.inSoCongNo({
  tieuDe: 'SỔ CHI TIẾT CÔNG NỢ NHÀ CUNG CẤP', doiTuong: 'NCC ABC',
  cot: BanIn.COT_SO_1CHIEU(rowsKH, { soPhieu: 'Số phiếu / HĐ', thanhToan: 'Đã trả' }),
  rows: rowsKH, tenFile: 'x'
});
t = bangSo(banInCuoi.html);
bang(t.dauCot, ['TT', 'Ngày', 'Loại', 'Số phiếu / HĐ', 'Phát sinh', 'Đã trả', 'Còn nợ lũy kế', 'Diễn giải'],
  'so NCC: "So phieu / HD" + "Da tra" (khop nhan tren man hinh NCC)');
bang(t.hang.map(h => h.soO), [8, 8, 8], 'doi nhan KHONG lam lech so o');

BanIn.inSoCongNo({
  tieuDe: 'GC', doiTuong: 'Nha GC',
  cot: BanIn.COT_SO_1CHIEU(rowsKH, { soPhieu: 'Lệnh SX / Số phiếu', thanhToan: 'Đã trả' }),
  rows: rowsKH, tenFile: 'x'
});
bang(bangSo(banInCuoi.html).dauCot[3], 'Lệnh SX / Số phiếu',
  'so gia cong: cot 4 la "Lenh SX / So phieu" (khop nhan tren man hinh gia cong)');

/* Nhan mac dinh phai con nguyen khi khong truyen `nhan` — de man khach hang khong bi doi theo. */
bang(BanIn.COT_SO_1CHIEU([]).map(c => c.nhan),
  ['Ngày', 'Loại', 'Số phiếu', 'Phát sinh', 'Thanh toán', 'Còn nợ lũy kế', 'Diễn giải'],
  'khong truyen `nhan` -> giu nhan mac dinh cua man khach hang');

/* ================================================================================================
   3. BAN IN SO HAI CHIEU — hai cot tien rieng
   ================================================================================================ */
console.log('\n=== 3. Ban in so HAI CHIEU ===');
const d2c = {
  tenKhachHang: 'Cty ABC', tenNCC: 'Cty ABC (NCC)',
  phaiThu: 700000, phaiTra: 400000, chenhLech: 300000,
  rows: [
    { Ngay: '2026-09-06', Ben: 'ThuVe', Loai: 'Phiếu thu', SoPhieu: 'PT01', PhaiThu: -300000, PhaiTra: 0, ChenhLech: 300000, DienGiai: '' },
    { Ngay: '2026-09-05', Ben: 'TraDi', Loai: 'Phiếu chi', SoPhieu: 'PC01', PhaiThu: 0, PhaiTra: -200000, ChenhLech: 600000, DienGiai: '' },
    { Ngay: '2026-09-03', Ben: 'TraDi', Loai: 'Nhập vải', SoPhieu: 'PN01', PhaiThu: 0, PhaiTra: 600000, ChenhLech: 400000, DienGiai: '' },
    { Ngay: '2026-09-02', Ben: 'ThuVe', Loai: 'Phiếu bán hàng', SoPhieu: 'BH01', PhaiThu: 1000000, PhaiTra: 0, ChenhLech: 1000000, DienGiai: '' }
  ]
};
BanIn.inSoCongNo({
  tieuDe: 'SỔ CÔNG NỢ 2 CHIỀU', doiTuong: 'Cty ABC  ·  NCC: Cty ABC (NCC)',
  dongTom: ['<b>Phải thu:</b> 700.000 đ · <b>Phải trả:</b> 400.000 đ · <b>Chênh lệch:</b> 300.000 đ (họ còn nợ mình)'],
  cot: BanIn.COT_SO_2CHIEU(d2c), rows: d2c.rows, tenFile: 'x'
});
t = bangSo(banInCuoi.html);
bang(t.dauCot, ['TT', 'Ngày', 'Chiều', 'Loại chứng từ', 'Số phiếu', 'Phải thu', 'Phải trả', 'Chênh lệch lũy kế', 'Diễn giải'],
  '9 cot, co cot "Chieu"');
kiem(t.dauCot.includes('Phải thu') && t.dauCot.includes('Phải trả'),
  '⚠️ HAI cot tien RIENG tren ban in (khong gop lam mot cot luy ke)');
bang(t.soOTieuDe, 9, 'hang tieu de: 9 o');
bang(t.hang.map(h => h.soO), [9, 9, 9, 9, 9], '4 hang du lieu + 1 hang TONG, hang nao cung 9 o');
/* Chi 4 hang DU LIEU moi co cot Chieu — hang TONG gop 5 o dau nen o[2] cua no la con so, khong
   phai cot Chieu. Doi chieu nham vao hang tong la loi CUA TEST, khong phai cua code. */
bang(t.hang.slice(0, 4).map(h => h.o[2]), ['Bán / thu', 'Mua / chi', 'Mua / chi', 'Bán / thu'],
  'cot Chieu dich dung chu tung dong');
bang(t.hang[0].o.slice(5, 8), ['-300.000', '', '300.000'],
  'phieu thu: PHAI THU −300.000, phai tra TRONG (khong dung sang chieu kia)');
bang(t.hang[2].o.slice(5, 8), ['', '600.000', '400.000'], 'nhap vai: PHAI TRA +600.000');

const tong2C = t.hang[4];
bang(tong2C.o[0], 'TỔNG', 'dong tong so 2 chieu');
bang(tong2C.o.slice(1, 4), ['700.000', '400.000', '300.000'],
  'TONG = 3 so cua backend (700.000 / 400.000 / 300.000), khop het voi the tren man hinh');

console.log('\n  --- Chenh lech AM (minh no ho) ---');
const dAm = { phaiThu: 100000, phaiTra: 900000, chenhLech: -800000, rows: [{ Ngay: '2026-09-02', Ben: 'TraDi', Loai: 'Nhập vải', SoPhieu: 'PN', PhaiThu: 0, PhaiTra: 900000, ChenhLech: -800000, DienGiai: '' }] };
BanIn.inSoCongNo({ tieuDe: 'x', doiTuong: 'x', cot: BanIn.COT_SO_2CHIEU(dAm), rows: dAm.rows, tenFile: 'x' });
bang(bangSo(banInCuoi.html).hang[1].o.slice(1, 4), ['100.000', '900.000', '-800.000'],
  'chenh lech AM in ra dau tru (khong bi Math.abs lam mat dau tren ban in)');

/* ================================================================================================
   4. GAN NUT IN — phai co o CA BON so, khong chi so 2 chieu
   ================================================================================================ */
console.log('\n=== 4. Nut In tren cac popup so ===');
function catHamFe(ten) { return catKhoi(sFe, 'async function ' + ten + '(', '{', '}'); }
/* v8.87: so khach hang doi tieu de thanh "SO TONG HOP" — bang nay liet ke theo CHUNG TU, con so
   10 cot cua nut "Xem so" moi la so chi tiet (co dong hang). Hai ban in cung mot ten thi nguoi nhan
   khong phan biet duoc dang cam cai nao. Ba so con lai GIU nguyen ten cu. */
[
  ['soChiTietKH', 'btnInSo', 'SỔ TỔNG HỢP CÔNG NỢ KHÁCH HÀNG'],
  ['soChiTietNCC', 'btnInSoNCC', 'SỔ TỔNG HỢP CÔNG NỢ NHÀ CUNG CẤP'],   // v8.89: doi cung so KH
  ['soChiTietGiaCong', 'btnInSoGC', 'SỔ CHI TIẾT CÔNG NỢ NHÀ GIA CÔNG / IN THÊU'],
  ['soDoiTac2Chieu', 'btnIn2c', 'SỔ CÔNG NỢ 2 CHIỀU']
].forEach(([ten, id, tieuDe]) => {
  const h = catHamFe(ten);
  kiem(!!h, `cat duoc ${ten}()`);
  kiem(h.includes('id="' + id + '"'), `${ten}: co nut In (#${id})`);
  kiem(new RegExp("#" + id + "'\\)\\.addEventListener").test(h), `${ten}: nut In da noi day su kien`);
  kiem(h.includes('inSoCongNo('), `${ten}: dung CHUNG bo dung inSoCongNo (khong dung bang in rieng)`);
  kiem(h.includes(tieuDe), `${ten}: tieu de ban in = "${tieuDe}"`);
  /* In dung du lieu DANG XEM: phai truyen thang `d.rows`, khong goi lai apiGet trong handler in. */
  kiem(/rows: d\.rows \|\| \[\]/.test(h), `${ten}: truyen thang d.rows (dung du lieu dang xem)`);
});

/* Nhan cot tren BAN IN phai khop nhan tren MAN HINH cua chinh so do. */
const hNCC = catHamFe('soChiTietNCC');
kiem(hNCC.includes('<th>Số phiếu / HĐ</th>') && /soPhieu: 'Số phiếu \/ HĐ'/.test(hNCC),
  'so NCC: nhan cot tren man hinh va tren ban in KHOP nhau');
const hGC = catHamFe('soChiTietGiaCong');
kiem(hGC.includes('<th>Lệnh SX / Số phiếu</th>') && /soPhieu: 'Lệnh SX \/ Số phiếu'/.test(hGC),
  'so gia cong: nhan cot tren man hinh va tren ban in KHOP nhau');

/* ================================================================================================
   5. XUAT EXCEL — chay that ExcelJS
   ================================================================================================ */
console.log('\n=== 5. Xuat Excel cong no 2 chieu (chay that ExcelJS) ===');
kiem(/router\.get\('\/doitac\/export',[^\n]*requireChucNang\('CONGNO', 'congnokh'\)/.test(sBe),
  'route /doitac/export gate quyen CONG NO + chuc nang congnokh (nhu 2 route kia)');
kiem(/taiFile\(\s*'\/api\/congno\/doitac\/export\?khachHangId=/.test(sFe),
  'popso 2 chieu co nut Xuat Excel goi dung route');

const ExcelJS = require(path.join('/tmp/tsd/node_modules', 'exceljs'));
const { taoTienIch } = require(path.join(G, 'routes/congno.js')).__kiemThu;

(async () => {
  const wb = new ExcelJS.Workbook();
  const tienIch = taoTienIch();
  /* Lay ham that ra khoi routes/congno.js. Hai ham nay khong nam trong __kiemThu (chung chi la ham
     dung Excel, khong co logic tinh tien) nen cat than ra chay — van la CODE THAT. */
  const thanSheet = catKhoi(sBe, 'function sheetDoiTac2Chieu(wb, tienIch, d) {', '{', '}');
  const thanTH = catKhoi(sBe, 'function sheetTongHopDoiTac(wb, tienIch, rows) {', '{', '}');
  kiem(!!thanSheet && !!thanTH, 'cat duoc sheetDoiTac2Chieu + sheetTongHopDoiTac');
  const so = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const lam2 = (v) => Math.round(so(v) * 100) / 100;
  const S = new Function('so', 'lam2', `${thanSheet}\n${thanTH}\nreturn { sheetDoiTac2Chieu, sheetTongHopDoiTac };`)(so, lam2);

  S.sheetDoiTac2Chieu(wb, tienIch, d2c);
  S.sheetTongHopDoiTac(wb, tienIch, [
    { tenKhachHang: 'Cty ABC', tenNCC: 'Cty ABC (NCC)', phaiThu: 700000, phaiTra: 400000, chenhLech: 300000 },
    { tenKhachHang: 'Cty XYZ', tenNCC: 'Cty XYZ', phaiThu: 100000, phaiTra: 900000, chenhLech: -800000 }
  ]);

  bang(wb.worksheets.map(w => w.name), ['Công nợ 2 chiều', 'Tổng hợp đối tác'],
    'file co DU 2 sheet: so cua doi tac nay + tong hop moi doi tac');

  const ws = wb.getWorksheet('Công nợ 2 chiều');
  const cotO = (r) => { const a = []; ws.getRow(r).eachCell({ includeEmpty: true }, c => a.push(c.value)); return a; };
  const chuoiCaSheet = JSON.stringify(ws.getSheetValues());
  kiem(chuoiCaSheet.includes('SỔ CÔNG NỢ 2 CHIỀU'), 'sheet co tieu de');
  kiem(chuoiCaSheet.includes('Cty ABC'), 'sheet ghi ten doi tac');
  kiem(/MỚI NHẤT lên trên/.test(chuoiCaSheet) && /đọc từ dưới lên/.test(chuoiCaSheet),
    '⚠️ sheet CANH BAO ro cot luy ke doc tu duoi len (nhu ban in)');

  /* Tim hang tieu de cot roi doi chieu tung o — khong dem hang cung. */
  let rTD = 0;
  ws.eachRow((row, i) => { if (!rTD && String(row.getCell(1).value || '') === 'Ngày') rTD = i; });
  kiem(rTD > 0, 'tim duoc hang tieu de cot');
  bang(cotO(rTD).map(v => String(v)),
    ['Ngày', 'Chiều', 'Loại chứng từ', 'Số phiếu', 'Phải thu (họ nợ mình)', 'Phải trả (mình nợ họ)',
      'Chênh lệch lũy kế', 'Diễn giải'], 'du 8 cot, hai cot tien ghi RO ai no ai');

  const hangDL = [];
  for (let i = rTD + 1; i <= ws.rowCount; i++) hangDL.push(cotO(i));
  bang(hangDL.length, 5, '4 dong chung tu + 1 dong TONG');
  bang(hangDL.map(h => h[3]), ['PT01', 'PC01', 'PN01', 'BH01', ''],
    'thu tu dong = thu tu man hinh (moi nhat len dau)');
  bang([hangDL[0][4], hangDL[0][5]], [-300000, null],
    'phieu thu: o PHAI THU la SO −300000, o phai tra de TRONG (null) — SUM duoc, doc de');
  bang([hangDL[2][4], hangDL[2][5]], [null, 600000], 'nhap vai: PHAI TRA = 600000');
  bang(hangDL[4].slice(2, 7), ['TỔNG', '', 700000, 400000, 300000],
    '⚠️ dong TONG = 3 so cua backend, KHOP voi ban in va voi the tren man hinh');
  bang(hangDL[4][7], 'họ còn nợ mình', 'dong TONG ket luan bang chu ai con no ai');

  console.log('\n  --- Dinh dang so + ke bang (chuan bat buoc cho moi file xuat) ---');
  const oTien = ws.getRow(rTD + 1).getCell(5);
  bang(oTien.numFmt, '#,##0', 'o tien co dinh dang so #,##0 (khong phai chuoi tho)');
  kiem(!!(oTien.border && oTien.border.top && oTien.border.left), 'o co ke bang (border)');
  bang(typeof hangDL[0][4], 'number', 'o tien luu la SO (Excel cong/loc duoc), khong phai chuoi');

  const ws2 = wb.getWorksheet('Tổng hợp đối tác');
  let rTD2 = 0;
  ws2.eachRow((row, i) => { if (!rTD2 && String(row.getCell(1).value || '') === 'Khách hàng') rTD2 = i; });
  const h2 = [];
  for (let i = rTD2 + 1; i <= ws2.rowCount; i++) { const a = []; ws2.getRow(i).eachCell({ includeEmpty: true }, c => a.push(c.value)); h2.push(a); }
  bang(h2.map(x => String(x[0])), ['Cty ABC', 'Cty XYZ', 'TỔNG'], 'sheet tong hop: 2 doi tac + dong TONG');
  bang(h2.map(x => x[5]), ['họ nợ mình', 'mình nợ họ', ''], 'ket luan tung doi tac dung dau');
  bang(h2[2].slice(2, 5), [800000, 1300000, -500000],
    'dong TONG sheet tong hop = 700+100 / 400+900 / 300+(−800)');

  /* File ghi ra duoc thi moi tin la khong vo. */
  const buf = await wb.xlsx.writeBuffer();
  kiem(buf.length > 5000, 'ghi ra file .xlsx that duoc', buf.length + ' byte');

  /* ================================================================================================
     6. v8.87 — SO CONG NO KHACH HANG LOC THEO KY
     ================================================================================================ */
  const sBE = fs.readFileSync(path.join(__dirname, '..', 'routes', 'congno.js'), 'utf8');
  const iHam = sBE.indexOf('async function soChiTietKH(pool');
  const hamBE = iHam < 0 ? '' : sBE.slice(iHam, sBE.indexOf("router.get('/congnokh/chitiet'"));

  console.log('\n=== 6a. Luy ke tinh TRUOC khi cat ky (neu khong thi cot "Con no luy ke" ra SO SAI) ===');
  kiem(iHam >= 0, 'cat duoc soChiTietKH() o backend');
  // Dua ky vao WHERE cua SQL la cong don lai tu 0 -> sai so ma van in dep de.
  kiem(!/WHERE[^`]{0,400}@tuNgay/i.test(hamBE), 'KHONG loc ky trong cau SQL');
  kiem(hamBE.indexOf('r.LuyKe = Math.round') < hamBE.indexOf('const tu = chuanNgay'),
    'tinh LuyKe xong roi MOI cat ky');
  kiem(/const truocKy = tu \? rows\.filter/.test(hamBE), 'duDauKy lay tu cac dong TRUOC tuNgay');
  kiem(/duCuoiKy = trongKy\.length \? trongKy\[trongKy\.length - 1\]\.LuyKe : duDauKy/.test(hamBE),
    'ky rong thi duCuoiKy = duDauKy (khong phai 0)');

  console.log('\n=== 6b. Ngay: UTC va dung dinh dang, khong de new Date() tu doan ===');
  // new Date('2026-10-31') ra UTC, new Date('2026-1-5') ra gio may -> tron hai kieu la lech ngay.
  kiem(/\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\$/.test(sBE), 'chuanNgay() chi nhan YYYY-MM-DD');
  kiem(/Date\.UTC\(/.test(sBE) && !/setHours\(23, 59, 59/.test(sBE),
    'dung Date.UTC, KHONG dung setHours (setHours sua theo gio may, cat mat cuoi ngay)');
  kiem(/cuoiNgay \? 23 : 0/.test(sBE), '"Den ngay" lay HET ngay (23:59:59.999)');
  // Quy tac du an: ngay vong ve phai la chuoi nguoi dung gui, khong qua toISOString().
  kiem(!/tu\.toISOString\(\)/.test(sBE) && /function vongNgay/.test(sBE),
    'vong ngay ve bang chuoi goc, KHONG dung toISOString()');
  kiem(/err\.loiNhapLieu\) return res\.status\(400\)/.test(sBE),
    'ky nhap sai tra 400 (loi nghiep vu), khong 500 va khong am tham bo bo loc');

  console.log('\n=== 6c. Tuong thich nguoc: khong truyen ky = y nhu truoc ===');
  kiem(/if \(!tu && !den\) \{[\s\S]{0,200}rows: rows\.slice\(\)\.reverse\(\), conNo/.test(hamBE),
    'khong co ky -> tra dung hinh cu (dashboard va cac cho goi cu khong phai sua)');
  kiem(/conNo,\s*\n\s*tuNgay: vongNgay/.test(hamBE) || /conNo,/.test(hamBE),
    'conNo GIU NGUYEN nghia "con no den hom nay" (duCuoiKy la truong rieng)');

  console.log('\n=== 6d. Frontend: dong DU DAU KY va modal khong chong nhau ===');
  const hKH = catHamFe('soChiTietKH');
  kiem(/<tr data-tong[^>]*>\s*\n?\s*<td>\$\{d\.tuNgay/.test(hKH) || /data-tong[\s\S]{0,200}DƯ ĐẦU KỲ/.test(hKH),
    'dong DU DAU KY co data-tong (khong thi bi danh so thu tu nhu mot chung tu)');
  kiem(/DƯ ĐẦU KỲ<\/td>/.test(hKH), 'co dong DU DAU KY');
  // closeModal() roi moi await la so cu bi day vao ngan xep, so moi mo chong len.
  kiem(/if \(dongTruoc\) closeModal\(\);/.test(hKH), 'dong modal cu SAU khi co du lieu, truoc khi mo modal moi');
  kiem(!/closeModal\(\); soChiTietKH\(/.test(hKH), 'KHONG closeModal() roi moi goi lai (co await o giua)');
  kiem(/Còn nợ hiện tại/.test(hKH), 'khi loc ky hien CA duCuoiKy LAN conNo');
  kiem(/Xuất Excel toàn bộ/.test(hKH),
    'nut xuat Excel noi ro la TOAN BO (route /export chua nhan ky — de nhan cu la hai ban lech nhau)');

  /* ================================================================================================
     7. v8.89 — SO NCC LAM GIONG SO KH + DONG TONG CONG LAI THEO KET QUA LOC
     ================================================================================================ */
  console.log('\n=== 7a. So NCC dung CHUNG ham cat ky voi so KH ===');
  kiem(/function catTheoKy\(rows, conNo, tuNgay, denNgay\)/.test(sBE), 'co ham dung chung catTheoKy()');
  // Hai so cat ky bang hai doan code rieng thi som muon mot ben tinh du dau ky kieu khac -> lech TIEN.
  kiem((sBE.match(/catTheoKy\(rows, conNo, tuNgay, denNgay\)/g) || []).length >= 2,
    'CA HAI so (KH va NCC) deu goi catTheoKy — khong viet hai ban');
  kiem(/async function soChiTietNCC\(pool, id, tuNgay, denNgay\)/.test(sBE), 'soChiTietNCC nhan ky');
  const khoiRouteNCC = sBE.slice(sBE.indexOf("router.get('/congnoncc/chitiet'"),
    sBE.indexOf("router.get('/congnoncc/chitiet'") + 700);
  kiem(/req\.query\.tuNgay, req\.query\.denNgay/.test(khoiRouteNCC), 'route NCC vong lai ky');
  /* Kiem ky PHAI o route, truoc khi chay truy van: so NCC chay 8 cau SQL roi moi toi catTheoKy(). */
  kiem(/const lk = loiKy\(req\.query\.tuNgay, req\.query\.denNgay\)/.test(khoiRouteNCC),
    'route NCC: kiem ky TRUOC khi chay truy van');
  kiem(/if \(lk\) return res\.status\(400\)/.test(khoiRouteNCC), 'route NCC: ky sai -> 400');
  const khoiRouteKH = sBE.slice(sBE.indexOf("router.get('/congnokh/chitiet'"),
    sBE.indexOf("router.get('/congnokh/chitiet'") + 700);
  kiem(/const lk = loiKy\(/.test(khoiRouteKH) && /if \(lk\) return res\.status\(400\)/.test(khoiRouteKH),
    'route KH: kiem ky truoc khi chay truy van, sai -> 400');

  const hNCC2 = catHamFe('soChiTietNCC');
  kiem(/if \(dongTruoc\) closeModal\(\);/.test(hNCC2), 'so NCC: dong modal cu SAU khi co du lieu');
  kiem(/DƯ ĐẦU KỲ<\/td>/.test(hNCC2), 'so NCC: co dong DU DAU KY');
  kiem(/Còn nợ hiện tại/.test(hNCC2), 'so NCC: hien ca duCuoiKy lan conNo khi loc ky');

  console.log('\n=== 7b. Dong TONG cong lai theo ket qua dang loc ===');
  /* Loc con 1 khach ma dong TONG van la tong cua toan bo -> nguoi doc tuong do la so cua khach dang
     xem. Day la con so TIEN. (Nguyen 2026-10-12) */
  const sCommon = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'common.js'), 'utf8');
  kiem(/function congLaiTong\(hien, dangLoc\)/.test(sCommon), 'wireTableSearch co congLaiTong()');
  kiem(/opts && opts\.tongTheoLoc/.test(sCommon), 'mac dinh TAT — bang nao khong bat thi chay y nhu cu');
  // Cong theo data-so (so tho), KHONG parse lai chuoi da dinh dang.
  kiem(/Number\(o\.dataset\.so\)/.test(sCommon), 'cong theo data-so (so tho), khong parse chuoi da dinh dang');
  /* 🔴 Khop theo TEN cot, khong theo vi tri. Khop theo chi so o van dung — nhung CHI VI o gop
     (colspan) cua dong tong dang nam o CUOI. Them mot o gop vao GIUA dong tong la tien roi nham
     cot, in ra van dep, khong bao loi gi. */
  kiem(/querySelectorAll\('\[data-cot\]\[data-so\]'\)/.test(sCommon), 'khop theo TEN cot (data-cot)');
  kiem(!/tr\.children\[i\]/.test(sCommon), 'KHONG con khop theo chi so o');
  kiem(/congLaiTong\(hien, tu\.length > 0\)/.test(sCommon), 'cong lai sau MOI lan go tim kiem');
  kiem(/data-nhan-tong/.test(sCommon), 'co nhan "(dang loc)" de biet dong TONG dang la tong cua gi');
  kiem(/typeof opts\.tomTat === 'function'/.test(sCommon),
    'co opts.tomTat de dong tom tat NGOAI bang cung doi theo (khong thi man hinh co 2 so mau thuan)');
  [['renderCongNoKH', 'khach hang', 'cnTomTatKH'], ['renderCongNoNCC', 'nha cung cap', 'cnTomTatNCC']]
  .forEach(([ten, nhan, idTom]) => {
    const h = catKhoi(sFe, 'async function ' + ten + '(', '{', '}');
    kiem(/tongTheoLoc: true/.test(h), `bang ${nhan}: bat tongTheoLoc`);
    kiem(/<span data-nhan-tong>TỔNG<\/span>/.test(h), `bang ${nhan}: nhan TONG boc trong data-nhan-tong`);
    kiem((h.match(/data-cot="[A-Za-z]+" data-so="\$\{/g) || []).length >= 8,
      `bang ${nhan}: cac o tien deu co data-cot + data-so (ca dong du lieu lan dong TONG)`);
    kiem(h.includes(`id="${idTom}"`) && h.includes(`#${idTom}`),
      `bang ${nhan}: dong tom tat tren thanh cong cu cung doi theo ket qua loc`);
    kiem(/tt\.tong\.ConNo/.test(h), `bang ${nhan}: tom tat lay tong tu ten cot ConNo`);
  });

  console.log('\n=== 8. Bump ?v= ===');
  const v = (sIndex.match(/module\.congno\.js\?v=([\d.]+)/) || [])[1];
  kiem(v && parseFloat(v) >= 8.89, 'index.html: module.congno.js?v= >= 8.89', String(v));
  const vc = (sIndex.match(/\/js\/common\.js\?v=([\d.]+)/) || [])[1];
  kiem(vc && parseFloat(vc) >= 8.89, 'index.html: common.js?v= >= 8.89 (sua wireTableSearch)', String(vc));

  console.log('\n================================================================');
  console.log(`KET QUA: ${dat} dat / ${truot} truot`);
  process.exit(truot ? 1 : 0);
})().catch(e => { console.error('LOI TEST: ' + e.stack); process.exit(1); });
