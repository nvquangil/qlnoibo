/* ================================================================================================
   KIEM CHUNG v7.61 — TONG TIEN PHIEU NHAP KHO VAI
     · Danh sach phieu: them cot Tong tien (+ dong tong cuoi bang)
     · Popup xem phieu : them cot Thanh tien + dong TONG TIEN
     · Ban in          : them cot Thanh tien + dong TONG TIEN + tien bang chu

   HAI RUI RO CHINH, test nay canh ca hai:

   (A) HAI CON SO CHO CUNG MOT PHIEU. Cong no nha cung cap ghi no bang KGNhap * DonGiaNhap. Phieu
       nhap ma tu tinh kieu khac (vd cong them met * gia) thi tong tren phieu va so ghi no cua chinh
       phieu do lech nhau, nguoi dung khong biet ben nao dung. => MOT bieu thuc duy nhat o
       utils/tienVaiNhap.js, congno.js va khovai.js cung goi.

   (B) LECH COT BANG. `dongTongKgMet(lines, fKg, fMet, truoc, sau)` dat 2 o tong ngay sau `truoc`,
       nen rang buoc la: truoc + 2 + sau === so cot tieu de. `khoiTongTienHtml(lines, truoc, sau)`
       dat 1 o tien: truoc + 1 + sau === so cot tieu de. Sai la bang vo ma trinh duyet khong bao gi.
       Test DEM THAT so <th> cua tung bang roi doi chieu voi cac so trong loi goi.

   Chay:  node utils/kiem_tong_tien_phieu_nhap_vai.js
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const G = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(G, p), 'utf8');

let dat = 0, truot = 0;
const OK = (m) => { dat++; console.log('  OK   ' + m); };
const NO = (m) => { truot++; console.log('  SAI  ' + m); };
const kiem = (dk, m, them) => (dk ? OK(m) : NO(m + (them ? '  -> ' + them : '')));
const bang = (thuc, mong, m) => kiem(JSON.stringify(thuc) === JSON.stringify(mong), `${m}  [duoc: ${JSON.stringify(thuc)}]`);
const bo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sUtil = doc('utils/tienVaiNhap.js');
const sKV = doc('routes/khovai.js');
const sCN = doc('routes/congno.js');
const sFe = doc('../frontend/js/module.khovai.js');
const sIndex = doc('../frontend/index.html');

/* ================================================================================================
   1. MOT bieu thuc duy nhat
   ================================================================================================ */
console.log('\n=== 1. Mot ban cong thuc tien vai ===');
const util = require('./tienVaiNhap');
bang(util.bieuThucTienCay('vc'), '(ISNULL(vc.KGNhap, 0) * ISNULL(vc.DonGiaNhap, 0))',
  'bieuThucTienCay tra dung bieu thuc cong no dang dung');
bang(util.bieuThucTienCay('v'), '(ISNULL(v.KGNhap, 0) * ISNULL(v.DonGiaNhap, 0))', 'doi duoc bi danh bang');
bang(util.bieuThucTienCay(), '(ISNULL(vc.KGNhap, 0) * ISNULL(vc.DonGiaNhap, 0))', 'khong truyen bi danh -> vc');
bang(util.tienCay({ KGNhap: 12.5, DonGiaNhap: 80000 }), 1000000, 'tienCay: 12,5 KG x 80.000');
bang(util.tienCay({ KGNhap: null, DonGiaNhap: 80000 }), 0, 'KG rong -> 0 (khong ra NaN)');
bang(util.tienCay({ KGNhap: 10, DonGiaNhap: null }), 0, 'gia rong -> 0');
bang(util.tienCay({}), 0, 'dong rong -> 0');
bang(util.tongTien([{ KGNhap: 10, DonGiaNhap: 1000 }, { KGNhap: 5, DonGiaNhap: 2000 }]), 20000, 'tongTien cong dung');
/* Vai nhap theo MET: SoMet KHONG duoc tham gia phep nhan (cong no cung khong tinh). */
bang(util.tienCay({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }), 0,
  'cay chi co MET -> tien 0 (dung nhu cong no dang ghi, KHONG tu y nhan theo met)');
bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }), true, 'nhung PHAI danh dau la dang ngo');
bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 0, DonGiaNhap: 50000 }), false, 'khong met, khong KG -> khong canh bao');
bang(util.laTienNghiNgo({ KGNhap: 0, SoMet: 300, DonGiaNhap: 0 }), false, 'chua khai gia -> khong canh bao');
bang(util.laTienNghiNgo({ KGNhap: 10, SoMet: 300, DonGiaNhap: 5000 }), false, 'co KG -> binh thuong');

console.log('\n=== 1b. Khong con ban sao viet tay ===');
const demTay = (s) => (bo(s).replace(/\s+/g, ' ')
  .match(/ISNULL\(\w+\.KGNhap\s*,\s*0\)\s*\*\s*ISNULL\(\w+\.DonGiaNhap\s*,\s*0\)/g) || []).length;
kiem(demTay(sCN) === 0, 'congno.js KHONG con bieu thuc viet tay', String(demTay(sCN)));
kiem(demTay(sKV) === 0, 'khovai.js KHONG viet bieu thuc rieng', String(demTay(sKV)));
/* congno.js co 4 cho can tien vai: bang tong hop, so chi tiet NCC, bang chung tu, va sheet Excel.
   Ban dau toi chi sua 3 — cho thu 4 (xuat Excel) van con viet tay, chinh test nay bat duoc.
   Dem `bieuThucTienCay(` = so LOI GOI; dong require la `{ bieuThucTienCay }` nen khong dinh. */
kiem((sCN.match(/bieuThucTienCay\(/g) || []).length === 4,
  'congno.js goi util o DU 4 cho', String((sCN.match(/bieuThucTienCay\(/g) || []).length));
kiem(/require\('\.\.\/utils\/tienVaiNhap'\)/.test(sCN) && /require\('\.\.\/utils\/tienVaiNhap'\)/.test(sKV),
  'ca hai route deu NHAP tu util (khong phai ham o file khac)');

/* ================================================================================================
   2. Backend tra ve TongTien / ThanhTien
   ================================================================================================ */
console.log('\n=== 2. Backend khovai.js ===');
kiem(/ISNULL\(SUM\(\$\{bieuThucTienCay\('v'\)\}\), 0\) AS TongTien/.test(sKV),
  'danh sach phieu tra TongTien');
kiem(/\$\{bieuThucTienCay\('v'\)\} AS ThanhTien/.test(sKV), 'chi tiet phieu tra ThanhTien tung cay');
kiem(/AS SoCayThieuKG/.test(sKV), 'dem so cay co gia ma KG = 0 (de canh bao)');
kiem(/GROUP BY p\.PhieuNhapID/.test(sKV), 'van GROUP BY theo phieu (tong khong bi nhan ban)');

/* ================================================================================================
   3. CHAY THAT cac ham tien o frontend
   ================================================================================================ */
console.log('\n=== 3. CHAY THAT tienCuaCay / khoiTongTienHtml ===');
function catHam(src, ten) {
  const moc = src.search(new RegExp('function\\s+' + ten + '\\s*\\('));
  if (moc < 0) return null;
  const mo = src.indexOf('{', moc);
  let sau = 1, i = mo + 1, ch = null;
  for (; i < src.length && sau > 0; i++) {
    const c = src[i];
    if (ch) { if (c === ch && src[i - 1] !== '\\') ch = null; continue; }
    if (c === "'" || c === '"' || c === '`') { ch = c; continue; }
    if (c === '{') sau++; else if (c === '}') sau--;
  }
  return sau === 0 ? src.slice(moc, i) : null;
}
const mTien = catHam(sFe, 'tienCuaCay');
const mNghi = catHam(sFe, 'laTienNghiNgoVai');
const mTong = catHam(sFe, 'tongTienCay');
const mKhoi = catHam(sFe, 'khoiTongTienHtml');
kiem(!!mTien && !!mNghi && !!mTong && !!mKhoi, 'cat duoc 4 ham tu module.khovai.js');
const hop = new Function('fmtTien', `
  ${mTien}\n${mNghi}\n${mTong}\n${mKhoi}
  return { tienCuaCay, laTienNghiNgoVai, tongTienCay, khoiTongTienHtml };`)(
  (n) => String(Math.round(Number(n) || 0)));

bang(hop.tienCuaCay({ ThanhTien: 999, KGNhap: 1, DonGiaNhap: 1 }), 999,
  'UU TIEN ThanhTien cua backend (cung so voi cong no), khong tu nhan lai');
bang(hop.tienCuaCay({ KGNhap: 12.5, DonGiaNhap: 80000 }), 1000000,
  'backend cu chua tra ThanhTien -> tu nhan, van dung cong thuc do');
bang(hop.tienCuaCay({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }), 0, 'chi co met -> 0');
bang(hop.laTienNghiNgoVai({ KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 }), true, 'danh dau cay dang ngo');
bang(hop.tongTienCay([{ ThanhTien: 100 }, { KGNhap: 2, DonGiaNhap: 50 }]), 200, 'tong tron hai nguon van dung');
/* Ban JS o frontend PHAI ra dung so cua ban backend — hai ban lech nhau la loi kho thay nhat. */
const canh = [{ KGNhap: 12.5, DonGiaNhap: 80000 }, { KGNhap: 0, SoMet: 300, DonGiaNhap: 50000 },
  { KGNhap: 7, DonGiaNhap: 0 }, {}];
bang(canh.map(r => hop.tienCuaCay(r)), canh.map(r => util.tienCay(r)),
  'ban JS frontend ra DUNG so cua ban backend tren 4 canh');

const htmlKhoi = hop.khoiTongTienHtml([{ KGNhap: 0, SoMet: 5, DonGiaNhap: 100 }, { KGNhap: 2, DonGiaNhap: 100 }], 8, 1);
kiem(/TỔNG TIỀN/.test(htmlKhoi), 'khoi tong co nhan TONG TIEN');
kiem(/>200 đ</.test(htmlKhoi), 'so tong dung (0 + 200)', htmlKhoi.replace(/\s+/g, ' ').slice(0, 160));
kiem(/1 cây có đơn giá nhưng KG = 0/.test(htmlKhoi), 'neu ro so cay dang ngo thay vi hien 0 tro troi');

/* ================================================================================================
   4. DEM THAT SO COT — chan lech bang
   ================================================================================================ */
console.log('\n=== 4. So cot cua ba bang (dem that) ===');
/* Dem <th> nhung KHONG dinh <thead> — bay da mac o kiem_in_phieu_xuat_tra_ncc. */
const demTh = (s) => (s.match(/<th[\s>]/g) || []).length;
function soiBang(ten, moc) {
  const i = sFe.indexOf(moc);
  if (i < 0) { NO(`${ten}: khong tim thay bang`); return null; }
  const het = sFe.indexOf('</table>', i);
  const khoi = sFe.slice(i, het);
  const thead = khoi.slice(0, khoi.indexOf('</thead>'));
  const cot = demTh(thead);
  const kgMet = /dongTongKgMet\(lines,\s*'KGNhap',\s*'SoMet',\s*(\d+),\s*(\d+)\)/.exec(khoi);
  const tien = /khoiTongTienHtml\(lines,\s*(\d+),\s*(\d+)\)/.exec(khoi);
  console.log(`  · ${ten}: ${cot} cot tieu de`);
  if (kgMet) {
    const t = Number(kgMet[1]), s2 = Number(kgMet[2]);
    kiem(t + 2 + s2 === cot, `${ten}: dongTongKgMet(${t}, ${s2}) -> ${t}+2+${s2} = ${t + 2 + s2} phai bang ${cot}`);
  }
  if (tien) {
    const t = Number(tien[1]), s2 = Number(tien[2]);
    kiem(t + 1 + s2 === cot, `${ten}: khoiTongTienHtml(${t}, ${s2}) -> ${t}+1+${s2} = ${t + 1 + s2} phai bang ${cot}`);
  }
  return { khoi, cot };
}
const bIn = soiBang('BAN IN', '<th style="width:38px;">STT</th><th>Mã vải</th>');
const bXem = soiBang('POPUP XEM', '<th style="width:38px;">STT</th><th>Mã cây</th>');

/* Danh sach phieu: dem <th> va doi chieu voi colspan cua dong tong o tfoot + so <td> cua dong du lieu. */
const iDs = sFe.indexOf('<th>Số phiếu</th>');
const khoiDs = sFe.slice(iDs, sFe.indexOf('</table>', iDs));
const cotDs = demTh(khoiDs.slice(0, khoiDs.indexOf('</thead>')));
console.log(`  · DANH SACH PHIEU: ${cotDs} cot tieu de`);
kiem(/<th>Tổng tiền<\/th>/.test(khoiDs), 'danh sach phieu DA co cot Tong tien');
const tfoot = khoiDs.slice(khoiDs.indexOf('<tfoot>'));
const spans = [...tfoot.matchAll(/colspan="(\d+)"/g)].map(m => Number(m[1]));
const soOThuong = (tfoot.match(/<td(?![^>]*colspan)/g) || []).length;
kiem(spans.reduce((a, b) => a + b, 0) + soOThuong === cotDs,
  `dong TONG CONG cua danh sach: ${spans.join('+')}+${soOThuong} = ${spans.reduce((a, b) => a + b, 0) + soOThuong} phai bang ${cotDs}`);
kiem(/colspan="11" class="empty-hint"/.test(khoiDs) || new RegExp(`colspan="${cotDs}" class="empty-hint"`).test(khoiDs),
  `dong "chua co phieu nao" dung colspan = ${cotDs}`);

console.log('\n=== 5. Ban in ===');
kiem(!!bIn && /<th>Thành tiền<\/th>/.test(bIn.khoi), 'ban in co cot Thanh tien');
kiem(!!bIn && /<th>Giá nhập<\/th>/.test(bIn.khoi), 'ban in van co cot Gia nhap (don gia)');
kiem(/Tổng tiền bằng chữ/.test(sFe), 'ban in co dong tien bang chu');
kiem(/docSoTienBangChu\(tongTienCay\(lines\)\)/.test(sFe), 'tien bang chu lay TU CHINH tong vua tinh');
kiem(!!bXem && /<th>Thành tiền<\/th>/.test(bXem.khoi), 'popup xem co cot Thanh tien');

console.log('\n=== 6. Bump ?v= ===');
const v = (sIndex.match(/module\.khovai\.js\?v=([\d.]+)/) || [])[1];
kiem(v && parseFloat(v) >= 7.61, 'index.html: module.khovai.js?v= >= 7.61', String(v));

console.log('\n================================================================');
console.log(`KET QUA: ${dat} dat / ${truot} truot`);
process.exit(truot ? 1 : 0);
